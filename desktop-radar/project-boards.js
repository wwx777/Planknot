// A task owns its explicit preparation note; never guess a JD from company name.
function prepNoteHref(t){return typeof t.prepNote==='string'&&t.prepNote.startsWith('/')&&t.prepNote.toLowerCase().endsWith('.md')?'obsidian://open?path='+encodeURIComponent(t.prepNote):''}
function prepNoteLink(t){const href=prepNoteHref(t);return href?'<a class="prep-note-link" href="'+esc(href)+'" aria-label="在 Obsidian 打开 '+esc(t.title)+' 的备考笔记">↗ Obsidian 备考</a>':''}
/* Project views share the same tasks and native write bridge as the main board. */
const applicationStages=['待核实','待准备','待审稿','已投递','面试中','Offer','未通过','已撤回','已结束'];
const isEnded=t=>t.completed||['未通过','已撤回','已结束'].includes(t.stage);
const boardTasks=()=>live().filter(t=>t.kind==='board');
const childrenOf=id=>live().filter(t=>t.project===id);
const isWaiting=t=>!isEnded(t)&&(t.reply==='等待回复'||(t.stage==='已投递'&&!t.reply));
let formInterviews=[];
function interviewSummary(t){
  const rounds=t.interviews||[],next=rounds.find(r=>['待安排','已安排'].includes(r.status));
  return next?next.round+' · '+next.status+' · '+(next.startsAt?next.startsAt+' '+next.timezone:'时间待安排'):rounds.length?'已记录 '+rounds.length+' 轮面试':'';
}
function interviewRowHtml(r,i){
  return '<fieldset class="interview-row"><legend>面试 · '+esc(r.round||'第 '+(i+1)+' 轮')+'</legend>'+
    [['round','轮次','一面 / 二面 / 三面'],['startsAt','时间','如 2026-11-02 09:30'],['timezone','时区','Asia/Shanghai'],['meetingUrl','会议链接','https://meeting.tencent.com/…'],['location','会议号 / 地点',''],['notes','备注','']]
      .map(([k,label,ph])=>'<label>'+label+'<input data-round="'+i+'" data-field="'+k+'" value="'+esc(r[k]||'')+'" '+(k==='meetingUrl'?'type="url" ':'')+(ph?'placeholder="'+ph+'"':'')+'></label>').join('')+
    '<label>本轮状态<select data-round="'+i+'" data-field="status">'+['待安排','已安排','已完成','已取消'].map(s=>'<option value="'+s+'" '+(r.status===s?'selected':'')+'>'+s+'</option>').join('')+'</select></label></fieldset>';
}
function interviewDetails(t){
  return (t.interviews||[]).map(r=>'<div class="interview-detail"><b>'+esc(r.round)+' · '+esc(r.status)+'</b><br>'+esc(r.startsAt?r.startsAt+' · '+r.timezone:'时间待安排')+(r.meetingUrl&&/^https:\/\//i.test(r.meetingUrl)?'<br><a href="'+esc(r.meetingUrl)+'" target="_blank" rel="noopener noreferrer">打开会议链接 ↗</a>':'')+(r.location?'<br>'+esc(r.location):'')+(r.notes?'<p>'+esc(r.notes)+'</p>':'')+'</div>').join('');
}
let formLinks=[];
function linkRowHtml(l,i){
  const labels={'web':'网站','doc':'文档','chat':'聊天','other':'其他'};
  return '<fieldset class="interview-row"><legend>'+labels[l.type||'other']+'</legend>'+
    '<label>类型<select data-link="'+i+'" data-field="type">'+['web','doc','chat','other'].map(t=>'<option value="'+t+'" '+(l.type===t?'selected':'')+'>'+labels[t]+'</option>').join('')+'</select></label>'+
    '<label>名称<input data-link="'+i+'" data-field="label" value="'+esc(l.label||'')+'" placeholder="官网 / 文档 / 对话"></label>'+
    '<label>链接<input data-link="'+i+'" data-field="url" value="'+esc(l.url||'')+'" placeholder="https://…"></label></fieldset>';
}
function renderAssociations(){
  const host=document.querySelector('#assoc-editor');if(!host)return;
  const items=formInterviews.map(interviewRowHtml).join('')+formLinks.map(linkRowHtml).join('');
  host.innerHTML=items||'<p class="form-note">暂无</p>';
  host.querySelectorAll('[data-round]').forEach(el=>{const write=()=>{formInterviews[Number(el.dataset.round)][el.dataset.field]=el.value};el.oninput=write;if(el.tagName==='SELECT')el.onchange=write});
  host.querySelectorAll('[data-link]').forEach(el=>{const write=()=>{formLinks[Number(el.dataset.link)][el.dataset.field]=el.value};el.oninput=write;if(el.tagName==='SELECT')el.onchange=write});
  const add=document.querySelector('#add-assoc');if(add)add.onclick=()=>{
    const type=document.querySelector('#assoc-type').value;
    if(type==='interview')formInterviews.push({id:'interview-'+Date.now()+'-'+Math.random().toString(36).slice(2),round:'第 '+(formInterviews.length+1)+' 轮',status:'待安排',startsAt:'',timezone:'',meetingUrl:'',location:'',notes:''});
    else formLinks.push({id:'link-'+Date.now()+'-'+Math.random().toString(36).slice(2),type:type,label:'',url:''});
    renderAssociations();
  };
}
function replyLabel(t){
  if(t.reply==='已回复')return '已回复';
  if(isWaiting(t))return t.replyCheckedAt?'截至核对时未见回复':'记录为等待回复 · 待查收';
  return t.reply||'回复待核实';
}
function isApplicationProject(project){return ['REMOTE-INTERNS','PHD'].includes(project)}
function syncApplicationFields(){
  const f=document.querySelector('#task-form'),section=document.querySelector('#application-fields');
  const application=f.elements.kind.value!=='board'&&isApplicationProject(f.elements.project.value);
  section.classList.toggle('hidden',!application);
  section.querySelectorAll('input,select,textarea,button').forEach(el=>el.disabled=!application);
}
function prepareForm(){
  const f=document.querySelector('#task-form');f.reset();window.todoDueEditorLoad('');
  document.querySelector('#form-error').classList.add('hidden');
  document.querySelector('#link-fields').open=false;
  f.elements.category.innerHTML=categories.map(c=>'<option value="'+esc(c)+'">'+esc(c)+'</option>').join('');
  f.elements.category.value=categories.includes('工具')?'工具':categories[0];
  f.elements.project.innerHTML='<option value="">无</option>'+boardTasks().map(b=>'<option value="'+esc(b.id)+'">'+esc(b.title)+'</option>').join('');
  f.elements.kind.onchange=()=>{if(f.elements.kind.value==='board')f.elements.project.value='';f.elements.project.disabled=f.elements.kind.value==='board';syncApplicationFields()};
  f.elements.project.onchange=syncApplicationFields;
  f.elements.project.disabled=false;
  formInterviews=[];formLinks=[];renderAssociations();syncApplicationFields();
}
function openProject(id){
  const b=tasks.find(t=>t.id===id&&t.kind==='board');if(!b)return;
  closeInspector();activeProject=id;projectFilter='all';activeCat='全部';smart='';page='tasks';
  document.body.classList.remove('cal-mode','settings-mode','focus-mode');document.body.classList.add('project-mode');
  document.querySelector('#search').value='';render();
}
function bindProjectLinks(){
  document.querySelectorAll('[data-project]').forEach(el=>el.onclick=e=>{e.stopPropagation();openProject(el.dataset.project)});
}
function renderProjects(){
  const boards=boardTasks();
  document.querySelector('#project-nav').innerHTML=boards.map(b=>'<button class="nav '+(activeProject===b.id?'active':'')+'" data-project="'+esc(b.id)+'"><span class="nav-icon">▤</span>'+esc(b.title)+'<span class="nav-count">'+childrenOf(b.id).filter(t=>!isEnded(t)).length+'</span></button>').join('')||'<span class="project-switch-label">添加任务时选择「专项板块」</span>';
  document.querySelector('#project-mobile-nav').innerHTML=boards.map(b=>'<button data-project="'+esc(b.id)+'">'+esc(b.title)+'</button>').join('');
  const panel=document.querySelector('#project-panel');
  const b=boards.find(b=>b.id===activeProject);
  if(!b){activeProject='';document.body.classList.remove('project-mode');document.querySelector('#page-title').textContent=page==='calendar'?'日程':page==='settings'?'设置':page==='focus'?'专注':'我的看板';bindProjectLinks();return}
  document.querySelector('#page-title').textContent=b.title;document.querySelector('#page-eyebrow').textContent='PROJECT BOARD';
  const all=childrenOf(b.id),applied=all.filter(t=>t.submittedAt),waiting=all.filter(isWaiting),interviews=all.filter(t=>!isEnded(t)&&t.stage==='面试中');
  const q=document.querySelector('#search').value.trim().toLowerCase();
  const rows=all.filter(t=>(!q||[t.title,t.detail,t.contact,t.stage,t.reply,t.followUp,t.endReason,interviewSummary(t),t.id].join(' ').toLowerCase().includes(q))&&(projectFilter==='all'||(projectFilter==='waiting'&&isWaiting(t))||(projectFilter==='action'&&!isEnded(t)&&!isWaiting(t))||(projectFilter==='interview'&&!isEnded(t)&&t.stage==='面试中')||(projectFilter==='ended'&&isEnded(t))));
  const application=b.cat==='申请';
  panel.innerHTML='<div class="project-toolbar"><button id="project-back">← 总看板</button><a href="'+esc(sourceHref(b.source))+'">打开主记录 ↗</a><span class="spacer"></span><button id="project-gpt">复制给 GPT 的更新指令</button><button class="primary" id="project-add">＋ '+(application?'添加申请':'添加事项')+'</button></div><p class="project-intro">'+esc(b.detail)+'</p><div class="project-stats">'+[
    [all.length,application?'申请条目':'子事项'],[applied.length,'有投递记录'],[waiting.length,'记录为等待回复'],[interviews.length,'面试进行中']
  ].map(([n,label])=>'<div class="project-stat"><span>'+label+'</span><b>'+n+'</b></div>').join('')+'</div><div class="project-callout">'+(application?'回复状态以最近实际查收为准；修改看板不会刷新回复核对时间。未查收的申请会标记「待查收」。':'子事项的进度独立记录；完成其中一项不会自动完成整个板块。')+'</div><div class="project-toolbar"><div class="project-filters">'+[['all','全部'],['waiting','等待回复'],['action','需要行动'],['interview','面试中'],['ended','已结束']].map(([key,label])=>'<button data-project-filter="'+key+'" class="'+(projectFilter===key?'active':'')+'">'+label+'</button>').join('')+'</div><span class="spacer"></span><button id="project-view">'+(projectView==='board'?'切换表格':'切换阶段看板')+'</button><span class="project-switch-label">'+rows.length+' 项 · 修订 '+storeRevision+'</span></div><div id="project-content"></div>';
  const content=document.querySelector('#project-content');
  if(!all.length)content.innerHTML='<div class="project-empty"><b>这个板块还没有具体条目</b>添加一个已确认的目标，或复制更新指令给 GPT，从主记录整理。<br>没有来源的学校、导师、投递和截止日期会保持待核实。</div>';
  else if(!rows.length)content.innerHTML='<div class="project-empty">当前筛选下没有条目</div>';
  else if(projectView==='table')content.innerHTML='<div class="project-table-wrap"><table class="project-table"><thead><tr><th>机构 / 岗位</th><th>阶段</th><th>投递时间</th><th>回复情况</th><th>面试安排</th><th>下一步 / 跟进</th></tr></thead><tbody>'+rows.map(t=>'<tr data-task="'+esc(t.id)+'"><td><b>'+esc(t.title)+'</b><small>'+esc(t.contact||'联系人未记录')+'</small></td><td class="stage"><div data-mail-status="'+esc(t.id)+'">'+mailTrackingLabel(t)+'</div>'+esc(t.stage||t.lane)+'</td><td>'+esc(t.submittedAt||'未记录')+'</td><td>'+esc(replyLabel(t))+'<small>查收：'+esc(t.replyCheckedAt||'未记录')+'</small></td><td>'+esc(interviewSummary(t)||'未记录')+'</td><td>'+esc(t.followUp||t.detail||'待补充')+'<small>截止：'+esc(t.due||'未设置')+'</small>'+prepNoteLink(t)+'</td></tr>').join('')+'</tbody></table></div>';
  else {
    const groups=application?applicationStages:lanes;
    const stage=t=>application?(t.stage||'待核实'):t.lane;
    const visibleGroups=groups.filter(g=>rows.some(t=>stage(t)===g));
    content.innerHTML='<div class="project-lanes">'+visibleGroups.map(g=>{const group=rows.filter(t=>stage(t)===g);return '<section class="lane"><div class="lane-head"><span class="lane-dot"></span><b>'+g+'</b><span>'+group.length+'</span></div>'+group.map(t=>'<article class="task '+(t.completed?'completed':'')+'" data-task="'+esc(t.id)+'"><h3>'+esc(t.title)+'</h3><p>'+esc(t.followUp||t.detail)+'</p><div class="application-meta"><div data-mail-status="'+esc(t.id)+'">'+mailTrackingLabel(t)+'</div><strong>'+esc(replyLabel(t))+'</strong><br>投递：'+esc(t.submittedAt||'未记录')+'<br>查收：'+esc(t.replyCheckedAt||'未记录')+'<br>'+esc(t.contact||'联系人未记录')+(interviewSummary(t)?'<br><strong>'+esc(interviewSummary(t))+'</strong>':'')+(isEnded(t)?'<br>结束：'+esc(t.endReason||'原因未记录'):'')+'</div>'+prepNoteLink(t)+'</article>').join('')+'</section>'}).join('')+'</div>';
  }
  document.querySelector('#project-back').onclick=()=>setPage('tasks');
  document.querySelector('#project-add').onclick=()=>{openForm();const f=document.querySelector('#task-form');f.elements.category.value=b.cat||'工具';if(application)f.elements.stage.value='待准备'};
  document.querySelector('#project-view').onclick=()=>{projectView=projectView==='board'?'table':'board';render()};
  document.querySelector('#project-gpt').onclick=()=>showProjectPrompt(b);
  panel.querySelectorAll('[data-project-filter]').forEach(el=>el.onclick=()=>{projectFilter=el.dataset.projectFilter;render()});
  content.querySelectorAll('[data-task]').forEach(el=>el.onclick=()=>openInspector(el.dataset.task));
  content.querySelectorAll('.prep-note-link').forEach(a=>a.onclick=e=>e.stopPropagation());
  bindProjectLinks();
}
function renderApplication(t){
  const box=document.querySelector('#inspect-application');
  const parts=[];
  if(isApplicationProject(t.project)){
    parts.push('<div class="inspect-section"><b>申请追踪</b><p>阶段：'+esc(t.stage||t.lane)+'<br>投递：'+esc(t.submittedAt||'未记录')+'<br>回复：'+esc(replyLabel(t))+'<br>实际查收：'+esc(t.replyCheckedAt||'未记录')+'<br>联系人：'+esc(t.contact||'未记录')+'<br>跟进：'+esc(t.followUp||'待补充')+'</p>'+(isEnded(t)||t.endReason||t.endedAt?'<p><b>结束记录</b><br>'+esc(t.endedAt||'时间未记录')+'<br>'+esc(t.endReason||'原因未记录')+'</p>':'')+'</div>');
  }
  const linkLabels={'web':'网站','doc':'文档','chat':'聊天','other':'其他'};
  const rel=[];
  if((t.interviews||[]).length)rel.push('<b>面试</b>'+interviewDetails(t));
  (t.links||[]).forEach(l=>{const safe=/^https:\/\//i.test(l.url);rel.push('<b>'+esc(linkLabels[l.type]||'链接')+'</b> '+esc(l.label)+(l.url?(safe?' <a href="'+esc(l.url)+'" target="_blank" rel="noopener noreferrer">打开 ↗</a>':' · '+esc(l.url)):'')+'');});
  if(rel.length)parts.push('<div class="inspect-section"><b>关联信息</b>'+rel.join('<br>')+'</div>');
  box.innerHTML=parts.join('');
  const button=document.querySelector('#inspect-board');const boardId=t.kind==='board'?t.id:t.project;const insideBoard=page==='tasks'&&activeProject===boardId;button.classList.toggle('hidden',!boardId||insideBoard);button.onclick=()=>openProject(boardId);
}
function showProjectPrompt(board){
  document.querySelector('#prompt-text').value=`请维护我的「${board.title}」专项看板（板块 ID：${board.id}）。
先读取 ~/.agents/skills/todo-board/SKILL.md、适用分类 AGENTS.md，以及主记录：${board.source||'先核实主记录位置'}。
CLI：使用 ~/.agents/skills/todo-board/SKILL.md 中的 todoctl.py 绝对路径（python3 <该路径>/todoctl.py）
先 list --all，再 list --project ${board.id} --json，按机构与岗位匹配已有条目，避免重复。
优先看主记录的“当前”部分和最新已核实证据，不能用下面的旧草稿或历史“未投”覆盖新的投递记录。
面试用 --interviews-json 记录完整轮次数组（id、round、status、startsAt、timezone、meetingUrl、location、notes；均为字符串），状态为待安排/已安排/已完成/已取消；保留已有轮次，取消不删除，时间未知留空，已知时间须同时写 IANA 时区。仅从证据填写会议链接。结束可用 --stage 已结束 --ended-at 和 --end-reason，未通过/已撤回同属结束项。
按公司/学校/导师整理阶段、联系人、实际投递时间（含时区）、回复状态、实际查收时间、下一步和已知截止；用 --project ${board.id} 关联。先更新主记录，再通过 CLI 更新看板。
如果需要核对回复，使用已连接的只读邮箱/招聘平台。没查到实际外部状态时，明确写待核实，不把本地记录的等待回复当成当前未回复；不要自动刷新 --reply-checked-at。
只对缺失且影响下一步的信息主动问我，合并成一个简短问题；已有证据的进展直接更新。不要编造 DDL，不发送邮件或提交申请。最后告诉我哪些在等回复、哪些需要我行动。`;
  document.querySelector('#prompt-modal').classList.remove('hidden');document.querySelector('#prompt-text').focus();document.querySelector('#copy-status').textContent='复制后粘贴到 Codex 对话。';
}
