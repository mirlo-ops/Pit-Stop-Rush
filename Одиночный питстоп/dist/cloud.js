/* Firebase anonymous authentication, Realtime Database and durable offline queue. */
class CloudService {
  constructor() {
    this.key = 'pitstop.web.';
    this.status = 'Подключение…'; this.global = []; this.dailyBoard = []; this.leaderboardVersion = 2;
    this.online = false; this.busy = false; this.syncRequested = false; this.config = null;
    this.auth = this.read('auth', null);
    this.load();
    setInterval(() => this.sync(), 30000);
    window.addEventListener('online', () => this.sync());
  }
  read(key, fallback) { try { const v = localStorage.getItem(this.key + key); return v === null ? fallback : JSON.parse(v); } catch (_) { return fallback; } }
  records(key) { const value=localStorage.getItem(this.key+key); if(value===null)return []; const result=JSON.parse(value); if(!Array.isArray(result))throw Error('Повреждён файл очереди'); return result; }
  write(key, value) { localStorage.setItem(this.key + key, JSON.stringify(value)); }
  displayName() {
    const name = this.read('nickname', '');
    return typeof name === 'string' && name.trim() ? name : this.auth?.uid ? `Пилот-${this.auth.uid.slice(0,4).toUpperCase()}` : 'Пилот';
  }
  setDisplayName(value) {
    const name = value.replace(/[\u0000-\u001f\u007f-\u009f]/g, '').trim().replace(/\s+/g, ' ');
    if (!name || name.length > 24) throw Error('Введите имя от 1 до 24 символов');
    this.write('nickname', name);
    this.sync();
  }
  daily() {
    const day = Math.floor(Date.now() / 86400000);
    const date = new Date(day * 86400000).toISOString().slice(0, 10);
    return {id: `daily-${date}`, date, weather: day % 2 === 0 ? 'dry' : 'wet'};
  }
  async load() {
    try { const r = await fetch('firebase-config.json'); if (!r.ok) throw Error('config'); this.config = await r.json(); if (!this.config.database_url || !this.config.api_key) throw Error('config'); this.sync(); }
    catch (_) { this.status = 'Локальный режим'; }
  }
  queue(result) {
    try { const queue = this.records('pending'); queue.push(result); this.write('pending', queue); this.sync(); }
    catch (_) { this.status = 'Не удалось сохранить результат'; }
  }
  async request(url, payload, options = {}) {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(url, {method:'POST', headers:{'Content-Type': options.form ? 'application/x-www-form-urlencoded' : 'application/json', ...(options.headers || {})}, body: options.form ? new URLSearchParams(payload) : JSON.stringify(payload), signal: controller.signal});
      const value = await response.json().catch(() => ({}));
      if (!response.ok || value.error) { const e = new Error(value.error?.message || (typeof value.error==='string'?value.error:`HTTP ${response.status}`)); e.status = value.error?.status; e.httpStatus=response.status; throw e; }
      return value;
    } finally { clearTimeout(timer); }
  }
  async login() {
    const key = encodeURIComponent(this.config.api_key);
    if (this.auth && this.auth.expires > Date.now() + 180000) return;
    if (this.auth?.refresh) {
      try {
        const r = await this.request(`https://securetoken.googleapis.com/v1/token?key=${key}`, {grant_type:'refresh_token',refresh_token:this.auth.refresh}, {form:true});
        this.auth = {uid:r.user_id, token:r.id_token, refresh:r.refresh_token, expires:Date.now()+Number(r.expires_in)*1000}; this.write('auth',this.auth); return;
      } catch(e) { if (!/INVALID_REFRESH_TOKEN|TOKEN_EXPIRED/.test(e.message)) throw e; }
    }
    const r = await this.request(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${key}`, {returnSecureToken:true});
    this.auth = {uid:r.localId, token:r.idToken, refresh:r.refreshToken, expires:Date.now()+Number(r.expiresIn)*1000}; this.write('auth',this.auth);
  }
  async database(path, options = {}) {
    const base=this.config.database_url.replace(/\/$/,''), url=new URL(`${base}/${path}.json`);
    url.searchParams.set('auth',this.auth.token);
    if(options.query) for(const [key,value] of Object.entries(options.query))url.searchParams.set(key,value);
    const controller=new AbortController(), timer=setTimeout(()=>controller.abort(),8000);
    try {
      const response=await fetch(url, {method:options.method||'GET',headers:options.body?{'Content-Type':'application/json'}:{},body:options.body?JSON.stringify(options.body):undefined,signal:controller.signal,cache:'no-store'});
      let value;try{value=await response.json();}catch(_){throw Error('Некорректный ответ базы данных');}
      if(!response.ok){const error=new Error(typeof value?.error==='string'?value.error:`HTTP ${response.status}`);error.httpStatus=response.status;throw error;}
      return value;
    } finally {clearTimeout(timer);}
  }
  boardPath(run) {
    if(run.mode==='casual')return null;
    if(run.mode!=='daily'||typeof run.challengeId!=='string'||!/^daily-\d{4}-\d{2}-\d{2}$/.test(run.challengeId))throw Error('Некорректная дата ежедневного заезда');
    const date=run.challengeId.slice(6), parsed=new Date(`${date}T00:00:00.000Z`);
    if(Number.isNaN(parsed.getTime())||parsed.toISOString().slice(0,10)!==date)throw Error('Некорректная дата ежедневного заезда');
    return `leaderboards/daily/${date}`;
  }
  validateRun(run) {
    if(!run || typeof run!=='object' || Array.isArray(run))throw Error('Некорректный формат результата');
    if(typeof run.runId!=='string'||!run.runId)throw Error('Нет идентификатора заезда');
    if(typeof run.total!=='number'||!Number.isFinite(run.total)||run.total<1||run.total>86400)throw Error('Время за пределами правил базы');
    if(!['gold','silver','bronze'].includes(run.medal))throw Error('Некорректная медаль');
    return this.boardPath(run);
  }
  async saveBest(path, entry) {
    const own=`${path}/${encodeURIComponent(this.auth.uid)}`;
    const existing=await this.database(own);
    if(existing && typeof existing.bestTime==='number' && existing.bestTime<=entry.bestTime)return;
    try {await this.database(own,{method:'PUT',body:entry});}
    catch(error) {
      // Rules forbid replacing a better result. Another tab may have won the race.
      if(error.httpStatus===401||error.httpStatus===403){const current=await this.database(own);if(current && typeof current.bestTime==='number' && current.bestTime<=entry.bestTime)return;}
      throw error;
    }
  }
  async renameBest(path, name) {
    const own = `${path}/${encodeURIComponent(this.auth.uid)}`;
    // A concurrent tab can submit a better time between GET and PUT.
    for (let attempt = 0; attempt < 3; attempt++) {
      const current = await this.database(own);
      if (!current || current.name === name) return;
      try {
        await this.database(own, {method:'PUT', body:{name, bestTime:current.bestTime, medal:current.medal, version:current.version}});
        return;
      } catch (error) {
        if (error.httpStatus !== 401 && error.httpStatus !== 403) throw error;
        const latest = await this.database(own);
        if (latest?.name === name) return;
        if (!latest || latest.bestTime >= current.bestTime) throw error;
      }
    }
    throw Error('Не удалось обновить имя');
  }
  async leaderboard(path) {
    const data=await this.database(path,{query:{orderBy:JSON.stringify('bestTime'),limitToFirst:'10'}});
    if(data===null)return [];
    if(typeof data!=='object'||Array.isArray(data))throw Error('Некорректный рейтинг');
    return Object.entries(data).filter(([,v])=>v && typeof v.bestTime==='number' && Number.isFinite(v.bestTime))
      .sort(([a,x],[b,y])=>x.bestTime-y.bestTime||a.localeCompare(b))
      .map(([,value])=>({name:typeof value.name==='string'?value.name:'Пилот',bestTime:value.bestTime,medal:value.medal}));
  }
  removeRun(run) { const pending=this.records('pending'),index=pending.findIndex(item=>JSON.stringify(item)===JSON.stringify(run));if(index>=0){pending.splice(index,1);this.write('pending',pending);} }
  rejectRun(run, reason) { const rejected=this.records('rejected');if(!rejected.some(item=>JSON.stringify(item.run)===JSON.stringify(run))){rejected.push({run,reason,rejected_at:new Date().toISOString()});this.write('rejected',rejected);}this.removeRun(run); }
  archiveOldRun(run) { const archived=this.records('legacy-pending');if(!archived.some(item=>JSON.stringify(item.run)===JSON.stringify(run))){archived.push({run,reason:'Результат до сброса рейтинга',archivedAt:new Date().toISOString()});this.write('legacy-pending',archived);}this.removeRun(run); }
  async sync() {
    if (!this.config) return;
    if (this.busy) { this.syncRequested = true; return; }
    this.busy = true;
    try {
      await this.login();
      for (const run of this.records('pending')) {
        let dailyPath;
        try {dailyPath=this.validateRun(run);} catch(error) {this.rejectRun(run,error.message);continue;}
        if(run.rulesVersion!==this.leaderboardVersion){this.archiveOldRun(run);continue;}
        if(dailyPath && run.challengeId.slice(6)>this.daily().date)continue;
        const entry={name:this.displayName(),bestTime:run.total,medal:run.medal,version:this.leaderboardVersion};
        await this.saveBest('leaderboards/global',entry);
        if(dailyPath)await this.saveBest(dailyPath,entry);
        if(dailyPath){const dates=this.read('daily-dates',[]);if(Array.isArray(dates)&&!dates.includes(run.challengeId.slice(6))){dates.push(run.challengeId.slice(6));this.write('daily-dates',dates);}}
        this.removeRun(run);
      }
      const nickname=this.read('nickname','');
      if(typeof nickname==='string' && nickname){
        const dates=this.read('daily-dates',[]);
        await this.renameBest('leaderboards/global',nickname);
        for(const date of new Set([this.daily().date,...(Array.isArray(dates)?dates:[])])){
          if(typeof date==='string' && /^\d{4}-\d{2}-\d{2}$/.test(date))await this.renameBest(`leaderboards/daily/${date}`,nickname);
        }
      }
      this.global = await this.leaderboard('leaderboards/global');
      this.dailyBoard = await this.leaderboard(`leaderboards/daily/${this.daily().date}`);
      this.online = true;
      const rejected = this.records('rejected').length, pending = this.records('pending').length;
      this.status = rejected ? `Онлайн · отклонено: ${rejected}` : pending ? `Ожидают отправки: ${pending}` : 'Онлайн · гостевой профиль';
    } catch (error) { this.online = false; this.status = error instanceof SyntaxError || error.message==='Повреждён файл очереди' ? 'Ошибка очереди результатов' : error.httpStatus===401||error.httpStatus===403 ? 'Ошибка доступа Firebase' : 'Офлайн · результаты в очереди'; }
    finally { this.busy = false; if(this.syncRequested){this.syncRequested=false;setTimeout(()=>this.sync(),0);} }
  }
}
window.cloud = new CloudService();
