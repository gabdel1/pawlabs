#!/usr/bin/env python3
"""
Download the site's webfonts from Google Fonts into public/fonts/ and emit a
local fonts.css that points at them.

We self-host rather than linking fonts.googleapis.com because that link sends
every visitor's IP to Google before they have consented to anything, and it
fires from a stylesheet — too early for Consent Mode to gate. See the header of
the generated public/fonts/fonts.css.

Run from the repo root after changing which weights the design uses:

    python3 scripts/fetch-fonts.py
"""
import re
import urllib.request

UA = ('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) '
      'Chrome/120.0.0.0 Safari/537.36')  # woff2 is only served to modern UAs
CSS_URL = ('https://fonts.googleapis.com/css2'
           '?family=Outfit:wght@300;400;500;600;700;800;900'
           '&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap')
KEEP = {'latin', 'latin-ext'}  # breed names carry accents; nothing needs Cyrillic

HEADER = """/*
 * Self-hosted webfonts.
 *
 * Previously loaded from fonts.googleapis.com, which sends every visitor's IP
 * address to Google before they have consented to anything. German courts have
 * treated that as an unlawful transfer under GDPR (LG Munich I, 3 O 17493/20),
 * and it is not something Consent Mode can fix, because the request fires from
 * a stylesheet link before any script runs.
 *
 * Serving the files ourselves removes the third party entirely. Regenerate with
 * scripts/fetch-fonts.py if the weights in use ever change.
 *
 * Subsets: latin, latin-ext (breed names carry accents; nothing needs Cyrillic).
 */

"""


def get(url, binary=False):
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read() if binary else r.read().decode('utf-8')


def main():
    css = get(CSS_URL)
    blocks = re.findall(r'(/\*\s*([a-z0-9-]+)\s*\*/\s*)?@font-face\s*\{(.*?)\}', css, re.S)

    rules, seen = [], {}
    for _, subset, body in blocks:
        if subset and subset not in KEEP:
            continue
        family = re.search(r"font-family:\s*'([^']+)'", body).group(1)
        weight = re.search(r'font-weight:\s*(\d+)', body).group(1)
        url = re.search(r'url\((https://[^)]+\.woff2)\)', body).group(1)

        slug = family.lower().replace(' ', '-')
        name = f'{slug}-{weight}-{subset or "latin"}.woff2'
        if name not in seen:
            data = get(url, binary=True)
            with open(f'public/fonts/{name}', 'wb') as fh:
                fh.write(data)
            seen[name] = len(data)

        body = re.sub(r'url\(https://[^)]+\.woff2\)', f'url(/fonts/{name})', body)
        body = '\n'.join('  ' + l.strip() for l in body.strip().split('\n') if l.strip())
        rules.append(f'/* {family} {weight} — {subset} */\n@font-face {{\n{body}\n}}')

    with open('public/fonts/fonts.css', 'w') as fh:
        fh.write(HEADER + '\n\n'.join(rules) + '\n')

    print(f'{len(seen)} files, {sum(seen.values()) / 1024:.0f} KB, {len(rules)} @font-face rules')


if __name__ == '__main__':
    main()
