/**
 * 小宇宙热榜面板。
 *
 * 只依赖 react(宿主以 external 提供),样式全部走 DSH 的 --dsw-* 设计令牌,
 * 所以浅色/深色主题自动跟随。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChannelView } from './Channel.jsx'
import { formatClock, formatCount, formatRate, formatWhen } from './format.js'

const TABS = [
  { key: 'podcasts', label: '热门播客' },
  { key: 'new', label: '新锐播客' },
  { key: 'episodes', label: '热门单集' },
  { key: 'library', label: '我的总结' },
]

/** 单集在本地记录里的键:优先用 id,退化成链接 */
function keyOf(episode) {
  return String(episode?.id || episode?.url || episode?.title || '')
}

const PAGE_LIMIT = 100

async function fetchList(kind, signal) {
  const res = await fetch(`/x-hot/list?kind=${encodeURIComponent(kind)}&limit=${PAGE_LIMIT}`, { signal })
  const data = await res.json().catch(() => null)
  if (!res.ok || !data?.ok) throw new Error(data?.error || `HTTP ${res.status}`)
  return data
}

const KIND_KEY = 'xzr.kind'

function initialKind() {
  try {
    const saved = window.localStorage?.getItem(KIND_KEY)
    if (saved && TABS.some((tab) => tab.key === saved)) return saved
  } catch {
    /* 隐私模式等场景下 localStorage 不可用 */
  }
  return 'podcasts'
}

export function HotPanel({ summarize, openExternal, sessionIds, watchNewSession, openSession }) {
  const [kind, setKind] = useState(initialKind)
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [fetchedAt, setFetchedAt] = useState(0)
  const [query, setQuery] = useState('')
  const [channel, setChannel] = useState(null)
  const [library, setLibrary] = useState([])
  const ctrl = useRef(null)
  const channelCtrl = useRef(null)

  const libraryIndex = useMemo(() => new Map(library.map((item) => [item.key, item])), [library])

  useEffect(() => {
    let cancelled = false
    fetch('/x-hot/library')
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data?.ok) setLibrary(data.items ?? [])
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const load = useCallback(async (nextKind) => {
    if (nextKind === 'library') {
      setLoading(false)
      setError('')
      return
    }
    ctrl.current?.abort()
    const controller = new AbortController()
    ctrl.current = controller
    setLoading(true)
    setError('')
    try {
      const data = await fetchList(nextKind, controller.signal)
      if (controller.signal.aborted) return
      setItems(data.items ?? [])
      setTotal(data.total ?? 0)
      setFetchedAt(data.fetchedAt ?? Date.now())
    } catch (err) {
      if (controller.signal.aborted) return
      setError(String(err?.message ?? err))
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(kind)
    try {
      window.localStorage?.setItem(KIND_KEY, kind)
    } catch {
      /* 存不下就算了,不影响本次浏览 */
    }
    return () => ctrl.current?.abort()
  }, [kind, load])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter(
      (it) =>
        it.title?.toLowerCase().includes(q) ||
        it.author?.toLowerCase().includes(q) ||
        it.genre?.toLowerCase().includes(q),
    )
  }, [items, query])

  const closeChannel = useCallback(() => {
    channelCtrl.current?.abort()
    setChannel(null)
    try {
      window.sessionStorage?.removeItem('xzr.channel')
    } catch {
      /* ignore */
    }
  }, [])

  const openChannel = useCallback(async (podcast) => {
    const id = /\/podcast\/([0-9a-f]{24})/i.exec(podcast?.url ?? '')?.[1] ?? ''
    setChannel((cur) => ({
      podcast,
      data: cur && cur.podcast?.url === podcast?.url ? cur.data : null,
      loading: true,
      error: '',
    }))
    channelCtrl.current?.abort()
    const controller = new AbortController()
    channelCtrl.current = controller
    try {
      window.sessionStorage?.setItem('xzr.channel', JSON.stringify(podcast))
    } catch {
      /* ignore */
    }
    try {
      const qs = new URLSearchParams({ limit: '300' })
      if (id) qs.set('id', id)
      if (podcast?.appleId) qs.set('apple', podcast.appleId)
      const res = await fetch(`/x-hot/channel?${qs.toString()}`, { signal: controller.signal })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) throw new Error(data?.error || `HTTP ${res.status}`)
      if (controller.signal.aborted) return
      setChannel((cur) => (cur ? { ...cur, loading: false, data, error: '' } : cur))
    } catch (err) {
      if (controller.signal.aborted) return
      const message = String(err?.message ?? err)
      // 宿主半还没重启时 /x-hot/channel 是 404,给一句能看懂的话
      const hint = /HTTP 404/.test(message)
        ? '宿主路由 /x-hot/channel 还没加载:重启一次 dsh web 后可用'
        : message
      setChannel((cur) => (cur ? { ...cur, loading: false, error: hint } : cur))
    }
  }, [])

  // 从会话切回来时,回到上次看的频道(只在本标签页会话内记忆)
  useEffect(() => {
    try {
      const saved = window.sessionStorage?.getItem('xzr.channel')
      if (saved) openChannel(JSON.parse(saved))
    } catch {
      /* 解析失败就当没存过 */
    }
  }, [openChannel])

  const open = useCallback((url) => {
    if (!url) return
    if (typeof openExternal === 'function') return openExternal(url)
    window.open(url, '_blank', 'noopener,noreferrer')
  }, [openExternal])

  const markSummarized = useCallback((item, podcast) => {
    const key = keyOf(item)
    if (!key) return
    const entry = {
      key,
      title: item?.title ?? '',
      podcast: podcast?.title ?? item?.author ?? '',
      url: item?.url ?? '',
      podcastUrl: podcast?.url ?? '',
      at: Date.now(),
    }
    // 先本地生效,UI 不用等网络
    setLibrary((prev) => [entry, ...prev.filter((row) => row.key !== key)])
    fetch('/x-hot/library', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(entry),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data?.ok && data.item) {
          setLibrary((prev) => [data.item, ...prev.filter((row) => row.key !== data.item.key)])
        }
      })
      .catch(() => {})
    return key
  }, [])

  const linkSession = useCallback((key, sessionId) => {
    setLibrary((prev) => prev.map((row) => (row.key === key ? { ...row, sessionId } : row)))
    fetch('/x-hot/library', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ key, sessionId }),
    }).catch(() => {})
  }, [])

  const removeSummarized = useCallback((key) => {
    setLibrary((prev) => prev.filter((row) => row.key !== key))
    fetch(`/x-hot/library?key=${encodeURIComponent(key)}`, { method: 'DELETE' }).catch(() => {})
  }, [])

  const summarizeEpisode = useCallback((item, podcast) => {
    if (typeof summarize !== 'function') {
      window.open(item.url, '_blank', 'noopener,noreferrer')
      return
    }
    // 先记下"点之前有哪些会话",点完再找新冒出来的那个
    const before = typeof sessionIds === 'function' ? sessionIds() : null
    summarize(item)
    const key = markSummarized(item, podcast)
    if (key && before && typeof watchNewSession === 'function') {
      watchNewSession(before, (sessionId) => linkSession(key, sessionId))
    }
  }, [summarize, markSummarized, linkSession, sessionIds, watchNewSession])

  const isEpisode = kind === 'episodes'

  if (channel) {
    return (
      <>
        <style>{STYLES}</style>
        <ChannelView
          podcast={channel.podcast}
          data={channel.data}
          loading={channel.loading}
          error={channel.error}
          onBack={closeChannel}
          onRetry={() => openChannel(channel.podcast)}
          summarize={summarizeEpisode}
          openExternal={open}
          isDone={(ep) => libraryIndex.has(keyOf(ep))}
        />
      </>
    )
  }

  return (
    <div className="xzr-root">
      <style>{STYLES}</style>

      <header className="xzr-header">
        <div className="xzr-headrow">
          <div className="xzr-brand">
            <h1 className="xzr-h1">小宇宙热榜</h1>
            <span className="xzr-src">数据 · 中文播客榜 xyzrank</span>
          </div>
          <button
            type="button"
            className="xzr-refresh"
            onClick={() => load(kind)}
            disabled={loading}
            title="重新拉取"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 12a9 9 0 1 1-2.64-6.36" />
              <path d="M21 3v6h-6" />
            </svg>
            <span>{loading ? '刷新中' : '刷新'}</span>
          </button>
        </div>

        <div className="xzr-toolrow">
          <nav className="xzr-tabs" role="tablist" aria-label="榜单类型">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={kind === tab.key}
                className={`xzr-tab${kind === tab.key ? ' is-active' : ''}`}
                onClick={() => setKind(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          <div className="xzr-search">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={kind === 'library' ? '搜我总结过的单集' : isEpisode ? '搜单集 / 播客' : '搜播客 / 作者 / 分类'}
              aria-label="筛选榜单"
            />
            {query ? (
              <button type="button" className="xzr-clear" onClick={() => setQuery('')} aria-label="清空筛选">
                ×
              </button>
            ) : null}
          </div>
        </div>
      </header>

      <div className="xzr-body">
        {kind === 'library' ? (
          <LibraryList
            items={library}
            query={query}
            openExternal={open}
            onRemove={removeSummarized}
            openSession={openSession}
          />
        ) : null}

        {kind !== 'library' && loading && items.length === 0 ? <Skeleton /> : null}

        {kind !== 'library' && !loading && error ? (
          <div className="xzr-state xzr-error" role="alert">
            <strong>没拉到榜单</strong>
            <p>{error}</p>
            <button type="button" onClick={() => load(kind)}>重试</button>
          </div>
        ) : null}

        {kind !== 'library' && !loading && !error && filtered.length === 0 ? (
          <div className="xzr-state">
            <strong>{query ? '没有匹配的条目' : '榜单是空的'}</strong>
            <p>{query ? '换个关键词试试' : '上游暂时没有返回数据'}</p>
          </div>
        ) : null}

        {kind !== 'library' && filtered.length > 0 ? (
          <ol className="xzr-list">
            {filtered.map((item) => (
              <li key={`${item.rank}-${item.title}`} className="xzr-item">
                <button
                  type="button"
                  className="xzr-row"
                  onClick={() => (isEpisode ? summarizeEpisode(item) : openChannel(item))}
                  aria-label={isEpisode ? `新开 DSH 会话总结:${item.title}` : `看 ${item.title} 的分集列表`}
                >
                  <span className={`xzr-rank${item.rank <= 3 ? ` is-top is-${item.rank}` : ''}`}>{item.rank}</span>
                  {item.logo ? <img className="xzr-logo" src={item.logo} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <span className="xzr-logo xzr-logo-empty" />}
                  <span className="xzr-main">
                    <span className="xzr-title" title={item.title}>{item.title}</span>
                    <span className="xzr-sub">
                      {libraryIndex.has(keyOf(item)) ? <span className="xzr-done">✓ 已总结</span> : null}
                      {item.author || '—'}
                      {item.genre ? <em>· {item.genre}</em> : null}
                      {isEpisode ? null : <em>· {item.episodes} 集</em>}
                    </span>
                  </span>
                  <span className="xzr-stats">
                    <span className="xzr-stat">
                      <b>{formatCount(item.avgPlay)}</b>
                      <i>{isEpisode ? '播放' : '均播放'}</i>
                    </span>
                    <span className="xzr-stat">
                      <b>{formatRate(item.openRate)}</b>
                      <i>打开率</i>
                    </span>
                  </span>
                </button>
                {isEpisode ? (
                  <button
                    type="button"
                    className="xzr-ext"
                    onClick={() => open(item.url)}
                    aria-label="在小宇宙打开这一集"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M14 4h6v6" />
                      <path d="M20 4 10 14" />
                      <path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" />
                    </svg>
                  </button>
                ) : null}
              </li>
            ))}
          </ol>
        ) : null}
      </div>

      <footer className="xzr-foot">
        <span>
          {kind === 'library'
            ? `${library.length} 条记录 · 存在本机`
            : query
              ? `${filtered.length} / ${items.length} 条`
              : `前 ${items.length} 名`}
          {kind !== 'library' && total > items.length ? ` · 共 ${total} 档上榜` : ''}
          {kind !== 'library' && isEpisode ? ' · 点单集新开会话总结' : ''}
        </span>
        <span>{fetchedAt ? `更新于 ${formatClock(fetchedAt)}` : '—'}</span>
      </footer>
    </div>
  )
}

function LibraryList({ items, query, openExternal, onRemove, openSession }) {
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter(
      (it) => it.title?.toLowerCase().includes(q) || it.podcast?.toLowerCase().includes(q),
    )
  }, [items, query])

  if (items.length === 0) {
    return (
      <div className="xzr-state">
        <strong>还没有总结记录</strong>
        <p>在榜单或频道里点任意一集,这里就会记下来</p>
      </div>
    )
  }

  if (filtered.length === 0) {
    return (
      <div className="xzr-state">
        <strong>没有匹配的记录</strong>
        <p>换个关键词试试</p>
      </div>
    )
  }

  return (
    <ol className="xzr-list">
      {filtered.map((item) => (
        <li key={item.key} className="xzr-item">
          <button
            type="button"
            className="xzr-row"
            onClick={() => {
              // 有会话就跳回那次总结;没有(或跳失败)再退回小宇宙原页
              if (item.sessionId && typeof openSession === 'function' && openSession(item.sessionId)) return
              openExternal(item.url)
            }}
            aria-label={item.sessionId ? `打开那次总结会话:${item.title}` : `在小宇宙打开:${item.title}`}
          >
            <span className="xzr-rank xzr-rank-done">✓</span>
            <span className="xzr-main">
              <span className="xzr-title" title={item.title}>{item.title}</span>
              <span className="xzr-sub">
                {item.podcast || '—'}
                <em>· {formatWhen(item.at)}</em>
                {item.sessionId ? <em className="xzr-ch-done">· 已关联会话</em> : null}
              </span>
            </span>
            <span className="xzr-stats">
              <span className="xzr-stat">
                <b>{item.sessionId ? '打开会话' : '小宇宙'}</b>
                <i>{item.sessionId ? '接着聊' : '无会话记录'}</i>
              </span>
            </span>
          </button>
          {item.sessionId ? (
            <button
              type="button"
              className="xzr-ext xzr-ext-left"
              onClick={() => openExternal(item.url)}
              aria-label="在小宇宙打开这一集"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M14 4h6v6" />
                <path d="M20 4 10 14" />
                <path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" />
              </svg>
            </button>
          ) : null}
          <button
            type="button"
            className="xzr-ext xzr-ext-always"
            onClick={() => onRemove(item.key)}
            aria-label={`取消标记:${item.title}`}
          >
            ×
          </button>
        </li>
      ))}
    </ol>
  )
}

function Skeleton() {
  return (
    <div className="xzr-skel" aria-hidden="true">
      {Array.from({ length: 8 }).map((_, i) => (
        <div className="xzr-skel-row" key={i}>
          <span className="xzr-skel-rank" />
          <span className="xzr-skel-logo" />
          <span className="xzr-skel-lines">
            <span style={{ width: `${58 + ((i * 7) % 28)}%` }} />
            <span style={{ width: `${30 + ((i * 5) % 22)}%` }} />
          </span>
        </div>
      ))}
    </div>
  )
}

export function HotIcon({ size = 18, active = false }) {
  return (
    <span style={{ color: active ? 'var(--dsw-alias-brand-primary)' : 'inherit', display: 'inline-flex', alignItems: 'center' }}>
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 19V9" />
        <path d="M10 19V5" />
        <path d="M16 19v-7" />
        <path d="M21 19H3" />
      </svg>
    </span>
  )
}

const STYLES = `
.xzr-root{display:flex;flex-direction:column;height:100%;min-height:0;background:var(--dsw-alias-bg-base);
  color:var(--dsw-alias-label-primary);font-size:13px;line-height:1.5}
.xzr-ch-head{flex:none;display:flex;align-items:center;gap:10px;
  padding:12px max(24px,calc((100% - 1040px)/2)) 11px;border-bottom:1px solid var(--dsw-alias-border-l1)}
.xzr-back{display:inline-flex;align-items:center;gap:3px;height:28px;padding:0 8px 0 4px;border:0;
  border-radius:var(--dsw-radius-sm);background:transparent;color:var(--dsw-alias-label-secondary);
  font-size:12px;cursor:pointer;flex:none;transition:background .15s,color .15s}
.xzr-back:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.xzr-ch-id{display:flex;align-items:center;gap:10px;min-width:0;flex:1}
.xzr-ch-logo{flex:none;width:40px;height:40px;border-radius:8px;object-fit:cover;background:var(--dsw-alias-bg-layer-1)}
.xzr-ch-meta{min-width:0}
.xzr-ch-title{margin:0;font-size:15px;font-weight:600;color:var(--dsw-alias-label-primary);
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.xzr-ch-sub{margin:2px 0 0;font-size:11.5px;color:var(--dsw-alias-label-tertiary);
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.xzr-ch-sub em{font-style:normal;margin-left:4px;color:var(--dsw-alias-label-caption)}
.xzr-ch-done{color:var(--dsw-alias-state-business-primary)!important}
.xzr-ch-actions{display:flex;align-items:center;gap:8px;flex:none}
.xzr-ch-search{min-width:170px}
.xzr-stat-cta b{color:var(--dsw-alias-brand-primary);font-size:12px}
.xzr-done{display:inline-block;margin-right:6px;padding:0 5px;border-radius:4px;font-size:10.5px;
  color:var(--dsw-alias-state-business-primary);background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 12%,transparent)}
.xzr-rank-done{color:var(--dsw-alias-state-business-primary);font-weight:700}
.xzr-ext.xzr-ext-always{opacity:.55}
.xzr-ext.xzr-ext-left{right:34px}
.xzr-stat-cta{opacity:0;transition:opacity .15s}
.xzr-item:hover .xzr-stat-cta,.xzr-row:focus-visible .xzr-stat-cta{opacity:1}
.xzr-state-actions{display:flex;gap:8px;justify-content:center}
@media (max-width:860px){.xzr-ch-actions .xzr-ch-search{display:none}.xzr-ch-sub em:nth-of-type(2){display:none}}
.xzr-header{flex:none;padding:18px max(24px,calc((100% - 1040px)/2)) 10px;border-bottom:1px solid var(--dsw-alias-border-l1)}
.xzr-headrow{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}
.xzr-brand{display:flex;flex-direction:column;gap:2px;min-width:0}
.xzr-h1{margin:0;font-size:17px;font-weight:600;letter-spacing:.01em;color:var(--dsw-alias-label-primary)}
.xzr-src{font-size:11px;color:var(--dsw-alias-label-caption)}
.xzr-refresh{display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 10px;border-radius:var(--dsw-radius-sm);
  border:1px solid var(--dsw-alias-border-l2);background:transparent;color:var(--dsw-alias-label-secondary);
  font-size:12px;cursor:pointer;transition:background .15s,color .15s}
.xzr-refresh:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.xzr-refresh:disabled{opacity:.6;cursor:default}
.xzr-toolrow{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-top:14px;flex-wrap:wrap}
.xzr-tabs{display:inline-flex;gap:2px;padding:2px;border-radius:var(--dsw-radius-md);background:var(--dsw-alias-bg-layer-1)}
.xzr-tab{border:0;background:transparent;color:var(--dsw-alias-label-tertiary);font-size:12.5px;
  padding:5px 12px;border-radius:calc(var(--dsw-radius-md) - 2px);cursor:pointer;transition:all .15s}
.xzr-tab:hover{color:var(--dsw-alias-label-primary)}
.xzr-tab.is-active{background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);box-shadow:0 1px 2px rgba(0,0,0,.06)}
.xzr-search{display:flex;align-items:center;gap:6px;height:28px;padding:0 8px;min-width:200px;
  border:1px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-sm);color:var(--dsw-alias-label-caption)}
.xzr-search:focus-within{border-color:var(--dsw-alias-brand-primary)}
.xzr-search input{flex:1;min-width:0;border:0;outline:0;background:transparent;color:var(--dsw-alias-label-primary);font-size:12.5px}
.xzr-search input::placeholder{color:var(--dsw-alias-label-caption)}
.xzr-clear{border:0;background:transparent;color:var(--dsw-alias-label-tertiary);font-size:15px;line-height:1;cursor:pointer;padding:0 2px}
.xzr-body{flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;padding:6px max(12px,calc((100% - 1040px)/2 + 4px)) 8px}
.xzr-list{list-style:none;margin:0;padding:0}
.xzr-item{position:relative}
.xzr-ext{position:absolute;right:6px;top:50%;transform:translateY(-50%);width:26px;height:26px;
  display:inline-flex;align-items:center;justify-content:center;border:0;border-radius:var(--dsw-radius-sm);
  background:transparent;color:var(--dsw-alias-label-caption);cursor:pointer;opacity:0;
  transition:opacity .15s,background .15s,color .15s}
.xzr-item:hover .xzr-ext,.xzr-ext:focus-visible{opacity:1}
.xzr-ext:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.xzr-row{display:flex;align-items:center;gap:12px;width:100%;padding:9px 40px 9px 10px;border:0;background:transparent;
  color:inherit;text-align:left;cursor:pointer;border-radius:var(--dsw-radius-md);transition:background .12s}
.xzr-row:hover{background:var(--dsw-alias-interactive-bg-hover)}
.xzr-rank{flex:none;width:22px;text-align:center;font-size:12px;font-variant-numeric:tabular-nums;
  color:var(--dsw-alias-label-caption)}
.xzr-rank.is-top{font-weight:700;font-size:12.5px}
.xzr-rank.is-1{color:#d9a441}.xzr-rank.is-2{color:#9aa4b2}.xzr-rank.is-3{color:#b8835a}
.xzr-logo{flex:none;width:40px;height:40px;border-radius:8px;object-fit:cover;background:var(--dsw-alias-bg-layer-1)}
.xzr-logo-empty{display:inline-block}
.xzr-main{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.xzr-title{font-size:13px;font-weight:500;color:var(--dsw-alias-label-primary);
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.xzr-sub{font-size:11.5px;color:var(--dsw-alias-label-tertiary);
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.xzr-sub em{font-style:normal;margin-left:4px;color:var(--dsw-alias-label-caption)}
.xzr-stats{flex:none;display:flex;gap:18px;padding-left:8px}
.xzr-stat{display:flex;flex-direction:column;align-items:flex-end;min-width:52px}
.xzr-stat b{font-size:12.5px;font-weight:600;font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-secondary)}
.xzr-stat i{font-style:normal;font-size:10.5px;color:var(--dsw-alias-label-caption)}
.xzr-state{padding:56px 24px;text-align:center;color:var(--dsw-alias-label-tertiary)}
.xzr-state strong{display:block;font-size:13.5px;color:var(--dsw-alias-label-secondary);margin-bottom:6px}
.xzr-state p{margin:0 0 12px;font-size:12px;color:var(--dsw-alias-label-caption)}
.xzr-state button{border:1px solid var(--dsw-alias-border-l2);background:transparent;color:var(--dsw-alias-label-secondary);
  padding:5px 14px;border-radius:var(--dsw-radius-sm);font-size:12px;cursor:pointer}
.xzr-error strong{color:var(--dsw-alias-state-error-primary)}
.xzr-skel{padding:6px 10px}
.xzr-skel-row{display:flex;align-items:center;gap:12px;padding:9px 0}
.xzr-skel-rank,.xzr-skel-logo,.xzr-skel-lines span{display:block;background:var(--dsw-alias-bg-layer-1);border-radius:6px;
  animation:xzr-pulse 1.4s ease-in-out infinite}
.xzr-skel-rank{width:22px;height:12px}
.xzr-skel-logo{width:40px;height:40px;border-radius:8px}
.xzr-skel-lines{flex:1;display:flex;flex-direction:column;gap:7px}
.xzr-skel-lines span{height:11px}
@keyframes xzr-pulse{0%,100%{opacity:.55}50%{opacity:.95}}
.xzr-foot{flex:none;display:flex;align-items:center;justify-content:space-between;padding:7px max(24px,calc((100% - 1040px)/2));
  border-top:1px solid var(--dsw-alias-border-l1);font-size:11px;color:var(--dsw-alias-label-caption)}
@media (max-width:720px){.xzr-header{padding:14px 14px 8px}.xzr-stats{display:none}.xzr-foot{padding:7px 14px}}
`
