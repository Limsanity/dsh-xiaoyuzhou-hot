// src/host/index.js
import { copyFile, mkdir, readdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { zstdDecompressSync } from "node:zlib";
var name = "xiaoyuzhou-hot";
var inject = ["webServer"];
var UPSTREAM = "https://xyzrank.com/api";
var XIAOYUZHOU = "https://www.xiaoyuzhoufm.com";
var ITUNES = "https://itunes.apple.com/lookup";
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
var LIBRARY_DIR = join(process.env.DSH_HOME || join(homedir(), ".dsh"), "xiaoyuzhou-hot");
var LIBRARY_FILE = join(LIBRARY_DIR, "library.json");
var SESSION_ROOT = join(process.env.DSH_HOME || join(homedir(), ".dsh"), "sessions");
var SESSION_SCAN_LIMIT = 400;
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
  constructor(path, log) {
    this.path = path;
    this.backupPath = `${path}.bak`;
    this.log = log;
    this.items = /* @__PURE__ */ new Map();
    this.loaded = false;
    this.loading = void 0;
    this.timer = void 0;
    this.pending = void 0;
  }
  async load() {
    if (this.loaded) return this.items;
    if (this.loading === void 0) {
      this.loading = (async () => {
        const found = await this.readFirst([this.path, this.backupPath]);
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
            this.log?.warn?.(`xiaoyuzhou-hot: library \u89E3\u6790\u5931\u8D25,\u6309\u7A7A\u5E93\u7EE7\u7EED (${error?.message ?? error})`);
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
    const fields = [
      ["title", 300],
      ["podcast", 200],
      ["url", 600],
      ["podcastUrl", 600],
      ["sessionId", 100]
    ];
    for (const [field, max] of fields) {
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
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = void 0;
    }
    this.pending = void 0;
    await this.write();
  }
  async write() {
    try {
      await mkdir(dirname(this.path), { recursive: true });
      const payload = JSON.stringify({ version: 1, items: [...this.items.values()] }, null, 2);
      const tmp = `${this.path}.tmp`;
      await writeFile(tmp, payload, "utf8");
      try {
        await copyFile(this.path, this.backupPath);
      } catch (error) {
        if (error?.code !== "ENOENT") throw error;
      }
      await rename(tmp, this.path);
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
      if (match) return { podcast: match[1], title: match[2].trim() };
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
      files.push({ sessionId: entry.slice("session-".length), file });
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
function apply(ctx, config = {}) {
  const cache = /* @__PURE__ */ new Map();
  const inflight = /* @__PURE__ */ new Map();
  const log = ctx.logger ?? console;
  const library = new Library(LIBRARY_FILE, log);
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
  }, "xiaoyuzhou-hot: flush library on dispose");
  ctx.effect?.(() => () => {
    for (const dispose of disposers.splice(0)) {
      try {
        dispose();
      } catch {
      }
    }
  }, "xiaoyuzhou-hot: unregister routes");
  log.info?.("xiaoyuzhou-hot: routes /x-hot/list, /x-hot/channel, /x-hot/library(+relink), /x-hot/health registered");
}
export {
  apply,
  inject,
  name
};
