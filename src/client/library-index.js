/**
 * 「已总结」索引。
 *
 * 同一个单集可能从两条路进来:id 不一样——小宇宙页面给的是 eid(24 位 hex),
 * 而播客 RSS(比如喜马拉雅托管的节目)给的是 xmly_track_xxx 这种 guid。
 * 所以既按 id 认,也按标题认:标题归一化(去空白、小写)后相同就算同一集。
 */

/** 单集在记录里的键:优先用 id,退化成链接/标题 */
export function keyOf(episode) {
  return String(episode?.id || episode?.url || episode?.title || '')
}

export function normalizeTitle(value) {
  return String(value ?? '').replace(/\s+/g, '').toLowerCase()
}

/**
 * @param items 已读记录(library.json 的 items)
 * @returns {{has: (episode) => boolean, find: (episode) => object|undefined, byKey: Map}}
 */
export function createLibraryIndex(items = []) {
  const byKey = new Map(items.map((item) => [item.key, item]))
  const byTitle = new Map(items.filter((item) => item.title).map((item) => [normalizeTitle(item.title), item]))
  const find = (episode) => byKey.get(keyOf(episode)) ?? byTitle.get(normalizeTitle(episode?.title))
  return {
    byKey,
    has: (episode) => find(episode) !== undefined,
    find,
  }
}
