from pathlib import Path
from html.parser import HTMLParser
import re
root = Path(__file__).resolve().parents[1]
html=(root/'index.html').read_text(encoding='utf-8')
js=(root/'config.js').read_text(encoding='utf-8')
assert '<script src="./config.js"></script>' in html
assert 'Garena Filter Pro V5' in html
assert '/* APP_SCRIPT */' not in html and '/* MAIL_SCRIPT */' not in html
assert 'service_role' not in js.lower().replace('service_role key',''), 'Do not add secret keys'
assert 'ahungpttcxsujkkchggh' not in html
class IdParser(HTMLParser):
    def __init__(self): super().__init__(); self.ids=[]
    def handle_starttag(self,tag,attrs): self.ids.extend(v for k,v in attrs if k=='id')
p=IdParser();p.feed(html)
assert len(p.ids)==len(set(p.ids)), 'Duplicate id detected'
print('PASS static GitHub Pages checks; %d HTML ids' % len(p.ids))

assert re.search(r"supabaseUrl:\s*'https://[a-z0-9-]+\.supabase\.co/?'", js), 'Missing existing Supabase URL'
assert 'sb_publishable_' in js, 'Missing public Supabase publishable key'
print('PASS existing public Supabase configuration present')
