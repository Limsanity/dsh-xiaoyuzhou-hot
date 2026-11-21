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

const good = `## 这期讲什么
一期聊父母长期伤人、却坚称"我们只是不会表达爱"的来信答疑。

## 分段总结

### 判断爱只能看可核对的东西
他先立了一条标准：意图不可核，资源与拒绝可核。来信人自述家里劝她退学、学费靠贷款（18:39），而她工作第一年给家里买房时看见母亲卡里有钱（19:11）。他提到，这笔对照比任何"她心里爱你"都更能说明资源去了哪里。

### 伤害没有代价，"总有一天会好"就不成立
他引《要有光》里一位老师的观察：一旦开始打孩子，家长就很难停下来（29:47）。随后补了四条收益：没有后果、强化权威、孩子更顺从、情绪有出口。他的结论是"你所期待的那种好是永远不会来的"（32:33）。`

const bad = `转录完成（42:58，mlx-whisper 用时 1.5 分钟）。会话：session-abc。以下是总结。

## 一、金句
- 「一旦开始打孩子，家长就很难停下来」
- 「你所期待的那种好是永远不会来的」

## 二、我的判断
- 2026 年 3 月收入 168 亿，增长 40%，用户 300 万，毛利 60%，订单 900 单。
- 这条要打折扣，该复核的是样本量。`

const goodRes = await call('/x-hot/library/check', { key: 'k', text: good })
console.log('good:', goodRes.score, goodRes.grade, goodRes.issues.map((i) => i.code))
if (goodRes.score < 8) throw new Error('good summary scored too low')

const badRes = await call('/x-hot/library/check', { key: 'k', text: bad })
console.log('bad:', badRes.score, badRes.grade, badRes.issues.map((i) => i.code))
if (!badRes.issues.some((i) => i.code === 'process-log')) throw new Error('process log not detected')
if (!badRes.issues.some((i) => i.code === 'forbidden-sections')) throw new Error('extra sections not detected')
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
