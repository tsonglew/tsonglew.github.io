// All visuals use local example data. This page does not connect accounts or persist preferences.
const tabs = [...document.querySelectorAll('[data-view]')]
const panels = [...document.querySelectorAll('.demo-panel')]
function selectView(tab) {
  for (const item of tabs) {
    const selected = item === tab
    item.setAttribute('aria-selected', String(selected))
    item.tabIndex = selected ? 0 : -1
  }
  for (const panel of panels) panel.hidden = panel.id !== tab.getAttribute('aria-controls')
  for (const item of document.querySelectorAll('[data-nav]')) {
    item.classList.toggle('selected', item.dataset.nav === tab.dataset.view)
  }
}
for (const tab of tabs) {
  tab.addEventListener('click', () => selectView(tab))
  tab.addEventListener('keydown', (event) => {
    const index = tabs.indexOf(tab)
    let next
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % tabs.length
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp')
      next = (index - 1 + tabs.length) % tabs.length
    if (event.key === 'Home') next = 0
    if (event.key === 'End') next = tabs.length - 1
    if (next === undefined) return
    event.preventDefault()
    selectView(tabs[next])
    tabs[next].focus()
  })
}
const narrow = window.matchMedia('(max-width: 600px)')
const tablist = document.querySelector('.experience-tabs')
const syncOrientation = () =>
  tablist?.setAttribute('aria-orientation', narrow.matches ? 'horizontal' : 'vertical')
syncOrientation()
narrow.addEventListener('change', syncOrientation)

const themeToggle = document.getElementById('theme-toggle')
const stage = document.querySelector('.demo-stage')
themeToggle?.addEventListener('click', () => {
  const dark = stage.classList.toggle('dark')
  themeToggle.setAttribute('aria-pressed', String(dark))
  themeToggle.querySelector('span').textContent = dark ? '浅色外观' : '深色外观'
})

const filters = [...document.querySelectorAll('[data-filter]')]
const providers = [...document.querySelectorAll('[data-category]')]
for (const filter of filters) {
  filter.addEventListener('click', () => {
    for (const button of filters) {
      button.setAttribute('aria-pressed', String(button === filter))
      button.classList.toggle('active', button === filter)
    }
    let count = 0
    for (const provider of providers) {
      const visible =
        filter.dataset.filter === 'all' ||
        provider.dataset.category.split(' ').includes(filter.dataset.filter)
      provider.hidden = !visible
      if (visible) count++
    }
    document.getElementById('filter-status').textContent =
      `${filter.textContent}：显示 ${count} 组服务`
  })
}
const heatmap = document.querySelector('.heatmap-grid')
for (let day = 0; day < 35; day++) {
  const cell = document.createElement('i')
  if (day < 2 || day > 31) cell.style.visibility = 'hidden'
  heatmap?.append(cell)
}
