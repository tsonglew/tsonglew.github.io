(() => {
  'use strict';

  const REPO = 'https://github.com/morluto/rea';
  const PAGE_SIZE = 30;
  const state = { data: null, commits: [], query: '', month: '', page: 1, filtered: [] };
  const $ = (id) => document.getElementById(id);
  const escape = (value) => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
  const list = (value) => Array.isArray(value) ? value : [];
  const number = (value) => Number(value || 0).toLocaleString('en-US');
  const date = (value) => String(value || '').slice(0, 10);
  const safeUrl = (url) => /^https?:\/\//i.test(String(url || '')) ? escape(url) : '#';
  const commitUrl = (hash) => `${REPO}/commit/${encodeURIComponent(hash)}`;
  const external = (url, label, cls = '') => `<a href="${safeUrl(url)}"${cls ? ` class="${cls}"` : ''} target="_blank" rel="noopener noreferrer">${escape(label)}</a>`;

  function evidence(hashes, sources = []) {
    const seen = new Set(list(hashes).map(commitUrl));
    const links = list(hashes).map(hash => external(commitUrl(hash), String(hash).slice(0, 7)));
    list(sources).forEach((source, index) => {
      const url = typeof source === 'string' ? source : source.url;
      if (!url || seen.has(url)) return;
      seen.add(url);
      links.push(external(url, typeof source === 'string' ? `来源 ${index + 1} ↗` : source.title || `来源 ${index + 1} ↗`));
    });
    return links.length ? `<div class="evidence-links" aria-label="原始依据">${links.join('')}</div>` : '';
  }

  function renderMeta(data) {
    const meta = data.meta || {};
    const commits = Number(meta.commitCount || state.commits.length);
    const authorCount = Array.isArray(meta.authorIdentities) ? meta.authorIdentities.length : Number(meta.authorIdentities || list(data.authors).length);
    const releases = Number(meta.releaseCount ?? list(data.releases).length);
    const months = list(data.months).filter(item => Number(item.count) > 0).length;
    $('stats').innerHTML = [
      [number(commits), '条提交记录'], [number(authorCount), '个 Git 作者署名'], [number(releases), '个 Release'], [number(months), '个月份有提交']
    ].map(([value, label]) => `<div class="stat"><span class="stat-value">${value}</span><span class="stat-label">${label}</span></div>`).join('');
    $('hero-period').textContent = `${date(meta.firstDate)} — ${date(meta.lastDate)}`;
    $('snapshot').textContent = `研究快照 ${date(meta.snapshotDate)} · HEAD ${String(meta.head || '').slice(0, 7)}`;
    $('footer-snapshot').textContent = `独立研究 · 数据截至 ${date(meta.snapshotDate)}`;
  }

  function renderChart(data) {
    const months = list(data.months).slice().sort((a,b) => a.month.localeCompare(b.month));
    const max = Math.max(1, ...months.map(item => Number(item.count)));
    $('activity-chart').style.setProperty('--bars', months.length || 1);
    $('activity-chart').innerHTML = months.map((item, index) => `<button class="chart-bar" type="button" data-month="${escape(item.month)}" aria-label="${escape(item.month)}，${number(item.count)} 条提交；点击筛选" aria-pressed="false" style="--height:${(Number(item.count) > 0 ? Math.max(1.6, Number(item.count)/max*87) : 0).toFixed(2)}%;--bar-min:${Number(item.count) > 0 ? 3 : 0}px"><span class="bar-value" aria-hidden="true">${number(item.count)}</span><span class="bar-fill" aria-hidden="true"></span><span class="bar-month" aria-hidden="true">${escape(Number(item.month.slice(5)))}月</span></button>`).join('');
    $('activity-note').textContent = `${months.filter(item => Number(item.count) > 0).length} 个活跃月份 · 合计 ${number(state.commits.length)} 条提交`;
    $('month-filter').innerHTML = '<option value="">全部月份</option>' + months.slice().reverse().map(item => `<option value="${escape(item.month)}">${escape(item.month)} · ${number(item.count)} 条</option>`).join('');
    $('activity-chart').addEventListener('click', event => {
      const button = event.target.closest('button[data-month]');
      if (!button) return;
      state.month = state.month === button.dataset.month ? '' : button.dataset.month;
      $('month-filter').value = state.month;
      state.page = 1;
      filterCommits();
    });
  }

  function syncChart() {
    document.querySelectorAll('.chart-bar').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.month === state.month)));
    const match = list(state.data.months).find(item => item.month === state.month);
    $('activity-note').textContent = match ? `已选 ${match.month} · ${number(match.count)} 条提交` : `${list(state.data.months).filter(item => Number(item.count) > 0).length} 个活跃月份 · 合计 ${number(state.commits.length)} 条提交`;
  }

  function renderReleases(data) {
    const releases = list(data.releases).slice().sort((a,b) => String(b.date || '').localeCompare(String(a.date || '')));
    $('release-count').textContent = number(releases.length);
    $('release-list').innerHTML = releases.length ? releases.map(release => `<div class="release-item">${external(release.url || `${REPO}/releases/tag/${encodeURIComponent(release.tag)}`, `${release.tag} ↗`)}<time>${escape(date(release.date))}</time></div>`).join('') : '<p class="small-note">截至研究快照，未找到可列出的 GitHub Release。</p>';
  }

  function renderMilestones(data) {
    $('milestones').innerHTML = list(data.milestones).map((item, index) => `<article class="milestone" id="milestone-${escape(item.id || index)}"><time class="milestone-date">${escape(item.date)}</time><div class="milestone-content"><h3>${escape(item.title)}</h3><p class="milestone-summary">${escape(item.summary)}</p>${item.detail ? `<details class="milestone-details"><summary>阅读变更细节<span class="details-icon" aria-hidden="true">+</span></summary><p class="milestone-detail">${escape(item.detail)}</p></details>` : ''}${list(item.themes).length ? `<div class="milestone-themes" aria-label="主题">${item.themes.map(theme => `<span class="theme-tag">${escape(theme)}</span>`).join('')}</div>` : ''}${evidence(item.hashes, item.sources)}</div></article>`).join('');
    $('chapters').innerHTML = list(data.chapters).map((chapter, index) => `<article class="chapter" id="chapter-${escape(chapter.id || index)}"><div class="chapter-heading"><p class="eyebrow">${escape(chapter.eyebrow || `CHAPTER ${String(index + 1).padStart(2, '0')}`)}</p><h3>${escape(chapter.title)}</h3>${chapter.summary ? `<p class="chapter-summary">${escape(chapter.summary)}</p>` : ''}</div><div class="chapter-body">${list(chapter.paragraphs).map(paragraph => `<p>${escape(paragraph)}</p>`).join('')}${evidence(chapter.commitHashes)}${list(chapter.keywords).length ? `<div class="chapter-keywords">本章关键词 / ${chapter.keywords.map(escape).join(' · ')}</div>` : ''}</div></article>`).join('');
  }

  function renderAuthors(data) {
    const all = list(data.authors).slice().sort((a,b) => Number(b.count) - Number(a.count));
    const max = Math.max(1, ...all.map(author => Number(author.count)));
    $('authors').innerHTML = all.slice(0,8).map(author => `<tr><td>${escape(author.name)}</td><td>${number(author.count)}</td><td>${escape(date(author.first))}<span aria-hidden="true"> — </span><span class="sr-only">至</span>${escape(date(author.last))}</td><td><span class="author-bar" aria-hidden="true"><span style="width:${(Number(author.count)/max*100).toFixed(2)}%"></span></span></td></tr>`).join('');
    $('author-note').textContent = `展示提交数最多的 ${Math.min(8, all.length)} 个署名，共 ${number(all.length)} 个署名。完整统计与口径见研究数据及文末方法说明。`;
  }

  function renderResearch(data) {
    $('conclusions').innerHTML = list(data.conclusions).length ? '<span class="judgment-label">研究判断 / WHAT THE HISTORY SUGGESTS</span>' + data.conclusions.map((item,index) => `<article class="conclusion"><span class="conclusion-number">${String(index+1).padStart(2,'0')}</span><div><h3>${escape(String(item.title || "").replace(/^\d+\s*[·.、-]\s*/, ""))}</h3><p>${escape(item.body)}</p></div></article>`).join('') : '';
    $('community-list').innerHTML = list(data.community).map(item => `<article class="community-item"><span class="community-label">${escape(item.label || '社区线索')}</span><div><h3>${escape(item.title)}</h3><p>${escape(item.body)}</p>${item.url ? external(item.url, '阅读原始材料 ↗', 'text-link') : ''}</div></article>`).join('');
    $('methodology').innerHTML = list(data.methodology).map(item => `<li><span>${escape(typeof item === 'string' ? item : item.body || item.text || '')}</span></li>`).join('');
    $('sources').innerHTML = list(data.sources).map(source => `<li>${external(source.url, `${source.title} ↗`)}</li>`).join('');
  }

  function filterCommits() {
    const query = state.query.trim().toLocaleLowerCase();
    state.filtered = state.commits.filter(commit => (!state.month || date(commit.date).startsWith(state.month)) && (!query || commit._search.includes(query)));
    const totalPages = Math.max(1, Math.ceil(state.filtered.length / PAGE_SIZE));
    state.page = Math.min(state.page, totalPages);
    renderCommitPage();
    syncChart();
  }

  function renderCommitPage() {
    const start = (state.page - 1) * PAGE_SIZE;
    const items = state.filtered.slice(start, start + PAGE_SIZE);
    const pages = Math.max(1, Math.ceil(state.filtered.length / PAGE_SIZE));
    $('commit-list').innerHTML = items.map(commit => `<tr><td><time class="commit-date" title="作者时间：${escape(commit.authoredAt || commit.date)}；提交者时间：${escape(commit.committedAt || commit.commitDate)}">${escape(date(commit.date))}</time></td><td>${external(commitUrl(commit.hash), commit.title || '(无提交标题)', 'commit-title')}<a class="commit-hash" href="${commitUrl(commit.hash)}" target="_blank" rel="noopener noreferrer" aria-label="查看提交 ${escape(String(commit.hash).slice(0,7))}">${escape(String(commit.hash).slice(0,7))} ↗</a>${list(commit.prs).map(pr => `<a class="commit-pr" href="${REPO}/pull/${encodeURIComponent(pr)}" target="_blank" rel="noopener noreferrer">#${escape(pr)}</a>`).join('')}</td><td><span class="commit-author">${escape(commit.author)}</span></td></tr>`).join('');
    $('result-status').textContent = `找到 ${number(state.filtered.length)} 条${state.month ? ` · ${state.month}` : ''}${state.query.trim() ? ` · “${state.query.trim()}”` : ''}${items.length ? ` / 显示 ${number(start + 1)}–${number(start + items.length)}` : ''}`;
    $('page-status').textContent = `${state.page} / ${pages}`;
    $('previous-page').disabled = state.page <= 1;
    $('next-page').disabled = state.page >= pages;
    $('empty-state').hidden = items.length !== 0;
  }

  function bindArchive() {
    $('archive-form').addEventListener('submit', event => event.preventDefault());
    $('commit-search').addEventListener('input', event => { state.query = event.target.value; state.page = 1; filterCommits(); });
    $('month-filter').addEventListener('change', event => { state.month = event.target.value; state.page = 1; filterCommits(); });
    $('archive-form').addEventListener('reset', () => {
      state.query = ''; state.month = ''; state.page = 1;
      requestAnimationFrame(filterCommits);
    });
    for (const [id, delta] of [['previous-page', -1], ['next-page', 1]]) {
      $(id).addEventListener('click', () => {
        state.page += delta;
        renderCommitPage();
        $('archive-form').scrollIntoView({ block:'start', behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      });
    }
  }

  function bindReading() {
    const links = Array.from(document.querySelectorAll('.toc>a'));
    const sections = links.map(link => document.querySelector(link.getAttribute('href'))).filter(Boolean);
    let queued = false;
    const update = () => {
      const maxScroll = document.documentElement.scrollHeight - innerHeight;
      $('progress').style.width = `${maxScroll > 0 ? Math.min(100, Math.max(0, scrollY / maxScroll * 100)) : 0}%`;
      let active = sections[0];
      for (const section of sections) if (section.getBoundingClientRect().top <= 150) active = section;
      links.forEach(link => {
        const selected = link.getAttribute('href') === `#${active.id}`;
        link.classList.toggle('active', selected);
        if (selected) link.setAttribute('aria-current', 'location'); else link.removeAttribute('aria-current');
      });
      queued = false;
    };
    addEventListener('scroll', () => { if (!queued) { queued = true; requestAnimationFrame(update); } }, { passive:true });
    addEventListener('resize', update, { passive:true });
    update();
  }

  async function init() {
    bindReading();
    try {
      const response = await fetch('./data.json');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      state.data = data;
      state.commits = list(data.commits).map(commit => ({...commit, _search:`${commit.title} ${commit.hash} ${commit.author}`.toLocaleLowerCase()})).sort((a,b) => String(b.authoredAt || b.date).localeCompare(String(a.authoredAt || a.date)));
      renderMeta(data); renderChart(data); renderReleases(data); renderMilestones(data); renderAuthors(data); renderResearch(data);
      bindArchive(); filterCommits();
    } catch (error) {
      $('load-error').hidden = false;
      $('load-error').innerHTML = '研究数据暂时无法载入。请刷新重试，或直接<a href="./chronicle.md">阅读完整编年史</a>。';
      $('snapshot').textContent = '研究数据暂时无法载入';
      $('result-status').textContent = '提交档案暂时无法载入';
      console.error('Unable to load the REA chronicle data:', error);
    }
  }
  init();
})();
