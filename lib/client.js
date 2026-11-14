window.__ModuleLoader__.load({
	id: "@lim324/dsh-xiaoyuzhou-hot",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.jsx
var index_exports = {};
__export(index_exports, {
  PANEL_ID: () => PANEL_ID,
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(index_exports);

// src/client/Panel.jsx
var import_react3 = require("react");

// src/client/Channel.jsx
var import_react2 = require("react");

// src/client/format.js
function formatCount(n) {
  if (!Number.isFinite(n) || n <= 0) return "\u2014";
  if (n >= 1e8) return `${(n / 1e8).toFixed(1).replace(/\.0$/, "")}\u4EBF`;
  if (n >= 1e4) return `${(n / 1e4).toFixed(1).replace(/\.0$/, "")}\u4E07`;
  return String(Math.round(n));
}
function formatRate(rate) {
  if (!Number.isFinite(rate) || rate <= 0 || rate > 1) return "\u2014";
  return `${(rate * 100).toFixed(1)}%`;
}
function formatClock(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function formatDay(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}
function formatDuration(seconds) {
  const total = Math.round(Number(seconds) || 0);
  if (total <= 0) return "";
  const h = Math.floor(total / 3600);
  const m = Math.floor(total % 3600 / 60);
  const s = total % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}
function formatWhen(ts) {
  const t = Number(ts);
  if (!Number.isFinite(t) || t <= 0) return "";
  const diff = Date.now() - t;
  if (diff < 6e4) return "\u521A\u521A";
  if (diff < 36e5) return `${Math.floor(diff / 6e4)} \u5206\u949F\u524D`;
  if (diff < 864e5) return `${Math.floor(diff / 36e5)} \u5C0F\u65F6\u524D`;
  if (diff < 1728e5) return "\u6628\u5929";
  return formatDay(t);
}

// src/client/RemoteImage.jsx
var import_react = require("react");
var import_jsx_runtime = require("react/jsx-runtime");
function proxiedImageUrl(url) {
  if (!url || !/^https?:\/\//i.test(url)) return url || "";
  return `/x-hot/img?url=${encodeURIComponent(url)}`;
}
function RemoteImage({ src, className, alt = "", ...rest }) {
  const [failed, setFailed] = (0, import_react.useState)(false);
  if (!src) return null;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    "img",
    {
      className,
      src: failed ? src : proxiedImageUrl(src),
      alt,
      loading: "lazy",
      referrerPolicy: "no-referrer",
      onError: () => {
        if (!failed) setFailed(true);
      },
      ...rest
    }
  );
}

// src/client/Channel.jsx
var import_jsx_runtime2 = require("react/jsx-runtime");
function ChannelView({ podcast, data, loading, error, onBack, onRetry, summarize, openExternal, isDone, isFavorite, onToggleFavorite }) {
  const [query, setQuery] = (0, import_react2.useState)("");
  const episodes = data?.episodes ?? [];
  const filtered = (0, import_react2.useMemo)(() => {
    const q = query.trim().toLowerCase();
    if (!q) return episodes;
    return episodes.filter((ep) => ep.title?.toLowerCase().includes(q));
  }, [episodes, query]);
  const limited = data?.source === "ssr";
  const doneCount = typeof isDone === "function" ? episodes.filter((ep) => isDone(ep)).length : 0;
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "xzr-root xzr-channel", children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("header", { className: "xzr-ch-head", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("button", { type: "button", className: "xzr-back", onClick: onBack, title: "\u8FD4\u56DE\u699C\u5355", "aria-label": "\u8FD4\u56DE\u699C\u5355", children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { d: "M15 18l-6-6 6-6" }) }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: "\u699C\u5355" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "xzr-ch-id", children: [
        podcast?.logo ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(RemoteImage, { className: "xzr-ch-logo", src: podcast.logo }) : null,
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "xzr-ch-meta", children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("h2", { className: "xzr-ch-title", children: podcast?.title ?? data?.title ?? "" }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("p", { className: "xzr-ch-sub", children: [
            podcast?.author ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: podcast.author }) : null,
            podcast?.genre ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("em", { children: [
              "\xB7 ",
              podcast.genre
            ] }) : null,
            data?.episodes?.length ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("em", { children: [
              "\xB7 ",
              episodes.length,
              " \u96C6",
              limited ? "(\u6700\u65B0)" : ""
            ] }) : null,
            doneCount > 0 ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("em", { className: "xzr-ch-done", children: [
              "\xB7 \u5DF2\u603B\u7ED3 ",
              doneCount
            ] }) : null
          ] })
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "xzr-ch-actions", children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "xzr-search xzr-ch-search", children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", "aria-hidden": "true", children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("circle", { cx: "11", cy: "11", r: "7" }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { d: "m20 20-3.5-3.5" })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("input", { value: query, onChange: (e) => setQuery(e.target.value), placeholder: "\u641C\u8FD9\u4E00\u9891\u9053\u7684\u5355\u96C6", "aria-label": "\u641C\u8FD9\u4E00\u9891\u9053\u7684\u5355\u96C6" }),
          query ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "button", className: "xzr-clear", onClick: () => setQuery(""), "aria-label": "\u6E05\u7A7A\u7B5B\u9009", children: "\xD7" }) : null
        ] }),
        podcast?.url ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
          "button",
          {
            type: "button",
            className: `xzr-fav${isFavorite ? " is-on" : ""}`,
            onClick: () => onToggleFavorite?.(podcast),
            "aria-label": isFavorite ? "\u53D6\u6D88\u6536\u85CF" : "\u6536\u85CF\u8FD9\u4E2A\u64AD\u5BA2",
            children: isFavorite ? "\u2605 \u5DF2\u6536\u85CF" : "\u2606 \u6536\u85CF"
          }
        ) : null,
        podcast?.url ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "button", className: "xzr-refresh", onClick: () => openExternal(podcast.url), "aria-label": "\u5728\u5C0F\u5B87\u5B99\u6253\u5F00\u8FD9\u4E2A\u64AD\u5BA2", children: "\u5C0F\u5B87\u5B99 \u2197" }) : null
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "xzr-body", children: [
      loading ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(ChannelSkeleton, {}) : null,
      !loading && error ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "xzr-state xzr-error", role: "alert", children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("strong", { children: "\u5206\u96C6\u5217\u8868\u6CA1\u62C9\u5230" }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { children: error }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "xzr-state-actions", children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "button", onClick: onRetry, children: "\u91CD\u8BD5" }),
          podcast?.url ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "button", onClick: () => openExternal(podcast.url), children: "\u5728\u5C0F\u5B87\u5B99\u770B" }) : null
        ] })
      ] }) : null,
      !loading && !error && filtered.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "xzr-state", children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("strong", { children: query ? "\u6CA1\u6709\u5339\u914D\u7684\u5355\u96C6" : "\u8FD9\u4E2A\u9891\u9053\u6CA1\u6709\u5206\u96C6" }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { children: query ? "\u6362\u4E2A\u5173\u952E\u8BCD\u8BD5\u8BD5" : "RSS \u91CC\u6CA1\u6709\u89E3\u6790\u5230\u6761\u76EE" })
      ] }) : null,
      filtered.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("ol", { className: "xzr-list", children: filtered.map((ep, index) => /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("li", { className: "xzr-item", children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
          "button",
          {
            type: "button",
            className: "xzr-row",
            onClick: () => summarize({ ...ep, author: podcast?.title ?? data?.title ?? "" }, podcast),
            "aria-label": `\u65B0\u5F00 DSH \u4F1A\u8BDD\u603B\u7ED3:${ep.title}`,
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "xzr-rank", children: index + 1 }),
              /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: "xzr-main", children: [
                /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "xzr-title", title: ep.title, children: ep.title }),
                /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: "xzr-sub", children: [
                  typeof isDone === "function" && isDone(ep) ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "xzr-done", children: "\u2713 \u5DF2\u603B\u7ED3" }) : null,
                  formatDay(ep.pubDate) || "\u2014",
                  ep.duration ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("em", { children: [
                    "\xB7 ",
                    formatDuration(ep.duration)
                  ] }) : null
                ] })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "xzr-stats", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: "xzr-stat xzr-stat-cta", children: [
                /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("b", { children: "\u603B\u7ED3" }),
                /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("i", { children: "\u56DE\u8F66\u5373\u5F00\u8DD1" })
              ] }) })
            ]
          }
        ),
        ep.url ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
          "button",
          {
            type: "button",
            className: "xzr-ext",
            onClick: () => openExternal(ep.url),
            "aria-label": "\u5728\u5C0F\u5B87\u5B99\u6253\u5F00\u8FD9\u4E00\u96C6",
            children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("svg", { width: "13", height: "13", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", children: [
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { d: "M14 4h6v6" }),
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { d: "M20 4 10 14" }),
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { d: "M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" })
            ] })
          }
        ) : null
      ] }, ep.id || `${index}-${ep.title}`)) }) : null
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("footer", { className: "xzr-foot", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { children: [
        query ? `${filtered.length} / ${episodes.length} \u96C6` : `${episodes.length} \u96C6`,
        limited ? " \xB7 \u53EA\u6709\u6700\u65B0\u4E00\u6279,\u5B8C\u6574\u5386\u53F2\u53BB\u5C0F\u5B87\u5B99" : ""
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: "\u70B9\u5355\u96C6 \u2192 \u65B0\u5F00\u4F1A\u8BDD\u603B\u7ED3" })
    ] })
  ] });
}
function ChannelSkeleton() {
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "xzr-skel", "aria-hidden": "true", children: Array.from({ length: 8 }).map((_, i) => /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "xzr-skel-row", children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "xzr-skel-rank" }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: "xzr-skel-lines", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: { width: `${54 + i * 9 % 30}%` } }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: { width: `${26 + i * 7 % 18}%` } })
    ] })
  ] }, i)) });
}

// src/client/library-index.js
function keyOf(episode) {
  return String(episode?.id || episode?.url || episode?.title || "");
}
function normalizeTitle(value) {
  return String(value ?? "").replace(/\s+/g, "").toLowerCase();
}
function createLibraryIndex(items = []) {
  const byKey = new Map(items.map((item) => [item.key, item]));
  const byTitle = new Map(items.filter((item) => item.title).map((item) => [normalizeTitle(item.title), item]));
  const find = (episode) => byKey.get(keyOf(episode)) ?? byTitle.get(normalizeTitle(episode?.title));
  return {
    byKey,
    has: (episode) => find(episode) !== void 0,
    find
  };
}

// src/client/Panel.jsx
var import_jsx_runtime3 = require("react/jsx-runtime");
var TABS = [
  { key: "podcasts", label: "\u70ED\u95E8\u64AD\u5BA2" },
  { key: "new", label: "\u65B0\u9510\u64AD\u5BA2" },
  { key: "episodes", label: "\u70ED\u95E8\u5355\u96C6" },
  { key: "library", label: "\u6211\u7684\u603B\u7ED3" },
  { key: "favorites", label: "\u6211\u7684\u6536\u85CF" },
  { key: "search", label: "\u641C\u7D22" }
];
function pidOf(podcast) {
  return /\/podcast\/([0-9a-f]{24})/i.exec(podcast?.url ?? "")?.[1] ?? "";
}
function favoriteKey(podcast) {
  return pidOf(podcast) || (podcast?.appleId ? `apple:${podcast.appleId}` : "");
}
var PAGE_LIMIT = 100;
async function fetchList(kind, signal) {
  const res = await fetch(`/x-hot/list?kind=${encodeURIComponent(kind)}&limit=${PAGE_LIMIT}`, { signal });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.ok) throw new Error(data?.error || `HTTP ${res.status}`);
  return data;
}
var KIND_KEY = "xzr.kind";
var PENDING_KEY = "xzr.pending";
function readPending() {
  try {
    const raw = window.localStorage?.getItem(PENDING_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}
function writePending(list) {
  try {
    window.localStorage?.setItem(PENDING_KEY, JSON.stringify(list.slice(-200)));
  } catch {
  }
}
function initialKind() {
  try {
    const saved = window.localStorage?.getItem(KIND_KEY);
    if (saved && TABS.some((tab) => tab.key === saved)) return saved;
  } catch {
  }
  return "podcasts";
}
function HotPanel({ summarize, openExternal, sessionIds, watchNewSession, openSession }) {
  const [kind, setKind] = (0, import_react3.useState)(initialKind);
  const [items, setItems] = (0, import_react3.useState)([]);
  const [total, setTotal] = (0, import_react3.useState)(0);
  const [loading, setLoading] = (0, import_react3.useState)(true);
  const [error, setError] = (0, import_react3.useState)("");
  const [fetchedAt, setFetchedAt] = (0, import_react3.useState)(0);
  const [query, setQuery] = (0, import_react3.useState)("");
  const [channel, setChannel] = (0, import_react3.useState)(null);
  const [library, setLibrary] = (0, import_react3.useState)([]);
  const [favorites, setFavorites] = (0, import_react3.useState)([]);
  const [searchQ, setSearchQ] = (0, import_react3.useState)("");
  const [searching, setSearching] = (0, import_react3.useState)(false);
  const [searchError, setSearchError] = (0, import_react3.useState)("");
  const [searchResults, setSearchResults] = (0, import_react3.useState)([]);
  const [searchTouched, setSearchTouched] = (0, import_react3.useState)(false);
  const [relinking, setRelinking] = (0, import_react3.useState)(false);
  const [relinkNote, setRelinkNote] = (0, import_react3.useState)("");
  const [rebuildingFavs, setRebuildingFavs] = (0, import_react3.useState)(false);
  const [favNote, setFavNote] = (0, import_react3.useState)("");
  const ctrl = (0, import_react3.useRef)(null);
  const channelCtrl = (0, import_react3.useRef)(null);
  const libraryIndex = (0, import_react3.useMemo)(() => createLibraryIndex(library), [library]);
  const favoriteIndex = (0, import_react3.useMemo)(() => new Set(favorites.map((item) => item.key)), [favorites]);
  (0, import_react3.useEffect)(() => {
    let cancelled = false;
    fetch("/x-hot/favorites").then((res) => res.json()).then((data) => {
      if (!cancelled && data?.ok) setFavorites(data.items ?? []);
    }).catch(() => {
    });
    return () => {
      cancelled = true;
    };
  }, []);
  (0, import_react3.useEffect)(() => {
    let cancelled = false;
    fetch("/x-hot/library").then((res) => res.json()).then((data) => {
      if (!cancelled && data?.ok) setLibrary(data.items ?? []);
    }).catch(() => {
    });
    return () => {
      cancelled = true;
    };
  }, []);
  const load = (0, import_react3.useCallback)(async (nextKind) => {
    if (nextKind === "library" || nextKind === "favorites" || nextKind === "search") {
      setLoading(false);
      setError("");
      return;
    }
    ctrl.current?.abort();
    const controller = new AbortController();
    ctrl.current = controller;
    setLoading(true);
    setError("");
    try {
      const data = await fetchList(nextKind, controller.signal);
      if (controller.signal.aborted) return;
      setItems(data.items ?? []);
      setTotal(data.total ?? 0);
      setFetchedAt(data.fetchedAt ?? Date.now());
    } catch (err) {
      if (controller.signal.aborted) return;
      setError(String(err?.message ?? err));
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);
  (0, import_react3.useEffect)(() => {
    load(kind);
    try {
      window.localStorage?.setItem(KIND_KEY, kind);
    } catch {
    }
    return () => ctrl.current?.abort();
  }, [kind, load]);
  const filtered = (0, import_react3.useMemo)(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (it) => it.title?.toLowerCase().includes(q) || it.author?.toLowerCase().includes(q) || it.genre?.toLowerCase().includes(q)
    );
  }, [items, query]);
  const closeChannel = (0, import_react3.useCallback)(() => {
    channelCtrl.current?.abort();
    setChannel(null);
    try {
      window.sessionStorage?.removeItem("xzr.channel");
    } catch {
    }
  }, []);
  const openChannel = (0, import_react3.useCallback)(async (podcast) => {
    const id = /\/podcast\/([0-9a-f]{24})/i.exec(podcast?.url ?? "")?.[1] ?? "";
    setChannel((cur) => ({
      podcast,
      data: cur && cur.podcast?.url === podcast?.url ? cur.data : null,
      loading: true,
      error: ""
    }));
    channelCtrl.current?.abort();
    const controller = new AbortController();
    channelCtrl.current = controller;
    try {
      window.sessionStorage?.setItem("xzr.channel", JSON.stringify(podcast));
    } catch {
    }
    try {
      const qs = new URLSearchParams({ limit: "300" });
      if (id) qs.set("id", id);
      if (podcast?.appleId) qs.set("apple", podcast.appleId);
      const res = await fetch(`/x-hot/channel?${qs.toString()}`, { signal: controller.signal });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      if (controller.signal.aborted) return;
      setChannel((cur) => cur ? { ...cur, loading: false, data, error: "" } : cur);
    } catch (err) {
      if (controller.signal.aborted) return;
      const message = String(err?.message ?? err);
      const hint = /HTTP 404/.test(message) ? "\u5BBF\u4E3B\u8DEF\u7531 /x-hot/channel \u8FD8\u6CA1\u52A0\u8F7D:\u91CD\u542F\u4E00\u6B21 dsh web \u540E\u53EF\u7528" : message;
      setChannel((cur) => cur ? { ...cur, loading: false, error: hint } : cur);
    }
  }, []);
  (0, import_react3.useEffect)(() => {
    try {
      const saved = window.sessionStorage?.getItem("xzr.channel");
      if (saved) openChannel(JSON.parse(saved));
    } catch {
    }
  }, [openChannel]);
  const runSearch = (0, import_react3.useCallback)(async (raw) => {
    const text = String(raw ?? "").trim();
    if (!text) return;
    const isLink = /xiaoyuzhoufm\.com\/(podcast|episode)\//i.test(text) || /^[0-9a-f]{24}$/i.test(text);
    setSearching(true);
    setSearchError("");
    setSearchResults([]);
    setSearchTouched(true);
    try {
      if (isLink) {
        const res2 = await fetch(`/x-hot/resolve?url=${encodeURIComponent(text)}`);
        const data2 = await res2.json().catch(() => null);
        if (!res2.ok || !data2?.ok) throw new Error(data2?.error || `HTTP ${res2.status}`);
        setSearching(false);
        openChannel({ ...data2.podcast, appleId: "" });
        return;
      }
      const res = await fetch(`/x-hot/search?q=${encodeURIComponent(text)}&limit=20`);
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setSearchResults(data.items ?? []);
    } catch (error2) {
      setSearchError(String(error2?.message ?? error2));
    } finally {
      setSearching(false);
    }
  }, [openChannel]);
  const open = (0, import_react3.useCallback)((url) => {
    if (!url) return;
    if (typeof openExternal === "function") return openExternal(url);
    window.open(url, "_blank", "noopener,noreferrer");
  }, [openExternal]);
  const flushPending = (0, import_react3.useCallback)(async () => {
    const pending = readPending();
    if (pending.length === 0) return;
    const left = [];
    for (const entry of pending) {
      try {
        const res = await fetch("/x-hot/library", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(entry)
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      } catch {
        left.push(entry);
      }
    }
    writePending(left);
    if (left.length === 0) {
      const data = await fetch("/x-hot/library").then((r) => r.json()).catch(() => null);
      if (data?.ok) setLibrary(data.items ?? []);
    }
  }, []);
  (0, import_react3.useEffect)(() => {
    flushPending();
  }, [flushPending]);
  const markSummarized = (0, import_react3.useCallback)((item, podcast) => {
    const known = libraryIndex.find(item);
    const key = known?.key || keyOf(item);
    if (!key) return;
    const entry = {
      key,
      title: item?.title ?? "",
      podcast: podcast?.title ?? item?.author ?? "",
      url: item?.url ?? "",
      podcastUrl: podcast?.url ?? "",
      at: Date.now()
    };
    setLibrary((prev) => [entry, ...prev.filter((row) => row.key !== key)]);
    fetch("/x-hot/library", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(entry)
    }).then((res) => res.json()).then((data) => {
      if (data?.ok && data.item) {
        setLibrary((prev) => [data.item, ...prev.filter((row) => row.key !== data.item.key)]);
      }
    }).catch(() => {
      writePending([...readPending(), entry]);
    });
    return key;
  }, [libraryIndex]);
  const linkSession = (0, import_react3.useCallback)((key, sessionId) => {
    setLibrary((prev) => prev.map((row) => row.key === key ? { ...row, sessionId } : row));
    fetch("/x-hot/library", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ key, sessionId })
    }).catch(() => {
    });
  }, []);
  const toggleFavorite = (0, import_react3.useCallback)((podcast) => {
    const pid = favoriteKey(podcast);
    if (!pid) return;
    if (favorites.some((item) => item.key === pid)) {
      setFavorites((prev) => prev.filter((item) => item.key !== pid));
      fetch(`/x-hot/favorites?id=${encodeURIComponent(pid)}`, { method: "DELETE" }).catch(() => {
      });
      return;
    }
    const entry = {
      key: pid,
      title: podcast?.title ?? "",
      author: podcast?.author ?? "",
      genre: podcast?.genre ?? "",
      url: podcast?.url ?? "",
      appleId: podcast?.appleId ?? "",
      logo: podcast?.logo ?? "",
      at: Date.now()
    };
    setFavorites((prev) => [entry, ...prev.filter((item) => item.key !== pid)]);
    fetch("/x-hot/favorites", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(entry)
    }).catch(() => {
    });
  }, [favorites]);
  const relinkSessions = (0, import_react3.useCallback)(async () => {
    setRelinking(true);
    setRelinkNote("");
    try {
      const res = await fetch("/x-hot/library/relink", { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setLibrary(data.items ?? []);
      setRelinkNote(data.matched === 0 ? "\u6CA1\u6709\u53EF\u5BF9\u7684\u4F1A\u8BDD" : `\u5339\u914D ${data.matched} \xB7 \u65B0\u5173\u8054 ${data.linked}`);
    } catch (error2) {
      setRelinkNote(String(error2?.message ?? error2));
    } finally {
      setRelinking(false);
    }
  }, []);
  const rebuildFavorites = (0, import_react3.useCallback)(async () => {
    setRebuildingFavs(true);
    setFavNote("");
    try {
      const res = await fetch("/x-hot/favorites/rebuild", { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setFavorites(data.items ?? []);
      setFavNote(data.added === 0 ? "\u6CA1\u6709\u65B0\u7684\u53EF\u8865(\u90FD\u6536\u8FC7\u4E86)" : `\u65B0\u589E ${data.added} \u4E2A`);
    } catch (error2) {
      setFavNote(String(error2?.message ?? error2));
    } finally {
      setRebuildingFavs(false);
    }
  }, []);
  const removeSummarized = (0, import_react3.useCallback)((key) => {
    setLibrary((prev) => prev.filter((row) => row.key !== key));
    fetch(`/x-hot/library?key=${encodeURIComponent(key)}`, { method: "DELETE" }).catch(() => {
    });
  }, []);
  const summarizeEpisode = (0, import_react3.useCallback)((item, podcast) => {
    if (typeof summarize !== "function") {
      window.open(item.url, "_blank", "noopener,noreferrer");
      return;
    }
    const before = typeof sessionIds === "function" ? sessionIds() : null;
    summarize(item);
    const key = markSummarized(item, podcast);
    if (key && before && typeof watchNewSession === "function") {
      watchNewSession(before, (sessionId) => linkSession(key, sessionId));
    }
  }, [summarize, markSummarized, linkSession, sessionIds, watchNewSession]);
  const isEpisode = kind === "episodes";
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_jsx_runtime3.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("style", { children: STYLES }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "xzr-root", style: channel ? { display: "none" } : void 0, children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("header", { className: "xzr-header", children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "xzr-headrow", children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "xzr-brand", children: [
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("h1", { className: "xzr-h1", children: "\u5C0F\u5B87\u5B99\u70ED\u699C" }),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "xzr-src", children: "\u6570\u636E \xB7 \u4E2D\u6587\u64AD\u5BA2\u699C xyzrank" })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
            "button",
            {
              type: "button",
              className: "xzr-refresh",
              onClick: () => load(kind),
              disabled: loading,
              title: "\u91CD\u65B0\u62C9\u53D6",
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("svg", { width: "15", height: "15", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.9", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("path", { d: "M21 12a9 9 0 1 1-2.64-6.36" }),
                  /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("path", { d: "M21 3v6h-6" })
                ] }),
                /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { children: loading ? "\u5237\u65B0\u4E2D" : "\u5237\u65B0" })
              ]
            }
          )
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "xzr-toolrow", children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("nav", { className: "xzr-tabs", role: "tablist", "aria-label": "\u699C\u5355\u7C7B\u578B", children: TABS.map((tab) => /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
            "button",
            {
              type: "button",
              role: "tab",
              "aria-selected": kind === tab.key,
              className: `xzr-tab${kind === tab.key ? " is-active" : ""}`,
              onClick: () => setKind(tab.key),
              children: tab.label
            },
            tab.key
          )) }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "xzr-search", children: [
            /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", "aria-hidden": "true", children: [
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("circle", { cx: "11", cy: "11", r: "7" }),
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("path", { d: "m20 20-3.5-3.5" })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
              "input",
              {
                value: query,
                onChange: (e) => setQuery(e.target.value),
                placeholder: kind === "library" ? "\u641C\u6211\u603B\u7ED3\u8FC7\u7684\u5355\u96C6" : isEpisode ? "\u641C\u5355\u96C6 / \u64AD\u5BA2" : "\u641C\u64AD\u5BA2 / \u4F5C\u8005 / \u5206\u7C7B",
                "aria-label": "\u7B5B\u9009\u699C\u5355"
              }
            ),
            query ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("button", { type: "button", className: "xzr-clear", onClick: () => setQuery(""), "aria-label": "\u6E05\u7A7A\u7B5B\u9009", children: "\xD7" }) : null
          ] })
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "xzr-body", children: [
        kind === "search" ? /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "xzr-search-view", children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "xzr-search-hero", children: [
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
              "input",
              {
                value: searchQ,
                onChange: (e) => setSearchQ(e.target.value),
                onKeyDown: (e) => {
                  if (e.key === "Enter") runSearch(searchQ);
                },
                placeholder: "\u641C\u64AD\u5BA2\u540D,\u6216\u7C98\u8D34\u5C0F\u5B87\u5B99\u94FE\u63A5 / 24 \u4F4D id",
                "aria-label": "\u641C\u64AD\u5BA2\u6216\u7C98\u8D34\u5C0F\u5B87\u5B99\u94FE\u63A5"
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("button", { type: "button", onClick: () => runSearch(searchQ), disabled: searching, children: searching ? "\u641C\u7D22\u4E2D\u2026" : "\u641C\u7D22" })
          ] }),
          searching ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Skeleton, {}) : null,
          !searching && searchError ? /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "xzr-state xzr-error", role: "alert", children: [
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("strong", { children: "\u6CA1\u627E\u5230" }),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { children: searchError })
          ] }) : null,
          !searching && !searchError && searchTouched && searchResults.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "xzr-state", children: [
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("strong", { children: "\u6CA1\u6709\u5339\u914D\u7684\u64AD\u5BA2" }),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { children: "\u6362\u4E2A\u5173\u952E\u8BCD,\u6216\u76F4\u63A5\u7C98\u8D34\u5C0F\u5B87\u5B99\u7684\u64AD\u5BA2 / \u5355\u96C6\u94FE\u63A5" })
          ] }) : null,
          searchResults.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("ol", { className: "xzr-list", children: searchResults.map((item) => /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("li", { className: "xzr-item", children: [
            /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
              "button",
              {
                type: "button",
                className: "xzr-row",
                onClick: () => openChannel({
                  title: item.title,
                  author: item.author,
                  genre: item.genre,
                  episodes: item.episodes,
                  logo: item.logo,
                  appleId: item.appleId,
                  url: ""
                }),
                "aria-label": `\u6253\u5F00 ${item.title} \u7684\u9891\u9053`,
                children: [
                  item.logo ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(RemoteImage, { className: "xzr-logo", src: item.logo }) : /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "xzr-logo xzr-logo-empty" }),
                  /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: "xzr-main", children: [
                    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "xzr-title", title: item.title, children: item.title }),
                    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: "xzr-sub", children: [
                      item.author || "\u2014",
                      item.genre ? /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("em", { children: [
                        "\xB7 ",
                        item.genre
                      ] }) : null,
                      item.episodes ? /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("em", { children: [
                        "\xB7 ",
                        item.episodes,
                        " \u96C6"
                      ] }) : null
                    ] })
                  ] })
                ]
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
              "button",
              {
                type: "button",
                className: `xzr-ext xzr-ext-star${favoriteIndex.has(favoriteKey(item)) ? " is-on" : ""}`,
                onClick: () => toggleFavorite(item),
                "aria-label": favoriteIndex.has(favoriteKey(item)) ? "\u53D6\u6D88\u6536\u85CF" : "\u6536\u85CF\u8FD9\u4E2A\u64AD\u5BA2",
                children: favoriteIndex.has(favoriteKey(item)) ? "\u2605" : "\u2606"
              }
            )
          ] }, item.appleId || item.title)) }) : null,
          !searchTouched ? /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "xzr-state", children: [
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("strong", { children: "\u627E\u699C\u5355\u5916\u7684\u64AD\u5BA2" }),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { children: "\u8F93\u5165\u540D\u5B57\u641C(\u8D70 Apple \u64AD\u5BA2\u76EE\u5F55),\u6216\u7C98\u8D34\u5C0F\u5B87\u5B99\u94FE\u63A5\u76F4\u63A5\u6253\u5F00\u9891\u9053" })
          ] }) : null
        ] }) : null,
        kind === "favorites" ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
          FavoritesList,
          {
            items: favorites,
            query,
            openChannel,
            openExternal: open,
            onRemove: (key) => {
              setFavorites((prev) => prev.filter((item) => item.key !== key));
              fetch(`/x-hot/favorites?id=${encodeURIComponent(key)}`, { method: "DELETE" }).catch(() => {
              });
            }
          }
        ) : null,
        kind === "library" ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
          LibraryList,
          {
            items: library,
            query,
            openExternal: open,
            onRemove: removeSummarized,
            openSession
          }
        ) : null,
        kind !== "library" && kind !== "favorites" && kind !== "search" && loading && items.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Skeleton, {}) : null,
        kind !== "library" && kind !== "favorites" && kind !== "search" && !loading && error ? /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "xzr-state xzr-error", role: "alert", children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("strong", { children: "\u6CA1\u62C9\u5230\u699C\u5355" }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { children: error }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("button", { type: "button", onClick: () => load(kind), children: "\u91CD\u8BD5" })
        ] }) : null,
        kind !== "library" && kind !== "favorites" && kind !== "search" && !loading && !error && filtered.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "xzr-state", children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("strong", { children: query ? "\u6CA1\u6709\u5339\u914D\u7684\u6761\u76EE" : "\u699C\u5355\u662F\u7A7A\u7684" }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { children: query ? "\u6362\u4E2A\u5173\u952E\u8BCD\u8BD5\u8BD5" : "\u4E0A\u6E38\u6682\u65F6\u6CA1\u6709\u8FD4\u56DE\u6570\u636E" })
        ] }) : null,
        kind !== "library" && kind !== "favorites" && kind !== "search" && filtered.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("ol", { className: "xzr-list", children: filtered.map((item) => /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("li", { className: "xzr-item", children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
            "button",
            {
              type: "button",
              className: "xzr-row",
              onClick: () => isEpisode ? summarizeEpisode(item) : openChannel(item),
              "aria-label": isEpisode ? `\u65B0\u5F00 DSH \u4F1A\u8BDD\u603B\u7ED3:${item.title}` : `\u770B ${item.title} \u7684\u5206\u96C6\u5217\u8868`,
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: `xzr-rank${item.rank <= 3 ? ` is-top is-${item.rank}` : ""}`, children: item.rank }),
                item.logo ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(RemoteImage, { className: "xzr-logo", src: item.logo }) : /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "xzr-logo xzr-logo-empty" }),
                /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: "xzr-main", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "xzr-title", title: item.title, children: item.title }),
                  /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: "xzr-sub", children: [
                    libraryIndex.has(item) ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "xzr-done", children: "\u2713 \u5DF2\u603B\u7ED3" }) : null,
                    !isEpisode && favoriteIndex.has(pidOf(item)) ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "xzr-star-mark", children: "\u2605 \u6536\u85CF" }) : null,
                    item.author || "\u2014",
                    item.genre ? /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("em", { children: [
                      "\xB7 ",
                      item.genre
                    ] }) : null,
                    isEpisode ? null : /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("em", { children: [
                      "\xB7 ",
                      item.episodes,
                      " \u96C6"
                    ] })
                  ] })
                ] }),
                /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: "xzr-stats", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: "xzr-stat", children: [
                    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("b", { children: formatCount(item.avgPlay) }),
                    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("i", { children: isEpisode ? "\u64AD\u653E" : "\u5747\u64AD\u653E" })
                  ] }),
                  /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: "xzr-stat", children: [
                    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("b", { children: formatRate(item.openRate) }),
                    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("i", { children: "\u6253\u5F00\u7387" })
                  ] })
                ] })
              ]
            }
          ),
          isEpisode ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
            "button",
            {
              type: "button",
              className: "xzr-ext",
              onClick: () => open(item.url),
              "aria-label": "\u5728\u5C0F\u5B87\u5B99\u6253\u5F00\u8FD9\u4E00\u96C6",
              children: /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("svg", { width: "13", height: "13", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", children: [
                /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("path", { d: "M14 4h6v6" }),
                /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("path", { d: "M20 4 10 14" }),
                /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("path", { d: "M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" })
              ] })
            }
          ) : null
        ] }, `${item.rank}-${item.title}`)) }) : null
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("footer", { className: "xzr-foot", children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { children: [
          kind === "library" ? `${library.length} \u6761\u8BB0\u5F55 \xB7 \u5B58\u5728\u672C\u673A` : kind === "favorites" ? `${favorites.length} \u4E2A\u9891\u9053 \xB7 \u5B58\u5728\u672C\u673A` : kind === "search" ? `${searchResults.length} \u4E2A\u7ED3\u679C \xB7 \u6570\u636E\u6765\u81EA Apple \u64AD\u5BA2\u76EE\u5F55` : query ? `${filtered.length} / ${items.length} \u6761` : `\u524D ${items.length} \u540D`,
          kind !== "library" && total > items.length ? ` \xB7 \u5171 ${total} \u6863\u4E0A\u699C` : "",
          kind !== "library" && isEpisode ? " \xB7 \u70B9\u5355\u96C6\u65B0\u5F00\u4F1A\u8BDD\u603B\u7ED3" : ""
        ] }),
        kind === "library" || kind === "favorites" ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "xzr-foot-actions", children: kind === "library" ? /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_jsx_runtime3.Fragment, { children: [
          relinkNote ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "xzr-note", children: relinkNote }) : null,
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("button", { type: "button", className: "xzr-linkbtn", onClick: relinkSessions, disabled: relinking, children: relinking ? "\u626B\u63CF\u4E2D\u2026" : "\u91CD\u65B0\u5173\u8054\u4F1A\u8BDD" })
        ] }) : /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_jsx_runtime3.Fragment, { children: [
          favNote ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "xzr-note", children: favNote }) : null,
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("button", { type: "button", className: "xzr-linkbtn", onClick: rebuildFavorites, disabled: rebuildingFavs, children: rebuildingFavs ? "\u626B\u63CF\u4E2D\u2026" : "\u6309\u603B\u7ED3\u8865\u6536\u85CF" })
        ] }) }) : /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { children: fetchedAt ? `\u66F4\u65B0\u4E8E ${formatClock(fetchedAt)}` : "\u2014" })
      ] })
    ] }),
    channel ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
      ChannelView,
      {
        podcast: channel.podcast,
        data: channel.data,
        loading: channel.loading,
        error: channel.error,
        onBack: closeChannel,
        onRetry: () => openChannel(channel.podcast),
        summarize: summarizeEpisode,
        openExternal: open,
        isDone: (ep) => libraryIndex.has(ep),
        isFavorite: favoriteIndex.has(favoriteKey(channel.podcast)),
        onToggleFavorite: toggleFavorite
      }
    ) : null
  ] });
}
function FavoritesList({ items, query, openChannel, openExternal, onRemove }) {
  const filtered = (0, import_react3.useMemo)(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (item) => item.title?.toLowerCase().includes(q) || item.author?.toLowerCase().includes(q) || item.genre?.toLowerCase().includes(q)
    );
  }, [items, query]);
  if (items.length === 0) {
    return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "xzr-state", children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("strong", { children: "\u8FD8\u6CA1\u6709\u6536\u85CF\u7684\u64AD\u5BA2" }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { children: "\u8FDB\u4EFB\u610F\u64AD\u5BA2\u7684\u9891\u9053\u9875,\u70B9\u53F3\u4E0A\u89D2\u300C\u2606 \u6536\u85CF\u300D" })
    ] });
  }
  if (filtered.length === 0) {
    return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "xzr-state", children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("strong", { children: "\u6CA1\u6709\u5339\u914D\u7684\u6536\u85CF" }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { children: "\u6362\u4E2A\u5173\u952E\u8BCD\u8BD5\u8BD5" })
    ] });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("ol", { className: "xzr-list", children: filtered.map((item) => /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("li", { className: "xzr-item", children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
      "button",
      {
        type: "button",
        className: "xzr-row",
        onClick: () => openChannel(item),
        "aria-label": `\u6253\u5F00 ${item.title} \u7684\u9891\u9053`,
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "xzr-star-mark xzr-star-lead", children: "\u2605" }),
          item.logo ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(RemoteImage, { className: "xzr-logo", src: item.logo }) : /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "xzr-logo xzr-logo-empty" }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: "xzr-main", children: [
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "xzr-title", title: item.title, children: item.title }),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: "xzr-sub", children: [
              item.author || "\u2014",
              item.genre ? /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("em", { children: [
                "\xB7 ",
                item.genre
              ] }) : null
            ] })
          ] })
        ]
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
      "button",
      {
        type: "button",
        className: "xzr-ext xzr-ext-always",
        onClick: () => onRemove(item.key),
        "aria-label": `\u53D6\u6D88\u6536\u85CF ${item.title}`,
        children: "\xD7"
      }
    )
  ] }, item.key)) });
}
function LibraryList({ items, query, openExternal, onRemove, openSession }) {
  const [note, setNote] = (0, import_react3.useState)("");
  const openItem = (0, import_react3.useCallback)(
    (item) => {
      if (!item.sessionId) {
        openExternal(item.url);
        return;
      }
      const opened = typeof openSession === "function" && openSession(item.sessionId);
      if (opened) {
        setNote("");
        return;
      }
      setNote("\u8FD9\u4E2A\u4F1A\u8BDD\u6253\u4E0D\u5F00(\u53EF\u80FD\u5DF2\u88AB\u5220\u9664),\u53EF\u4EE5\u5728\u5C0F\u5B87\u5B99\u91CC\u91CD\u65B0\u770B\u8FD9\u4E00\u96C6");
      setTimeout(() => setNote(""), 4e3);
    },
    [openExternal, openSession]
  );
  const filtered = (0, import_react3.useMemo)(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (it) => it.title?.toLowerCase().includes(q) || it.podcast?.toLowerCase().includes(q)
    );
  }, [items, query]);
  if (items.length === 0) {
    return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "xzr-state", children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("strong", { children: "\u8FD8\u6CA1\u6709\u603B\u7ED3\u8BB0\u5F55" }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { children: "\u5728\u699C\u5355\u6216\u9891\u9053\u91CC\u70B9\u4EFB\u610F\u4E00\u96C6,\u8FD9\u91CC\u5C31\u4F1A\u8BB0\u4E0B\u6765" })
    ] });
  }
  if (filtered.length === 0) {
    return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "xzr-state", children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("strong", { children: "\u6CA1\u6709\u5339\u914D\u7684\u8BB0\u5F55" }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { children: "\u6362\u4E2A\u5173\u952E\u8BCD\u8BD5\u8BD5" })
    ] });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_jsx_runtime3.Fragment, { children: [
    note ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "xzr-banner", role: "status", children: note }) : null,
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("ol", { className: "xzr-list", children: filtered.map((item) => /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("li", { className: "xzr-item", children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
        "button",
        {
          type: "button",
          className: "xzr-row",
          onClick: () => openItem(item),
          "aria-label": item.sessionId ? `\u6253\u5F00\u90A3\u6B21\u603B\u7ED3\u4F1A\u8BDD:${item.title}` : `\u5728\u5C0F\u5B87\u5B99\u6253\u5F00:${item.title}`,
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "xzr-rank xzr-rank-done", children: "\u2713" }),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: "xzr-main", children: [
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "xzr-title", title: item.title, children: item.title }),
              /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: "xzr-sub", children: [
                item.podcast || "\u2014",
                /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("em", { children: [
                  "\xB7 ",
                  formatWhen(item.at)
                ] }),
                item.sessionId ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("em", { className: "xzr-ch-done", children: "\xB7 \u5DF2\u5173\u8054\u4F1A\u8BDD" }) : null
              ] })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "xzr-stats", children: /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: "xzr-stat", children: [
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("b", { children: item.sessionId ? "\u6253\u5F00\u4F1A\u8BDD" : "\u5C0F\u5B87\u5B99" }),
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("i", { children: item.sessionId ? "\u63A5\u7740\u804A" : "\u65E0\u4F1A\u8BDD\u8BB0\u5F55" })
            ] }) })
          ]
        }
      ),
      item.sessionId ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
        "button",
        {
          type: "button",
          className: "xzr-ext xzr-ext-left",
          onClick: () => openExternal(item.url),
          "aria-label": "\u5728\u5C0F\u5B87\u5B99\u6253\u5F00\u8FD9\u4E00\u96C6",
          children: /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("svg", { width: "13", height: "13", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", children: [
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("path", { d: "M14 4h6v6" }),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("path", { d: "M20 4 10 14" }),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("path", { d: "M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" })
          ] })
        }
      ) : null,
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
        "button",
        {
          type: "button",
          className: "xzr-ext xzr-ext-always",
          onClick: () => onRemove(item.key),
          "aria-label": `\u53D6\u6D88\u6807\u8BB0:${item.title}`,
          children: "\xD7"
        }
      )
    ] }, item.key)) })
  ] });
}
function Skeleton() {
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "xzr-skel", "aria-hidden": "true", children: Array.from({ length: 8 }).map((_, i) => /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "xzr-skel-row", children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "xzr-skel-rank" }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "xzr-skel-logo" }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: "xzr-skel-lines", children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { style: { width: `${58 + i * 7 % 28}%` } }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { style: { width: `${30 + i * 5 % 22}%` } })
    ] })
  ] }, i)) });
}
function HotIcon({ size = 18, active = false }) {
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { style: { color: active ? "var(--dsw-alias-brand-primary)" : "inherit", display: "inline-flex", alignItems: "center" }, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("path", { d: "M4 19V9" }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("path", { d: "M10 19V5" }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("path", { d: "M16 19v-7" }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("path", { d: "M21 19H3" })
  ] }) });
}
var STYLES = `
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
  /* \u53EA\u8BA9"\u6587\u5B57\u672C\u8EAB"\u63A5\u6536 hover:\u5426\u5219\u6574\u884C\u5BBD\u90FD\u662F tooltip \u89E6\u53D1\u533A,\u6C14\u6CE1\u4F1A\u76D6\u4F4F\u53F3\u4FA7\u56FE\u6807 */
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
`;

// src/client/prompt.js
function buildSummaryPrompt(episode) {
  const podcastName = episode?.author ? `\u300A${episode.author}\u300B` : "";
  const lines = [`\u603B\u7ED3${podcastName}${episode?.title ?? ""}`, ""];
  if (episode?.author) lines.push(`\u64AD\u5BA2\uFF1A${episode.author}`);
  const day = formatDay(episode?.pubDate);
  if (day) lines.push(`\u53D1\u5E03\uFF1A${day}`);
  const length = formatDuration(episode?.duration);
  if (length) lines.push(`\u65F6\u957F\uFF1A${length}`);
  if (episode?.url) lines.push(`\u5355\u96C6\u9875\uFF1A${episode.url}`);
  if (episode?.audioUrl) lines.push(`\u97F3\u9891\u76F4\u94FE\uFF1A${episode.audioUrl}`);
  lines.push("");
  if (episode?.audioUrl) {
    lines.push(
      "\u6D41\u7A0B\uFF1A\u5148\u8BFB\u5355\u96C6\u9875\u7684 shownotes \u62FF\u65F6\u95F4\u8F74\u548C\u5609\u5BBE\u4FE1\u606F\uFF08\u6253\u4E0D\u5F00\u5C31\u8DF3\u8FC7\u8FD9\u4E00\u6B65\uFF09\uFF1B",
      "\u97F3\u9891\u7528\u4E0A\u9762\u7684\u76F4\u94FE\u76F4\u63A5\u4E0B\u8F7D\uFF0C\u518D\u7528 mlx-whisper \u8F6C\u5199",
      "\uFF08\u4E8C\u8FDB\u5236 ~/.venvs/mlxwhisper/bin/mlx_whisper\uFF0C\u6A21\u578B mlx-community/whisper-large-v3-turbo\uFF09\uFF1B"
    );
  } else {
    lines.push(
      "\u6D41\u7A0B\uFF1A\u5148\u8BFB\u5355\u96C6\u9875\u7684 shownotes \u62FF\u65F6\u95F4\u8F74\u548C\u5609\u5BBE\u4FE1\u606F\uFF1B\u518D\u6309\u9875\u9762\u91CC\u7684\u97F3\u9891\u505A\u8F6C\u5199",
      "\uFF08mlx-whisper\uFF0C\u4E8C\u8FDB\u5236 ~/.venvs/mlxwhisper/bin/mlx_whisper\uFF0C\u6A21\u578B mlx-community/whisper-large-v3-turbo\uFF09\uFF1B"
    );
  }
  lines.push(
    "\u7136\u540E\u6309\u8FD9\u4E2A\u7ED3\u6784\u8F93\u51FA\uFF1A",
    "1) \u4E00\u53E5\u8BDD\u7ED3\u8BBA",
    "2) \u5206\u4E3B\u9898\u8981\u70B9\u2014\u2014\u4FDD\u7559\u5177\u4F53\u6848\u4F8B\u3001\u6570\u5B57\u3001\u5609\u5BBE\u4E4B\u95F4\u7684\u5206\u6B67\uFF0C\u522B\u5199\u6210\u6D41\u6C34\u8D26",
    "3) 3\u20135 \u53E5\u539F\u8BDD\u91D1\u53E5",
    "4) \u6211\u7684\u5224\u65AD\uFF1A\u9002\u5408\u8C01\u542C\u3001\u54EA\u4E9B\u8BF4\u6CD5\u8981\u6253\u6298\u6263\u3001\u8BE5\u590D\u6838\u54EA\u4E9B\u6570\u5B57",
    "",
    "\u5199\u4F5C\u8981\u6C42\uFF08\u5F88\u91CD\u8981\uFF09\uFF1A",
    "- \u4E0D\u8981\u5199\u8F6C\u5199\u8FC7\u7A0B\u3001\u8017\u65F6\u3001\u4F1A\u8BDD id\u3001\u6A21\u578B\u540D\uFF1B\u8981\u4EA4\u4EE3\u6765\u6E90\u5C31\u538B\u6210\u6587\u672B\u4E00\u884C\u3002",
    "- \u627F\u91CD\u6570\u5B57\u5FC5\u987B\u5E26\u6765\u6E90\uFF08\u5609\u5BBE\u81EA\u8FF0 / \u5B98\u65B9\u62AB\u9732 / \u6211\u7684\u4F30\u7B97\uFF09\u548C\u57FA\u6570\uFF1B\u540C\u4E00\u6570\u5B57\u53EA\u5728\u4E00\u4E2A\u542B\u4E49\u4E0B\u51FA\u73B0\uFF1B\u542C\u4E0D\u771F\u7684\u6807\u300C\uFF08ASR \u5B58\u7591\uFF09\u300D\u3002",
    "- \u5609\u5BBE\u539F\u8BDD\u7528\u300C\u300D\u5E76\u7ED9\u65F6\u95F4\u7801\uFF1B\u6982\u62EC\u5199\u300C\u4ED6\u63D0\u5230\u2026\u300D\uFF1B\u4F60\u81EA\u5DF1\u7684\u5224\u65AD\u5355\u72EC\u6210\u53E5\u5E76\u6807\u300C\u6211\u7684\u5224\u65AD\uFF1A\u300D\uFF0C\u4E0D\u8981\u6DF7\u8FDB\u5609\u5BBE\u8981\u70B9\u3002",
    "- \u6BCF\u6761\u300C\u6253\u6298\u6263\u300D\u540E\u9762\u6302\u4E00\u4E2A\u89E6\u53D1\u95EE\u53E5\u6216\u9608\u503C\uFF08\u4EC0\u4E48\u573A\u666F + \u8BE5\u95EE\u54EA\u4E00\u53E5\uFF09\u3002",
    "- \u5355\u6BB5\u4E0D\u8D85\u8FC7 200 \u5B57\uFF1B\u4E0D\u8981\u7528\u300C\u5168\u573A\u6700\u2026\u300D\u300C\u8FD9\u6BB5\u6700\u624E\u7684\u662F\u2026\u300D\u8FD9\u7C7B\u603B\u8D77\u53E5\u3002",
    "- \u603B\u957F 2000\u20134000 \u5B57\u3002",
    "",
    "\u4E2D\u6587\u8F93\u51FA\u3002"
  );
  return lines.join("\n");
}

// src/client/index.jsx
var PANEL_ID = "xyzrank-hot";
var inject = ["slots"];
var SESSION_WATCH_MS = 6e3;
function apply(ctx) {
  let workspace;
  let sessions;
  ctx.inject(["uiWorkspace"], (child) => {
    workspace = child.uiWorkspace;
    return () => {
      workspace = void 0;
    };
  });
  ctx.inject(["sessions"], (child) => {
    sessions = child.sessions;
    return () => {
      sessions = void 0;
    };
  });
  const openExternal = (url) => {
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  };
  const sessionIds = () => {
    const snapshot = sessions?.list?.getSnapshot?.();
    if (!snapshot || snapshot.phase !== "ready" || !snapshot.byId) return null;
    return new Set(Object.keys(snapshot.byId));
  };
  const watchNewSession = (before, onFound) => {
    if (!(before instanceof Set)) return () => {
    };
    const startedAt = Date.now();
    const timer = setInterval(() => {
      const snapshot = sessions?.list?.getSnapshot?.();
      if (snapshot?.phase === "ready" && snapshot.byId) {
        const fresh = Object.keys(snapshot.byId).filter((id) => !before.has(id));
        if (fresh.length === 1) {
          clearInterval(timer);
          onFound(fresh[0]);
          return;
        }
        if (fresh.length > 1) {
          clearInterval(timer);
          return;
        }
      }
      if (Date.now() - startedAt > SESSION_WATCH_MS) clearInterval(timer);
    }, 250);
    return () => clearInterval(timer);
  };
  const openSession = (sessionId) => {
    if (!sessionId || !workspace || typeof workspace.openSession !== "function") return false;
    try {
      workspace.openSession(sessionId);
      return true;
    } catch (error) {
      ctx.logger?.error?.("xiaoyuzhou-hot: openSession failed: %o", error);
      return false;
    }
  };
  const summarize = (episode) => {
    if (!workspace || typeof workspace.startSession !== "function") {
      openExternal(episode?.url);
      return;
    }
    try {
      workspace.startSession(void 0, {
        prompt: buildSummaryPrompt(episode),
        clearPreviousDraft: true
      });
    } catch (error) {
      ctx.logger?.error?.("xiaoyuzhou-hot: startSession failed: %o", error);
      openExternal(episode?.url);
    }
  };
  ctx.slots.inject(
    "sidebar.panellist",
    () => ctx.slots.register(
      {
        name: "sidebar.panellist",
        id: PANEL_ID,
        order: 16,
        label: "\u5C0F\u5B87\u5B99\u70ED\u699C"
      },
      HotIcon
    )
  );
  ctx.slots.inject(
    "main",
    () => ctx.slots.register(
      {
        name: "main",
        key: PANEL_ID,
        inject: () => ({ summarize, openExternal, sessionIds, watchNewSession, openSession })
      },
      HotPanel
    )
  );
}

		return module.exports;
	}
});

