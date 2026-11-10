/**
 * 图片反代组件。
 *
 * 浏览器经 Tailscale / 局域网访问时,Apple(mzstatic)、喜马拉雅(xmcdn)、
 * 小宇宙(xyzcdn)这些 CDN 常常直连不通;改走宿主的 /x-hot/img 之后,
 * 浏览器只需要能连上 DSH 本身。反代失败时自动回落到原始地址,
 * 所以宿主还没重启(路由不存在)也不会把图全弄没。
 */
import { useState } from 'react'

export function proxiedImageUrl(url) {
  if (!url || !/^https?:\/\//i.test(url)) return url || ''
  return `/x-hot/img?url=${encodeURIComponent(url)}`
}

export function RemoteImage({ src, className, alt = '', ...rest }) {
  const [failed, setFailed] = useState(false)
  if (!src) return null
  return (
    <img
      className={className}
      src={failed ? src : proxiedImageUrl(src)}
      alt={alt}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => {
        if (!failed) setFailed(true)
      }}
      {...rest}
    />
  )
}
