/** 图片反代:白名单内取回、白名单外拒绝、非法协议拒绝。 */
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

process.env.DSH_HOME = mkdtempSync(join(tmpdir(), 'xzr-img-'))
const { apply } = await import('./lib/index.js')

const routes = []
apply({ logger: { info() {}, warn: (...a) => console.log('[warn]', ...a) }, webServer: { register: (r) => { routes.push(r); return () => {} } } })
const route = routes.find((r) => r.path === '/x-hot/img')
const fetchImage = (url) =>
  new Promise((resolve) => {
    const req = { method: 'GET', url: '/x-hot/img?url=' + encodeURIComponent(url), on() { return req }, destroy() {} }
    route.handler(req, {
      writeHead(status, headers) { this.status = status; this.headers = headers },
      end(body) { resolve({ status: this.status, type: this.headers?.['content-type'], size: body?.length ?? 0 }) },
    })
  })

const xyz = await fetchImage('https://image.xyzcdn.net/FrYMqb37Wg_LA8aenDJJ8SFGsjea')
console.log('xyzcdn:', JSON.stringify(xyz))
if (xyz.status !== 200 || !String(xyz.type).startsWith('image/')) throw new Error('xyzcdn proxy failed')

const apple = await fetchImage('https://is1-ssl.mzstatic.com/image/thumb/Podcasts221/v4/54/d2/5e/54d25e7d-fe19-dcf0-cb4b-85dce4ec10b0/mza_2102588857142453432.jpeg/100x100bb.jpg')
console.log('mzstatic:', JSON.stringify(apple))
if (apple.status !== 200) throw new Error('mzstatic proxy failed')

const blocked = await fetchImage('https://example.com/logo.png')
console.log('blocked:', JSON.stringify(blocked))
if (blocked.status !== 400) throw new Error('allowlist not enforced')

const fileUrl = await fetchImage('file:///etc/passwd')
if (fileUrl.status !== 400) throw new Error('file:// must be rejected')

console.log('image proxy test ok')
