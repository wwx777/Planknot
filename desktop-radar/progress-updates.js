/* Explicit, evidence-backed progress updates; ordinary edits never create unread badges. */
let progressAlerts=[];
const unreadUpdates=()=>progressAlerts.filter(a=>!a.readAt);
function taskHasUpdate(id){return unreadUpdates().some(a=>a.taskId===id||tasks.find(t=>t.id===a.taskId)?.project===id)}
function renderProgressUpdates(){
  const unread=unreadUpdates(),banner=document.querySelector('#update-banner');
  banner.classList.toggle('hidden',!unread.length);
  if(unread.length){
    const latest=unread[unread.length-1],t=tasks.find(t=>t.id===latest.taskId);
    banner.innerHTML='<div><strong>● '+unread.length+' 条新进展</strong><p>'+esc(t?.title||latest.taskId)+' · '+esc(latest.title)+'</p></div><button id="show-updates">查看更新</button>';
    document.querySelector('#show-updates').onclick=window.todoOpenUpdates;
  }
  document.querySelectorAll('.unread-dot').forEach(el=>el.remove());
  document.querySelectorAll('[data-task],[data-project],[data-workspace-open]').forEach(el=>{
    if(taskHasUpdate(el.dataset.task||el.dataset.project||el.dataset.workspaceOpen)){
      const dot=document.createElement('span');dot.className='unread-dot';dot.title='有未读进展';dot.setAttribute('aria-label','有未读进展');
      (el.querySelector('h3,b')||el).append(dot);
    }
  });
  if(!document.querySelector('#updates-modal').classList.contains('hidden'))renderUpdatesList();
}
function renderUpdatesList(){
  const unread=unreadUpdates();
  document.querySelector('#updates-list').innerHTML=unread.length?unread.slice().reverse().map(a=>{
    const t=tasks.find(t=>t.id===a.taskId);
    return '<article class="update-row"><h3>'+esc(t?.title||a.taskId)+' · '+esc(a.title)+'</h3><p>'+esc(a.text)+'</p><small>'+esc(a.at)+' · Europe/Paris</small><button data-update-task="'+esc(a.taskId)+'">打开事项</button><a href="'+esc(sourceHref(a.source))+'">查看来源 ↗</a><button data-ack="'+esc(a.id)+'" '+(!nativeStore()?'disabled':'')+'>标为已读</button></article>';
  }).join(''):'<div class="project-empty"><b>已全部读完</b>有新的进展时，这里和小组件会显示提示。</div>';
  document.querySelectorAll('[data-ack]').forEach(b=>b.onclick=()=>mutate({action:'ackUpdates',ids:[b.dataset.ack]}));
  document.querySelectorAll('[data-update-task]').forEach(b=>b.onclick=()=>{document.querySelector('#updates-modal').classList.add('hidden');const t=tasks.find(t=>t.id===b.dataset.updateTask);if(t?.project)openProject(t.project);openInspector(b.dataset.updateTask)});
}
window.todoOpenUpdates=()=>{document.querySelector('#updates-error').classList.add('hidden');document.querySelector('#updates-modal').classList.remove('hidden');renderUpdatesList()};
document.addEventListener('DOMContentLoaded',()=>document.querySelector('#close-updates').onclick=()=>document.querySelector('#updates-modal').classList.add('hidden'));
