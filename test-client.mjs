/**
 * 客户端 bundle 的端到端自测:
 *  1. 用假 window.__ModuleLoader__ 加载 lib/client.js(react 由 require 提供)
 *  2. 断言 apply 注册了 sidebar.panellist + main 两个 slot
 *  3. 在 jsdom 里真正 mount 面板,让 fetch 打到宿主路由函数(真实上游数据)
 *  4. 断言"点单集 → uiWorkspace.startSession(预填总结任务)"、"点外链按钮 → 打开网页"
 *  5. 导出 preview.html / preview-episodes.html
 */
import { createRequire } from 'node:module'
import { readFileSync, writeFileSync } from 'node:fs'
import { JSDOM } from 'jsdom'
import React from 'react'

const require = createRequire(import.meta.url)

// ---- 0. 先建 jsdom:bundle 里的 window 在加载时就被捕获了 ---------------------
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
console.log('bundle id:', loaded.id)
console.log('exports:', Object.keys(mod).sort().join(', '))
console.log('PANEL_ID:', mod.PANEL_ID, '| inject:', JSON.stringify(mod.inject))

// ---- 2. slot registrations + fake uiWorkspace --------------------------------
const sessionCalls = []
const fakeWorkspace = {
  startSession(workspaceId, options) {
    sessionCalls.push({ workspaceId, options })
  },
}
const regs = []
const ctx = {
  logger: { error: console.error },
  inject: (_names, fn) => { fn({ uiWorkspace: fakeWorkspace }) },
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

// 宿主半:注册路由,并把相对 fetch 转给 handler
const { apply: hostApply } = await import('./lib/index.js')
const routes = []
hostApply({ logger: { info() {}, warn: console.warn }, webServer: { register: (r) => routes.push(r) } })
const realFetch = globalThis.fetch

// ---- 3. mount ---------------------------------------------------------------
const opened = []
Object.defineProperty(window, 'open', { value: (url) => { opened.push(url); return null }, writable: true, configurable: true })

globalThis.fetch = async (url, init = {}) => {
  const raw = String(url)
  if (/^https?:\/\//.test(raw)) return realFetch(raw, init)
  const route = routes.find((r) => raw.startsWith(r.path))
  if (!route) return new Response(JSON.stringify({ ok: false, error: 'no route ' + raw }), { status: 404 })
  const body = await new Promise((resolve) => {
    route.handler({ method: init.method ?? 'GET', url: raw }, { writeHead() {}, end(b) { resolve(b) } })
  })
  return new Response(body, { status: 200, headers: { 'content-type': 'application/json' } })
}

const { createRoot } = require('react-dom/client')
const act = React.act
const container = window.document.getElementById('root')
const root = createRoot(container)
await act(async () => root.render(React.createElement(main.comp, mainProps)))
await act(async () => { await new Promise((r) => setTimeout(r, 2500)) })

const rows = container.querySelectorAll('.xzr-row')
console.log('rendered rows:', rows.length)
if (rows.length < 10) throw new Error('expected rows, got ' + rows.length)

// 播客 tab:点击行 → 打开小宇宙(不新开会话)
await act(async () => { rows[0].dispatchEvent(new window.MouseEvent('click', { bubbles: true })) })
console.log('podcast click -> opened:', opened.length, '| sessionCalls:', sessionCalls.length)

// ---- 4. 切到单集 tab,点第一行 → 新会话 + 预填 prompt -------------------------
const tabs = container.querySelectorAll('.xzr-tab')
await act(async () => { tabs[2].dispatchEvent(new window.MouseEvent('click', { bubbles: true })) })
await act(async () => { await new Promise((r) => setTimeout(r, 2500)) })
const epRows = container.querySelectorAll('.xzr-row')
console.log('episode rows:', epRows.length, '|', epRows[0]?.textContent?.replace(/\s+/g, ' ').trim())
if (epRows.length < 10) throw new Error('expected episode rows')

const firstTitle = epRows[0].querySelector('.xzr-title')?.textContent ?? ''
await act(async () => { epRows[0].dispatchEvent(new window.MouseEvent('click', { bubbles: true })) })
console.log('sessionCalls:', sessionCalls.length, '| workspaceId:', sessionCalls[0]?.workspaceId)
const call = sessionCalls[0]
if (!call) throw new Error('clicking an episode did not start a session')
const prompt = call.options?.prompt ?? ''
console.log('options:', JSON.stringify({ clearPreviousDraft: call.options?.clearPreviousDraft, promptLen: prompt.length }))
if (!prompt.includes(firstTitle)) throw new Error('prompt missing episode title')
if (!prompt.includes('xiaoyuzhoufm.com/episode/')) throw new Error('prompt missing episode url')
console.log('--- prompt preview ---\n' + prompt.split('\n').slice(0, 8).join('\n') + '\n…')

// 外链按钮
const ext = container.querySelector('.xzr-ext')
await act(async () => { ext.dispatchEvent(new window.MouseEvent('click', { bubbles: true })) })
console.log('ext button -> opened:', opened.at(-1))

// ---- 5. 导出预览 -------------------------------------------------------------
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

const epBody = container.innerHTML.replace(/<style>[\s\S]*?<\/style>/, '')
writeFileSync(new URL('./preview-episodes.html', import.meta.url), shell(epBody, '小宇宙热榜 · 热门单集'))

await act(async () => { tabs[0].dispatchEvent(new window.MouseEvent('click', { bubbles: true })) })
await act(async () => { await new Promise((r) => setTimeout(r, 2000)) })
const body = container.innerHTML.replace(/<style>[\s\S]*?<\/style>/, '')
writeFileSync(new URL('./preview.html', import.meta.url), shell(body, '小宇宙热榜 · 热门播客'))

console.log('preview written: preview.html / preview-episodes.html')
