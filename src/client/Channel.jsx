/** 单个播客频道的分集列表:点一行就开始总结,↗ 去小宇宙看原页。 */
import { useMemo, useState } from 'react'
import { formatDay, formatDuration } from './format.js'
import { RemoteImage } from './RemoteImage.jsx'

export function ChannelView({ podcast, data, loading, error, onBack, onRetry, summarize, openExternal, isDone, isFavorite, onToggleFavorite }) {
  const [query, setQuery] = useState('')
  const episodes = data?.episodes ?? []

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return episodes
    return episodes.filter((ep) => ep.title?.toLowerCase().includes(q))
  }, [episodes, query])

  const limited = data?.source === 'ssr'
  const doneCount = typeof isDone === 'function' ? episodes.filter((ep) => isDone(ep)).length : 0

  return (
    <div className="xzr-root xzr-channel">
      <header className="xzr-ch-head">
        <button type="button" className="xzr-back" onClick={onBack} title="返回榜单" aria-label="返回榜单">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          <span>榜单</span>
        </button>

        <div className="xzr-ch-id">
          {podcast?.logo ? <RemoteImage className="xzr-ch-logo" src={podcast.logo} /> : null}
          <div className="xzr-ch-meta">
            <h2 className="xzr-ch-title">{podcast?.title ?? data?.title ?? ''}</h2>
            <p className="xzr-ch-sub">
              {podcast?.author ? <span>{podcast.author}</span> : null}
              {podcast?.genre ? <em>· {podcast.genre}</em> : null}
              {data?.episodes?.length ? <em>· {episodes.length} 集{limited ? '(最新)' : ''}</em> : null}
              {doneCount > 0 ? <em className="xzr-ch-done">· 已总结 {doneCount}</em> : null}
            </p>
          </div>
        </div>

        <div className="xzr-ch-actions">
          <div className="xzr-search xzr-ch-search">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜这一频道的单集" aria-label="搜这一频道的单集" />
            {query ? (
              <button type="button" className="xzr-clear" onClick={() => setQuery('')} aria-label="清空筛选">×</button>
            ) : null}
          </div>
          {podcast?.url ? (
            <button
              type="button"
              className={`xzr-fav${isFavorite ? ' is-on' : ''}`}
              onClick={() => onToggleFavorite?.(podcast)}
              aria-label={isFavorite ? '取消收藏' : '收藏这个播客'}
            >
              {isFavorite ? '★ 已收藏' : '☆ 收藏'}
            </button>
          ) : null}
          {podcast?.url ? (
            <button type="button" className="xzr-refresh" onClick={() => openExternal(podcast.url)} aria-label="在小宇宙打开这个播客">
              小宇宙 ↗
            </button>
          ) : null}
        </div>
      </header>

      <div className="xzr-body">
        {loading ? <ChannelSkeleton /> : null}

        {!loading && error ? (
          <div className="xzr-state xzr-error" role="alert">
            <strong>分集列表没拉到</strong>
            <p>{error}</p>
            <div className="xzr-state-actions">
              <button type="button" onClick={onRetry}>重试</button>
              {podcast?.url ? <button type="button" onClick={() => openExternal(podcast.url)}>在小宇宙看</button> : null}
            </div>
          </div>
        ) : null}

        {!loading && !error && filtered.length === 0 ? (
          <div className="xzr-state">
            <strong>{query ? '没有匹配的单集' : '这个频道没有分集'}</strong>
            <p>{query ? '换个关键词试试' : 'RSS 里没有解析到条目'}</p>
          </div>
        ) : null}

        {filtered.length > 0 ? (
          <ol className="xzr-list">
            {filtered.map((ep, index) => (
              <li key={ep.id || `${index}-${ep.title}`} className="xzr-item">
                <button
                  type="button"
                  className="xzr-row"
                  onClick={() => summarize({ ...ep, author: podcast?.title ?? data?.title ?? '' }, podcast)}
                  aria-label={`新开 DSH 会话总结:${ep.title}`}
                >
                  <span className="xzr-rank">{index + 1}</span>
                  <span className="xzr-main">
                    <span className="xzr-title" title={ep.title}>{ep.title}</span>
                    <span className="xzr-sub">
                      {typeof isDone === 'function' && isDone(ep) ? <span className="xzr-done">✓ 已总结</span> : null}
                      {formatDay(ep.pubDate) || '—'}
                      {ep.duration ? <em>· {formatDuration(ep.duration)}</em> : null}
                    </span>
                  </span>
                  <span className="xzr-stats">
                    <span className="xzr-stat xzr-stat-cta">
                      <b>总结</b>
                      <i>回车即开跑</i>
                    </span>
                  </span>
                </button>
                {ep.url ? (
                  <button
                    type="button"
                    className="xzr-ext"
                    onClick={() => openExternal(ep.url)}
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
          {query ? `${filtered.length} / ${episodes.length} 集` : `${episodes.length} 集`}
          {limited ? ' · 只有最新一批,完整历史去小宇宙' : ''}
        </span>
        <span>点单集 → 新开会话总结</span>
      </footer>
    </div>
  )
}

function ChannelSkeleton() {
  return (
    <div className="xzr-skel" aria-hidden="true">
      {Array.from({ length: 8 }).map((_, i) => (
        <div className="xzr-skel-row" key={i}>
          <span className="xzr-skel-rank" />
          <span className="xzr-skel-lines">
            <span style={{ width: `${54 + ((i * 9) % 30)}%` }} />
            <span style={{ width: `${26 + ((i * 7) % 18)}%` }} />
          </span>
        </div>
      ))}
    </div>
  )
}
