/* UI-only localization. Stored task content and enum values stay source-backed. */
(() => {
  const KEY='todo.ui-language.v1';
  let language='zh';
  try { if(localStorage.getItem(KEY)==='en')language='en'; } catch {}
  const words={
    '截止日期（可选）':'Deadline (optional)','清除截止日期':'Clear deadline','未指定':'Not specified',
    '原截止记录保留；选择日期可替换。':'The original deadline is preserved. Select a date to replace it.',
    '选择截止日期后会加入日历；补上小时和分钟即可安排提醒。':'Select a deadline date to add it to the calendar. Add an hour and minute for alerts.',
    '已选日期会加入日历；补上小时和分钟才能安排提醒。':'The selected date will appear in the calendar. Add an hour and minute for alerts.',
    '日期类型':'Date type','暂无日期':'No date','截止时间（DDL）':'Deadline (DDL)','仅记录日期':'Date only','保留原日期记录':'Keep original date record','选择日期':'Select date','小时':'Hour','分钟':'Minute','时区':'Time zone','截止小时':'Deadline hour','截止分钟':'Deadline minute','请选择':'Select',
    '未设置日期，不加入日历或截止提醒。':'No date set; no calendar entry or deadline alerts.',
    '作为全天事项加入日历；要收到 DDL 提醒，请选择截止时间。':'Added as an all-day calendar entry. Choose a deadline time for alerts.',
    '原记录会完整保留；选择截止时间可改为可提醒的 DDL。':'The original record is preserved. Choose a deadline time to enable alerts.',
    '将加入日历。DDL 提醒当前关闭，请到设置开启。':'Added to the calendar. Enable deadline alerts in Settings.',
    '将加入日历。系统通知未允许，请在系统设置中开启。':'Added to the calendar. Allow notifications in System Settings.',
    '将加入日历，并按设置提前 1 天和 1 小时提醒；已过去的提醒时间会跳过。':'Added to the calendar with alerts 1 day and 1 hour before, as configured. Past alert times are skipped.',
    '请选择日期。':'Select a date.','请选择有效日期。':'Select a valid date.','请选择截止小时和分钟。':'Select the deadline hour and minute.','该时区下的时间不存在或有歧义，请重新选择。':'This time is invalid or ambiguous in the selected time zone. Choose another time.',
    '界面语言':'Interface language','中文 / English':'中文 / English','语言选择已保存。':'Language preference saved.',
    '任务':'Tasks','日历':'Calendar','日程':'Schedule','专注':'Focus','设置':'Settings','我的看板':'My board','优先关注':'Priority','等待外部':'Waiting','待核实':'To verify','历史事项':'History','按分类查看':'Categories','专项板块':'Project boards','全部':'All','已完成':'Completed','已归档':'Archived','进行中':'In progress','临近 / 已过':'Due / overdue','申请':'Applications','课程':'Courses','生活':'Life','生活杂事':'Life','科研':'Research','工具':'Tools','当前要处理':'To do now','搜索结果':'Search results','收起':'Show less','当前没有待处理的任务':'No tasks to do right now','当前没有事项':'No items',
    'Intern 申请':'Intern applications','PhD 申请':'PhD applications','需要行动':'Action needed','等待回复':'Awaiting reply','面试中':'Interviewing','已结束':'Closed','待准备':'Preparing','待审稿':'Ready for review','已投递':'Submitted','未通过':'Rejected','已撤回':'Withdrawn','面试进行中':'Interviewing','回复待核实':'Reply unverified','已回复':'Replied','待查收':'Not checked','截至核对时未见回复':'No reply at last check','邮件已关联':'Email linked','邮件未关联':'Email not linked','关联申请邮件':'Link application email','更换关联':'Change linked email','打开关联邮件':'Open linked email','未记录':'Not recorded','未设置':'Not set','联系人未记录':'No contact recorded','原因未记录':'No reason recorded','时间未记录':'No time recorded','待补充':'To add',
    '← 总看板':'← All boards','切换表格':'Table view','切换看板':'Board view','复制给 GPT 的更新指令':'Copy update prompt for GPT','＋ 添加申请':'＋ Add application','机构 / 岗位':'Organization / role','阶段':'Stage','投递时间':'Submitted','回复情况':'Reply status','面试安排':'Interviews','下一步 / 跟进':'Next step / follow-up','申请条目':'Applications','有投递记录':'With submission records','记录为等待回复':'Recorded as awaiting reply','回复状态以最近实际查收为准；修改看板不会刷新回复核对时间。未查收的申请会标记「待查收」。':'Reply status reflects the last email check. Editing a task does not update it. Unchecked applications are marked accordingly.',
    '当前记录':'Current status','日期 / 截止':'Date / deadline','申请 / 子事项追踪':'Application / item tracking','进度时间线':'Progress timeline','◉ 开始专注':'◉ Start focus','编辑任务':'Edit task','标记完成':'Mark complete','重新打开任务':'Reopen task','归档此任务':'Archive task','取消归档':'Unarchive','进入专项板块 →':'Open project board →','打开主记录 ↗':'Open source record ↗','↗ Obsidian 备考':'↗ Obsidian notes','↗ 在 Obsidian 打开备考笔记':'↗ Open preparation notes in Obsidian','关键节点':'Milestone','添加':'Add','完成':'Complete','重新打开':'Reopen','紧急':'Urgent','需关注':'Watch','暂无说明':'No details',
    '连接与提醒':'Connections & reminders','你的看板保存在这台 Mac。这里显示本机连接状态，并管理日常、DDL 与面试提醒。':'Your board is stored on this Mac. Manage connections, daily routines, deadlines and interview reminders here.',
    '申请邮件监听':'Application email alerts','接收器运行中':'Receiver running','需要处理':'Needs attention','监听状态待核实':'Connection unverified','后台未运行':'Background service stopped','正在读取':'Loading','邮箱':'Email','Google 授权':'Google authorization','最近收到事件':'Last event','订阅有效至':'Watch expires','待处理事件':'Pending events','测试授权预计到期':'Testing authorization expiry','尚无记录':'No record yet','尚未授权':'Not authorized','已保存授权；有效性以后台连接为准':'Authorization saved; live connection determines validity','旧授权未记录到期时间；Testing 通常 7 天有效':'No expiry recorded; Testing authorization usually lasts 7 days',
    '应用保持 Testing，仅本人使用。订阅每日续期；授权到期后需在 Google 重新确认。仅追踪已关联的申请邮件；使用本机规则提示疑似进展，具体内容仍需核对。':'The application is in Testing for personal use. The watch renews daily; renew Google authorization when it expires. Only linked application threads are tracked. Local rules flag possible progress for review.',
    '刷新状态':'Refresh status','重新授权 Gmail':'Reauthorize Gmail','浏览器授权进行中…':'Authorization in progress…','面试提前提醒':'Interview reminders','已开启':'Enabled','未开启':'Disabled','只提醒「已安排」且时间、时区准确的未来面试。改期、取消、结束后会重新安排提醒。':'Reminders apply to scheduled future interviews with confirmed times and time zones. Rescheduling, cancellation or closure updates the plan.',
    '提前 3 天':'3 days before','提前 30 分钟':'30 minutes before','准备材料与面试':'Prepare for the interview','检查设备并进入会议':'Check equipment and join','系统通知权限':'Notification permission','已允许':'Allowed','未允许，请在系统设置中开启':'Denied; enable in System Settings','尚未请求':'Not requested','临时允许':'Provisional','已排定提醒':'Scheduled reminders','日历显示时区':'Calendar time zone','保存两次提醒':'Save both reminders','开启面试提醒':'Enable interview reminders','关闭提醒':'Disable reminders','系统通知设置 ↗':'Notification settings ↗',
    '首次开启需要允许 macOS 通知。提醒排入系统后，App 关闭仍可送达；实际展示受勿扰模式和系统设置影响。':'Allow macOS notifications when prompted. Scheduled notifications can arrive while the app is closed; Focus mode and system settings affect display.',
    '日常 routine':'Daily routine','已排定':'Scheduled','未排定':'Not scheduled','八股与 coding · 每晚 21:00':'Interview fundamentals & coding · every evening at 21:00','Europe/Paris · 每天重复。点击通知打开练习任务；标记整个任务完成或归档后，下次 App 同步会停止这项 routine。':'Europe/Paris · repeats daily. Click the notification to open the task. Completing or archiving the task stops this routine at the next app sync.',
    '关闭日常提醒':'Disable daily reminder','开启日常提醒':'Enable daily reminder','DDL 弹窗提醒':'Deadline notifications','提前 1 天 + 提前 1 小时':'1 day + 1 hour before','仅使用明确日期、钟点及来源时区。用户目标、模糊日期和已完成事项不提醒；只有日期、没有钟点的事项需先补充截止时间。':'Requires an exact date, time and source time zone. Goals, vague dates and completed items are excluded. Add a deadline time for date-only items.',
    '已排定通知':'Scheduled notifications','需补充准确时间':'Exact time needed','查看待确认事项':'Show items to confirm','需要唯一且明确的截止时间与时区':'A single exact deadline and time zone are required','截止时间或时区需确认':'Confirm the deadline time and time zone','关闭 DDL 提醒':'Disable deadline reminders','开启 DDL 提醒':'Enable deadline reminders',
    '通知排入系统后 App 关闭仍可送达；改期与完成会在 App 下次读取任务时更新。请允许系统通知；勿扰模式可能隐藏弹窗。':'Scheduled notifications can arrive while the app is closed. Rescheduling and completion are applied when the app next reads tasks. Allow notifications; Focus mode may hide banners.',
    '本机数据':'Local data','任务、面试与未读进展共用一份记录。导出的备份仅含任务数据，不含邮箱授权凭据。':'Tasks, interviews and unread updates share one store. Backups include task data, without email credentials.','导出任务备份':'Export task backup','打开数据文件夹 ↗':'Open data folder ↗',
    '个人偏好':'Personal preferences','关闭个人偏好':'Close preferences','更换头像':'Change avatar','使用名字缩写':'Use initials','昵称':'Name','头像缩写':'Initials','显示时区':'Display time zone','用于日历与运行状态的时间显示。原始记录、系统提醒和自动化计划保留各自时区。':'Used for calendar and status timestamps. Source records, system reminders and schedules keep their own time zones.','仅保存在本机':'Saved on this Mac','取消':'Cancel','保存':'Save',
    '今天':'Today','明天':'Tomorrow','时间':'Time','周日':'Sun','周一':'Mon','周二':'Tue','周三':'Wed','周四':'Thu','周五':'Fri','周六':'Sat','日':'Day','周':'Week','月':'Month','‹ 上月':'‹ Previous month','下月 ›':'Next month ›','‹ 上周':'‹ Previous week','下周 ›':'Next week ›','‹ 前一天':'‹ Previous day','后一天 ›':'Next day ›','全天':'All day','截止/日期':'Deadline / date','面试':'Interview','进入会议 ↗':'Join meeting ↗','查看申请':'View application','面试时间待核实':'Interview time to confirm','已安排':'Scheduled','待安排':'Not scheduled','已取消':'Cancelled',
    '添加任务':'Add task','标题':'Title','分类':'Category','当前状态':'Status','当前记录 / 下一步':'Current status / next step','日期 / 截止（保留时区）':'Date / deadline (include time zone)','重要程度':'Priority','普通':'Normal','重要':'Important','主记录路径 / 链接':'Source record path / link','添加到共享看板':'Add to shared board','保存修改':'Save changes','任务类型':'Item type','普通任务':'Task','专项板块':'Project boards','所属专项板块':'Parent project','无':'None','联系人':'Contact','下一步 / 跟进日期':'Next step / follow-up date','投递时间（含时区）':'Submission time (include time zone)','最近实际查收时间':'Last actual email check','结束时间（含时区，可留空）':'Closed at (with time zone, optional)','结束原因 / 最终结果':'Closure reason / final result','面试安排与历史':'Interview schedule & history','＋ 添加一轮面试':'＋ Add interview round','轮次':'Round','状态':'Status','会议链接':'Meeting URL','地点':'Location','备注':'Notes',
    '选择一个任务开始专注':'Choose a task to focus on','先选择一个任务':'Choose a task first','返回任务':'Back to tasks','选择任务':'Choose task','暂停':'Pause','继续':'Resume','开始':'Start','重置':'Reset','短休息':'Short break','长休息':'Long break','专注完成':'Focus complete','本轮完成':'Session complete','今日专注':'Focus today','今日累计':'Total today','停止':'Stop','结束专注':'End focus','切换任务':'Switch task','剩余时间':'Time remaining','专注时间':'Focus time',
    '进展更新':'Progress updates','关闭进展更新':'Close updates','标为已读':'Mark as read','全部标为已读':'Mark all as read','暂无未读进展':'No unread updates','查看更新':'View updates','确认已读后，小组件上的提示才会消除。阅读不会自动清除。':'Widget indicators clear after you mark updates as read. Opening an update does not clear it.',
    '搜索任务':'Search tasks','搜索任务、课程、项目…':'Search tasks, courses, projects…','记录一条进展…':'Add a progress note…','日期(可选,仅填已核实)':'Date (optional, confirmed only)','语言设置无法保存，请重试。':'Unable to save language preference. Please try again.'
  };
  Object.assign(words,{
    '任务专注':'Task focus','先选一件要做的事':'Choose one thing to work on','从任务中开始一轮专注，时间会记在这项任务下。':'Start a focus session from a task. Time is recorded against that task.',
    '切换专注任务':'Switch focus task','当前还有一轮未结束':'A session is still in progress','未关联任务':'No linked task','返回当前专注':'Back to current session','结束当前并切换':'End session and switch',
    '← 返回任务':'← Back to task','正在专注':'Focusing','计时时长':'Session length','准备开始':'Ready to start','保持专注，一次只做一件事':'Stay focused, one thing at a time','已暂停，准备好再继续':'Paused. Resume when ready.','本轮完成，休息一下吧':'Session complete. Take a break.','休息结束，准备好再开始':'Break over. Start when ready.','再来一轮':'Another session','自定义':'Custom','自定义分钟':'Custom minutes','分钟':'minutes','应用':'Apply',
    '到点会通过系统通知提醒。':'A system notification will remind you when time is up.','页面预览：请在 App 中使用系统到点提醒。':'Preview: use the app for system notifications.','计时继续；系统提醒未能排定，请暂停后继续重试。':'Timer continues; notification could not be scheduled. Pause and resume to retry.','到点会通过系统通知提醒，切换页面或关闭 App 也会继续计时。':'A system notification will remind you. The timer continues when you switch pages or close the app.',
    '这项任务已结束或已归档，请返回任务选择其他事项。':'This task is completed or archived. Choose another task.','请输入 1–180 之间的整数分钟。':'Enter a whole number from 1 to 180 minutes.','本机存储不可用，关闭页面后可能无法恢复计时。':'Local storage is unavailable. The timer may not be restored after closing.',
    '一面、二面、三面可分别记录。未知时间留空；改期直接编辑，取消请保留轮次并选择「已取消」。':'Record each interview round separately. Leave unknown times blank. Edit to reschedule; keep cancelled rounds and mark them Cancelled.',
    '写入会记录时间和操作者；未核实的 DDL 请留空。':'Changes record the time and author. Leave unverified deadlines blank.',
    '此按钮只复制指令。':'This button copies the prompt.','复制指令':'Copy prompt','已复制，粘贴到 Codex 对话即可。':'Copied. Paste into your Codex chat.','已选中，请按 ⌘C 复制。':'Selected. Press ⌘C to copy.',
    '带明确时区的时间按所选时区换算；纯日期保留来源日期，缺少时区或时间有歧义的条目放在全天区并标注原文，待核实后再排入小时格。':'Explicit time zones are converted to your display time zone. Date-only items keep their source date. Uncertain times appear in the all-day area until confirmed.'
  });
  const patterns=[
    [/^(专注|短休息|长休息) (\d+) 分钟$/,(_,label,n)=>words[label]+' '+n+' min'],
    [/^这项任务已完成 (\d+) 轮 · (\d+) 分钟$/,(_,n,m)=>n+' sessions · '+m+' minutes on this task'],
    [/^切换至「(.+)」会结束当前计时。$/,(_,title)=>'Switching to “'+title+'” will end the current timer.'],
    [/^(.+) · 个人偏好$/,(_,name)=>name+' · Personal preferences'],
    [/^申请 · (.+)$/,(_,status)=>'Applications · '+(words[status]||status)],
    [/^(Intern|PhD) 申请$/,(_,kind)=>kind+' applications'],
    [/^(\d+) 项 · 修订 (\d+)$/,(_,n,r)=>n+' items · revision '+r],
    [/^(\d+) 项 · (\d+) 项等待回复$/,(_,n,w)=>n+' items · '+w+' awaiting reply'],
    [/^等待与待核实 · (\d+) 项$/,(_,n)=>'Waiting & to verify · '+n+' items'],
    [/^(.*) · 带时区的时间已换算；纯日期及时间待核实项放在全天区。点击事项查看原始时间。$/,(_,zone)=>zone+' · Times with explicit zones are converted. Date-only and uncertain times appear in the all-day area. Open an item for its source time.'],
    [/^(☀ |⚑ |◷ |\? )?(我的看板|优先关注|等待外部|待核实)(\s*\d*)$/,(_,icon='',label,n)=>icon+(words[label]||label)+n],
    [/^▤ (Intern|PhD) 申请(.*)$/,(_,kind,n)=>'▤ '+kind+' applications'+n],
    [/^(\d+) 项$/,(_,n)=>n+' items'],[/^查看其余 (\d+) 项$/,(_,n)=>'Show '+n+' more'],[/^还有 (\d+) 项$/,(_,n)=>n+' more'],
    [/^等待与待核实 · (\d+) 项$/,(_,n)=>'Waiting & to verify · '+n+' items'],
    [/^下次提醒：(.*)$/,(_,v)=>'Next reminder: '+v],[/^最近更新：(.*)$/,(_,v)=>'Last updated: '+v],
    [/^(阶段|投递|回复|实际查收|查收|联系人|跟进|截止|结束|原时间)：\s*/,(_,label)=>({'阶段':'Stage','投递':'Submitted','回复':'Reply','实际查收':'Last email check','查收':'Checked','联系人':'Contact','跟进':'Follow-up','截止':'Deadline','结束':'Closed','原时间':'Source time'})[label]+': '],
    [/^(已完成|进行中|待核实|等待外部|已投递|待准备|面试中|已结束) (\d+)$/,(_,s,n)=>words[s]+' '+n],
    [/^\s*在 Obsidian 打开 (.+) 的备考笔记$/,(_,title)=>'Open preparation notes for '+title+' in Obsidian'],
    [/^(完成|重新打开|专注于) (.+)$/,(_,s,title)=>({'完成':'Complete','重新打开':'Reopen','专注于':'Focus on'})[s]+' '+title],
    [/^(\d{4}) 年 (\d{1,2}) 月$/,(_,y,m)=>new Intl.DateTimeFormat('en',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(Date.UTC(+y,+m-1,1)))]
  ];
  function translate(value){
    if(language!=='en')return value;
    const core=value.trim();
    if(Object.hasOwn(words,core))return value.replace(core,words[core]);
    for(const [pattern,replace] of patterns)if(pattern.test(value))return value.replace(pattern,replace);
    return value;
  }
  window.todoLocale=()=>language==='en'?'en-GB':'zh-CN';
  window.todoUILanguage=()=>language;
  window.todoI18nText=translate;
  const sources=new WeakMap(),attributes=new WeakMap();
  const protectedContent='script,style,textarea,input,[contenteditable="true"],#inspect-title,#inspect-detail,#inspect-due,#focus-task-title,.focus-task-picker span,#prompt-text,#prompt-modal textarea,.workspace-open b,.workspace-open small,.task h3,.task p,.project-table td:first-child b,.project-table td:nth-child(6),.project-intro,.timeline';
  let observer,queued=false;
  function apply(){
    queued=false;
    observer?.disconnect();
    try {
      document.documentElement.lang=window.todoLocale();
      // Text-only options must retain their Chinese enum values for form submission.
      document.querySelectorAll('option:not([value])').forEach(option=>option.setAttribute('value',option.textContent));
      const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
      while(walker.nextNode()){
        const node=walker.currentNode;
        if(node.parentElement?.closest(protectedContent))continue;
        const saved=sources.get(node);
        const original=saved&&node.nodeValue===saved.rendered?saved.original:node.nodeValue;
        const rendered=translate(original);
        if(node.nodeValue!==rendered)node.nodeValue=rendered;
        sources.set(node,{original,rendered});
      }
      document.querySelectorAll('[aria-label],[title],[placeholder]').forEach(el=>{
        if(el.closest('script,style'))return;
        const saved=attributes.get(el)||{};
        for(const name of ['aria-label','title','placeholder']){
          if(!el.hasAttribute(name))continue;
          const value=el.getAttribute(name),previous=saved[name];
          const original=previous&&previous.rendered===value?previous.original:value;
          const rendered=translate(original);
          if(value!==rendered)el.setAttribute(name,rendered);
          saved[name]={original,rendered};
        }
        attributes.set(el,saved);
      });
      const select=document.querySelector('#ui-language');
      if(select&&select.value!==language)select.value=language;
    } finally { observer?.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['title','placeholder','aria-label']}); }
  }
  window.todoSetUILanguage=value=>{
    if(!['zh','en'].includes(value))return;
    try { localStorage.setItem(KEY,value); } catch { return false; }
    language=value;
    if(typeof render==='function')render();
    apply();
    return true;
  };
  window.todoLanguageSettings=()=>'<section class="settings-card settings-language"><div><h3>界面语言</h3><p class="settings-note">中文 / English</p></div><select id="ui-language" aria-label="界面语言"><option value="zh"'+(language==='zh'?' selected':'')+'>中文</option><option value="en"'+(language==='en'?' selected':'')+'>English</option></select><p id="language-error" role="alert"></p></section>';
  document.addEventListener('change',event=>{
    if(event.target.id!=='ui-language')return;
    if(window.todoSetUILanguage(event.target.value)===false){event.target.value=language;document.querySelector('#language-error').textContent=translate('语言设置无法保存，请重试。');}
  });
  document.addEventListener('DOMContentLoaded',()=>{
    observer=new MutationObserver(()=>{if(!queued){queued=true;queueMicrotask(apply);}});
    apply();
  });
})();
