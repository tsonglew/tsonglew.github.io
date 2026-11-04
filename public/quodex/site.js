// Website-only examples: no network, credentials, account state, or persistence.
const demoTabs = [...document.querySelectorAll('[data-demo-tab]')]
const demoPanels = [...document.querySelectorAll('.demo-panel')]
function selectDemoTab(tab) {
  for (const item of demoTabs) {
    const selected = item === tab
    item.setAttribute('aria-selected', String(selected))
    item.tabIndex = selected ? 0 : -1
  }
  for (const panel of demoPanels) panel.hidden = panel.id !== tab.getAttribute('aria-controls')
}
for (const tab of demoTabs) {
  tab.addEventListener('click', () => selectDemoTab(tab))
  tab.addEventListener('keydown', (event) => {
    const index = demoTabs.indexOf(tab)
    let next
    if (event.key === 'ArrowRight') next = (index + 1) % demoTabs.length
    if (event.key === 'ArrowLeft') next = (index - 1 + demoTabs.length) % demoTabs.length
    if (event.key === 'Home') next = 0
    if (event.key === 'End') next = demoTabs.length - 1
    if (next === undefined) return
    event.preventDefault()
    selectDemoTab(demoTabs[next])
    demoTabs[next].focus()
  })
}

const sampleTokens = [
  12000, 36000, 42000, 18000, 58000, 26000, 47000, 62000, 31000, 0, 54000, 21000, 39000, 65000,
  28000, 44000, 17000, 52000, 34000, 23000, 59000, 41000, 12000, 48000, 30000, 67000, 20000, 46000,
  38000, 25000
]
const heatmap = document.getElementById('demo-heatmap')
const bars = document.getElementById('demo-bars')
const total = document.getElementById('demo-token-total')
const totalTokens = sampleTokens.reduce((sum, value) => sum + value, 0)
if (heatmap && bars && total) {
  total.textContent = (totalTokens / 1000000).toFixed(2) + 'M'
  const palette = ['#e4e2d9', '#bcddd4', '#7bc2b2', '#389d89', '#007c68']
  for (let day = -3; day < 32; day++) {
    const cell = document.createElement('i')
    cell.setAttribute('aria-hidden', 'true')
    if (day < 0 || day >= sampleTokens.length) cell.style.visibility = 'hidden'
    else {
      const value = sampleTokens[day]
      cell.style.backgroundColor = palette[value === 0 ? 0 : Math.min(4, Math.ceil(value / 18000))]
      cell.title = `示例第 ${day + 1} 天：${value.toLocaleString('zh-CN')} tokens`
    }
    heatmap.append(cell)
  }
  const max = Math.max(...sampleTokens)
  for (const [index, value] of sampleTokens.entries()) {
    const bar = document.createElement('i')
    bar.setAttribute('aria-hidden', 'true')
    bar.style.height = Math.max(1, (value / max) * 100) + '%'
    bar.style.backgroundColor = value === 0 ? '#cbc7bc' : '#007c83'
    bar.title = `示例第 ${index + 1} 天：${value.toLocaleString('zh-CN')} tokens`
    bars.append(bar)
  }
  for (const graphic of [heatmap, bars])
    graphic.setAttribute(
      'aria-label',
      `同一份 30 天示例 Token 数据，合计 ${totalTokens.toLocaleString('zh-CN')}；仅用于交互演示`
    )
}
for (const button of document.querySelectorAll('[data-chart]')) {
  button.addEventListener('click', () => {
    const isHeatmap = button.dataset.chart === 'heatmap'
    if (!heatmap || !bars) return
    heatmap.hidden = !isHeatmap
    bars.hidden = isHeatmap
    for (const option of document.querySelectorAll('[data-chart]'))
      option.setAttribute('aria-pressed', String(option === button))
  })
}

const screenshotThemes = {
  light: {
    chart: 'assets/alpha31/token-heatmap.png',
    widget: 'assets/alpha31/heatmap-widget-light.png',
    label: '浅色'
  },
  dark: {
    chart: 'assets/alpha31/token-heatmap-dark.png',
    widget: 'assets/alpha31/heatmap-widget-dark.png',
    label: '深色'
  }
}
const previewSwitch = document.querySelector('.preview-switch')
if (previewSwitch) previewSwitch.hidden = false
for (const button of document.querySelectorAll('[data-screen-theme]')) {
  button.addEventListener('click', () => {
    const theme = screenshotThemes[button.dataset.screenTheme]
    if (!theme) return
    for (const kind of ['chart', 'widget']) {
      const image = document.getElementById(`${kind}-shot`)
      const link = document.getElementById(`${kind}-shot-link`)
      if (!image || !link) continue
      image.src = theme[kind]
      image.alt = `alpha31 debug ${theme.label}${kind === 'chart' ? '30 日 Token 热力图' : '2×2 Codex 热力图桌面组件'}，示例数据`
      link.href = theme[kind]
    }
    for (const option of document.querySelectorAll('[data-screen-theme]'))
      option.setAttribute('aria-pressed', String(option === button))
  })
}

function openLinkedArchive() {
  const target = document.getElementById(window.location.hash.slice(1))
  if (target instanceof HTMLDetailsElement) target.open = true
}
openLinkedArchive()
window.addEventListener('hashchange', openLinkedArchive)
