import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
const PORT=4173, URL=`http://localhost:${PORT}/`;
const server=spawn('npx',['vite','preview','--port',String(PORT),'--strictPort'],{stdio:'ignore'});
for(let i=0;i<80;i++){ try{ if((await fetch(URL)).ok) break; }catch{ /* waiting */ } await sleep(250); }
const b=await chromium.launch({args:['--no-sandbox']});
const p=await b.newPage({viewport:{width:1280,height:720}});
await p.goto(URL,{waitUntil:'load'});
await p.waitForFunction(`Boolean(window.__TEN_COUNT__)`,undefined,{timeout:20000});
const tap=async(k:string,n=1,g=110)=>{for(let i=0;i<n;i++){await p.keyboard.down(k);await sleep(50);await p.keyboard.up(k);await sleep(g);}};
await sleep(1400); await tap('Enter'); await sleep(900);
await tap('KeyS',1,100); await tap('Enter'); await sleep(900);   // Exhibition
await tap('Enter'); await sleep(300);
const label=async()=> await p.evaluate(`window.__TEN_COUNT__.focusLabel()`);
for(let i=0;i<12;i++){ if(String(await label()).startsWith('Fight')) break; await tap('KeyS',1,80); }
await tap('Enter'); await sleep(3000);
await p.screenshot({path:'artifacts/qa/ring-check.png'});
await b.close(); server.kill('SIGTERM');
