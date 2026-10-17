"""Контуры надписи из шрифта для SVG-логотипа (шрифт на сайте не нужен).

Запуск: python3 -I tools/render/outline.py job.json
job.json: {"font": "путь.ttf", "wght": 700, "glyphs": [{"char": "В", "x": 0.0}, ...]}
  x — позиция буквы в единицах em (1 em = 1000), с кернингом, измеренная в браузере.
Вывод (stdout, JSON): {"d": "M…", "bounds": [xMin, yMin, xMax, yMax], "capHeight": 750}
  Ось Y направлена вниз (как в SVG), базовая линия — y = 0.
"""
import json
import re
import sys

from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer


def main():
    with open(sys.argv[1], encoding='utf-8') as f:
        job = json.load(f)
    font = TTFont(job['font'])
    if 'fvar' in font:
        font = instancer.instantiateVariableFont(font, {'wght': job['wght']})
    upm = font['head'].unitsPerEm
    scale = 1000 / upm
    cmap = font.getBestCmap()
    glyph_set = font.getGlyphSet()
    svg = SVGPathPen(glyph_set)
    bounds = BoundsPen(glyph_set)
    for g in job['glyphs']:
        name = cmap[ord(g['char'])]
        transform = (scale, 0, 0, -scale, g['x'], 0)
        glyph_set[name].draw(TransformPen(svg, transform))
        glyph_set[name].draw(TransformPen(bounds, transform))
    json.dump({
        'd': re.sub(r'-?\d+\.\d+', lambda m: f'{float(m.group()):.1f}'.rstrip('0').rstrip('.'), svg.getCommands()),
        'bounds': list(bounds.bounds),
        'capHeight': font['OS/2'].sCapHeight * scale,
    }, sys.stdout)


if __name__ == '__main__':
    main()
