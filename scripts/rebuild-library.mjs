#!/usr/bin/env node
/**
 * 从会话历史重建「我的总结」记录(记录文件损坏/被清空后的补救)。
 *
 * 每个总结会话的第一条用户消息长这样:
 *   总结《播客》单集标题
 *   播客：…
 *   发布：…
 *   时长：…
 *   单集页：https://…
 *   音频直链：https://…
 *
 * 扫 $DSH_HOME/sessions 下所有会话,把这些字段抽出来写成记录:
 *   key 优先用单集 id(小宇宙 eid / 喜马拉雅 xmly_track_*),at 用会话文件时间。
 *
 *   node scripts/rebuild-library.mjs --dry-run
 *   node scripts/rebuild-library.mjs
 */
import { readdirSync, statSync, readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { homedir } from 'node:os'
import { join } from 'node:path'

const DSH_HOME = process.env.DSH_HOME || join(homedir(), '.dsh')
const SESSIONS = join(DSH_HOME, 'sessions')
const API = process.env.XZR_API || 'http://127.0.0.1:3080/x-hot/library'
const dryRun = process.argv.includes('--dry-run')

/** 会话文件是多段 zstd,node:zlib 只解第一段,所以走 CLI */
function decode(file) {
  try {
    return execFileSync('zstd', ['-dc', file], { maxBuffer: 256 * 1024 * 1024 }).toString('utf8')
  } catch {
    return ''
  }
}

function keyFromUrl(url) {
  const xyz = /xiaoyuzhoufm\.com\/episode\/([0-9a-f]{24})/i.exec(url)?.[1]
  if (xyz) return xyz
  const xmly = /ximalaya\.com\/sound\/(\d+)/i.exec(url)?.[1]
  if (xmly) return `xmly_track_${xmly}`
  return url
}

function parsePrompt(text) {
  const match = /^总结《(.+?)》([^\n]+)/.exec(text)
  if (!match) return undefined
  const field = (label) => new RegExp(`^${label}：(.+)$`, 'm').exec(text)?.[1]?.trim() ?? ''
  return {
    podcast: match[1].trim(),
    title: match[2].trim(),
    url: field('单集页'),
  }
}

const found = []
for (const workspace of readdirSync(SESSIONS)) {
  const dir = join(SESSIONS, workspace)
  let entries = []
  try {
    entries = readdirSync(dir)
  } catch {
    continue
  }
  for (const entry of entries) {
    if (!entry.startsWith('session-')) continue
    const file = join(dir, entry, 'session.v4.jsonl.zstd')
    let stat
    try {
      stat = statSync(file)
      if (!stat.isFile()) continue
    } catch {
      continue
    }
    const text = decode(file)
    if (!text.includes('"user/message"')) continue
    for (const line of text.split('\n')) {
      if (!line.includes('"user/message"')) continue
      let event
      try {
        event = JSON.parse(line)
      } catch {
        continue
      }
      for (const part of event?.data?.content ?? []) {
        const value = part?.text
        if (typeof value !== 'string' || !value.startsWith('总结《')) continue
        const parsed = parsePrompt(value)
        if (!parsed) continue
        found.push({ ...parsed, sessionId: entry, at: Math.round(stat.mtimeMs) })
        break
      }
    }
  }
}

// 同一集可能被总结过多次:保留最近那次
const byKey = new Map()
for (const item of found) {
  const key = keyFromUrl(item.url) || item.title
  const existing = byKey.get(key)
  if (!existing || existing.at < item.at) byKey.set(key, { ...item, key })
}

const items = [...byKey.values()].sort((a, b) => b.at - a.at)
console.log(`扫到 ${found.length} 个总结会话,归并后 ${items.length} 条记录`)
for (const item of items) {
  console.log(`  ${new Date(item.at).toLocaleString('zh-CN')}  ${item.podcast} · ${item.title.slice(0, 30)}`)
}

if (dryRun) process.exit(0)

let ok = 0
for (const item of items) {
  try {
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        key: item.key,
        title: item.title,
        podcast: item.podcast,
        url: item.url,
        sessionId: item.sessionId,
        at: item.at,
      }),
    })
    const data = await res.json().catch(() => null)
    if (res.ok && data?.ok) ok += 1
    else console.log(`  ! ${item.key} 写入失败:${data?.error ?? res.status}`)
  } catch (error) {
    console.log(`  ! 请求失败:${error.message}(dsh web 在跑吗?)`)
    break
  }
}
console.log(`已写入 ${ok}/${items.length}`)
