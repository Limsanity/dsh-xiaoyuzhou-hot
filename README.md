# @lim324/dsh-xiaoyuzhou-hot · 小宇宙热榜

DSH Web GUI 插件:左侧边栏多一个榜单入口,点开在主列显示**小宇宙热门播客 / 新锐播客 / 热门单集**。

- 播客行:点一下跳到小宇宙播客页。
- 单集行:**点一下新开一个 DSH 会话,并把"总结这一集"的任务预填进输入框**,回车即开跑;行尾的 ↗ 才是在小宇宙打开。

![热门播客](docs/screenshot-podcasts.png)

## 它解决什么

小宇宙没有公开 API,榜单只在 App 里(接口要登录态 token,网页端也没有列表页)。这个插件把第三方「中文播客榜」(xyzrank)的公开 JSON 接进 GUI,顺手做缓存与降级,让"今天有什么在涨"变成一眼可见。

真正的目的是把"看到一集 → 总结它"这段路缩短到一次点击:不用复制标题、不用贴链接、不用重述流程。

## 点击单集之后发生什么

```js
uiWorkspace.startSession(undefined, { prompt, clearPreviousDraft: true })
```

- `sessionScope` 走 `ctx.inject(['uiWorkspace'])` 拿,晚于 `slots` 就绪也不会卡住面板注册;
- 没有 `uiWorkspace`(非 Web 组合、或服务未就绪)时退化成打开小宇宙网页,不会静默失败;
- 预填的 prompt 带标题、播客名、分类、单集链接,并写明流程(读 shownotes → mlx-whisper 转写 → 结论/要点/金句/判断),所以新会话不需要再问一遍"用什么工具";
- `clearPreviousDraft: true` 是刻意的:保证这次的任务真的落进输入框,代价是会覆盖被复用空白会话里的旧草稿。

## 数据与实现

```
浏览器  ──GET /x-hot/list?kind=podcasts&limit=100──▶  宿主插件(dsh-host-webserver 路由)
                                                          │ 5 分钟内存缓存 + 并发去重
                                                          ▼
                                               https://xyzrank.com/api/podcasts
```

- 为什么要有宿主半:xyzrank 不回 `Access-Control-Allow-Origin`,浏览器直连会被 CORS 拦掉;由宿主代理后是同源请求。
- 降级:上游挂掉时返回上次缓存并标 `stale`,面板不会空屏;仍失败则显示错误与「重试」。
- 脏数据:上游偶发 `openRate > 100%`,面板显示 `—` 而不是误导性数字。

### 路由

| 路由 | 说明 |
|---|---|
| `GET /x-hot/list?kind=podcasts\|new\|episodes\|new-episodes&limit=1..100&offset=0` | 榜单数据(归一化后的 JSON) |
| `GET /x-hot/health` | 存活探针 |

返回:

```json
{ "ok": true, "kind": "podcasts", "items": [{ "rank": 1, "title": "岩中花述", "author": "GIADA迦达",
  "genre": "艺术", "episodes": 87, "avgPlay": 1919952, "openRate": 0.416,
  "url": "https://www.xiaoyuzhoufm.com/podcast/625635587bfca4e73e990703", "logo": "..." }],
  "total": 8176, "cached": true, "fetchedAt": 1762... }
```

### 客户端 slot

```js
// 侧栏图标:list id 与 main panel 的 key 必须一致
ctx.slots.register({ name: 'sidebar.panellist', id: 'xyzrank-hot', order: 16, label: '小宇宙热榜' }, HotIcon)
ctx.slots.register({ name: 'main', key: 'xyzrank-hot' }, HotPanel)
```

样式全部用 DSH 的 `--dsw-*` 令牌(`--dsw-alias-bg-base` / `label-*` / `border-l1` / `radius-*`),浅色深色自动跟随,不写死颜色。

## 安装 / 卸载

```bash
# 装进 web profile(link 方式,改源码后重新 build 即可)
dsh plugin --profile web add link:$HOME/.dsh-0.2.1-rc.2/plugins/xiaoyuzhou-hot

# 再把 "@lim324/dsh-xiaoyuzhou-hot" 追加进 ~/.dsh/profiles/web/package.json 的 dsh.profile.bundles
# 然后刷新页面;宿主半会随 profile 热重载,客户端半通常需要刷新一次(必要时重启 dsh web)
```

卸载:

```bash
dsh plugin --profile web remove @lim324/dsh-xiaoyuzhou-hot
# 并从 dsh.profile.bundles 里删掉
```

## 开发

```bash
node build.mjs          # 产出 lib/index.js(宿主)+ lib/client.js(__ModuleLoader__ 包)
node test-host.mjs      # 路由 + 缓存 + 降级(打真实上游)
node test-client.mjs    # jsdom 里真实 mount:渲染 100 行 + 断言"点单集→startSession(预填 prompt)"
```

`test-client.mjs` 会顺带产出 `preview.html` 与 `preview-episodes.html`,可以直接用浏览器打开看效果,不依赖 DSH。

## 已知限制

- 榜单口径来自第三方 xyzrank(约 8k 档节目),不是小宇宙官方榜;更新有滞后。
- 上游没有分页游标,`limit` 最大 100;面板只展示前 100 名。
- 只读:不做订阅、不做播放;单集点击只是开一场新会话并预填任务,真正发不发由你决定。
- 封面图来自上游(部分是 Apple 的 CDN),离线时显示占位块。
