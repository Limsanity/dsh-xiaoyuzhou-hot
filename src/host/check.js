/**
 * 播客总结的「交付前自检」。
 *
 * 规则来自 5 篇真实总结的独立评审（平均 48/60）：扣分集中在
 * ① 工序日志混进正文 ② 引号/归属混乱 ③ 数字无锚 ④ 判断没落到动作 ⑤ 段落过长。
 * 这里是纯函数、不联网、不调用模型：给出分数 + 可定位的问题，供面板展示。
 */

const PROCESS_LOG = /(转写完成|已拿到|以下是总结|以下是这份笔记|处理说明|音频直链|mlx[-_]whisper|whisper-large|分钟跑完|会话：session-)/i
const OPENERS = /(全场最|这段最扎|最狠的是|最精彩的是|最值得注意的)/g
const JUDGEMENT = /(我的判断|打折扣|适合谁听|哪些说法)/ 
const ACTIONABLE = /(该问|该盯|盯住|阈值|复核|检查清单|先问|≥|≤|达到.*才算|低于.*就该)/
const SOURCE_WORD = /(自述|披露|招股书|口径|据|来源|估算|官方|报道|ASR|存疑)/

const NUMERIC = /\d+(?:\.\d+)?\s*(?:亿|万|%|倍|美元|人民币|元|人|家|集|分钟|小时)/g

function paragraphsOf(text) {
  return text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
}

/** 句子切分(中英标点都算) */
function sentencesOf(text) {
  return text
    .split(/(?<=[。！？!?；;])\s*|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

/**
 * @param {string} raw 总结正文(markdown)
 * @returns {{score:number, grade:string, issues:Array, stats:object}}
 */
export function checkSummary(raw) {
  const text = String(raw ?? '').trim()
  const chars = text.length
  const paras = paragraphsOf(text)
  const headings = (text.match(/^#{2,4}\s/gm) ?? []).length
  const timecodes = (text.match(/\b\d{1,2}:\d{2}\b/g) ?? []).length
  const quotes = (text.match(/[「“"]/g) ?? []).length
  const numbers = text.match(NUMERIC) ?? []
  const issues = []

  const head = text.slice(0, 800)
  if (PROCESS_LOG.test(head)) {
    issues.push({
      level: 'high',
      deduction: 1.2,
      code: 'process-log',
      message: '正文开头混进了转写/工序信息，读者第一屏看不到观点',
      evidence: (head.match(PROCESS_LOG)?.[0] ?? '').slice(0, 40),
    })
  }

  const longParas = paras.filter((p) => p.length > 300 && !p.startsWith('#') && !p.startsWith('|'))
  if (longParas.length > 0) {
    issues.push({
      level: 'mid',
      deduction: Math.min(0.9, longParas.length * 0.3),
      code: 'long-paragraph',
      message: `${longParas.length} 个段落超过 300 字，扫读会卡`,
      evidence: `${(longParas[0].match(/^.{0,30}/)?.[0] ?? '')}…（${longParas[0].length} 字）`,
    })
  }

  if (!JUDGEMENT.test(text)) {
    issues.push({
      level: 'mid',
      deduction: 1,
      code: 'no-judgement',
      message: '没有"我的判断/打折扣/适合谁听"这类落地段落',
    })
  } else if (!ACTIONABLE.test(text)) {
    issues.push({
      level: 'mid',
      deduction: 0.8,
      code: 'no-action',
      message: '有判断但没有触发问句或阈值，读者带不走可执行动作',
      evidence: '缺「该问…/达到 X 才算…」这类句式',
    })
  }

  const openers = text.match(OPENERS) ?? []
  if (openers.length >= 2) {
    issues.push({
      level: 'low',
      deduction: 0.3,
      code: 'boilerplate-opener',
      message: `"${openers[0]}"式总起句用了 ${openers.length} 次`,
    })
  }

  const unanchored = sentencesOf(text).filter((s) => (s.match(NUMERIC) ?? []).length >= 3 && !SOURCE_WORD.test(s))
  const unanchoredNumbers = unanchored.reduce((sum, s) => sum + (s.match(NUMERIC) ?? []).length, 0)
  if (unanchoredNumbers >= 5) {
    issues.push({
      level: 'mid',
      deduction: 0.6,
      code: 'ungrounded-numbers',
      message: `${unanchored.length} 个句子共 ${unanchoredNumbers} 个数字,都没写来源/口径`,
      evidence: unanchored[0].slice(0, 60),
    })
  }

  if (numbers.length >= 5 && timecodes < 2) {
    issues.push({
      level: 'low',
      deduction: 0.3,
      code: 'no-timestamps',
      message: '数字不少但几乎没有时间码，无法回听核对',
    })
  }

  if (chars < 1200) {
    issues.push({ level: 'low', deduction: 0.3, code: 'too-short', message: `只有 ${chars} 字，信息量可能不够` })
  } else if (chars > 8000) {
    issues.push({ level: 'low', deduction: 0.3, code: 'too-long', message: `${chars} 字偏长，读者很难一次读完` })
  }

  if (quotes > 0 && !/(原话|他提到|她说|我说)/.test(text)) {
    issues.push({
      level: 'low',
      deduction: 0.3,
      code: 'quote-ownership',
      message: '有引号但没有标明是原话还是概括',
    })
  }

  const score = Math.max(
    0,
    Math.round((10 - issues.reduce((sum, issue) => sum + (issue.deduction ?? 0.3), 0)) * 10) / 10,
  )
  const grade = score >= 8.5 ? 'A' : score >= 7 ? 'B' : score >= 5.5 ? 'C' : 'D'

  return {
    score,
    grade,
    issues,
    stats: { chars, paragraphs: paras.length, headings, timecodes, quotes, numbers: numbers.length },
  }
}
