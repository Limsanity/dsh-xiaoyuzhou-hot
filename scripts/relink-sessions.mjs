#!/usr/bin/env node
/**
 * 把「我的总结」条目重新关联到 DSH 会话(数据事故后的补救工具)。
 *
 * 做两件事:
 *   1. 扫 $DSH_HOME/sessions 下所有会话,找以「总结《播客》单集标题」开头的用户消息;
 *   2. 按标题和 library.json 里的条目对齐,把该会话 id POST 回 /x-hot/library。
 *
 * 只读会话文件,不修改它们;写库走插件自己的接口(需要 dsh web 在跑)。
 *
 *   node scripts/relink-sessions.mjs            # 真写
 *   node scripts/relink-sessions.mjs --dry-run  # 只打印匹配结果
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { zstdDecompressSync } from 'node:zlib'

const DSH_HOME = process.env.DSH_HOME || join(homedir(), '.dsh')
const LIBRARY = join(DSH_HOME, 'xiaoyuzhou-hot', 'library.json')
const SESSIONS = join(DSH_HOME, 'sessions')
const API = process.env.XZR_API || 'http://127.0.0.1:3080/x-hot/library'
const dryRun = process.argv.includes('--dry-run')

const normalize = (text) => String(text ?? '').replace(/\s+/g, '')

function readLibrary() {
  try {
    const parsed = JSON.parse(readFileSync(LIBRARY, 'utf8'))
    return Array.isArray(parsed?.items) ? parsed.items : []
  } catch {
    return []
  }
}

function* sessionFiles(root) {
  let dirs = []
  try {
    dirs = readdirSync(root)
  } catch {
    return
  }
  for (const dir of dirs) {
    const workspace = join(root, dir)
    let entries = []
    try {
      if (!statSync(workspace).isDirectory()) continue
      entries = readdirSync(workspace)
    } catch {
      continue
    }
    for (const entry of entries) {
      if (!entry.startsWith('session-')) continue
      const file = join(workspace, entry, 'session.v4.jsonl.zstd')
      try {
        if (!statSync(file).isFile()) continue
      } catch {
        continue
      }
      // 目录名(含 session- 前缀)才是 Host 认识的 SessionId
      yield { sessionId: entry, file }
    }
  }
}

/**
 * DSH 的会话文件是多段 zstd 拼接,node:zlib 的 zstdDecompressSync 只解第一段
 * (实测只拿到 200 多字节),所以优先用 zstd CLI;没有 CLI 时退回单段解码并接受可能漏读。
 */
function decodeSession(file) {
  try {
    return execFileSync('zstd', ['-dc', file], { maxBuffer: 256 * 1024 * 1024 }).toString('utf8')
  } catch {
    try {
      return zstdDecompressSync(readFileSync(file)).toString('utf8')
    } catch {
      return undefined
    }
  }
}

function promptOf(file) {
  const raw = decodeSession(file)
  if (raw === undefined) return undefined
  // 注意:会话文件里的中文是 \uXXXX 转义的,不能直接在原文里 grep 中文,必须逐行 parse
  if (!raw.includes('"user/message"')) return undefined
  for (const line of raw.split('\n')) {
    if (!line.includes('"user/message"')) continue
    let event
    try {
      event = JSON.parse(line)
    } catch {
      continue
    }
    for (const part of event?.data?.content ?? []) {
      const text = part?.text
      if (typeof text !== 'string' || !text.startsWith('总结《')) continue
      const match = /^总结《(.+?)》([^\n]+)/.exec(text)
      if (match) return { podcast: match[1], title: match[2].trim() }
    }
  }
  return undefined
}

const items = readLibrary()
if (items.length === 0) {
  console.error(`没有读到记录:${LIBRARY}`)
  process.exit(1)
}
const byTitle = new Map(items.filter((item) => item.title).map((item) => [normalize(item.title), item]))

const matches = []
for (const { sessionId, file } of sessionFiles(SESSIONS)) {
  const prompt = promptOf(file)
  if (!prompt) continue
  const item = byTitle.get(normalize(prompt.title))
  if (!item) continue
  matches.push({ sessionId, item, prompt })
}

console.log(`记录 ${items.length} 条,命中会话 ${matches.length} 个`)
for (const { sessionId, item, prompt } of matches) {
  const same = item.sessionId === sessionId
  console.log(`  ${same ? '=' : '+'} ${sessionId}  ${prompt.podcast} · ${prompt.title.slice(0, 32)}`)
}

if (dryRun) process.exit(0)

let ok = 0
for (const { sessionId, item } of matches) {
  try {
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ key: item.key, sessionId }),
    })
    const data = await res.json().catch(() => null)
    if (res.ok && data?.ok) ok += 1
    else console.log(`  ! ${item.key} 写入失败:${data?.error ?? res.status}`)
  } catch (error) {
    console.log(`  ! 请求失败:${error.message}(dsh web 在跑吗?)`)
    break
  }
}
console.log(`已回写 ${ok}/${matches.length}`)
