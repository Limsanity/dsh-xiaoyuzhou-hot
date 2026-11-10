/**
 * 回归:一个还没读过盘的进程在 dispose 时,不能把已有记录写成空表。
 * (线上真实事故:重启时旧进程 dispose → 空写 → library/favorites 全清。)
 */
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

process.env.DSH_HOME = mkdtempSync(join(tmpdir(), 'xzr-guard-'))
const dir = join(process.env.DSH_HOME, 'xiaoyuzhou-hot')
mkdirSync(dir, { recursive: true })
const libraryPath = join(dir, 'library.json')
const seeded = { version: 1, items: [{ key: 'k1', title: '已有记录', at: 1 }] }
writeFileSync(libraryPath, JSON.stringify(seeded))

const { apply } = await import('./lib/index.js')
const effects = []
const ctx = {
  logger: { info() {}, warn: (...a) => console.log('[warn]', ...a) },
  webServer: { register: () => () => {} },
  effect: (fn) => {
    effects.push(fn())
  },
}
apply(ctx)

// 模拟重启:旧进程 dispose
for (const dispose of effects) dispose()
await new Promise((resolve) => setTimeout(resolve, 400))

const after = JSON.parse(readFileSync(libraryPath, 'utf8'))
console.log('items after dispose:', after.items.length, after.items.map((i) => i.title))
if (after.items.length !== 1) throw new Error('dispose wiped the store — regression!')

// 反面:读过盘之后再写,应该正常
const routes = []
apply({ logger: { info() {}, warn() {} }, webServer: { register: (r) => { routes.push(r); return () => {} } }, effect: () => {} })
const res = await new Promise((resolve) => {
  routes.find((r) => r.path === '/x-hot/library').handler({ method: 'GET', url: '/x-hot/library' }, { writeHead() {}, end(b) { resolve(JSON.parse(b)) } })
})
console.log('loaded via GET:', res.count)
if (res.count !== 1) throw new Error('existing record not readable')
console.log('guard test ok')
