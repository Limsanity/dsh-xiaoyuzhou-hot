/**
 * 把一条单集条目变成一段可直接发送的总结任务。
 *
 * 目标:点一下单集 → 新会话里已经写好了"要什么",用户按回车即可开跑,
 * 不用再手动复制标题和链接。
 */
export function buildSummaryPrompt(episode) {
  const lines = [
    '帮我整理这集播客，输出可以直接复用的笔记。',
    '',
    `标题：${episode?.title ?? ''}`,
  ]
  if (episode?.author) lines.push(`播客：${episode.author}`)
  if (episode?.genre) lines.push(`分类：${episode.genre}`)
  if (episode?.url) lines.push(`链接：${episode.url}`)
  lines.push(
    '',
    '流程：先读页面里的 shownotes 拿时间轴和嘉宾信息；再下载音频做转写',
    '（mlx-whisper，二进制 ~/.venvs/mlxwhisper/bin/mlx_whisper，模型 mlx-community/whisper-large-v3-turbo）；',
    '然后按这个结构输出：',
    '1) 一句话结论',
    '2) 分主题要点——保留具体案例、数字、嘉宾之间的分歧，别写成流水账',
    '3) 3–5 句原话金句',
    '4) 我的判断：适合谁听、哪些说法要打折扣',
    '',
    '中文输出。',
  )
  return lines.join('\n')
}
