/**
 * 小宇宙热榜面板。
 *
 * 只依赖 react(宿主以 external 提供),样式全部走 DSH 的 --dsw-* 设计令牌,
 * 所以浅色/深色主题自动跟随。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

const TABS = [
  { key: 'podcasts', label: '热门播客' },
  { key: 'new', label: '新锐播客' },
  { key: 'episodes', label: '热门单集' },
]

const PAGE_LIMIT = 100

/** 1.9 亿 → 1.9亿;68234 → 6.8万 */
function formatCount(n) {
  if (!Number.isFinite(n) || n <= 0) return '—'
  if (n >= 100000000) return `${(n / 100000000).toFixed(1).replace(/\.0$/, '')}亿`
  if (n >= 10000) return `${(n / 10000).toFixed(1).replace(/\.0$/, '')}万`
  return String(Math.round(n))
}

function formatRate(rate) {
  // 上游偶发 >100% 的脏数据(统计口径不同),宁可不显示也不误导
  if (!Number.isFinite(rate) || rate <= 0 || rate > 1) return '—'
  return `${(rate * 100).toFixed(1)}%`
}

function formatTime(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return ''
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

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

export function HotPanel({ summarize, openExternal }) {
  const [kind, setKind] = useState(initialKind)
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [fetchedAt, setFetchedAt] = useState(0)
  const [query, setQuery] = useState('')
  const ctrl = useRef(null)

  const load = useCallback(async (nextKind) => {
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

  const open = useCallback((url) => {
    if (!url) return
    if (typeof openExternal === 'function') return openExternal(url)
    window.open(url, '_blank', 'noopener,noreferrer')
  }, [openExternal])

  const summarizeEpisode = useCallback((item) => {
    if (typeof summarize !== 'function') {
      window.open(item.url, '_blank', 'noopener,noreferrer')
      return
    }
    summarize(item)
  }, [summarize])

  const isEpisode = kind === 'episodes'

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
              placeholder={isEpisode ? '搜单集 / 播客' : '搜播客 / 作者 / 分类'}
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
        {loading && items.length === 0 ? <Skeleton /> : null}

        {!loading && error ? (
          <div className="xzr-state xzr-error" role="alert">
            <strong>没拉到榜单</strong>
            <p>{error}</p>
            <button type="button" onClick={() => load(kind)}>重试</button>
          </div>
        ) : null}

        {!loading && !error && filtered.length === 0 ? (
          <div className="xzr-state">
            <strong>{query ? '没有匹配的条目' : '榜单是空的'}</strong>
            <p>{query ? '换个关键词试试' : '上游暂时没有返回数据'}</p>
          </div>
        ) : null}

        {filtered.length > 0 ? (
          <ol className="xzr-list">
            {filtered.map((item) => (
              <li key={`${item.rank}-${item.title}`} className="xzr-item">
                <button
                  type="button"
                  className="xzr-row"
                  onClick={() => (isEpisode ? summarizeEpisode(item) : open(item.url))}
                  title={isEpisode ? `新开 DSH 会话总结：${item.title}` : item.url || '暂无链接'}
                >
                  <span className={`xzr-rank${item.rank <= 3 ? ` is-top is-${item.rank}` : ''}`}>{item.rank}</span>
                  {item.logo ? <img className="xzr-logo" src={item.logo} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <span className="xzr-logo xzr-logo-empty" />}
                  <span className="xzr-main">
                    <span className="xzr-title">{item.title}</span>
                    <span className="xzr-sub">
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
                    title="在小宇宙打开这一集"
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
          {query ? `${filtered.length} / ${items.length} 条` : `前 ${items.length} 名`}
          {total > items.length ? ` · 共 ${total} 档上榜` : ''}
          {isEpisode ? ' · 点单集新开会话总结' : ''}
        </span>
        <span>{fetchedAt ? `更新于 ${formatTime(fetchedAt)}` : '—'}</span>
      </footer>
    </div>
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
