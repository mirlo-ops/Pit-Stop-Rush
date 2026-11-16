/* Garage economy and roster. The race integration will consume this state later. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.GarageModel=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const roles={
    mechanic:{name:'Механик',icon:'🔧',price:1500,limit:9,group:'wheels',description:'Работает с гайковёртом. Опыт ускоряет его работу.'},
    auto:{name:'Автомеханик',icon:'⚡',price:9000,limit:2,group:'wheels',description:'Самостоятельно меняет одно колесо. Максимум два.'},
    jack:{name:'Механик домкрата',icon:'🏗',price:6000,limit:1,group:'jack',description:'Сам поднимает и опускает болид.'},
    engineer:{name:'Инженер',icon:'⚙️',price:3000,limit:9,group:'engineer',description:'Улучшает ресурс шин и эффективность болида.'},
    strategist:{name:'Стратег',icon:'📋',price:4000,limit:9,group:'strategist',description:'Подсказывает момент и круг пит-стопа.'}
  };
  const upgrades=[
    {id:'tools',icon:'🔧',name:'Гайковёрты',base:2000},
    {id:'reliability',icon:'🛠',name:'Надёжность оборудования',base:2200},
    {id:'jack',icon:'⬆️',name:'Домкрат',base:2400},
    {id:'crew',icon:'⚡',name:'Слаженность команды',base:2500},
    {id:'car',icon:'🏎',name:'Подготовка болида',base:3000}
  ];
  const tyres={
    soft:{name:'Мягкие',color:'#fb5762',price:1200,wear:7,pace:'Быстрые',weather:'dry'},
    medium:{name:'Средние',color:'#ffce2b',price:900,wear:5,pace:'Баланс',weather:'dry'},
    hard:{name:'Жёсткие',color:'#e9f0fb',price:800,wear:3,pace:'Долговечные',weather:'dry'},
    wet:{name:'Дождевые',color:'#4db9ff',price:1000,wear:4,pace:'Для дождя',weather:'wet'}
  };
  const integer=(v,min,max,fallback)=>Number.isInteger(v)&&v>=min&&v<=max?v:fallback;
  const clone=x=>JSON.parse(JSON.stringify(x));
  function makeWorker(type,index,active){return {id:`${type}-${index}`,type,active,level:1,xp:0,energy:100,...(type==='mechanic'?{specialty:index%2?'speed':'reliable'}:{})};}
  function fresh(){return {schema:2,coins:24800,upgrades:{tools:1,reliability:1,jack:1,crew:1,car:1},staff:{mechanic:4,auto:0,jack:0,engineer:0,strategist:0},workers:Array.from({length:4},(_,i)=>makeWorker('mechanic',i+1,true)),tyres:{soft:0,medium:1,hard:0,wet:1},selectedTyre:'medium',weather:'dry',race:{lap:1,total:20,wear:0},settings:{music:35,effects:75}};}
  function recalcStaff(s){for(const role of Object.keys(roles))s.staff[role]=s.workers.filter(w=>w.type===role).length;}
  function normalize(raw){
    const s=fresh();if(!raw||typeof raw!=='object'||Array.isArray(raw))return s;
    s.coins=integer(raw.coins,0,99999999,s.coins);
    for(const k of Object.keys(s.upgrades))s.upgrades[k]=integer(raw.upgrades?.[k],1,5,1);
    for(const k of Object.keys(s.settings))s.settings[k]=integer(raw.settings?.[k],0,100,s.settings[k]);
    if(raw.schema===2&&Array.isArray(raw.workers)){
      const used=new Set(),counts={};const slots={wheels:0,jack:0,engineer:0,strategist:0};s.workers=[];
      for(const item of raw.workers){
        const def=roles[item?.type];if(!def||typeof item.id!=='string'||!/^\w+-\d+$/.test(item.id)||used.has(item.id))continue;
        counts[item.type]=(counts[item.type]||0)+1;if(counts[item.type]>def.limit)continue;used.add(item.id);
        const cap=def.group==='wheels'?4:1,active=!!item.active&&slots[def.group]<cap;if(active)slots[def.group]++;
        const specialty=item.type==='mechanic'?(item.specialty==='speed'||item.specialty==='reliable'?item.specialty:(Number(item.id.split('-')[1])%2?'speed':'reliable')):undefined;
        s.workers.push({id:item.id,type:item.type,active,level:integer(item.level,1,5,1),xp:integer(item.xp,0,9999,0),energy:integer(item.energy,0,100,100),...(specialty?{specialty}:{})});
      }
      for(const k of Object.keys(tyres))s.tyres[k]=integer(raw.tyres?.[k],0,99,s.tyres[k]);
      if(tyres[raw.selectedTyre]&&s.tyres[raw.selectedTyre]>0)s.selectedTyre=raw.selectedTyre;
      if(raw.weather==='dry'||raw.weather==='wet')s.weather=raw.weather;
      s.race.total=integer(raw.race?.total,2,100,20);s.race.lap=integer(raw.race?.lap,1,s.race.total,1);s.race.wear=integer(raw.race?.wear,0,100,0);
    }else{
      s.workers=[];
      for(const type of ['mechanic','engineer','strategist']){
        const count=integer(raw.staff?.[type],0,roles[type].limit,type==='mechanic'?4:0);
        for(let i=1;i<=count;i++)s.workers.push(makeWorker(type,i,i<=(type==='mechanic'?4:1)));
      }
    }
    recalcStaff(s);return s;
  }
  function active(s,group){return s.workers.filter(w=>w.active&&roles[w.type].group===group);}
  function upgradeCost(s,item){return Math.round(item.base*(1+(s.upgrades[item.id]-1)*.6)/100)*100;}
  function nutSeconds(s,worker){const level=worker?.level||1,energy=worker?.energy??100,specialty=worker?.specialty==='speed'?.97:.98;return .675*Math.pow(.97,s.upgrades.tools-1)*Math.pow(.98,s.upgrades.crew-1)*Math.pow(specialty,level-1)*(energy<40?1.15:1);}
  function jamPercent(s,worker){const base=Math.max(4,12-2*(s.upgrades.reliability-1)),bonus=worker?.specialty==='reliable'?worker.level:0,fatigue=(worker?.energy??100)<40?3:0;return Math.max(2,base-bonus+fatigue);}
  function jackSeconds(s,worker){return Math.max(.45,1*Math.pow(.92,s.upgrades.jack-1)*Math.pow(.98,(worker?.level||1)-1)*((worker?.energy??100)<40?1.15:1));}
  function wearPerLap(s){const compound=tyres[s.selectedTyre];let base=compound.weather===s.weather?compound.wear:12;const engineer=active(s,'engineer')[0];const engineerFactor=engineer?Math.max(.9,1-.02*engineer.level):1;return Math.max(1,base*(1-.02*(s.upgrades.car-1))*engineerFactor);}
  function strategy(s){const rate=wearPerLap(s),remaining=Math.max(0,80-s.race.wear),laps=Math.ceil(remaining/rate),target=Math.min(s.race.total,s.race.lap+laps);return {rate,target,remainingLaps:laps,due:remaining<=rate,appropriate:tyres[s.selectedTyre].weather===s.weather};}
  function hire(s,type){const def=roles[type];if(!def)return 'Неизвестная должность.';const count=s.workers.filter(w=>w.type===type).length;if(count>=def.limit)return 'Достигнут предел сотрудников этой специальности.';if(s.coins<def.price)return 'Недостаточно монет.';
    const indices=s.workers.filter(w=>w.type===type).map(w=>Number(w.id.split('-')[1])||0),index=Math.max(0,...indices)+1,capacity=def.group==='wheels'?4:1;const available=active(s,def.group).length<capacity;s.coins-=def.price;s.workers.push(makeWorker(type,index,available));recalcStaff(s);return null;}
  function toggleActive(s,id){const w=s.workers.find(x=>x.id===id);if(!w)return 'Сотрудник не найден.';if(w.active){w.active=false;return null;}const group=roles[w.type].group,cap=group==='wheels'?4:1;if(active(s,group).length>=cap)return group==='wheels'?'В составе уже четыре механика: сначала отправь одного в резерв.':'Эта должность уже занята: сначала отправь сотрудника в резерв.';w.active=true;return null;}
  function buyTyre(s,id){const tyre=tyres[id];if(!tyre)return 'Неизвестный тип шин.';if(s.tyres[id]>=99)return 'На складе максимум 99 комплектов.';if(s.coins<tyre.price)return 'Недостаточно монет.';s.coins-=tyre.price;s.tyres[id]++;return null;}
  function recoverBaseTyre(s,id){if(!['medium','wet'].includes(id))return 'Такой комплект нельзя получить бесплатно.';if(s.tyres[id]>0)return 'Базовый комплект уже есть.';s.tyres[id]=1;return null;}
  return {roles,upgrades,tyres,fresh,normalize,recalcStaff,active,upgradeCost,nutSeconds,jamPercent,jackSeconds,wearPerLap,strategy,hire,toggleActive,buyTyre,recoverBaseTyre,clone};
});
