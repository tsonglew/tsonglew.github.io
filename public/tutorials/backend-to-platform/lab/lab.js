/* Plain script: works from a local static server and directly from file://. */
;(() => {
  'use strict'

  const SEED = 0x811c9dc5
  const BLOCK_SIZE = 4096
  const SLICE_BUDGET_MS = 8

  // Every mode visits the same integers in the same order, with the same state.
  function computeRange(checksum, start, end) {
    for (let index = start; index < end; index += 1) {
      let value = (index ^ checksum) >>> 0
      for (let round = 0; round < 8; round += 1) {
        value = Math.imul(value ^ (value >>> 16), 0x45d9f3b)
        value = (value + round) >>> 0
      }
      checksum = (checksum ^ value) >>> 0
    }
    return checksum
  }

  function shouldApplyResponse(mode, requestId, latestRequestId) {
    return mode === 'broken' || requestId === latestRequestId
  }

  // Expose only the deterministic core for small dependency-free checks.
  globalThis.ReadLaterLabCore = Object.freeze({ SEED, computeRange, shouldApplyResponse })
  if (typeof document === 'undefined') return

  const byId = (id) => document.getElementById(id)
  const waitForTurn = () => new Promise((resolve) => setTimeout(resolve, 0))
  const formatTime = (value) => value.toFixed(1)

  const raceButton = byId('run-race')
  const raceModes = byId('race-modes')
  const raceStatus = byId('race-status')
  const raceLog = byId('race-log')
  let raceRunning = false

  raceButton.addEventListener('click', () => {
    if (raceRunning) return
    raceRunning = true
    raceButton.disabled = true
    raceModes.disabled = true
    const mode = document.querySelector('input[name="race-mode"]:checked').value
    const startedAt = performance.now()
    let latestRequestId = 0
    let completed = 0
    let displayedRequestId = 0
    raceLog.replaceChildren()
    byId('result-source').textContent = '等待响应'
    byId('result-title').textContent = '加载中…'
    raceStatus.textContent = `正在运行${mode === 'broken' ? '故障' : '修复'}模式，等待两次模拟响应。`

    function log(message, className = '') {
      const item = document.createElement('li')
      item.textContent = `+${formatTime(performance.now() - startedAt)} ms · ${message}`
      if (className) item.className = className
      raceLog.append(item)
    }

    function simulateSearch(query, delay, title) {
      const requestId = ++latestRequestId
      byId('current-query').textContent = query
      byId('latest-request').textContent = `#${requestId}`
      log(`#${requestId} 发出，query=${query}，计划延迟 ${delay} ms。`)
      setTimeout(() => {
        if (shouldApplyResponse(mode, requestId, latestRequestId)) {
          displayedRequestId = requestId
          byId('result-source').textContent = `#${requestId} · ${query}`
          byId('result-title').textContent = title
          log(
            `#${requestId} ${query} 响应完成，采用结果。最新请求是 #${latestRequestId}。`,
            'accepted'
          )
        } else {
          log(
            `#${requestId} ${query} 响应完成，丢弃旧响应。最新请求是 #${latestRequestId}。`,
            'discarded'
          )
        }
        completed += 1
        if (completed === 2) {
          const matches = displayedRequestId === latestRequestId
          raceStatus.textContent = matches
            ? '验收通过：当前关键词是 React，结果来源是 #2 React。#1 旧响应未覆盖页面。'
            : '故障已复现：当前关键词是 React，结果却来自 #1 HTML。旧响应覆盖了新结果。'
          raceRunning = false
          raceButton.disabled = false
          raceModes.disabled = false
        }
      }, delay)
    }

    simulateSearch('HTML', 900, 'MDN Web 入门')
    setTimeout(() => simulateSearch('React', 200, '用 React 思考'), 80)
  })

  let heartbeatCount = 0
  setInterval(() => {
    heartbeatCount += 1
    byId('heartbeat-count').textContent = String(heartbeatCount)
  }, 80)

  let interactions = 0
  byId('interaction-probe').addEventListener('click', () => {
    interactions += 1
    byId('interaction-count').textContent = `${interactions} 次`
  })

  const syncButton = byId('run-sync')
  const chunkedButton = byId('run-chunked')
  const workload = byId('workload')
  const performanceStatus = byId('performance-status')
  let performanceRunning = false
  let results = {}

  function renderResult(mode, measurement) {
    const row = byId(`${mode}-result`)
    const heading = document.createElement('th')
    heading.scope = 'row'
    heading.textContent = mode === 'sync' ? '同步' : '分批'
    row.replaceChildren(heading)
    const values = [
      formatTime(measurement.elapsed),
      formatTime(measurement.maxSlice),
      String(measurement.heartbeats),
      `0x${measurement.checksum.toString(16).padStart(8, '0')}`
    ]
    for (const value of values) {
      const cell = document.createElement('td')
      cell.textContent = value
      row.append(cell)
    }
  }

  function updateChecksumStatus() {
    const status = byId('checksum-status')
    if (!results.sync || !results.chunked) {
      status.textContent = '还需要运行另一种模式，才能比较同一计算量的校验和。'
      return
    }
    const equal = results.sync.checksum === results.chunked.checksum
    status.textContent = equal
      ? '校验通过：同一计算量下，两种模式的校验和一致。分批只改变调度方式。'
      : '校验失败：两种模式的结果不一致，请检查计算范围与状态传递。'
  }

  workload.addEventListener('change', () => {
    results = {}
    for (const mode of ['sync', 'chunked']) {
      const row = byId(`${mode}-result`)
      while (row.children.length > 1) row.lastElementChild.remove()
      const cell = document.createElement('td')
      cell.colSpan = 4
      cell.textContent = '尚未运行'
      row.append(cell)
    }
    byId('checksum-status').textContent = '计算量已改变。请重新运行两种模式后比较。'
  })

  async function runComputation(mode) {
    if (performanceRunning) return
    performanceRunning = true
    syncButton.disabled = true
    chunkedButton.disabled = true
    workload.disabled = true
    const size = Number(workload.value)
    const label = mode === 'sync' ? '同步' : '分批'
    performanceStatus.textContent = `准备${label}计算 ${size.toLocaleString('zh-CN')} 项。可以尝试“点我计数”，观察心跳。`

    try {
      // Give the status and disabled controls a chance to paint before measuring.
      await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)))
      const measurement = { maxSlice: 0 }
      const firstHeartbeat = heartbeatCount
      let checksum = SEED
      const startedAt = performance.now()

      if (mode === 'sync') {
        const sliceStart = performance.now()
        checksum = computeRange(checksum, 0, size)
        measurement.maxSlice = performance.now() - sliceStart
      } else {
        let offset = 0
        while (offset < size) {
          const sliceStart = performance.now()
          do {
            const end = Math.min(offset + BLOCK_SIZE, size)
            checksum = computeRange(checksum, offset, end)
            offset = end
          } while (offset < size && performance.now() - sliceStart < SLICE_BUDGET_MS)
          measurement.maxSlice = Math.max(measurement.maxSlice, performance.now() - sliceStart)
          if (offset < size) await waitForTurn()
        }
      }

      const finishedAt = performance.now()
      measurement.elapsed = finishedAt - startedAt
      measurement.heartbeats = heartbeatCount - firstHeartbeat
      measurement.checksum = checksum
      measurement.size = size
      results[mode] = measurement
      renderResult(mode, measurement)
      updateChecksumStatus()
      performanceStatus.textContent = `${label}计算完成，实测总耗时 ${formatTime(measurement.elapsed)} ms，运行期心跳 ${measurement.heartbeats} 次。`
    } catch (error) {
      performanceStatus.textContent = `实验未完成：${error instanceof Error ? error.message : String(error)}。请查看控制台和脚本。`
      console.error(error)
    } finally {
      performanceRunning = false
      syncButton.disabled = false
      chunkedButton.disabled = false
      workload.disabled = false
    }
  }

  syncButton.addEventListener('click', () => runComputation('sync'))
  chunkedButton.addEventListener('click', () => runComputation('chunked'))
  raceButton.disabled = false
  syncButton.disabled = false
  chunkedButton.disabled = false
  byId('interaction-probe').disabled = false
  raceStatus.textContent = '先用故障模式复现，再切换修复模式验证。每次运行会重置时间线。'
  performanceStatus.textContent = '选择同一计算量，分别运行两种模式。尚无测量数据。'
})()
