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
      '（二进制 ~/.venvs/mlxwhisper/bin/mlx_whisper，模型 mlx-community/whisper-large-v3-turbo；英文播客加 --language en）；',
    )
  } else {
    lines.push(
      '流程：先读单集页的 shownotes 拿时间轴和嘉宾信息；再按页面里的音频做转写',
      '（mlx-whisper，二进制 ~/.venvs/mlxwhisper/bin/mlx_whisper，模型 mlx-community/whisper-large-v3-turbo；英文播客加 --language en，不确定就让它自动检测）；',
    )
  }
  lines.push(
    '然后按这个结构输出（只要分段总结，别的都不要）：',
    '',
    '## 这期讲什么',
    '一到两句说清主题；不要写结论、不要写评判。',
    '',
    '## 分段总结',
    '按内容分成 3–6 段。每段：',
    '- 小标题：一句话说这段讲什么',
    '- 正文：一段连贯的话，把这段的关键事实、数字、人物、分歧讲清楚；按因果或时间顺序写，不要堆 bullet。',
    '',
    '写作要求：',
    '- 不要写「金句」「边界」「我的判断」「该复核什么」这类附加章节。',
    '- 不要写转写过程、耗时、会话 id、模型名；要交代来源就压成文末一行。',
    '- 数字必须带来源（嘉宾自述 / 官方披露 / 我的估算）；听不真的标「（ASR 存疑）」。',
    '- 嘉宾原话用「」；概括用「他提到…」。',
    '- 人名、公司名、产品名、机构名一律保留原文，不要音译成中文（Bernie Marcus 不要写成「伯尼·马库斯」，Ken Langone 不要写成「肯·兰戈恩」）；首次出现可加一句中文说明，如「Bernie Marcus（家得宝联合创始人）」。同一实体全篇用同一写法。',
    '- 英文术语保留原文，必要时在后面用括号解释，不要为了通顺硬翻。',
    '- 不要用「全场最…」这类总起句；时间码全篇不超过 8 个，只在关键处标。',
    '- 篇幅由内容决定：信息多就长、少就短；不要为了凑长度注水，也不要为了短砍掉关键事实。',
    '',
    '中文输出。',
  )
  return lines.join('\n')
}
