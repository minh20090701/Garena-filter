from pathlib import Path

root = Path(__file__).resolve().parent
src = root / 'src'
template = (src / 'template.html').read_text()
app = '\n'.join((src / name).read_text() for name in ['sdk.js', 'core.js', 'auth.js', 'tools.js', 'events.js'])
html = template.replace('/* APP_SCRIPT */', app).replace('/* MAIL_SCRIPT */', (src / 'mail.js').read_text())
if (src / 'upgrade.css').exists():
    html = html.replace('</head>', '<style>\n' + (src / 'upgrade.css').read_text() + '\n</style>\n</head>')
(root / 'Garena_Filter_Pro_V4.html').write_text(html)
print('Built Garena_Filter_Pro_V4.html')
