/**
 * 快照兜底:每天第一份;主文件 + .bak 都丢了还能从 backups/ 读回。
 */
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

process.env.DSH_HOME = mkdtempSync(join(tmpdir(), 'xzr-snap-'))
const { apply } = await import('./lib/index.js')

const routes = []
const ctx = { logger: { info() {}, warn: (...a) => console.log('[warn]', ...a) }, webServer: { register: (r) => { routes.push(r); return () => {} } } }
apply(ctx)
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

await call('/x-hot/library', 'POST', JSON.stringify({ key: 'a', title: '第一条' }))
const dir = join(process.env.DSH_HOME, 'xiaoyuzhou-hot')
console.log('files:', readdirSync(dir).sort().join(', '))
console.log('backups:', readdirSync(join(dir, 'backups')).join(', '))

// 主文件和 .bak 都删掉,重新加载应从日期快照恢复
await call('/x-hot/library', 'POST', JSON.stringify({ key: 'b', title: '第二条' }))
rmSync(join(dir, 'library.json'))
rmSync(join(dir, 'library.json.bak'))

const routes2 = []
apply({ logger: { info() {}, warn: (...a) => console.log('[warn2]', ...a) }, webServer: { register: (r) => { routes2.push(r); return () => {} } } })
const res = await new Promise((resolve) => {
  const req = { method: 'GET', url: '/x-hot/library', on() { return req }, destroy() {} }
  routes2.find((r) => r.path === '/x-hot/library').handler(req, { writeHead() {}, end(b) { resolve(JSON.parse(b)) } })
})
console.log('recovered from snapshot:', res.count, res.items.map((i) => i.title))
if (res.count < 1) throw new Error('snapshot recovery failed')
console.log('snapshot test ok')
