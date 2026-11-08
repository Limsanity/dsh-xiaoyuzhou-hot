import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// 测试绝不能碰真实记录:换一个临时 DSH_HOME,宿主按它落盘
process.env.DSH_HOME = mkdtempSync(join(tmpdir(), 'xzr-host-test-'))
const { apply } = await import('./lib/index.js')

const routes = []
const ctx = {
  logger: { info: (...a) => console.log('[info]', ...a), warn: (...a) => console.log('[warn]', ...a) },
  webServer: { register: (r) => { routes.push(r); return () => {} } },
}
apply(ctx, {})
console.log('routes:', routes.map((r) => `${r.kind} ${r.path}`))

function call(path, method = 'GET') {
  return new Promise((resolve) => {
    const req = { method, url: path }
    const chunks = []
    const res = {
      writeHead(status, headers) { this.status = status; this.headers = headers },
      end(body) { resolve({ status: this.status, headers: this.headers, body: JSON.parse(body) }) },
    }
    routes.find((r) => r.path === path.split('?')[0]).handler(req, res)
  })
}

const health = await call('/x-hot/health')
console.log('health:', health.status, health.body)

const list = await call('/x-hot/list?kind=podcasts&limit=3')
console.log('list status:', list.status, 'ok:', list.body.ok, 'items:', list.body.items?.length, 'total:', list.body.total)
console.log('first:', JSON.stringify(list.body.items?.[0], null, 1).slice(0, 400))

const ep = await call('/x-hot/list?kind=episodes&limit=2')
console.log('episodes:', ep.status, ep.body.items?.[0]?.title)

const bad = await call('/x-hot/list?kind=nope&limit=999')
console.log('fallback kind:', bad.body.kind, 'count:', bad.body.items?.length)

const cache = await call('/x-hot/list?kind=podcasts&limit=3')
console.log('cached flag:', cache.body.cached, 'same rank:', cache.body.items?.[0]?.rank)
