from pathlib import Path

root = Path(__file__).resolve().parent
src = root / "src"
template = (src / "template.html").read_text(encoding="utf-8")
app = "\n".join((src / name).read_text(encoding="utf-8") for name in ("sdk.js", "core.js", "auth.js", "tools.js", "events.js"))
assert template.count("/* APP_SCRIPT */") == 1
assert template.count("/* MAIL_SCRIPT */") == 1
html = template.replace("/* APP_SCRIPT */", app).replace("/* MAIL_SCRIPT */", (src / "mail.js").read_text(encoding="utf-8"))
html = html.replace("</head>", "<style>\n" + (src / "upgrade.css").read_text(encoding="utf-8") + "\n</style>\n</head>", 1)
(root / "index.html").write_text(html, encoding="utf-8")
print("V5 build OK: index.html (GitHub Pages entry)")
