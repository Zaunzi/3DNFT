import subprocess,sys
from pathlib import Path
source,destination=sys.argv[1:3]
logs=Path(source)/'preview-logs';logs.mkdir(exist_ok=True)
processes=[]
for index in range(4):
 log=(logs/f'{index}.log').open('w')
 process=subprocess.Popen([sys.executable,str(Path(__file__).with_name('publish_assets.py')),source,destination,'--fit-tall-traits','--doodverse','--shard',str(index),'4'],stdout=log,stderr=subprocess.STDOUT)
 processes.append((process,log))
failed=False
for process,log in processes:
 failed=process.wait()!=0 or failed;log.close()
if failed:raise SystemExit('Preview worker failed; inspect preview-logs')
print('All 5000 previews and metadata published',flush=True)
