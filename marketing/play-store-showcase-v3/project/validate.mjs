import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const panels=JSON.parse(fs.readFileSync(path.join(root,'project/screenshots.json'),'utf8'));
const checks=[];
function check(name,passed,detail){checks.push({name,passed,detail});}
check('eight ordered panels',panels.length===8&&panels.every((p,i)=>p.file.startsWith(String(i+1).padStart(2,'0'))),panels.map(p=>p.file));
for(const p of panels){
 const b=fs.readFileSync(path.join(root,'screenshots',p.file));
 check(p.file,b.readUInt32BE(16)===1080&&b.readUInt32BE(20)===1920&&b[24]===8&&b[25]===2,{width:b.readUInt32BE(16),height:b.readUInt32BE(20),bitDepth:b[24],colorType:b[25]});
 for(const piece of p.pieces){
  const src=fs.readFileSync(path.join(root,piece.source));
  const [x,y,w,h]=piece.crop;
  check('crop '+p.file+' '+piece.source,x>=0&&y>=0&&x+w<=src.readUInt32BE(16)&&y+h<=src.readUInt32BE(20),piece.crop);
 }
}
const report={validatedAt:new Date().toISOString(),allPassed:checks.every(c=>c.passed),provenance:'Owner-approved staged advanced-career showcases; actual app pixels, not natural-progression evidence.',checks};
fs.writeFileSync(path.join(root,'VALIDATION.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
process.exitCode=report.allPassed?0:1;
