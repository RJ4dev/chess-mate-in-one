"""Make a portable GitHub Pages folder and a one-file offline preview.
Uses esbuild's already-created release/game.js; never downloads at runtime.
"""
from pathlib import Path
import re, shutil, zipfile, hashlib, json
root=Path(__file__).resolve().parent.parent
release=root/'release'
html=(root/'dist/index.html').read_text()
css=(root/'dist/styles.css').read_text()
script=(release/'game.js').read_text()
license=(root/'dist/vendor/CHESS_JS_LICENSE.txt').read_text()
assert '<script' not in script.lower(), 'Unexpected HTML script boundary in bundle'
html=html.replace('<link rel="icon" href="./favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="./styles.css">', '<style>'+css+'</style>')
html=html.replace('<script type="module" src="./js/app.js"></script>', '<script>'+script+'</script>')
html=html.replace('class="brand" href="./"','class="brand" href="#"')
html=html.replace('</head>','<!-- Bundled chess.js license:\n'+license+'\n-->\n</head>')
(release/'index.html').write_text(html)
(root/'dist/standalone.html').write_text(html)
pages=release/'github-pages'
pages.mkdir(exist_ok=True)
(pages/'index.html').write_text(html)
(pages/'.nojekyll').touch()
shutil.copy(root/'dist/vendor/CHESS_JS_LICENSE.txt',pages/'CHESS_JS_LICENSE.txt')
shutil.copy(root/'README.md',pages/'README.md')
with zipfile.ZipFile(release/'mate-in-one-github-pages.zip','w',zipfile.ZIP_DEFLATED) as z:
 for p in sorted(pages.iterdir()):z.write(p,p.name)
with zipfile.ZipFile(release/'mate-in-one-source.zip','w',zipfile.ZIP_DEFLATED) as z:
 for p in sorted(root.rglob('*')):
  if not p.is_file() or any(x in p.parts for x in ['release','vendor-download','.openai','.transfer']):continue
  if p.name in ['qa-mobile.html','standalone.html']:continue
  z.write(p,p.relative_to(root))
for name in ['index.html','mate-in-one-github-pages.zip','mate-in-one-source.zip']:
 p=release/name
 print(json.dumps({'artifact':name,'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}))
