/**
 * 小宇宙热榜 · 宿主侧
 *
 * 数据源:
 *   - 榜单:中文播客榜(xyzrank)的公开 JSON,免登录;
 *   - 频道分集:播客自己的 RSS(小宇宙托管的节目在 feed.xyzfm.space,靠 iTunes lookup 换到),
 *     拿不到 RSS 时退化成小宇宙播客页 SSR 里最新的 15 集。
 * 两者都由宿主代理:xyzrank 与 RSS 都不给 CORS 头,浏览器直连会被拦。
 *
 * 路由(都由本插件注册在 dsh-host-webserver 上):
 *   GET /x-hot/list?kind=podcasts|new|episodes|new-episodes&limit=1..100&offset=0
 *   GET /x-hot/channel?id=<小宇宙播客 id>&apple=<Apple Podcasts id>
 *   GET /x-hot/health
 */
export const name = 'xiaoyuzhou-hot'

/** 只依赖 web server,不碰 agent / tools,尽量轻。 */
export const inject = ['webServer']

const UPSTREAM = 'https://xyzrank.com/api'
const XIAOYUZHOU = 'https://www.xiaoyuzhoufm.com'
const ITUNES = 'https://itunes.apple.com/lookup'
const KINDS = {
  podcasts: 'podcasts',
  new: 'new-podcasts',
  episodes: 'episodes',
  'new-episodes': 'new-episodes',
}
const TTL_MS = 5 * 60 * 1000
const FEED_TTL_MS = 10 * 60 * 1000
const LOOKUP_TTL_MS = 24 * 60 * 60 * 1000
const TIMEOUT_MS = 20_000
const MAX_EPISODES = 300
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36'

function sendJson(res, status, body) {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(payload),
  })
  res.end(payload)
}

function clampInt(value, fallback, min, max) {
  const n = Number.parseInt(String(value ?? ''), 10)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

async function fetchText(url, timeoutMs = TIMEOUT_MS) {
  const res = await fetch(url, {
    headers: { 'user-agent': UA, accept: '*/*' },
    signal: AbortSignal.timeout(timeoutMs),
    redirect: 'follow',
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
  return res.text()
}

function xyzLink(item) {
  return Array.isArray(item?.links) ? item.links.find((l) => l?.name === 'xyz')?.url ?? '' : ''
}

function appleIdOf(item) {
  const url = Array.isArray(item?.links) ? item.links.find((l) => l?.name === 'apple')?.url ?? '' : ''
  return /\/id(\d+)/.exec(url)?.[1] ?? ''
}

function normalizePodcast(item) {
  return {
    rank: item?.rank ?? 0,
    title: item?.name ?? '',
    author: item?.authorsText ?? '',
    genre: item?.primaryGenreName ?? '',
    episodes: item?.trackCount ?? 0,
    avgPlay: item?.avgPlayCount ?? 0,
    openRate: item?.avgOpenRate ?? 0,
    comments: item?.avgCommentCount ?? 0,
    url: xyzLink(item),
    appleId: appleIdOf(item),
    logo: item?.logoURL ?? '',
  }
}

function normalizeEpisode(item) {
  return {
    rank: item?.rank ?? 0,
    title: item?.title ?? '',
    author: item?.podcastName ?? '',
    genre: item?.primaryGenreName ?? '',
    avgPlay: item?.playCount ?? 0,
    openRate: item?.openRate ?? 0,
    comments: item?.commentCount ?? 0,
    url: item?.link ?? '',
    logo: item?.logoURL ?? '',
  }
}

// ---------------------------------------------------------------- RSS 解析 ---

function decodeEntities(text) {
  return String(text)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_m, code) => String.fromCodePoint(Number(code)))
    .replace(/&amp;/g, '&')
    .trim()
}

function tagValue(block, tag) {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'i')
  const m = re.exec(block)
  return m ? decodeEntities(m[1]) : ''
}

/** "01:51:36" / "111:36" / "6720" → 秒 */
function parseDuration(raw) {
  const text = String(raw ?? '').trim()
  if (!text) return 0
  if (/^\d+$/.test(text)) return Number(text)
  const parts = text.split(':').map((n) => Number.parseInt(n, 10)).filter(Number.isFinite)
  if (parts.length === 0) return 0
  return parts.reduce((acc, part) => acc * 60 + part, 0)
}

function parseFeed(xml, limit) {
  const channelTitle = tagValue(xml.slice(0, Math.max(0, xml.indexOf('<item'))), 'title')
  const blocks = xml.match(/<item\b[\s\S]*?<\/item>/gi) ?? []
  const episodes = []
  for (const block of blocks) {
    if (episodes.length >= limit) break
    const link = tagValue(block, 'link').replace(/\?utm_source=rss$/, '')
    const guid = tagValue(block, 'guid') || link.split('/').pop()
    const title = tagValue(block, 'title')
    if (!title) continue
    const enclosure = /<enclosure\b[^>]*\burl="([^"]+)"/i.exec(block)?.[1] ?? ''
    episodes.push({
      id: guid,
      title,
      url: link,
      audioUrl: enclosure,
      pubDate: tagValue(block, 'pubDate') || tagValue(block, 'pubdate'),
      duration: parseDuration(tagValue(block, 'itunes:duration') || tagValue(block, 'duration')),
    })
  }
  return { channelTitle, episodes }
}

// ------------------------------------------------------------ 站点 SSR 兜底 ---

function parseSsrEpisodes(html, limit) {
  const m = /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/.exec(html)
  if (!m) throw new Error('没有找到 __NEXT_DATA__(小宇宙页面结构可能变了)')
  const data = JSON.parse(m[1])
  const podcast = data?.props?.pageProps?.podcast
  if (!podcast) throw new Error('页面里没有 podcast 数据')
  const episodes = (podcast.episodes ?? []).slice(0, limit).map((ep) => ({
    id: ep.eid,
    title: ep.title ?? '',
    url: ep.eid ? `${XIAOYUZHOU}/episode/${ep.eid}` : '',
    audioUrl: (ep.enclosure?.url ?? '').replace(/^http:\/\//, 'https://'),
    pubDate: ep.pubDate ?? '',
    duration: Number(ep.duration ?? 0),
  }))
  return {
    channelTitle: podcast.title ?? '',
    total: podcast.episodeCount ?? episodes.length,
    episodes,
  }
}

// ------------------------------------------------------------------- 插件 ---

export function apply(ctx, config = {}) {
  /** key -> { at, data, ttl } */
  const cache = new Map()
  /** key -> Promise,避免并发穿透 */
  const inflight = new Map()
  const log = ctx.logger ?? console

  function cached(key, ttl, producer) {
    const hit = cache.get(key)
    if (hit && Date.now() - hit.at < ttl) return Promise.resolve({ ...hit.data, cached: true, fetchedAt: hit.at })
    const pending = inflight.get(key)
    if (pending) return pending
    const task = producer()
      .then((data) => {
        cache.set(key, { at: Date.now(), data })
        if (cache.size > 64) cache.delete(cache.keys().next().value)
        return { ...data, cached: false, fetchedAt: Date.now() }
      })
      .catch((error) => {
        if (hit) {
          log.warn?.(`xiaoyuzhou-hot: upstream failed, serving stale (${error?.message ?? error})`)
          return { ...hit.data, cached: true, stale: true, fetchedAt: hit.at }
        }
        throw error
      })
      .finally(() => inflight.delete(key))
    inflight.set(key, task)
    return task
  }

  async function fetchUpstream(kind, limit, offset) {
    const api = KINDS[kind]
    const url = `${UPSTREAM}/${api}?limit=${limit}&offset=${offset}`
    const res = await fetch(url, {
      headers: { 'user-agent': UA, accept: 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!res.ok) throw new Error(`xyzrank ${res.status} ${res.statusText}`)
    const data = await res.json()
    const items = Array.isArray(data?.items) ? data.items : []
    const isEpisode = api.includes('episode')
    return {
      items: items.map(isEpisode ? normalizeEpisode : normalizePodcast),
      total: Number(data?.total ?? items.length),
      limit: Number(data?.limit ?? limit),
      offset: Number(data?.offset ?? offset),
    }
  }

  /** Apple Podcasts id → RSS feedUrl(缓存一天) */
  async function feedUrlOf(appleId) {
    return cached(`lookup:${appleId}`, LOOKUP_TTL_MS, async () => {
      const json = await fetch(`${ITUNES}?id=${encodeURIComponent(appleId)}&entity=podcast`, {
        headers: { 'user-agent': UA, accept: 'application/json' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      }).then((r) => (r.ok ? r.json() : null))
      const feedUrl = json?.results?.[0]?.feedUrl ?? ''
      if (!feedUrl) throw new Error(`iTunes lookup 没有返回 feedUrl (id=${appleId})`)
      return { feedUrl }
    })
  }

  async function loadChannel(podcastId, appleId, limit) {
    // 优先走 RSS:能拿到完整历史(小宇宙托管的节目 feed 在 feed.xyzfm.space)
    if (appleId) {
      try {
        const { feedUrl } = await feedUrlOf(appleId)
        const feed = await cached(`feed:${feedUrl}`, FEED_TTL_MS, async () => {
          const xml = await fetchText(feedUrl, 30_000)
          const parsed = parseFeed(xml, MAX_EPISODES)
          if (parsed.episodes.length === 0) throw new Error('RSS 里没有解析到单集')
          return { source: 'rss', feedUrl, title: parsed.channelTitle, episodes: parsed.episodes }
        })
        return { ...feed, episodes: feed.episodes.slice(0, limit) }
      } catch (error) {
        log.warn?.(`xiaoyuzhou-hot: RSS 拿不到,回退到 SSR (${error?.message ?? error})`)
      }
    }

    if (!podcastId) throw new Error('需要 id 或 apple 参数')
    return cached(`ssr:${podcastId}`, TTL_MS, async () => {
      const html = await fetchText(`${XIAOYUZHOU}/podcast/${podcastId}`)
      const parsed = parseSsrEpisodes(html, limit)
      return { source: 'ssr', title: parsed.channelTitle, total: parsed.total, episodes: parsed.episodes }
    })
  }

  const disposers = []

  disposers.push(
    ctx.webServer.register({
      kind: 'exact',
      path: '/x-hot/list',
      handler: async (req, res) => {
        if (req.method !== 'GET') return sendJson(res, 405, { ok: false, error: 'method not allowed' })
        try {
          const url = new URL(req.url ?? '/x-hot/list', 'http://localhost')
          const kind = KINDS[url.searchParams.get('kind')] ? url.searchParams.get('kind') : 'podcasts'
          const limit = clampInt(url.searchParams.get('limit'), 50, 1, 100)
          const offset = clampInt(url.searchParams.get('offset'), 0, 0, 100_000)
          const data = await cached(`list:${kind}:${limit}:${offset}`, TTL_MS, () => fetchUpstream(kind, limit, offset))
          return sendJson(res, 200, { ok: true, kind, ...data })
        } catch (error) {
          log.warn?.(`xiaoyuzhou-hot: ${error?.stack ?? error}`)
          return sendJson(res, 502, { ok: false, error: String(error?.message ?? error) })
        }
      },
    }),
  )

  disposers.push(
    ctx.webServer.register({
      kind: 'exact',
      path: '/x-hot/channel',
      handler: async (req, res) => {
        if (req.method !== 'GET') return sendJson(res, 405, { ok: false, error: 'method not allowed' })
        try {
          const url = new URL(req.url ?? '/x-hot/channel', 'http://localhost')
          const id = (url.searchParams.get('id') ?? '').trim()
          const apple = (url.searchParams.get('apple') ?? '').trim()
          const limit = clampInt(url.searchParams.get('limit'), MAX_EPISODES, 1, MAX_EPISODES)
          if (!/^[0-9a-f]{24}$/i.test(id) && !/^\d+$/.test(apple)) {
            return sendJson(res, 400, { ok: false, error: 'id 必须是 24 位小宇宙播客 id,apple 必须是数字 id' })
          }
          const data = await loadChannel(id, apple, limit)
          return sendJson(res, 200, { ok: true, ...data })
        } catch (error) {
          log.warn?.(`xiaoyuzhou-hot: channel ${error?.stack ?? error}`)
          return sendJson(res, 502, { ok: false, error: String(error?.message ?? error) })
        }
      },
    }),
  )

  disposers.push(
    ctx.webServer.register({
      kind: 'exact',
      path: '/x-hot/health',
      handler: (req, res) => sendJson(res, 200, { ok: true, plugin: 'xiaoyuzhou-hot', upstream: UPSTREAM }),
    }),
  )

  // 热重载时先摘掉旧路由,再挂新的;否则重复注册会抛错
  ctx.effect?.(() => () => {
    for (const dispose of disposers.splice(0)) {
      try {
        dispose()
      } catch {
        /* 已经被宿主摘掉 */
      }
    }
  }, 'xiaoyuzhou-hot: unregister routes')

  log.info?.('xiaoyuzhou-hot: routes /x-hot/list, /x-hot/channel, /x-hot/health registered')
}
