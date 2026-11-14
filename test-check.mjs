/** 规则质检:好稿高分、坏稿扣分、能按 key 从会话里取正文。 */
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { zstdCompressSync } from 'node:zlib'

process.env.DSH_HOME = mkdtempSync(join(tmpdir(), 'xzr-check-'))
const { apply } = await import('./lib/index.js')

const routes = []
apply({ logger: { info() {}, warn: (...a) => console.log('[warn]', ...a) }, webServer: { register: (r) => { routes.push(r); return () => {} } } })
const call = (path, body) => new Promise((resolve) => {
  const req = {
    method: 'POST', url: path,
    on(ev, fn) {
      if (ev === 'data' && body) queueMicrotask(() => fn(Buffer.from(JSON.stringify(body))))
      if (ev === 'end') queueMicrotask(fn)
      return req
    },
    destroy() {},
  }
  routes.find((r) => r.path === path.split('?')[0]).handler(req, { writeHead() {}, body: [], end(b) { resolve(JSON.parse(b)) } })
})

const good = `## 一句话结论
这家公司把红外从军品做到民品，真正的门槛从探测器变成了"自己定义题目"。

## 分主题要点
他提到 2026 年营收 12 亿（董事长自述，口径未审计），研发不到 200 人。听完先问三句：BOM 涨多少？成本谁吃？不涨价的是标配还是选配？

## 我的判断
适合硬件创业者听。要打折扣的是"体验升级"这个说法。
复核清单：营收 ≥ 12 亿、毛利 ≥ 45%。`

const bad = `转录完成（42:58，mlx-whisper 用时 1.5 分钟）。会话：session-abc。以下是总结。

## 一、要点
2026 年 3 月收入 168 亿，增长 40%，用户 300 万，毛利 60%，订单 900 单，客单价 3000 元，复购 45%。`

const goodRes = await call('/x-hot/library/check', { key: 'k', text: good })
console.log('good:', goodRes.score, goodRes.grade, goodRes.issues.map((i) => i.code))
if (goodRes.score < 8) throw new Error('good summary scored too low')

const badRes = await call('/x-hot/library/check', { key: 'k', text: bad })
console.log('bad:', badRes.score, badRes.grade, badRes.issues.map((i) => i.code))
if (!badRes.issues.some((i) => i.code === 'process-log')) throw new Error('process log not detected')
if (badRes.score >= goodRes.score) throw new Error('bad should score lower')

// 按 key 从会话取正文
const text = '总结《测试播客》一集\n\n正文'
const assistant = { type: 'assistant/message', data: { message: { role: 'assistant', content: [{ type: 'text', text: '## 一句话结论\n这是从会话里读出来的总结。' + '补充内容。'.repeat(200) }] } } }
const dir = join(process.env.DSH_HOME, 'sessions', '--tmp--', 'session-x1')
mkdirSync(dir, { recursive: true })
writeFileSync(join(dir, 'session.v4.jsonl.zstd'), zstdCompressSync(Buffer.from(JSON.stringify(assistant) + '\n')))

await call('/x-hot/library', { key: 'e1', title: '测试', sessionId: 'session-x1' })
const fromSession = await call('/x-hot/library/check', { key: 'e1' })
console.log('from session:', fromSession.ok, fromSession.score, '| chars:', fromSession.stats?.chars)
if (!fromSession.ok) throw new Error('check from session failed')
console.log('check test ok')
