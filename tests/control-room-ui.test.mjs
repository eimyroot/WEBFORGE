import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const html=fs.readFileSync(new URL('../web/index.html',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../web/styles.css',import.meta.url),'utf8');
const app=fs.readFileSync(new URL('../web/app.js',import.meta.url),'utf8');

test('Control Room has unique ids and a labelled critical brief input',()=>{
  const ids=[...html.matchAll(/\sid="([^"]+)"/g)].map(x=>x[1]);
  assert.equal(new Set(ids).size,ids.length,'duplicate HTML ids');
  assert.match(html,/label for="brief"/);
  assert.match(html,/id="brief"/);
  assert.match(html,/role="status" aria-live="polite"/);
});

test('Control Room exposes the complete brief to preview journey with progressive disclosure',()=>{
  for(const id of ['journey-brief','journey-analysis','journey-preview','forge','generate','result-panel','preview-frame','technical-details','evidence-section']) assert.match(html,new RegExp(`id="${id}"`),id);
  assert.match(html,/sandbox="allow-scripts allow-forms allow-popups"/);
  assert.match(app,/preview-frame/);
  assert.match(app,/scrollIntoView/);
  assert.match(app,/\.preset/);
});

test('Control Room CSS has explicit reflow and overflow defenses for narrow screens',()=>{
  assert.match(css,/overflow-x:hidden/);
  assert.match(css,/min-width:0/);
  assert.match(css,/@media\(max-width:640px\)/);
  assert.match(css,/grid-template-columns:1fr/);
  assert.match(css,/overflow-wrap:anywhere/);
});
