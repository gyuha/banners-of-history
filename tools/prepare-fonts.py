"""Build local OFL Korean font assets from their Google Fonts upstream distributions.
Run: uv run --with fonttools --with brotli tools/prepare-fonts.py
"""
from pathlib import Path
from urllib.request import urlopen
from fontTools import subset
from fontTools.ttLib import TTFont
import re
root=Path(__file__).resolve().parents[1]
font_dir=root/'public'/'assets'/'fonts'
font_dir.mkdir(parents=True,exist_ok=True)
css=urlopen('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;600;700&family=Noto+Serif+KR:wght@500;600;700&display=swap').read().decode()
for family,weight,name,license_dir in [('Noto Sans KR',400,'noto-sans-kr','notosanskr'),('Noto Sans KR',700,'noto-sans-kr-bold','notosanskr'),('Noto Serif KR',600,'noto-serif-kr','notoserifkr')]:
    block=next(b for b in css.split('}') if f"'{family}'" in b and f'font-weight: {weight};' in b)
    url=re.search(r'url\(([^)]+)\)',block).group(1)
    temp=Path('/tmp')/(name+'-source.ttf')
    temp.write_bytes(urlopen(url).read())
    font=TTFont(temp)
    opts=subset.Options();opts.flavor='woff2';opts.layout_features=['*']
    sub=subset.Subsetter(options=opts)
    codepoints=set(range(0x20,0x100))|set(range(0x2000,0x2070))|set(range(0x3000,0x3100))|set(range(0x3130,0x3190))|set(range(0xac00,0xd7a4))
    sub.populate(unicodes=codepoints);sub.subset(font);font.flavor='woff2'
    path=font_dir/(name+'.woff2');font.save(path)
    (font_dir/(name+'-OFL.txt')).write_bytes(urlopen(f'https://raw.githubusercontent.com/google/fonts/main/ofl/{license_dir}/OFL.txt').read())
    print(name,path.stat().st_size,'bytes')
