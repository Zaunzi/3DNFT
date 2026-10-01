export type InputMode = 'welcome' | 'movement' | 'cursor' | 'menu';
/** Welcome is initial-only. Menus and pointer-lock loss never return to it. */
export class WorldInputMode {
  mode:InputMode='welcome';
  private effects:{render:(mode:InputMode)=>void;lock:()=>void;unlock:()=>void};
  constructor(effects:WorldInputMode['effects']){this.effects=effects;}
  private set(mode:InputMode){this.mode=mode;this.effects.render(mode);}
  resume(){this.set('movement');this.effects.lock();}
  menu(open:boolean){if(open){this.set('menu');this.effects.unlock();}else if(this.mode==='menu')this.resume();}
  release(){if(this.mode==='welcome'||this.mode==='menu')return;this.set('cursor');this.effects.unlock();}
  toggleCursor(){if(this.mode==='cursor')this.resume();else if(this.mode==='movement')this.release();}
  locked(){if(this.mode==='movement')this.effects.render(this.mode);else this.effects.unlock();}
  unlocked(){if(this.mode==='movement')this.set('cursor');else this.effects.render(this.mode);}
  lockFailed(){if(this.mode==='movement')this.effects.render(this.mode);}
}
