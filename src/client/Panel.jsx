/**
 * 小宇宙热榜面板。
 *
 * 只依赖 react(宿主以 external 提供),样式全部走 DSH 的 --dsw-* 设计令牌,
 * 所以浅色/深色主题自动跟随。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChannelView } from './Channel.jsx'
import { formatClock, formatCount, formatRate, formatWhen } from './format.js'
import { createLibraryIndex, keyOf } from './library-index.js'

const TABS = [
  { key: 'podcasts', label: '热门播客' },
  { key: 'new', label: '新锐播客' },
  { key: 'episodes', label: '热门单集' },
  { key: 'library', label: '我的总结' },
  { key: 'favorites', label: '我的收藏' },
  { key: 'search', label: '搜索' },
]

/** 播客 id(小宇宙 24 位 hex),取不到就返回空串 */
function pidOf(podcast) {
  return /\/podcast\/([0-9a-f]{24})/i.exec(podcast?.url ?? '')?.[1] ?? ''
}

/** 播客在收藏里的键:优先 pid,只有 Apple 信息时用 apple:<id> */
function favoriteKey(podcast) {
  return pidOf(podcast) || (podcast?.appleId ? `apple:${podcast.appleId}` : '')
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
  const [favorites, setFavorites] = useState([])
  const [searchQ, setSearchQ] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searchTouched, setSearchTouched] = useState(false)
  const [relinking, setRelinking] = useState(false)
  const [relinkNote, setRelinkNote] = useState('')
  const [rebuildingFavs, setRebuildingFavs] = useState(false)
  const [favNote, setFavNote] = useState('')
  const ctrl = useRef(null)
  const channelCtrl = useRef(null)

  // id 一样算已总结;标题一样也算(小宇宙 eid 和 RSS guid 不是一套 id)
  const libraryIndex = useMemo(() => createLibraryIndex(library), [library])
  const favoriteIndex = useMemo(() => new Set(favorites.map((item) => item.key)), [favorites])

  useEffect(() => {
    let cancelled = false
    fetch('/x-hot/favorites')
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data?.ok) setFavorites(data.items ?? [])
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

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
    if (nextKind === 'library' || nextKind === 'favorites' || nextKind === 'search') {
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

  const runSearch = useCallback(async (raw) => {
    const text = String(raw ?? '').trim()
    if (!text) return
    const isLink = /xiaoyuzhoufm\.com\/(podcast|episode)\//i.test(text) || /^[0-9a-f]{24}$/i.test(text)
    setSearching(true)
    setSearchError('')
    setSearchResults([])
    setSearchTouched(true)
    try {
      if (isLink) {
        const res = await fetch(`/x-hot/resolve?url=${encodeURIComponent(text)}`)
        const data = await res.json().catch(() => null)
        if (!res.ok || !data?.ok) throw new Error(data?.error || `HTTP ${res.status}`)
        setSearching(false)
        openChannel({ ...data.podcast, appleId: '' })
        return
      }
      const res = await fetch(`/x-hot/search?q=${encodeURIComponent(text)}&limit=20`)
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) throw new Error(data?.error || `HTTP ${res.status}`)
      setSearchResults(data.items ?? [])
    } catch (error) {
      setSearchError(String(error?.message ?? error))
    } finally {
      setSearching(false)
    }
  }, [openChannel])

  const open = useCallback((url) => {
    if (!url) return
    if (typeof openExternal === 'function') return openExternal(url)
    window.open(url, '_blank', 'noopener,noreferrer')
  }, [openExternal])

  const markSummarized = useCallback((item, podcast) => {
    // 同一集可能换了来源(id 不同):先按标题找已有记录,别重复建行
    const known = libraryIndex.find(item)
    const key = known?.key || keyOf(item)
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
  }, [libraryIndex])

  const linkSession = useCallback((key, sessionId) => {
    setLibrary((prev) => prev.map((row) => (row.key === key ? { ...row, sessionId } : row)))
    fetch('/x-hot/library', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ key, sessionId }),
    }).catch(() => {})
  }, [])

  const toggleFavorite = useCallback((podcast) => {
    const pid = favoriteKey(podcast)
    if (!pid) return
    if (favorites.some((item) => item.key === pid)) {
      setFavorites((prev) => prev.filter((item) => item.key !== pid))
      fetch(`/x-hot/favorites?id=${encodeURIComponent(pid)}`, { method: 'DELETE' }).catch(() => {})
      return
    }
    const entry = {
      key: pid,
      title: podcast?.title ?? '',
      author: podcast?.author ?? '',
      genre: podcast?.genre ?? '',
      url: podcast?.url ?? '',
      appleId: podcast?.appleId ?? '',
      logo: podcast?.logo ?? '',
      at: Date.now(),
    }
    setFavorites((prev) => [entry, ...prev.filter((item) => item.key !== pid)])
    fetch('/x-hot/favorites', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(entry),
    }).catch(() => {})
  }, [favorites])

  const relinkSessions = useCallback(async () => {
    setRelinking(true)
    setRelinkNote('')
    try {
      const res = await fetch('/x-hot/library/relink', { method: 'POST' })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) throw new Error(data?.error || `HTTP ${res.status}`)
      setLibrary(data.items ?? [])
      setRelinkNote(data.matched === 0 ? '没有可对的会话' : `匹配 ${data.matched} · 新关联 ${data.linked}`)
    } catch (error) {
      setRelinkNote(String(error?.message ?? error))
    } finally {
      setRelinking(false)
    }
  }, [])

  const rebuildFavorites = useCallback(async () => {
    setRebuildingFavs(true)
    setFavNote('')
    try {
      const res = await fetch('/x-hot/favorites/rebuild', { method: 'POST' })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) throw new Error(data?.error || `HTTP ${res.status}`)
      setFavorites(data.items ?? [])
      setFavNote(data.added === 0 ? '没有新的可补(都收过了)' : `新增 ${data.added} 个`)
    } catch (error) {
      setFavNote(String(error?.message ?? error))
    } finally {
      setRebuildingFavs(false)
    }
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

  // 列表(channel 打开时用 display:none 藏着)不卸载,这样返回时滚动位置还在
  return (
    <>
      <style>{STYLES}</style>
      <div className="xzr-root" style={channel ? { display: 'none' } : undefined}>

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
        {kind === 'search' ? (
          <div className="xzr-search-view">
            <div className="xzr-search-hero">
              <input
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') runSearch(searchQ)
                }}
                placeholder="搜播客名,或粘贴小宇宙链接 / 24 位 id"
                aria-label="搜播客或粘贴小宇宙链接"
              />
              <button type="button" onClick={() => runSearch(searchQ)} disabled={searching}>
                {searching ? '搜索中…' : '搜索'}
              </button>
            </div>

            {searching ? <Skeleton /> : null}

            {!searching && searchError ? (
              <div className="xzr-state xzr-error" role="alert">
                <strong>没找到</strong>
                <p>{searchError}</p>
              </div>
            ) : null}

            {!searching && !searchError && searchTouched && searchResults.length === 0 ? (
              <div className="xzr-state">
                <strong>没有匹配的播客</strong>
                <p>换个关键词,或直接粘贴小宇宙的播客 / 单集链接</p>
              </div>
            ) : null}

            {searchResults.length > 0 ? (
              <ol className="xzr-list">
                {searchResults.map((item) => (
                  <li key={item.appleId || item.title} className="xzr-item">
                    <button
                      type="button"
                      className="xzr-row"
                      onClick={() =>
                        openChannel({
                          title: item.title,
                          author: item.author,
                          genre: item.genre,
                          episodes: item.episodes,
                          logo: item.logo,
                          appleId: item.appleId,
                          url: '',
                        })
                      }
                      aria-label={`打开 ${item.title} 的频道`}
                    >
                      {item.logo ? (
                        <img className="xzr-logo" src={item.logo} alt="" loading="lazy" referrerPolicy="no-referrer" />
                      ) : (
                        <span className="xzr-logo xzr-logo-empty" />
                      )}
                      <span className="xzr-main">
                        <span className="xzr-title" title={item.title}>{item.title}</span>
                        <span className="xzr-sub">
                          {item.author || '—'}
                          {item.genre ? <em>· {item.genre}</em> : null}
                          {item.episodes ? <em>· {item.episodes} 集</em> : null}
                        </span>
                      </span>
                    </button>
                    <button
                      type="button"
                      className={`xzr-ext xzr-ext-star${favoriteIndex.has(favoriteKey(item)) ? ' is-on' : ''}`}
                      onClick={() => toggleFavorite(item)}
                      aria-label={favoriteIndex.has(favoriteKey(item)) ? '取消收藏' : '收藏这个播客'}
                    >
                      {favoriteIndex.has(favoriteKey(item)) ? '★' : '☆'}
                    </button>
                  </li>
                ))}
              </ol>
            ) : null}

            {!searchTouched ? (
              <div className="xzr-state">
                <strong>找榜单外的播客</strong>
                <p>输入名字搜(走 Apple 播客目录),或粘贴小宇宙链接直接打开频道</p>
              </div>
            ) : null}
          </div>
        ) : null}

        {kind === 'favorites' ? (
          <FavoritesList
            items={favorites}
            query={query}
            openChannel={openChannel}
            openExternal={open}
            onRemove={(key) => {
              setFavorites((prev) => prev.filter((item) => item.key !== key))
              fetch(`/x-hot/favorites?id=${encodeURIComponent(key)}`, { method: 'DELETE' }).catch(() => {})
            }}
          />
        ) : null}

        {kind === 'library' ? (
          <LibraryList
            items={library}
            query={query}
            openExternal={open}
            onRemove={removeSummarized}
            openSession={openSession}
          />
        ) : null}

        {kind !== 'library' && kind !== 'favorites' && kind !== 'search' && loading && items.length === 0 ? <Skeleton /> : null}

        {kind !== 'library' && kind !== 'favorites' && kind !== 'search' && !loading && error ? (
          <div className="xzr-state xzr-error" role="alert">
            <strong>没拉到榜单</strong>
            <p>{error}</p>
            <button type="button" onClick={() => load(kind)}>重试</button>
          </div>
        ) : null}

        {kind !== 'library' && kind !== 'favorites' && kind !== 'search' && !loading && !error && filtered.length === 0 ? (
          <div className="xzr-state">
            <strong>{query ? '没有匹配的条目' : '榜单是空的'}</strong>
            <p>{query ? '换个关键词试试' : '上游暂时没有返回数据'}</p>
          </div>
        ) : null}

        {kind !== 'library' && kind !== 'favorites' && kind !== 'search' && filtered.length > 0 ? (
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
                      {libraryIndex.has(item) ? <span className="xzr-done">✓ 已总结</span> : null}
                      {!isEpisode && favoriteIndex.has(pidOf(item)) ? <span className="xzr-star-mark">★ 收藏</span> : null}
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
            : kind === 'favorites'
              ? `${favorites.length} 个频道 · 存在本机`
              : kind === 'search'
                ? `${searchResults.length} 个结果 · 数据来自 Apple 播客目录`
                : query
              ? `${filtered.length} / ${items.length} 条`
              : `前 ${items.length} 名`}
          {kind !== 'library' && total > items.length ? ` · 共 ${total} 档上榜` : ''}
          {kind !== 'library' && isEpisode ? ' · 点单集新开会话总结' : ''}
        </span>
        {kind === 'library' || kind === 'favorites' ? (
          <span className="xzr-foot-actions">
            {kind === 'library' ? (
              <>
                {relinkNote ? <span className="xzr-note">{relinkNote}</span> : null}
                <button type="button" className="xzr-linkbtn" onClick={relinkSessions} disabled={relinking}>
                  {relinking ? '扫描中…' : '重新关联会话'}
                </button>
              </>
            ) : (
              <>
                {favNote ? <span className="xzr-note">{favNote}</span> : null}
                <button type="button" className="xzr-linkbtn" onClick={rebuildFavorites} disabled={rebuildingFavs}>
                  {rebuildingFavs ? '扫描中…' : '按总结补收藏'}
                </button>
              </>
            )}
          </span>
        ) : (
          <span>{fetchedAt ? `更新于 ${formatClock(fetchedAt)}` : '—'}</span>
        )}
      </footer>
      </div>

      {channel ? (
        <ChannelView
          podcast={channel.podcast}
          data={channel.data}
          loading={channel.loading}
          error={channel.error}
          onBack={closeChannel}
          onRetry={() => openChannel(channel.podcast)}
          summarize={summarizeEpisode}
          openExternal={open}
          isDone={(ep) => libraryIndex.has(ep)}
          isFavorite={favoriteIndex.has(favoriteKey(channel.podcast))}
          onToggleFavorite={toggleFavorite}
        />
      ) : null}
    </>
  )
}

function FavoritesList({ items, query, openChannel, openExternal, onRemove }) {
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter(
      (item) =>
        item.title?.toLowerCase().includes(q) ||
        item.author?.toLowerCase().includes(q) ||
        item.genre?.toLowerCase().includes(q),
    )
  }, [items, query])

  if (items.length === 0) {
    return (
      <div className="xzr-state">
        <strong>还没有收藏的播客</strong>
        <p>进任意播客的频道页,点右上角「☆ 收藏」</p>
      </div>
    )
  }

  if (filtered.length === 0) {
    return (
      <div className="xzr-state">
        <strong>没有匹配的收藏</strong>
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
            onClick={() => openChannel(item)}
            aria-label={`打开 ${item.title} 的频道`}
          >
            <span className="xzr-star-mark xzr-star-lead">★</span>
            {item.logo ? (
              <img className="xzr-logo" src={item.logo} alt="" loading="lazy" referrerPolicy="no-referrer" />
            ) : (
              <span className="xzr-logo xzr-logo-empty" />
            )}
            <span className="xzr-main">
              <span className="xzr-title" title={item.title}>{item.title}</span>
              <span className="xzr-sub">
                {item.author || '—'}
                {item.genre ? <em>· {item.genre}</em> : null}
              </span>
            </span>
          </button>
          <button
            type="button"
            className="xzr-ext xzr-ext-always"
            onClick={() => onRemove(item.key)}
            aria-label={`取消收藏 ${item.title}`}
          >
            ×
          </button>
        </li>
      ))}
    </ol>
  )
}

function LibraryList({ items, query, openExternal, onRemove, openSession }) {
  const [note, setNote] = useState('')

  const openItem = useCallback(
    (item) => {
      if (!item.sessionId) {
        openExternal(item.url)
        return
      }
      const opened = typeof openSession === 'function' && openSession(item.sessionId)
      if (opened) {
        setNote('')
        return
      }
      setNote('这个会话打不开(可能已被删除),可以在小宇宙里重新看这一集')
      setTimeout(() => setNote(''), 4000)
    },
    [openExternal, openSession],
  )

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
    <>
      {note ? <div className="xzr-banner" role="status">{note}</div> : null}
      <ol className="xzr-list">
        {filtered.map((item) => (
        <li key={item.key} className="xzr-item">
          <button
            type="button"
            className="xzr-row"
            onClick={() => openItem(item)}
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
    </>
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
.xzr-search-hero{display:flex;gap:8px;margin:8px 14px 10px}
.xzr-search-hero input{flex:1;min-width:0;height:32px;padding:0 10px;border-radius:var(--dsw-radius-sm);
  border:1px solid var(--dsw-alias-border-l2);background:transparent;color:var(--dsw-alias-label-primary);font-size:13px}
.xzr-search-hero input:focus{outline:none;border-color:var(--dsw-alias-brand-primary)}
.xzr-search-hero button{height:32px;padding:0 14px;border-radius:var(--dsw-radius-sm);border:0;cursor:pointer;
  background:var(--dsw-alias-brand-primary);color:#fff;font-size:12.5px}
.xzr-search-hero button:disabled{opacity:.6;cursor:default}
.xzr-ext.xzr-ext-star{opacity:1;color:var(--dsw-alias-label-tertiary);font-size:14px;line-height:1}
.xzr-ext.xzr-ext-star.is-on{color:#c08a2e}
.xzr-stat-cta b{color:var(--dsw-alias-brand-primary);font-size:12px}
.xzr-star-mark{display:inline-block;margin-right:6px;padding:0 5px;border-radius:4px;font-size:10.5px;
  color:#c08a2e;background:rgba(192,138,46,.14)}
.xzr-star-lead{flex:none;margin:0;font-size:15px;background:transparent;width:18px;text-align:center}
.xzr-fav{display:inline-flex;align-items:center;gap:4px;height:28px;padding:0 10px;border-radius:var(--dsw-radius-sm);
  border:1px solid var(--dsw-alias-border-l2);background:transparent;color:var(--dsw-alias-label-secondary);
  font-size:12px;cursor:pointer;flex:none;transition:background .15s,color .15s,border-color .15s}
.xzr-fav:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.xzr-fav.is-on{color:#c08a2e;border-color:rgba(192,138,46,.45);background:rgba(192,138,46,.10)}
.xzr-done{display:inline-block;margin-right:6px;padding:0 5px;border-radius:4px;font-size:10.5px;
  color:var(--dsw-alias-state-business-primary);background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 12%,transparent)}
.xzr-rank-done{color:var(--dsw-alias-state-business-primary);font-weight:700}
.xzr-ext.xzr-ext-always{opacity:.55}
.xzr-ext.xzr-ext-left{right:38px}
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
.xzr-ext{position:absolute;right:8px;top:50%;transform:translateY(-50%);width:26px;height:26px;
  display:inline-flex;align-items:center;justify-content:center;border:0;border-radius:var(--dsw-radius-sm);
  background:transparent;color:var(--dsw-alias-label-caption);cursor:pointer;opacity:0;
  transition:opacity .15s,background .15s,color .15s}
.xzr-item:hover .xzr-ext,.xzr-ext:focus-visible{opacity:1}
.xzr-ext:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.xzr-row{display:flex;align-items:center;gap:12px;width:100%;padding:9px 72px 9px 10px;border:0;background:transparent;
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
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
  /* 只让"文字本身"接收 hover:否则整行宽都是 tooltip 触发区,气泡会盖住右侧图标 */
  align-self:flex-start;max-width:100%}
.xzr-sub{font-size:11.5px;color:var(--dsw-alias-label-tertiary);
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.xzr-sub em{font-style:normal;margin-left:4px;color:var(--dsw-alias-label-caption)}
.xzr-stats{flex:none;display:flex;gap:18px;padding-left:8px}
.xzr-stat{display:flex;flex-direction:column;align-items:flex-end;min-width:52px}
.xzr-stat b{font-size:12.5px;font-weight:600;font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-secondary)}
.xzr-stat i{font-style:normal;font-size:10.5px;color:var(--dsw-alias-label-caption)}
.xzr-banner{margin:6px 14px;padding:7px 10px;border-radius:var(--dsw-radius-sm);
  background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);font-size:12px}
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
.xzr-foot-actions{display:inline-flex;align-items:center;gap:10px}
.xzr-note{color:var(--dsw-alias-label-caption)}
.xzr-linkbtn{border:0;background:transparent;color:var(--dsw-alias-brand-primary);font-size:11px;
  cursor:pointer;padding:2px 4px;border-radius:4px}
.xzr-linkbtn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}
.xzr-linkbtn:disabled{color:var(--dsw-alias-label-caption);cursor:default}
.xzr-foot{flex:none;display:flex;align-items:center;justify-content:space-between;padding:7px max(24px,calc((100% - 1040px)/2));
  border-top:1px solid var(--dsw-alias-border-l1);font-size:11px;color:var(--dsw-alias-label-caption)}
@media (max-width:720px){.xzr-header{padding:14px 14px 8px}.xzr-stats{display:none}.xzr-foot{padding:7px 14px}}
`
