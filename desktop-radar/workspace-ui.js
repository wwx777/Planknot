/* Home is a short index; the inspector owns full records and history. */
let workspaceExpanded=false,workspaceDeferredOpen=false;
const workspaceTypes={'课程':'course','科研':'research','申请':'career','生活':'life','生活杂事':'life','工具':'tools'};
function workspaceRow(t){
  const type=workspaceTypes[t.cat]||'other';
  const priority=t.completed?'':t.risk==='urgent'?'urgent':t.risk==='watch'?'watch':'';
  const badge=priority?'<span class="workspace-priority '+priority+'">'+(priority==='urgent'?'紧急':'需关注')+'</span>':'';
  return '<div class="workspace-row '+(t.completed?'workspace-done':'')+'" data-priority="'+priority+'" data-type="'+type+'"><button class="check" data-check="'+esc(t.id)+'" aria-label="'+(t.completed?'重新打开':'完成')+' '+esc(t.title)+'">'+(t.completed?'✓':'')+'</button><button class="workspace-open" data-workspace-open="'+esc(t.id)+'"><span class="workspace-row-heading"><b>'+esc(t.title)+'</b>'+badge+'</span><small>'+esc(t.detail||t.followUp||'打开查看详情')+'</small></button>'+prepNoteLink(t)+'<span class="workspace-label" data-type="'+type+'">'+esc(t.cat)+'</span>'+(!t.completed&&!t.archived&&t.kind!=='board'?'<button class="workspace-focus" data-task-focus="'+esc(t.id)+'" aria-label="专注于 '+esc(t.title)+'">◉ <span>专注</span></button>':'')+'</div>';
}

function renderWorkspace(){
  document.querySelectorAll('.sidebar .nav').forEach(b=>{if(page!=='tasks')b.classList.remove('active')});
  if(page!=='tasks'||activeProject)return;
  const host=document.querySelector('#task-area'),query=document.querySelector('#search').value.trim();
  const home=!smart&&activeCat==='全部'&&!query;
  host.className='workspace-home';
  if(home){
    const boards=boardTasks().filter(t=>!t.completed);
    const ordinary=live().filter(t=>!t.completed&&t.kind!=='board'&&!t.project);
    const actionable=ordinary.filter(t=>t.lane==='进行中'||t.lane==='临近 / 已过'||t.risk==='urgent').sort((a,b)=>(b.risk==='urgent')-(a.risk==='urgent'));
    const deferred=ordinary.filter(t=>!actionable.includes(t));
    host.innerHTML=(boards.length?'<section class="workspace-section"><div class="workspace-section-head"><h2>专项板块</h2></div><div class="workspace-projects">'+boards.map(b=>{const rows=childrenOf(b.id).filter(t=>!isEnded(t));const waiting=rows.filter(isWaiting).length;return '<button class="workspace-project" data-project="'+esc(b.id)+'"><div><b>'+esc(b.title)+'</b><small>'+rows.length+' 项'+(waiting?' · '+waiting+' 项等待回复':'')+'</small></div><span>→</span></button>'}).join('')+'</div></section>':'')+'<section class="workspace-section"><div class="workspace-section-head"><h2>当前要处理</h2><span>'+actionable.length+' 项</span></div><div class="workspace-list">'+((workspaceExpanded?actionable:actionable.slice(0,6)).map(workspaceRow).join('')||'<div class="workspace-empty">当前没有待处理的任务</div>')+'</div>'+(actionable.length>6?'<button class="workspace-more" id="workspace-more">'+(workspaceExpanded?'收起':'查看其余 '+(actionable.length-6)+' 项')+'</button>':'')+'</section>'+(deferred.length?'<details class="workspace-deferred" '+(workspaceDeferredOpen?'open':'')+'><summary>等待与待核实 · '+deferred.length+' 项</summary><div class="workspace-list">'+deferred.map(workspaceRow).join('')+'</div></details>':'');
    const more=host.querySelector('#workspace-more');if(more)more.onclick=()=>{workspaceExpanded=!workspaceExpanded;renderWorkspace()};
    const deferredBox=host.querySelector('.workspace-deferred');if(deferredBox)deferredBox.ontoggle=()=>workspaceDeferredOpen=deferredBox.open;
  }else{
    const title=query?'搜索结果':({urgent:'优先关注',waiting:'等待外部',verify:'待核实',completed:'已完成',archived:'已归档'})[smart]||activeCat;
    document.querySelector('#page-title').textContent=title;
    const rows=filtered().filter(t=>smart==='completed'||smart==='archived'||!t.completed);
    host.innerHTML='<h2 class="workspace-filter-title">'+rows.length+' 项</h2><div class="workspace-list">'+(rows.map(workspaceRow).join('')||'<div class="workspace-empty">当前没有事项</div>')+'</div>';
  }
  renderProgressUpdates();
  bindProjectLinks();
  host.querySelectorAll('[data-workspace-open]').forEach(b=>b.onclick=()=>{const t=tasks.find(t=>t.id===b.dataset.workspaceOpen);if(t?.kind==='board')openProject(t.id);else openInspector(b.dataset.workspaceOpen)});
  host.querySelectorAll('[data-task-focus]').forEach(b=>b.onclick=()=>beginTaskFocus(b.dataset.taskFocus));
  host.querySelectorAll('[data-check]').forEach(b=>b.onclick=()=>{const t=tasks.find(t=>t.id===b.dataset.check);if(t)mutate({action:'setCompleted',id:t.id,completed:!t.completed})});
}
