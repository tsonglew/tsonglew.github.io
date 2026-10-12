import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import vm from 'node:vm'
// Exercise the real persistence functions with two tab contexts sharing storage.
const source=readFileSync(new URL('../public/cs2680/platform.js',import.meta.url),'utf8')
const prelude=source.slice(0,source.indexOf('  const menu ='))+'globalThis.testing={persist,syncLatest,get:()=>state}; })()'
const db=new Map()
const ids=['01-agent-loop','02-tools','03-context']
function tab(){
  let fail=false
  const context=vm.createContext({document:{querySelectorAll:()=>ids.map(id=>({dataset:{progressId:id}}))},localStorage:{getItem:k=>db.get(k)||null,setItem:(k,v)=>{if(fail)throw new Error('quota');db.set(k,v)}},setTimeout,clearTimeout})
  vm.runInContext(prelude,context)
  return {...context.testing,setFailure:v=>{fail=v}}
}
const a=tab(),b=tab()
const note=(id,text)=>({note:{id,value:{text,updatedAt:new Date().toISOString()}}})
a.persist(note(ids[0],'A'))
b.persist(note(ids[1],'B'))
a.syncLatest();assert.equal(a.get().notes[ids[1]].text,'B')
a.persist({completion:{id:ids[0],done:true}})
b.persist({completion:{id:ids[1],done:true}})
a.persist({completion:{id:ids[0],done:false}})
assert.deepEqual([...a.get().completed],[ids[1]])
a.setFailure(true)
assert.equal(a.persist(note(ids[0],'A pending')),false)
b.persist(note(ids[1],'B changed during quota failure'))
a.syncLatest()
assert.equal(a.get().notes[ids[0]].text,'A pending')
assert.equal(a.get().notes[ids[1]].text,'B changed during quota failure')
a.setFailure(false)
assert.equal(a.persist(note(ids[2],'A recovered')),true)
b.syncLatest()
assert.equal(b.get().notes[ids[0]].text,'A pending')
assert.equal(b.get().notes[ids[1]].text,'B changed during quota failure')
assert.equal(b.get().notes[ids[2]].text,'A recovered')
console.log('Cross-tab writes, completion reversal and quota-recovery merge passed.')
