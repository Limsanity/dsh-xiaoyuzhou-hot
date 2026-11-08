/**
 * 客户端 bundle 的端到端自测(jsdom 里真实 mount,数据打真实上游):
 *
 *  1. 用假 window.__ModuleLoader__ 加载 lib/client.js(react 由 require 提供)
 *  2. 断言 apply 注册了 sidebar.panellist + main,且注入 summarize/openExternal
 *  3. 榜单:渲染 100 行;点播客 → 原地进频道(不跳浏览器、不开会话)
 *  4. 频道:拉到分集(优先 RSS);点一集 → startSession,预填 prompt 带音频直链
 *  5. 返回榜单 → 切单集 tab → 点一集 → startSession;↗ 按钮打开小宇宙
 *  6. 导出 preview.html / preview-episodes.html / preview-channel.html
 */
import { createRequire } from 'node:module'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { zstdCompressSync } from 'node:zlib'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { JSDOM } from 'jsdom'
import React from 'react'
import { createLibraryIndex } from './src/client/library-index.js'

const require = createRequire(import.meta.url)

// 测试绝不能碰真实记录:宿主按 DSH_HOME 落盘,这里换到临时目录
process.env.DSH_HOME = mkdtempSync(join(tmpdir(), 'xzr-client-test-'))
const RELINK_SESSION = 'feed0000-1111-4222-8333-444444444444'
{
  // 一个"当时没抓到 id"的总结会话,正文只用于标题匹配
  const prompt = '总结《三个火呛手》Vol.163 人生是一片旷野 方向就是前进\n\n播客：三个火呛手\n'
  const line = JSON.stringify({ type: 'user/message', seq: 1, data: { content: [{ type: 'text', text: prompt }] } })
  const dir = join(process.env.DSH_HOME, 'sessions', '--tmp--', `session-${RELINK_SESSION}`)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'session.v4.jsonl.zstd'), zstdCompressSync(Buffer.from(line + '\n')))
}

// ---- 0. jsdom 必须先建:bundle 加载时就把 window 捕获了 ----------------------
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'http://127.0.0.1:3080/',
  pretendToBeVisual: true,
})
const { window } = dom
globalThis.window = window
globalThis.document = window.document
globalThis.HTMLElement = window.HTMLElement
globalThis.IS_REACT_ACT_ENVIRONMENT = true

// ---- 1. loader ---------------------------------------------------------------
let loaded
window.__ModuleLoader__ = { load: (mod) => { loaded = mod } }
const code = readFileSync(new URL('./lib/client.js', import.meta.url), 'utf8')
new Function('window', 'require', code)(window, require)
if (!loaded) throw new Error('client bundle did not call __ModuleLoader__.load')
const mod = loaded.factory(require)
console.log('bundle id:', loaded.id, '| exports:', Object.keys(mod).sort().join(', '))
console.log('PANEL_ID:', mod.PANEL_ID, '| inject:', JSON.stringify(mod.inject))

// ---- 1.5 「已总结」索引:同一个单集换了来源(id 不同)也要认出来 ----
{
  const index = createLibraryIndex([{ key: '6ac6a657e742e36efcbf74af', title: '海盐：5 年医护月入 2K' }])
  const fromRss = { id: 'xmly_track_1017953539', title: '海盐：5 年医护月入 2K' }
  if (!index.has(fromRss)) throw new Error('cross-source title match failed')
  if (index.find(fromRss)?.key !== '6ac6a657e742e36efcbf74af') throw new Error('should resolve to the existing key')
  if (index.has({ id: 'other', title: '完全不同的单集' })) throw new Error('unrelated episode should not match')
  console.log('library index: cross-source title match ok')
}

// ---- 2. slots + fake uiWorkspace --------------------------------------------
const sessionCalls = []
const openedSessions = []
const fakeWorkspace = {
  startSession: (workspaceId, options) => sessionCalls.push({ workspaceId, options }),
  openSession: (sessionId) => openedSessions.push(sessionId),
}
const byId = { existing: {} }
const fakeSessions = { list: { getSnapshot: () => ({ phase: 'ready', byId }) } }
const regs = []
const ctx = {
  logger: { error: console.error },
  inject: (names, fn) => {
    const services = { uiWorkspace: fakeWorkspace, sessions: fakeSessions }
    fn(Object.fromEntries(names.map((name) => [name, services[name]])))
  },
  slots: { inject: (_name, fn) => fn(), register: (meta, comp) => { regs.push({ meta, comp }); return () => {} } },
}
mod.apply(ctx)
console.log('registrations:', regs.map((r) => `${r.meta.name}/${r.meta.key ?? r.meta.id}`).join(' , '))
const side = regs.find((r) => r.meta.name === 'sidebar.panellist')
const main = regs.find((r) => r.meta.name === 'main')
if (!side || side.meta.id !== mod.PANEL_ID) throw new Error('sidebar registration wrong')
if (!main || main.meta.key !== mod.PANEL_ID) throw new Error('main registration key mismatch')
const mainProps = main.meta.inject ? main.meta.inject() : {}
console.log('injected props:', Object.keys(mainProps).join(', '))

// ---- 3. 宿主路由 + fetch 桥接 ------------------------------------------------
const { apply: hostApply } = await import('./lib/index.js')
const routes = []
hostApply({ logger: { info() {}, warn: console.warn }, webServer: { register: (r) => routes.push(r) } })
const realFetch = globalThis.fetch
const opened = []
Object.defineProperty(window, 'open', {
  value: (url) => { opened.push(url); return null },
  writable: true,
  configurable: true,
})
const libraryPosts = []
globalThis.fetch = async (url, init = {}) => {
  const raw = String(url)
  if (/^https?:\/\//.test(raw)) return realFetch(raw, init)
  // 精确匹配:宿主的路由都是 exact,用 startsWith 会让 /x-hot/library 抢走 /x-hot/library/relink
  const pathname = raw.split('?')[0]
  const route = routes.find((r) => r.path === pathname)
  if (!route) return new Response(JSON.stringify({ ok: false, error: 'no route ' + raw }), { status: 404 })
  if ((init.method ?? 'GET') === 'POST') libraryPosts.push(JSON.parse(init.body ?? '{}'))
  const req = {
    method: init.method ?? 'GET',
    url: raw,
    on(ev, fn) {
      if (ev === 'data' && init.body) queueMicrotask(() => fn(Buffer.from(init.body)))
      if (ev === 'end') queueMicrotask(fn)
      return req
    },
    destroy() {},
  }
  const body = await new Promise((resolve) => {
    route.handler(req, { writeHead() {}, end(b) { resolve(b) } })
  })
  return new Response(body, { status: 200, headers: { 'content-type': 'application/json' } })
}

// ---- 4. mount ----------------------------------------------------------------
const { createRoot } = require('react-dom/client')
const act = React.act
const container = window.document.getElementById('root')
const root = createRoot(container)
const tick = async (ms) => act(async () => { await new Promise((r) => setTimeout(r, ms)) })
const click = async (el) => act(async () => el.dispatchEvent(new window.MouseEvent('click', { bubbles: true })))

await act(async () => root.render(React.createElement(main.comp, mainProps)))
await tick(2500)

const rows = container.querySelectorAll('.xzr-root:not(.xzr-channel) .xzr-row')
console.log('list rows:', rows.length)
if (rows.length < 10) {
  console.log('list state:', container.querySelector('.xzr-state')?.textContent ?? '(none)')
  console.log('active tab:', container.querySelector('.xzr-tab.is-active')?.textContent)
  throw new Error('expected list rows, got ' + rows.length)
}

// ---- 5. 播客 → 频道(顺带验证:列表不卸载,滚动位置能保住) ---------------------
const listBody = container.querySelector('.xzr-root:not(.xzr-channel) .xzr-body')
listBody.scrollTop = 800
console.log('list scroll before channel:', listBody.scrollTop)
const firstPodcast = rows[0].querySelector('.xzr-title')?.textContent ?? ''
await click(rows[0])
await tick(3000)

const chTitle = container.querySelector('.xzr-ch-title')?.textContent ?? ''
const chRows = Array.from(container.querySelectorAll('.xzr-channel .xzr-row'))
console.log('channel:', JSON.stringify(chTitle), '| episodes:', chRows.length, '| opened:', opened.length, '| sessionCalls:', sessionCalls.length)
if (!chTitle.includes(firstPodcast)) throw new Error(`channel title mismatch: ${chTitle} vs ${firstPodcast}`)
if (chRows.length < 5) {
  console.log('channel state text:', container.querySelector('.xzr-state')?.textContent ?? '(none)')
  console.log('channel html:', container.innerHTML.slice(0, 600))
  throw new Error('channel has no episodes')
}
if (opened.length !== 0) throw new Error('clicking a podcast must not open the browser')
if (sessionCalls.length !== 0) throw new Error('clicking a podcast must not start a session')

// 频道里点第一集 → 新会话 + 预填(带音频直链)
await click(chRows[0])
setTimeout(() => { byId['sum-1'] = {} }, 400)
const chCall = sessionCalls.at(-1)
const chPrompt = chCall?.options?.prompt ?? ''
console.log('channel episode -> sessionCalls:', sessionCalls.length, '| promptLen:', chPrompt.length)
if (!chPrompt.includes('音频直链：')) throw new Error('prompt missing audio url')
console.log('--- channel prompt head ---\n' + chPrompt.split('\n').slice(0, 7).join('\n'))
console.log('library writes:', libraryPosts.length, '|', JSON.stringify(libraryPosts.at(-1)?.title))
if (libraryPosts.length === 0) throw new Error('clicking an episode should record it in the library')
await tick(1400)
const linkedPost = libraryPosts.filter((row) => row.sessionId).at(-1)
console.log('session link write:', JSON.stringify(linkedPost))
if (!linkedPost || linkedPost.sessionId !== 'sum-1') throw new Error('session id was not written back to the library')
const doneChip = container.querySelector('.xzr-done')
console.log('done chip:', doneChip?.textContent ?? '(none)')
if (!doneChip) throw new Error('summarized episode should show the done chip')

// 收藏这个频道
const favBtn = container.querySelector('.xzr-fav')
console.log('fav button:', favBtn?.textContent)
await click(favBtn)
await tick(400)
console.log('fav after click:', container.querySelector('.xzr-fav')?.textContent)
if (!container.querySelector('.xzr-fav')?.textContent?.includes('已收藏')) throw new Error('favorite toggle did not stick')

// 打开频道时列表被藏起来(display:none),但节点还在
const listRootWhileChannel = container.querySelector('.xzr-root:not(.xzr-channel)')
console.log('list hidden while channel:', listRootWhileChannel?.style.display)

// 返回榜单
await click(container.querySelector('.xzr-back'))
await tick(1200)
const backBody = container.querySelector('.xzr-root:not(.xzr-channel) .xzr-body')
console.log('list scroll after back:', backBody?.scrollTop, '| same node:', backBody === listBody)
if (backBody !== listBody) throw new Error('list was unmounted; scroll position would reset')
if (backBody.scrollTop !== 800) throw new Error(`scroll position lost: ${backBody.scrollTop}`)
const backRows = container.querySelectorAll('.xzr-root:not(.xzr-channel) .xzr-row')
console.log('back -> rows:', backRows.length)
if (backRows.length < 10) throw new Error('back did not restore the list')

// ---- 6. 单集 tab -------------------------------------------------------------
const tabs = container.querySelectorAll('.xzr-tab')
await click(tabs[2])
await tick(2500)
const epRows = container.querySelectorAll('.xzr-root:not(.xzr-channel) .xzr-row')
console.log('episode rows:', epRows.length, '|', epRows[0]?.textContent?.replace(/\s+/g, ' ').trim())
if (epRows.length < 10) throw new Error('expected episode rows')

const firstTitle = epRows[0].querySelector('.xzr-title')?.textContent ?? ''
await click(epRows[0])
const call = sessionCalls.at(-1)
const prompt = call?.options?.prompt ?? ''
console.log('top-episode click -> sessionCalls:', sessionCalls.length, '| clearPreviousDraft:', call?.options?.clearPreviousDraft, '| promptLen:', prompt.length)
if (!prompt.includes(firstTitle)) throw new Error('prompt missing episode title')
if (!prompt.includes('xiaoyuzhoufm.com/episode/')) throw new Error('prompt missing episode url')

const ext = container.querySelector('.xzr-ext')
await click(ext)
console.log('ext button -> opened:', opened.at(-1))

// ---- 7. 导出三份预览 ---------------------------------------------------------
const css = container.querySelector('.xzr-root style')?.textContent ?? ''
const TOKENS = ':root{--dsw-alias-bg-base:#fff;--dsw-alias-bg-layer-1:#f4f5f7;--dsw-alias-label-primary:#1b1d21;--dsw-alias-label-secondary:#4d5157;--dsw-alias-label-tertiary:#7b8086;--dsw-alias-label-caption:#9296a0;--dsw-alias-border-l1:#eceef1;--dsw-alias-border-l2:#e2e4e8;--dsw-alias-interactive-bg-hover:#f3f4f6;--dsw-alias-brand-primary:#3b6ef5;--dsw-alias-state-error-primary:#d64545;--dsw-radius-sm:6px;--dsw-radius-md:8px}'
const shell = (body, title) => `<!doctype html>
<html lang="zh"><head><meta charset="utf-8"><title>${title}</title>
<style>
${TOKENS}
body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"SF Pro SC","PingFang SC",sans-serif;background:#fff}
#root{height:900px}
${css}
</style></head><body><div id="root">${body}</div></body></html>`
const bodyOf = () => container.innerHTML.replace(/<style>[\s\S]*?<\/style>/, '')

writeFileSync(new URL('./preview-episodes.html', import.meta.url), shell(bodyOf(), '小宇宙热榜 · 热门单集'))

await click(tabs[0])
await tick(1800)
console.log('after tab0 -> active:', container.querySelector('.xzr-tab.is-active')?.textContent, '| rows:', container.querySelectorAll('.xzr-row').length, '| channel:', !!container.querySelector('.xzr-ch-head'))
writeFileSync(new URL('./preview.html', import.meta.url), shell(bodyOf(), '小宇宙热榜 · 热门播客'))

// 再进一次频道,给频道页留一份预览
await click(container.querySelector('.xzr-row'))
await tick(3000)
writeFileSync(new URL('./preview-channel.html', import.meta.url), shell(bodyOf(), '小宇宙热榜 · 频道分集'))

// 我的总结 tab(频道页没有 tab 栏,先返回)
await click(container.querySelector('.xzr-back'))
await tick(600)
const tabsNow = container.querySelectorAll('.xzr-tab')
await click(tabsNow[3])
await tick(800)
const libRows = container.querySelectorAll('.xzr-root:not(.xzr-channel) .xzr-row')
const libTitle = container.querySelector('.xzr-tab.is-active')?.textContent
console.log('library tab:', libTitle, '| rows:', libRows.length, '| first:', libRows[0]?.querySelector('.xzr-title')?.textContent)
if (libRows.length === 0) throw new Error('library tab should list the summary we just started')
const linkChip = container.querySelector('.xzr-ch-done')
const linkedRow = [...container.querySelectorAll('.xzr-row')].find((row) => row.textContent.includes('已关联会话'))
console.log('library link chip:', linkChip?.textContent ?? '(none)', '| linked row:', linkedRow?.querySelector('.xzr-title')?.textContent)
if (!linkedRow) throw new Error('no linked row found')
await click(linkedRow)
console.log('library row click -> sessions opened:', JSON.stringify(openedSessions), '| external opens:', opened.length)
if (openedSessions.at(-1) !== 'sum-1') throw new Error('clicking a linked row should open its session')
console.log('link chips before relink:', container.querySelectorAll('.xzr-ch-done').length)
const relinkBtn = container.querySelector('.xzr-linkbtn')
if (!relinkBtn) throw new Error('relink button missing')
await click(relinkBtn)
await tick(1200)
console.log('relink note:', container.querySelector('.xzr-note')?.textContent)
const linkedRows = [...container.querySelectorAll('.xzr-root:not(.xzr-channel) .xzr-row')].filter((row) => row.textContent.includes('已关联会话'))
console.log('linked rows after relink:', linkedRows.length)
if (linkedRows.length < 2) throw new Error('relink did not attach the second entry')
writeFileSync(new URL('./preview-library.html', import.meta.url), shell(bodyOf(), '小宇宙热榜 · 我的总结'))

// 我的收藏 tab
const tabsAll = container.querySelectorAll('.xzr-tab')
await click(tabsAll[4])
await tick(600)
const favRows = container.querySelectorAll('.xzr-root:not(.xzr-channel) .xzr-row')
console.log('favorites tab rows:', favRows.length, '| first:', favRows[0]?.querySelector('.xzr-title')?.textContent)
if (favRows.length !== 1) throw new Error('favorites should list the collected channel')
writeFileSync(new URL('./preview-favorites.html', import.meta.url), shell(bodyOf(), '小宇宙热榜 · 我的收藏'))

// 点收藏行 → 回到该频道
await click(favRows[0])
await tick(2500)
console.log('favorite row -> channel:', container.querySelector('.xzr-ch-title')?.textContent)
if (!container.querySelector('.xzr-ch-head')) throw new Error('favorite row should open the channel')

// 搜索 tab:关键词搜(Apple 目录)
await click(container.querySelector('.xzr-back'))
await tick(600)
const tabsFinal = container.querySelectorAll('.xzr-tab')
await click(tabsFinal[5])
await tick(300)
const searchInput = container.querySelector('.xzr-search-hero input')
if (!searchInput) throw new Error('search input missing')
await act(async () => {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  setter.call(searchInput, '搞钱女孩')
  searchInput.dispatchEvent(new window.Event('input', { bubbles: true }))
})
await click(container.querySelector('.xzr-search-hero button'))
await tick(3500)
const searchRows = container.querySelectorAll('.xzr-root:not(.xzr-channel) .xzr-row')
console.log('search rows:', searchRows.length, '| first:', searchRows[0]?.querySelector('.xzr-title')?.textContent)
if (searchRows.length === 0) throw new Error('search returned nothing')
writeFileSync(new URL('./preview-search.html', import.meta.url), shell(bodyOf(), '小宇宙热榜 · 搜索'))

// 点第一条结果 → 用 appleId 打开频道
await click(searchRows[0])
await tick(3000)
console.log('search -> channel:', container.querySelector('.xzr-ch-title')?.textContent, '| episodes:', container.querySelectorAll('.xzr-channel .xzr-row').length)
if (!container.querySelector('.xzr-ch-head')) throw new Error('search result should open a channel')

// 粘贴小宇宙链接 → resolve 出 pid 再打开
await click(container.querySelector('.xzr-back'))
await tick(500)
const input2 = container.querySelector('.xzr-search-hero input')
await act(async () => {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  setter.call(input2, 'https://www.xiaoyuzhoufm.com/episode/6ac6a657e742e36efcbf74af')
  input2.dispatchEvent(new window.Event('input', { bubbles: true }))
})
await click(container.querySelector('.xzr-search-hero button'))
await tick(4000)
console.log('resolve -> channel:', container.querySelector('.xzr-ch-title')?.textContent, '| link:', container.querySelector('.xzr-ch-actions .xzr-refresh') ? 'yes' : 'no')

console.log('preview written: preview.html / preview-episodes.html / preview-channel.html / preview-library.html / preview-favorites.html / preview-search.html')
