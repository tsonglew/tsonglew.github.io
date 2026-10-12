#!/usr/bin/env python3
"""Build the static CS2680 companion. Run: python3 scripts/build-cs2680.py."""
import json
import re
from html import escape as esc
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / 'public' / 'cs2680'
BASE = '/cs2680/'
lessons = sorted(json.loads((ROOT/'content/agents.json').read_text()) + json.loads((ROOT/'content/systems.json').read_text()), key=lambda x:x['number'])
resources = json.loads((ROOT/'content/resources.json').read_text())
video_data = json.loads((ROOT/'content/videos.json').read_text())
videos = video_data['items']
lesson_by_id = {x['id']: x for x in lessons}
assert len({v['id'] for v in videos}) == len(videos)
assert all(v['chapters'] and set(v['chapters']) <= lesson_by_id.keys() for v in videos)
assert len(lessons)==12 and len({x['id'] for x in lessons})==12
for x in lessons:
    assert len(x['sections'])>=5 and len(x['quiz'])>=2
    assert all(0<=q['answer']<len(q['options']) for q in x['quiz'])
    assert len({s['id'] for s in x['sections']})==len(x['sections'])

def link(x): return BASE+'learn/'+x['id']+'/'
def ext(url,title): return f'<a href="{esc(url,quote=True)}" target="_blank" rel="noopener noreferrer">{esc(title)} ↗</a>'
nav=[('home','课程总览','', '◫'),('videos','视频导读','videos/','▷'),('lab','交互实验室','lab/','⌁'),('projects','项目实战','projects/','▧'),('glossary','概念速查','glossary/','Aa'),('resources','原始资料','resources/','↗'),('notebook','学习记录','notebook/','▤')]

def video_label(v):
    return '官网推荐 · 非课堂录像' if v['relation'] == 'recommended' else '同主题参考 · 非 CS2680 原课'

def lesson_videos(chapter):
    selected = [v for v in videos if chapter in v['chapters']]
    note = '<p class="video-chapter-note">'+esc(video_data['chapterNotes'][chapter])+'</p>' if chapter in video_data['chapterNotes'] else ''
    entries = ''.join(f'''<article class="lesson-video"><div class="video-meta"><span>{esc(v['platform'])} · {esc(v['language'])}</span><span>{video_label(v)}</span></div><h3>{ext(v['url'],v['title'])}</h3><p>{esc(v['why'])}</p><p class="small"><b>带着问题看</b> · {esc(v['watchFocus'])}</p><a class="text-link" href="{BASE}videos/#{v['id']}">查看来源与观看说明 →</a></article>''' for v in selected)
    return f'''<section id="videos"><h2>配合本章看视频</h2><p>下面按本站章节主题选配。<a href="{BASE}videos/#video-status">为什么没有采用原课录播 →</a></p>{note}<div class="lesson-videos">{entries}</div></section>'''

def shell(title,body,active='home',lesson=None,desc='CS2680 中文配套学习平台，教程、实验、练习、笔记与官方资源。'):
    sidebar=''.join(f'<a class="nav-item {"selected" if active==k else ""}" href="{BASE+p}" {"aria-current=page" if active==k else ""}><span>{icon}</span>{name}</a>' for k,name,p,icon in nav)
    chapters=''
    for group in ['Agent 工程','推理与系统']:
        chapters+=f'<p class="nav-group">{group}</p>'
        for x in lessons:
            if x['part']==group:
                chapters+=f'<a class="chapter-nav {"current" if lesson==x["id"] else ""}" href="{link(x)}" data-progress-id="{x["id"]}" {"aria-current=page" if lesson==x["id"] else ""}><span>{x["number"]:02}</span>{esc(x["title"])}<i aria-hidden="true"></i></a>'
    canonical=BASE if active=='home' and not lesson else (BASE+'learn/'+lesson+'/' if lesson else BASE+active+'/')
    return f'''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#f4f2eb"><title>{esc(title)} · CS2680 学习手册</title><meta name="description" content="{esc(desc,quote=True)}"><link rel="canonical" href="https://tsonglew.github.io{canonical}"><link rel="stylesheet" href="{BASE}platform.css"><script src="{BASE}platform-core.js" defer></script><script src="{BASE}platform.js" defer></script></head><body data-lesson="{lesson or ''}"><a class="skip" href="#main">跳到正文</a><aside class="sidebar" id="sidebar"><a class="wordmark" href="{BASE}">CS<span>2680</span><small>THE LEARNING COMPANION</small></a><nav aria-label="平台导航">{sidebar}</nav><nav aria-label="章节目录" class="chapter-list">{chapters}</nav><div class="sidebar-bottom"><a href="/">← tsonglew 的学习笔记</a><small>自编中文配套教程 · 非官方课程</small></div></aside><div class="workspace"><header class="app-header"><button class="menu-toggle" aria-label="展开课程导航" aria-controls="sidebar" aria-expanded="false">☰</button><a href="{BASE}" class="breadcrumb">学习手册 <span>/</span> {esc(title)}</a><div class="global-search"><label><span aria-hidden="true">⌕</span><input id="global-search" type="search" autocomplete="off" placeholder="搜索课程、概念、资料" aria-label="搜索课程、概念、资料" aria-controls="search-results"></label><div id="search-results" class="search-results" hidden></div></div><nav class="github-links" aria-label="GitHub 项目入口"><a href="https://github.com/tsonglew/tsonglew.github.io" target="_blank" rel="noopener noreferrer" aria-label="在 GitHub 上 Star 项目" title="在 GitHub 上 Star 项目"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3 2.8 5.7 6.3.9-4.6 4.5 1.1 6.3-5.6-3-5.6 3 1.1-6.3L2.9 9.6l6.3-.9Z"/></svg><span>Star</span></a><a href="https://github.com/tsonglew/tsonglew.github.io/issues/new?title=%5BCS2680%5D%20" target="_blank" rel="noopener noreferrer" aria-label="提交 Issue 反馈" title="提交 Issue 反馈"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v5M12 16h.01"/></svg><span>Issue</span></a><a href="https://github.com/tsonglew/tsonglew.github.io/compare" target="_blank" rel="noopener noreferrer" aria-label="创建 Pull Request" title="创建 Pull Request"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="19" r="2"/><path d="M6 7v10M18 17V9a4 4 0 0 0-4-4h-2m3-3-3 3 3 3"/></svg><span>PR</span></a></nav><a class="header-external" href="https://cs2680.com/" target="_blank" rel="noopener noreferrer">课程官网 ↗</a></header><main id="main">{body}</main><footer class="site-footer"><span>CS2680 学习手册 / TSONGLEW</span><span>原创配套讲解 · 资料核验 2026.10.12 · <a href="https://cs2680.com/">课程要求以官网为准 ↗</a></span></footer></div><div id="toast" class="toast" role="status" aria-live="polite"></div></body></html>'''

def save(path,html):
    p=ROOT/path
    p.parent.mkdir(parents=True,exist_ok=True)
    p.write_text(html)

def cards(items):
    return ''.join(f'''<a class="lesson-card" href="{link(x)}" data-progress-id="{x['id']}"><div class="card-top"><span>CHAPTER {x['number']:02}</span><span>{x['level']} · 约 {x['minutes']} 分钟</span></div><h3>{esc(x['title'])}</h3><p>{esc(x['subtitle'])}</p><div class="card-bottom"><span>{len(x['sections'])} 节讲解 · {len(x['quiz'])} 道自测</span><b>开始阅读 ↗</b></div></a>''' for x in items)

home='''<div class="page-pad"><section class="dashboard-hero"><div><p class="kicker"><span class="status-dot"></span> MODERN AI SYSTEMS · FALL 2026</p><h1>从会用 <em>Agent</em>，<br>到读懂整个系统。</h1><p class="hero-lead">把原理读懂，把代码跑通，把结果测清楚。<br>沿着 12 章中文教程，构建你的第一个 Agent 系统。</p><div class="hero-actions"><a class="button primary" id="continue-learning" href="/cs2680/learn/01-agent-loop/">从第一章开始 <span>↗</span></a><a class="button plain" href="/cs2680/lab/">先做一个实验 →</a></div></div><div class="stack-sketch" aria-label="从 Agent 循环到推理系统的学习路径"><div class="sketch-label">A SYSTEM, LAYER BY LAYER</div><div class="sketch-row"><span>01—06</span><b>Agent engineering</b><small>循环 · 工具 · 上下文 · 评测</small></div><div class="sketch-arrow">↓</div><div class="sketch-row"><span>07—12</span><b>Inference & systems</b><small>成本 · 推理 · 缓存 · 调度</small></div><div class="sketch-foot">READ → BUILD → MEASURE</div></div></section><div class="overview-strip"><div><b>12</b><span>完整中文教程</span></div><div><b>24</b><span>随堂自测</span></div><div><b>03</b><span>离线 Python 实验</span></div><div class="overall-progress"><span>已完成 <b id="overall-count">0 / 12</b></span><progress id="overall-progress" max="12" value="0" aria-label="教程完成进度"></progress></div></div><section class="onboarding"><span class="eyebrow">FIRST THINGS FIRST</span><p>先读一章，再跑一个实验。Python 基础薄弱时先熟悉字典、函数与异常；学习后半程前补齐并发、内存和延迟概念。<b>本站提供独立编写的中文配套讲解，原始课件与正式作业要求请查看官网。</b></p></section>'''
for i,group in enumerate(['Agent 工程','推理与系统']):
    home+=f'<section class="course-section"><div class="section-title"><div><p class="kicker">PART {"I" if i==0 else "II"} / {"BUILD THE AGENT" if i==0 else "OWN THE SYSTEM"}</p><h2>{group}</h2></div><p>{"让模型走出对话框，学会调用、记忆与验证。" if i==0 else "沿着一次请求，理解每个 token 背后的代价。"}</p></div><div class="lesson-grid">{cards([x for x in lessons if x["part"]==group])}</div></section>'
home+='''<section class="workbench-banner"><div><p class="kicker">LESS READING LIST. MORE LEARNING.</p><h2>读完之后，留下可验证的结果。</h2><p>交互算例帮你建立直觉，离线实验帮你观察行为，项目练习帮你把知识连起来。</p></div><a class="button primary" href="/cs2680/projects/">进入项目实战 ↗</a></section><div class="utility-grid"><a href="/cs2680/videos/"><b>视频导读 ↗</b><p>YouTube 与 Bilibili 精选视频，按章节配合阅读。</p></a><a href="/cs2680/lab/"><b>交互实验室 ↗</b><p>成本、KV cache 与调度算例，无需 GPU。</p></a><a href="/cs2680/glossary/"><b>概念速查 ↗</b><p>从 harness 到 TTFT，遇到术语随时查。</p></a><a href="/cs2680/notebook/"><b>学习记录 ↗</b><p>查看学习进度、自测成绩，导出已有笔记。</p></a></div><p class="quiet-note">进度与笔记仅保存在当前浏览器，可在笔记页导出备份；不会上传到服务器。</p></div>'''
save('index.html',shell('课程总览',home))

for index,x in enumerate(lessons):
    sections=''.join(f'<section id="{esc(s["id"],quote=True)}"><h2>{esc(s["title"])}</h2>{s["html"]}</section>' for s in x['sections'])
    toc=''.join(f'<a href="#{esc(s["id"],quote=True)}">{esc(s["title"])}</a>' for s in x['sections'])
    quiz=''
    for n,q in enumerate(x['quiz']):
        quiz+=f'<form class="quiz" data-answer="{q["answer"]}" data-quiz="{n}"><fieldset><legend>{n+1}. {esc(q["question"])}</legend>'
        quiz+=''.join(f'<label><input type="radio" name="answer" value="{a}" required><span>{esc(option)}</span></label>' for a,option in enumerate(q['options']))
        quiz+=f'</fieldset><button class="button secondary" type="submit">检查答案</button><p class="quiz-feedback" role="status" hidden></p><p class="quiz-explanation" hidden>{esc(q["explanation"])}</p></form>'
    exercise=x['exercise']
    labname='agent_loop.py' if index<4 else ('evaluate.py' if index<7 else 'scheduler.py')
    body=f'''<div class="reader-layout"><article class="reader"><header class="lesson-header"><p class="kicker">CHAPTER {x['number']:02} / {x['part']}</p><h1>{esc(x['title'])}</h1><p class="lesson-deck">{esc(x['subtitle'])}</p><div class="lesson-meta"><span>{x['level']}</span><span>建议阅读 {x['minutes']} 分钟，练习另计</span><span>自编配套教程</span></div><div class="goals"><b>读完这一章，你应该能</b><ul>{''.join('<li>'+esc(g)+'</li>' for g in x['goals'])}</ul></div></header><div class="prose">{sections}<section id="exercise" class="exercise"><p class="kicker">LEARN BY DOING</p><h2>{esc(exercise['title'])}</h2><ol>{''.join('<li>'+esc(t)+'</li>' for t in exercise['steps'])}</ol><h3>验收标准</h3><ul>{''.join('<li>'+esc(t)+'</li>' for t in exercise['acceptance'])}</ul><a href="{BASE}labs/cs2680-labs.zip" download>下载配套离线实验包 ↓</a><span class="small"> · 脚本使用模拟模型与数据，运行无需 API。</span></section><section id="quiz"><h2>合上书，检查一下</h2><p>先作答，再看解释。答错的地方，正好是值得再读一遍的地方。</p>{quiz}</section>{lesson_videos(x["id"])}<section id="sources"><h2>继续读原始资料</h2><ul class="source-list">{''.join('<li>'+ext(s['url'],s['title'])+'</li>' for s in x['sources'])}</ul></section></div><div class="lesson-completion"><button id="mark-complete" class="button primary" aria-pressed="false">标记本章已完成 ✓</button><span class="small">完成状态与自测成绩独立记录。</span></div><nav class="lesson-pagination" aria-label="上一章和下一章">{('<a href="'+link(lessons[index-1])+'">← '+esc(lessons[index-1]['title'])+'</a>') if index>0 else '<a href="/cs2680/">← 课程总览</a>'}{('<a href="'+link(lessons[index+1])+'">'+esc(lessons[index+1]['title'])+' →</a>') if index<11 else '<a href="/cs2680/projects/">进入项目实战 →</a>'}</nav></article><aside class="toc"><p>本章目录</p>{toc}<a href="#exercise">动手练习</a><a href="#quiz">随堂自测</a><a href="#videos">配套视频</a><a href="#sources">原始资料</a><div class="toc-tip">每次只改变一个变量，<br>把“感觉更好”变成数据。</div></aside></div>'''
    save('learn/'+x['id']+'/index.html',shell(x['title'],body,active='',lesson=x['id'],desc=x['subtitle']))

# Video guide: keep source provenance separate from chapter recommendations.
video_cards = ''
for n, v in enumerate(videos, 1):
    chapter_links = ''.join(f'<a href="{link(lesson_by_id[c])}">{lesson_by_id[c]["number"]:02} / {esc(lesson_by_id[c]["title"])}</a>' for c in v['chapters'])
    filter_text = ' '.join([v['title'], v['author'], v['language'], v['why'], v['watchFocus'], video_label(v)])
    video_cards += f'''<article id="{v['id']}" class="video-card" data-platform="{esc(v['platform'],quote=True)}" data-relation="{v['relation']}" data-chapters="{' '.join(v['chapters'])}" data-filter-text="{esc(filter_text,quote=True)}">
      <div class="video-card-top"><span class="video-number">{n:02}</span><div><p class="video-meta">{esc(v['platform'])} <span>·</span> {esc(v['language'])}</p><span class="video-badge {'official-pick' if v['relation']=='recommended' else ''}">{video_label(v)}</span></div></div>
      <h2>{ext(v['url'],v['title'])}</h2><p class="video-author">{esc(v['author'])}</p>
      <p class="video-reason">{esc(v['why'])}</p><div class="video-focus"><b>带着问题看</b><p>{esc(v['watchFocus'])}</p></div>
      <div class="video-chapters" aria-label="配套章节">{chapter_links}</div>
      <p class="video-access">{esc(v['access'])}</p><div class="video-actions">{ext(v['url'],'打开视频')}{ext(v['sourceUrl'],'来源依据')}</div>
    </article>'''
chapter_options = ''.join(f'<option value="{x["id"]}">{x["number"]:02} · {esc(x["title"])}</option>' for x in lessons)
body = f'''<div class="page-pad video-page"><header class="page-heading video-heading"><p class="kicker">WATCH WITH A QUESTION</p><h1>读一节，再看一段。</h1><p>让讲解补上文字之外的直觉。{len(videos)} 份视频按本站 12 章主题选配，每份都说明来源、选用理由和观看重点。</p><div class="video-overview"><span><b>02</b> 官网推荐</span><span><b>{len(videos)-2:02}</b> 同主题参考</span><a href="#video-catalog">挑选本章视频 ↓</a></div></header>
    <section id="video-status" class="video-policy" aria-labelledby="video-policy-title"><p class="kicker">SOURCE CHECK / {esc(video_data['checkedAt'])}</p><h2 id="video-policy-title">为什么没有使用 CS2680 原课录像？</h2>
    <p><b>课程官方 FAQ 明确说明不录制课堂视频。</b>在 “Will lectures be recorded?” 一项中，回答是 <q lang="en">No, the lectures will not be recorded.</q> 因此本站采用官网推荐视频与其他课程的同主题讲解。{ext('https://cs2680.com/policy','查看官方答复')}</p>
    <p>其中 2 部由 CS2680 官网列为推荐阅读，其余为本站选配。<b>这里的章节映射不等于 CS2680 官方视频目录，所有条目均非原课录播。</b></p>
    <details><summary>查看检索范围、课程进度与来源说明</summary>
    <ul><li><b>公开检索。</b>核对了官网、课表、政策 FAQ 与教师主页，并以 CS2680、Modern AI Systems、Juncheng Yang、哈佛 CS2680 检索 YouTube 和 Bilibili 公开索引，未找到可核验的原课录播。Bilibili 站内搜索接口返回访问限制，本次主要通过公开网页索引发现候选，再逐项核对视频页面和作者信息；未覆盖登录后或校内资源。</li>
    <li><b>课程进度。</b>2026 年秋季课程的系统部分计划从 10 月 19 日开始，截至 10 月 12 日尚未开讲。即使查找当期材料，也不能把其他年份或其他学校的视频当作本课后半程录播。{ext('https://cs2680.com/','核对官网课表')}</li>
    <li><b>嘉宾讲座。</b>官网另有未经嘉宾明确同意不得录制、拍照或传播的规定。这与 FAQ 的“不录制课堂视频”是两条独立说明，本站未转载任何视频文件。{ext('https://cs2680.com/policy','查看政策原文')}</li></ul>
    <p>已核对所列视频的标题、发布者与来源页面，未逐部完整观看。YouTube 的访问、Bilibili 的画质或字幕、课程平台的登录要求可能变化，以播放页为准。</p></details></section>
    <section id="video-catalog" aria-labelledby="video-catalog-title"><div class="section-title"><div><p class="kicker">THE VIDEO SHELF</p><h2 id="video-catalog-title">按你正在学的章节挑选</h2></div><p>先看“带着问题看”，再打开视频。</p></div>
    <form id="video-filters" class="video-filters" role="search" aria-label="筛选视频"><label>对应章节<select id="video-chapter"><option value="all">全部章节</option>{chapter_options}</select></label><label>播放平台<select id="video-platform"><option value="all">全部平台</option><option>YouTube</option><option>Bilibili</option></select></label><label>与课程的关系<select id="video-relation"><option value="all">全部来源</option><option value="recommended">官网推荐</option><option value="reference">同主题参考</option></select></label><label class="video-keywords">关键词<input id="video-search" type="search" placeholder="如：中文、KV cache、评测" autocomplete="off"></label><button type="reset" class="button secondary">重置</button></form>
    <p id="video-count" class="small" role="status" aria-live="polite">{len(videos)} 份视频</p><p id="video-empty" class="video-empty" hidden>没有符合条件的视频，试试减少筛选条件，或点击“重置”。</p><div class="video-grid">{video_cards}</div><noscript><p>未启用 JavaScript，已显示全部视频；每张卡片的章节与视频链接仍可使用。</p></noscript></section></div>'''
save('videos/index.html', shell('视频导读', body, 'videos', desc='CS2680 配套视频导读：YouTube 与 Bilibili 视频、章节映射、来源核验和选用理由。'))

# Reference shelf: retained verified sources.
labels={'official':'官方课件','practice':'动手实践','reading':'专题阅读','foundation':'补充基础'}
resource_html=''
for category,num,title,description,source,url,keywords in resources:
    resource_html+=f'<a class="resource-card" href="{url}" target="_blank" rel="noopener noreferrer" data-category="{category}" data-filter-text="{esc(title+description+keywords,quote=True)}"><span class="kicker">{labels[category]} / {esc(source)}</span><h3>{esc(title)} ↗</h3><p>{esc(description)}</p></a>'
body=f'''<div class="page-pad"><div class="page-heading"><p class="kicker">THE ORIGINAL SOURCES</p><h1>把问题带回原始资料。</h1><p>16 份已经核验的课程与参考资料。本站教程帮助理解，课程要求以官方为准。</p></div><a class="video-resource-banner" href="/cs2680/videos/"><span>▷</span><div><b>想跟着视频学？打开视频导读</b><small>按章节挑选 YouTube 与 Bilibili 视频，附来源和选用理由。</small></div><span aria-hidden="true">↗</span></a><div class="filter-bar" role="group" aria-label="资料分类"><button class="filter selected" data-filter="all" aria-pressed="true">全部</button>{''.join(f'<button class="filter" data-filter="{k}" aria-pressed="false">{v}</button>' for k,v in labels.items())}<label class="inline-search"><input type="search" id="resource-search" placeholder="筛选资源" aria-label="筛选资源"></label></div><p id="resource-count" class="small" role="status">16 份资料</p><div class="resource-grid">{resource_html}</div><p id="resource-empty" hidden>没有匹配资料，请更换关键词或分类。</p></div>'''
save('resources/index.html',shell('原始资料',body,'resources'))

terms=[('Agent','能够根据观察选择行动，并通过工具反馈继续推进任务的系统。','01-agent-loop'),('Harness','包围模型的运行环境，负责上下文、工具执行、预算、重试与终止。','01-agent-loop'),('Tool calling','模型生成工具调用请求，由程序校验参数并执行，再把结果送回模型。','02-tools'),('JSON Schema','描述 JSON 数据结构与约束的格式；结构合法不等于业务授权或事实正确。','02-tools'),('Context window','单次调用可容纳的 token 上限。输入、历史、工具结果和输出预算共同竞争空间。','03-context'),('Prompt injection','外部内容把数据伪装成指令，试图改变 Agent 的行为或权限边界。','02-tools'),('RAG','先检索相关证据，再让模型依据证据回答；检索命中并不自动保证答案正确。','04-memory'),('Agent memory','跨步骤或跨会话保留的状态与信息；需要来源、更新时间及失效策略。','04-memory'),('Multi-agent','用多个拥有各自上下文或职责的 Agent 分解工作，需要处理通信和结果合并成本。','05-multi-agent'),('Trace','按时间记录模型调用、工具调用、耗时、结果与错误的执行轨迹。','06-evaluation'),('Baseline','比较优化收益之前固定下来的系统版本、任务集与测量方法。','06-evaluation'),('Success rate','成功任务数除以评测任务总数；必须先定义可执行的成功判据。','06-evaluation'),('Cost per success','评测总成本除以成功任务数，包含失败任务花费；没有成功时应报告不可用或无穷。','07-cost-routing'),('Routing','按任务条件把请求分配给模型、工具或服务实例，需计入分类与失败回退成本。','07-cost-routing'),('Prefill','处理输入 token、生成后续推理所需状态的阶段，长输入往往使这一阶段更重。','08-serving'),('Decode','利用已有状态逐 token 生成输出的阶段，资源瓶颈与 prefill 不一定相同。','08-serving'),('TTFT','Time To First Token，从请求起点到首个输出 token 的时间，口径应说明是否含排队和网络。','08-serving'),('ITL / TPOT','ITL 是相邻输出 token 的间隔；TPOT 常按首 token 后的总时间除以剩余 token 数计算。','08-serving'),('KV cache','缓存注意力中的 Key 与 Value，避免对历史 token 重复计算；仍需读取缓存。','09-kv-cache'),('GQA','Grouped-Query Attention，多组查询头共享较少的 KV 头；KV 缓存按 KV 头数计算。','09-kv-cache'),('Prefix caching','复用已经计算过的相同输入前缀状态，主要减少重复前缀的 prefill 工作。','09-kv-cache'),('Continuous batching','在生成迭代之间移除已完成请求、加入新请求，提高服务资源利用率。','10-batching'),('Throughput','单位时间完成的工作量，可按请求/秒或 token/秒度量，必须给出口径。','10-batching'),('Tail latency','延迟分布的高分位数，如 p95、p99；平均值可能隐藏少量很慢的请求。','10-batching'),('Quantization','用较低精度表达权重或激活，减少存储与传输，但速度和质量收益依赖实现与负载。','11-quantization'),('Speculative decoding','先由草稿机制提出候选 token，再由目标模型验证；效率取决于接受率和验证开销。','11-quantization'),('Profiling','测量各阶段实际耗时与资源使用，以证据定位性能瓶颈。','12-full-stack'),('Amdahl’s law','只优化系统的一部分时，加速上限受未被优化部分限制。','12-full-stack')]
body='''<div class="page-pad"><div class="page-heading"><p class="kicker">A SHARED VOCABULARY</p><h1>读到陌生概念，来这里。</h1><p>先用一句话建立直觉，再回到对应章节看完整机制与边界。</p></div><label class="wide-search"><span>查找概念</span><input id="glossary-search" type="search" placeholder="例如 KV、吞吐、上下文" aria-label="查找概念"></label><p id="glossary-count" class="small" role="status">28 个概念</p><dl class="glossary">'''
for name,definition,chapter in terms:
    body+=f'<div class="term" data-filter-text="{esc(name+definition,quote=True)}"><dt>{esc(name)}</dt><dd>{esc(definition)}<a href="{BASE}learn/{chapter}/">读对应章节 →</a></dd></div>'
body+='</dl></div>'
save('glossary/index.html',shell('概念速查',body,'glossary'))

# Notebook content is built with safe DOM APIs from local storage.
body='''<div class="page-pad"><div class="page-heading"><p class="kicker">MAKE THE KNOWLEDGE YOURS</p><h1>查看你的学习记录。</h1><p>章节进度、自测成绩与已有笔记保存在当前浏览器。导出 JSON 可用于恢复，Markdown 适合阅读与整理。</p></div><div class="notebook-actions"><button class="button primary" id="export-json">导出学习备份 ↓</button><button class="button secondary" id="export-md">导出 Markdown ↓</button><label class="button secondary" for="import-notes">导入 JSON 备份 ↑</label><input type="file" id="import-notes" accept="application/json,.json" class="file-input"><span id="import-status" class="small" role="status"></span></div><p class="quiet-note">导入会合并完成记录与笔记；同一章笔记冲突时保留时间较新的记录。仅支持本平台导出的备份。</p><div id="notebook-summary" class="summary-strip"></div><div id="notebook-list"></div><noscript>笔记功能需要启用 JavaScript；教程正文不受影响。</noscript></div>'''
save('notebook/index.html',shell('学习记录',body,'notebook'))

# Project sequence follows the public assignment themes, with original self-study milestones.
projects=[('01','观察执行过程','Mads-Lens','01-agent-loop','用一个真实任务记录 Agent 的每次工具调用，整理可阅读的执行轨迹。',['挑选一个可以用脚本检验的小任务，明确输入与预期输出。','运行离线 agent_loop.py，理解日志字段，再观察一个你实际使用的 Agent。','制作轨迹列表，显示步骤、工具参数、工具结果、状态和耗时。'],['成功和失败的执行都能被展示。','能指明一次无效调用的原因，而非只展示最终答案。'],'本地 Python；使用商业工具时需自行准备访问权限'),('02','写自己的循环','Mads-Loop','02-tools','搭建带参数校验、重试预算与终止条件的 Agent runtime。',['从 tools 和 model 两个接口开始，让模拟模型走完工具调用闭环。','加入未知工具、非法参数和失败工具的测试任务。','接入自己的模型 API 前，先用离线测试验证所有终止路径。'],['失败会返回结构化错误，不会无限重试。','达到步数预算能够终止，trace 可以复现行为。'],'Python 标准库；接入真实模型是可选扩展'),('03','测量后再优化','Mads-Opt','06-evaluation','固定评测集，在保持任务质量的约束下比较两个策略的成本。',['运行 evaluate.py，识别成功判据与模拟 token 口径。','将任务分成开发集和保留集，预先写下改动假设。','只改变一项策略，报告成功率、总成本和成功任务成本。'],['保留失败任务，不挑选漂亮的样本。','成本表标明模拟、估算或真实账单的来源。'],'Python 标准库；真实 API 费用另计'),('04','接管推理服务','Mads-Serve','08-serving','在合适硬件上部署开放权重模型，评估质量差异与延迟。',['先用实验室估算 KV cache，列出权重和运行时额外显存。','按 vLLM 当前官方文档选择支持的硬件、模型和版本。','复用已有评测集，记录 TTFT、输出 token 数、请求耗时和成功率。'],['提供硬件、精度、上下文长度、并发和版本记录。','对能力损失分类，区分模型能力与工具协议错误。'],'需要兼容的计算环境；没有 GPU 可先做计算与调度实验'),('05','完成全栈实验报告','Mads-Stack','12-full-stack','用可复现的实验说明，哪一层的优化对整个任务最有效。',['画出模型、工具和排队的耗时分布，选取最大且可改变的一项。','写出假设、控制变量、预期指标，再做优化。','运行同一负载，保存原始记录，解释收益与质量代价。'],['至少一组对照实验，失败假设也要保留。','别人能根据环境与命令复现结果，结论不超出测量范围。'],'继承前面项目环境；无需为了形式使用多 Agent')]
body='''<div class="page-pad"><div class="page-heading"><p class="kicker">ONE SYSTEM, FIVE MILESTONES</p><h1>让学习长成一个项目。</h1><p>下面是围绕官方五次作业主题设计的自学里程碑，包含本站建议的交付物。正式提交、模型限制和评分规则，请阅读官方作业。</p><a class="text-link" href="https://cs2680.com/assignments/" target="_blank" rel="noopener noreferrer">打开官方作业要求 ↗</a></div><div class="project-list">'''
for number,title,name,chapter,summary,steps,checks,env in projects:
    body+=f'<article class="project"><div class="project-number">{number}</div><div><p class="kicker">{name}</p><h2>{title}</h2><p>{summary}</p><p class="environment">环境 · {env}</p><div class="project-columns"><div><h3>实施顺序</h3><ol>{"".join("<li>"+s+"</li>" for s in steps)}</ol></div><div><h3>完成的证据</h3><ul>{"".join("<li>"+s+"</li>" for s in checks)}</ul></div></div><a class="text-link" href="{BASE}learn/{chapter}/">回到对应教程 →</a></div></article>'
body+='''</div><section class="callout"><h2>用同一份实验记录贯穿五个阶段</h2><pre><code>假设：我认为 ______ 是瓶颈，因为 ______。
基线：任务集 / 版本 / 硬件 / 并发 / 模型 / 重复次数。
改动：本轮只改变 ______。
观测：成功率 ______；成本 ______；p50 / p95 延迟 ______。
结论：收益 ______；代价 ______；下一步验证 ______。</code></pre></section></div>'''
save('projects/index.html',shell('项目实战',body,'projects'))

lab='''<div class="page-pad"><div class="page-heading"><p class="kicker">THE SYSTEMS WORKBENCH</p><h1>改一个参数，看清一种关系。</h1><p>三个透明的简化模型，帮助建立直觉。结果是算例，不是实测性能，也不会调用模型或产生费用。</p></div><nav class="lab-tabs" aria-label="实验选择"><a href="#cost-lab">01 / 任务成本</a><a href="#kv-lab">02 / KV cache</a><a href="#batch-lab">03 / 批处理调度</a></nav><section id="cost-lab" class="lab-panel"><div class="section-title"><div><p class="kicker">EXPERIMENT 01</p><h2>便宜的请求，一定更划算吗？</h2></div><a href="/cs2680/learn/07-cost-routing/">配套教程 ↗</a></div><p>比较同一组任务的累计调用成本。单价是假设值，金额单位由你统一设置；这里默认美元 / 百万 token。</p><form id="cost-form" class="calculator"><div class="input-grid"><label>每任务累计输入 token<input name="input" type="number" min="0" max="100000000" step="1" value="12000" required></label><label>每任务累计输出 token<input name="output" type="number" min="0" max="100000000" step="1" value="2000" required></label><label>输入单价 / 百万 token<input name="inputPrice" type="number" min="0" max="10000" step="any" value="1" required></label><label>输出单价 / 百万 token<input name="outputPrice" type="number" min="0" max="10000" step="any" value="4" required></label><label>任务总数<input name="tasks" type="number" min="1" max="1000000" step="1" value="100" required></label><label>成功任务数<input name="successes" type="number" min="0" max="1000000" step="1" value="80" required></label></div><div class="calc-output" id="cost-output" role="status" aria-live="polite"></div><button class="button secondary" type="submit">重新计算 →</button></form><p class="formula">总成本 = 任务数 × (累计输入 × 输入单价 + 累计输出 × 输出单价) / 1,000,000</p><p class="small">成功任务成本 = 总成本 / 成功数。此处假设任务用量一致；实际评测应逐次累计，包含失败与重试，区分缓存计费，另计工具和 GPU 费用。</p></section><section id="kv-lab" class="lab-panel"><div class="section-title"><div><p class="kicker">EXPERIMENT 02</p><h2>上下文增长，显存去了哪里？</h2></div><a href="/cs2680/learn/09-kv-cache/">配套教程 ↗</a></div><p>计算普通 Transformer 注意力的 K、V 张量原始容量。GQA 使用 KV 头数；这里不估计权重、激活、碎片和运行时预留。</p><form id="kv-form" class="calculator"><div class="input-grid"><label>Transformer 层数<input name="layers" type="number" min="1" max="512" value="32" required></label><label>KV 头数<input name="heads" type="number" min="1" max="256" value="8" required></label><label>每头维度<input name="dimension" type="number" min="1" max="1024" value="128" required></label><label>每序列缓存 token 数<input name="tokens" type="number" min="1" max="1000000" value="8192" required></label><label>同时驻留序列数<input name="batch" type="number" min="1" max="4096" value="1" required></label><label>每元素字节数<select name="bytes"><option value="2">2 bytes · FP16 / BF16</option><option value="1">1 byte · 8-bit KV</option><option value="4">4 bytes · FP32</option></select></label></div><div class="calc-output" id="kv-output" role="status" aria-live="polite"></div><button class="button secondary" type="submit">重新计算 →</button></form><p class="formula">KV bytes = 2 × 层数 × KV 头数 × 头维度 × token 数 × 序列数 × 元素字节数</p><p class="small">2 代表 K 和 V 两份张量，1 GiB = 2³⁰ bytes。滑动窗口、共享前缀、MLA 与分布式切分需要额外建模；低比特缓存另有比例因子等开销。</p></section><section id="batch-lab" class="lab-panel"><div class="section-title"><div><p class="kicker">EXPERIMENT 03</p><h2>一个请求结束后，空位交给谁？</h2></div><a href="/cs2680/learn/10-batching/">配套教程 ↗</a></div><p>假设所有请求同时到达，每个活跃请求每 tick 生成一个 token，忽略 prefill 和资源竞争。静态批次等整批结束再换新请求；连续批处理在下一 tick 补空位。</p><form id="batch-form"><div class="input-grid"><label>输出长度，用英文逗号分隔<input name="lengths" type="text" value="2,7,3,5" required></label><label>同时处理的槽位<select name="slots"><option>1</option><option selected>2</option><option>3</option><option>4</option></select></label></div><button class="button secondary" type="submit">运行调度模拟 →</button><p class="small">最多 12 个请求，每个长度为 1–40 的整数。</p></form><div id="batch-output" role="status" aria-live="polite"></div><p class="small">横条表示开始到完成的 tick 区间。吞吐 = 总输出 token / 总 tick。真实服务还受显存、抢占、prefill、批大小和队列策略影响，仿真收益不能直接当作 GPU 加速比。</p></section><section class="download-panel"><div><p class="kicker">TAKE THE LAB HOME</p><h2>在本机，把代码跑起来。</h2><p>三个 Python 标准库实验：Agent 循环、固定任务评测与调度仿真。无需 API key，无需 GPU。</p><pre><code>python3 agent_loop.py
python3 evaluate.py
python3 scheduler.py
python3 -m unittest test_labs.py</code></pre></div><div><a class="button primary" href="/cs2680/labs/cs2680-labs.zip" download>下载离线实验包 ↓</a><a class="text-link" href="/cs2680/labs/README.md">查看实验说明 ↗</a></div></section></div>'''
save('lab/index.html',shell('交互实验室',lab,'lab'))

manifest=[{k:x[k] for k in ['id','number','title','subtitle','part']} for x in lessons]
(ROOT/'chapters.json').write_text(json.dumps(manifest,ensure_ascii=False))
search=[]
for x in lessons:
    search.append({'title':x['title'],'type':'教程','url':link(x),'text':x['subtitle']+' '+re.sub('<[^>]+>',' ', ' '.join(s['title']+' '+s['html'] for s in x['sections']))})
for name,definition,chapter in terms:
    search.append({'title':name,'type':'概念','url':BASE+'learn/'+chapter+'/','text':definition})
for _,_,title,description,source,url,keywords in resources:
    search.append({'title':title,'type':'资料','url':url,'text':description+' '+source+' '+keywords})
for v in videos:
    search.append({'title':v['title'],'type':'视频','url':BASE+'videos/#'+v['id'],'text':' '.join([v['platform'],v['language'],v['author'],v['why'],v['watchFocus'],video_label(v)])})
(ROOT/'search-index.json').write_text(json.dumps(search,ensure_ascii=False))
print(f'Generated {len(lessons)} lessons, {len(search)} search entries, 7 platform pages.')
