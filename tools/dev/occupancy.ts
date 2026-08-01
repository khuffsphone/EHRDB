import { getFighter } from '../../src/data/fighters';
import { makeRuleset } from '../../src/data/rulesets';
import { DIFFICULTIES } from '../../src/ai/profiles';
import { BoutSim } from '../../src/sim/bout';
import { AiController } from '../../src/ai/controller';
import { publicView } from '../../src/sim/view';
import type { FighterDefinition, FighterCommand } from '../../src/sim/types';

for (const [ai,bi] of [['linus_kade','rook_maddox'],['dez_okonkwo','teo_alvarra']] as [string,string][]) {
  const x = getFighter(ai), y = getFighter(bi);
  const rs = makeRuleset(6,'broadcast');
  const sim = new BoutSim({ seed: 77, ruleset: rs, venueId:'ironworks', fighters:[x,y] as [FighterDefinition,FighterDefinition]});
  const ctl = [new AiController(0,x.style.archetype,DIFFICULTIES.contender,'a'), new AiController(1,y.style.archetype,DIFFICULTIES.contender,'b')];
  const occ: Record<string,number>[] = [{},{}];
  const seps: number[] = [];
  let n=0;
  while(!sim.isComplete && n<200000){
    const cmds = [ctl[0].decide(publicView(sim.state,0,rs.rounds,rs.roundTicks)), ctl[1].decide(publicView(sim.state,1,rs.rounds,rs.roundTicks))] as [FighterCommand,FighterCommand];
    if (sim.state.phase==='round_active'){
      for (const i of [0,1] as const){ const st=sim.state.fighters[i].state; occ[i][st]=(occ[i][st]??0)+1; }
      seps.push(Math.abs(sim.state.fighters[1].x - sim.state.fighters[0].x));
    }
    sim.tick(cmds); n++;
  }
  console.log(`\n${x.id} vs ${y.id}  mean|dx|=${(seps.reduce((a,b)=>a+b,0)/seps.length).toFixed(1)}`);
  for (const i of [0,1] as const){
    const tot=Object.values(occ[i]).reduce((a,b)=>a+b,0);
    const top=Object.entries(occ[i]).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`${k}:${(v/tot*100).toFixed(0)}%`).join(' ');
    console.log(`  ${(i===0?x.id:y.id).padEnd(14)} ${top}`);
  }
}
