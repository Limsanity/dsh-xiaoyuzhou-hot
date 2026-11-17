/**
 * 把一条单集条目变成一段可直接发送的总结任务。
 *
 * 目标:点一下单集 → 新会话里已经写好了"要什么",用户按回车即可开跑,
 * 不用再手动复制标题和链接。频道页里的条目还带音频直链,一起写进去,
 * 这样即使单集页打不开也能直接转写。
 */
import { formatDay, formatDuration } from './format.js'

export function buildSummaryPrompt(episode) {
  // 第一行会决定会话标题(默认标题 provider 从首个 prompt 生成),
  // 所以写成"总结《播客》单集标题",侧栏里能一眼认出来。
  const podcastName = episode?.author ? `《${episode.author}》` : ''
  const lines = [`总结${podcastName}${episode?.title ?? ''}`, '']
  if (episode?.author) lines.push(`播客：${episode.author}`)
  const day = formatDay(episode?.pubDate)
  if (day) lines.push(`发布：${day}`)
  const length = formatDuration(episode?.duration)
  if (length) lines.push(`时长：${length}`)
  if (episode?.url) lines.push(`单集页：${episode.url}`)
  if (episode?.audioUrl) lines.push(`音频直链：${episode.audioUrl}`)

  lines.push('')
  if (episode?.audioUrl) {
    lines.push(
      '流程：先读单集页的 shownotes 拿时间轴和嘉宾信息（打不开就跳过这一步）；',
      '音频用上面的直链直接下载，再用 mlx-whisper 转写',
      '（二进制 ~/.venvs/mlxwhisper/bin/mlx_whisper，模型 mlx-community/whisper-large-v3-turbo）；',
    )
  } else {
    lines.push(
      '流程：先读单集页的 shownotes 拿时间轴和嘉宾信息；再按页面里的音频做转写',
      '（mlx-whisper，二进制 ~/.venvs/mlxwhisper/bin/mlx_whisper，模型 mlx-community/whisper-large-v3-turbo）；',
    )
  }
  lines.push(
    '然后按这个结构输出：',
    '1) 开头两句话：这期在回答什么问题、嘉宾站在哪一边（≤120 字，要能看出分歧在哪）',
    '2) 3–5 个论点（不是话题清单）。每个论点写成三段：主张（一句判断句，不是话题名）→ 支撑（2–3 条最硬的证据，带来源/时间码）→ 边界（反例、她的让步、主持人的反驳、或我的质疑）',
    '3) 3–5 句原话金句',
    '4) 我的判断：适合谁听、哪些说法要打折扣、该复核哪些数字',
    '',
    '写作要求（很重要）：',
    '- 不要写转写过程、耗时、会话 id、模型名；要交代来源就压成文末一行。',
    '- 承重数字必须带来源（嘉宾自述 / 官方披露 / 我的估算）和基数；同一数字只在一个含义下出现；听不真的标「（ASR 存疑）」。',
    '- 嘉宾原话用「」并给时间码；概括写「他提到…」；你自己的判断单独成句并标「我的判断：」，不要混进嘉宾要点。',
    '- 每条「打折扣」后面挂一个触发问句或阈值（什么场景 + 该问哪一句）。',
    '- 单段不超过 200 字；不要用「全场最…」「这段最扎的是…」这类总起句。',
    '- 按论点组织，不要按时间顺序切块；同一话题的材料合并到同一论点下；小节数不超过 6。',
    '- 时间码只标在支撑证据上，不要每句话都挂。',
    '- 总长 2000–4000 字。',
    '',
    '中文输出。',
  )
  return lines.join('\n')
}
