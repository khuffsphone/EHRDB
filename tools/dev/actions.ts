import { getFighter } from '../../src/data/fighters';
import { makeRuleset } from '../../src/data/rulesets';
import { DIFFICULTIES } from '../../src/ai/profiles';
import { BoutSim } from '../../src/sim/bout';
import { AiController } from '../../src/ai/controller';
import { publicView } from '../../src/sim/view';
import { dist } from '../../src/sim/fixed';
import type { FighterDefinition, FighterCommand } from '../../src/sim/types';

const x=getFighter('linus_kade'), y=getFighter('rook_maddox');
const rs=makeRuleset(6,'broadcast');
const sim=new BoutSim({seed:500,ruleset:rs,venueId:'ironworks',fighters:[x,y] as [FighterDefinition,FighterDefinition]});
const ctl=[new AiController(0,x.style.archetype,DIFFICULTIES.contender,'a'),new AiController(1,y.style.archetype,DIFFICULTIES.contender,'b')];
const acts:Record<string,number>[]=[{},{}]; const seps:number[]=[]; const dzs:number[]=[];
const last=['',''];
let n=0;
while(!sim.isComplete&&n<200000){
  const cmds=[ctl[0].decide(publicView(sim.state,0,rs.rounds,rs.roundTicks)),ctl[1].decide(publicView(sim.state,1,rs.rounds,rs.roundTicks))] as [FighterCommand,FighterCommand];
  if(sim.state.phase==='round_active'){
    for(const i of [0,1] as const){
      const a=ctl[i].debugInfo.action;
      if(a!==last[i]){ acts[i][a]=(acts[i][a]??0)+1; last[i]=a; }
    }
    const f=sim.state.fighters;
    seps.push(dist(f[1].x-f[0].x,f[1].z-f[0].z)); dzs.push(Math.abs(f[1].z-f[0].z));
  }
  sim.tick(cmds); n++;
}
const avg=(a:number[])=>(a.reduce((s,v)=>s+v,0)/a.length).toFixed(1);
console.log(`mean sep=${avg(seps)}  mean|dz|=${avg(dzs)}`);
for(const i of [0,1] as const){
  const tot=Object.values(acts[i]).reduce((a,b)=>a+b,0);
  console.log(`\n${i===0?x.id:y.id} — ${tot} decisions`);
  console.log('  '+Object.entries(acts[i]).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([k,v])=>`${k}:${(v/tot*100).toFixed(0)}%`).join('  '));
}
