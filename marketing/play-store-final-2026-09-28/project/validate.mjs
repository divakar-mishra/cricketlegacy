// Run from any folder: node /path/to/project/validate.mjs
// Checks deterministic export requirements; visual/provenance review is separate.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const checks=[];
function check(name,passed,detail){checks.push({name,passed,detail});}
function png(relative,w,h){
 const b=fs.readFileSync(path.join(root,relative));
 const width=b.readUInt32BE(16),height=b.readUInt32BE(20),bitDepth=b[24],colorType=b[25];
 check(relative,width===w&&height===h&&bitDepth===8&&colorType===2,{width,height,bitDepth,colorType,bytes:b.length});
}
const panels=JSON.parse(fs.readFileSync(path.join(root,'project/screenshots.json'),'utf8'));
check('eight panels',panels.length===8,panels.length);
check('ordered filenames',panels.every((p,i)=>p.file.startsWith(String(i+1).padStart(2,'0'))),panels.map(p=>p.file));
for (const panel of panels) {
 png('screenshots/'+panel.file,1080,1920);
 check('safe source '+panel.file,panel.pieces.every(p=>!/(rigged|newspaper|qa-only|99-qa)/i.test(p.source)),panel.pieces.map(p=>p.source));
 check('caption boundaries '+panel.file,panel.pieces.every(p=>p.rect[0]>=0&&p.rect[1]>=350&&p.rect[0]+p.rect[2]<=1080&&p.rect[1]+p.rect[3]<=1842),panel.pieces.map(p=>p.rect));
}
png('store-assets/feature-graphic-1024x500.png',1024,500);
png('CONTACT_SHEET.png',1440,1380);
const listing=fs.readFileSync(path.join(root,'PLAY_STORE_LISTING.md'),'utf8');
const fields=[...listing.matchAll(/```text\n([\s\S]*?)\n```/g)].map(m=>m[1]);
check('title exact',fields[0]==='Cricket: Player and Manager',fields[0]);
for (const [i,max] of [30,80,4000].entries())check(['title length','short description length','full description length'][i],fields[i].length<=max,{characters:fields[i].length,max});
const report={validatedAt:new Date().toISOString(),allPassed:checks.every(c=>c.passed),checks};
fs.writeFileSync(path.join(root,'VALIDATION.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
process.exitCode=report.allPassed?0:1;
