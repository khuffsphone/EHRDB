/**
 * Shared services.
 *
 * One context object owns the save store, the audio engine, the input manager
 * and the transient state that passes between scenes. Scenes reach it through
 * the Phaser registry rather than importing a global, so a scene can be tested
 * with a stub context.
 */
import type Phaser from 'phaser';
import { AudioEngine } from '@audio/engine';
import { InputManager } from '@input/manager';
import { SaveStore } from '@save/storage';
import type { Settings } from '@save/schema';
import type { CareerState } from '@career/types';
import type { BoutConfig, BoutOutcome, FighterDefinition } from '@sim/types';
import type { BoutOffer } from '@career/career';
import { setTextScale } from '@ui/kit';

export const CTX_KEY = 'tencount.ctx';

/** What the bout scene needs to run, and what it hands back. */
export interface BoutRequest {
  config: BoutConfig;
  /** Career context, absent for exhibition and lab bouts. */
  offer: BoutOffer | null;
  /** Which corner the player controls. */
  playerCorner: 0 | 1;
  /** Scene to return to when the bout resolves. */
  returnScene: string;
  /** Set by the bout scene on completion. */
  outcome?: BoutOutcome;
  /** Punch statistics, filled in on completion. */
  stats?: [{ thrown: number; landed: number; percent: number }, { thrown: number; landed: number; percent: number }];
  label?: string;
}

export class GameContext {
  readonly save: SaveStore;
  readonly audio: AudioEngine;
  readonly input: InputManager;

  /** The career currently being played, if any. */
  career: CareerState | null = null;
  /** The bout the bout scene should run next. */
  pendingBout: BoutRequest | null = null;
  /** Opponent chosen on the select screen, awaiting the pre-fight screen. */
  pendingOpponentId: string | null = null;
  /** A transient message shown at the top of the next screen. */
  notice: string | null = null;
  /** Exhibition selections, kept between visits to the setup screen. */
  exhibition: { aId: string; bId: string; rounds: 3 | 6 | 10; venueId: string } = {
    aId: 'linus_kade',
    bId: 'bram_holt',
    rounds: 3,
    venueId: 'ironworks',
  };
  /** Custom fighter used by the lab and exhibition when the player has one. */
  lastCreated: FighterDefinition | null = null;

  constructor() {
    this.save = new SaveStore();
    this.audio = new AudioEngine(this.save.data.settings.audio);
    this.input = new InputManager(this.save.data.settings.keyboard, this.save.data.settings.gamepad);
    this.career = this.save.data.career;
    setTextScale(this.save.data.settings.accessibility.textScale);
  }

  get settings(): Settings {
    return this.save.data.settings;
  }

  /** Applies settings everywhere they have an effect and persists them. */
  applySettings(): void {
    const s = this.settings;
    this.audio.applySettings(s.audio);
    setTextScale(s.accessibility.textScale);
    s.keyboard = this.input.bindings.keyboard;
    s.gamepad = this.input.bindings.gamepad;
    this.persist();
  }

  /** Writes the save. Timestamps come from here, never from the simulation. */
  persist(): boolean {
    this.save.data.career = this.career;
    this.save.data.settings = this.settings;
    return this.save.write(new Date().toISOString());
  }
}

export function getContext(scene: Phaser.Scene): GameContext {
  const ctx = scene.registry.get(CTX_KEY) as GameContext | undefined;
  if (!ctx) throw new Error('GameContext missing from the scene registry');
  return ctx;
}
