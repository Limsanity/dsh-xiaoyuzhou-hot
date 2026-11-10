// src/host/index.js
import { copyFile, mkdir, readdir, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, join } from "node:path";
import { zstdDecompressSync } from "node:zlib";
var name = "xiaoyuzhou-hot";
var inject = ["webServer"];
var UPSTREAM = "https://xyzrank.com/api";
var XIAOYUZHOU = "https://www.xiaoyuzhoufm.com";
var ITUNES = "https://itunes.apple.com/lookup";
var ITUNES_SEARCH = "https://itunes.apple.com/search";
var KINDS = {
  podcasts: "podcasts",
  new: "new-podcasts",
  episodes: "episodes",
  "new-episodes": "new-episodes"
};
var TTL_MS = 5 * 60 * 1e3;
var FEED_TTL_MS = 10 * 60 * 1e3;
var LOOKUP_TTL_MS = 24 * 60 * 60 * 1e3;
var TIMEOUT_MS = 2e4;
var MAX_EPISODES = 300;
var MAX_LIBRARY = 2e3;
var LIBRARY_DIR = process.env.XZR_DATA_DIR || join(process.env.DSH_HOME || join(homedir(), ".dsh"), "xiaoyuzhou-hot");
var LIBRARY_FILE = join(LIBRARY_DIR, "library.json");
var FAVORITES_FILE = join(LIBRARY_DIR, "favorites.json");
var DEFAULT_ITEM_FIELDS = [
  ["title", 300],
  ["podcast", 200],
  ["url", 600],
  ["podcastUrl", 600],
  ["sessionId", 100]
];
var FAVORITE_ITEM_FIELDS = [
  ["title", 300],
  ["author", 200],
  ["genre", 100],
  ["url", 600],
  ["appleId", 40],
  ["logo", 600]
];
var SESSION_ROOT = join(process.env.DSH_HOME || join(homedir(), ".dsh"), "sessions");
var SESSION_SCAN_LIMIT = 400;
var IMAGE_HOST_SUFFIXES = ["xyzcdn.net", "mzstatic.com", "xmcdn.com", "xiaoyuzhoufm.com"];
var IMAGE_TTL_MS = 24 * 60 * 60 * 1e3;
var IMAGE_MAX_BYTES = 6 * 1024 * 1024;
var IMAGE_MAX_ENTRIES = 120;
var UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36";
function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "content-length": Buffer.byteLength(payload)
  });
  res.end(payload);
}
function clampInt(value, fallback, min, max) {
  const n = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}
async function fetchText(url, timeoutMs = TIMEOUT_MS) {
  const res = await fetch(url, {
    headers: { "user-agent": UA, accept: "*/*" },
    signal: AbortSignal.timeout(timeoutMs),
    redirect: "follow"
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}
function isAllowedImageUrl(raw) {
  let url;
  try {
    url = new URL(String(raw ?? ""));
  } catch {
    return false;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return false;
  return IMAGE_HOST_SUFFIXES.some((suffix) => url.hostname === suffix || url.hostname.endsWith(`.${suffix}`));
}
function xyzLink(item) {
  return Array.isArray(item?.links) ? item.links.find((l) => l?.name === "xyz")?.url ?? "" : "";
}
function appleIdOf(item) {
  const url = Array.isArray(item?.links) ? item.links.find((l) => l?.name === "apple")?.url ?? "" : "";
  return /\/id(\d+)/.exec(url)?.[1] ?? "";
}
function normalizePodcast(item) {
  return {
    rank: item?.rank ?? 0,
    title: item?.name ?? "",
    author: item?.authorsText ?? "",
    genre: item?.primaryGenreName ?? "",
    episodes: item?.trackCount ?? 0,
    avgPlay: item?.avgPlayCount ?? 0,
    openRate: item?.avgOpenRate ?? 0,
    comments: item?.avgCommentCount ?? 0,
    url: xyzLink(item),
    appleId: appleIdOf(item),
    logo: item?.logoURL ?? ""
  };
}
function normalizeEpisode(item) {
  return {
    rank: item?.rank ?? 0,
    title: item?.title ?? "",
    author: item?.podcastName ?? "",
    genre: item?.primaryGenreName ?? "",
    avgPlay: item?.playCount ?? 0,
    openRate: item?.openRate ?? 0,
    comments: item?.commentCount ?? 0,
    url: item?.link ?? "",
    logo: item?.logoURL ?? ""
  };
}
function decodeEntities(text) {
  return String(text).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, " ").replace(/&#(\d+);/g, (_m, code) => String.fromCodePoint(Number(code))).replace(/&amp;/g, "&").trim();
}
function tagValue(block, tag) {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "i");
  const m = re.exec(block);
  return m ? decodeEntities(m[1]) : "";
}
function parseDuration(raw) {
  const text = String(raw ?? "").trim();
  if (!text) return 0;
  if (/^\d+$/.test(text)) return Number(text);
  const parts = text.split(":").map((n) => Number.parseInt(n, 10)).filter(Number.isFinite);
  if (parts.length === 0) return 0;
  return parts.reduce((acc, part) => acc * 60 + part, 0);
}
function parseFeed(xml, limit) {
  const channelTitle = tagValue(xml.slice(0, Math.max(0, xml.indexOf("<item"))), "title");
  const blocks = xml.match(/<item\b[\s\S]*?<\/item>/gi) ?? [];
  const episodes = [];
  for (const block of blocks) {
    if (episodes.length >= limit) break;
    const link = tagValue(block, "link").replace(/\?utm_source=rss$/, "");
    const guid = tagValue(block, "guid") || link.split("/").pop();
    const title = tagValue(block, "title");
    if (!title) continue;
    const enclosure = /<enclosure\b[^>]*\burl="([^"]+)"/i.exec(block)?.[1] ?? "";
    episodes.push({
      id: guid,
      title,
      url: link,
      audioUrl: enclosure,
      pubDate: tagValue(block, "pubDate") || tagValue(block, "pubdate"),
      duration: parseDuration(tagValue(block, "itunes:duration") || tagValue(block, "duration"))
    });
  }
  return { channelTitle, episodes };
}
function parseSsrEpisodes(html, limit) {
  const m = /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/.exec(html);
  if (!m) throw new Error("\u6CA1\u6709\u627E\u5230 __NEXT_DATA__(\u5C0F\u5B87\u5B99\u9875\u9762\u7ED3\u6784\u53EF\u80FD\u53D8\u4E86)");
  const data = JSON.parse(m[1]);
  const podcast = data?.props?.pageProps?.podcast;
  if (!podcast) throw new Error("\u9875\u9762\u91CC\u6CA1\u6709 podcast \u6570\u636E");
  const episodes = (podcast.episodes ?? []).slice(0, limit).map((ep) => ({
    id: ep.eid,
    title: ep.title ?? "",
    url: ep.eid ? `${XIAOYUZHOU}/episode/${ep.eid}` : "",
    audioUrl: (ep.enclosure?.url ?? "").replace(/^http:\/\//, "https://"),
    pubDate: ep.pubDate ?? "",
    duration: Number(ep.duration ?? 0)
  }));
  return {
    channelTitle: podcast.title ?? "",
    total: podcast.episodeCount ?? episodes.length,
    episodes
  };
}
function readJsonBody(req, limitBytes = 64 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > limitBytes) {
        reject(new Error("body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {});
      } catch (error) {
        reject(new Error(`invalid JSON: ${error.message}`));
      }
    });
    req.on("error", reject);
  });
}
var Library = class {
  constructor(path, log, fields = DEFAULT_ITEM_FIELDS) {
    this.path = path;
    this.fields = fields;
    this.backupPath = `${path}.bak`;
    this.snapshotDir = join(dirname(path), "backups");
    this.snapshotPrefix = `${basename(path, ".json")}-`;
    this.snapshotKeep = 14;
    this.log = log;
    this.items = /* @__PURE__ */ new Map();
    this.loaded = false;
    this.loadFailed = false;
    this.loading = void 0;
    this.timer = void 0;
    this.pending = void 0;
  }
  async load() {
    if (this.loaded) return this.items;
    if (this.loading === void 0) {
      this.loading = (async () => {
        let found = await this.readFirst([this.path, this.backupPath]);
        if (!found) found = await this.readNewestSnapshot();
        if (found) {
          try {
            const parsed = JSON.parse(found.raw);
            const list = Array.isArray(parsed?.items) ? parsed.items : [];
            for (const item of list) {
              if (item && typeof item.key === "string") this.items.set(item.key, item);
            }
            if (found.path === this.backupPath) {
              this.log?.warn?.("xiaoyuzhou-hot: \u4E3B\u8BB0\u5F55\u6587\u4EF6\u4E0D\u53EF\u7528,\u5DF2\u4ECE library.json.bak \u6062\u590D");
            }
          } catch (error) {
            this.loadFailed = true;
            this.log?.warn?.(`xiaoyuzhou-hot: library \u89E3\u6790\u5931\u8D25,\u672C\u6B21\u4E0D\u5199\u76D8 (${error?.message ?? error})`);
          }
        }
        this.loaded = true;
        return this.items;
      })().finally(() => {
        this.loading = void 0;
      });
    }
    return this.loading;
  }
  /** 从 backups/ 里挑该 store 的最新快照 */
  async readNewestSnapshot() {
    let names = [];
    try {
      names = await readdir(this.snapshotDir);
    } catch {
      return void 0;
    }
    const candidates = names.filter((name2) => name2.startsWith(this.snapshotPrefix) && name2.endsWith(".json")).sort().reverse();
    for (const name2 of candidates) {
      try {
        return { path: join(this.snapshotDir, name2), raw: await readFile(join(this.snapshotDir, name2), "utf8") };
      } catch {
        continue;
      }
    }
    return void 0;
  }
  /** 每天第一次写之前,把当前文件复制成带日期的快照 */
  async writeDailySnapshot() {
    const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
    const target = join(this.snapshotDir, `${this.snapshotPrefix}${today}.json`);
    try {
      await stat(target);
      return;
    } catch {
    }
    try {
      await mkdir(this.snapshotDir, { recursive: true });
      await copyFile(this.path, target);
    } catch (error) {
      if (error?.code !== "ENOENT") {
        this.log?.warn?.(`xiaoyuzhou-hot: \u5FEB\u7167\u5931\u8D25 (${error?.message ?? error})`);
      }
    }
  }
  /** 只保留最近 N 份快照 */
  async pruneSnapshots() {
    let names = [];
    try {
      names = await readdir(this.snapshotDir);
    } catch {
      return;
    }
    const mine = names.filter((name2) => name2.startsWith(this.snapshotPrefix) && name2.endsWith(".json")).sort().reverse();
    for (const name2 of mine.slice(this.snapshotKeep)) {
      try {
        await unlink(join(this.snapshotDir, name2));
      } catch {
      }
    }
  }
  async readFirst(paths) {
    for (const path of paths) {
      try {
        return { path, raw: await readFile(path, "utf8") };
      } catch (error) {
        if (error?.code !== "ENOENT") throw error;
      }
    }
    return void 0;
  }
  async list() {
    await this.load();
    return [...this.items.values()].sort((a, b) => (b.at ?? 0) - (a.at ?? 0));
  }
  async mark(input) {
    await this.load();
    const key = String(input?.key ?? "").slice(0, 400);
    if (!key) throw new Error("key \u4E0D\u80FD\u4E3A\u7A7A");
    const existing = this.items.get(key) ?? {};
    const item = { ...existing, key };
    for (const [field, max] of this.fields) {
      const value = input?.[field];
      if (typeof value === "string") item[field] = value.slice(0, max);
    }
    item.at = Number.isFinite(input?.at) ? input.at : existing.at ?? Date.now();
    this.items.delete(key);
    this.items.set(key, item);
    while (this.items.size > MAX_LIBRARY) this.items.delete(this.items.keys().next().value);
    await this.flush();
    return item;
  }
  async unmark(key) {
    await this.load();
    const removed = this.items.delete(String(key ?? ""));
    if (removed) await this.flush();
    return removed;
  }
  /**
   * 合并短时间内的多次写入:共用一个 150ms 窗口,窗口内所有调用等同一个 promise,
   * 不会出现"后一次 clearTimeout 把前一次的 promise 永远挂住"的情况。
   */
  flush() {
    if (this.pending) return this.pending;
    this.pending = (async () => {
      await new Promise((resolve) => {
        this.timer = setTimeout(resolve, 150);
      });
      this.timer = void 0;
      this.pending = void 0;
      await this.write();
    })();
    return this.pending;
  }
  /** 卸载/退出前立即落盘,不等窗口 */
  async flushNow() {
    if (!this.loaded) await this.load();
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = void 0;
    }
    this.pending = void 0;
    await this.write();
  }
  async write() {
    if (!this.loaded) await this.load();
    if (this.loadFailed) {
      this.log?.warn?.("xiaoyuzhou-hot: \u4E0A\u6B21\u8BFB\u53D6\u5931\u8D25,\u8DF3\u8FC7\u5199\u76D8\u4EE5\u514D\u8986\u76D6");
      return;
    }
    try {
      await mkdir(dirname(this.path), { recursive: true });
      await this.writeDailySnapshot();
      const payload = JSON.stringify({ version: 1, items: [...this.items.values()] }, null, 2);
      const tmp = `${this.path}.tmp`;
      await writeFile(tmp, payload, "utf8");
      try {
        await copyFile(this.path, this.backupPath);
      } catch (error) {
        if (error?.code !== "ENOENT") throw error;
      }
      await rename(tmp, this.path);
      await this.pruneSnapshots();
    } catch (error) {
      this.log?.warn?.(`xiaoyuzhou-hot: library \u5199\u5165\u5931\u8D25 (${error?.message ?? error})`);
    }
  }
};
var ZSTD_MAGIC = [40, 181, 47, 253];
function decodeSessionFile(buffer) {
  const starts = [0];
  for (let i = 4; i < buffer.length - 3; i += 1) {
    if (buffer[i] === ZSTD_MAGIC[0] && buffer[i + 1] === ZSTD_MAGIC[1] && buffer[i + 2] === ZSTD_MAGIC[2] && buffer[i + 3] === ZSTD_MAGIC[3]) {
      starts.push(i);
    }
  }
  let text = "";
  for (let k = 0; k < starts.length; k += 1) {
    const end = k + 1 < starts.length ? starts[k + 1] : buffer.length;
    try {
      text += zstdDecompressSync(buffer.subarray(starts[k], end)).toString("utf8");
    } catch {
    }
  }
  return text;
}
function summaryPromptOf(text) {
  for (const line of text.split("\n")) {
    if (!line.includes('"user/message"')) continue;
    let event;
    try {
      event = JSON.parse(line);
    } catch {
      continue;
    }
    for (const part of event?.data?.content ?? []) {
      const value = part?.text;
      if (typeof value !== "string" || !value.startsWith("\u603B\u7ED3\u300A")) continue;
      const match = /^总结《(.+?)》([^\n]+)/.exec(value);
      if (match) {
        const url = /^单集页：(.+)$/m.exec(value)?.[1]?.trim() ?? "";
        return { podcast: match[1].trim(), title: match[2].trim(), url };
      }
    }
  }
  return void 0;
}
var normalizeTitle = (value) => String(value ?? "").replace(/\s+/g, "");
async function listSessionFiles(root, limit) {
  const files = [];
  let workspaces = [];
  try {
    workspaces = await readdir(root);
  } catch {
    return files;
  }
  for (const workspace of workspaces) {
    const dir = join(root, workspace);
    let entries = [];
    try {
      if (!(await stat(dir)).isDirectory()) continue;
      entries = await readdir(dir);
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.startsWith("session-")) continue;
      const file = join(dir, entry, "session.v4.jsonl.zstd");
      try {
        if (!(await stat(file)).isFile()) continue;
      } catch {
        continue;
      }
      files.push({ sessionId: entry, file });
      if (files.length >= limit) return files;
    }
  }
  return files;
}
async function relinkSessions(library, log) {
  const items = await library.list();
  const byTitle = new Map(items.filter((item) => item?.title).map((item) => [normalizeTitle(item.title), item]));
  let scanned = 0;
  let matched = 0;
  let linked = 0;
  for (const { sessionId, file } of await listSessionFiles(SESSION_ROOT, SESSION_SCAN_LIMIT)) {
    let prompt;
    try {
      prompt = summaryPromptOf(decodeSessionFile(await readFile(file)));
    } catch (error) {
      log?.warn?.(`xiaoyuzhou-hot: \u8BFB\u53D6\u4F1A\u8BDD\u5931\u8D25 ${file} (${error?.message ?? error})`);
      continue;
    }
    if (!prompt) continue;
    scanned += 1;
    const item = byTitle.get(normalizeTitle(prompt.title));
    if (!item) continue;
    matched += 1;
    if (item.sessionId === sessionId) continue;
    await library.mark({ key: item.key, sessionId });
    linked += 1;
  }
  return { scanned, matched, linked };
}
async function rebuildFavoritesFromSessions(favorites, log, { resolvePodcast, searchPodcasts }) {
  const files = await listSessionFiles(SESSION_ROOT, SESSION_SCAN_LIMIT);
  const latest = /* @__PURE__ */ new Map();
  for (const { file } of files) {
    let prompt;
    let fileStat;
    try {
      fileStat = await stat(file);
      prompt = summaryPromptOf(decodeSessionFile(await readFile(file)));
    } catch (error) {
      log?.warn?.(`xiaoyuzhou-hot: \u8BFB\u4F1A\u8BDD\u5931\u8D25 ${file} (${error?.message ?? error})`);
      continue;
    }
    if (!prompt?.podcast) continue;
    const key = normalizeTitle(prompt.podcast);
    const prev = latest.get(key);
    const at = fileStat?.mtimeMs ?? Date.now();
    if (!prev || prev.at < at) latest.set(key, { podcast: prompt.podcast, url: prompt.url, at });
  }
  const existing = new Set((await favorites.list()).map((item) => item.key));
  const skipped = [];
  let added = 0;
  for (const entry of latest.values()) {
    let favorite;
    try {
      if (/xiaoyuzhoufm\.com\/episode\//i.test(entry.url)) {
        const pod = await resolvePodcast(entry.url);
        if (!pod.pid) throw new Error("\u6CA1\u89E3\u6790\u51FA pid");
        favorite = {
          key: pod.pid,
          title: pod.title || entry.podcast,
          author: pod.author,
          url: pod.url,
          logo: pod.logo,
          at: entry.at
        };
      } else {
        const found = await searchPodcasts(entry.podcast, 8);
        const exact = found.items.find((item) => normalizeTitle(item.title) === normalizeTitle(entry.podcast));
        const hit = exact ?? found.items[0];
        if (!hit?.appleId) throw new Error("Apple \u76EE\u5F55\u91CC\u6CA1\u627E\u5230");
        favorite = {
          key: `apple:${hit.appleId}`,
          title: hit.title || entry.podcast,
          author: hit.author,
          genre: hit.genre,
          appleId: hit.appleId,
          logo: hit.logo,
          at: entry.at
        };
      }
    } catch (error) {
      skipped.push({ podcast: entry.podcast, reason: String(error?.message ?? error) });
      continue;
    }
    if (existing.has(favorite.key)) {
      skipped.push({ podcast: entry.podcast, reason: "\u5DF2\u7ECF\u6536\u85CF\u8FC7" });
      continue;
    }
    await favorites.mark(favorite);
    existing.add(favorite.key);
    added += 1;
  }
  return { scanned: latest.size, added, skipped };
}
function apply(ctx, config = {}) {
  const cache = /* @__PURE__ */ new Map();
  const inflight = /* @__PURE__ */ new Map();
  const log = ctx.logger ?? console;
  const library = new Library(LIBRARY_FILE, log);
  const favorites = new Library(FAVORITES_FILE, log, FAVORITE_ITEM_FIELDS);
  function cached(key, ttl, producer) {
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < ttl) return Promise.resolve({ ...hit.data, cached: true, fetchedAt: hit.at });
    const pending = inflight.get(key);
    if (pending) return pending;
    const task = producer().then((data) => {
      cache.set(key, { at: Date.now(), data });
      if (cache.size > 64) cache.delete(cache.keys().next().value);
      return { ...data, cached: false, fetchedAt: Date.now() };
    }).catch((error) => {
      if (hit) {
        log.warn?.(`xiaoyuzhou-hot: upstream failed, serving stale (${error?.message ?? error})`);
        return { ...hit.data, cached: true, stale: true, fetchedAt: hit.at };
      }
      throw error;
    }).finally(() => inflight.delete(key));
    inflight.set(key, task);
    return task;
  }
  async function fetchUpstream(kind, limit, offset) {
    const api = KINDS[kind];
    const url = `${UPSTREAM}/${api}?limit=${limit}&offset=${offset}`;
    const res = await fetch(url, {
      headers: { "user-agent": UA, accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS)
    });
    if (!res.ok) throw new Error(`xyzrank ${res.status} ${res.statusText}`);
    const data = await res.json();
    const items = Array.isArray(data?.items) ? data.items : [];
    const isEpisode = api.includes("episode");
    return {
      items: items.map(isEpisode ? normalizeEpisode : normalizePodcast),
      total: Number(data?.total ?? items.length),
      limit: Number(data?.limit ?? limit),
      offset: Number(data?.offset ?? offset)
    };
  }
  async function feedUrlOf(appleId) {
    return cached(`lookup:${appleId}`, LOOKUP_TTL_MS, async () => {
      const json = await fetch(`${ITUNES}?id=${encodeURIComponent(appleId)}&entity=podcast`, {
        headers: { "user-agent": UA, accept: "application/json" },
        signal: AbortSignal.timeout(TIMEOUT_MS)
      }).then((r) => r.ok ? r.json() : null);
      const feedUrl = json?.results?.[0]?.feedUrl ?? "";
      if (!feedUrl) throw new Error(`iTunes lookup \u6CA1\u6709\u8FD4\u56DE feedUrl (id=${appleId})`);
      return { feedUrl };
    });
  }
  async function loadChannel(podcastId, appleId, limit) {
    if (appleId) {
      try {
        const { feedUrl } = await feedUrlOf(appleId);
        const feed = await cached(`feed:${feedUrl}`, FEED_TTL_MS, async () => {
          const xml = await fetchText(feedUrl, 3e4);
          const parsed = parseFeed(xml, MAX_EPISODES);
          if (parsed.episodes.length === 0) throw new Error("RSS \u91CC\u6CA1\u6709\u89E3\u6790\u5230\u5355\u96C6");
          return { source: "rss", feedUrl, title: parsed.channelTitle, episodes: parsed.episodes };
        });
        return { ...feed, episodes: feed.episodes.slice(0, limit) };
      } catch (error) {
        log.warn?.(`xiaoyuzhou-hot: RSS \u62FF\u4E0D\u5230,\u56DE\u9000\u5230 SSR (${error?.message ?? error})`);
      }
    }
    if (!podcastId) throw new Error("\u9700\u8981 id \u6216 apple \u53C2\u6570");
    return cached(`ssr:${podcastId}`, TTL_MS, async () => {
      const html = await fetchText(`${XIAOYUZHOU}/podcast/${podcastId}`);
      const parsed = parseSsrEpisodes(html, limit);
      return { source: "ssr", title: parsed.channelTitle, total: parsed.total, episodes: parsed.episodes };
    });
  }
  function parseNextData(html) {
    const match = /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/.exec(html);
    if (!match) throw new Error("\u9875\u9762\u91CC\u6CA1\u6709 __NEXT_DATA__(\u7ED3\u6784\u53EF\u80FD\u53D8\u4E86)");
    return JSON.parse(match[1]);
  }
  function normalizeSsrPodcast(podcast) {
    const pid = podcast?.pid ?? "";
    return {
      pid,
      title: podcast?.title ?? "",
      author: podcast?.author ?? "",
      episodes: podcast?.episodeCount ?? 0,
      logo: podcast?.image?.picUrl ?? podcast?.image?.smallPicUrl ?? "",
      url: pid ? `${XIAOYUZHOU}/podcast/${pid}` : ""
    };
  }
  async function resolvePodcast(input) {
    const text = String(input ?? "").trim();
    if (!text) throw new Error("\u7F3A\u5C11\u94FE\u63A5\u6216 id");
    const hex = /([0-9a-f]{24})/i.exec(text)?.[1] ?? "";
    if (/\/episode\//i.test(text)) {
      const eid = hex || text.split("?")[0].replace(/\/+$/, "").split("/").pop();
      if (!eid) throw new Error("\u8BA4\u4E0D\u51FA\u5355\u96C6 id");
      const data2 = parseNextData(await fetchText(`${XIAOYUZHOU}/episode/${eid}`));
      const podcast2 = data2?.props?.pageProps?.episode?.podcast;
      if (!podcast2) throw new Error("\u5355\u96C6\u9875\u91CC\u6CA1\u6709\u64AD\u5BA2\u4FE1\u606F");
      return normalizeSsrPodcast(podcast2);
    }
    if (!hex) throw new Error("\u8BA4\u4E0D\u51FA\u8FD9\u662F\u5C0F\u5B87\u5B99\u7684\u64AD\u5BA2/\u5355\u96C6\u94FE\u63A5(\u9700\u8981 24 \u4F4D id)");
    const data = parseNextData(await fetchText(`${XIAOYUZHOU}/podcast/${hex}`));
    const podcast = data?.props?.pageProps?.podcast;
    if (!podcast) throw new Error("\u64AD\u5BA2\u9875\u91CC\u6CA1\u6709\u64AD\u5BA2\u4FE1\u606F");
    return normalizeSsrPodcast(podcast);
  }
  async function searchPodcasts(query, limit) {
    return cached(`search:${query}:${limit}`, TTL_MS, async () => {
      const url = `${ITUNES_SEARCH}?term=${encodeURIComponent(query)}&entity=podcast&country=CN&limit=${limit}`;
      const res = await fetch(url, {
        headers: { "user-agent": UA, accept: "application/json" },
        signal: AbortSignal.timeout(TIMEOUT_MS)
      });
      if (!res.ok) throw new Error(`iTunes search ${res.status}`);
      const data = await res.json();
      const items = (data?.results ?? []).map((r) => ({
        appleId: String(r.collectionId ?? ""),
        title: r.collectionName ?? "",
        author: r.artistName ?? "",
        genre: r.primaryGenreName ?? "",
        episodes: r.trackCount ?? 0,
        logo: r.artworkUrl600 ?? r.artworkUrl100 ?? "",
        feedUrl: r.feedUrl ?? ""
      }));
      return { items: items.filter((item) => item.title) };
    });
  }
  const disposers = [];
  disposers.push(
    ctx.webServer.register({
      kind: "exact",
      path: "/x-hot/list",
      handler: async (req, res) => {
        if (req.method !== "GET") return sendJson(res, 405, { ok: false, error: "method not allowed" });
        try {
          const url = new URL(req.url ?? "/x-hot/list", "http://localhost");
          const kind = KINDS[url.searchParams.get("kind")] ? url.searchParams.get("kind") : "podcasts";
          const limit = clampInt(url.searchParams.get("limit"), 50, 1, 100);
          const offset = clampInt(url.searchParams.get("offset"), 0, 0, 1e5);
          const data = await cached(`list:${kind}:${limit}:${offset}`, TTL_MS, () => fetchUpstream(kind, limit, offset));
          return sendJson(res, 200, { ok: true, kind, ...data });
        } catch (error) {
          log.warn?.(`xiaoyuzhou-hot: ${error?.stack ?? error}`);
          return sendJson(res, 502, { ok: false, error: String(error?.message ?? error) });
        }
      }
    })
  );
  disposers.push(
    ctx.webServer.register({
      kind: "exact",
      path: "/x-hot/channel",
      handler: async (req, res) => {
        if (req.method !== "GET") return sendJson(res, 405, { ok: false, error: "method not allowed" });
        try {
          const url = new URL(req.url ?? "/x-hot/channel", "http://localhost");
          const id = (url.searchParams.get("id") ?? "").trim();
          const apple = (url.searchParams.get("apple") ?? "").trim();
          const limit = clampInt(url.searchParams.get("limit"), MAX_EPISODES, 1, MAX_EPISODES);
          if (!/^[0-9a-f]{24}$/i.test(id) && !/^\d+$/.test(apple)) {
            return sendJson(res, 400, { ok: false, error: "id \u5FC5\u987B\u662F 24 \u4F4D\u5C0F\u5B87\u5B99\u64AD\u5BA2 id,apple \u5FC5\u987B\u662F\u6570\u5B57 id" });
          }
          const data = await loadChannel(id, apple, limit);
          return sendJson(res, 200, { ok: true, ...data });
        } catch (error) {
          log.warn?.(`xiaoyuzhou-hot: channel ${error?.stack ?? error}`);
          return sendJson(res, 502, { ok: false, error: String(error?.message ?? error) });
        }
      }
    })
  );
  disposers.push(
    ctx.webServer.register({
      kind: "exact",
      path: "/x-hot/library",
      handler: async (req, res) => {
        const url = new URL(req.url ?? "/x-hot/library", "http://localhost");
        try {
          if (req.method === "GET") {
            const items = await library.list();
            return sendJson(res, 200, { ok: true, items, count: items.length });
          }
          if (req.method === "POST") {
            const body = await readJsonBody(req);
            const item = await library.mark(body);
            return sendJson(res, 200, { ok: true, item, count: (await library.list()).length });
          }
          if (req.method === "DELETE") {
            const key = url.searchParams.get("key") ?? "";
            const removed = await library.unmark(key);
            return sendJson(res, 200, { ok: true, removed, count: (await library.list()).length });
          }
          return sendJson(res, 405, { ok: false, error: "method not allowed" });
        } catch (error) {
          log.warn?.(`xiaoyuzhou-hot: library ${error?.message ?? error}`);
          return sendJson(res, 400, { ok: false, error: String(error?.message ?? error) });
        }
      }
    })
  );
  const imageCache = /* @__PURE__ */ new Map();
  disposers.push(
    ctx.webServer.register({
      kind: "exact",
      path: "/x-hot/img",
      handler: async (req, res) => {
        if (req.method !== "GET") {
          res.writeHead(405, { "content-type": "text/plain; charset=utf-8" });
          return res.end("method not allowed");
        }
        const url = new URL(req.url ?? "/x-hot/img", "http://localhost");
        const target = url.searchParams.get("url") ?? "";
        if (!isAllowedImageUrl(target)) {
          res.writeHead(400, { "content-type": "text/plain; charset=utf-8" });
          return res.end("unsupported image url");
        }
        const hit = imageCache.get(target);
        if (hit && Date.now() - hit.at < IMAGE_TTL_MS) {
          res.writeHead(200, {
            "content-type": hit.type,
            "cache-control": "public, max-age=86400",
            "content-length": hit.body.length
          });
          return res.end(hit.body);
        }
        try {
          const upstream = await fetch(target, {
            headers: { "user-agent": UA, accept: "image/*" },
            signal: AbortSignal.timeout(TIMEOUT_MS),
            redirect: "follow"
          });
          if (!upstream.ok) throw new Error(`HTTP ${upstream.status}`);
          const type = upstream.headers.get("content-type") ?? "";
          if (!type.startsWith("image/")) throw new Error(`\u4E0D\u662F\u56FE\u7247: ${type || "unknown"}`);
          const body = Buffer.from(await upstream.arrayBuffer());
          if (body.length > IMAGE_MAX_BYTES) throw new Error("\u56FE\u7247\u592A\u5927");
          imageCache.set(target, { at: Date.now(), type, body });
          while (imageCache.size > IMAGE_MAX_ENTRIES) imageCache.delete(imageCache.keys().next().value);
          res.writeHead(200, {
            "content-type": type,
            "cache-control": "public, max-age=86400",
            "content-length": body.length
          });
          return res.end(body);
        } catch (error) {
          log.warn?.(`xiaoyuzhou-hot: \u56FE\u7247\u53CD\u4EE3\u5931\u8D25 ${target} (${error?.message ?? error})`);
          res.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
          return res.end("image fetch failed");
        }
      }
    })
  );
  disposers.push(
    ctx.webServer.register({
      kind: "exact",
      path: "/x-hot/search",
      handler: async (req, res) => {
        if (req.method !== "GET") return sendJson(res, 405, { ok: false, error: "method not allowed" });
        try {
          const url = new URL(req.url ?? "/x-hot/search", "http://localhost");
          const query = (url.searchParams.get("q") ?? "").trim();
          if (!query) return sendJson(res, 400, { ok: false, error: "q \u4E0D\u80FD\u4E3A\u7A7A" });
          const limit = clampInt(url.searchParams.get("limit"), 20, 1, 50);
          const data = await searchPodcasts(query, limit);
          return sendJson(res, 200, { ok: true, query, ...data });
        } catch (error) {
          log.warn?.(`xiaoyuzhou-hot: search ${error?.message ?? error}`);
          return sendJson(res, 502, { ok: false, error: String(error?.message ?? error) });
        }
      }
    })
  );
  disposers.push(
    ctx.webServer.register({
      kind: "exact",
      path: "/x-hot/resolve",
      handler: async (req, res) => {
        if (req.method !== "GET") return sendJson(res, 405, { ok: false, error: "method not allowed" });
        try {
          const url = new URL(req.url ?? "/x-hot/resolve", "http://localhost");
          const podcast = await resolvePodcast(url.searchParams.get("url") ?? "");
          return sendJson(res, 200, { ok: true, podcast });
        } catch (error) {
          log.warn?.(`xiaoyuzhou-hot: resolve ${error?.message ?? error}`);
          return sendJson(res, 400, { ok: false, error: String(error?.message ?? error) });
        }
      }
    })
  );
  disposers.push(
    ctx.webServer.register({
      kind: "exact",
      path: "/x-hot/favorites",
      handler: async (req, res) => {
        const url = new URL(req.url ?? "/x-hot/favorites", "http://localhost");
        try {
          if (req.method === "GET") {
            const items = await favorites.list();
            return sendJson(res, 200, { ok: true, items, count: items.length });
          }
          if (req.method === "POST") {
            const body = await readJsonBody(req);
            if (!String(body?.key ?? "").trim()) return sendJson(res, 400, { ok: false, error: "key \u4E0D\u80FD\u4E3A\u7A7A" });
            const item = await favorites.mark(body);
            return sendJson(res, 200, { ok: true, item, count: (await favorites.list()).length });
          }
          if (req.method === "DELETE") {
            const key = url.searchParams.get("id") ?? url.searchParams.get("key") ?? "";
            const removed = await favorites.unmark(key);
            return sendJson(res, 200, { ok: true, removed, count: (await favorites.list()).length });
          }
          return sendJson(res, 405, { ok: false, error: "method not allowed" });
        } catch (error) {
          log.warn?.(`xiaoyuzhou-hot: favorites ${error?.message ?? error}`);
          return sendJson(res, 400, { ok: false, error: String(error?.message ?? error) });
        }
      }
    })
  );
  disposers.push(
    ctx.webServer.register({
      kind: "exact",
      path: "/x-hot/favorites/rebuild",
      handler: async (req, res) => {
        if (req.method !== "POST") return sendJson(res, 405, { ok: false, error: "method not allowed" });
        try {
          const result = await rebuildFavoritesFromSessions(favorites, log, { resolvePodcast, searchPodcasts });
          const items = await favorites.list();
          return sendJson(res, 200, { ok: true, ...result, items });
        } catch (error) {
          log.warn?.(`xiaoyuzhou-hot: rebuild favorites ${error?.stack ?? error}`);
          return sendJson(res, 500, { ok: false, error: String(error?.message ?? error) });
        }
      }
    })
  );
  disposers.push(
    ctx.webServer.register({
      kind: "exact",
      path: "/x-hot/library/relink",
      handler: async (req, res) => {
        if (req.method !== "POST") return sendJson(res, 405, { ok: false, error: "method not allowed" });
        try {
          const result = await relinkSessions(library, log);
          const items = await library.list();
          return sendJson(res, 200, { ok: true, ...result, items });
        } catch (error) {
          log.warn?.(`xiaoyuzhou-hot: relink ${error?.stack ?? error}`);
          return sendJson(res, 500, { ok: false, error: String(error?.message ?? error) });
        }
      }
    })
  );
  disposers.push(
    ctx.webServer.register({
      kind: "exact",
      path: "/x-hot/health",
      handler: (req, res) => sendJson(res, 200, { ok: true, plugin: "xiaoyuzhou-hot", upstream: UPSTREAM })
    })
  );
  ctx.effect?.(() => () => {
    library.flushNow().catch(() => {
    });
    favorites.flushNow().catch(() => {
    });
  }, "xiaoyuzhou-hot: flush library on dispose");
  ctx.effect?.(() => () => {
    for (const dispose of disposers.splice(0)) {
      try {
        dispose();
      } catch {
      }
    }
  }, "xiaoyuzhou-hot: unregister routes");
  log.info?.(
    "xiaoyuzhou-hot: routes /x-hot/list, /x-hot/channel, /x-hot/search, /x-hot/resolve, /x-hot/img, /x-hot/library(+relink), /x-hot/favorites, /x-hot/health registered"
  );
}
export {
  apply,
  inject,
  name
};
