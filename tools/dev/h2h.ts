import { getFighter } from '../../src/data/fighters';
import { makeRuleset } from '../../src/data/rulesets';
import { DIFFICULTIES } from '../../src/ai/profiles';
import { simulateAiBout } from '../../src/sim/runner';
import type { FighterDefinition } from '../../src/sim/types';

const [A,B] = [process.argv[2]??'linus_kade', process.argv[3]??'rook_maddox'];
let w=0,l=0,d=0; const sc:number[][]=[];
for (let i=0;i<20;i++){
  const swap = i%2===1;
  const x=getFighter(swap?B:A), y=getFighter(swap?A:B);
  const r = simulateAiBout({seed:500+i, ruleset:makeRuleset(6,'broadcast'), venueId:'ironworks', fighters:[x,y] as [FighterDefinition,FighterDefinition]},{difficulty:DIFFICULTIES.contender, collectEvents:true});
  const aSide = swap?1:0;
  if (r.outcome.winner===aSide) w++; else if (r.outcome.winner===null) d++; else l++;
  if (i<3){
    console.log(` seed${500+i} ${r.outcome.kind} r${r.outcome.round} winner=${r.outcome.winner===aSide?A:B}`);
    console.log(`   ${A}: thrown ${r.stats[aSide].thrown} landed ${r.stats[aSide].landed}  | ${B}: thrown ${r.stats[1-aSide].thrown} landed ${r.stats[1-aSide].landed}`);
    console.log(`   card: ${r.outcome.scorecards.map(c=>`${c.totals[aSide]}-${c.totals[1-aSide]}`).join(' ')}`);
  }
  sc.push([r.stats[aSide].landed, r.stats[1-aSide].landed]);
}
const m=(i:number)=>(sc.reduce((s,v)=>s+v[i],0)/sc.length).toFixed(1);
console.log(`\n${A} vs ${B}: ${w}W ${l}L ${d}D   mean landed ${m(0)} vs ${m(1)}`);
