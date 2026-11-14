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
import { copyFile, mkdir, readdir, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises'
import { checkSummary } from './check.js'
import { homedir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import { zstdDecompressSync } from 'node:zlib'

export const name = 'xiaoyuzhou-hot'

/** 只依赖 web server,不碰 agent / tools,尽量轻。 */
export const inject = ['webServer']

const UPSTREAM = 'https://xyzrank.com/api'
const XIAOYUZHOU = 'https://www.xiaoyuzhoufm.com'
const ITUNES = 'https://itunes.apple.com/lookup'
const ITUNES_SEARCH = 'https://itunes.apple.com/search'
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
const MAX_LIBRARY = 2000
const LIBRARY_DIR =
  process.env.XZR_DATA_DIR || join(process.env.DSH_HOME || join(homedir(), '.dsh'), 'xiaoyuzhou-hot')
const LIBRARY_FILE = join(LIBRARY_DIR, 'library.json')
const FAVORITES_FILE = join(LIBRARY_DIR, 'favorites.json')
/** 已读记录里允许写入的字段与长度上限 */
const DEFAULT_ITEM_FIELDS = [
  ['title', 300],
  ['podcast', 200],
  ['url', 600],
  ['podcastUrl', 600],
  ['sessionId', 100],
]
/** 收藏的播客频道 */
const FAVORITE_ITEM_FIELDS = [
  ['title', 300],
  ['author', 200],
  ['genre', 100],
  ['url', 600],
  ['appleId', 40],
  ['logo', 600],
]
const SESSION_ROOT = join(process.env.DSH_HOME || join(homedir(), '.dsh'), 'sessions')
const SESSION_SCAN_LIMIT = 400
/**
 * 图片反代:浏览器经 Tailscale 访问时,第三方 CDN(Apple/喜马拉雅/小宇宙)常常
 * 直连不到或很慢;由宿主把它们抓回来再发给浏览器,只需要能连通 DSH 本身。
 */
const IMAGE_HOST_SUFFIXES = ['xyzcdn.net', 'mzstatic.com', 'xmcdn.com', 'xiaoyuzhoufm.com']
const IMAGE_TTL_MS = 24 * 60 * 60 * 1000
const IMAGE_MAX_BYTES = 6 * 1024 * 1024
const IMAGE_MAX_ENTRIES = 120
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

function isAllowedImageUrl(raw) {
  let url
  try {
    url = new URL(String(raw ?? ''))
  } catch {
    return false
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return false
  return IMAGE_HOST_SUFFIXES.some((suffix) => url.hostname === suffix || url.hostname.endsWith(`.${suffix}`))
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

// ------------------------------------------------------------- 已读记录库 ---

function readJsonBody(req, limitBytes = 64 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > limitBytes) {
        reject(new Error('body too large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      try {
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {})
      } catch (error) {
        reject(new Error(`invalid JSON: ${error.message}`))
      }
    })
    req.on('error', reject)
  })
}

/**
 * 「我总结过哪些单集」的本地记录:一个 JSON 文件,key 是单集 id(或 url)。
 * 只存在本机,不联网;写盘用 tmp+rename,并保留一份 .bak,
 * 主文件被误删/写坏时还能从备份读回来。
 */
class Library {
  constructor(path, log, fields = DEFAULT_ITEM_FIELDS) {
    this.path = path
    this.fields = fields
    this.backupPath = `${path}.bak`
    // 每天第一次写盘前留一份带日期的快照,保留最近 14 份
    this.snapshotDir = join(dirname(path), 'backups')
    this.snapshotPrefix = `${basename(path, '.json')}-`
    this.snapshotKeep = 14
    this.log = log
    this.items = new Map()
    this.loaded = false
    this.loadFailed = false
    this.loading = undefined
    this.timer = undefined
    this.pending = undefined
  }

  async load() {
    if (this.loaded) return this.items
    if (this.loading === undefined) {
      this.loading = (async () => {
        let found = await this.readFirst([this.path, this.backupPath])
        if (!found) found = await this.readNewestSnapshot()
        if (found) {
          try {
            const parsed = JSON.parse(found.raw)
            const list = Array.isArray(parsed?.items) ? parsed.items : []
            for (const item of list) {
              if (item && typeof item.key === 'string') this.items.set(item.key, item)
            }
            if (found.path === this.backupPath) {
              this.log?.warn?.('xiaoyuzhou-hot: 主记录文件不可用,已从 library.json.bak 恢复')
            }
          } catch (error) {
            // 解析失败时不许再写:否则一次空写就把还能人工抢救的文件清掉了
            this.loadFailed = true
            this.log?.warn?.(`xiaoyuzhou-hot: library 解析失败,本次不写盘 (${error?.message ?? error})`)
          }
        }
        this.loaded = true
        return this.items
      })().finally(() => {
        this.loading = undefined
      })
    }
    return this.loading
  }

  /** 从 backups/ 里挑该 store 的最新快照 */
  async readNewestSnapshot() {
    let names = []
    try {
      names = await readdir(this.snapshotDir)
    } catch {
      return undefined
    }
    const candidates = names
      .filter((name) => name.startsWith(this.snapshotPrefix) && name.endsWith('.json'))
      .sort()
      .reverse()
    for (const name of candidates) {
      try {
        return { path: join(this.snapshotDir, name), raw: await readFile(join(this.snapshotDir, name), 'utf8') }
      } catch {
        continue
      }
    }
    return undefined
  }

  /** 每天第一次写之前,把当前文件复制成带日期的快照 */
  async writeDailySnapshot() {
    const today = new Date().toISOString().slice(0, 10)
    const target = join(this.snapshotDir, `${this.snapshotPrefix}${today}.json`)
    try {
      await stat(target)
      return
    } catch {
      // 今天还没有
    }
    try {
      await mkdir(this.snapshotDir, { recursive: true })
      await copyFile(this.path, target)
    } catch (error) {
      if (error?.code !== 'ENOENT') {
        this.log?.warn?.(`xiaoyuzhou-hot: 快照失败 (${error?.message ?? error})`)
      }
    }
  }

  /** 只保留最近 N 份快照 */
  async pruneSnapshots() {
    let names = []
    try {
      names = await readdir(this.snapshotDir)
    } catch {
      return
    }
    const mine = names
      .filter((name) => name.startsWith(this.snapshotPrefix) && name.endsWith('.json'))
      .sort()
      .reverse()
    for (const name of mine.slice(this.snapshotKeep)) {
      try {
        await unlink(join(this.snapshotDir, name))
      } catch {
        /* ignore */
      }
    }
  }

  async readFirst(paths) {
    for (const path of paths) {
      try {
        return { path, raw: await readFile(path, 'utf8') }
      } catch (error) {
        if (error?.code !== 'ENOENT') throw error
      }
    }
    return undefined
  }

  async list() {
    await this.load()
    return [...this.items.values()].sort((a, b) => (b.at ?? 0) - (a.at ?? 0))
  }

  async mark(input) {
    await this.load()
    const key = String(input?.key ?? '').slice(0, 400)
    if (!key) throw new Error('key 不能为空')
    // 合并写:补 sessionId 之类的局部更新不会把标题/链接冲掉
    const existing = this.items.get(key) ?? {}
    const item = { ...existing, key }
    for (const [field, max] of this.fields) {
      const value = input?.[field]
      if (typeof value === 'string') item[field] = value.slice(0, max)
    }
    item.at = Number.isFinite(input?.at) ? input.at : (existing.at ?? Date.now())
    this.items.delete(key)
    this.items.set(key, item)
    while (this.items.size > MAX_LIBRARY) this.items.delete(this.items.keys().next().value)
    await this.flush()
    return item
  }

  async unmark(key) {
    await this.load()
    const removed = this.items.delete(String(key ?? ''))
    if (removed) await this.flush()
    return removed
  }

  /**
   * 合并短时间内的多次写入:共用一个 150ms 窗口,窗口内所有调用等同一个 promise,
   * 不会出现"后一次 clearTimeout 把前一次的 promise 永远挂住"的情况。
   */
  flush() {
    if (this.pending) return this.pending
    this.pending = (async () => {
      await new Promise((resolve) => {
        this.timer = setTimeout(resolve, 150)
      })
      this.timer = undefined
      this.pending = undefined
      await this.write()
    })()
    return this.pending
  }

  /** 卸载/退出前立即落盘,不等窗口 */
  async flushNow() {
    if (!this.loaded) await this.load()
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = undefined
    }
    this.pending = undefined
    await this.write()
  }

  async write() {
    // 关键:没读过盘就别写。否则一个刚启动、还没被访问过的进程在 dispose 时
    // 会把内存里的空表写回磁盘,把用户数据整份清空(真实踩过一次)。
    if (!this.loaded) await this.load()
    if (this.loadFailed) {
      this.log?.warn?.('xiaoyuzhou-hot: 上次读取失败,跳过写盘以免覆盖')
      return
    }
    try {
      await mkdir(dirname(this.path), { recursive: true })
      await this.writeDailySnapshot()
      const payload = JSON.stringify({ version: 1, items: [...this.items.values()] }, null, 2)
      const tmp = `${this.path}.tmp`
      await writeFile(tmp, payload, 'utf8')
      try {
        await copyFile(this.path, this.backupPath)
      } catch (error) {
        if (error?.code !== 'ENOENT') throw error
      }
      await rename(tmp, this.path)
      await this.pruneSnapshots()
    } catch (error) {
      this.log?.warn?.(`xiaoyuzhou-hot: library 写入失败 (${error?.message ?? error})`)
    }
  }
}

// --------------------------------------------------------- 会话关联(补救) ---

const ZSTD_MAGIC = [0x28, 0xb5, 0x2f, 0xfd]

/**
 * DSH 的会话文件是多段 zstd 拼接,node:zlib 的 zstdDecompressSync 只解第一段。
 * 这里按魔数把帧切开逐段解(实测 70 帧、0 失败),不依赖外部的 zstd 命令。
 */
function decodeSessionFile(buffer) {
  const starts = [0]
  for (let i = 4; i < buffer.length - 3; i += 1) {
    if (
      buffer[i] === ZSTD_MAGIC[0] &&
      buffer[i + 1] === ZSTD_MAGIC[1] &&
      buffer[i + 2] === ZSTD_MAGIC[2] &&
      buffer[i + 3] === ZSTD_MAGIC[3]
    ) {
      starts.push(i)
    }
  }
  let text = ''
  for (let k = 0; k < starts.length; k += 1) {
    const end = k + 1 < starts.length ? starts[k + 1] : buffer.length
    try {
      text += zstdDecompressSync(buffer.subarray(starts[k], end)).toString('utf8')
    } catch {
      // 某一帧坏了就跳过,不影响其它帧
    }
  }
  return text
}

/** 从会话里找出「总结《播客》单集标题」那条用户消息 */
function summaryPromptOf(text) {
  for (const line of text.split('\n')) {
    if (!line.includes('"user/message"')) continue
    let event
    try {
      event = JSON.parse(line)
    } catch {
      continue
    }
    for (const part of event?.data?.content ?? []) {
      const value = part?.text
      if (typeof value !== 'string' || !value.startsWith('总结《')) continue
      const match = /^总结《(.+?)》([^\n]+)/.exec(value)
      if (match) {
        const url = /^单集页：(.+)$/m.exec(value)?.[1]?.trim() ?? ''
        return { podcast: match[1].trim(), title: match[2].trim(), url }
      }
    }
  }
  return undefined
}

const normalizeTitle = (value) => String(value ?? '').replace(/\s+/g, '')

/** 取会话里最后一段像"总结"的 assistant 正文 */
function lastAssistantText(sessionText) {
  let best = ''
  for (const line of sessionText.split('\n')) {
    if (!line.startsWith('{') || !line.includes('"assistant/message"')) continue
    let event
    try {
      event = JSON.parse(line)
    } catch {
      continue
    }
    const parts = event?.data?.message?.content ?? event?.data?.content ?? []
    const text = parts
      .filter((part) => part?.type === 'text')
      .map((part) => part.text)
      .join('\n')
      .trim()
    if (text.length > 400) best = text
  }
  return best
}

async function listSessionFiles(root, limit) {
  const files = []
  let workspaces = []
  try {
    workspaces = await readdir(root)
  } catch {
    return files
  }
  for (const workspace of workspaces) {
    const dir = join(root, workspace)
    let entries = []
    try {
      if (!(await stat(dir)).isDirectory()) continue
      entries = await readdir(dir)
    } catch {
      continue
    }
    for (const entry of entries) {
      if (!entry.startsWith('session-')) continue
      const file = join(dir, entry, 'session.v4.jsonl.zstd')
      try {
        if (!(await stat(file)).isFile()) continue
      } catch {
        continue
      }
      // 会话 id 就是目录名(带 session- 前缀);剥掉前缀会得到一个 Host 不认识的 id
      files.push({ sessionId: entry, file })
      if (files.length >= limit) return files
    }
  }
  return files
}

/**
 * 按标题把已读记录和会话对齐:记录文件丢过、或当时没抓到 sessionId 时用它补。
 * @returns 扫描/命中/新关联的数量
 */
async function relinkSessions(library, log) {
  const items = await library.list()
  const byTitle = new Map(items.filter((item) => item?.title).map((item) => [normalizeTitle(item.title), item]))
  let scanned = 0
  let matched = 0
  let linked = 0
  for (const { sessionId, file } of await listSessionFiles(SESSION_ROOT, SESSION_SCAN_LIMIT)) {
    let prompt
    try {
      prompt = summaryPromptOf(decodeSessionFile(await readFile(file)))
    } catch (error) {
      log?.warn?.(`xiaoyuzhou-hot: 读取会话失败 ${file} (${error?.message ?? error})`)
      continue
    }
    if (!prompt) continue
    scanned += 1
    const item = byTitle.get(normalizeTitle(prompt.title))
    if (!item) continue
    matched += 1
    if (item.sessionId === sessionId) continue
    await library.mark({ key: item.key, sessionId })
    linked += 1
  }
  return { scanned, matched, linked }
}

/**
 * 按「总结历史」补收藏:总结过的播客大概率是常听的。
 * 优先用单集页解析 pid;解析不到(喜马拉雅等)就按播客名去 Apple 目录找精确同名的。
 * @returns {{scanned:number, added:number, skipped:Array<{podcast:string,reason:string}>}}
 */
async function rebuildFavoritesFromSessions(favorites, log, { resolvePodcast, searchPodcasts }) {
  const files = await listSessionFiles(SESSION_ROOT, SESSION_SCAN_LIMIT)
  /** podcastKey -> { podcast, url, at } */
  const latest = new Map()
  for (const { file } of files) {
    let prompt
    let fileStat
    try {
      fileStat = await stat(file)
      prompt = summaryPromptOf(decodeSessionFile(await readFile(file)))
    } catch (error) {
      log?.warn?.(`xiaoyuzhou-hot: 读会话失败 ${file} (${error?.message ?? error})`)
      continue
    }
    if (!prompt?.podcast) continue
    const key = normalizeTitle(prompt.podcast)
    const prev = latest.get(key)
    const at = fileStat?.mtimeMs ?? Date.now()
    if (!prev || prev.at < at) latest.set(key, { podcast: prompt.podcast, url: prompt.url, at })
  }

  const existing = new Set((await favorites.list()).map((item) => item.key))
  const skipped = []
  let added = 0

  for (const entry of latest.values()) {
    let favorite
    try {
      if (/xiaoyuzhoufm\.com\/episode\//i.test(entry.url)) {
        const pod = await resolvePodcast(entry.url)
        if (!pod.pid) throw new Error('没解析出 pid')
        favorite = {
          key: pod.pid,
          title: pod.title || entry.podcast,
          author: pod.author,
          url: pod.url,
          logo: pod.logo,
          at: entry.at,
        }
      } else {
        const found = await searchPodcasts(entry.podcast, 8)
        const exact = found.items.find((item) => normalizeTitle(item.title) === normalizeTitle(entry.podcast))
        const hit = exact ?? found.items[0]
        if (!hit?.appleId) throw new Error('Apple 目录里没找到')
        favorite = {
          key: `apple:${hit.appleId}`,
          title: hit.title || entry.podcast,
          author: hit.author,
          genre: hit.genre,
          appleId: hit.appleId,
          logo: hit.logo,
          at: entry.at,
        }
      }
    } catch (error) {
      skipped.push({ podcast: entry.podcast, reason: String(error?.message ?? error) })
      continue
    }
    if (existing.has(favorite.key)) {
      skipped.push({ podcast: entry.podcast, reason: '已经收藏过' })
      continue
    }
    await favorites.mark(favorite)
    existing.add(favorite.key)
    added += 1
  }

  return { scanned: latest.size, added, skipped }
}

// ------------------------------------------------------------------- 插件 ---

export function apply(ctx, config = {}) {
  /** key -> { at, data, ttl } */
  const cache = new Map()
  /** key -> Promise,避免并发穿透 */
  const inflight = new Map()
  const log = ctx.logger ?? console
  const library = new Library(LIBRARY_FILE, log)
  const favorites = new Library(FAVORITES_FILE, log, FAVORITE_ITEM_FIELDS)

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

  /** 读 __NEXT_DATA__,拿播客页/单集页里的 pageProps */
  function parseNextData(html) {
    const match = /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/.exec(html)
    if (!match) throw new Error('页面里没有 __NEXT_DATA__(结构可能变了)')
    return JSON.parse(match[1])
  }

  function normalizeSsrPodcast(podcast) {
    const pid = podcast?.pid ?? ''
    return {
      pid,
      title: podcast?.title ?? '',
      author: podcast?.author ?? '',
      episodes: podcast?.episodeCount ?? 0,
      logo: podcast?.image?.picUrl ?? podcast?.image?.smallPicUrl ?? '',
      url: pid ? `${XIAOYUZHOU}/podcast/${pid}` : '',
    }
  }

  /** 小宇宙链接 / 24 位 id → 播客信息 */
  async function resolvePodcast(input) {
    const text = String(input ?? '').trim()
    if (!text) throw new Error('缺少链接或 id')
    const hex = /([0-9a-f]{24})/i.exec(text)?.[1] ?? ''
    if (/\/episode\//i.test(text)) {
      const eid = hex || text.split('?')[0].replace(/\/+$/, '').split('/').pop()
      if (!eid) throw new Error('认不出单集 id')
      const data = parseNextData(await fetchText(`${XIAOYUZHOU}/episode/${eid}`))
      const podcast = data?.props?.pageProps?.episode?.podcast
      if (!podcast) throw new Error('单集页里没有播客信息')
      return normalizeSsrPodcast(podcast)
    }
    if (!hex) throw new Error('认不出这是小宇宙的播客/单集链接(需要 24 位 id)')
    const data = parseNextData(await fetchText(`${XIAOYUZHOU}/podcast/${hex}`))
    const podcast = data?.props?.pageProps?.podcast
    if (!podcast) throw new Error('播客页里没有播客信息')
    return normalizeSsrPodcast(podcast)
  }

  /** 关键词 → iTunes 播客搜索(中国区),给榜单外的频道用 */
  async function searchPodcasts(query, limit) {
    return cached(`search:${query}:${limit}`, TTL_MS, async () => {
      const url = `${ITUNES_SEARCH}?term=${encodeURIComponent(query)}&entity=podcast&country=CN&limit=${limit}`
      const res = await fetch(url, {
        headers: { 'user-agent': UA, accept: 'application/json' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
      if (!res.ok) throw new Error(`iTunes search ${res.status}`)
      const data = await res.json()
      const items = (data?.results ?? []).map((r) => ({
        appleId: String(r.collectionId ?? ''),
        title: r.collectionName ?? '',
        author: r.artistName ?? '',
        genre: r.primaryGenreName ?? '',
        episodes: r.trackCount ?? 0,
        logo: r.artworkUrl600 ?? r.artworkUrl100 ?? '',
        feedUrl: r.feedUrl ?? '',
      }))
      return { items: items.filter((item) => item.title) }
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
      path: '/x-hot/library',
      handler: async (req, res) => {
        const url = new URL(req.url ?? '/x-hot/library', 'http://localhost')
        try {
          if (req.method === 'GET') {
            const items = await library.list()
            return sendJson(res, 200, { ok: true, items, count: items.length })
          }
          if (req.method === 'POST') {
            const body = await readJsonBody(req)
            const item = await library.mark(body)
            return sendJson(res, 200, { ok: true, item, count: (await library.list()).length })
          }
          if (req.method === 'DELETE') {
            const key = url.searchParams.get('key') ?? ''
            const removed = await library.unmark(key)
            return sendJson(res, 200, { ok: true, removed, count: (await library.list()).length })
          }
          return sendJson(res, 405, { ok: false, error: 'method not allowed' })
        } catch (error) {
          log.warn?.(`xiaoyuzhou-hot: library ${error?.message ?? error}`)
          return sendJson(res, 400, { ok: false, error: String(error?.message ?? error) })
        }
      },
    }),
  )

  /** 图片缓存:url -> { at, type, body } */
  const imageCache = new Map()

  disposers.push(
    ctx.webServer.register({
      kind: 'exact',
      path: '/x-hot/img',
      handler: async (req, res) => {
        if (req.method !== 'GET') {
          res.writeHead(405, { 'content-type': 'text/plain; charset=utf-8' })
          return res.end('method not allowed')
        }
        const url = new URL(req.url ?? '/x-hot/img', 'http://localhost')
        const target = url.searchParams.get('url') ?? ''
        if (!isAllowedImageUrl(target)) {
          res.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' })
          return res.end('unsupported image url')
        }

        const hit = imageCache.get(target)
        if (hit && Date.now() - hit.at < IMAGE_TTL_MS) {
          res.writeHead(200, {
            'content-type': hit.type,
            'cache-control': 'public, max-age=86400',
            'content-length': hit.body.length,
          })
          return res.end(hit.body)
        }

        try {
          const upstream = await fetch(target, {
            headers: { 'user-agent': UA, accept: 'image/*' },
            signal: AbortSignal.timeout(TIMEOUT_MS),
            redirect: 'follow',
          })
          if (!upstream.ok) throw new Error(`HTTP ${upstream.status}`)
          const type = upstream.headers.get('content-type') ?? ''
          if (!type.startsWith('image/')) throw new Error(`不是图片: ${type || 'unknown'}`)
          const body = Buffer.from(await upstream.arrayBuffer())
          if (body.length > IMAGE_MAX_BYTES) throw new Error('图片太大')
          imageCache.set(target, { at: Date.now(), type, body })
          while (imageCache.size > IMAGE_MAX_ENTRIES) imageCache.delete(imageCache.keys().next().value)
          res.writeHead(200, {
            'content-type': type,
            'cache-control': 'public, max-age=86400',
            'content-length': body.length,
          })
          return res.end(body)
        } catch (error) {
          log.warn?.(`xiaoyuzhou-hot: 图片反代失败 ${target} (${error?.message ?? error})`)
          res.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' })
          return res.end('image fetch failed')
        }
      },
    }),
  )

  disposers.push(
    ctx.webServer.register({
      kind: 'exact',
      path: '/x-hot/search',
      handler: async (req, res) => {
        if (req.method !== 'GET') return sendJson(res, 405, { ok: false, error: 'method not allowed' })
        try {
          const url = new URL(req.url ?? '/x-hot/search', 'http://localhost')
          const query = (url.searchParams.get('q') ?? '').trim()
          if (!query) return sendJson(res, 400, { ok: false, error: 'q 不能为空' })
          const limit = clampInt(url.searchParams.get('limit'), 20, 1, 50)
          const data = await searchPodcasts(query, limit)
          return sendJson(res, 200, { ok: true, query, ...data })
        } catch (error) {
          log.warn?.(`xiaoyuzhou-hot: search ${error?.message ?? error}`)
          return sendJson(res, 502, { ok: false, error: String(error?.message ?? error) })
        }
      },
    }),
  )

  disposers.push(
    ctx.webServer.register({
      kind: 'exact',
      path: '/x-hot/resolve',
      handler: async (req, res) => {
        if (req.method !== 'GET') return sendJson(res, 405, { ok: false, error: 'method not allowed' })
        try {
          const url = new URL(req.url ?? '/x-hot/resolve', 'http://localhost')
          const podcast = await resolvePodcast(url.searchParams.get('url') ?? '')
          return sendJson(res, 200, { ok: true, podcast })
        } catch (error) {
          log.warn?.(`xiaoyuzhou-hot: resolve ${error?.message ?? error}`)
          return sendJson(res, 400, { ok: false, error: String(error?.message ?? error) })
        }
      },
    }),
  )

  disposers.push(
    ctx.webServer.register({
      kind: 'exact',
      path: '/x-hot/favorites',
      handler: async (req, res) => {
        const url = new URL(req.url ?? '/x-hot/favorites', 'http://localhost')
        try {
          if (req.method === 'GET') {
            const items = await favorites.list()
            return sendJson(res, 200, { ok: true, items, count: items.length })
          }
          if (req.method === 'POST') {
            const body = await readJsonBody(req)
            if (!String(body?.key ?? '').trim()) return sendJson(res, 400, { ok: false, error: 'key 不能为空' })
            const item = await favorites.mark(body)
            return sendJson(res, 200, { ok: true, item, count: (await favorites.list()).length })
          }
          if (req.method === 'DELETE') {
            const key = url.searchParams.get('id') ?? url.searchParams.get('key') ?? ''
            const removed = await favorites.unmark(key)
            return sendJson(res, 200, { ok: true, removed, count: (await favorites.list()).length })
          }
          return sendJson(res, 405, { ok: false, error: 'method not allowed' })
        } catch (error) {
          log.warn?.(`xiaoyuzhou-hot: favorites ${error?.message ?? error}`)
          return sendJson(res, 400, { ok: false, error: String(error?.message ?? error) })
        }
      },
    }),
  )

  disposers.push(
    ctx.webServer.register({
      kind: 'exact',
      path: '/x-hot/favorites/rebuild',
      handler: async (req, res) => {
        if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'method not allowed' })
        try {
          const result = await rebuildFavoritesFromSessions(favorites, log, { resolvePodcast, searchPodcasts })
          const items = await favorites.list()
          return sendJson(res, 200, { ok: true, ...result, items })
        } catch (error) {
          log.warn?.(`xiaoyuzhou-hot: rebuild favorites ${error?.stack ?? error}`)
          return sendJson(res, 500, { ok: false, error: String(error?.message ?? error) })
        }
      },
    }),
  )

  disposers.push(
    ctx.webServer.register({
      kind: 'exact',
      path: '/x-hot/library/check',
      handler: async (req, res) => {
        if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'method not allowed' })
        try {
          const body = await readJsonBody(req)
          const key = String(body?.key ?? '').trim()
          if (!key) return sendJson(res, 400, { ok: false, error: 'key 不能为空' })

          let text = typeof body?.text === 'string' ? body.text : ''
          let title = ''
          if (!text) {
            const item = (await library.list()).find((row) => row.key === key)
            if (!item) return sendJson(res, 404, { ok: false, error: '记录不存在' })
            title = item.title ?? ''
            if (!item.sessionId) return sendJson(res, 400, { ok: false, error: '这条记录没有关联会话,无法取正文' })
            const found = (await listSessionFiles(SESSION_ROOT, SESSION_SCAN_LIMIT)).find(
              (entry) => entry.sessionId === item.sessionId,
            )
            if (!found) return sendJson(res, 404, { ok: false, error: `找不到会话文件:${item.sessionId}` })
            text = lastAssistantText(decodeSessionFile(await readFile(found.file)))
            if (!text) return sendJson(res, 422, { ok: false, error: '会话里没有可检查的正文' })
          }

          const result = checkSummary(text)
          return sendJson(res, 200, { ok: true, key, title, ...result })
        } catch (error) {
          log.warn?.(`xiaoyuzhou-hot: check ${error?.stack ?? error}`)
          return sendJson(res, 500, { ok: false, error: String(error?.message ?? error) })
        }
      },
    }),
  )

  disposers.push(
    ctx.webServer.register({
      kind: 'exact',
      path: '/x-hot/library/relink',
      handler: async (req, res) => {
        if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'method not allowed' })
        try {
          const result = await relinkSessions(library, log)
          const items = await library.list()
          return sendJson(res, 200, { ok: true, ...result, items })
        } catch (error) {
          log.warn?.(`xiaoyuzhou-hot: relink ${error?.stack ?? error}`)
          return sendJson(res, 500, { ok: false, error: String(error?.message ?? error) })
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

  // 退出/热重载前把待写记录落盘(debounce 窗口内的改动不丢)
  ctx.effect?.(() => () => {
    library.flushNow().catch(() => {})
    favorites.flushNow().catch(() => {})
  }, 'xiaoyuzhou-hot: flush library on dispose')

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

  log.info?.(
    'xiaoyuzhou-hot: routes /x-hot/list, /x-hot/channel, /x-hot/search, /x-hot/resolve, /x-hot/img, /x-hot/library(+relink), /x-hot/favorites, /x-hot/health registered',
  )
}
