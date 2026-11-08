/**
 * 「重新关联会话」的自测:在临时 DSH_HOME 里造一个会话文件,
 * 检查 /x-hot/library/relink 能按标题把 sessionId 补回记录。
 */
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { zstdCompressSync } from 'node:zlib'

process.env.DSH_HOME = mkdtempSync(join(tmpdir(), 'xzr-relink-'))
const { apply } = await import('./lib/index.js')

const sessionId = 'session-abc12345-0000-4000-8000-000000000001'
const prompt = '总结《搞钱女孩》海盐：5 年医护月入 2K\n\n播客：搞钱女孩\n单集页：https://www.ximalaya.com/sound/1\n'
const event = { type: 'user/message', seq: 1, data: { content: [{ type: 'text', text: prompt }] } }
const dir = join(process.env.DSH_HOME, 'sessions', '--tmp-workspace--', sessionId)
mkdirSync(dir, { recursive: true })
writeFileSync(join(dir, 'session.v4.jsonl.zstd'), zstdCompressSync(Buffer.from(JSON.stringify(event) + '\n', 'utf8')))

const routes = []
apply({ logger: { info() {}, warn: (...a) => console.log('[warn]', ...a) }, webServer: { register: (r) => { routes.push(r); return () => {} } } })

const call = (path, method = 'GET', body) => new Promise((resolve) => {
  const req = {
    method,
    url: path,
    on(ev, fn) {
      if (ev === 'data' && body) queueMicrotask(() => fn(Buffer.from(body)))
      if (ev === 'end') queueMicrotask(fn)
      return req
    },
    destroy() {},
  }
  routes.find((r) => r.path === path.split('?')[0]).handler(req, { writeHead() {}, end(b) { resolve(JSON.parse(b)) } })
})

await call('/x-hot/library', 'POST', JSON.stringify({ key: 'e1', title: '海盐：5 年医护月入 2K', podcast: '搞钱女孩' }))
const relink = await call('/x-hot/library/relink', 'POST')
console.log('relink:', JSON.stringify({ scanned: relink.scanned, matched: relink.matched, linked: relink.linked }))
console.log('items:', relink.items.map((i) => [i.key, i.sessionId]))

if (relink.matched !== 1) throw new Error('expected 1 match')
if (relink.linked !== 1) throw new Error('expected 1 link')
if (relink.items[0].sessionId !== sessionId) throw new Error('sessionId not written')

const again = await call('/x-hot/library/relink', 'POST')
console.log('idempotent second run:', JSON.stringify({ matched: again.matched, linked: again.linked }))
if (again.linked !== 0) throw new Error('second run should not relink')
console.log('relink test ok')
