/**
 * 小宇宙热榜 · 客户端半
 *
 * 注册两处:
 *  - sidebar.panellist:左侧图标栏一个可点击的榜单入口(label 由侧栏渲染);
 *  - main(keyed):点开后占据主列的面板,key 必须等于侧栏条目的 id。
 *
 * 单集点击:新开一个 DSH 会话,把"总结这一集"的任务预填进输入框,用户回车即开跑。
 * 同时盯一下"是不是刚冒出来一个新会话",拿到 id 后回写到已读记录里,
 * 这样「我的总结」里的条目可以直接跳回那次会话。
 */
import { HotPanel, HotIcon } from './Panel.jsx'
import { buildSummaryPrompt } from './prompt.js'

export const PANEL_ID = 'xyzrank-hot'

/** 侧栏与主面板两套 slot 都由 dsh-client-ui 提供。 */
export const inject = ['slots']

const SESSION_WATCH_MS = 6000

export function apply(ctx) {
  // 这两个服务可能晚于 slots 就绪,所以在子 fiber 里等,别卡住面板注册。
  let workspace
  let sessions
  ctx.inject(['uiWorkspace'], (child) => {
    workspace = child.uiWorkspace
    return () => {
      workspace = undefined
    }
  })
  ctx.inject(['sessions'], (child) => {
    sessions = child.sessions
    return () => {
      sessions = undefined
    }
  })

  const openExternal = (url) => {
    if (url) window.open(url, '_blank', 'noopener,noreferrer')
  }

  /** 当前已知的会话 id 集合;拿不到就返回 null,调用方跳过关联。 */
  const sessionIds = () => {
    const snapshot = sessions?.list?.getSnapshot?.()
    if (!snapshot || snapshot.phase !== 'ready' || !snapshot.byId) return null
    return new Set(Object.keys(snapshot.byId))
  }

  /**
   * 盯住"新建的那个会话"。
   * startSession 不返回 id,所以用前后快照差:只在恰好多出一个会话时认定;
   * 多出多个(并发操作)就放弃关联 —— 宁可没有链接,也不要链错。
   */
  const watchNewSession = (before, onFound) => {
    if (!(before instanceof Set)) return () => {}
    const startedAt = Date.now()
    const timer = setInterval(() => {
      const snapshot = sessions?.list?.getSnapshot?.()
      if (snapshot?.phase === 'ready' && snapshot.byId) {
        const fresh = Object.keys(snapshot.byId).filter((id) => !before.has(id))
        if (fresh.length === 1) {
          clearInterval(timer)
          onFound(fresh[0])
          return
        }
        if (fresh.length > 1) {
          clearInterval(timer)
          return
        }
      }
      if (Date.now() - startedAt > SESSION_WATCH_MS) clearInterval(timer)
    }, 250)
    return () => clearInterval(timer)
  }

  const openSession = (sessionId) => {
    if (!sessionId || !workspace || typeof workspace.openSession !== 'function') return false
    try {
      workspace.openSession(sessionId)
      return true
    } catch (error) {
      ctx.logger?.error?.('xiaoyuzhou-hot: openSession failed: %o', error)
      return false
    }
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
        inject: () => ({ summarize, openExternal, sessionIds, watchNewSession, openSession }),
      },
      HotPanel,
    ),
  )
}
