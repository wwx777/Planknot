const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
class Element {
 constructor(dataset={}){this.dataset=dataset;this.children=[];this.hidden=true;this.className='';this.classList={toggle:(_n,v)=>{this.hidden=v},contains:()=>this.hidden};}
 append(child){child.parent=this;this.children.push(child)}
 remove(){if(this.parent)this.parent.children=this.parent.children.filter(x=>x!==this)}
 setAttribute(){}
 querySelector(){return null}
}
test('task and parent board markers survive redraw, stay deduplicated, clear only on acknowledgement',()=>{
 let targets=[new Element({workspaceOpen:'APP'}),new Element({project:'BOARD'})];
 const banner=new Element(),modal=new Element(),button=new Element();
 const document={querySelector:s=>({'#update-banner':banner,'#updates-modal':modal,'#show-updates':button})[s],
  querySelectorAll:s=>s==='.unread-dot'?targets.flatMap(t=>t.children):targets,
  createElement:()=>new Element(),addEventListener:()=>{}};
 const ctx=vm.createContext({document,window:{},tasks:[{id:'APP',project:'BOARD',title:'Isolated application'}],esc:s=>s});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../progress-updates.js'),'utf8'),ctx);
 vm.runInContext("progressAlerts=[{id:'alert',taskId:'APP',title:'Reply'}];renderProgressUpdates()",ctx);
 assert.equal(banner.hidden,false);assert.deepEqual(targets.map(t=>t.children.length),[1,1]);
 vm.runInContext('renderProgressUpdates()',ctx);assert.deepEqual(targets.map(t=>t.children.length),[1,1]);
 targets=[new Element({workspaceOpen:'APP'}),new Element({project:'BOARD'})];
 vm.runInContext('renderProgressUpdates()',ctx);assert.deepEqual(targets.map(t=>t.children.length),[1,1]);
 vm.runInContext("progressAlerts[0].readAt='acknowledged';renderProgressUpdates()",ctx);
 assert.equal(banner.hidden,true);assert.deepEqual(targets.map(t=>t.children.length),[0,0]);
});
