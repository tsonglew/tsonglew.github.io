#!/usr/bin/env python3
"""Check generated content, internal routes, anchors and runnable chapter examples."""
import json, re, subprocess, sys
from pathlib import Path
from html.parser import HTMLParser
from html import unescape
from urllib.parse import urlsplit, unquote
root=Path(__file__).resolve().parents[1]/'public/cs2680'
class Page(HTMLParser):
    def __init__(self,text):
        super().__init__();self.links=[];self.ids=[];self.feed(text)
    def handle_starttag(self,tag,attrs):
        attrs=dict(attrs)
        if 'id' in attrs:self.ids.append(attrs['id'])
        if tag in ['a','script','link']:
            url=attrs.get('href') or attrs.get('src')
            if url:self.links.append(url)
pages={p:Page(p.read_text()) for p in root.rglob('*.html')}
for path,page in pages.items():
    assert len(page.ids)==len(set(page.ids)),f'duplicate id: {path}'
    for link in page.links:
        u=urlsplit(link)
        if u.scheme or u.netloc or (u.path.startswith('/') and not u.path.startswith('/cs2680/')):continue
        target=(root/unquote(u.path.removeprefix('/cs2680/'))) if u.path.startswith('/cs2680/') else ((path.parent/unquote(u.path)) if u.path else path)
        if target.is_dir():target=target/'index.html'
        assert target.exists(),f'broken link {path}: {link}'
        if u.fragment and target in pages:assert unquote(u.fragment) in pages[target].ids,f'missing anchor {path}: {link}'
chapters=json.loads((root/'content/agents.json').read_text())+json.loads((root/'content/systems.json').read_text())
count=0
for chapter in chapters:
    assert len(chapter['quiz'])==2
    for quiz in chapter['quiz']:assert len(quiz['options'])==4 and 0<=quiz['answer']<4
    for section in chapter['sections']:
        for code in re.findall(r'<pre><code(?: class="(?:language-)?python")?>(.*?)</code></pre>',section['html'],re.S):
            code=unescape(code)
            # JSON-only samples are data rather than Python scripts.
            try: json.loads(code);continue
            except ValueError:pass
            result=subprocess.run([sys.executable,'-c',code],capture_output=True,text=True,timeout=10)
            assert result.returncode==0,f"Example failed in {chapter['id']} / {section['id']}: {result.stderr}"
            count+=1
print(f'Checked {len(pages)} HTML pages, all internal links/anchors, 24 quizzes and {count} runnable examples.')
