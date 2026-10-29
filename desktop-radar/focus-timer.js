/* Wall-clock based timer; persisted locally, independent of task-store refreshes. */
class FocusClock {
  constructor(saved={}) {
    this.duration=Number.isInteger(saved.duration)&&saved.duration>=60&&saved.duration<=10800?saved.duration:1500;
    this.remaining=Number.isFinite(saved.remaining)?Math.max(0,Math.min(saved.remaining,this.duration)):this.duration;
    this.status=['idle','running','paused','finished'].includes(saved.status)?saved.status:'idle';
    this.endsAt=Number.isFinite(saved.endsAt)?saved.endsAt:0;
    this.taskId=typeof saved.taskId==='string'?saved.taskId:'';
    this.taskTitle=typeof saved.taskTitle==='string'?saved.taskTitle:'';
    this.label=typeof saved.label==='string'?saved.label.slice(0,30):'专注';
    if(this.status==='running'&&!this.endsAt)this.status='paused';
  }
  bind(task){if(this.status==='running'||this.status==='paused')return false;this.taskId=task.id;this.taskTitle=task.title;this.reset();return true}
  seconds(now=Date.now()){return this.status==='running'?Math.max(0,Math.ceil((this.endsAt-now)/1000)):Math.ceil(this.remaining)}
  tick(now=Date.now()){if(this.status==='running'&&this.seconds(now)===0){this.remaining=0;this.endsAt=0;this.status='finished';return true}return false}
  start(now=Date.now()){this.tick(now);if(this.status==='running')return;if(this.status==='finished')this.remaining=this.duration;this.endsAt=now+this.remaining*1000;this.status='running'}
  pause(now=Date.now()){this.tick(now);if(this.status!=='running')return;this.remaining=Math.max(0,(this.endsAt-now)/1000);this.endsAt=0;this.status='paused'}
  reset(){this.remaining=this.duration;this.endsAt=0;this.status='idle'}
  choose(minutes,label){if(this.status==='running'||this.status==='paused')return false;if(!Number.isInteger(minutes)||minutes<1||minutes>180)return false;this.duration=minutes*60;this.label=label;this.reset();return true}
}
if(typeof module!=='undefined')module.exports={FocusClock};
if(typeof window!=='undefined'){
  let saved={};try{saved=JSON.parse(localStorage.getItem('todo.focus.v1')||'{}')||{}}catch{}
  const clock=new FocusClock(saved);let focusMessage='',focusNotification='',pendingFocusTask=null;
  let sessions=[];try{sessions=JSON.parse(localStorage.getItem('todo.focus.sessions.v1')||'[]');if(!Array.isArray(sessions))sessions=[]}catch{}
  function finishFocus(){if(clock.label==='专注'&&clock.taskId){sessions.push({taskId:clock.taskId,seconds:clock.duration,at:new Date().toISOString()});try{localStorage.setItem('todo.focus.sessions.v1',JSON.stringify(sessions))}catch{}}}
  window.beginTaskFocus=id=>{const task=tasks.find(t=>t.id===id&&!t.archived&&!t.completed&&t.kind!=='board');if(!task)return;if(clock.tick())finishFocus();if(clock.taskId!==id&&(clock.status==='running'||clock.status==='paused'))pendingFocusTask=task;else if(clock.taskId!==id){clock.bind(task);persistFocus()}closeInspector();document.querySelector('#focus-timer').replaceChildren();setPage('focus')};
  function persistFocus(){try{localStorage.setItem('todo.focus.v1',JSON.stringify(clock))}catch{focusMessage='本机存储不可用，关闭页面后可能无法恢复计时。'}}
  function syncFocusNotification(){if(nativeStore())nativeStore().postMessage({action:'focusTimer',endsAt:clock.status==='running'?clock.endsAt/1000:0,label:clock.label,taskTitle:clock.taskTitle})}
  window.todoFocusNotificationResult=message=>{focusNotification=message;if(page==='focus')updateFocusDisplay()};
  function updateFocusDisplay(){
    const time=document.querySelector('#focus-time');if(!time)return;
    const seconds=clock.seconds(),running=clock.status==='running';
    time.textContent=String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');
    document.querySelector('#focus-status').textContent=({idle:'准备开始',running:'保持专注，一次只做一件事',paused:'已暂停，准备好再继续',finished:clock.label==='专注'?'本轮完成，休息一下吧':'休息结束，准备好再开始'})[clock.status];
    const primary=document.querySelector('#focus-start');primary.textContent=running?'暂停':clock.status==='paused'?'继续':clock.status==='finished'?'再来一轮':'开始';
    document.querySelector('#focus-dial').style.setProperty('--progress',Math.max(0,Math.min(360,(1-seconds/clock.duration)*360))+'deg');
    document.querySelector('#focus-session-label').textContent=clock.label;
    document.querySelectorAll('[data-focus-minutes],#focus-custom,#focus-apply').forEach(e=>e.disabled=running||clock.status==='paused');
    const context=document.querySelector('#focus-task-title');if(context)context.textContent=clock.taskTitle;
    const stats=sessions.filter(s=>s.taskId===clock.taskId);document.querySelector('#focus-task-progress').textContent=stats.length?'这项任务已完成 '+stats.length+' 轮 · '+Math.round(stats.reduce((n,s)=>n+s.seconds,0)/60)+' 分钟':'';
    document.querySelector('#focus-note').textContent=focusMessage||focusNotification||(nativeStore()?'到点会通过系统通知提醒。':'页面预览：请在 App 中使用系统到点提醒。');
    const rail=document.querySelector('[data-page="focus"]');if(rail)rail.title=running?clock.taskTitle+' · '+time.textContent:'专注';
  }
  window.renderFocusTimer=function(){
    const host=document.querySelector('#focus-timer');if(!host||page!=='focus')return;
    if(pendingFocusTask){host.innerHTML='<div class="focus-choice"><span class="settings-kicker">切换专注任务</span><h2>当前还有一轮未结束</h2><p>'+esc(clock.taskTitle||'未关联任务')+'</p><p>切换至「'+esc(pendingFocusTask.title)+'」会结束当前计时。</p><div class="settings-actions"><button id="keep-focus">返回当前专注</button><button id="switch-focus" class="primary">结束当前并切换</button></div></div>';host.querySelector('#keep-focus').onclick=()=>{pendingFocusTask=null;host.replaceChildren();renderFocusTimer()};host.querySelector('#switch-focus').onclick=()=>{clock.reset();clock.bind(pendingFocusTask);pendingFocusTask=null;persistFocus();syncFocusNotification();host.replaceChildren();renderFocusTimer()};return}
    if(!clock.taskId){host.innerHTML='<div class="focus-choice"><span class="settings-kicker">任务专注</span><h2>先选一件要做的事</h2><p>从任务中开始一轮专注，时间会记在这项任务下。</p><div class="focus-task-picker">'+tasks.filter(t=>!t.archived&&!t.completed&&t.kind!=='board').map(t=>'<button data-pick-focus="'+esc(t.id)+'"><span>'+esc(t.title)+'</span><small>'+esc(t.cat)+'</small></button>').join('')+'</div></div>';host.querySelectorAll('[data-pick-focus]').forEach(b=>b.onclick=()=>beginTaskFocus(b.dataset.pickFocus));return}
    if(!host.firstElementChild){
      host.innerHTML='<div class="focus-timer-intro"><button id="focus-return" class="quiet-button">← 返回任务</button><span class="settings-kicker">正在专注</span><h2 id="focus-task-title">'+esc(clock.taskTitle)+'</h2><p id="focus-task-progress"></p></div><div class="focus-timer-card"><div class="focus-presets" role="group" aria-label="计时时长"><button data-focus-minutes="25" data-label="专注">专注 25 分钟</button><button data-focus-minutes="50" data-label="专注">专注 50 分钟</button><button data-focus-minutes="5" data-label="短休息">短休息 5 分钟</button><button data-focus-minutes="15" data-label="长休息">长休息 15 分钟</button></div><div class="focus-dial" id="focus-dial"><div><span id="focus-session-label">专注</span><strong id="focus-time" role="timer" aria-label="剩余时间">25:00</strong><span id="focus-status" role="status" aria-live="polite">准备开始</span></div></div><div class="focus-timer-actions"><button id="focus-start">开始</button><button id="focus-reset">重置</button></div><div class="focus-custom"><label for="focus-custom">自定义</label><input id="focus-custom" type="number" min="1" max="180" step="1" value="25" aria-label="自定义分钟"><span>分钟</span><button id="focus-apply">应用</button></div><p id="focus-note" class="focus-timer-note"></p></div>';
      host.querySelector('#focus-return').onclick=()=>{const id=clock.taskId;setPage('tasks');if(tasks.some(t=>t.id===id))openInspector(id)};
      host.querySelectorAll('[data-focus-minutes]').forEach(b=>b.onclick=()=>{clock.choose(Number(b.dataset.focusMinutes),b.dataset.label);focusMessage='';persistFocus();updateFocusDisplay()});
      host.querySelector('#focus-start').onclick=()=>{if(clock.status==='running'){clock.pause();focusMessage='';persistFocus();syncFocusNotification();updateFocusDisplay();return}if(!tasks.some(t=>t.id===clock.taskId&&!t.archived&&!t.completed)){focusMessage='这项任务已结束或已归档，请返回任务选择其他事项。';updateFocusDisplay();return}clock.start();focusMessage='';persistFocus();syncFocusNotification();updateFocusDisplay()};
      host.querySelector('#focus-reset').onclick=()=>{clock.reset();focusMessage='';persistFocus();syncFocusNotification();updateFocusDisplay()};
      host.querySelector('#focus-apply').onclick=()=>{const value=Number(host.querySelector('#focus-custom').value);if(!clock.choose(value,'专注'))focusMessage='请输入 1–180 之间的整数分钟。';else focusMessage='';persistFocus();updateFocusDisplay()};
    }
    updateFocusDisplay();
  };
  document.addEventListener('DOMContentLoaded',()=>{if(clock.tick())finishFocus();persistFocus();syncFocusNotification()});
  function focusedTaskActive(){return !!clock.taskId&&tasks.some(t=>t.id===clock.taskId&&!t.archived&&!t.completed&&t.kind!=='board')}
  setInterval(()=>{if(clock.status==='running'&&!focusedTaskActive()){clock.pause();focusMessage='这项任务已结束或已归档，本轮专注已停止。';persistFocus();syncFocusNotification()}if(clock.tick()){finishFocus();persistFocus()}if(page==='focus'&&!pendingFocusTask&&clock.taskId)updateFocusDisplay()},250);
}
