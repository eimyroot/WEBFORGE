import test from 'node:test';
import assert from 'node:assert/strict';
import {compose} from '../src/core/compose.mjs';

const choose=brief=>compose(brief).selection;

test('content-first brochure editorial and portfolio surfaces prefer Astro',()=>{
  for(const brief of [
    'Corporate consultancy with capabilities, case studies, team, insights and contact.',
    'Independent magazine with latest stories, authors, topics, archives and newsletter.',
    'Architecture studio portfolio with projects, studio profile, awards and contact.'
  ]) assert.equal(choose(brief).runtime.id,'astro');
});

test('live auth and transaction surfaces prefer Next',()=>{
  for(const brief of [
    'SaaS dashboard with authentication, accounts, billing, analytics and integrations.',
    'Ecommerce store with products, search, customer accounts, cart and checkout.',
    'Hotel website with live room availability, booking flow and customer account.'
  ]) assert.equal(choose(brief).runtime.id,'next');
});

test('explicit client-only task SPA prefers Vite React despite noisy inferred capabilities',()=>{
  const selection=choose('Single-page internal task board with drag and drop workflow, keyboard shortcuts and local client state. No login, no backend, no payments.');
  assert.equal(selection.runtime.id,'vite-react');
  assert.equal(selection.runtimeDecision.signals.clientOnly,true);
  assert.equal(selection.runtimeDecision.signals.hardDynamic,false);
});


test('SPA with backend remains server-capable even when login is explicitly absent',()=>{
  const selection=choose('Single-page SaaS dashboard with backend API and live data, no login.');
  assert.equal(selection.runtimeDecision.signals.clientOnly,false);
  assert.equal(selection.runtime.id,'next');
});

test('runtime selection exposes deterministic decision provenance',()=>{
  const selection=choose('Independent magazine with latest stories, authors, topics and newsletter.');
  assert.equal(selection.runtimeDecision.schema,'webforge.runtime-selection.v1');
  assert.equal(selection.runtimeDecision.selected,selection.runtime.id);
  assert.equal(selection.runtimeDecision.signals.contentFirst,true);
  assert.match(selection.runtime.reason,/content-first/);
});
