'use strict'
// Shared, deterministic arithmetic. Units are explicit; no network or model calls.
globalThis.CS2680Core = Object.freeze({
  cost({ input, output, inputPrice, outputPrice, tasks, successes }) {
    const values = [input, output, inputPrice, outputPrice, tasks, successes]
    if (!values.every(Number.isFinite) || values.some((n) => n < 0) || tasks < 1 || ![input, output, tasks, successes].every(Number.isInteger) || successes > tasks) throw new Error('请填写有效数值；成功数不能大于任务总数。')
    const perTask = (input * inputPrice + output * outputPrice) / 1e6
    return { perTask, total: perTask * tasks, perSuccess: successes === 0 ? null : (perTask * tasks) / successes }
  },
  kv({ layers, heads, dimension, tokens, batch, bytes }) {
    const values = [layers, heads, dimension, tokens, batch, bytes]
    if (!values.every((n) => Number.isInteger(n) && n > 0)) throw new Error('KV cache 参数必须为正整数。')
    const perSequence = 2 * layers * heads * dimension * tokens * bytes
    const total = perSequence * batch
    if (!Number.isSafeInteger(total)) throw new Error('参数过大，超出可精确表示的范围。')
    return { perSequenceGiB: perSequence / 2 ** 30, totalGiB: total / 2 ** 30 }
  },
  schedule(lengths, slots, continuous) {
    if (!Array.isArray(lengths) || !lengths.length || lengths.length > 12 || !lengths.every((n) => Number.isInteger(n) && n >= 1 && n <= 40) || !Number.isInteger(slots) || slots < 1 || slots > 4) throw new Error('请输入 1–12 个长度为 1–40 的整数，并选择 1–4 个槽位。')
    let rows = []
    if (continuous) {
      const available = Array(slots).fill(0)
      lengths.forEach((length, id) => {
        const start = Math.min(...available)
        const slot = available.indexOf(start)
        available[slot] = start + length
        rows.push({ id, start, end: start + length, length })
      })
    } else {
      let start = 0
      for (let i = 0; i < lengths.length; i += slots) {
        const group = lengths.slice(i, i + slots)
        group.forEach((length, j) => rows.push({ id: i + j, start, end: start + length, length }))
        start += Math.max(...group)
      }
    }
    const makespan = Math.max(...rows.map((r) => r.end))
    const tokens = lengths.reduce((a, b) => a + b, 0)
    return { rows, makespan, tokens, throughput: tokens / makespan, meanLatency: rows.reduce((n, r) => n + r.end, 0) / rows.length }
  }
})
