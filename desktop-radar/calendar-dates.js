/* Explicit source timezones only. Missing or ambiguous timezone never becomes a guessed clock time. */
(function(root){
  function zonedParts(timestamp, timezone){
    const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(timestamp)).map(v=>[v.type,v.value]));
    return {day:`${p.year}-${p.month}-${p.day}`,time:`${p.hour}:${p.minute}`};
  }
  function utcTime(day,time,zone){
    const [y,m,d]=day.split('-').map(Number),[h,min]=time.split(':').map(Number);
    if(h>23||min>59)throw Error('invalid time');
    const target=Date.UTC(y,m-1,d,h,min);
    if(zone==='Z'||zone==='UTC'||zone==='GMT')return target;
    if(/^[+-]\d{2}:?\d{2}$/.test(zone)){
      const value=zone.replace(':',''),hours=Number(value.slice(1,3)),minutes=Number(value.slice(3));
      if(hours>23||minutes>59)throw Error('invalid offset');
      return target-(zone[0]==='-'?-1:1)*(hours*60+minutes)*60000;
    }
    const offsets=new Set();
    for(const delta of [-36,-12,0,12,36]){
      const sample=target+delta*3600000,p=zonedParts(sample,zone);
      offsets.add(Date.parse(p.day+'T'+p.time+':00Z')-sample);
    }
    const candidates=[...offsets].map(offset=>target-offset).filter(candidate=>{const p=zonedParts(candidate,zone);return p.day===day&&p.time===time;});
    if(candidates.length!==1)throw Error('ambiguous local time');
    return candidates[0];
  }
  function sourceZone(text,match){
    if(/时区(?:未明示|未注明|未知|未确认|待核实)|(?:暂按|假定).*时区/.test(text))return '';
    const suffix=text.slice(match.index+match[0].length);
    const iana=suffix.match(/\b([A-Za-z_]+\/[A-Za-z_]+(?:\/[A-Za-z_]+)?)\b/);
    if(iana)return iana[1];
    const offset=suffix.match(/^\s*(?:UTC|GMT)?\s*([+-]\d{2}:?\d{2})\b/);
    if(offset)return offset[1];
    if(/^Z\b/.test(suffix))return 'Z';
    if(/\bUTC\b/.test(suffix))return 'UTC';
    if(/\bGMT\b/.test(suffix))return 'GMT';
    if(/巴黎时间/.test(suffix))return 'Europe/Paris';
    if(/北京时间|中国时间/.test(suffix))return 'Asia/Shanghai';
    return '';
  }
  function calendarSourceDates(value,timezone){
    const text=String(value||''),match=/(\d{4})-(\d{2})-(\d{2})(?:\s*\/\s*(\d{1,2})(?![\d:]))?(?:[ T]+(\d{2}):(\d{2})(?::\d{2})?(?:(?:\s*–\s*|\s+-\s*)(\d{2}):(\d{2}))?)?/.exec(text);
    if(!match)return null;
    const [y,m,d]=match.slice(1,4).map(Number),valid=(day)=>{const x=new Date(Date.UTC(y,m-1,day));return x.getUTCFullYear()===y&&x.getUTCMonth()===m-1&&x.getUTCDate()===day;};
    if(!valid(d))return null;
    const dates=[`${match[1]}-${match[2]}-${match[3]}`];
    if(match[4]&&+match[4]>d&&valid(+match[4]))dates.push(`${match[1]}-${match[2]}-${match[4].padStart(2,'0')}`);
    if(!match[5])return dates.map(day=>({day,time:'',sourceLabel:'',original:text}));
    const time=match[5]+':'+match[6],zone=sourceZone(text,match),range=match[7]?time+'–'+match[7]+':'+match[8]:time;
    return dates.map(day=>{
      if(!zone)return {day,time:'',sourceLabel:'原时间 '+range+' · 时区未注明',original:text};
      try{
        const stamp=utcTime(day,time,zone),converted=zonedParts(stamp,timezone);
        let label=converted.time;
        if(match[7]){
          const end=utcTime(day,match[7]+':'+match[8],zone);
          if(end<stamp)throw Error('unknown overnight range');
          const parts=zonedParts(end,timezone);
          label+='–'+(parts.day===converted.day?'':parts.day+' ')+parts.time;
        }
        return {...converted,time:label,sourceLabel:'',original:text};
      }catch{return {day,time:'',sourceLabel:'时间待核实 · '+range+' '+zone,original:text};}
    });
  }
  root.todoCalendarDates=calendarSourceDates;
  if(typeof module!=='undefined')module.exports={calendarSourceDates,utcTime};
})(typeof window==='undefined'?globalThis:window);
