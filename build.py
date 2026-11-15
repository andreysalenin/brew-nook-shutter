"""Assemble the single-file page. Two variants: CDN importmap (publish) and local importmap (testing)."""
import pathlib

ROOT = pathlib.Path(__file__).parent
css = (ROOT / 'src/style.css').read_text()
body = (ROOT / 'src/body.html').read_text()
js = (ROOT / 'src/main.js').read_text()

# Inline the vessel modules that have been signed off (listed in vessels/ready.txt).
import re
ready = ROOT / 'vessels/ready.txt'
ids = [l.strip() for l in ready.read_text().splitlines() if l.strip()] if ready.exists() else []
parts = []
tcode = (ROOT / 'vessels/triclamp.js').read_text()
tcode = re.sub(r'^export\s+function\s', 'function ', tcode, flags=re.M)
parts.append(f"const createTriClamp = (() => {{\n{tcode}\nreturn createTriClamp;\n}})();")
for vid in ids:
    code = (ROOT / 'vessels' / f'{vid}.js').read_text()
    code = re.sub(r'^export\s+(const|let|var|function|class|async\s+function)\s', r'\1 ', code, flags=re.M)
    code = re.sub(r'^export\s+\{[^}]*\};?\s*$', '', code, flags=re.M)
    parts.append(f"VESSEL_MODULES[{vid!r}] = (() => {{\n{code}\nreturn {{ meta: typeof meta !== 'undefined' ? meta : {{}}, build, defaultOptions: typeof defaultOptions !== 'undefined' ? defaultOptions : {{}} }};\n}})();")
js = js.replace('/*__VESSELS__*/', '\n'.join(parts))
js = js.replace('/*__FABPDF__*/', (ROOT / 'src/fabpdf.js').read_text())
print('vessels inlined:', ids)

VER = '0.169.0'
MAPS = {
    'cdn': {
        'three': f'https://cdn.jsdelivr.net/npm/three@{VER}/build/three.module.js',
        'three/addons/': f'https://cdn.jsdelivr.net/npm/three@{VER}/examples/jsm/',
    },
    'local': {
        'three': '/node_modules/three/build/three.module.js',
        'three/addons/': '/node_modules/three/examples/jsm/',
    },
}

FONTS = ('<link rel="preconnect" href="https://fonts.googleapis.com">\n'
         '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
         '<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700'
         '&family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=swap" rel="stylesheet">')

import json
for name, imap in MAPS.items():
    html = f'''<!DOCTYPE html>
<html lang="en-AU">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Brew Nook Shutter Planner</title>
{FONTS}
<style>
{css}
</style>
<script type="importmap">
{json.dumps({'imports': imap}, indent=2)}
</script>
</head>
<body>
{body}
<script type="module">
{js}
</script>
</body>
</html>
'''
    html = html.replace('__JSPDF_URL__', 'https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js' if name == 'cdn' else '/node_modules/jspdf/dist/jspdf.umd.min.js')
    out = ROOT / ('index.html' if name == 'cdn' else 'test.html')
    out.write_text(html)
    print(out, len(html))
