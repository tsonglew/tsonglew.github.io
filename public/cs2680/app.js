'use strict'
const stages = [
  {
    title: '观察 Agent 如何工作',
    phase: 'PART I · USE',
    description: '阅读导论与 Claude Code 课件。做一个能看到工具调用、执行轨迹与成本的界面。',
    links: [
      ['课程导论', 'https://cs2680.com/slides/1_intro.pdf'],
      ['作业 1 · Mads-Lens', 'https://cs2680.com/assignments/']
    ],
    next: '先观察，再动手。'
  },
  {
    title: '亲手构建 Agent 循环',
    phase: 'PART I · BUILD',
    description: '实现工具调用、上下文管理、重试与终止条件。用真实任务验证它是否真的解决了问题。',
    links: [
      ['上下文与工具设计', 'https://cs2680.com/slides/4_agent_design_1.pdf'],
      ['作业 2 · Mads-Loop', 'https://cs2680.com/assignments/assignment2']
    ],
    next: '写出自己的 Agent。'
  },
  {
    title: '把成功率、成本与速度一起测量',
    phase: 'PART I · OPTIMIZE',
    description: '建立基线，再尝试模型选择、上下文压缩与工具并行。每次修改都用同一组任务比较。',
    links: [
      ['评测专题', 'https://cs2680.com/notes/agent-evaluation'],
      ['作业 3 · 见作业总览', 'https://cs2680.com/assignments/']
    ],
    next: '让每个 token 更有价值。'
  },
  {
    title: '接管模型的推理服务',
    phase: 'PART II · SERVE',
    description: '学习批处理、调度与 KV cache，动手部署开放权重模型。对照 API 基线，诊断能力损失。',
    links: [
      ['vLLM 实践', 'https://docs.vllm.ai/en/latest/getting_started/quickstart/'],
      ['作业 4 · 见作业总览', 'https://cs2680.com/assignments/']
    ],
    next: '走到模型服务的背后。'
  },
  {
    title: '跨越 Agent 与系统，优化全栈',
    phase: 'PART II · CO-DESIGN',
    description:
      '先提出性能假设，再做 profiling。研究量化、推测解码、缓存与路由，记录哪些改变真正有效。',
    links: [
      ['后半程课程安排', 'https://cs2680.com/#schedule'],
      ['作业 5 · 见作业总览', 'https://cs2680.com/assignments/']
    ],
    next: '让整个系统协同工作。'
  }
]
const resources = [
  [
    'official',
    '01 / START HERE',
    '课程导论',
    '先看课程全景、学习目标与作业主线，知道接下来要构建什么。',
    '官方 · PDF',
    'https://cs2680.com/slides/1_intro.pdf',
    'overview 导论'
  ],
  [
    'official',
    '02 / AGENT USE',
    'How Claude Code Works',
    '从 Agent 的使用方式进入系统视角，理解上下文、执行过程与验证。',
    '官方 · PDF',
    'https://cs2680.com/slides/2_agent_use_1.pdf',
    'agent Claude Code'
  ],
  [
    'official',
    '03 / AGENT DESIGN',
    '上下文管理与工具设计',
    '准备自己构建 Agent 时重点阅读，让模型通过工具与环境交互。',
    '官方 · PDF',
    'https://cs2680.com/slides/4_agent_design_1.pdf',
    'context tool Agent'
  ],
  [
    'official',
    '04 / COURSE INDEX',
    '完整课表与课件入口',
    '多 Agent、记忆、评测、成本与推理系统。新课件以官网发布为准。',
    '官方 · 持续更新',
    'https://cs2680.com/#schedule',
    '多智能体 memory schedule'
  ],
  [
    'practice',
    '05 / ASSIGNMENTS',
    '五次作业，一套系统',
    'Mads-Lens → Loop → Opt → Serve → Stack。先读整体要求，再分步实现。',
    '官方 · 作业',
    'https://cs2680.com/assignments/',
    '作业 assignment'
  ],
  [
    'practice',
    '06 / BUILD THE LOOP',
    'Assignment 2 · Agent harness',
    '从 starter archive 开始，实现 Agent 循环，记录轨迹，并运行任务评测。',
    '官方 · 代码与说明',
    'https://cs2680.com/assignments/assignment2',
    'starter code 工具 代码'
  ],
  [
    'practice',
    '07 / ENVIRONMENT',
    '课程环境配置',
    '了解课程使用的工具、API 与计算平台。校外学习需自行准备访问与算力。',
    '官方 · 环境指南',
    'https://cs2680.com/computing/',
    'setup 环境 GPU'
  ],
  [
    'practice',
    '08 / SERVING',
    'vLLM · 从推理到服务',
    '实践离线批量推理与在线服务；按你的硬件平台选择安装方式。',
    'vLLM · 官方文档',
    'https://docs.vllm.ai/en/latest/getting_started/quickstart/',
    '推理 serving GPU vllm'
  ],
  [
    'reading',
    '09 / READING GUIDE',
    'Agent 使用：配套阅读',
    '每份材料都附有背景与阅读理由。适合配合第一阶段课件逐篇查阅。',
    '官方 · 阅读清单',
    'https://cs2680.com/readings/sep-09',
    'skills MCP Claude'
  ],
  [
    'reading',
    '10 / EVALUATION',
    'Agent 评测与基准',
    '学习如何设计评测，关注任务成功率、可靠性、成本与基准选择。',
    '官方 · 专题讲义',
    'https://cs2680.com/notes/agent-evaluation',
    'benchmark eval 评估'
  ],
  [
    'reading',
    '11 / COST & PERFORMANCE',
    '让 Agent 更经济',
    '从模型、推理、上下文、协作与服务资源入手，思考完整任务的成本。',
    '官方 · 专题讲义',
    'https://cs2680.com/notes/cost-effective-agents',
    'token 成本 性能 优化'
  ],
  [
    'foundation',
    '12 / AGENT FUNDAMENTALS',
    'Hugging Face Agents Course',
    '还没有写过 Agent？先学 Unit 1，理解工具与思考—行动—观察循环。',
    'Hugging Face · 交互课程',
    'https://huggingface.co/learn/agents-course/en/unit1/introduction',
    '入门 huggingface 基础'
  ],
  [
    'foundation',
    '13 / SYSTEMS & LLM',
    'Stanford CS336 · 2025',
    '选读第 2 讲 PyTorch 与资源核算、第 5 讲 GPU、第 10 讲推理。',
    'Stanford · 课程与课件',
    'https://cs336.stanford.edu/spring2025/',
    'PyTorch GPU 推理'
  ],
  [
    'foundation',
    '14 / VIDEO COMPANION',
    'CS336 · 官方视频入口',
    '从 Stanford Online 的第一讲进入课程视频，适合喜欢边听边学的人。',
    'Stanford Online · 英文视频',
    'https://www.youtube.com/watch?v=SQ3fZ1sAqXI',
    '视频 youtube 录播'
  ],
  [
    'foundation',
    '15 / COMPUTER SYSTEMS',
    'Operating Systems: Three Easy Pieces',
    '按需补齐并发、虚拟内存与持久化知识。免费在线章节，不必整本读完。',
    'OSTEP · 在线教材',
    'https://pages.cs.wisc.edu/~remzi/OSTEP/',
    '操作系统 并发 内存 教材'
  ],
  [
    'official',
    '16 / PREREQUISITES',
    '先修要求与课程 FAQ',
    '先评估系统基础。了解录播、CUDA、旁听与计算资源的官方说明。',
    '官方 · 阅读起点',
    'https://cs2680.com/policy',
    '要求 faq cuda 先修'
  ]
]
const labels = {
  official: '官方课件',
  practice: '动手实践',
  reading: '专题阅读',
  foundation: '补充基础'
}
const key = 'cs2680-learning-progress-v1'
let completed = new Set()
try {
  const saved = JSON.parse(localStorage.getItem(key) || '[]')
  if (Array.isArray(saved))
    completed = new Set(saved.filter((n) => Number.isInteger(n) && n >= 0 && n < stages.length))
} catch {
  document.querySelector('#storage-note').textContent = '浏览器存储不可用，本次进度仍可记录。'
}
const steps = document.querySelector('#steps')
stages.forEach((s, i) => {
  const el = document.createElement('article')
  el.className = 'step'
  el.innerHTML = `<span class="step-num">0${i + 1}</span><div><div class="step-meta">${s.phase}</div><h3>${s.title}</h3><p>${s.description}</p>${s.links.map(([title, url]) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${title} ↗</a>`).join('')}</div><button class="complete" type="button" aria-label="标记完成：${s.title}" aria-pressed="false" data-stage="${i}"></button>`
  steps.append(el)
})
function updateProgress() {
  document.querySelectorAll('.complete').forEach((button) => {
    const done = completed.has(Number(button.dataset.stage))
    button.setAttribute('aria-pressed', String(done))
    button.textContent = done ? '✓' : ''
    button.setAttribute(
      'aria-label',
      `${done ? '取消完成' : '标记完成'}：${stages[Number(button.dataset.stage)].title}`
    )
    button.closest('.step').classList.toggle('done', done)
  })
  document.querySelector('#progress').value = completed.size
  document.querySelector('#progress-label').textContent = `${completed.size} / ${stages.length}`
  const index = stages.findIndex((_, i) => !completed.has(i))
  const nextLink = document.querySelector('#next-link')
  if (index === -1) {
    document.querySelector('#next-title').textContent = '把经验变成自己的项目。'
    document.querySelector('#next-description').textContent =
      '五个学习阶段已完成。回顾实验记录，选择一个真实问题，继续验证你的设计与优化。'
    nextLink.href = 'https://cs2680.com/'
    nextLink.textContent = '回到课程官网 ↗'
  } else {
    document.querySelector('#next-title').textContent = stages[index].next
    document.querySelector('#next-description').textContent = stages[index].description
    nextLink.href = stages[index].links[0][1]
    nextLink.textContent = `打开${stages[index].links[0][0]} ↗`
  }
}
steps.addEventListener('click', (event) => {
  const button = event.target.closest('.complete')
  if (!button) return
  const id = Number(button.dataset.stage)
  completed.has(id) ? completed.delete(id) : completed.add(id)
  try {
    localStorage.setItem(key, JSON.stringify([...completed]))
  } catch {
    document.querySelector('#storage-note').textContent = '无法持久保存；进度仅在本次打开时有效。'
  }
  updateProgress()
})
updateProgress()
const grid = document.querySelector('#resource-grid')
resources.forEach(([category, number, title, description, source, url, keywords]) => {
  const card = document.createElement('a')
  card.className = 'resource-card'
  card.href = url
  card.target = '_blank'
  card.rel = 'noopener noreferrer'
  card.dataset.category = category
  card.dataset.search = [title, description, source, keywords].join(' ').toLowerCase()
  card.innerHTML = `<div class="card-meta"><span>${number}</span><span class="tag">${labels[category]}</span></div><h3>${title}</h3><p>${description}</p><div class="card-footer"><span>${source}</span><b aria-hidden="true">↗</b></div>`
  grid.append(card)
})
let active = 'all'
function filterResources() {
  const query = document.querySelector('#search').value.trim().toLowerCase()
  let count = 0
  document.querySelectorAll('.resource-card').forEach((card) => {
    const visible =
      (active === 'all' || card.dataset.category === active) &&
      query.split(/\s+/).every((term) => card.dataset.search.includes(term))
    card.hidden = !visible
    if (visible) count++
  })
  document.querySelector('#result-count').textContent =
    `${String(count).padStart(2, '0')} 份精选资源`
  document.querySelector('#empty').hidden = count !== 0
}
document.querySelectorAll('.filter').forEach((button) =>
  button.addEventListener('click', () => {
    active = button.dataset.filter
    document.querySelectorAll('.filter').forEach((item) => {
      item.classList.toggle('active', item === button)
      item.setAttribute('aria-pressed', String(item === button))
    })
    filterResources()
  })
)
document.querySelector('#search').addEventListener('input', filterResources)
filterResources()
