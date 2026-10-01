import {TRINKETS} from '../items/trinkets.ts';
const PAGES=['dj-board','keyboard','drumkit','xylophone','bongos'] as const;
// Lazy, trusted repository content. Never load arbitrary NFT animation URLs.
const LOADERS=[
  ()=>import('../../../static/dj-board/index.html?raw'),
  ()=>import('../../../static/keyboard/index.html?raw'),
  ()=>import('../../../static/drumkit/index.html?raw'),
  ()=>import('../../../static/xylophone/index.html?raw'),
  ()=>import('../../../static/bongos/index.html?raw'),
];
/** Only our five authored instrument pages are playable, never arbitrary NFT URLs. */
export function instrumentPage(id:number){if(!Number.isInteger(id)||id<1||id>5)throw new Error('Unknown instrument');return PAGES[id-1];}
export class InstrumentPlayer {
  private dialog:HTMLDialogElement;private frame:HTMLIFrameElement|null=null;
  private changed:(open:boolean)=>void;
  get open(){return this.dialog.open;}
  constructor(changed:(open:boolean)=>void){
    this.changed=changed;this.dialog=document.createElement('dialog');this.dialog.className='instrument-player';this.dialog.setAttribute('aria-label','Play instrument');
    this.dialog.innerHTML='<header><strong></strong><button type="button">Close instrument</button></header><p>Play using the controls below. Closing stops the instrument.</p>';
    this.dialog.querySelector('button')!.onclick=()=>this.close();
    this.dialog.addEventListener('cancel',event=>{event.preventDefault();this.close();});
    this.dialog.addEventListener('close',()=>{if(!this.open)this.stop();});document.body.append(this.dialog);
  }
  play(id:number){
    instrumentPage(id);this.stopFrame();
    this.dialog.querySelector('strong')!.textContent=`Play ${TRINKETS[id-1].name}`;
    this.frame=document.createElement('iframe');this.frame.title=`${TRINKETS[id-1].name} instrument controls`;
    this.frame.setAttribute('sandbox','allow-scripts');this.frame.allow='autoplay';this.frame.referrerPolicy='no-referrer';this.dialog.append(this.frame);
    const frame=this.frame;
    this.dialog.querySelector('p')!.textContent='Loading instrument…';
    void LOADERS[id-1]().then(page=>{
      if(this.frame!==frame)return;
      // Navigation belongs to the world UI; omit the legacy collection navigation.
      frame.srcdoc=page.default.replace(/<nav class="item-nav"[\s\S]*?<\/nav>/g,'');
      this.dialog.querySelector('p')!.textContent='Play using the controls below. Closing stops the instrument.';
    }).catch(()=>{if(this.frame===frame)this.dialog.querySelector('p')!.textContent='Unable to load instrument. Close and try again.';});
    if(!this.open){this.dialog.showModal();this.changed(true);}
  }
  private stopFrame(){if(this.frame){this.frame.src='about:blank';this.frame.remove();this.frame=null;}}
  private stop(){if(this.frame){this.stopFrame();this.changed(false);}}
  close(){if(this.open){this.dialog.close();this.stop();}}
  dispose(){this.close();this.stopFrame();this.dialog.remove();}
}
