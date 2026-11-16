(() => {
  'use strict';
  const M=window.GarageModel,key='pitstop.garage.demo.v1';
  let stored=null;try{stored=JSON.parse(localStorage.getItem(key)||'null');}catch(_){}
  const state=M.normalize(stored);
  let current='',previousFocus=null,drill=null,drillInterval=null,drillTimers=[];
  const balance=document.querySelector('#balance'),dialogBalance=document.querySelector('#dialog-balance'),time=document.querySelector('#date-time');
  const overlay=document.querySelector('.overlay'),dialog=overlay.querySelector('.dialog');
  const title=document.querySelector('#dialog-title'),content=document.querySelector('#dialog-content'),notice=document.querySelector('.notice'),close=document.querySelector('.close');
  const number=n=>new Intl.NumberFormat('ru-RU').format(n);
  const icon=name=>window.GarageIcons.icon(name);
  const levelMeter=level=>`<span class="level-meter" aria-hidden="true">${Array.from({length:5},(_,i)=>`<i class="${i<level?'is-filled':''}"></i>`).join('')}</span>`;
  const label=worker=>`${M.roles[worker.type].name} ${worker.id.split('-')[1]}`;
  const price=(n)=>`<img class="currency-icon price-coin" src="assets/currency.png" alt=""> ${number(n)}`;
  function save(){try{M.recalcStaff(state);localStorage.setItem(key,JSON.stringify(state));return true;}catch(_){notice.textContent='Не удалось сохранить изменения в браузере.';return false;}}
  function refreshBalance(){balance.textContent=number(state.coins);dialogBalance.textContent=number(state.coins);}
  function refreshClock(){const d=new Date();time.dateTime=d.toISOString();time.textContent=`${new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'long'}).format(d).toUpperCase()} · ${new Intl.DateTimeFormat('ru-RU',{hour:'2-digit',minute:'2-digit'}).format(d)}`;}
  function show(name){stopDrill();previousFocus=document.activeElement;current=name;overlay.hidden=false;render();close.focus();}
  function hide(){stopDrill();overlay.hidden=true;current='';notice.textContent='';previousFocus?.focus();}
  function navigate(name){stopDrill();current=name;render();dialog.scrollTop=0;}
  function status(message){notice.textContent=message;}
  function isActive(group){return M.active(state,group)[0];}
  function workerSummary(w){const xpNeed=w.level*40,specialty=w.specialty?` · ${w.specialty==='speed'?'Скорость':'Надёжность'}`:'';return `Ур. ${w.level}/5 · Опыт ${w.xp}/${xpNeed} · Бодрость ${w.energy}%${specialty}`;}
  function upgradeMetric(id,snapshot){
    const values={tools:['Удержание гайки',`${M.nutSeconds(snapshot,null).toFixed(3)} с`],reliability:['Шанс заедания',`${M.jamPercent(snapshot)}%`],jack:['Подъём / опускание',`${M.jackSeconds(snapshot,null).toFixed(2)} с`],crew:['Ускорение гайки',`${Math.round((1-Math.pow(.98,snapshot.upgrades.crew-1))*100)}%`],car:['Снижение износа',`${(snapshot.upgrades.car-1)*2}%`]};return values[id];
  }
  function renderUpgrades(){
    title.textContent='ПРОКАЧКА';
    content.innerHTML='<p class="dialog-intro">Подготовь технику и команду к пит-стопу.</p><div class="list-heading"><span>НАПРАВЛЕНИЕ</span><span>УЛУЧШЕНИЕ</span></div><div class="item-list upgrade-list">'+M.upgrades.map(x=>{
      const level=state.upgrades[x.id],cost=M.upgradeCost(state,x),max=level>=5,[metric,value]=upgradeMetric(x.id,state),next=M.clone(state);
      if(!max)next.upgrades[x.id]++;
      return `<article class="item"><span class="item-icon" aria-hidden="true"><img class="upgrade-icon-image" src="assets/upgrade-icons/${["tools", "crew"].includes(x.id) ? x.id + "-simple" : x.id}.png" alt=""></span><div class="item-copy"><h3>${x.name}</h3><p>${metric}: ${value}${max?'':` <span class="metric-next">→ ${upgradeMetric(x.id,next)[1]}</span>`}</p><div class="item-level"><span class="item-count">УРОВЕНЬ ${level} / 5</span>${levelMeter(level)}</div></div><button class="buy" data-upgrade="${x.id}" aria-label="${max ? `${x.name}: максимальный уровень` : `Улучшить ${x.name}, ${number(cost)} монет`}" ${max||state.coins<cost?'disabled':''}>${max?'МАКС.':`<span class="purchase-price">${price(cost)}</span>`}</button></article>`;
    }).join('')+'</div><p class="local-note">Улучшения действуют в тренировке и прогнозе. Основная гонка ещё не подключена.</p>';
  }
  function renderStaff(){
    title.textContent='ПЕРСОНАЛ';
    content.innerHTML='<p class="dialog-intro">Выбери специалистов для своей команды.</p><div class="list-heading"><span>СОТРУДНИК</span><span>КОНТРАКТ</span></div><div class="item-list hire-list">'+Object.entries(M.roles).map(([id,x])=>{
      const count=state.staff[id],max=count>=x.limit;
      return `<article class="item"><span class="item-icon" aria-hidden="true">${icon(id)}</span><div class="item-copy"><h3>${x.name}</h3><p>${x.description}</p><p class="item-count">НАНЯТО: ${count} / ${x.limit}</p></div><button class="buy" data-staff="${id}" aria-label="${max ? `${x.name}: достигнут предел` : `Нанять ${x.name}, ${number(x.price)} монет`}" ${max||state.coins<x.price?'disabled':''}>${max?'МАКС.':`<span class="purchase-price">${price(x.price)}</span>`}</button></article>`;
    }).join('')+'</div><div class="dialog-actions"><button class="secondary" data-nav="room">КОМНАТА ПЕРСОНАЛА</button></div>';
  }
  function renderRoom(){
    title.textContent='КОМНАТА ПЕРСОНАЛА';
    const wheels=M.active(state,'wheels'),automated=wheels.filter(w=>w.type==='auto').length;
    const summary=`СОСТАВ: КОЛЁСА ${wheels.length}/4 · АВТО ${automated}/2 · ДОМКРАТ ${isActive('jack')?'1':'0'}/1`;
    content.innerHTML=`<p class="dialog-intro">Назначай людей, восстанавливай силы и повышай уровень за опыт. Бодрость ниже 40% замедляет работу. Обычные механики специализируются на скорости или надёжности.</p><div class="summary-strip">${summary}</div><div class="dialog-actions"><button class="demo-button" data-start-drill>ТРЕНИРОВКА ПИТ-СТОПА</button><button class="secondary" data-nav="staff">НАНЯТЬ ПЕРСОНАЛ</button></div><p class="local-note compact">Тренировка даёт опыт и расходует бодрость. Она упрощена: обычное колесо меняется одним нажатием.</p><div class="staff-list">`+state.workers.map(w=>{
      const max=w.level>=5,need=w.level*40,eligible=!max&&w.xp>=need;
      return `<article class="person ${w.active?'person-active':''}" data-person="${w.id}"><div class="person-heading"><span class="person-icon" aria-hidden="true">${icon(w.type)}</span><div><h3>${label(w)}</h3><p>${workerSummary(w)}</p>${w.specialty?`<p>Гайка: ${M.nutSeconds(state,w).toFixed(3)} с · заедание: ${M.jamPercent(state,w)}%</p>`:''}</div><span class="tag ${w.active?'tag-active':''}">${w.active?'СОСТАВ':'РЕЗЕРВ'}</span></div><div class="energy-track" role="meter" aria-label="Бодрость: ${label(w)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${w.energy}"><span style="width:${w.energy}%"></span></div><div class="person-actions"><button class="secondary" data-assign="${w.id}">${w.active?'В РЕЗЕРВ':'В СОСТАВ'}</button><button class="secondary" data-rest="${w.id}" ${w.energy===100?'disabled':''}>ОТДЫХ</button><button class="secondary" data-train="${w.id}" ${!eligible?'disabled':''}>${max?'МАКС. УР.':`УЛУЧШИТЬ (${need} ОП.)`}</button></div></article>`;
    }).join('')+'</div>';
  }
  function renderTyres(){
    title.textContent='МАГАЗИН ШИН';
    content.innerHTML='<p class="dialog-intro">Выбери комплект под условия трассы.</p><div class="list-heading"><span>СОСТАВ РЕЗИНЫ</span><span>СКЛАД</span></div><div class="item-list tyre-list">'+Object.entries(M.tyres).map(([id,t])=>{
      const selected=state.selectedTyre===id,free=['medium','wet'].includes(id)&&state.tyres[id]===0;
      return `<article class="item tyre-item ${selected?'tyre-selected':''}"><span class="tyre-icon" style="--tyre-color:${t.color}" aria-hidden="true"></span><div class="item-copy"><h3>${t.name}</h3><p>${t.pace} · износ ${t.wear}% / круг в подходящую погоду</p><p class="item-count">НА СКЛАДЕ: ${state.tyres[id]} ${selected?'· ВЫБРАНЫ':''}</p></div><div class="tyre-actions"><button class="secondary" data-select-tyre="${id}" ${selected||!state.tyres[id]?'disabled':''}>${selected?'ВЫБРАНЫ':'ВЫБРАТЬ'}</button><button class="buy" data-buy-tyre="${id}" ${state.coins<t.price||state.tyres[id]>=99?'disabled':''}>КУПИТЬ <small>${price(t.price)}</small></button>${free?`<button class="secondary" data-free-tyre="${id}">БАЗОВЫЙ БЕСПЛАТНО</button>`:''}</div></article>`;
    }).join('')+'</div><div class="dialog-actions"><button class="secondary" data-nav="strategy">ПРОГНОЗ СТРАТЕГА</button></div><p class="local-note">Средний и дождевой комплекты можно получить бесплатно, если их нет на складе. В демонстрации шины не расходуются.</p>';
  }
  function forecastHtml(){
    const t=M.tyres[state.selectedTyre],x=M.strategy(state),strategist=isActive('strategist');
    let recommendation;
    if(!strategist)recommendation='Назначь стратега в комнате персонала, чтобы получить рекомендацию круга.';
    else if(x.due)recommendation=`Пора вызывать пилота: пит-стоп на круге ${Math.min(state.race.total,state.race.lap+1)}.`;
    else if(state.race.lap+x.remainingLaps>=state.race.total)recommendation='Этот комплект по прогнозу доедет до финиша при текущем темпе износа.';
    else recommendation=`Рекомендуемый пит-стоп: круг ${x.target}. Вызови пилота заранее, до достижения 80% износа.`;
    return `<p><strong>${recommendation}</strong></p><p>${t.name} · прогноз износа ${x.rate.toFixed(1)}% / круг${strategist?` · стратег ур. ${strategist.level}, горизонт ${Math.min(7,2+strategist.level)} кругов`:''}</p>${x.appropriate?'':'<p class="warning">Резина не подходит погоде: износ повышен.</p>'}`;
  }
  function renderStrategy(){
    title.textContent='СТРАТЕГИЯ';
    content.innerHTML=`<p class="dialog-intro">Проверь примерный прогноз для выбранного комплекта. Это расчёт, а не данные реальной гонки.</p><div class="strategy-form"><label>ПОГОДА <select data-race="weather"><option value="dry" ${state.weather==='dry'?'selected':''}>Сухо</option><option value="wet" ${state.weather==='wet'?'selected':''}>Дождь</option></select></label><label>ТЕКУЩИЙ КРУГ <input data-race="lap" type="number" min="1" max="${state.race.total}" value="${state.race.lap}"></label><label>ВСЕГО КРУГОВ <input data-race="total" type="number" min="2" max="100" value="${state.race.total}"></label><label>ИЗНОС, % <input data-race="wear" type="number" min="0" max="100" value="${state.race.wear}"></label></div><div class="forecast" aria-live="polite">${forecastHtml()}</div><div class="dialog-actions"><button class="secondary" data-nav="tyres">В МАГАЗИН ШИН</button><button class="secondary" data-nav="room">КОМАНДА</button></div>`;
  }
  function render(){
    notice.textContent='';dialog.dataset.screen=current;refreshBalance();
    if(current==='upgrades')renderUpgrades();
    else if(current==='staff')renderStaff();
    else if(current==='room')renderRoom();
    else if(current==='tyres')renderTyres();
    else if(current==='strategy')renderStrategy();
    else if(current==='drill')renderDrill();
    else if(current==='settings'){
      title.textContent='НАСТРОЙКИ';content.innerHTML=`<p class="dialog-intro">Настрой громкость для будущей игры.</p>${[['music','МУЗЫКА'],['effects','ЭФФЕКТЫ']].map(([k,l])=>`<label class="setting-row"><span>${l}</span><input type="range" min="0" max="100" value="${state.settings[k]}" data-setting="${k}"><output>${state.settings[k]}%</output></label>`).join('')}<p class="local-note">Звуки будут подключены при объединении экранов.</p>`;
    }else if(current==='wallet'){
      title.textContent='МОНЕТЫ';content.innerHTML=`<p class="dialog-intro">Игровая валюта для улучшений и найма персонала.</p><div class="wallet-balance">${price(state.coins)}</div><button class="demo-button" data-add-coins>ДОБАВИТЬ 5 000</button><p class="local-note">Демонстрационное пополнение для проверки возможностей гаража.</p>`;
    }else{
      const race=current==='race';title.textContent=race?'ПОЛНАЯ ГОНКА':'ОДИНОЧНЫЙ ПИТ-СТОП';
      content.innerHTML=`<div class="mode-summary"><div class="mode-icon">${icon(race?'mode-race':'mode-pitstop')}</div><p>${race?'Вызывай пилота на пит-стоп во время гонки и управляй стратегией команды.':'Проверь скорость своей команды в отдельном пит-стопе.'}</p><p>Это демонстрация гаража. Переход в режим появится при объединении экранов игры.</p><div class="dialog-actions"><button class="demo-button" data-close>В ГАРАЖ</button><button class="secondary" data-nav="${race?'strategy':'room'}">${race?'ПРОГНОЗ СТРАТЕГА':'ТРЕНИРОВКА'}</button></div></div>`;
    }
  }
  function stopDrill(){if(drillInterval)clearInterval(drillInterval);drillInterval=null;for(const timer of drillTimers)clearTimeout(timer);drillTimers=[];drill=null;}
  function later(fn,delay){const timer=setTimeout(()=>{drillTimers=drillTimers.filter(t=>t!==timer);if(drill&&current==='drill')fn();},delay);drillTimers.push(timer);}
  function beginDrill(){
    const wheels=M.active(state,'wheels');if(wheels.length!==4){status('Для тренировки назначь четырёх механиков на колёса.');return;}
    stopDrill();current='drill';drill={phase:'raise',jackClicks:0,wheels:wheels.map(w=>({id:w.id,type:w.type,status:'waiting'})),started:performance.now(),finished:null};render();
    drillInterval=setInterval(()=>{const el=content.querySelector('[data-drill-time]');if(el&&drill)el.textContent=(((drill.finished??performance.now())-drill.started)/1000).toFixed(2)+' с';},50);
    if(isActive('jack'))beginJack();
  }
  function renderDrill(){
    title.textContent='ТРЕНИРОВКА';if(!drill)return;
    const jack=isActive('jack');const labels={raise:'Подними болид двойным нажатием',raising:'Домкрат поднимает болид…',wheels:'Замени оставшиеся колёса',lower:'Опусти болид двойным нажатием',lowering:'Домкрат опускает болид…',done:'Пит-стоп завершён!'};
    const jackLabel=jack?`ДОМКРАТ: ${jack?label(jack):''} · АВТОМАТИЧЕСКИ`:'ДОМКРАТ: ВРУЧНУЮ';
    const jackButton=['raise','lower'].includes(drill.phase)&&!jack?`<button class="buy" data-drill-jack>${drill.phase==='raise'?'ПОДНЯТЬ':'ОПУСТИТЬ'} <small>${drill.jackClicks} / 2 нажатия</small></button>`:'';
    content.innerHTML=`<div class="drill-header"><span class="drill-timer" data-drill-time>${(((drill.finished??performance.now())-drill.started)/1000).toFixed(2)} с</span><div><strong>${labels[drill.phase]}</strong><p>${jackLabel}</p></div>${jackButton}</div><div class="wheel-grid">${drill.wheels.map((w,i)=>{const person=state.workers.find(p=>p.id===w.id),done=w.status==='done',busy=w.status==='busy',automatic=w.type==='auto';return `<button class="wheel-card ${done?'wheel-done':''}" data-wheel="${i}" ${drill.phase!=='wheels'||done||busy||automatic?'disabled':''}><span>КОЛЕСО ${i+1}</span><strong>${done?'✓ ГОТОВО':busy?'В РАБОТЕ':automatic?'АВТО':'НАЖМИ'}</strong><small>${person?label(person):'Механик'}${automatic?' · АВТО':''}</small></button>`;}).join('')}</div><p class="local-note">Упрощённая тренировка: обычные колёса меняются одним нажатием; автомеханики работают сами. QTE здесь не разыгрывается. Опыт начисляется только после завершения.</p>${drill.phase==='done'?'<button class="demo-button" data-nav="room">В КОМНАТУ ПЕРСОНАЛА</button>':''}`;
  }
  function beginJack(){
    if(!drill||!['raise','lower'].includes(drill.phase))return;const raising=drill.phase==='raise';drill.phase=raising?'raising':'lowering';drill.jackClicks=0;renderDrill();
    later(()=>{if(raising){drill.phase='wheels';renderDrill();for(let i=0;i<drill.wheels.length;i++)if(drill.wheels[i].type==='auto')startWheel(i);}else finishDrill();},M.jackSeconds(state,isActive('jack'))*1000);
  }
  function startWheel(index){
    if(!drill||drill.phase!=='wheels')return;const wheel=drill.wheels[index];if(!wheel||wheel.status!=='waiting')return;wheel.status='busy';renderDrill();
    const worker=state.workers.find(w=>w.id===wheel.id);later(()=>{wheel.status='done';if(drill.wheels.every(w=>w.status==='done')){drill.phase='lower';renderDrill();if(isActive('jack'))beginJack();}else renderDrill();},M.nutSeconds(state,worker)*2000);
  }
  function finishDrill(){
    if(!drill||drill.phase!=='lowering')return;drill.phase='done';drill.finished=performance.now();if(drillInterval)clearInterval(drillInterval);drillInterval=null;
    for(const w of state.workers.filter(w=>w.active)){w.xp=Math.min(9999,w.xp+20);w.energy=Math.max(0,w.energy-(M.roles[w.type].group==='wheels'?20:w.type==='jack'?12:5));}
    save();renderDrill();status('Тренировка завершена: активные сотрудники получили по 20 опыта.');
  }
  document.querySelectorAll('[data-open]').forEach(button=>button.addEventListener('click',()=>show(button.dataset.open)));
  document.querySelectorAll('[data-mode]').forEach(button=>button.addEventListener('click',()=>show(button.dataset.mode)));
  document.querySelector('.zone-workshop').addEventListener('click',()=>show('upgrades'));
  document.querySelector('.zone-lounge').addEventListener('click',()=>show('room'));
  document.querySelector('.zone-tyres').addEventListener('click',()=>show('tyres'));
  document.querySelector('.add-coins').addEventListener('click',()=>show('wallet'));
  close.addEventListener('click',hide);overlay.addEventListener('click',event=>{if(event.target===overlay)hide();});
  document.addEventListener('keydown',event=>{if(!overlay.hidden&&event.key==='Escape')hide();if(!overlay.hidden&&event.key==='Tab'){const items=[...dialog.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled)')];if(!items.length)return;const first=items[0],last=items[items.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}});
  content.addEventListener('click',event=>{
    const button=event.target.closest('button');if(!button||button.disabled)return;
    if(button.hasAttribute('data-close')){hide();return;}
    if(button.dataset.nav){navigate(button.dataset.nav);return;}
    if(button.hasAttribute('data-start-drill')){beginDrill();return;}
    if(button.hasAttribute('data-drill-jack')){drill.jackClicks++;if(drill.jackClicks>=2)beginJack();else renderDrill();return;}
    if(button.dataset.wheel!==undefined){startWheel(Number(button.dataset.wheel));return;}
    if(button.hasAttribute('data-add-coins')){state.coins=Math.min(99999999,state.coins+5000);save();render();status('Начислено 5 000 демо-монет.');return;}
    const upgrade=M.upgrades.find(x=>x.id===button.dataset.upgrade);
    if(upgrade){const cost=M.upgradeCost(state,upgrade);if(state.upgrades[upgrade.id]>=5||state.coins<cost)return;state.coins-=cost;state.upgrades[upgrade.id]++;save();render();status(`${upgrade.name}: уровень ${state.upgrades[upgrade.id]}.`);return;}
    if(button.dataset.staff){const def=M.roles[button.dataset.staff],err=M.hire(state,button.dataset.staff);if(err){status(err);return;}save();render();status(`${def.name} нанят. Проверь назначение в комнате персонала.`);return;}
    if(button.dataset.assign){const err=M.toggleActive(state,button.dataset.assign);if(err){status(err);return;}save();render();status('Состав обновлён.');return;}
    if(button.dataset.rest){const w=state.workers.find(w=>w.id===button.dataset.rest);if(!w)return;w.energy=100;save();render();status(`${label(w)} отдохнул.`);return;}
    if(button.dataset.train){const w=state.workers.find(w=>w.id===button.dataset.train);if(!w||w.level>=5||w.xp<w.level*40)return;w.xp-=w.level*40;w.level++;save();render();status(`${label(w)}: уровень ${w.level}.`);return;}
    if(button.dataset.buyTyre){const err=M.buyTyre(state,button.dataset.buyTyre);if(err){status(err);return;}save();render();status('Комплект добавлен на склад.');return;}
    if(button.dataset.freeTyre){const err=M.recoverBaseTyre(state,button.dataset.freeTyre);if(err){status(err);return;}save();render();status('Базовый комплект добавлен на склад.');return;}
    if(button.dataset.selectTyre){const id=button.dataset.selectTyre;if(!M.tyres[id]||!state.tyres[id])return;state.selectedTyre=id;save();render();status(`Выбраны шины: ${M.tyres[id].name.toLowerCase()}.`);}
  });
  content.addEventListener('input',event=>{
    const el=event.target;if(el.matches('[data-setting]')){state.settings[el.dataset.setting]=Number(el.value);el.nextElementSibling.textContent=`${el.value}%`;save();return;}
    if(el.matches('[data-race]')){const k=el.dataset.race;if(k==='weather')state.weather=el.value==='wet'?'wet':'dry';else{if(el.value==='')return;const n=Math.round(Number(el.value));if(!Number.isFinite(n))return;state.race[k]=Math.max(k==='total'?2:k==='lap'?1:0,Math.min(k==='total'?100:k==='lap'?state.race.total:100,n));if(k==='total'){state.race.lap=Math.min(state.race.lap,state.race.total);const lap=content.querySelector('[data-race="lap"]');lap.max=state.race.total;lap.value=state.race.lap;}}save();content.querySelector('.forecast').innerHTML=forecastHtml();}
  });
  content.addEventListener('change',event=>{const el=event.target;if(el.matches('input[data-race]'))el.value=state.race[el.dataset.race];});
  const sceneViewport=document.querySelector('.zone-viewport');if(matchMedia('(max-aspect-ratio: 1/1)').matches)requestAnimationFrame(()=>{sceneViewport.scrollLeft=(sceneViewport.scrollWidth-sceneViewport.clientWidth)*.48;});
  refreshBalance();refreshClock();setInterval(refreshClock,1000);
})();
