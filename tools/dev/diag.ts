import { getFighter } from '../../src/data/fighters';
import { makeRuleset } from '../../src/data/rulesets';
import { DIFFICULTIES } from '../../src/ai/profiles';
import { simulateAiBout } from '../../src/sim/runner';
import type { FighterDefinition } from '../../src/sim/types';

const pairs: [string,string][] = [['linus_kade','rook_maddox'],['dez_okonkwo','teo_alvarra'],['kwame_asare','linus_kade']];
for (const [ai,bi] of pairs) {
  const x = getFighter(ai), y = getFighter(bi);
  const r = simulateAiBout({ seed: 77, ruleset: makeRuleset(6,'broadcast'), venueId:'ironworks', fighters:[x,y] as [FighterDefinition,FighterDefinition] },
    { difficulty: DIFFICULTIES.contender, collectEvents: true });
  const q: Record<string, Record<string, number>> = {};
  for (const e of r.events) if (e.type==='punch_result') {
    const k = e.corner===0? x.id : y.id;
    q[k] ??= {}; q[k][e.quality] = (q[k][e.quality]??0)+1;
  }
  console.log(`\n${x.displayName}(${x.style.archetype}) vs ${y.displayName}(${y.style.archetype}) -> ${r.outcome.kind} r${r.outcome.round} winner=${r.outcome.winner}`);
  for (const k of Object.keys(q)) {
    const tot = Object.values(q[k]).reduce((s,v)=>s+v,0);
    console.log(`  ${k.padEnd(14)} n=${String(tot).padStart(4)}  ` + Object.entries(q[k]).sort().map(([kk,v])=>`${kk}:${(v/tot*100).toFixed(0)}%`).join(' '));
  }
}
