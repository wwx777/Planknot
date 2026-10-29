const {test}=require('node:test');
const assert=require('node:assert/strict');
const {calendarSourceDates:parse}=require('../calendar-dates.js');
test('explicit source timezone converts across midnight and daylight-saving boundary',()=>{
  let [e]=parse('2026-10-30 00:30 · Asia/Shanghai','Europe/Paris');
  assert.equal(e.day,'2026-10-29');assert.equal(e.time,'17:30');
  [e]=parse('2026-10-24 12:00 Europe/Paris','Asia/Shanghai');assert.equal(e.time,'18:00');
  [e]=parse('2026-10-26 12:00 Europe/Paris','Asia/Shanghai');assert.equal(e.time,'19:00');
});
test('pure dates stay dates and unknown zones never receive an hour slot',()=>{
  const [e]=parse('2026-10-30','America/Los_Angeles');assert.equal(e.day,'2026-10-30');assert.equal(e.time,'');assert.equal(e.sourceLabel,'');
  const [uncertain]=parse('2026-10-30 10:00 Europe/Paris（时区未明示）','Asia/Shanghai');assert.equal(uncertain.time,'');assert.match(uncertain.sourceLabel,/时区未注明/);
  const [unknown]=parse('2026-10-30 10:00','Europe/Paris');assert.equal(unknown.time,'');assert.match(unknown.sourceLabel,/时区未注明/);
});
test('ambiguous or nonexistent DST local time remains flagged',()=>{
  for(const text of ['2026-10-25 02:30 Europe/Paris','2026-03-29 02:30 Europe/Paris']){
    const [e]=parse(text,'Asia/Shanghai');assert.equal(e.time,'');assert.match(e.sourceLabel,/时间待核实/);
  }
});
test('explicit ISO offsets disambiguate DST, including negative offset',()=>{
  const [early]=parse('2026-10-25T02:30:00+02:00','UTC');assert.equal(early.time,'00:30');
  const [late]=parse('2026-10-25T02:30:00+01:00','UTC');assert.equal(late.time,'01:30');
  const [negative]=parse('2026-10-30T23:30:00-05:00','UTC');assert.equal(negative.day,'2026-10-31');assert.equal(negative.time,'04:30');
});
test('ranges convert both endpoints and invalid time is not plotted',()=>{
  const [e]=parse('2026-10-30 09:00–11:00 Asia/Shanghai','Europe/Paris');assert.equal(e.time,'02:00–04:00');
  assert.equal(parse('2026-02-30 11:00 Europe/Paris','UTC'),null);
  const [invalid]=parse('2026-10-30 25:00 Europe/Paris','UTC');assert.equal(invalid.time,'');assert.match(invalid.sourceLabel,/待核实/);
});
