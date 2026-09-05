import json,re,sys,unicodedata,os
import os
ROOT = os.environ.get("CJ_ROOT") or os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
IDX=json.load(open(f"{ROOT}/data/bible/index.json"))
BYSLUG={e["slug"]:e for e in IDX}
_c={}
def ch(slug,c):
    if slug not in _c: _c[slug]=json.load(open(f"{ROOT}/data/bible/{slug}.json"))["chapters"]
    return _c[slug][str(c)]
pat=re.compile(r'^\s*>\s*<sup>\[(\d+)\]\(/bible/([a-z0-9-]+)/(\d+)#v(\d+)\)</sup>\s(.*)$')
bad=0;n=0
for p in sys.argv[1:]:
    for i,line in enumerate(open(p,encoding="utf-8"),1):
        m=pat.match(line.rstrip("\n"))
        if not m: continue
        vn,slug,c,anch,text=m.group(1),m.group(2),int(m.group(3)),m.group(4),m.group(5)
        n+=1
        if vn!=anch: print(f"{p}:{i} anchor mismatch");bad+=1;continue
        body=ch(slug,c)
        if int(vn)>len(body): print(f"{p}:{i} v{vn} out of range");bad+=1;continue
        exp=unicodedata.normalize("NFC",body[int(vn)-1]).replace("<","&lt;")
        if exp!=text:
            bad+=1
            print(f"{p}:{i} MISMATCH {slug} {c}:{vn}\n  got: {text}\n  exp: {exp}")
print(f"{n} verses checked, {bad} mismatches")
