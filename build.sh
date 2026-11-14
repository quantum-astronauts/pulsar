#!/usr/bin/env bash
# Wraps app.html (the page body, also published as the Claude artifact) into
# a standalone installable PWA. core.js and the photos are inlined, so
# index.html works on its own, even opened straight from inside a zip.
set -euo pipefail
cd "$(dirname "$0")"
python3 - <<'PY'
import base64, pathlib
body = pathlib.Path('app.html').read_text()
core = pathlib.Path('core.js').read_text()
body = body.replace('<script src="core.js"></script>', '<script>\n' + core + '\n</script>')
for name in ('earth-limb', 'city-lights'):
    data = base64.b64encode(pathlib.Path(f'img/{name}.jpg').read_bytes()).decode()
    body = body.replace(f'url("img/{name}.jpg")', f'url("data:image/jpeg;base64,{data}")')
head = ('<!doctype html><html lang="en"><head><meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
        '<link rel="manifest" href="manifest.webmanifest"><link rel="icon" href="icon.svg"><meta name="theme-color" content="#020409">\n'
        '</head><body>\n')
pathlib.Path('app/index.html').write_text(head + body + '\n</body></html>\n')
PY
echo "Built index.html (self-contained)"
