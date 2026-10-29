/* Point-and-select deadline entry. Keep source-backed free text unchanged until explicitly replaced. */
(function(root){
  function parseDue(value){
    if(!value||value==='未设置')return {mode:'none'};
    if(/^\d{4}-\d{2}-\d{2}$/.test(value))return {mode:'date',day:value};
    const m=/^(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2})\s+([A-Za-z_]+\/[A-Za-z_]+(?:\/[A-Za-z_]+)?)$/.exec(value);
    return m?{mode:'deadline',day:m[1],hour:m[2],minute:m[3],zone:m[4]}:{mode:'legacy',original:value};
  }
  function dueValue(mode,day,hour,minute,zone,original=''){
    if(mode==='none')return '';
    if(mode==='legacy')return original;
    if(!/^\d{4}-\d{2}-\d{2}$/.test(day))throw Error('请选择日期。');
    const date=new Date(day+'T00:00:00Z');
    if(!Number.isFinite(+date)||date.toISOString().slice(0,10)!==day)throw Error('请选择有效日期。');
    if(mode==='date')return day;
    if(!/^\d{2}$/.test(hour)||+hour>23||!/^\d{2}$/.test(minute)||+minute>59)throw Error('请选择截止小时和分钟。');
    // Reject DST gaps/folds rather than silently scheduling at a different instant.
    const value=day+' '+hour+':'+minute+' '+zone;
    if(root.todoCalendarDates&&!root.todoCalendarDates(value,zone)?.[0]?.time)throw Error('该时区下的时间不存在或有歧义，请重新选择。');
    new Intl.DateTimeFormat('en',{timeZone:zone});
    return value;
  }
  if(typeof module!=='undefined')module.exports={parseDue,dueValue};
  if(typeof document==='undefined')return;
  const $=id=>document.getElementById(id),day=$('due-date'),hour=$('due-hour'),minute=$('due-minute'),zone=$('due-zone'),help=$('due-help');
  let original='',dirty=false;
  for(const [select,count] of [[hour,24],[minute,60]]){
    select.innerHTML='<option value="">未指定</option>'+Array.from({length:count},(_,n)=>{const v=String(n).padStart(2,'0');return '<option value="'+v+'">'+v+'</option>'}).join('');
  }
  function update(){
    const legacy=!dirty&&parseDue(original).mode==='legacy';
    $('due-original').classList.toggle('hidden',!legacy);$('due-original').textContent=original;
    const runtime=typeof appRuntime==='undefined'?null:appRuntime;
    help.classList.remove('form-error');
    help.textContent=legacy?'原截止记录保留；选择日期可替换。':!day.value?'选择截止日期后会加入日历；补上小时和分钟即可安排提醒。':!hour.value||!minute.value?'已选日期会加入日历；补上小时和分钟才能安排提醒。':runtime?.preferences?.deadlineReminders===false?'将加入日历。DDL 提醒当前关闭，请到设置开启。':runtime?.notificationPermission==='denied'?'将加入日历。系统通知未允许，请在系统设置中开启。':'将加入日历，并按设置提前 1 天和 1 小时提醒；已过去的提醒时间会跳过。';
  }
  root.todoDueEditorLoad=value=>{
    original=value;dirty=false;const parsed=parseDue(value);
    day.value=parsed.day||'';hour.value=parsed.hour||'';minute.value=parsed.minute||'';
    const chosen=parsed.zone||(typeof root.todoDisplayTimezone==='function'?root.todoDisplayTimezone():'Europe/Paris');
    if(![...zone.options].some(o=>o.value===chosen)){const option=document.createElement('option');option.value=option.textContent=chosen;zone.add(option)}
    zone.value=chosen;update();
  };
  root.todoDueEditorSave=()=>{
    try{
      let value=original;
      if(dirty){
        if((hour.value===''&&minute.value!=='')||(minute.value===''&&hour.value!==''))throw Error('请选择截止小时和分钟。');
        if(!day.value&&(hour.value!==''||minute.value!==''))throw Error('请选择日期。');
        const mode=!day.value?'none':hour.value===''?'date':'deadline';
        value=dueValue(mode,day.value,hour.value,minute.value,zone.value);
      }
      document.querySelector('#task-form').elements.due.value=value;return true;
    }catch(error){help.textContent=error.message;help.classList.add('form-error');return false}
  };
  [day,hour,minute,zone].forEach(el=>el.addEventListener('change',()=>{dirty=true;update()}));
  $('due-clear').onclick=()=>{dirty=true;day.value=hour.value=minute.value='';update()};
  root.todoDueEditorLoad('');
})(typeof window==='undefined'?globalThis:window);
