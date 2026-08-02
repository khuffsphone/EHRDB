/**
 * Entry point.
 *
 * A fixed 640x360 internal resolution scaled to fit the window with
 * letterboxing, so the game is crisp at integer multiples and correct at every
 * other size. Pixel art stays sharp because smoothing is disabled.
 */
import Phaser from 'phaser';
import { VIEW, debugFocusedLabel } from '@ui/kit';
import { BootScene, TitleScene, MainMenuScene, CreditsScene, LegacyScene } from '@scenes/CoreScenes';
import { CreationScene } from '@scenes/CreationScene';
import {
  CareerHubScene,
  RankingsScene,
  OpponentSelectScene,
  PreFightScene,
  ResultScene,
  TrainingScene,
  ChallengeScene,
  RetirementScene,
} from '@scenes/CareerScenes';
import { BoutScene } from '@scenes/BoutScene';
import { SettingsScene, ControlsScene } from '@scenes/SettingsScenes';
import { ExhibitionScene, LabScene } from '@scenes/PracticeScenes';
import { BUILD, type BuildInfo } from '@util/build-info';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#05070b',
  width: VIEW.width,
  height: VIEW.height,
  pixelArt: true,
  roundPixels: true,
  antialias: false,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: VIEW.width,
    height: VIEW.height,
  },
  fps: {
    target: 60,
    // The simulation runs on its own fixed-step accumulator, so a slow frame
    // is caught up rather than slowing the fight down.
    smoothStep: false,
  },
  disableContextMenu: true,
  scene: [
    BootScene,
    TitleScene,
    MainMenuScene,
    CreationScene,
    CareerHubScene,
    RankingsScene,
    OpponentSelectScene,
    PreFightScene,
    BoutScene,
    ResultScene,
    TrainingScene,
    ChallengeScene,
    RetirementScene,
    LegacyScene,
    ExhibitionScene,
    LabScene,
    SettingsScene,
    ControlsScene,
    CreditsScene,
  ],
};

// Exposed for the browser smoke test to drive the game deterministically.
declare global {
  interface Window {
    __TEN_COUNT__?: {
      game: Phaser.Game;
      errors: string[];
      activeScenes(): string[];
      focusLabel(): string | null;
      /** Which source produced this bundle. See src/util/build-info.ts. */
      build: BuildInfo;
    };
  }
}

const errors: string[] = [];
window.addEventListener('error', (e) => errors.push(String(e.message)));
window.addEventListener('unhandledrejection', (e) => errors.push(String(e.reason)));

const game = new Phaser.Game(config);
window.__TEN_COUNT__ = {
  game,
  errors,
  // Read-only introspection for the browser smoke test. It observes; it never
  // drives the game, which is still driven entirely by real input events.
  activeScenes: () => game.scene.getScenes(true).map((s) => s.scene.key),
  focusLabel: () => debugFocusedLabel(),
  // The full build identity, reachable from the console and from the QA
  // harness. A bug report can name the exact bytes it came from, and the
  // release audit can confirm the shipped bundle agrees with the manifest
  // written beside it.
  build: BUILD,
};
