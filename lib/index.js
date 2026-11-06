// src/host/index.js
var name = "xiaoyuzhou-hot";
var inject = ["webServer"];
var UPSTREAM = "https://xyzrank.com/api";
var KINDS = {
  podcasts: "podcasts",
  new: "new-podcasts",
  episodes: "episodes",
  "new-episodes": "new-episodes"
};
var TTL_MS = 5 * 60 * 1e3;
var TIMEOUT_MS = 2e4;
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
function xyzLink(item) {
  return Array.isArray(item?.links) ? item.links.find((l) => l?.name === "xyz")?.url ?? "" : "";
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
function apply(ctx, config = {}) {
  const cache = /* @__PURE__ */ new Map();
  const inflight = /* @__PURE__ */ new Map();
  const log = ctx.logger ?? console;
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
  async function load(kind, limit, offset) {
    const key = `${kind}:${limit}:${offset}`;
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < TTL_MS) return { ...hit.data, cached: true, fetchedAt: hit.at };
    const pending = inflight.get(key);
    if (pending) return pending;
    const task = fetchUpstream(kind, limit, offset).then((data) => {
      const at = Date.now();
      cache.set(key, { at, data });
      if (cache.size > 24) cache.delete(cache.keys().next().value);
      return { ...data, cached: false, fetchedAt: at };
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
  const disposers = [];
  disposers.push(ctx.webServer.register({
    kind: "exact",
    path: "/x-hot/list",
    handler: async (req, res) => {
      if (req.method !== "GET") return sendJson(res, 405, { ok: false, error: "method not allowed" });
      try {
        const url = new URL(req.url ?? "/x-hot/list", "http://localhost");
        const kind = KINDS[url.searchParams.get("kind")] ? url.searchParams.get("kind") : "podcasts";
        const limit = clampInt(url.searchParams.get("limit"), 50, 1, 100);
        const offset = clampInt(url.searchParams.get("offset"), 0, 0, 1e5);
        const data = await load(kind, limit, offset);
        return sendJson(res, 200, { ok: true, kind, ...data });
      } catch (error) {
        log.warn?.(`xiaoyuzhou-hot: ${error?.stack ?? error}`);
        return sendJson(res, 502, { ok: false, error: String(error?.message ?? error) });
      }
    }
  }));
  disposers.push(ctx.webServer.register({
    kind: "exact",
    path: "/x-hot/health",
    handler: (req, res) => sendJson(res, 200, { ok: true, plugin: "xiaoyuzhou-hot", upstream: UPSTREAM })
  }));
  ctx.effect?.(() => () => {
    for (const dispose of disposers.splice(0)) {
      try {
        dispose();
      } catch {
      }
    }
  }, "xiaoyuzhou-hot: unregister routes");
  log.info?.("xiaoyuzhou-hot: routes /x-hot/list and /x-hot/health registered");
}
export {
  apply,
  inject,
  name
};
