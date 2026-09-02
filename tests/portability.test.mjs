import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
test('unit tests contain no build-container absolute path',()=>{for(const f of fs.readdirSync('tests').filter(x=>x.endsWith('.mjs'))){assert.doesNotMatch(fs.readFileSync(`tests/${f}`,'utf8'),/\/mnt\/data\/WEBFORGE/);}});
test('start launcher auto-selects free ports',()=>{const s=fs.readFileSync('scripts/start.mjs','utf8');assert.match(s,/8787/);assert.match(s,/8797/);assert.match(s,/selected automatically/);});
test('doctor exists and checks browser and port',()=>{const s=fs.readFileSync('scripts/doctor.mjs','utf8');assert.match(s,/browser/);assert.match(s,/port:8787/);});
test('browser integration is not part of deterministic unit glob',()=>{assert.ok(fs.existsSync('integration/browser-qa.integration.mjs'));assert.ok(!fs.readdirSync('tests').includes('browser-qa.integration.mjs'));});
