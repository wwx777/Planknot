(() => {
  const key = 'todo-personal-profile-v1';
  let profile = {name:'', initials:'', timezone:'Europe/Paris', avatar:''};
  try { Object.assign(profile, JSON.parse(localStorage.getItem(key) || '{}')); } catch {}
  try { new Intl.DateTimeFormat('en', {timeZone:profile.timezone}); } catch { profile.timezone='Europe/Paris'; }
  window.todoDisplayTimezone = () => profile.timezone;
  window.todoDisplayParts = timestamp => {
    const date = new Date(timestamp * 1000);
    const parts = new Intl.DateTimeFormat('en-CA', {timeZone:profile.timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date);
    const p = Object.fromEntries(parts.map(v=>[v.type,v.value]));
    return {day:`${p.year}-${p.month}-${p.day}`,time:`${p.hour}:${p.minute}`};
  };
  document.addEventListener('DOMContentLoaded', () => {
    const trigger = document.querySelector('.avatar');
    trigger.type='button'; trigger.title='个人偏好'; trigger.setAttribute('aria-label','个人偏好');
    const modal = document.createElement('dialog');
    modal.className='profile-dialog'; modal.setAttribute('aria-label','个人偏好');
    modal.innerHTML=`<form class="profile-form"><div class="profile-head"><div><small>PERSONAL</small><h2>个人偏好</h2></div><button type="button" class="profile-close" aria-label="关闭个人偏好">×</button></div><div class="profile-photo-row"><div class="profile-preview"></div><div><label class="profile-upload">更换头像<input type="file" accept="image/png,image/jpeg,image/webp" hidden></label><button type="button" class="profile-reset">使用名字缩写</button></div></div><label class="profile-label">昵称<input name="nickname" maxlength="30" required autocomplete="nickname"></label><label class="profile-label">头像缩写<input name="initials" maxlength="4" required></label><label class="profile-label">显示时区<select name="timezone"></select></label><p class="profile-hint">用于日历与运行状态的时间显示。原始记录、系统提醒和自动化计划保留各自时区。</p><p class="profile-error" role="alert"></p><div class="profile-footer"><span>仅保存在本机</span><button type="button" class="profile-cancel">取消</button><button type="submit" class="profile-save">保存</button></div></form>`;
    document.body.append(modal);
    const form=modal.querySelector('form'), preview=modal.querySelector('.profile-preview'), error=modal.querySelector('.profile-error');
    let draftAvatar='', reading=false;
    const paint=(el,avatar,initials)=>{el.replaceChildren();if(avatar&&/^data:image\/(png|jpeg|webp);base64,/.test(avatar)){const image=new Image();image.src=avatar;image.alt='';el.append(image);}else el.textContent=initials||'○';};
    const paintTrigger=()=>{paint(trigger,profile.avatar,profile.initials);trigger.title=profile.name+' · 个人偏好';};
    const zones=[...new Set([profile.timezone,'Europe/Paris','Asia/Shanghai','Europe/London','America/New_York','America/Los_Angeles','Asia/Tokyo','UTC',...(Intl.supportedValuesOf?.('timeZone')||[])])];
    zones.forEach(zone=>{const option=document.createElement('option');option.value=zone;option.textContent=zone;form.elements.timezone.append(option);});
    trigger.onclick=()=>{form.elements.nickname.value=profile.name;form.elements.initials.value=profile.initials;form.elements.timezone.value=profile.timezone;draftAvatar=profile.avatar;error.textContent='';paint(preview,draftAvatar,profile.initials);modal.showModal();};
    const close=()=>modal.close();
    modal.querySelector('.profile-close').onclick=close;modal.querySelector('.profile-cancel').onclick=close;
    modal.addEventListener('click',e=>{if(e.target===modal){const r=modal.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close();}});
    form.elements.initials.oninput=()=>paint(preview,draftAvatar,form.elements.initials.value);
    modal.querySelector('.profile-reset').onclick=()=>{draftAvatar='';paint(preview,'',form.elements.initials.value);};
    modal.querySelector('input[type=file]').onchange=async e=>{
      const file=e.target.files[0];if(!file)return;
      if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>10*1024*1024){error.textContent='请选择 10 MB 以内的 PNG、JPEG 或 WebP 图片。';return;}
      reading=true;form.querySelector('.profile-save').disabled=true;
      const url=URL.createObjectURL(file);
      try{const img=new Image();img.src=url;await img.decode();const canvas=document.createElement('canvas');canvas.width=canvas.height=192;const size=Math.min(img.width,img.height);canvas.getContext('2d').drawImage(img,(img.width-size)/2,(img.height-size)/2,size,size,0,0,192,192);draftAvatar=canvas.toDataURL('image/png');paint(preview,draftAvatar,form.elements.initials.value);error.textContent='';}catch{error.textContent='无法读取这张图片，请换一张。';}finally{URL.revokeObjectURL(url);reading=false;form.querySelector('.profile-save').disabled=false;e.target.value='';}
    };
    form.onsubmit=e=>{e.preventDefault();if(reading)return;const next={name:form.elements.nickname.value.trim(),initials:form.elements.initials.value.trim(),timezone:form.elements.timezone.value,avatar:draftAvatar};if(!next.name||!next.initials){error.textContent='请填写昵称和头像缩写。';return;}try{localStorage.setItem(key,JSON.stringify(next));}catch{error.textContent='保存失败，请检查本机存储空间。';return;}profile=next;paintTrigger();modal.close();if(typeof calendarCursor!=='undefined'){calendarCursor=parisDate();const date=calendarDate(calendarCursor);calMonth=new Date(date.getFullYear(),date.getMonth(),1);}if(typeof render==='function')render();};
    paintTrigger();
  });
})();
