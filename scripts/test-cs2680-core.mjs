import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
const context = vm.createContext({})
vm.runInContext(readFileSync(new URL('../public/cs2680/platform-core.js', import.meta.url), 'utf8'), context)
const core = context.CS2680Core
const cost = { input: 12000, output: 2000, inputPrice: 1, outputPrice: 4, tasks: 100, successes: 80 }
assert.equal(core.cost(cost).total, 2)
assert.equal(core.cost(cost).perSuccess, 0.025)
assert.equal(core.cost({ ...cost, successes: 0 }).perSuccess, null)
assert.throws(() => core.cost({ ...cost, successes: 101 }))
assert.throws(() => core.cost({ ...cost, input: NaN }))
assert.throws(() => core.cost({ ...cost, tasks: 0 }))
const cache = { layers: 32, heads: 8, dimension: 128, tokens: 8192, batch: 1, bytes: 2 }
assert.equal(core.kv(cache).totalGiB, 1)
assert.equal(core.kv({ ...cache, heads: 32 }).totalGiB, 4)
assert.equal(core.kv({ ...cache, batch: 4 }).totalGiB, 4)
assert.throws(() => core.kv({ ...cache, tokens: -1 }))
const a = core.schedule([2, 7, 3, 5], 2, false)
const b = core.schedule([2, 7, 3, 5], 2, true)
assert.equal(a.makespan, 12)
assert.equal(b.makespan, 10)
assert.equal(a.tokens, 17)
assert.equal(b.tokens, 17)
assert.equal(a.meanLatency, 7.75)
assert.equal(b.meanLatency, 6)
assert.equal(core.schedule([2, 7, 3, 5], 1, true).makespan, 17)
assert.equal(core.schedule([2, 7, 3, 5], 4, true).makespan, 7)
assert.throws(() => core.schedule([], 2, true))
assert.throws(() => core.schedule([0], 2, true))
assert.throws(() => core.schedule([3], 0, true))
assert.throws(() => core.schedule([2.5], 2, true))
console.log('22 arithmetic and boundary assertions passed.')
