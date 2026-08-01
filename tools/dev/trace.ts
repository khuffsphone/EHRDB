import { mirrorFighter } from '../../src/data/mirror';
import { makeRuleset } from '../../src/data/rulesets';
import { DIFFICULTIES } from '../../src/ai/profiles';
import { BoutSim } from '../../src/sim/bout';
import { AiController } from '../../src/ai/controller';
import { publicView } from '../../src/sim/view';
import { dist } from '../../src/sim/fixed';
import type { FighterDefinition, FighterCommand, ArchetypeId } from '../../src/sim/types';

const A=(process.argv[2]??'brawler') as ArchetypeId, B=(process.argv[3]??'boxer_puncher') as ArchetypeId;
const x=mirrorFighter(A), y=mirrorFighter(B);
const rs=makeRuleset(6,'broadcast');
const sim=new BoutSim({seed:11,ruleset:rs,venueId:'ironworks',fighters:[x,y] as [FighterDefinition,FighterDefinition]});
const ctl=[new AiController(0,A,DIFFICULTIES.contender,'a'),new AiController(1,B,DIFFICULTIES.contender,'b')];
let n=0; let seps:number[]=[]; let lastRound=0;
const dmg=[0,0]; const land=[0,0];
let prevC=[0,0];
while(!sim.isComplete&&n<200000){
  const cmds=[ctl[0].decide(publicView(sim.state,0,rs.rounds,rs.roundTicks)),ctl[1].decide(publicView(sim.state,1,rs.rounds,rs.roundTicks))] as [FighterCommand,FighterCommand];
  const f=sim.state.fighters;
  if(sim.state.phase==='round_active'){ seps.push(dist(f[1].x-f[0].x,f[1].z-f[0].z)); prevC=[f[0].composure,f[1].composure]; }
  const evs=sim.tick(cmds);
  for(const e of evs){
    if(e.type==='punch_result'&&(e.quality==='clean'||e.quality==='counter'||e.quality==='glancing')){
      const d=e.corner===0?1:0; dmg[e.corner]+=Math.max(0,prevC[d]-sim.state.fighters[d].composure); land[e.corner]++;
    }
    if(e.type==='round_end'){
      const avg=seps.length?seps.reduce((a,b)=>a+b,0)/seps.length:0;
      console.log(`r${e.round} meanSep=${avg.toFixed(0)}  ${A}: comp=${f[0].composure.toFixed(0)}/${f[0].resilience.toFixed(0)} exert=${f[0].exertion.toFixed(2)} dealt=${dmg[0].toFixed(0)}(${land[0]})  ${B}: comp=${f[1].composure.toFixed(0)}/${f[1].resilience.toFixed(0)} exert=${f[1].exertion.toFixed(2)} dealt=${dmg[1].toFixed(0)}(${land[1]})`);
      seps=[]; lastRound=e.round;
    }
    if(e.type==='knockdown') console.log(`   >>> KD corner${e.corner} r${e.round}`);
  }
  n++;
}
console.log(`outcome ${sim.state.outcome!.kind} r${sim.state.outcome!.round} winner=${sim.state.outcome!.winner===0?A:B} (lastRound=${lastRound})`);
