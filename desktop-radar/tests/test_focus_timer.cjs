const assert=require('node:assert/strict');
const {FocusClock}=require('../focus-timer.js');
// Wall clock, delayed ticks and restoration must not accumulate interval drift.
const clock=new FocusClock();clock.start(1000);assert.equal(clock.seconds(61000),1440);
const restored=new FocusClock(JSON.parse(JSON.stringify(clock)));assert.equal(restored.seconds(61000),1440);
clock.pause(61500);assert.equal(clock.seconds(1000000),1440);clock.start(1000000);
assert.equal(clock.seconds(1060000),1380);assert.equal(clock.choose(5,'短休息'),false);
assert.equal(clock.tick(2440000),true);assert.equal(clock.status,'finished');assert.equal(clock.tick(2500000),false);
clock.reset();assert.equal(clock.seconds(),1500);assert.equal(clock.status,'idle');
assert.equal(clock.choose(0,'专注'),false);assert.equal(clock.choose(1.5,'专注'),false);assert.equal(clock.choose(181,'专注'),false);
assert.equal(clock.choose(5,'短休息'),true);assert.equal(clock.seconds(),300);
clock.start(0);clock.pause(400000);assert.equal(clock.status,'finished');
console.log('Focus timer: wall clock, restore, pause/resume, finish once, reset and validation passed');

const bound=new FocusClock();assert.equal(bound.bind({id:"A",title:"任务 A"}),true);bound.start(1000);assert.equal(bound.bind({id:"B",title:"任务 B"}),false);const savedBound=new FocusClock(JSON.parse(JSON.stringify(bound)));assert.equal(savedBound.taskId,"A");assert.equal(savedBound.taskTitle,"任务 A");bound.reset();assert.equal(bound.bind({id:"B",title:"任务 B"}),true);console.log("Task binding, restore and active-task switch guard passed");
