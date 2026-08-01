/**
 * Post-fight training.
 *
 * Training is a draft, not a shop: it is awarded for showing up and winning,
 * never bought. A slate is offered, the player takes a limited number of
 * picks, and every item states exactly what it does. Diminishing returns above
 * the soft cap mean no single item is mandatory and no build reaches every
 * ceiling — which is what keeps multiple career arcs viable.
 *
 * Item names and descriptions are original to this project.
 */
import type { Rng } from '@sim/rng';
import { clamp } from '@sim/fixed';
import type { ArchetypeId, CoreRatings, FighterDefinition, SecondaryRatings } from '@sim/types';
import { CAREER_RULES, type CareerStage, type TrainingOption } from './types';

interface TrainingTemplate {
  id: string;
  /** Base core-attribute gains before diminishing returns. */
  core: Partial<CoreRatings>;
  secondary: Partial<SecondaryRatings>;
  /** Additional long-term wear. Hard work costs something. */
  wearCost: number;
  synergy: ArchetypeId | null;
  /** Relative likelihood of appearing on a slate. */
  weight: number;
}

/**
 * Nineteen items, deliberately overlapping so that slates differ meaningfully
 * without any single choice being strictly best.
 */
const CATALOGUE: readonly TrainingTemplate[] = [
  { id: 'roadwork', core: { stamina: 3, speed: 1 }, secondary: { recovery: 2 }, wearCost: 0.4, synergy: 'pressure', weight: 1.0 },
  { id: 'hill_sprints', core: { stamina: 4 }, secondary: { recovery: 1, footwork: 1 }, wearCost: 0.9, synergy: 'pressure', weight: 0.8 },
  { id: 'skip_rope', core: { speed: 2, stamina: 1 }, secondary: { footwork: 3 }, wearCost: 0.3, synergy: 'out_boxer', weight: 1.0 },
  { id: 'ladder_drills', core: { speed: 3 }, secondary: { footwork: 3 }, wearCost: 0.4, synergy: 'out_boxer', weight: 0.9 },
  { id: 'heavy_bag', core: { power: 3, stamina: 1 }, secondary: {}, wearCost: 0.7, synergy: 'brawler', weight: 1.0 },
  { id: 'medicine_ball', core: { power: 2 }, secondary: { bodyToughness: 3 }, wearCost: 0.6, synergy: 'brawler', weight: 0.9 },
  { id: 'speed_bag', core: { speed: 3 }, secondary: { accuracy: 2 }, wearCost: 0.2, synergy: 'out_boxer', weight: 1.0 },
  { id: 'double_end_bag', core: { speed: 2, defense: 1 }, secondary: { accuracy: 3 }, wearCost: 0.3, synergy: 'counterpuncher', weight: 1.0 },
  { id: 'mitt_work', core: { speed: 2 }, secondary: { accuracy: 3, composure: 1 }, wearCost: 0.4, synergy: 'boxer_puncher', weight: 1.0 },
  { id: 'slip_rope', core: { defense: 3 }, secondary: { footwork: 2 }, wearCost: 0.3, synergy: 'counterpuncher', weight: 1.0 },
  { id: 'sparring_defence', core: { defense: 4 }, secondary: { composure: 2 }, wearCost: 1.1, synergy: 'counterpuncher', weight: 0.85 },
  { id: 'sparring_volume', core: { stamina: 2, defense: 2 }, secondary: { accuracy: 2, composure: 1 }, wearCost: 1.3, synergy: null, weight: 0.8 },
  { id: 'neck_bridges', core: { defense: 1 }, secondary: { chin: 4 }, wearCost: 0.6, synergy: 'brawler', weight: 0.9 },
  { id: 'body_conditioning', core: { stamina: 1 }, secondary: { bodyToughness: 4 }, wearCost: 0.7, synergy: 'pressure', weight: 0.9 },
  { id: 'strength_block', core: { power: 4 }, secondary: { bodyToughness: 1 }, wearCost: 1.2, synergy: 'brawler', weight: 0.85 },
  { id: 'plyometrics', core: { power: 2, speed: 2 }, secondary: { footwork: 1 }, wearCost: 0.8, synergy: 'boxer_puncher', weight: 0.9 },
  { id: 'film_study', core: {}, secondary: { accuracy: 3, composure: 3 }, wearCost: 0.0, synergy: 'counterpuncher', weight: 0.75 },
  { id: 'altitude_camp', core: { stamina: 5 }, secondary: { recovery: 2 }, wearCost: 1.4, synergy: null, weight: 0.6 },
  { id: 'recovery_block', core: {}, secondary: { recovery: 4, composure: 1 }, wearCost: -1.6, synergy: null, weight: 0.7 },
];

/**
 * Diminishing returns. Below the soft cap a point is a point; above it, each
 * further point costs progressively more, and nothing crosses the hard cap.
 */
export function applyGain(current: number, raw: number, stage: CareerStage): number {
  if (raw <= 0) return clamp(current + raw, 1, CAREER_RULES.hardCap);
  // Older fighters improve more slowly; a declining one barely improves at all.
  const stageScale = stage === 'prospect' ? 1.15 : stage === 'developing' ? 1.0 : stage === 'prime' ? 0.85 : stage === 'veteran' ? 0.6 : 0.35;
  let value = current;
  let remaining = raw * stageScale;
  while (remaining > 0.01) {
    const step = Math.min(remaining, 1);
    const over = Math.max(0, value - CAREER_RULES.softCap);
    // Each point above the soft cap is worth progressively less.
    const efficiency = 1 / (1 + over * 0.35);
    value = Math.min(CAREER_RULES.hardCap, value + step * efficiency);
    remaining -= step;
  }
  return value;
}

/** Builds the slate offered after a bout. Deterministic from the career RNG. */
export function rollTrainingSlate(
  rng: Rng,
  player: FighterDefinition,
  stage: CareerStage,
  count: number,
): TrainingOption[] {
  const pool = [...CATALOGUE];
  const chosen: TrainingTemplate[] = [];

  // Weighted draw without replacement, so a slate never repeats an item.
  for (let i = 0; i < count && pool.length > 0; i++) {
    let total = 0;
    for (const t of pool) total += t.weight;
    let roll = rng.next() * total;
    let idx = 0;
    for (let j = 0; j < pool.length; j++) {
      roll -= pool[j].weight;
      if (roll <= 0) {
        idx = j;
        break;
      }
      idx = j;
    }
    chosen.push(pool[idx]);
    pool.splice(idx, 1);
  }

  return chosen.map((t) => toOption(t, player, stage));
}

/**
 * Resolves a template into the concrete gains this fighter would actually
 * receive, so the UI can show real numbers rather than promises.
 */
function toOption(t: TrainingTemplate, player: FighterDefinition, stage: CareerStage): TrainingOption {
  const gains: Partial<CoreRatings> = {};
  const secondaryGains: Partial<SecondaryRatings> = {};

  for (const [k, v] of Object.entries(t.core) as [keyof CoreRatings, number][]) {
    const before = player.ratings[k];
    const after = applyGain(before, v, stage);
    const delta = Math.round((after - before) * 10) / 10;
    if (delta !== 0) gains[k] = delta;
  }
  for (const [k, v] of Object.entries(t.secondary) as [keyof SecondaryRatings, number][]) {
    const before = player.secondary[k];
    const after = applyGain(before, v, stage);
    const delta = Math.round((after - before) * 10) / 10;
    if (delta !== 0) secondaryGains[k] = delta;
  }

  return {
    id: t.id,
    nameKey: `training.${t.id}.name`,
    descriptionKey: `training.${t.id}.desc`,
    gains,
    secondaryGains,
    wearCost: t.wearCost,
    synergy: t.synergy,
  };
}

/** Applies a chosen option to the player in place. */
export function applyTraining(player: FighterDefinition, option: TrainingOption): void {
  for (const [k, v] of Object.entries(option.gains) as [keyof CoreRatings, number][]) {
    player.ratings[k] = clamp(Math.round((player.ratings[k] + v) * 10) / 10, 1, CAREER_RULES.hardCap);
  }
  for (const [k, v] of Object.entries(option.secondaryGains) as [keyof SecondaryRatings, number][]) {
    player.secondary[k] = clamp(Math.round((player.secondary[k] + v) * 10) / 10, 1, CAREER_RULES.hardCap);
  }
}

export const TRAINING_CATALOGUE_IDS: readonly string[] = CATALOGUE.map((t) => t.id);
