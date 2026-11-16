const W=1672,H=941, WHEELS=[[456,283,180,139],[928,283,180,139],[456,585,180,139],[918,585,180,139]];
const NUT_X=836,NUT_Y=466,NUT_RADIUS=62,NUT_DURATION=675,GOLD_TIME=15,SILVER_TIME=20;
const now=()=>performance.now(), clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const ease=x=>{x=clamp(x,0,1);return x*x*(3-2*x)};
const inRect=(p,r)=>p.x>=r[0]&&p.y>=r[1]&&p.x<=r[0]+r[2]&&p.y<=r[1]+r[3];
const store={get(k,d){try{const x=localStorage.getItem('pitstop.web.'+k);return x===null?d:JSON.parse(x)}catch(_){return d}},set(k,v){try{localStorage.setItem('pitstop.web.'+k,JSON.stringify(v))}catch(_){}}};

class PitStopGame extends Phaser.Scene {
  constructor(){super('game');this.screen='menu';this.modal=null;this.bgx=0;this.bgy=0;this.settings=store.get('settings',{sfx:.75,music:.12});this.best=store.get('best.v2',null);this.mouse={x:W/2,y:H/2};this.lastHover=null;this.sounds={};}
  preload(){
    const images=['menu-background','logo','panel','badge','tires','floor','car','light','result','crew-down','crew-up','crew-cheer','jack','operator','wheel-closeup'];
    images.forEach(k=>this.load.image(k,`assets/${k}.png`));
    const audio={arrival:'pit_arrival.wav',departure:'pit_departure.wav',wrench:'impact_wrench.mp3',signal:'traffic_light.mp3',hover:'menu_hover.wav',jack:'домкрат.mp3',success:'успешное qte.mp3',failure:'неуспешное qte.mp3',music:'menu_theme.mp3'};
    for(const [key,file] of Object.entries(audio))this.load.audio(key,`assets/audio/${file}`);
  }
  create(){
    this.canvasTexture=this.textures.createCanvas('screen',W,H);this.ctx=this.canvasTexture.getContext();this.add.image(0,0,'screen').setOrigin(0);
    document.body.classList.add('ready');
    this.input.on('pointermove',p=>{this.mouse={x:p.x,y:p.y};if(this.drag)this.volumeAt(p);});
    this.input.on('gameout',()=>{this.mouse=null;this.stopNutHold();});
    this.input.on('pointerdown',p=>{this.mouse={x:p.x,y:p.y};this.click(p);});
    this.input.on('pointerup',()=>{this.stopNutHold();if(this.drag){this.drag=null;store.set('settings',this.settings);}});
    this.input.on('pointerupoutside',()=>this.stopNutHold());
    this.input.keyboard.on('keydown',e=>this.key(e));
    this.input.keyboard.on('keyup',e=>{if(['Space','Enter'].includes(e.code)&&this.nutInput==='keyboard')this.stopNutHold();});
    this.profileInput=document.getElementById('pilot-name');
    this.profileInput.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Enter'){e.preventDefault();this.saveProfile();}else if(e.key==='Escape'){e.preventDefault();this.closeModal();}});
    window.addEventListener('blur',()=>this.stopNutHold());
    this.input.on('pointerover',()=>{});
    this.sound.on('unlocked',()=>{if(this.screen==='menu')this.music();});
    this.music();
  }
  soundPlay(key){try{if(this.cache.audio.exists(key)&&this.settings.sfx>0)this.sound.play(key,{volume:this.settings.sfx});}catch(_) {}}
  startWrench(){try{if(!this.cache.audio.exists('wrench')||this.settings.sfx<=0)return;if(!this.wrenchLoop)this.wrenchLoop=this.sound.add('wrench',{loop:true,volume:this.settings.sfx});this.wrenchLoop.setVolume(this.settings.sfx);if(!this.wrenchLoop.isPlaying)this.wrenchLoop.play();}catch(_) {}}
  stopWrench(){if(this.wrenchLoop)this.wrenchLoop.stop();}
  music(){try{if(!this.cache.audio.exists('music'))return;if(!this.musicSound)this.musicSound=this.sound.add('music',{loop:true,volume:this.settings.music});this.musicSound.setVolume(this.settings.music);if(!this.musicSound.isPlaying)this.musicSound.play();}catch(_) {}}
  stopMusic(){if(this.musicSound)this.musicSound.stop();}
  img(key,x,y,w,h,angle=0,flip=false,alpha=1){const image=this.textures.get(key)?.getSourceImage();if(!image)return;const c=this.ctx;c.save();c.globalAlpha=alpha;c.translate(x,y);c.rotate(angle);c.scale(flip?-1:1,1);c.drawImage(image,-w/2,-h/2,w,h);c.restore();}
  imageTop(key,x,y,w,h){const image=this.textures.get(key)?.getSourceImage();if(image)this.ctx.drawImage(image,x,y,w,h);}
  round(x,y,w,h,r,fill,stroke=null,lw=3){const c=this.ctx;c.beginPath();c.roundRect(x,y,w,h,r);if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.lineWidth=lw;c.strokeStyle=stroke;c.stroke();}}
  circle(x,y,r,fill,stroke=null,lw=1){const c=this.ctx;c.beginPath();c.arc(x,y,r,0,Math.PI*2);if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=lw;c.stroke();}}
  line(points,color,width){const c=this.ctx;c.beginPath();c.moveTo(...points[0]);for(const p of points.slice(1))c.lineTo(...p);c.strokeStyle=color;c.lineWidth=width;c.stroke();}
  polygon(points,color){const c=this.ctx;c.beginPath();c.moveTo(...points[0]);for(const p of points.slice(1))c.lineTo(...p);c.closePath();c.fillStyle=color;c.fill();}
  check(x,y,size){this.line([[x-size,y],[x-size/3,y+size/2],[x+size,y-size]],'#fff',5);}
  weatherIcon(x,y){if(this.weather==='dry'){this.circle(x,y,20,'#ffd213');for(let i=0;i<8;i++){const a=i*Math.PI/4;this.line([[x+Math.cos(a)*27,y+Math.sin(a)*27],[x+Math.cos(a)*35,y+Math.sin(a)*35]],'#ffd213',5);}}else{for(const [dx,dy,r] of [[-16,0,15],[0,-10,21],[19,0,15]])this.circle(x+dx,y+dy,r,'#ccdbee');this.round(x-25,y,54,13,7,'#ccdbee');for(const dx of [-15,0,15])this.line([[x+dx,y+20],[x+dx-4,y+30]],'#52b5f9',4);}}
  fitText(s,x,y,size,color,maxWidth){while(size>12){this.ctx.font=`${size}px Russo, sans-serif`;if(this.ctx.measureText(s).width<=maxWidth)break;size--;}this.text(s,x,y,size,color);}
  text(s,x,y,size=24,color='#fff',align='center'){const c=this.ctx;c.font=`${size}px Russo, sans-serif`;c.fillStyle=color;c.textAlign=align;c.textBaseline='middle';c.fillText(String(s),x,y);}
  panel(x,y,w,h,fill='#272e4c',stroke='#8a97c8',r=27){this.round(x,y+7,w,h,r,'#0c1124');this.round(x,y,w,h,r,fill,stroke,4);}
  button(x,y,w,h,label,yellow=false){this.round(x,y+7,w,h,25,'#111328');this.round(x,y,w,h,25,yellow?'#ffcc14':'#6756a0',yellow?'#ffec87':'#aea3d2',3);this.text(label,x+w/2,y+h/2,28,yellow?'#14151f':'#fff');}
  shade(a=.76){this.ctx.fillStyle=`rgba(7,10,25,${a})`;this.ctx.fillRect(0,0,W,H);}
  bestText(){return typeof this.best==='number'?`${this.best.toFixed(2)} s`:'--.-- s';}
  update(_,dt){this.tick(now());const hover=this.hoverTarget();if(hover&&hover!==this.lastHover)this.soundPlay('hover');this.lastHover=hover;if(this.modal==='profile')this.positionProfileInput();this.draw(dt/1000);this.canvasTexture.refresh();}
  draw(dt){this.ctx.clearRect(0,0,W,H);if(this.screen==='menu')this.drawMenu(dt);else if(this.phase==='result')this.drawResult();else this.drawRace();}
  hoverTarget(){
    const p=this.mouse;if(!p)return null;
    if(this.screen==='race'){
      if(this.phase==='select'){if(inRect(p,[455,530,355,88]))return 'select:slick';if(inRect(p,[862,530,355,88]))return 'select:wet';}
      if(this.phase==='result'){if(inRect(p,[70,755,278,100]))return 'result:retry';if(inRect(p,[368,741,290,106]))return 'result:menu';}return null;
    }
    if(this.modal==='settings'){
      if(inRect(p,[770,405,260,42]))return 'sfx';if(inRect(p,[770,471,260,42]))return 'music';if(inRect(p,[550,540,572,58]))return 'fullscreen';
    }
    if(this.modal==='play'){if(inRect(p,[520,426,632,76]))return 'play:casual';if(inRect(p,[520,518,632,66]))return 'play:daily';}
    if(this.modal==='profile'&&inRect(p,[681,535,310,65]))return 'profile:save';
    if(this.modal)return inRect(p,[681,625,310,65])?'back':null;
    for(const [n,r] of this.menuButtons())if(inRect(p,r))return n;return null;
  }
  menuButtons(){return [['play',[59,462,524,138]],['records',[50,616,267,94]],['settings',[335,616,267,94]],['exit',[218,728,226,62]],['profile',[1302,145,338,65]]];}
  drawMenu(dt){
    const dead=v=>Math.abs(v)<=.14?0:Math.sign(v)*(Math.abs(v)-.14)/.86;
    const tx=this.mouse?-dead(this.mouse.x/W*2-1)*24:0,ty=this.mouse?-dead(this.mouse.y/H*2-1)*14:0,a=1-Math.exp(-Math.min(dt,.05)*2.6);this.bgx+=(tx-this.bgx)*a;this.bgy+=(ty-this.bgy)*a;
    this.imageTop('menu-background',-40+this.bgx,-24+this.bgy,W+80,H+48);
    this.imageTop('panel',0,0,W,H);this.imageTop('badge',0,0,W,H);this.text(this.bestText(),1505,94,44,'#ffd700');
    this.round(1302,150,338,65,24,'#111328');this.round(1302,145,338,65,24,'#272e4c','#8999c9',3);this.fitText(`ИМЯ: ${cloud.displayName()}`,1471,177,23,'#fff',305);
    const hover=this.modal?null:this.hoverTarget();
    if(hover){const r=this.menuButtons().find(b=>b[0]===hover)[1];this.round(...r,35,'rgba(255,255,255,.16)');}
    this.imageTop('tires',-40+this.bgx,-24+this.bgy,W+80,H+48);
    if(this.modal)this.drawModal();
  }
  drawModal(){
    this.shade();this.panel(450,205,772,530,'#272e4c','#8a97c8',38);this.imageTop('logo',686,225,300,135);
    if(this.modal==='play'){
      this.text('ВЫБЕРИ РЕЖИМ',836,394,38);this.button(520,426,632,76,'СВОБОДНЫЙ ПИТ-СТОП',true);this.button(520,518,632,66,'ЕЖЕДНЕВНЫЙ ЗАЕЗД');
      const d=cloud.daily();this.text(`${d.date}  ·  ${d.weather==='dry'?'СУХАЯ ТРАССА':'ДОЖДЬ'}`,836,595,16,'#c4cfeb');this.text(cloud.status,836,613,14,'#a8b7da');
    }else if(this.modal==='records'){
      this.text('ЛУЧШЕЕ ВРЕМЯ',836,405,43);this.text(this.bestText(),836,480,64,'#ffd827');this.text('ОНЛАЙН-РЕЙТИНГИ',836,529,21);
      for(const [title,board,x] of [['ОБЩИЙ',cloud.global,645],['ЕЖЕДНЕВНЫЙ',cloud.dailyBoard,1027]]){this.text(title,x,551,15,'#b3c2e4');if(!board.length)this.text(cloud.online?'Пока нет результатов':cloud.status,x,579,12,'#b9c6e4');board.slice(0,3).forEach((v,i)=>this.fitText(`${i+1}. ${v.name||'Пилот'}  ${Number(v.bestTime).toFixed(2)} s`,x,572+i*17,14,i?'#d2daee':'#ffda3e',355));}
    }else if(this.modal==='settings'){
      this.text('НАСТРОЙКИ',836,365,43);this.slider('sfx','ЭФФЕКТЫ',397);this.slider('music','МУЗЫКА',463);this.button(550,540,572,58,`ЭКРАН: ${document.fullscreenElement?'ПОЛНЫЙ ЭКРАН':'ОКНО'}`);
    }else if(this.modal==='profile'){
      this.text('ИМЯ ПИЛОТА',836,393,38);this.text('ОНО ПОЯВИТСЯ В РЕЙТИНГАХ',836,428,18,'#c4cfeb');
      this.button(681,535,310,65,'СОХРАНИТЬ');
      this.text(this.profileError||'ДО 24 СИМВОЛОВ',836,613,15,this.profileError?'#ff8989':'#b3c2e4');
    }else{this.text('ЗАКРЫТЬ ВКЛАДКУ',836,440,36);this.text('Спасибо за игру!',836,490,25,'#ffd827');}
    this.button(681,625,310,65,'НАЗАД',true);
  }
  slider(key,label,y){this.round(550,y,572,58,22,'#2d3250','#828ebc',2);this.text(label,657,y+29,23);this.round(770,y+18,260,20,10,'#15182b');this.round(770,y+23,260*this.settings[key],10,5,'#ffcc14');this.ctx.fillStyle='#ffec87';this.ctx.beginPath();this.ctx.arc(770+260*this.settings[key],y+28,11,0,Math.PI*2);this.ctx.fill();this.text(`${Math.round(this.settings[key]*100)}%`,1072,y+29,21,'#ffe14d');}
  positionProfileInput(){const rect=this.game.canvas.getBoundingClientRect(),sx=rect.width/W,sy=rect.height/H;Object.assign(this.profileInput.style,{left:`${rect.left+540*sx}px`,top:`${rect.top+452*sy}px`,width:`${592*sx}px`,height:`${62*sy}px`,fontSize:`${Math.max(14,24*sy)}px`});}
  openProfile(){this.modal='profile';this.profileError='';this.profileInput.value=cloud.displayName();this.positionProfileInput();this.profileInput.hidden=false;this.profileInput.focus();this.profileInput.select();}
  closeModal(){this.modal=null;this.profileInput.hidden=true;this.profileInput.blur();}
  saveProfile(){try{cloud.setDisplayName(this.profileInput.value);this.closeModal();}catch(error){this.profileError=error.message||'Не удалось сохранить имя';this.profileInput.focus();}}
  volumeAt(p){this.settings[this.drag]=clamp((p.x-770)/260,0,1);if(this.musicSound)this.musicSound.setVolume(this.settings.music);}
  click(p){
    if(this.screen==='menu'){
      if(this.modal){
        if(inRect(p,[681,625,310,65])){this.closeModal();return;}
        if(this.modal==='profile'&&inRect(p,[681,535,310,65])){this.saveProfile();return;}
        if(this.modal==='play'&&inRect(p,[520,426,632,76])){this.startGame(null);return;}
        if(this.modal==='play'&&inRect(p,[520,518,632,66])){this.startGame(cloud.daily());return;}
        if(this.modal==='settings'){
          for(const [name,y] of [['sfx',397],['music',463]])if(inRect(p,[755,y+3,290,52])){this.drag=name;this.volumeAt(p);return;}
          if(inRect(p,[550,540,572,58])){if(document.fullscreenElement)document.exitFullscreen?.();else document.documentElement.requestFullscreen?.().catch(()=>{});}
        }return;
      }
      for(const [name,r] of this.menuButtons())if(inRect(p,r)){if(name==='profile')this.openProfile();else this.modal=name;if(name==='records')cloud.sync();return;}
      return;
    }
    if(this.phase==='select'){
      if(inRect(p,[455,530,355,88]))this.choose('dry');else if(inRect(p,[862,530,355,88]))this.choose('wet');return;
    }
    if(this.phase==='nut'){if(Math.hypot(p.x-NUT_X,p.y-NUT_Y)<=NUT_RADIUS)this.startNutHold('pointer');return;}
    if(this.phase==='jam') {if(inRect(p,[748,367,176,176]))this.tryJam(this.jamKey);return;}
    if((this.phase==='jack_raise'||this.phase==='jack_lower')&&['raise_ready','lower_ready'].includes(this.jackState)&&inRect(p,this.jackRect())){
      this.jackClicks++;if(this.jackClicks>=2){this.jackClicks=0;this.jackState=this.phase==='jack_raise'?'lifting':'lowering';this.jackTime=now();this.soundPlay('jack');}return;
    }
    if((this.phase==='jack_lower'||this.phase==='release')&&inRect(p,[69,320,230,134])){this.clickLight();return;}
    if(this.phase==='race'){
      const i=this.wheels.findIndex(v=>v!==2);if(i>=0&&inRect(p,WHEELS[i]))this.openNut(i);return;
    }
    if(this.phase==='result'){
      if(inRect(p,[70,755,278,100]))this.resetGame();else if(inRect(p,[368,741,290,106]))this.toMenu();
    }
  }
  key(e){
    if(e.code==='Escape'){if(this.screen==='menu')this.closeModal();else this.toMenu();return;}
    if(this.screen==='race'&&this.phase==='nut'&&!e.repeat&&['Space','Enter'].includes(e.code)){e.preventDefault();this.startNutHold('keyboard');return;}
    if(this.screen==='race'&&this.phase==='jam'&&!e.repeat&&!['ShiftLeft','ShiftRight','ControlLeft','ControlRight','AltLeft','AltRight'].includes(e.code)){e.preventDefault();this.tryJam(e.code.startsWith('Key')?e.code.slice(3):e.code);}
  }
  tryJam(key){const t=now();if(key===this.jamKey&&Math.abs(t-this.jamTime-1150)<=160){this.soundPlay('success');this.phase='nut';}else{this.soundPlay('failure');this.jamTime=t;this.jamFeedback=t+650;}}
  startGame(challenge){this.stopMusic();this.screen='race';this.modal=null;this.challenge=challenge;this.resetGame();}
  toMenu(){this.stopNutHold();this.screen='menu';this.modal=null;this.music();}
  resetGame(){this.stopNutHold();this.weather=this.challenge?.weather||(Math.random()<.5?'dry':'wet');this.tyre=null;this.phase='select';this.wheels=[0,0,0,0];this.penalty=0;this.elapsed=0;this.total=0;this.started=0;this.jammedOnce=false;this.jamFeedback=0;this.jackState='hidden';this.jackClicks=0;this.lift=0;this.releaseClicks=0;this.releaseFirstReady=null;this.releaseGreen=false;this.warningUntil=0;this.actionTimes=[0,0,0,0];this.newRecord=false;}
  choose(tyre){this.tyre=tyre;this.penalty=tyre===this.weather?0:2;this.arrival=now();this.phase='arrival';this.soundPlay('arrival');}
  advanceWheel(i,play){this.wheels[i]++;this.actionTimes[i]=now();if(play)this.soundPlay('wrench');if(this.wheels.every(v=>v===2)){this.phase='jack_lower';this.jackState='lower_ready';this.jackClicks=0;}}
  openNut(i){this.nutWheel=i;this.nutMode=this.wheels[i]===0?'loosen':'tighten';this.nutProgress=0;this.nutHolding=false;this.nutInput=null;this.nutJamChecked=false;this.phase='nut';}
  startNutHold(input){
    if(this.phase!=='nut'||this.nutHolding)return;
    if(!this.nutJamChecked){this.nutJamChecked=true;if(!this.jammedOnce&&Math.random()<.12){this.jammedOnce=true;this.jamWheel=this.nutWheel;this.jamKey=['A','S','D','F'][Math.floor(Math.random()*4)];this.jamTime=now();this.jamFeedback=0;this.phase='jam';this.soundPlay('wrench');return;}}
    this.nutHolding=true;this.nutInput=input;this.nutStarted=now();this.nutStartProgress=this.nutProgress;this.startWrench();
  }
  updateNut(t){if(!this.nutHolding)return;this.nutProgress=clamp(this.nutStartProgress+(t-this.nutStarted)/NUT_DURATION,0,1);if(this.nutProgress>=1){this.nutHolding=false;this.nutInput=null;this.stopWrench();this.phase='race';this.advanceWheel(this.nutWheel,false);}}
  stopNutHold(){if(this.nutHolding)this.updateNut(now());this.nutHolding=false;this.nutInput=null;this.stopWrench();}
  clickLight(){const ready=this.phase==='release'&&this.releaseGreen;if(this.releaseClicks&&this.releaseFirstReady!==ready)this.releaseClicks=0;this.releaseClicks++;if(this.releaseClicks===1){this.releaseFirstReady=ready;return;}this.releaseClicks=0;this.releaseFirstReady=null;if(ready)this.finish();else{this.penalty+=2;this.warningUntil=now()+1800;}}
  finish(){const t=now();this.elapsed=(t-this.started)/1000;this.total=this.elapsed+this.penalty;this.newRecord=this.best===null||this.total<this.best;if(this.newRecord){this.best=this.total;store.set('best.v2',this.best);}const shown=Number(this.total.toFixed(2)),medal=shown<=GOLD_TIME?'gold':shown<=SILVER_TIME?'silver':'bronze';cloud.queue({runId:crypto.randomUUID(),rulesVersion:cloud.leaderboardVersion,mode:this.challenge?'daily':'casual',challengeId:this.challenge?.id||null,weather:this.weather,tyre:this.tyre,elapsed:Number(this.elapsed.toFixed(3)),penalty:this.penalty,total:Number(this.total.toFixed(3)),medal});this.phase='celebrate';this.finished=t;this.soundPlay('departure');}
  tick(t){
    if(this.screen!=='race')return;
    if(this.phase==='arrival'&&t-this.arrival>=1000){this.started=this.arrival+1000;this.phase='jack_raise';this.jackState='approaching';this.jackTime=this.started;}
    if(this.jackState==='approaching'&&t-this.jackTime>=350)this.jackState='raise_ready';
    if(this.jackState==='lifting'){this.lift=ease((t-this.jackTime)/250);if(this.lift===1){this.jackState='raised';this.phase='race';}}
    if(this.jackState==='lowering'){this.lift=1-ease((t-this.jackTime)/250);if(this.lift===0){this.jackState='leaving';this.jackTime=t;}}
    if(this.jackState==='leaving'&&t-this.jackTime>=350){this.jackState='gone';this.removed=t;this.phase='release';}
    if(this.phase==='release'&&!this.releaseGreen&&t-this.removed>=200){this.releaseGreen=true;this.soundPlay('signal');}
    if(this.phase==='nut')this.updateNut(t);
    if(this.phase==='jam'&&t-this.jamTime>1310){this.jamTime=t;this.jamFeedback=t+650;}
    if(this.phase==='celebrate'&&t-this.finished>=1470)this.phase='result';
  }
  currentTime(){return ['jack_raise','race','nut','jam','jack_lower','release'].includes(this.phase)?(now()-this.started)/1000:this.elapsed;}
  jackRect(){const angle=(65-8*this.lift)*Math.PI/180,co=Math.cos(angle),si=Math.sin(angle),cx=1225+co*115,cy=508+si*115,w=Math.abs(co)*230+Math.abs(si)*110+16,h=Math.abs(si)*230+Math.abs(co)*110+16;return [cx-w/2,cy-h/2,w,h];}
  drawRace(){
    const t=now(), c=this.ctx;this.imageTop('floor',0,0,W,H);
    if(this.phase!=='select'){
      let travel=0;
      if(this.phase==='arrival')travel=-1323*Math.pow(1-clamp((t-this.arrival)/1000,0,1),3);
      if(this.phase==='celebrate')travel=1409*Math.pow(clamp((t-this.finished-250)/1100,0,1),2);
      c.fillStyle=`rgba(9,11,20,${.35-.1*this.lift})`;c.beginPath();c.ellipse(793+travel,526+8*this.lift,430,135,0,0,Math.PI*2);c.fill();
      this.img('car',793+travel,509-5*this.lift,900*(1+.012*this.lift),452*(1+.012*this.lift));
    }
    this.drawCrew(t);
    this.panel(18,18,320,98);this.text('ПИТ-СТОП',178,50,33);this.text(this.phase==='arrival'?'БОЛИД ЗАЕЗЖАЕТ':'ЗАМЕНИ КОЛЁСА',178,85,22,'#bbc6e8');
    this.panel(635,18,395,105,'#ffcd11','#ffec80',45);this.text(`${this.currentTime().toFixed(2)} s`,833,69,62,'#161620');
    this.panel(1413,18,245,98,'#1c1e33','#8292c1',42);this.text('РЕКОРД',1535,43,22);this.text(this.bestText(),1535,79,34,'#ffd416');
    this.panel(1328,150,330,292);this.text('ПОГОДА',1493,184,25,'#afbede');this.weatherIcon(1392,234);this.text(this.weather==='dry'?'СУХО':'ДОЖДЬ',1515,235,43);
    this.text('ТИП РЕЗИНЫ',1493,295,24,'#afbede');this.button(1350,326,287,70,({null:'ВЫБЕРИ ШИНЫ',dry:'СЛИКИ',wet:'ДОЖДЕВЫЕ'})[this.tyre],true);
    this.panel(1328,468,330,142);this.text(`ЗАМЕНИ КОЛЁСА  ${this.wheels.filter(v=>v===2).length}/4`,1493,506,25);
    this.wheels.forEach((v,i)=>{this.circle(1385+70*i,563,24,v===2?'#43d95c':'#3a4260','#889ecc',3);if(v===2)this.check(1385+70*i,563,14);});
    if(['race','nut','jam','jack_lower','release'].includes(this.phase)){
      const active=this.wheels.findIndex(v=>v!==2);
      this.wheels.forEach((state,i)=>{const [x,y,w,h]=WHEELS[i],fitted=['nut','jam'].includes(this.phase)&&this.nutMode==='tighten'&&this.nutWheel===i;if(state===1&&!fitted){this.round(x+6,y+6,w-12,h-12,43,'#2a2d3d');this.circle(x+w/2,y+h/2,29,'#4d5265');this.circle(x+w/2,y+h/2,14,'#1b1d2a');}if(state===2){this.round(x,y,w,h,43,null,'#30e563',7);this.circle(x+w/2,y+h/2,25,'#30dc5d');this.check(x+w/2,y+h/2,14);}else if(i===active)this.round(x,y,w,h,43,null,'#ffd813',7);});
      if(this.phase==='race'&&active>=0){this.panel(18,135,320,70,'#1b2037','#6977a5',20);this.text(this.wheels[active]?'УСТАНОВИ КОЛЕСО':'СНИМИ КОЛЕСО',178,170,22,'#fff0ab');}
    }
    this.drawLight(t);this.drawJack(t);
    if(['jack_raise','jack_lower'].includes(this.phase))this.drawJackHint();
    if(this.phase==='select')this.drawSelection();else if(this.phase==='nut')this.drawNut();else if(this.phase==='jam')this.drawJam(t);
  }
  drawCrew(t){
    // Keep the upper mechanics clear of the timer, and align the lower pair with their wheels.
    const centers=WHEELS.map(([x,y,w,h],i)=>[i===0?488:i===1?1080:x+w/2,i<2?191:801]),active=this.wheels.findIndex(v=>v!==2),celebrating=this.phase==='celebrate',age=celebrating?t-this.finished:0;
    centers.forEach(([bx,by],i)=>{
      const top=i<2,direction=top?1:-1,working=['race','nut','jam'].includes(this.phase)&&i===active,reaction=Math.max(0,1-(t-this.actionTimes[i])/420)*(this.actionTimes[i]?1:0);
      const sway=Math.sin(t/1000*(working?12:3)+i*1.1),progress=celebrating?ease(age/400):0,shift=[[-53,-15],[60,-15],[-100,-30],[100,-30]][i],sx=shift[0]*progress,sy=shift[1]*progress,standing=celebrating&&age>=250;
      const shadowY=standing?by-direction*12+sy+110:by+sy+48;
      this.ctx.fillStyle='rgba(11,13,24,.255)';this.ctx.beginPath();this.ctx.ellipse(bx+sx,shadowY,standing?85:70,29,0,0,Math.PI*2);this.ctx.fill();
      if(standing){
        const image=this.textures.get('crew-cheer').getSourceImage(),elapsed=(age-250)/1000;
        const x=bx+sx,y=by-Math.abs(Math.sin(elapsed*9+i*.8))*12-direction*12+sy;
        const angle=Math.sin(elapsed*10+i*.8)*5;
        this.img('crew-cheer',x,y,image.width*270/image.height,270,-angle*Math.PI/180,i%2===1);
      }else{
        const key=top?'crew-down':'crew-up',im=this.textures.get(key).getSourceImage();
        const [wx,wy,ww,wh]=WHEELS[i];
        // The sprites point down and up respectively; turn their tool toward the wheel centre.
        const aimedAngle=Math.atan2(wy+wh/2-by,wx+ww/2-bx)-(top?Math.PI/2:-Math.PI/2);
        const angle=sway*(working?2.5:.8)+reaction*4*(i%2?-1:1);
        const lean=working?7+(this.wheels[i]===1?3:0):0,retreat=celebrating?Math.min(18,age/250*18):(this.wheels[i]===2?10:0);
        const x=bx+sway*(working?1.5:.5)+sx,y=by+direction*(lean-retreat+reaction*5)+sy;
        // Pygame rotates counterclockwise for positive angles; Canvas uses clockwise.
        this.img(key,x,y,im.width*205/im.height,205,aimedAngle-angle*Math.PI/180);
      }
      if(reaction>0&&!celebrating){const r=WHEELS[i],x=r[0]+r[2]/2,y=top?r[1]-3:r[1]+r[3]+3,length=5+8*reaction,c=this.ctx;c.strokeStyle='#ffdc3f';c.lineWidth=3;for(const dx of [-1,0,1]){c.beginPath();c.moveTo(x+dx*11,y);c.lineTo(x+dx*15,y-direction*length);c.stroke();}}
    });
  }
  drawJack(t){
    if(['hidden','gone'].includes(this.jackState))return;
    let offset=0;if(this.jackState==='approaching')offset=1-ease((t-this.jackTime)/350);if(this.jackState==='leaving')offset=ease((t-this.jackTime)/350);
    const x=1225+270*offset,y=508+115*offset,angle=(65-8*this.lift)*Math.PI/180,c=this.ctx;
    const ox=x+Math.cos(angle)*230+58,oy=y+Math.sin(angle)*230+15;c.fillStyle='rgba(11,13,24,.25)';c.beginPath();c.ellipse(ox,oy+35,72,24,0,0,Math.PI*2);c.fill();
    const operatorAngle=['approaching','leaving'].includes(this.jackState)?-Math.sin(t/1000*4)*1.4:this.lift*4;
    this.img('operator',ox,oy,174,149,operatorAngle*Math.PI/180);
    c.save();c.translate(x,y);c.rotate(angle);if(['raise_ready','lower_ready'].includes(this.jackState))this.round(-9,-64,248,128,30,null,'#ffd813',6);const jack=this.textures.get('jack').getSourceImage();c.drawImage(jack,0,-55,230,110);c.restore();
  }
  drawJackHint(){this.panel(18,135,320,125,'#1b2037','#6977a5',20);this.text('ДОМКРАТ',178,163,25);let message=this.phase==='jack_raise'?'ПОДНИМИ БОЛИД':'ОПУСТИ БОЛИД';if(this.jackState==='approaching')message='МЕХАНИК ПОДКАТЫВАЕТ';if(this.jackState==='lifting')message='ПОДНИМАЕМ БОЛИД';if(this.jackState==='lowering')message='ОПУСКАЕМ БОЛИД';if(this.jackState==='leaving')message='УБИРАЕМ ДОМКРАТ';this.text(message,178,200,19,'#ffd841');if(['raise_ready','lower_ready'].includes(this.jackState))this.text(`НАЖМИ ДВАЖДЫ: ${this.jackClicks}/2`,178,235,17,'#d2dcf4');}
  drawLight(t){
    const active=['jack_lower','release'].includes(this.phase),green=this.phase==='celebrate'||(this.phase==='release'&&this.releaseGreen),c=this.ctx;
    if(active&&this.releaseClicks&&this.releaseFirstReady!==green){this.releaseClicks=0;this.releaseFirstReady=null;}
    if(active)this.round(63,314,242,146,26,null,'#ffd813',6);this.imageTop('light',69,320,230,134);
    for(const [x,col] of [[134,green?'#5b1f28':'#f53a39'],[234,green?'#40e164':'#1c4d34']]){c.fillStyle=col;c.beginPath();c.arc(x,379,31,0,Math.PI*2);c.fill();}
    this.circle(125,369,6,green?'#854d4d':'#ff968b');this.circle(225,369,6,green?'#b4ffbe':'#477252');
    if(active){this.text('СВЕТОФОР',184,302,20,'#101320');this.text('СВЕТОФОР',182,300,20);const message=green?`НАЖМИ ДВАЖДЫ: ${this.releaseClicks}/2`:this.releaseClicks?'1/2 — ЖДИ ЗЕЛЁНОГО':'ДОЖДИСЬ ЗЕЛЁНОГО';this.text(message,185,480,18,'#0f121e');this.text(message,183,478,18,'#ffe88b');if(t<this.warningUntil){this.text('ШТРАФ +2 s',184,515,20,'#101320');this.text('ШТРАФ +2 s',182,513,20,'#ff857b');}}
  }
  drawSelection(){this.shade();this.panel(377,275,918,400,'#222846','#8c9ccb',38);this.text('ПОДГОТОВКА К ПИТ-СТОПУ',836,328,40);this.text(this.weather==='dry'?'СУХАЯ ТРАССА':'МОКРАЯ ТРАССА',836,390,42,'#ffd619');this.text('ВЫБЕРИ КОМПЛЕКТ ШИН',836,454,31);this.text('НЕПОДХОДЯЩИЕ ШИНЫ: +2.00 s',836,489,23,'#c2cbe7');this.button(455,530,355,88,'СЛИКИ',true);this.button(862,530,355,88,'ДОЖДЕВЫЕ');}
  drawNut(){
    const loosen=this.nutMode==='loosen',c=this.ctx,cx=NUT_X,cy=NUT_Y;
    this.shade(.79);this.panel(461,105,750,730,'#222a47','#8c9ccb',38);
    this.text(loosen?'ОТКРУТИ ГАЙКУ':'ЗАКРУТИ ГАЙКУ',836,163,40);
    this.text(loosen?'УДЕРЖИВАЙ ГАЙКУ, ЧТОБЫ СНЯТЬ КОЛЕСО':'УДЕРЖИВАЙ ГАЙКУ, ЧТОБЫ ЗАКРЕПИТЬ КОЛЕСО',836,211,19,'#b9c7e0');
    this.text(`ПИТ-СТОП: ${this.currentTime().toFixed(2)} s`,836,252,18,'#ffd637');
    const wheel=this.textures.get('wheel-closeup').getSourceImage(),scale=1.55;
    // The visible hub is at (111, 111.5) in the 224 x 232 sprite, not its image midpoint.
    c.drawImage(wheel,cx-111*scale,cy-111.5*scale,wheel.width*scale,wheel.height*scale);
    this.circle(cx,cy,69,null,'#a9b7d0',6);
    if(this.nutProgress>0){c.beginPath();c.arc(cx,cy,69,-Math.PI/2,-Math.PI/2+(loosen?-1:1)*Math.PI*2*this.nutProgress,loosen);c.strokeStyle='#ffd637';c.lineWidth=8;c.lineCap='round';c.stroke();c.lineCap='butt';}
    c.save();c.translate(cx,cy);c.rotate(this.nutProgress*(loosen?-1:1)*Math.PI*3);
    const octagon=r=>Array.from({length:8},(_,i)=>{const a=Math.PI/8+i*Math.PI/4;return [Math.cos(a)*r,Math.sin(a)*r];});
    this.polygon(octagon(44),'#ecf1fa');this.polygon(octagon(39),'#444e62');
    const metal=c.createLinearGradient(-30,-35,35,40);metal.addColorStop(0,'#f4f7ff');metal.addColorStop(.35,'#a0acc3');metal.addColorStop(.7,'#606c82');metal.addColorStop(1,'#dce4f3');this.polygon(octagon(34),metal);
    this.circle(0,0,21,'#303a4d','#cbd5e4',4);this.circle(0,0,10,'#151c2b');c.restore();
    if(this.nutHolding||this.mouse&&Math.hypot(this.mouse.x-cx,this.mouse.y-cy)<=NUT_RADIUS)this.circle(cx,cy,51,null,'#ffeb91',3);
    this.text(`${Math.round(this.nutProgress*100)}%`,1052,459,27,'#ffda38');this.text('ГОТОВО',1052,487,14,'#afbeda');
    this.text(loosen?'ОТКРУЧИВАЕМ':'ЗАКРУЧИВАЕМ',620,467,16,'#ffdc50');
    this.round(552,694,568,83,18,'#151b2e','#586583',3);this.text('УДЕРЖИВАЙ ГАЙКУ',836,721,25,'#fff');this.text('МЫШЬЮ, ПАЛЬЦЕМ ИЛИ КЛАВИШЕЙ ПРОБЕЛ',836,754,16,'#b5c3db');
  }
  drawJam(t){
    this.shade(.61);this.panel(550,190,572,552,'#222846','#8c9ccb',38);this.text('ГАЙКОВЁРТ ЗАЕЛО!',836,238,34);
    const c=this.ctx,elapsed=t-this.jamTime,r=180-92*clamp(elapsed/1150,0,1),onBeat=Math.abs(elapsed-1150)<=160;
    this.circle(836,455,88,null,'#98a7d2',4);this.circle(836,455,r,null,onBeat?'#5aea70':'#ffd31e',7);this.circle(836,462,72,'#0f1224');this.circle(836,455,70,'#ffca16','#ffec87',4);this.text(this.jamKey,836,455,78,'#151623');
    this.text('НАЖМИ, КОГДА КОЛЬЦА СОВПАДУТ',836,666,22,'#eef1ff');this.text(t<this.jamFeedback?'МИМО! ПОПРОБУЙ ЕЩЁ':'ТАЙМЕР ПРОДОЛЖАЕТ ИДТИ',836,704,19,t<this.jamFeedback?'#ff877c':'#b9c6e7');
  }
  drawResult(){
    this.imageTop('result',0,0,W,H);this.panel(20,20,670,880,'#1a1f37','#8999c3',40);this.round(32,32,646,190,32,'#f02d35');this.ctx.fillStyle='#db242f';this.ctx.fillRect(32,168,646,54);this.resultFlag(52,78);this.resultFlag(600,78);this.text('PIT STOP',360,92,59);this.text('COMPLETE!',360,161,59);
    this.round(60,229,596,202,28,'#13172b');this.stopwatch(158,317);this.fitText(`${this.total.toFixed(2)} s`,432,297,104,'#fff',370);this.round(232,354,379,56,13,this.newRecord?'#63e163':'#363f62');if(this.newRecord)this.text('НОВЫЙ РЕКОРД!',421,382,28,'#122a1f');else this.fitText(`РЕКОРД: ${this.bestText()}`,421,382,26,'#f1f4ff',350);if(this.penalty)this.text(`ШТРАФ +${this.penalty.toFixed(2)} s`,436,423,19,'#ff9b90');
    const shown=Number(this.total.toFixed(2)),medal=shown<=GOLD_TIME?2:shown<=SILVER_TIME?1:0,colors=['#be7446','#abbede','#ffcc1a'],thresholds=[`> ${SILVER_TIME.toFixed(2)} s`,`ДО ${SILVER_TIME.toFixed(2)} s`,`ДО ${GOLD_TIME.toFixed(2)} s`];
    for(let i=0;i<3;i++){const x=60+198*i,cx=x+95;this.round(x,448,191,153,22,i===medal?'#454337':'#353c59',i===medal?'#ffd236':null,4);this.circle(cx,512,43,'#14182a');this.circle(cx,507,42,colors[i]);this.circle(cx,507,35,null,i===2?'#ffecb4':'#d9deec',3);this.star(cx,507,26,i===2?'#ffedad':'#dee2eb');this.fitText(thresholds[i],cx,570,24,i===medal?'#ffe076':'#c9d1e6',175);}
    this.panel(61,623,594,101,'#333b59','#7481ab',25);this.polygon([[92,683],[120,654],[137,668],[161,642],[166,660],[137,692],[120,679],[103,698]],'#5ee95e');this.text('ОТЫГРАНО ПОЗИЦИЙ',347,672,26);this.text(`+${medal}`,594,673,52,'#70f45a');this.button(70,755,278,100,'ПОВТОРИТЬ');this.button(368,741,290,106,'ДАЛЕЕ',true);this.panel(1351,20,294,68,'#1b1f36','#7b8bb7',31);this.fitText(`РЕКОРД: ${this.bestText()}`,1498,53,27,'#ffe65c',270);
  }
  resultFlag(x,y){for(let row=0;row<2;row++)for(let col=0;col<2;col++)if((row+col)%2===0)this.polygon([[x+col*28,y+row*28],[x+col*28+27,y+row*28-4],[x+col*28+24,y+row*28+23],[x+col*28-3,y+row*28+27]],'#fff');}
  stopwatch(x,y){this.circle(x,y+5,75,'#080b17');this.circle(x,y,69,'#ffcc14');this.circle(x,y,57,null,'#ffec81',4);this.circle(x,y,51,'#13172a');this.round(x-18,y-83,36,18,5,'#ffd41e');this.line([[x,y],[x+28,y-29]],'#ffd314',9);this.circle(x,y,8,'#ffd314');}
  star(x,y,r,color){const points=[];for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,rad=i%2?r*.43:r;points.push([x+Math.cos(a)*rad,y+Math.sin(a)*rad]);}this.polygon(points,color);}
}

document.fonts.ready.then(()=>{window.pitStopGame=new Phaser.Game({type:Phaser.AUTO,parent:'game',width:W,height:H,backgroundColor:'#080b17',scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH,width:W,height:H},scene:PitStopGame,audio:{disableWebAudio:false}});});
