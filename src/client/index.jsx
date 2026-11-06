/**
 * 小宇宙热榜 · 客户端半
 *
 * 注册两处:
 *  - sidebar.panellist:左侧图标栏一个可点击的榜单入口(label 由侧栏渲染);
 *  - main(keyed):点开后占据主列的面板,key 必须等于侧栏条目的 id。
 *
 * 单集点击的行为:新开一个 DSH 会话,把"总结这一集"的任务预填进输入框,
 * 用户回车即开跑。宿主没有 uiWorkspace(比如非 Web 组合)时退化成打开小宇宙网页。
 */
import { HotPanel, HotIcon } from './Panel.jsx'
import { buildSummaryPrompt } from './prompt.js'

export const PANEL_ID = 'xyzrank-hot'

/** 侧栏与主面板两套 slot 都由 dsh-client-ui 提供。 */
export const inject = ['slots']

export function apply(ctx) {
  // uiWorkspace 可能晚于 slots 就绪,所以在子 fiber 里等它,别卡住面板注册。
  let workspace
  ctx.inject(['uiWorkspace'], (child) => {
    workspace = child.uiWorkspace
    return () => {
      workspace = undefined
    }
  })

  const openExternal = (url) => {
    if (url) window.open(url, '_blank', 'noopener,noreferrer')
  }

  /**
   * 单集 → 新会话 + 预填总结任务。
   * @param episode 归一化后的单集条目(title/author/genre/url)
   */
  const summarize = (episode) => {
    if (!workspace || typeof workspace.startSession !== 'function') {
      openExternal(episode?.url)
      return
    }
    try {
      workspace.startSession(undefined, {
        prompt: buildSummaryPrompt(episode),
        clearPreviousDraft: true,
      })
    } catch (error) {
      ctx.logger?.error?.('xiaoyuzhou-hot: startSession failed: %o', error)
      openExternal(episode?.url)
    }
  }

  ctx.slots.inject('sidebar.panellist', () =>
    ctx.slots.register(
      {
        name: 'sidebar.panellist',
        id: PANEL_ID,
        order: 16,
        label: '小宇宙热榜',
      },
      HotIcon,
    ),
  )

  ctx.slots.inject('main', () =>
    ctx.slots.register(
      {
        name: 'main',
        key: PANEL_ID,
        inject: () => ({ summarize, openExternal }),
      },
      HotPanel,
    ),
  )
}
