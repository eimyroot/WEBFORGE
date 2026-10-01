import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeDomain } from '../src/core/domain-intelligence.mjs';

const classify=brief=>analyzeDomain(brief);

test('children camp medical paperwork stays education rather than healthcare',()=>{
  const domain=classify('Children summer camp with sessions, parent registration, medical forms, allergy information, payments, packing lists and photo gallery.');
  assert.equal(domain.primary.id,'education-learning');
  assert.notEqual(domain.secondary?.id,'healthcare');
});

test('cardiology language resolves to healthcare even when insurance is mentioned',()=>{
  const domain=classify('Specialist cardiology practice with cardiologists, heart diagnostics, appointment booking, patient preparation and insurance information.');
  assert.equal(domain.primary.id,'healthcare');
  assert.notEqual(domain.secondary?.id,'finance');
});

test('cardiac clinic vocabulary resolves to healthcare',()=>{
  const domain=classify('Heart clinic with cardiologist profiles, cardiac diagnostics, ECG testing, appointment booking, insurance and preparation guides.');
  assert.equal(domain.primary.id,'healthcare');
});

test('resident services portal resolves to civic government',()=>{
  const domain=classify('Resident services portal for reporting potholes, missed waste collection, permits, local notices and tracking service requests.');
  assert.equal(domain.primary.id,'civic-government');
});

test('city services website resolves to civic government without requiring the word portal',()=>{
  const domain=classify('City services website with waste collection schedules, parking permits, street issue reporting, district updates and resident forms.');
  assert.equal(domain.primary.id,'civic-government');
});

test('local council portal resolves to civic government rather than generic web application',()=>{
  const domain=classify('Local council portal for residents with permits, waste services, issue reporting, service status and public notices.');
  assert.equal(domain.primary.id,'civic-government');
});

test('explicit insurance provider remains finance despite weaker incidental insurance token',()=>{
  const domain=classify('Insurance company portal for policy quotes, claims, customer accounts, documents and broker support.');
  assert.equal(domain.primary.id,'finance');
});

test('explicit medical clinic remains healthcare despite weaker incidental medical token',()=>{
  const domain=classify('Medical clinic with specialist doctors, appointments, diagnostics, treatment information and patient preparation.');
  assert.equal(domain.primary.id,'healthcare');
});

test('generic library portal remains a web application',()=>{
  const domain=classify('Public library portal for catalog search, digital resources, room bookings, events, account services and branch information.');
  assert.equal(domain.primary.id,'web-application');
});
