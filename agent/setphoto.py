import sys,re,glob,json
img,alt,credit=sys.argv[1],sys.argv[2],sys.argv[3]
f=[p for p in glob.glob('src/content/posts/*.md') if f'/{img}.jpg"' in open(p).read()][0]
s=open(f).read()
s=re.sub(r'^imageAlt: .*\n(imageCredit: .*\n)?',f'imageAlt: {json.dumps(alt,ensure_ascii=False)}\nimageCredit: {credit}\n',s,count=1,flags=re.M)
open(f,'w').write(s); print(f)
