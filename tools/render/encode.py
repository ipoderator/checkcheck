"""Сжатие рендеров: уменьшение суперсэмпла до итогового размера, WebP под бюджет веса и PNG.

Запуск: python3 -I tools/render/encode.py jobs.json
jobs.json — список заданий:
  {"src": "raw.png", "out": "public/assets/img/hero-roll", "size": [1600, 1600],
   "formats": ["webp", "png"], "webp_max_bytes": 250000, "background": "#f7f6f2" | null}
"""
import io
import json
import sys

from PIL import Image


def fit_webp(im, max_bytes):
    """Наибольшее качество WebP, которое укладывается в max_bytes."""
    def encode(q):
        buf = io.BytesIO()
        im.save(buf, 'WEBP', quality=q, alpha_quality=90, method=6)
        return buf.getvalue()

    if max_bytes is None:
        return encode(86)
    best = None
    lo, hi = 40, 92
    while lo <= hi:
        q = (lo + hi) // 2
        data = encode(q)
        if len(data) <= max_bytes:
            best = data
            lo = q + 1
        else:
            hi = q - 1
    if best is None:
        raise SystemExit(f'WebP не укладывается в {max_bytes} байт даже при качестве {lo}')
    return best


def main():
    with open(sys.argv[1], encoding='utf-8') as f:
        jobs = json.load(f)
    for job in jobs:
        im = Image.open(job['src']).convert('RGBA')
        size = tuple(job['size'])
        if im.size != size:
            im = im.resize(size, Image.Resampling.LANCZOS)
        if job.get('background'):
            bg = Image.new('RGBA', im.size, job['background'])
            bg.alpha_composite(im)
            im = bg.convert('RGB')
        for fmt in job['formats']:
            path = f"{job['out']}.{fmt}"
            if fmt == 'webp':
                data = fit_webp(im, job.get('webp_max_bytes'))
                with open(path, 'wb') as out:
                    out.write(data)
            else:
                im.save(path, 'PNG', optimize=True)
            print(path)


if __name__ == '__main__':
    main()
