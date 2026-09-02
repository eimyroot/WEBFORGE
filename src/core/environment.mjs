import net from 'node:net';
import {discoverChromium} from './browser-qa.mjs';
export function environmentSnapshot(){const browser=discoverChromium();return {platform:process.platform,arch:process.arch,node:process.version,browser:{status:browser?'PASS':'UNVERIFIED',path:browser},capabilities:{browserQa:!!browser,runtimeForge:true,templateSynthesis:true,governedDeploy:true,visualComposition:true,mediaIntelligence:true,contentBinding:true,responsiveRendering:true}}}
