import { mirrorFighter } from '../../src/data/mirror';
import { makeRuleset } from '../../src/data/rulesets';
import { DIFFICULTIES } from '../../src/ai/profiles';
import { BoutSim } from '../../src/sim/bout';
import { AiController } from '../../src/ai/controller';
import { publicView } from '../../src/sim/view';
import type { FighterDefinition, FighterCommand } from '../../src/sim/types';

const x=mirrorFighter('brawler'), y=mirrorFighter('boxer_puncher');
const rs=makeRuleset(6,'broadcast');
for (const seed of [11,12]) {
  const sim=new BoutSim({seed,ruleset:rs,venueId:'ironworks',fighters:[x,y] as [FighterDefinition,FighterDefinition]});
  const ctl=[new AiController(0,'brawler',DIFFICULTIES.contender,'a'),new AiController(1,'boxer_puncher',DIFFICULTIES.contender,'b')];
  let n=0; const log:string[]=[];
  const prev=[{c:0,b:0},{c:0,b:0}];
  while(!sim.isComplete&&n<200000){
    const cmds=[ctl[0].decide(publicView(sim.state,0,rs.rounds,rs.roundTicks)),ctl[1].decide(publicView(sim.state,1,rs.rounds,rs.roundTicks))] as [FighterCommand,FighterCommand];
    for (const i of [0,1] as const){ const f=sim.state.fighters[i]; prev[i]={c:f.composure,b:f.balance}; }
    const evs=sim.tick(cmds);
    for(const e of evs) if(e.type==='knockdown'){
      const f=sim.state.fighters[e.corner];
      log.push(`  r${e.round} kd#${e.count} corner${e.corner} prevComposure=${prev[e.corner].c.toFixed(1)}/${f.resilienceMax.toFixed(0)} prevBalance=${prev[e.corner].b.toFixed(2)} res=${f.resilience.toFixed(1)}`);
    }
    n++;
  }
  console.log(`seed ${seed}: ${sim.state.outcome!.kind} r${sim.state.outcome!.round} winner=${sim.state.outcome!.winner}`);
  console.log(log.join('\n')||'  (no knockdowns)');
}
