# Arma la página desde src/:
#   index.html    -> documento completo (GitHub Pages, servidor local, cualquier navegador)
#   artifact.html -> solo el contenido, para publicarlo como Artifact de Claude (Claude le pone el esqueleto)
import os, subprocess
d = os.path.dirname(os.path.abspath(__file__))
S = lambda f: open(os.path.join(d, "src", f), encoding="utf-8").read()
page = S("head.html") + "<style>\n" + S("style.css") + "</style>" + S("body.html") + "<script>\n" + S("app.js") + "</script>\n"
open(os.path.join(d, "artifact.html"), "w", encoding="utf-8").write(page)
sk = ('<!doctype html><html lang="es"><head><meta charset="utf-8">'
      '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
      '<style>:root{color-scheme:light;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)}'
      'body{margin:0;font:14px system-ui,sans-serif}img{max-width:100%}[hidden]{display:none!important}</style></head><body>')
open(os.path.join(d, "index.html"), "w", encoding="utf-8").write(sk + page + "</body></html>\n")
r = subprocess.run(["node", "-e", "new Function(require('fs').readFileSync(process.argv[1],'utf8'))", os.path.join(d, "src", "app.js")], capture_output=True, text=True)
print("JS OK" if r.returncode == 0 else "JS ERROR:\n" + r.stderr[-800:])
