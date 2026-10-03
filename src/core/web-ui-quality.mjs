import fs from 'node:fs';
import path from 'node:path';
import { runBrowserQa } from './browser-qa.mjs';
import { WEB_UI_VIEWPORTS } from './web-ui-contract.mjs';

const REQUIRED_CHECKS=['browser-qa','accessibility','responsive-overflow','performance'];

function summarizeViewport(viewport,receipt){
  const checks=receipt?.checks||[];
  const byId=new Map(checks.map(check=>[check.id,check]));
  const required=REQUIRED_CHECKS.map(id=>({id,status:byId.get(id)?.status||'UNVERIFIED'}));
  const status=required.some(x=>x.status==='FAIL')?'FAIL':required.every(x=>x.status==='PASS')?'PASS':'UNVERIFIED';
  const browser=byId.get('browser-qa')?.detail||{};
  const accessibility=byId.get('accessibility')?.detail||{};
  const performance=byId.get('performance')?.detail||{};
  return {
    viewport,
    status,
    required,
    signals:{
      layout:{
        narrow_text_blocks:Array.isArray(browser.narrowTextBlocks)?browser.narrowTextBlocks:[],
        overflow_elements:Array.isArray(browser.overflowElements)?browser.overflowElements:[]
      },
      accessibility:{
        missing_alt:Number(accessibility.missingAlt||0),
        unlabelled_fields:Number(accessibility.unlabelledFields||0),
        h1:Number(accessibility.h1||0),
        main:Number(accessibility.main||0),
        lang:accessibility.lang||null
      },
      performance:{
        render_ms:Number(performance.renderMs||0),
        html_bytes:Number(performance.htmlBytes||0),
        css_bytes:Number(performance.cssBytes||0),
        budgets:performance.budgets||null
      }
    },
    screenshot:receipt?.screenshot?.current||null,
    source_schema:receipt?.schema||null
  };
}

export function evaluateWebUiQualityMatrix(viewports){
  const status=viewports.some(x=>x.status==='FAIL')?'FAIL':viewports.every(x=>x.status==='PASS')?'PASS':'UNVERIFIED';
  return {
    schema:'webforge.web-ui-quality-receipt.v1',
    status,
    policy:'project-native Chromium QA remains execution authority',
    viewports,
    checks:{
      required_viewports:WEB_UI_VIEWPORTS.map(x=>x.id),
      visual_reference:'not required by this pilot; use project-native regression or reviewed reference when available',
      human_review_required:true,
      release_gate_changed:false
    },
    truth_boundary:{
      automated_accessibility:'heuristic engineering evidence, not legal WCAG conformance',
      performance:'local browser render budget, not field Core Web Vitals',
      production_authority:'NONE'
    }
  };
}

export async function runWebUiQualityMatrix(projectDir,{qaRunner=runBrowserQa,writeReceipt=true,visualRegression=false}={}){
  const results=[];
  for(const viewport of WEB_UI_VIEWPORTS){
    const receipt=await qaRunner(projectDir,{
      baseline:false,
      visualRegression,
      evidenceKey:`web-ui-${viewport.id}`,
      viewport:{width:viewport.width,height:viewport.height,mobile:viewport.mobile}
    });
    results.push(summarizeViewport(viewport,receipt));
  }
  const aggregate=evaluateWebUiQualityMatrix(results);
  if(writeReceipt){
    fs.writeFileSync(path.join(projectDir,'web-ui-quality.receipt.json'),JSON.stringify(aggregate,null,2)+'\n');
  }
  return aggregate;
}
