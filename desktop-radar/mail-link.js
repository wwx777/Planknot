/* User-confirmed associations; sent-message metadata only, no outgoing email. */
let mailLinkTask='',mailLinkBusy=false;
function mailTrackingLabel(t){
  if(t.cat!=='申请'||t.kind==='board')return '';
  const loaded=appRuntime?.mailTracking;
  const bound=loaded?.[t.id];
  return '<span class="mail-tracking '+(bound?'linked':'')+'">'+(loaded?(bound?'邮件已关联':'邮件未关联'):'邮件关联待读取')+'</span>';
}
function renderMailLink(t){
  let host=document.querySelector('#inspect-mail-link');
  if(!host){host=document.createElement('section');host.id='inspect-mail-link';document.querySelector('#inspect-application').after(host);}
  host.replaceChildren();
  if(t.cat!=='申请'||t.kind==='board'||t.archived)return;
  const bound=appRuntime?.mailTracking?.[t.id];
  host.innerHTML='<div class="mail-link-summary">'+mailTrackingLabel(t)+'<button type="button" id="associate-mail">'+(bound?'更换关联':'关联申请邮件')+'</button></div>'+(bound?'<a class="mail-thread-link" href="'+esc(bound.url)+'">打开关联邮件 ↗</a>':'');
  host.querySelector('button').onclick=()=>openMailLink(t.id);
}
function updateMailLinkStatus(){
  document.querySelectorAll('[data-mail-status]').forEach(el=>{const t=tasks.find(t=>t.id===el.dataset.mailStatus);if(t)el.innerHTML=mailTrackingLabel(t);});
  if(selectedTaskId){const t=tasks.find(t=>t.id===selectedTaskId);if(t)renderMailLink(t);}
}
function openMailLink(id){
  const task=tasks.find(t=>t.id===id);if(!task)return;
  mailLinkTask=id;mailLinkBusy=false;
  const modal=document.querySelector('#mail-link-dialog');
  modal.querySelector('h2').textContent='关联申请邮件';modal.querySelector('.mail-link-task').textContent=task.title;
  modal.querySelector('[name=query]').value=task.contact?.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0]||'';
  modal.querySelector('.mail-link-results').replaceChildren();modal.querySelector('.mail-link-error').textContent='';
  modal.querySelector('.mail-link-current').textContent=appRuntime?.mailTracking?.[id]?'已有关联，更换后将追踪新会话。':'选择实际发送的申请邮件；已有邮件会作为历史，不弹新进展提醒。';
  modal.querySelector('button[type=submit]').disabled=!nativeStore();modal.showModal();requestRuntime();
}
window.todoMailOperationReceive=data=>{
  updateMailLinkStatus();
  if(data.mailOperationTask!==mailLinkTask)return;
  mailLinkBusy=false;
  const modal=document.querySelector('#mail-link-dialog');
  modal.querySelector('button[type=submit]').disabled=false;
  modal.querySelectorAll('[data-bind-thread]').forEach(b=>b.disabled=false);
  const error=modal.querySelector('.mail-link-error');
  if(data.mailOperationError){error.textContent=data.mailOperationError;return;}
  if(data.mailBound){error.textContent='';modal.close();requestRuntime();return;}
  if(!data.mailSearch)return;
  error.textContent='';const host=modal.querySelector('.mail-link-results');
  host.innerHTML=data.mailSearch.length?data.mailSearch.map(r=>'<article><b>'+esc(r.subject)+'</b><p>收件人：'+esc(r.to)+'</p><small>'+esc(r.date)+'</small><div><a href="https://mail.google.com/mail/u/0/#all/'+esc(r.threadId)+'">查看邮件 ↗</a><button type="button" data-bind-thread="'+esc(r.threadId)+'">'+(appRuntime?.mailTracking?.[mailLinkTask]?'确认更换为这封':'确认关联这封')+'</button></div></article>').join(''):'<p class="profile-hint">没有找到已发送邮件，换一个收件邮箱或主题关键词试试。</p>';
  host.querySelectorAll('[data-bind-thread]').forEach(b=>b.onclick=()=>{if(mailLinkBusy)return;mailLinkBusy=true;host.querySelectorAll('button').forEach(x=>x.disabled=true);modal.querySelector('button[type=submit]').disabled=true;error.textContent='正在核对并保存关联…';nativeStore().postMessage({action:'bindMail',taskId:mailLinkTask,threadId:b.dataset.bindThread,expectedThread:appRuntime?.mailTracking?.[mailLinkTask]?.threadId||''});});
};
window.todoMailOperationError=()=>{const modal=document.querySelector('#mail-link-dialog');if(modal?.open){mailLinkBusy=false;modal.querySelector('button[type=submit]').disabled=false;modal.querySelectorAll('[data-bind-thread]').forEach(b=>b.disabled=false);modal.querySelector('.mail-link-error').textContent='暂时无法读取邮箱关联，请重试。';}};
document.addEventListener('DOMContentLoaded',()=>{
  const dialog=document.createElement('dialog');dialog.id='mail-link-dialog';dialog.className='profile-dialog mail-link-dialog';dialog.setAttribute('aria-label','关联申请邮件');
  dialog.innerHTML='<form><div class="profile-head"><div><small>MAIL TRACKING</small><h2>关联申请邮件</h2></div><button type="button" class="profile-close" aria-label="关闭邮件关联">×</button></div><p class="mail-link-task"></p><p class="profile-hint mail-link-current"></p><label class="profile-label">收件邮箱或主题关键词<input name="query" required minlength="2" maxlength="300" placeholder="例如收件邮箱、岗位名称"></label><button class="mail-search" type="submit">搜索已发送邮件</button><p class="mail-link-error" role="status"></p></form><div class="mail-link-results"></div>';
  document.body.append(dialog);dialog.querySelector('.profile-close').onclick=()=>{if(!mailLinkBusy)dialog.close();};
  dialog.addEventListener('cancel',e=>{if(mailLinkBusy)e.preventDefault();});
  dialog.querySelector('form').onsubmit=e=>{e.preventDefault();if(mailLinkBusy)return;mailLinkBusy=true;dialog.querySelector('button[type=submit]').disabled=true;dialog.querySelector('.mail-link-error').textContent='正在搜索…';nativeStore().postMessage({action:'searchMail',taskId:mailLinkTask,query:dialog.querySelector('[name=query]').value.trim()});};
});
