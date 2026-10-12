'use strict'
;(() => {
  const BASE = '/cs2680/'
  const KEY = 'cs2680-platform-v2'
  const ids = [...document.querySelectorAll('.chapter-nav')].map((a) => a.dataset.progressId)
  const freshState = () => ({ version: 2, completed: [], notes: {}, quizzes: {}, lastLesson: null })
  let state = freshState()
  let storageOK = true
  const toast = (message) => {
    const node = document.querySelector('#toast')
    node.textContent = message
    node.classList.add('show')
    clearTimeout(toast.timer)
    toast.timer = setTimeout(() => node.classList.remove('show'), 2600)
  }
  function validateState(raw) {
    if (!raw || typeof raw !== 'object' || raw.version !== 2 || !Array.isArray(raw.completed) || !raw.notes || typeof raw.notes !== 'object' || Array.isArray(raw.notes)) throw new Error('文件不是有效的本平台学习备份。')
    const out = freshState()
    out.completed = [...new Set(raw.completed.filter((id) => ids.includes(id)))]
    for (const id of ids) {
      const note = raw.notes[id]
      if (note !== undefined) {
        if (!note || typeof note.text !== 'string' || note.text.length > 100000 || typeof note.updatedAt !== 'string' || !Number.isFinite(Date.parse(note.updatedAt))) throw new Error('备份中的笔记格式或时间不正确。')
        out.notes[id] = { text: note.text, updatedAt: note.updatedAt }
      }
      const quiz = raw.quizzes?.[id]
      if (quiz && typeof quiz === 'object') {
        out.quizzes[id] = {}
        for (const number of ['0', '1']) {
          const value = quiz[number]
          if (value && Number.isInteger(value.answer) && value.answer >= 0 && value.answer < 4 && typeof value.correct === 'boolean') out.quizzes[id][number] = { answer: value.answer, correct: value.correct }
        }
      }
    }
    out.lastLesson = ids.includes(raw.lastLesson) ? raw.lastLesson : null
    return out
  }
  try {
    const saved = localStorage.getItem(KEY)
    if (saved) state = validateState(JSON.parse(saved))
  } catch { storageOK = false }
  let pendingChanges = []
  function applyChange(latest, change) {
    if (change.lastLesson) latest.lastLesson = change.lastLesson
    if (change.completion) {
      const { id, done } = change.completion
      latest.completed = done ? [...new Set([...latest.completed, id])] : latest.completed.filter((item) => item !== id)
    }
    if (change.note) latest.notes[change.note.id] = change.note.value
    if (change.quiz) {
      latest.quizzes[change.quiz.id] ||= {}
      latest.quizzes[change.quiz.id][change.quiz.number] = change.quiz.value
    }
    if (change.imported) {
      const incoming = change.imported
      latest.completed = [...new Set([...latest.completed, ...incoming.completed])]
      for (const id of ids) {
        const note = incoming.notes[id]
        if (note && (!latest.notes[id] || Date.parse(note.updatedAt) > Date.parse(latest.notes[id].updatedAt))) latest.notes[id] = note
        if (incoming.quizzes[id]) latest.quizzes[id] = { ...incoming.quizzes[id], ...(latest.quizzes[id] || {}) }
      }
      if (!latest.lastLesson) latest.lastLesson = incoming.lastLesson
    }
    return latest
  }
  function latestWithPending() {
    let latest = state
    try {
      const raw = localStorage.getItem(KEY)
      if (raw) latest = validateState(JSON.parse(raw))
    } catch { storageOK = false }
    for (const change of pendingChanges) latest = applyChange(latest, change)
    return latest
  }
  function syncLatest() { state = latestWithPending() }
  function persist(change = {}) {
    // Keep failed field writes, not a stale full-record snapshot. Recovery must
    // merge with other tabs' changes before replaying this tab's unsaved work.
    const field = change.note ? 'note:' + change.note.id
      : change.completion ? 'completion:' + change.completion.id
      : change.quiz ? 'quiz:' + change.quiz.id + ':' + change.quiz.number
      : change.lastLesson ? 'lastLesson' : null
    if (field) pendingChanges = pendingChanges.filter((item) => item.field !== field)
    pendingChanges.push({ ...change, field })
    state = latestWithPending()
    try {
      localStorage.setItem(KEY, JSON.stringify(state))
      pendingChanges = []
      storageOK = true
    } catch { storageOK = false }
    return storageOK
  }
  function refreshProgress() {
    document.querySelectorAll('[data-progress-id]').forEach((node) => {
      const done = state.completed.includes(node.dataset.progressId)
      node.classList.toggle('done', done)
      if (node.classList.contains('lesson-card')) node.querySelector('.card-bottom b').textContent = done ? '已完成 · 复习 ↗' : '开始阅读 ↗'
    })
    const count = document.querySelector('#overall-count')
    if (count) count.textContent = `${state.completed.length} / ${ids.length}`
    const progress = document.querySelector('#overall-progress')
    if (progress) progress.value = state.completed.length
    const next = document.querySelector('#continue-learning')
    if (next) {
      const id = state.lastLesson && !state.completed.includes(state.lastLesson) ? state.lastLesson : ids.find((id) => !state.completed.includes(id))
      next.href = id ? `${BASE}learn/${id}/` : `${BASE}projects/`
      next.textContent = !id ? '进入项目实战 ↗' : (state.lastLesson || state.completed.length ? '继续学习 ↗' : '从第一章开始 ↗')
    }
    const complete = document.querySelector('#mark-complete')
    if (complete) {
      const done = state.completed.includes(document.body.dataset.lesson)
      complete.setAttribute('aria-pressed', String(done))
      complete.textContent = done ? '本章已完成 · 点击撤销' : '标记本章已完成 ✓'
    }
  }
  const menu = document.querySelector('.menu-toggle')
  const sidebar = document.querySelector('#sidebar')
  menu.addEventListener('click', () => {
    const open = menu.getAttribute('aria-expanded') !== 'true'
    menu.setAttribute('aria-expanded', String(open))
    menu.setAttribute('aria-label', open ? '收起课程导航' : '展开课程导航')
    sidebar.classList.toggle('open', open)
  })
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') { sidebar.classList.remove('open'); menu.setAttribute('aria-expanded', 'false'); menu.setAttribute('aria-label', '展开课程导航'); document.querySelector('#search-results').hidden = true }
  })
  document.addEventListener('click', (event) => {
    if (!event.target.closest('.global-search')) document.querySelector('#search-results').hidden = true
    if (sidebar.classList.contains('open') && !sidebar.contains(event.target) && !menu.contains(event.target)) { sidebar.classList.remove('open'); menu.setAttribute('aria-expanded', 'false'); menu.setAttribute('aria-label', '展开课程导航') }
  })
  const lesson = document.body.dataset.lesson
  if (lesson && ids.includes(lesson)) { persist({ lastLesson: lesson }) }
  document.querySelector('#mark-complete')?.addEventListener('click', () => {
    syncLatest()
    const saved = persist({ completion: { id: lesson, done: !state.completed.includes(lesson) } })
    refreshProgress()
    toast(saved ? '学习进度已保存' : '浏览器存储不可用，进度仅保留在本次页面中')
  })
  refreshProgress()
  const note = document.querySelector('#lesson-note')
  if (note) {
    note.value = state.notes[lesson]?.text || ''
    note.maxLength = 100000
    const status = document.querySelector('.note-status')
    status.textContent = storageOK ? '笔记保存在此浏览器，可到“我的笔记”导出。' : '浏览器存储不可用，建议及时导出备份。'
    note.addEventListener('input', () => {
      const saved = persist({ note: { id: lesson, value: { text: note.value, updatedAt: new Date().toISOString() } } })
      status.textContent = saved ? '已自动保存' : '暂时无法保存，请复制笔记以防丢失。'
    })
  }
  document.querySelectorAll('.quiz').forEach((form) => {
    const answer = Number(form.dataset.answer)
    const show = (value) => {
      const feedback = form.querySelector('.quiz-feedback')
      const correct = value === answer
      feedback.textContent = correct ? '✓ 回答正确。' : '再想一想：可以对照下面的解释重新作答。'
      feedback.classList.toggle('correct', correct)
      feedback.hidden = false
      form.querySelector('.quiz-explanation').hidden = false
    }
    const saved = state.quizzes[lesson]?.[form.dataset.quiz]
    if (saved) { const option = form.querySelector(`input[value="${saved.answer}"]`); if (option) { option.checked = true; show(saved.answer) } }
    form.addEventListener('submit', (event) => {
      event.preventDefault()
      const selected = form.querySelector('input:checked')
      if (!selected) return
      const value = Number(selected.value)
      show(value)
      persist({ quiz: { id: lesson, number: form.dataset.quiz, value: { answer: value, correct: value === answer } } })
    })
  })
  document.querySelectorAll('pre').forEach((pre) => {
    const code = pre.querySelector('code')
    if (!code) return
    const button = document.createElement('button')
    button.className = 'copy-code'
    button.type = 'button'
    button.textContent = '复制代码'
    button.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(code.textContent); button.textContent = '已复制'; setTimeout(() => { button.textContent = '复制代码' }, 1500) } catch { toast('复制失败，请选中代码手动复制。') }
    })
    pre.append(button)
  })
  if (window.IntersectionObserver) {
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting)
      if (!visible.length) return
      document.querySelectorAll('.toc a').forEach((a) => a.classList.toggle('active', a.getAttribute('href') === `#${visible[0].target.id}`))
    }, { rootMargin: '-85px 0px -60% 0px', threshold: 0 })
    document.querySelectorAll('.prose section').forEach((section) => observer.observe(section))
  }
  // Search is entirely client-side. User text is never interpolated as HTML.
  let indexPromise
  const search = document.querySelector('#global-search')
  const results = document.querySelector('#search-results')
  let searchRequest = 0
  search.addEventListener('input', async () => {
    const request = ++searchRequest
    const query = search.value.trim().toLowerCase()
    if (!query) { results.hidden = true; return }
    results.hidden = false
    results.textContent = '正在查找…'
    try {
      indexPromise ||= fetch(BASE + 'search-index.json').then((r) => { if (!r.ok) throw new Error(); return r.json() }).catch((error) => { indexPromise = null; throw error })
      const index = await indexPromise
      if (request !== searchRequest) return
      const words = query.split(/\s+/)
      const matches = index.filter((item) => words.every((word) => (item.title + ' ' + item.text).toLowerCase().includes(word))).sort((a, b) => Number(b.title.toLowerCase().includes(query)) - Number(a.title.toLowerCase().includes(query))).slice(0, 12)
      results.replaceChildren()
      if (!matches.length) { results.textContent = '没有找到内容，试试“上下文”“KV cache”或“评测”。'; return }
      for (const item of matches) {
        const a = document.createElement('a')
        a.href = item.url
        if (item.url.startsWith('https://')) { a.target = '_blank'; a.rel = 'noopener noreferrer' }
        const title = document.createElement('b'); title.textContent = item.title
        const small = document.createElement('small'); small.textContent = `${item.type} · ${item.text.replace(/\s+/g, ' ').slice(0, 65)}…`
        a.append(title, small); results.append(a)
      }
    } catch { if (request === searchRequest) results.textContent = '搜索索引暂时无法加载，请通过章节目录浏览。' }
  })
  let category = 'all'
  const resourceInput = document.querySelector('#resource-search')
  function filterResources() {
    const query = (resourceInput?.value || '').trim().toLowerCase()
    let count = 0
    document.querySelectorAll('.resource-card').forEach((card) => {
      card.hidden = !(category === 'all' || card.dataset.category === category) || !card.dataset.filterText.toLowerCase().includes(query)
      if (!card.hidden) count++
    })
    document.querySelector('#resource-count').textContent = `${count} 份资料`
    document.querySelector('#resource-empty').hidden = count !== 0
  }
  document.querySelectorAll('.filter').forEach((button) => button.addEventListener('click', () => {
    category = button.dataset.filter
    document.querySelectorAll('.filter').forEach((b) => { b.classList.toggle('selected', b === button); b.setAttribute('aria-pressed', String(b === button)) })
    filterResources()
  }))
  resourceInput?.addEventListener('input', filterResources)
  document.querySelector('#glossary-search')?.addEventListener('input', (event) => {
    const query = event.target.value.trim().toLowerCase()
    let count = 0
    document.querySelectorAll('.term').forEach((term) => { term.hidden = !term.dataset.filterText.toLowerCase().includes(query); if (!term.hidden) count++ })
    document.querySelector('#glossary-count').textContent = count ? `${count} 个概念` : '没有匹配概念，请换一个关键词。'
  })
  function download(name, content, type) {
    const url = URL.createObjectURL(new Blob([content], { type }))
    const a = document.createElement('a'); a.href = url; a.download = name; a.click()
    setTimeout(() => URL.revokeObjectURL(url), 3000)
  }
  const chapterTitles = Object.fromEntries([...document.querySelectorAll('.chapter-nav')].map((a) => [a.dataset.progressId, a.textContent.trim()]))
  function renderNotebook() {
    const list = document.querySelector('#notebook-list')
    if (!list) return
    const noted = ids.filter((id) => state.notes[id]?.text.trim())
    const scores = Object.values(state.quizzes).flatMap((q) => Object.values(q))
    document.querySelector('#notebook-summary').textContent = `已完成 ${state.completed.length} / 12 章　 ·　${noted.length} 篇笔记　 ·　已答 ${scores.length} / 24 题，当前正确 ${scores.filter((q) => q.correct).length} 题`
    list.replaceChildren()
    if (!noted.length) {
      const empty = document.createElement('div'); empty.className = 'empty-state'
      empty.textContent = '还没有笔记。每篇教程底部都可以记录你的理解、疑问和实验发现。'
      const a = document.createElement('a'); a.className = 'text-link'; a.href = BASE + 'learn/01-agent-loop/#notes'; a.textContent = '去写第一篇 →'; empty.append(document.createElement('br'), a); list.append(empty)
    }
    for (const id of noted) {
      const article = document.createElement('article'); article.className = 'note-card'
      const heading = document.createElement('h2'); const a = document.createElement('a'); a.href = BASE + 'learn/' + id + '/#notes'; a.textContent = chapterTitles[id] + ' ↗'; heading.append(a)
      const date = document.createElement('p'); date.className = 'small'; date.textContent = '更新于 ' + new Date(state.notes[id].updatedAt).toLocaleString('zh-CN')
      const text = document.createElement('pre'); text.textContent = state.notes[id].text
      article.append(heading, date, text); list.append(article)
    }
  }
  renderNotebook()
  window.addEventListener('storage', (event) => {
    if (event.key !== KEY) return
    syncLatest()
    refreshProgress()
    renderNotebook()
    if (note && document.activeElement !== note) note.value = state.notes[lesson]?.text || ''
  })
  document.querySelector('#export-json')?.addEventListener('click', () => { syncLatest(); download('cs2680-learning-backup.json', JSON.stringify({ ...state, exportedAt: new Date().toISOString() }, null, 2), 'application/json') })
  document.querySelector('#export-md')?.addEventListener('click', () => {
    syncLatest()
    let md = '# CS2680 学习笔记\n\n'
    for (const id of ids) md += `## ${chapterTitles[id]}\n\n状态：${state.completed.includes(id) ? '已完成' : '学习中'}\n\n${state.notes[id]?.text || '暂无笔记。'}\n\n`
    download('cs2680-notes.md', md, 'text/markdown;charset=utf-8')
  })
  document.querySelector('#import-notes')?.addEventListener('change', async (event) => {
    const file = event.target.files[0]
    if (!file) return
    const status = document.querySelector('#import-status')
    try {
      if (file.size > 10000000) throw new Error('备份文件超过 10 MB，请检查文件是否正确。')
      const incoming = validateState(JSON.parse(await file.text()))
      const saved = persist({ imported: incoming }); refreshProgress(); renderNotebook()
      status.textContent = saved ? '备份已合并并保存。' : '已合并到本次页面，但浏览器存储不可用，请重新导出备份。'
    } catch (error) { status.textContent = error instanceof SyntaxError ? 'JSON 无法解析，原有学习记录未改变。' : error.message }
    event.target.value = ''
  })
  // Transparent educational models; all figures are calculated locally.
  const core = globalThis.CS2680Core
  function stats(node, values) {
    node.replaceChildren()
    values.forEach(([label, value]) => { const stat = document.createElement('div'); stat.className = 'calc-stat'; const small = document.createElement('small'); small.textContent = label; const b = document.createElement('b'); b.textContent = value; stat.append(small, b); node.append(stat) })
  }
  function bindCalculator(id, outputId, calculate) {
    const form = document.querySelector(id)
    if (!form) return
    const output = document.querySelector(outputId)
    const run = () => {
      if (!form.checkValidity()) { output.textContent = '请先填写范围内的有效参数，原结果已清除。'; return }
      try { calculate(Object.fromEntries([...new FormData(form)].map(([key, value]) => [key, Number(value)])), output) } catch (error) { output.textContent = error.message }
    }
    form.addEventListener('submit', (event) => { event.preventDefault(); run() })
    form.addEventListener('input', run)
    run()
  }
  bindCalculator('#cost-form', '#cost-output', (values, output) => {
    const r = core.cost(values)
    stats(output, [['每任务成本', '$' + r.perTask.toFixed(4)], ['任务总成本', '$' + r.total.toFixed(4)], ['每成功任务成本', r.perSuccess === null ? '无成功任务' : '$' + r.perSuccess.toFixed(4)]])
  })
  bindCalculator('#kv-form', '#kv-output', (values, output) => {
    const r = core.kv(values)
    stats(output, [['每序列 KV cache', r.perSequenceGiB.toFixed(3) + ' GiB'], ['全部驻留序列', r.totalGiB.toFixed(3) + ' GiB']])
  })
  const batchForm = document.querySelector('#batch-form')
  if (batchForm) {
    const run = () => {
      const output = document.querySelector('#batch-output')
      try {
        const data = new FormData(batchForm)
        const raw = data.get('lengths').trim()
        if (!/^\d+(\s*,\s*\d+)*$/.test(raw)) throw new Error('请用英文逗号分隔正整数，例如 2,7,3,5。')
        const lengths = raw.split(',').map(Number)
        const staticResult = core.schedule(lengths, Number(data.get('slots')), false)
        const dynamicResult = core.schedule(lengths, Number(data.get('slots')), true)
        const scale = Math.max(staticResult.makespan, dynamicResult.makespan)
        output.replaceChildren()
        ;[['静态批处理', staticResult], ['连续批处理', dynamicResult]].forEach(([title, result]) => {
          const panel = document.createElement('div'); panel.className = 'schedule-panel'
          const h3 = document.createElement('h3'); h3.textContent = title
          const meta = document.createElement('p'); meta.textContent = `总时长 ${result.makespan} ticks · 吞吐 ${result.throughput.toFixed(2)} token/tick · 平均完成延迟 ${result.meanLatency.toFixed(2)} ticks`
          panel.append(h3, meta)
          for (const row of result.rows) {
            const container = document.createElement('div'); container.className = 'schedule-row'
            const label = document.createElement('span'); label.textContent = `R${row.id + 1}`
            const track = document.createElement('div'); track.className = 'schedule-track'
            const bar = document.createElement('div'); bar.className = 'schedule-bar'; bar.style.left = `${row.start / scale * 100}%`; bar.style.width = `${row.length / scale * 100}%`; bar.textContent = `${row.start}–${row.end}`; bar.title = `请求 ${row.id + 1}：第 ${row.start} tick 开始，第 ${row.end} tick 完成`
            track.append(bar); container.append(label, track); panel.append(container)
          }
          output.append(panel)
        })
      } catch (error) { output.textContent = error.message }
    }
    batchForm.addEventListener('submit', (event) => { event.preventDefault(); run() })
    run()
  }
})()
