import test from 'node:test'; import assert from 'node:assert/strict'; import { evaluatePolicy } from '../src/core/policy.mjs';
test('untrusted component fails closed',()=>{const p={capabilities:['qa.core'],selection:{runtime:{id:'astro'},components:[{id:'x',trust:'quarantine',runtime:['astro']}]}}; assert.equal(evaluatePolicy(p).status,'FAIL');});
test('runtime incompatibility fails closed',()=>{const p={capabilities:['qa.core'],selection:{runtime:{id:'astro'},components:[{id:'x',trust:'approved',runtime:['next']}]}}; assert.equal(evaluatePolicy(p).status,'FAIL');});
