/* Settings read sanitized native status; no credentials enter the web view. */
let appRuntime=null,settingsBusy=false,settingsError='';
const runtimeTime=value=>value?new Intl.DateTimeFormat(window.todoLocale(),{timeZone:window.todoDisplayTimezone(),dateStyle:'medium',timeStyle:'short'}).format(new Date(value))+' · '+window.todoDisplayTimezone():'尚无记录';
window.todoRuntimeReceive=data=>{appRuntime=data;window.todoMailOperationReceive?.(data);settingsBusy=false;settingsError='';if(page==='settings')renderSettings();if(page==='calendar')renderCalendar()};
window.todoRuntimeError=message=>{settingsBusy=false;settingsError=message;window.todoMailOperationError?.();if(page==='settings')renderSettings()};
function requestRuntime(){if(nativeStore())nativeStore().postMessage({action:'loadSettings'})}
function settingAction(action,extra={}){settingsBusy=true;settingsError='';renderSettings();nativeStore().postMessage({action,...extra})}
function renderSettings(){
  const host=document.querySelector('#settings-panel');if(!host)return;
  const d=appRuntime,m=d?.mail,p=d?.preferences;
  const badge=m?(m.healthy?'接收器运行中':m.lastError?'需要处理':m.running?'监听状态待核实':'后台未运行'):'正在读取';
  host.innerHTML=window.todoLanguageSettings()+'<div class="settings-intro"><span class="settings-kicker">PERSONAL WORKSPACE</span><h2>连接与提醒</h2><p>你的看板保存在这台 Mac。这里显示本机连接状态，并管理日常、DDL 与面试提醒。</p></div>'+
    (d?.notificationWarning?'<p class="settings-error" role="alert">'+esc(d.notificationWarning)+'</p>':'')+(settingsError?'<p class="settings-error" role="alert">'+esc(settingsError)+'</p>':'')+
    '<div class="settings-grid"><section class="settings-card"><div class="settings-card-head"><h3>申请邮件监听</h3><span class="status-pill '+(m?.healthy?'ok':'')+'">'+esc(badge)+'</span></div><dl><dt>邮箱</dt><dd>'+esc(m?.account||'—')+'</dd><dt>Google 授权</dt><dd>'+esc(m?.authorized?'已保存授权；有效性以后台连接为准':'尚未授权')+'</dd><dt>最近收到事件</dt><dd>'+esc(runtimeTime(m?.lastEventAt))+'</dd><dt>订阅有效至</dt><dd>'+esc(runtimeTime(m?.watchExpiresAt))+'</dd><dt>待处理事件</dt><dd>'+esc(m?.pendingCount??'—')+'</dd><dt>测试授权预计到期</dt><dd>'+esc(m?.authorizationExpectedExpiresAt?runtimeTime(m.authorizationExpectedExpiresAt):'旧授权未记录到期时间；Testing 通常 7 天有效')+'</dd></dl><p class="settings-note">应用保持 Testing，仅本人使用。订阅每日续期；授权到期后需在 Google 重新确认。仅追踪已关联的申请邮件；使用本机规则提示疑似进展，具体内容仍需核对。</p><div class="settings-actions"><button id="refresh-runtime">刷新状态</button><button id="reauthorize-mail" class="primary">'+(m?.authorizationInProgress?'浏览器授权进行中…':'重新授权 Gmail')+'</button></div></section>'+
    '<section class="settings-card"><div class="settings-card-head"><h3>面试提前提醒</h3><span class="status-pill '+(p?.interviewReminders&&d?.notificationPermission==='authorized'?'ok':'')+'">'+(p?.interviewReminders?'已开启':'未开启')+'</span></div><p class="settings-note">只提醒「已安排」且时间、时区准确的未来面试。改期、取消、结束后会重新安排提醒。</p><div class="reminder-pair"><b>提前 3 天</b><span>准备材料与面试</span><b>提前 30 分钟</b><span>检查设备并进入会议</span></div><dl><dt>系统通知权限</dt><dd>'+esc(({authorized:'已允许',denied:'未允许，请在系统设置中开启',notDetermined:'尚未请求',provisional:'临时允许'})[d?.notificationPermission]||'待核实')+'</dd><dt>已排定提醒</dt><dd>'+esc(d?.scheduledCount??0)+' 项</dd><dt>日历显示时区</dt><dd>'+esc(window.todoDisplayTimezone())+'</dd></dl>'+(d?.unscheduled?.length?'<p class="settings-note">'+d.unscheduled.length+' 轮时间未确认，暂不安排提醒。</p>':'')+(d?.reminderOverflow?'<p class="settings-note">当前仅安排最近 60 项；打开 App 时更新后续提醒。</p>':'')+'<div class="settings-actions"><button id="save-reminders" class="primary">'+(p?.interviewReminders?'保存两次提醒':'开启面试提醒')+'</button>'+(p?.interviewReminders?'<button id="disable-reminders">关闭提醒</button>':'')+'<button id="notification-settings">系统通知设置 ↗</button></div><p class="settings-note">首次开启需要允许 macOS 通知。提醒排入系统后，App 关闭仍可送达；实际展示受勿扰模式和系统设置影响。</p></section></div>'+
    '<section class="settings-card"><div class="settings-card-head"><h3>日常 routine</h3><span class="status-pill '+(d?.routineScheduledCount?'ok':'')+'">'+(d?.routineScheduledCount?'已排定':'未排定')+'</span></div><p>八股与 coding · 每晚 21:00</p>'+(d?.scheduledReminders?.find(r=>r.id==='routine.daily-practice')?.nextAt?'<p class="settings-note">下次提醒：'+esc(runtimeTime(d.scheduledReminders.find(r=>r.id==='routine.daily-practice').nextAt))+'</p>':'')+'<p class="settings-note">Europe/Paris · 每天重复。点击通知打开练习任务；标记整个任务完成或归档后，下次 App 同步会停止这项 routine。</p><div class="settings-actions"><button id="toggle-routine" class="primary">'+(p?.routineReminders?'关闭日常提醒':'开启日常提醒')+'</button></div></section>'+
    '<section class="settings-card"><div class="settings-card-head"><h3>DDL 弹窗提醒</h3><span class="status-pill '+(p?.deadlineReminders&&d?.notificationPermission==='authorized'?'ok':'')+'">'+(p?.deadlineReminders?'已开启':'未开启')+'</span></div><p>提前 1 天 + 提前 1 小时</p><p class="settings-note">仅使用明确日期、钟点及来源时区。用户目标、模糊日期和已完成事项不提醒；只有日期、没有钟点的事项需先补充截止时间。</p><dl><dt>已排定通知</dt><dd>'+esc(d?.deadlineScheduledCount??0)+' 项</dd><dt>需补充准确时间</dt><dd>'+esc(d?.deadlineUnscheduled?.length??0)+' 项</dd></dl>'+(d?.deadlineUnscheduled?.length?'<details><summary>查看待确认事项</summary>'+d.deadlineUnscheduled.map(r=>'<p class="settings-note">'+esc(r.taskId)+' · '+esc(r.reason)+'</p>').join('')+'</details>':'')+'<div class="settings-actions"><button id="toggle-deadlines" class="primary">'+(p?.deadlineReminders?'关闭 DDL 提醒':'开启 DDL 提醒')+'</button></div><p class="settings-note">通知排入系统后 App 关闭仍可送达；改期与完成会在 App 下次读取任务时更新。请允许系统通知；勿扰模式可能隐藏弹窗。</p></section>'+
    '<section class="settings-card settings-storage"><h3>本机数据</h3><p class="settings-note">任务、面试与未读进展共用一份记录。导出的备份仅含任务数据，不含邮箱授权凭据。</p><div class="settings-actions"><button id="export-backup">导出任务备份</button><button id="open-data-folder">打开数据文件夹 ↗</button></div></section>'+
    '<section class="settings-card"><div class="settings-card-head"><h3>任务分类</h3><span class="status-pill">'+esc(categories.length+' 个')+'</span></div><p class="settings-note">可增删分类。删除前请先处理仍在使用该分类的任务。</p><div id="category-manager"></div><div class="settings-actions"><button id="save-categories" class="primary">保存分类</button></div><p class="settings-error hidden" id="category-error"></p></section>';
  host.querySelectorAll('button').forEach(b=>b.disabled=!nativeStore()||settingsBusy);
  if(!nativeStore()){host.insertAdjacentHTML('afterbegin','<p class="settings-error">请在 Planknot 原生 App 中读取连接状态和修改提醒。</p>');return}
  document.querySelector('#refresh-runtime').onclick=()=>settingAction('loadSettings');
  document.querySelector('#reauthorize-mail').disabled=settingsBusy||!!m?.authorizationInProgress;
  document.querySelector('#reauthorize-mail').onclick=()=>settingAction('reauthorizeMail');
  document.querySelector('#save-reminders').onclick=()=>settingAction('saveReminderSettings',{enabled:true,offsets:[4320,30]});
  const disable=document.querySelector('#disable-reminders');if(disable)disable.onclick=()=>settingAction('saveReminderSettings',{enabled:false,offsets:[4320,30]});
  document.querySelector('#notification-settings').onclick=()=>nativeStore().postMessage({action:'openNotificationSettings'});
  document.querySelector('#toggle-routine').onclick=()=>settingAction('saveTaskReminderSettings',{deadlines:!!p?.deadlineReminders,routine:!p?.routineReminders});
  document.querySelector('#toggle-deadlines').onclick=()=>settingAction('saveTaskReminderSettings',{deadlines:!p?.deadlineReminders,routine:!!p?.routineReminders});
  document.querySelector('#export-backup').onclick=()=>nativeStore().postMessage({action:'exportBackup'});
  document.querySelector('#open-data-folder').onclick=()=>nativeStore().postMessage({action:'openDataFolder'});
  categoryDraft=[...categories];renderCategoryManager();
  document.querySelector('#save-categories').onclick=saveCategories;
}
let categoryDraft=[];
function showCategoryError(message){const box=document.querySelector('#category-error');if(!box)return;box.textContent=message;box.classList.toggle('hidden',!message)}
function renderCategoryManager(){
  const box=document.querySelector('#category-manager');if(!box)return;
  if(!categoryDraft.length)categoryDraft=[...categories];
  box.innerHTML=categoryDraft.map((c,i)=>'<div class="category-row"><span>'+catIcon(c)+' '+esc(c)+'</span>'+(categoryDraft.length>1?'<button class="cat-remove" data-i="'+i+'" aria-label="移除 '+esc(c)+'">移除</button>':'')+'</div>').join('')
    +'<div class="category-add"><input id="category-new" maxlength="24" placeholder="新分类名"><button id="category-add-btn" aria-label="添加分类">＋</button></div>';
  box.querySelectorAll('.cat-remove').forEach(b=>b.onclick=()=>{categoryDraft.splice(Number(b.dataset.i),1);showCategoryError('');renderCategoryManager()});
  box.querySelector('#category-add-btn').onclick=()=>{const input=box.querySelector('#category-new');const value=input.value.trim();if(!value)return;if(categoryDraft.includes(value)){showCategoryError('分类已存在：'+value);return}categoryDraft.push(value);showCategoryError('');renderCategoryManager()};
}
function saveCategories(){
  const names=categoryDraft.map(x=>x.trim()).filter(Boolean);
  if(!names.length){showCategoryError('至少保留一个分类');return}
  if(new Set(names).size!==names.length){showCategoryError('分类不能重复');return}
  const removed=categories.filter(c=>!names.includes(c));
  const used=removed.filter(c=>live().some(t=>t.cat===c));
  if(used.length){showCategoryError('以下分类仍被任务使用，请先改到其他分类：'+used.join('、'));return}
  if(!nativeStore())return;
  showCategoryError('');
  nativeStore().postMessage({action:'setCategories',categories:names});
}
function addInterviewCalendarEvents(rows,ev,undated){
  const byId=new Map(rows.map(t=>[t.id,t]));
  for(const raw of appRuntime?.calendarEvents||[]){const e={...raw,...window.todoDisplayParts(raw.timestamp)};const t=byId.get(e.taskId);if(!t)continue;(ev[e.day]=ev[e.day]||[]).push({kind:'interview',t,time:e.time,title:e.round+' · '+t.title,done:e.status==='已完成'||e.status==='已取消'||e.ended,urgent:false,interview:e})}
  return (appRuntime?.unscheduled||[]).filter(e=>byId.has(e.taskId)).map(e=>({...e,t:byId.get(e.taskId)}));
}
function calendarInterviewAgenda(events){
  const list=Object.values(events).flat().filter(e=>e.kind==='interview').sort((a,b)=>a.interview.timestamp-b.interview.timestamp);
  if(!list.length)return '';
  return '<section class="interview-agenda"><h3>面试安排</h3>'+list.map(e=>'<article><div><span>'+esc(e.interview.day+' '+e.time)+' · '+esc(window.todoDisplayTimezone())+'</span><b>'+esc(e.title)+'</b><small>'+esc(e.interview.status+' · 原时间 '+e.interview.originalTime+' '+e.interview.originalTimezone)+'</small></div><button data-open="'+esc(e.t.id)+'">查看申请</button>'+(e.interview.meetingUrl&&/^https:\/\//.test(e.interview.meetingUrl)?'<a href="'+esc(e.interview.meetingUrl)+'" target="_blank" rel="noopener noreferrer">进入会议 ↗</a>':'')+'</article>').join('')+'</section>';
}

// Calendar navigation follows the selected display timezone.
let calendarView='week';
const parisDate=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:window.todoDisplayTimezone(),year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const calendarDate=s=>{const [y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d,12)};
const calendarKey=d=>dayKey(d.getFullYear(),d.getMonth()+1,d.getDate());
let calendarCursor=parisDate();
function calendarDays(cursor,mode){
  const start=calendarDate(cursor);if(mode==='week')start.setDate(start.getDate()-(start.getDay()+6)%7);
  return Array.from({length:mode==='week'?7:1},(_,i)=>{const d=new Date(start);d.setDate(d.getDate()+i);return calendarKey(d)});
}
function calendarEventButton(e){
  return '<button class="cal-ev '+(e.kind==='interview'?'interview':e.kind==='ms'?'ms':'')+(e.done?' done':'')+(e.urgent?' urgent':'')+'" data-open="'+esc(e.t.id)+'" title="'+esc(e.title+(e.kind==='interview'?' · 原时间 '+e.interview.originalTime+' '+e.interview.originalTimezone:e.original?' · '+e.original:''))+'">'+(e.time?'<b>'+esc(e.time.slice(0,5))+'</b>':'')+esc(e.title)+(e.sourceLabel?'<small class="cal-source-time">'+esc(e.sourceLabel)+'</small>':'')+'</button>';
}
function renderCalendar(){
  const box=document.querySelector('#calendar');const oldScroll=box.querySelector('.time-scroll')?.scrollTop;
  if(calendarView==='month'){
    renderCalendarMonth();
    box.insertAdjacentHTML('afterbegin',calendarViewTabs());
  }else{
    const {ev,pendingInterviews}=calEvents(filtered()),days=calendarDays(calendarCursor,calendarView),today=parisDate();
    const shown=Object.fromEntries(days.map(k=>[k,ev[k]||[]]));
    const label=calendarView==='day'?days[0]:days[0]+' — '+days[6];
    let grid='<div class="time-corner" title="'+esc(window.todoDisplayTimezone())+'">时间</div>'+days.map(k=>'<button class="time-date '+(k===today?'is-today':'')+'" data-day="'+k+'">'+['周日','周一','周二','周三','周四','周五','周六'][calendarDate(k).getDay()]+'<b>'+k.slice(5)+'</b></button>').join('');
    grid+='<div class="time-label all-day">全天</div>'+days.map(k=>'<div class="time-slot all-day">'+(ev[k]||[]).filter(e=>!e.time).map(calendarEventButton).join('')+'</div>').join('');
    for(let hour=0;hour<24;hour++){
      grid+='<div class="time-label">'+String(hour).padStart(2,'0')+':00</div>'+days.map(k=>'<div class="time-slot">'+(ev[k]||[]).filter(e=>e.time&&Number(e.time.slice(0,2))===hour).map(calendarEventButton).join('')+'</div>').join('');
    }
    box.innerHTML=calendarViewTabs()+'<div class="cal-head"><h2>'+label+'</h2><span class="calendar-timezone">'+esc(window.todoDisplayTimezone())+'</span><button data-period="prev">‹ '+(calendarView==='week'?'上周':'前一天')+'</button><button data-period="today">今天</button><button data-period="next">'+(calendarView==='week'?'下周':'后一天')+' ›</button></div><div class="time-scroll"><div class="time-grid" style="--day-count:'+days.length+'">'+grid+'</div></div><p class="settings-note">'+esc(window.todoDisplayTimezone())+' · 带时区的时间已换算；纯日期及时间待核实项放在全天区。点击事项查看原始时间。</p>'+calendarInterviewAgenda(shown)+(pendingInterviews.length?'<div class="cal-undated"><h3>面试时间待核实</h3>'+pendingInterviews.map(e=>'<button data-open="'+esc(e.taskId)+'">'+esc(e.t.title+' · '+e.round)+'</button>').join('')+'</div>':'');
    box.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>openInspector(b.dataset.open));
    box.querySelectorAll('[data-day]').forEach(b=>b.onclick=()=>{calendarCursor=b.dataset.day;calendarView='day';renderCalendar()});
    box.querySelectorAll('[data-period]').forEach(b=>b.onclick=()=>{if(b.dataset.period==='today')calendarCursor=parisDate();else{const d=calendarDate(calendarCursor);d.setDate(d.getDate()+(b.dataset.period==='next'?1:-1)*(calendarView==='week'?7:1));calendarCursor=calendarKey(d)}renderCalendar()});
    box.querySelector('.time-scroll').scrollTop=oldScroll??8*64;
  }
  box.querySelectorAll('[data-calendar-view]').forEach(b=>b.onclick=()=>{calendarView=b.dataset.calendarView;if(calendarView==='month'){const d=calendarDate(calendarCursor);calMonth=new Date(d.getFullYear(),d.getMonth(),1)}renderCalendar()});
}
function calendarViewTabs(){return '<div class="calendar-toolbar"><div class="calendar-tabs" role="group" aria-label="日历视图">'+[['month','月'],['week','周'],['day','日']].map(([v,t])=>'<button data-calendar-view="'+v+'" aria-pressed="'+(calendarView===v)+'" class="'+(calendarView===v?'selected':'')+'">'+t+'</button>').join('')+'</div></div>'}
