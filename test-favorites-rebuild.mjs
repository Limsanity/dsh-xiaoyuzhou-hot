/**
 * 「按总结历史补收藏」的自测:临时 DSH_HOME + 两个假的总结会话,
 * 一个用喜马拉雅单集、一个用小宇宙单集;检查 PID/Apple 两条推断路径。
 */
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { zstdCompressSync } from 'node:zlib'

process.env.DSH_HOME = mkdtempSync(join(tmpdir(), 'xzr-favrb-'))
const { apply } = await import('./lib/index.js')

function seedSession(id, prompt) {
  const dir = join(process.env.DSH_HOME, 'sessions', '--tmp--', `session-${id}`)
  mkdirSync(dir, { recursive: true })
  const line = JSON.stringify({ type: 'user/message', seq: 1, data: { content: [{ type: 'text', text: prompt }] } })
  writeFileSync(join(dir, 'session.v4.jsonl.zstd'), zstdCompressSync(Buffer.from(line + '\n')))
}

seedSession('s1', '总结《搞钱女孩》海盐\n\n播客：搞钱女孩\n单集页：https://www.xiaoyuzhoufm.com/episode/6ac6a657e742e36efcbf74af\n')
seedSession('s2', '总结《半拿铁 | 商业沉浮录》莆田鞋往事\n\n播客：半拿铁 | 商业沉浮录\n单集页：https://www.ximalaya.com/sound/999999999\n')

const routes = []
apply({ logger: { info() {}, warn: (...a) => console.log('[warn]', ...a) }, webServer: { register: (r) => { routes.push(r); return () => {} } } })
const call = (path, method = 'GET', body) => new Promise((resolve) => {
  const req = {
    method, url: path,
    on(ev, fn) {
      if (ev === 'data' && body) queueMicrotask(() => fn(Buffer.from(body)))
      if (ev === 'end') queueMicrotask(fn)
      return req
    },
    destroy() {},
  }
  routes.find((r) => r.path === path.split('?')[0]).handler(req, { writeHead() {}, end(b) { resolve(JSON.parse(b)) } })
})

const result = await call('/x-hot/favorites/rebuild', 'POST')
console.log('scanned:', result.scanned, '| added:', result.added, '| skipped:', result.skipped)
for (const item of result.items) console.log('  ★', item.title, '|', item.key, '|', item.author)
if (result.added < 1) throw new Error('expected at least one favorite')
if (!result.items.some((i) => i.key === '63d945ece725b5378a158d29')) throw new Error('xiaoyuzhou pid path failed')

const again = await call('/x-hot/favorites/rebuild', 'POST')
console.log('second run added:', again.added, '| skipped:', again.skipped.map((s) => s.reason))
if (again.added !== 0) throw new Error('second run should not add duplicates')
console.log('favorites rebuild test ok')
