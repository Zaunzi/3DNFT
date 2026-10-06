import './chat.css';
export class GlobalChat {
 private root=document.createElement('section');
 private toggle=document.createElement('button');
 private log=document.createElement('div');
 private input=document.createElement('input');
 private sendButton=document.createElement('button');
 private status=document.createElement('p');
 private open=false;private unread=0;private online=false;
 private seen=new Set<string>();private muted=new Set<string>();
 constructor(send:(text:string)=>boolean){
  this.root.className='world-chat';this.toggle.className='chat-toggle';this.toggle.textContent='Global chat';this.toggle.setAttribute('aria-expanded','false');
  const panel=document.createElement('div');panel.className='chat-panel';panel.hidden=true;panel.id='global-chat-panel';this.toggle.setAttribute('aria-controls',panel.id);
  const heading=document.createElement('h2');heading.textContent='Global chat';
  const note=document.createElement('p');note.className='chat-note';note.textContent='Everyone in this world · Live messages only · Tap a name to mute';
  this.log.className='chat-log';this.log.setAttribute('role','log');this.log.setAttribute('aria-live','polite');
  const form=document.createElement('form');this.input.maxLength=280;this.input.placeholder='Say hello…';this.input.setAttribute('aria-label','Chat message');this.sendButton.textContent='Send';
  this.status.className='chat-note';this.status.setAttribute('role','status');
  form.append(this.input,this.sendButton);panel.append(heading,note,this.log,form,this.status);this.root.append(this.toggle,panel);document.body.append(this.root);
  this.toggle.onclick=()=>{this.open=!this.open;panel.hidden=!this.open;this.toggle.setAttribute('aria-expanded',String(this.open));if(this.open){document.exitPointerLock?.();this.unread=0;this.toggle.textContent='Close chat';this.input.focus();this.log.scrollTop=this.log.scrollHeight;}else{this.toggle.textContent='Global chat';this.input.blur();}};
  // Typing must not trigger building, inventory, jumping or movement hotkeys.
  this.root.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Escape'){e.preventDefault();if(this.open)this.toggle.click();}});
  this.root.addEventListener('keyup',e=>e.stopPropagation());
  form.onsubmit=e=>{e.preventDefault();const text=this.input.value.trim();if(!text)return;if(!this.online||!send(text)){this.status.textContent='Chat is offline. Your message was not sent.';return;}this.input.value='';this.status.textContent='';};
  this.setOnline(false);
 }
 setOnline(value:boolean){this.online=value;this.sendButton.disabled=!value;this.status.textContent=value?'':'Connecting to global chat…';}
 receive(m:any){
  if(m.type==='chatError'){this.status.textContent=typeof m.message==='string'?m.message.slice(0,160):'Message could not be sent.';return;}
  if(m.type!=='chat'||typeof m.id!=='string'||typeof m.sender!=='string'||typeof m.text!=='string'||m.text.length>280||!Number.isInteger(m.character)||m.character<1||m.character>5000||this.seen.has(m.id)||this.muted.has(m.sender))return;
  this.seen.add(m.id);if(this.seen.size>200)this.seen.delete(this.seen.values().next().value!);
  const row=document.createElement('p'),name=document.createElement('button'),text=document.createElement('span');
  name.type='button';name.className='chat-name';name.textContent=`${m.guest?'Guest':'Dood'} #${m.character} · ${m.sender.slice(0,4)}`;
  name.title='Mute this player for this session';name.onclick=()=>{this.muted.add(m.sender);this.status.textContent=`Muted ${name.textContent}`;};
  text.textContent=m.text;row.append(name,text);const atBottom=this.log.scrollHeight-this.log.scrollTop-this.log.clientHeight<40;this.log.append(row);while(this.log.childElementCount>100)this.log.firstElementChild?.remove();if(atBottom)this.log.scrollTop=this.log.scrollHeight;
  if(!this.open){this.unread++;this.toggle.textContent=`Global chat (${Math.min(this.unread,99)}${this.unread>99?'+':''})`;}
 }
 dispose(){this.root.remove();}
}
