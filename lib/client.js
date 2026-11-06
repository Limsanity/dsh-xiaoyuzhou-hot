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
var import_react = require("react");
var import_jsx_runtime = require("react/jsx-runtime");
var TABS = [
  { key: "podcasts", label: "\u70ED\u95E8\u64AD\u5BA2" },
  { key: "new", label: "\u65B0\u9510\u64AD\u5BA2" },
  { key: "episodes", label: "\u70ED\u95E8\u5355\u96C6" }
];
var PAGE_LIMIT = 100;
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
function formatTime(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
async function fetchList(kind, signal) {
  const res = await fetch(`/x-hot/list?kind=${encodeURIComponent(kind)}&limit=${PAGE_LIMIT}`, { signal });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.ok) throw new Error(data?.error || `HTTP ${res.status}`);
  return data;
}
var KIND_KEY = "xzr.kind";
function initialKind() {
  try {
    const saved = window.localStorage?.getItem(KIND_KEY);
    if (saved && TABS.some((tab) => tab.key === saved)) return saved;
  } catch {
  }
  return "podcasts";
}
function HotPanel({ summarize, openExternal }) {
  const [kind, setKind] = (0, import_react.useState)(initialKind);
  const [items, setItems] = (0, import_react.useState)([]);
  const [total, setTotal] = (0, import_react.useState)(0);
  const [loading, setLoading] = (0, import_react.useState)(true);
  const [error, setError] = (0, import_react.useState)("");
  const [fetchedAt, setFetchedAt] = (0, import_react.useState)(0);
  const [query, setQuery] = (0, import_react.useState)("");
  const ctrl = (0, import_react.useRef)(null);
  const load = (0, import_react.useCallback)(async (nextKind) => {
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
  (0, import_react.useEffect)(() => {
    load(kind);
    try {
      window.localStorage?.setItem(KIND_KEY, kind);
    } catch {
    }
    return () => ctrl.current?.abort();
  }, [kind, load]);
  const filtered = (0, import_react.useMemo)(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (it) => it.title?.toLowerCase().includes(q) || it.author?.toLowerCase().includes(q) || it.genre?.toLowerCase().includes(q)
    );
  }, [items, query]);
  const open = (0, import_react.useCallback)((url) => {
    if (!url) return;
    if (typeof openExternal === "function") return openExternal(url);
    window.open(url, "_blank", "noopener,noreferrer");
  }, [openExternal]);
  const summarizeEpisode = (0, import_react.useCallback)((item) => {
    if (typeof summarize !== "function") {
      window.open(item.url, "_blank", "noopener,noreferrer");
      return;
    }
    summarize(item);
  }, [summarize]);
  const isEpisode = kind === "episodes";
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "xzr-root", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("style", { children: STYLES }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", { className: "xzr-header", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "xzr-headrow", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "xzr-brand", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", { className: "xzr-h1", children: "\u5C0F\u5B87\u5B99\u70ED\u699C" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "xzr-src", children: "\u6570\u636E \xB7 \u4E2D\u6587\u64AD\u5BA2\u699C xyzrank" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
          "button",
          {
            type: "button",
            className: "xzr-refresh",
            onClick: () => load(kind),
            disabled: loading,
            title: "\u91CD\u65B0\u62C9\u53D6",
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", { width: "15", height: "15", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.9", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M21 12a9 9 0 1 1-2.64-6.36" }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M21 3v6h-6" })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: loading ? "\u5237\u65B0\u4E2D" : "\u5237\u65B0" })
            ]
          }
        )
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "xzr-toolrow", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("nav", { className: "xzr-tabs", role: "tablist", "aria-label": "\u699C\u5355\u7C7B\u578B", children: TABS.map((tab) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
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
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "xzr-search", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", "aria-hidden": "true", children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "11", cy: "11", r: "7" }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "m20 20-3.5-3.5" })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "input",
            {
              value: query,
              onChange: (e) => setQuery(e.target.value),
              placeholder: isEpisode ? "\u641C\u5355\u96C6 / \u64AD\u5BA2" : "\u641C\u64AD\u5BA2 / \u4F5C\u8005 / \u5206\u7C7B",
              "aria-label": "\u7B5B\u9009\u699C\u5355"
            }
          ),
          query ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "xzr-clear", onClick: () => setQuery(""), "aria-label": "\u6E05\u7A7A\u7B5B\u9009", children: "\xD7" }) : null
        ] })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "xzr-body", children: [
      loading && items.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, {}) : null,
      !loading && error ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "xzr-state xzr-error", role: "alert", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "\u6CA1\u62C9\u5230\u699C\u5355" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: error }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", onClick: () => load(kind), children: "\u91CD\u8BD5" })
      ] }) : null,
      !loading && !error && filtered.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "xzr-state", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: query ? "\u6CA1\u6709\u5339\u914D\u7684\u6761\u76EE" : "\u699C\u5355\u662F\u7A7A\u7684" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: query ? "\u6362\u4E2A\u5173\u952E\u8BCD\u8BD5\u8BD5" : "\u4E0A\u6E38\u6682\u65F6\u6CA1\u6709\u8FD4\u56DE\u6570\u636E" })
      ] }) : null,
      filtered.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ol", { className: "xzr-list", children: filtered.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { className: "xzr-item", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
          "button",
          {
            type: "button",
            className: "xzr-row",
            onClick: () => isEpisode ? summarizeEpisode(item) : open(item.url),
            title: isEpisode ? `\u65B0\u5F00 DSH \u4F1A\u8BDD\u603B\u7ED3\uFF1A${item.title}` : item.url || "\u6682\u65E0\u94FE\u63A5",
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: `xzr-rank${item.rank <= 3 ? ` is-top is-${item.rank}` : ""}`, children: item.rank }),
              item.logo ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", { className: "xzr-logo", src: item.logo, alt: "", loading: "lazy", referrerPolicy: "no-referrer" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "xzr-logo xzr-logo-empty" }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "xzr-main", children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "xzr-title", children: item.title }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "xzr-sub", children: [
                  item.author || "\u2014",
                  item.genre ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("em", { children: [
                    "\xB7 ",
                    item.genre
                  ] }) : null,
                  isEpisode ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("em", { children: [
                    "\xB7 ",
                    item.episodes,
                    " \u96C6"
                  ] })
                ] })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "xzr-stats", children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "xzr-stat", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: formatCount(item.avgPlay) }),
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", { children: isEpisode ? "\u64AD\u653E" : "\u5747\u64AD\u653E" })
                ] }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "xzr-stat", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: formatRate(item.openRate) }),
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", { children: "\u6253\u5F00\u7387" })
                ] })
              ] })
            ]
          }
        ),
        isEpisode ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "button",
          {
            type: "button",
            className: "xzr-ext",
            onClick: () => open(item.url),
            title: "\u5728\u5C0F\u5B87\u5B99\u6253\u5F00\u8FD9\u4E00\u96C6",
            "aria-label": "\u5728\u5C0F\u5B87\u5B99\u6253\u5F00\u8FD9\u4E00\u96C6",
            children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", { width: "13", height: "13", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M14 4h6v6" }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M20 4 10 14" }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" })
            ] })
          }
        ) : null
      ] }, `${item.rank}-${item.title}`)) }) : null
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("footer", { className: "xzr-foot", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
        query ? `${filtered.length} / ${items.length} \u6761` : `\u524D ${items.length} \u540D`,
        total > items.length ? ` \xB7 \u5171 ${total} \u6863\u4E0A\u699C` : "",
        isEpisode ? " \xB7 \u70B9\u5355\u96C6\u65B0\u5F00\u4F1A\u8BDD\u603B\u7ED3" : ""
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: fetchedAt ? `\u66F4\u65B0\u4E8E ${formatTime(fetchedAt)}` : "\u2014" })
    ] })
  ] });
}
function Skeleton() {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "xzr-skel", "aria-hidden": "true", children: Array.from({ length: 8 }).map((_, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "xzr-skel-row", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "xzr-skel-rank" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "xzr-skel-logo" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "xzr-skel-lines", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { width: `${58 + i * 7 % 28}%` } }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { width: `${30 + i * 5 % 22}%` } })
    ] })
  ] }, i)) });
}
function HotIcon({ size = 18, active = false }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { color: active ? "var(--dsw-alias-brand-primary)" : "inherit", display: "inline-flex", alignItems: "center" }, children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M4 19V9" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M10 19V5" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M16 19v-7" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M21 19H3" })
  ] }) });
}
var STYLES = `
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
`;

// src/client/prompt.js
function buildSummaryPrompt(episode) {
  const lines = [
    "\u5E2E\u6211\u6574\u7406\u8FD9\u96C6\u64AD\u5BA2\uFF0C\u8F93\u51FA\u53EF\u4EE5\u76F4\u63A5\u590D\u7528\u7684\u7B14\u8BB0\u3002",
    "",
    `\u6807\u9898\uFF1A${episode?.title ?? ""}`
  ];
  if (episode?.author) lines.push(`\u64AD\u5BA2\uFF1A${episode.author}`);
  if (episode?.genre) lines.push(`\u5206\u7C7B\uFF1A${episode.genre}`);
  if (episode?.url) lines.push(`\u94FE\u63A5\uFF1A${episode.url}`);
  lines.push(
    "",
    "\u6D41\u7A0B\uFF1A\u5148\u8BFB\u9875\u9762\u91CC\u7684 shownotes \u62FF\u65F6\u95F4\u8F74\u548C\u5609\u5BBE\u4FE1\u606F\uFF1B\u518D\u4E0B\u8F7D\u97F3\u9891\u505A\u8F6C\u5199",
    "\uFF08mlx-whisper\uFF0C\u4E8C\u8FDB\u5236 ~/.venvs/mlxwhisper/bin/mlx_whisper\uFF0C\u6A21\u578B mlx-community/whisper-large-v3-turbo\uFF09\uFF1B",
    "\u7136\u540E\u6309\u8FD9\u4E2A\u7ED3\u6784\u8F93\u51FA\uFF1A",
    "1) \u4E00\u53E5\u8BDD\u7ED3\u8BBA",
    "2) \u5206\u4E3B\u9898\u8981\u70B9\u2014\u2014\u4FDD\u7559\u5177\u4F53\u6848\u4F8B\u3001\u6570\u5B57\u3001\u5609\u5BBE\u4E4B\u95F4\u7684\u5206\u6B67\uFF0C\u522B\u5199\u6210\u6D41\u6C34\u8D26",
    "3) 3\u20135 \u53E5\u539F\u8BDD\u91D1\u53E5",
    "4) \u6211\u7684\u5224\u65AD\uFF1A\u9002\u5408\u8C01\u542C\u3001\u54EA\u4E9B\u8BF4\u6CD5\u8981\u6253\u6298\u6263",
    "",
    "\u4E2D\u6587\u8F93\u51FA\u3002"
  );
  return lines.join("\n");
}

// src/client/index.jsx
var PANEL_ID = "xyzrank-hot";
var inject = ["slots"];
function apply(ctx) {
  let workspace;
  ctx.inject(["uiWorkspace"], (child) => {
    workspace = child.uiWorkspace;
    return () => {
      workspace = void 0;
    };
  });
  const openExternal = (url) => {
    if (url) window.open(url, "_blank", "noopener,noreferrer");
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
        inject: () => ({ summarize, openExternal })
      },
      HotPanel
    )
  );
}

		return module.exports;
	}
});

