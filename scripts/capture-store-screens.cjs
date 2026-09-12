// Real-device capture helper. Never generates or modifies screenshot pixels.
const {execFileSync} = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const adb = '/Users/divakarmishra/Library/Android/sdk/platform-tools/adb';
const out = path.resolve('output/play-store/captures-20260912');
fs.mkdirSync(out, {recursive:true});
function run(...args) { return execFileSync(adb, ['-s','emulator-5554',...args], {encoding:'utf8'}); }
const [action,...args] = process.argv.slice(2);
if (action === 'tap') run('shell','input','tap',...args);
if (action === 'back') run('shell','input','keyevent','4');
if (action === 'swipe') run('shell','input','swipe',...args,'450');
if (action === 'shot') {
  if (!/^[a-z0-9-]+$/.test(args[0])) throw Error('Invalid capture name');
  run('shell','screencap','-p','/sdcard/store-capture.png');
  run('pull','/sdcard/store-capture.png',path.join(out,args[0]+'.png'));
  console.log(path.join(out,args[0]+'.png'));
} else {
  run('shell','uiautomator','dump','/sdcard/store-window.xml');
  const xml=run('shell','cat','/sdcard/store-window.xml');
  for(const node of xml.matchAll(/<node\b[^>]+>/g)) {
    const attrs=Object.fromEntries([...node[0].matchAll(/([\w-]+)="([^"]*)"/g)].map(m=>[m[1],m[2]]));
    if(attrs.text || attrs['content-desc']) console.log((attrs.text || attrs['content-desc'])+' '+attrs.bounds+(attrs.enabled==='false'?' DISABLED':''));
  }
}
