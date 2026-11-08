/** 数字/时间格式化,面板与频道页共用。 */

/** 1.9 亿 → 1.9亿;68234 → 6.8万 */
export function formatCount(n) {
  if (!Number.isFinite(n) || n <= 0) return '—'
  if (n >= 100000000) return `${(n / 100000000).toFixed(1).replace(/\.0$/, '')}亿`
  if (n >= 10000) return `${(n / 10000).toFixed(1).replace(/\.0$/, '')}万`
  return String(Math.round(n))
}

export function formatRate(rate) {
  // 上游偶发 >100% 的脏数据(统计口径不同),宁可不显示也不误导
  if (!Number.isFinite(rate) || rate <= 0 || rate > 1) return '—'
  return `${(rate * 100).toFixed(1)}%`
}

export function formatClock(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return ''
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** RFC822/RFC3339 → 2026/09/23 */
export function formatDay(value) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
}

/** 秒 → 1:51:36 / 18:20 */
export function formatDuration(seconds) {
  const total = Math.round(Number(seconds) || 0)
  if (total <= 0) return ''
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const pad = (n) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}


/** 时间戳 → 刚刚 / 12 分钟前 / 昨天 / 2026/09/23 */
export function formatWhen(ts) {
  const t = Number(ts)
  if (!Number.isFinite(t) || t <= 0) return ''
  const diff = Date.now() - t
  if (diff < 60_000) return '刚刚'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`
  if (diff < 172_800_000) return '昨天'
  return formatDay(t)
}
