import fs from 'node:fs';import path from 'node:path';
const safe=s=>String(s).replace(/[^a-z0-9]+/gi,'-').replace(/^-|-$/g,'').toLowerCase();
function botanicalArt(slot,dark,accent,mid,n){
 const variant=(n+slot.index*2)%8, stemCount=3+(variant%4), stems=[], blooms=[];
 const stemColor=dark?'#dce7d7':'#526b4b', center=dark?'#f4e6a8':'#8a6738';
 for(let i=0;i<stemCount;i++){
  const baseX=240+i*(1120/Math.max(1,stemCount-1)), drift=((n+i*71)%190)-95;
  const topX=Math.round(baseX+drift), topY=180+((n+i*113)%360), ctrlX=Math.round((baseX+topX)/2+(((n+i*37)%120)-60));
  stems.push(`<path d="M${Math.round(baseX)} 1020 Q${ctrlX} ${620+((n+i*29)%170)} ${topX} ${topY}"/>`);
  const r=64+((n+i*61)%68), petals=5+((n+i+variant)%3), rot=(n+i*31)%72, fill=(i+variant)%3===0?mid:accent;
  const petal=[...Array(petals)].map((_,j)=>`<ellipse cx="0" cy="-${(r*.58).toFixed(1)}" rx="${(r*.33).toFixed(1)}" ry="${(r*.62).toFixed(1)}" transform="rotate(${Math.round(j*360/petals)})"/>`).join('');
  blooms.push(`<g transform="translate(${topX} ${topY}) rotate(${rot})" fill="${fill}" opacity=".9">${petal}<circle r="${(r*.22).toFixed(1)}" fill="${center}"/></g>`);
 }
 for(let i=0;i<variant%3;i++){
  const x=330+((n+i*307)%940), y=410+((n+i*173)%250), r=44+((n+i*41)%32);
  blooms.push(`<g transform="translate(${x} ${y}) rotate(${(n+i*47)%90})" fill="${i%2?mid:accent}" opacity=".78">${[0,1,2,3,4].map(j=>`<ellipse cx="0" cy="-${r*.56}" rx="${r*.31}" ry="${r*.58}" transform="rotate(${j*72})"/>`).join('')}<circle r="${r*.2}" fill="${center}"/></g>`);
 }
 return `<g data-domain="florist" data-florist-variant="${variant}" fill="none" stroke="${stemColor}" stroke-width="8" opacity=".72">${stems.join('')}</g><g data-domain="florist-blooms">${blooms.join('')}</g>`;
}
function mediaMode(seed){
 const s=String(seed).toLowerCase();
 if(/digital exhibition|immersive exhibition|interactive story|virtual exhibition|web experience|installations?/.test(s)) return 'immersive';
 if(/monitoring|observability|alerts?|incidents?|uptime|latency|api health|status page/.test(s)) return 'observability';
 if(/logistics|shipments?|fleet|warehouse|dispatch|supply chain|operations dashboard|exceptions?/.test(s)) return 'operations';
 if(/fintech|digital bank|banking app|payments?|wallet|transactions?/.test(s)) return 'financial';
 if(/developer|sdk|api platform|documentation|docs|endpoint|webhook/.test(s)) return 'developer';
 if(/saas|web app|dashboard|workspace|software product/.test(s)) return 'workspace';
 return null;
}
function appArt(slot,dark,accent,mid,line,n,mode){
 const panel=dark?'#0d1219':'#f8f6f2', ink=dark?'#d9dde5':'#30333a', soft=dark?'#161d29':'#ece9e3', shift=(n+slot.index*29)%90;
 const frame=`<rect x="150" y="125" width="1300" height="750" rx="28" fill="${panel}" stroke="${line}" stroke-width="3"/><rect x="205" y="180" width="1190" height="52" rx="12" fill="${soft}"/><circle cx="245" cy="206" r="8" fill="${accent}"/><circle cx="275" cy="206" r="8" fill="${line}"/><circle cx="305" cy="206" r="8" fill="${line}"/>`;
 let body='';
 if(mode==='observability') body=`<rect x="205" y="285" width="830" height="390" rx="18" fill="${soft}"/><g fill="none" stroke="${accent}" stroke-width="8" opacity=".82"><path d="M250 560 C360 ${500-shift}, 430 ${620-shift}, 545 490 S760 360, 980 470"/><path d="M250 610 C390 570, 510 650, 640 555 S820 475, 980 520" opacity=".45"/></g><g>${[0,1,2,3].map(i=>`<circle cx="${290+i*180}" cy="${335+(i%2)*34}" r="20" fill="${i===2?accent:ink}" opacity="${i===2?.9:.3}"/>`).join('')}</g><rect x="1080" y="285" width="315" height="390" rx="18" fill="${mid}" opacity=".6"/>${[0,1,2,3].map(i=>`<rect x="1120" y="${330+i*72}" width="${210-i*18}" height="30" rx="8" fill="${i===1?accent:ink}" opacity="${i===1?.72:.18}"/>`).join('')}`;
 else if(mode==='operations') body=`<rect x="205" y="285" width="760" height="430" rx="18" fill="${soft}"/><g fill="none" stroke="${accent}" stroke-width="9" opacity=".7"><path d="M270 625 C390 420 520 590 640 380 S840 500 910 345"/><path d="M300 365 C445 455 530 330 700 530 S850 585 920 610" opacity=".4"/></g>${[[320,560],[515,455],[690,520],[865,385]].map(([x,y],i)=>`<g><circle cx="${x}" cy="${y}" r="28" fill="${i===2?accent:ink}" opacity="${i===2?.82:.28}"/><rect x="${x-58}" y="${y+44}" width="116" height="22" rx="8" fill="${ink}" opacity=".15"/></g>`).join('')}<rect x="1010" y="285" width="385" height="430" rx="18" fill="${panel}" stroke="${line}"/>${[0,1,2,3].map(i=>`<rect x="1050" y="${330+i*82}" width="305" height="58" rx="12" fill="${i===1?accent:soft}" opacity="${i===1?.24:1}"/>`).join('')}`;
 else if(mode==='financial') body=`<rect x="205" y="285" width="520" height="210" rx="18" fill="${accent}" opacity=".17"/><rect x="765" y="285" width="630" height="210" rx="18" fill="${soft}"/>${[0,1,2,3,4].map((i)=>`<rect x="${810+i*95}" y="${430-i*24}" width="54" height="${30+i*24}" rx="8" fill="${i===4?accent:ink}" opacity="${i===4?.7:.18}"/>`).join('')}<rect x="205" y="535" width="1190" height="180" rx="18" fill="${panel}" stroke="${line}"/>${[0,1,2].map(i=>`<g><circle cx="260" cy="${580+i*45}" r="11" fill="${i===0?accent:ink}" opacity=".55"/><rect x="295" y="${570+i*45}" width="${520-i*75}" height="18" rx="7" fill="${ink}" opacity=".14"/><rect x="1180" y="${570+i*45}" width="150" height="18" rx="7" fill="${ink}" opacity=".18"/></g>`).join('')}`;
 else if(mode==='developer') body=`<rect x="205" y="285" width="785" height="430" rx="18" fill="${dark?'#090d13':'#272a31'}"/>${[0,1,2,3,4,5].map(i=>`<rect x="255" y="${335+i*55}" width="${420+((i*97+shift)%220)}" height="18" rx="7" fill="${i===1||i===4?accent:'#d7dbe5'}" opacity="${i===1||i===4?.78:.3}"/>`).join('')}<rect x="1035" y="285" width="360" height="430" rx="18" fill="${soft}"/>${['GET','POST','EVENT'].map((x,i)=>`<g><rect x="1080" y="${345+i*105}" width="80" height="34" rx="9" fill="${accent}" opacity="${.25+i*.15}"/><rect x="1180" y="${352+i*105}" width="155" height="20" rx="7" fill="${ink}" opacity=".2"/></g>`).join('')}`;
 else body=`${[0,1,2].map(i=>`<rect x="${205+i*405}" y="285" width="360" height="430" rx="18" fill="${soft}" stroke="${line}"/>${[0,1,2].map(j=>`<rect x="${240+i*405}" y="${335+j*105}" width="290" height="72" rx="14" fill="${j===1&&i===1?accent:panel}" opacity="${j===1&&i===1?.24:1}"/>`).join('')}`).join('')}`;
 return `<g data-media-mode="${mode}">${frame}${body}</g>`;
}
function immersiveArt(slot,dark,accent,mid,line,n){
 const ink=dark?'#f4eff8':'#302637', variant=(n+slot.index*3)%6, dx=variant*22;
 return `<g data-media-mode="immersive"><path d="M-80 ${680-dx} C280 ${360+dx}, 520 ${790-dx}, 890 ${410+dx} S1320 ${230+dx}, 1700 ${520-dx}" fill="none" stroke="${accent}" stroke-width="9" opacity=".55"/><path d="M-120 ${760-dx} C330 ${480-dx}, 590 ${830+dx}, 960 ${480-dx} S1350 ${340-dx}, 1710 ${600+dx}" fill="none" stroke="${mid}" stroke-width="5" opacity=".5"/><g fill="${accent}" opacity=".22"><circle cx="${320+dx}" cy="${280+dx}" r="170"/><circle cx="${1060-dx}" cy="${370+dx}" r="245"/><circle cx="${1340-dx}" cy="${760-dx}" r="120"/></g><g fill="none" stroke="${line}" stroke-width="3" opacity=".7"><rect x="${180+dx}" y="160" width="430" height="560"/><rect x="${720-dx}" y="250" width="610" height="420"/><path d="M${180+dx} 720 L720 ${250+dx} M610 160 L${1330-dx} 670"/></g><circle cx="${810+dx}" cy="${520-dx}" r="42" fill="${ink}" opacity=".72"/></g>`;
}
function svg(slot,theme,seed){
 const dark=theme.mode==='dark', bg=dark?'#080a0c':'#ded8ce', mid=theme.surface2, accent=theme.accent, line=theme.line;
 const n=[...`${seed}:${slot.id}`].reduce((a,c)=>a+c.charCodeAt(0),0); const a=18+(n%42), b=55+(n%31), c=28+(n%53);
 const portrait=slot.role==='portrait'; const product=slot.role==='product-stage'; const location=slot.role==='location';
 const floral=/flower|florist|bouquet|floral|květ|kvet|kytice/i.test(String(seed)), mode=mediaMode(seed), application=['observability','operations','financial','developer','workspace'].includes(mode), immersive=mode==='immersive';
 const botanical=floral?botanicalArt(slot,dark,accent,mid,n):'', app=application?appArt(slot,dark,accent,mid,line,n,mode):'', immersiveLayer=immersive?immersiveArt(slot,dark,accent,mid,line,n):'';
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${bg}"/><stop offset=".52" stop-color="${mid}"/><stop offset="1" stop-color="${bg}"/></linearGradient><radialGradient id="r"><stop stop-color="${accent}" stop-opacity=".62"/><stop offset="1" stop-color="${accent}" stop-opacity="0"/></radialGradient><filter id="blur"><feGaussianBlur stdDeviation="34"/></filter></defs><rect width="1600" height="1000" fill="url(#g)"/><circle cx="${a}%" cy="${c}%" r="390" fill="url(#r)" filter="url(#blur)"/><circle cx="${b}%" cy="${a}%" r="260" fill="url(#r)" opacity=".32" filter="url(#blur)"/>${botanical}${app}${immersiveLayer}${product&&!floral&&!application&&!immersive?`<rect x="180" y="150" width="1240" height="700" rx="24" fill="${dark?'#0d1219':'#f8f6f2'}" stroke="${line}" stroke-width="3"/><rect x="230" y="205" width="1140" height="54" rx="10" fill="${mid}"/><rect x="230" y="310" width="310" height="470" rx="16" fill="${mid}"/><rect x="580" y="310" width="790" height="220" rx="16" fill="${accent}" opacity=".22"/><g fill="${line}">${[0,1,2].map(i=>`<rect x="580" y="${570+i*70}" width="${680-i*90}" height="34" rx="8"/>`).join('')}</g>`:''}${portrait&&!floral&&!application&&!immersive?`<ellipse cx="800" cy="430" rx="190" ry="220" fill="${dark?'#14181b':'#c8c0b5'}"/><path d="M500 1000c20-300 175-420 300-420s280 120 300 420" fill="${dark?'#111519':'#b8afa3'}"/><path d="M650 380q150-210 300 0" fill="none" stroke="${accent}" stroke-width="16" opacity=".5"/>`:''}${location&&!floral&&!application&&!immersive?`<g fill="none" stroke="${accent}" stroke-width="14" opacity=".75"><path d="M220 220L1380 760M380 100L1250 900M120 710L1480 330"/><circle cx="910" cy="500" r="70" fill="${accent}"/></g>`:''}${!floral&&!product&&!portrait&&!location&&!application&&!immersive?`<g stroke="${accent}" opacity=".5" fill="none">${[0,1,2,3,4,5].map(i=>`<path d="M0 ${700-i*75} Q ${300+i*50} ${280+i*32}, ${720+i*80} ${560-i*45} T1600 ${280+i*65}" stroke-width="${2+i}"/>`).join('')}</g><g fill="${dark?'#111315':'#c7c0b5'}">${Array.from({length:18},(_,i)=>`<circle cx="${80+(i*137)%1500}" cy="${650+(i%4)*70}" r="${22+(i%5)*8}"/>`).join('')}</g>`:''}</svg>`;
}
export function buildMediaDataUris(visual,seed='webforge'){
 const map={};
 for(const slot of visual.media.slots){const source=svg(slot,visual.artDirection.theme,seed);map[slot.id]=`data:image/svg+xml;base64,${Buffer.from(source).toString('base64')}`;}
 return map;
}
export function writeMediaAssets(projectDir,visual,seed='webforge'){
 const dir=path.join(projectDir,'assets','media');fs.mkdirSync(dir,{recursive:true});const map={};
 for(const slot of visual.media.slots){const file=`${safe(slot.section)}-${slot.index+1}.svg`;fs.writeFileSync(path.join(dir,file),svg(slot,visual.artDirection.theme,seed));map[slot.id]=`./assets/media/${file}`;}
 return map;
}
