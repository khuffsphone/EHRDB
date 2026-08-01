/**
 * The string table.
 *
 * All player-facing text lives here behind keys. English only for this
 * release, but nothing in the game hard-codes a sentence, so adding a locale is
 * a matter of supplying a second table.
 */

export const STRINGS: Record<string, string> = {
  // -- Identity ------------------------------------------------------------
  'game.title': 'TEN COUNT',
  'game.subtitle': 'Championship Boxing',
  'game.tagline': 'Twenty fights. One legacy.',

  // -- Menus ---------------------------------------------------------------
  'menu.start': 'Press Start',
  'menu.career': 'Career',
  'menu.careerNew': 'New Career',
  'menu.careerContinue': 'Continue Career',
  'menu.exhibition': 'Exhibition',
  'menu.trainingLab': 'Training Lab',
  'menu.legacy': 'Hall of Careers',
  'menu.settings': 'Settings',
  'menu.controls': 'Controls',
  'menu.credits': 'Credits',
  'menu.back': 'Back',
  'menu.quit': 'Quit to Title',
  'menu.resume': 'Resume',
  'menu.confirm': 'Confirm',
  'menu.cancel': 'Cancel',

  // -- Creation ------------------------------------------------------------
  'creation.title': 'Create Your Boxer',
  'creation.name': 'Name',
  'creation.nickname': 'Nickname',
  'creation.hometown': 'Hometown',
  'creation.stance': 'Stance',
  'creation.style': 'Style',
  'creation.appearance': 'Appearance',
  'creation.ratings': 'Ratings',
  'creation.points': 'Points remaining',
  'creation.begin': 'Begin Career',
  'creation.randomise': 'Randomise',
  'creation.error.name': 'Your boxer needs a name.',
  'creation.error.nameLong': 'That name is too long.',
  'creation.error.points': 'Spend all of your points first.',
  'creation.error.range': 'A rating is outside the legal range.',
  'creation.typeHint': 'Type to edit  ·  Enter to accept',

  'style.outBoxer.name': 'Out-Boxer',
  'style.outBoxer.desc': 'Long reach, quick feet, a jab that owns the outside. Fragile inside.',
  'style.pressure.name': 'Pressure Fighter',
  'style.pressure.desc': 'Endless engine, relentless body work. Takes punishment to give it.',
  'style.counter.name': 'Counterpuncher',
  'style.counter.desc': 'Patient and precise. Punishes commitment. Fades in a firefight.',
  'style.brawler.name': 'Brawler',
  'style.brawler.desc': 'One punch ends it. Slow feet, loose defence, granite chin.',
  'style.boxerPuncher.name': 'Boxer-Puncher',
  'style.boxerPuncher.desc': 'No glaring hole and no glaring gift. Adapts to whatever is in front of you.',

  'rating.power': 'Power',
  'rating.stamina': 'Stamina',
  'rating.speed': 'Speed',
  'rating.defense': 'Defence',
  'rating.chin': 'Chin',
  'rating.bodyToughness': 'Body',
  'rating.recovery': 'Recovery',
  'rating.footwork': 'Footwork',
  'rating.accuracy': 'Accuracy',
  'rating.composure': 'Composure',
  'stance.orthodox': 'Orthodox',
  'stance.southpaw': 'Southpaw',

  // -- Career --------------------------------------------------------------
  'career.hub': 'Camp',
  'career.rank': 'Rank',
  'career.record': 'Record',
  'career.earnings': 'Career Earnings',
  'career.stage': 'Career Stage',
  'career.boutsLeft': 'Bouts Remaining',
  'career.nextFight': 'Choose Your Next Fight',
  'career.rankings': 'Rankings',
  'career.viewRecord': 'Fight Record',
  'career.retire': 'Retire',
  'career.retireConfirm': 'Retire for good? Your career will be closed and graded.',
  'career.champion': 'CHAMPION',
  'career.unranked': 'Unranked',
  'career.news': 'Around the Division',

  'stage.prospect': 'Prospect',
  'stage.developing': 'Developing',
  'stage.prime': 'Prime',
  'stage.veteran': 'Veteran',
  'stage.declining': 'Declining',

  'opponent.select': 'Select Opponent',
  'opponent.rank': 'Rank',
  'opponent.record': 'Record',
  'opponent.style': 'Style',
  'opponent.purse': 'Purse',
  'opponent.rounds': 'Rounds',
  'opponent.titleBout': 'TITLE BOUT',
  'opponent.ifWin': 'Win',
  'opponent.ifLoss': 'Loss',
  'opponent.rankTo': 'Rank {0} → {1}',
  'opponent.rankHold': 'Rank {0} (unchanged)',
  'opponent.take': 'Take the Fight',

  'prefight.title': 'Tale of the Tape',
  'prefight.height': 'Height',
  'prefight.reach': 'Reach',
  'prefight.weight': 'Weight',
  'prefight.venue': 'Venue',
  'prefight.begin': 'To the Ring',
  'prefight.form': 'Recent Form',

  // -- Bout ----------------------------------------------------------------
  'bout.round': 'ROUND',
  'bout.roundOf': 'ROUND {0} OF {1}',
  'bout.final': 'FINAL ROUND',
  'bout.break': 'BETWEEN ROUNDS',
  'bout.knockdown': 'DOWN!',
  'bout.count': '{0}',
  'bout.getUp': 'GET UP!',
  'bout.mash': 'Press {0} repeatedly',
  'bout.hold': 'Hold {0}',
  'bout.autoRise': 'Recovering…',
  'bout.paused': 'Paused',
  'bout.padLost': 'Controller disconnected',
  'bout.padLostHint': 'Reconnect it, or press a key to continue on the keyboard.',
  'bout.composure': 'Composure',
  'bout.resilience': 'Durability',
  'bout.stamina': 'Stamina',
  'bout.head': 'Head',
  'bout.body': 'Body',
  'bout.thrown': 'Thrown',
  'bout.landed': 'Landed',
  'bout.percent': 'Pct',

  'referee.holding': 'Referee warning: holding',

  'outcome.ko.count': 'Knockout',
  'outcome.tko.threeKnockdown': 'Technical knockout — three knockdowns',
  'outcome.tko.head': 'Technical knockout — referee stoppage',
  'outcome.tko.body': 'Technical knockout — body',
  'outcome.decision.unanimous': 'Unanimous decision',
  'outcome.decision.majority': 'Majority decision',
  'outcome.decision.split': 'Split decision',
  'outcome.decision.draw': 'Draw',

  'result.winner': 'WINNER',
  'result.draw': 'DRAW',
  'result.defeat': 'DEFEAT',
  'result.scorecards': 'Scorecards',
  'result.stats': 'Punch Statistics',
  'result.purse': 'Purse',
  'result.rankChange': 'Rank',
  'result.continue': 'Continue',
  'result.rematch': 'Rematch',

  'judge.vance': 'Judge Vance',
  'judge.okonjo': 'Judge Okonjo',
  'judge.serrano': 'Judge Serrano',

  // -- Training ------------------------------------------------------------
  'training.title': 'Training Camp',
  'training.picks': 'Choices remaining: {0}',
  'training.done': 'Finish Camp',
  'training.wear': 'Wear',
  'training.synergy': 'Suits {0}',
  'training.noGain': 'No further gain',
  'training.roadwork.name': 'Roadwork',
  'training.roadwork.desc': 'Long, slow miles. The base everything else is built on.',
  'training.hill_sprints.name': 'Hill Sprints',
  'training.hill_sprints.desc': 'Brutal conditioning. Builds an engine and costs you something.',
  'training.skip_rope.name': 'Skipping',
  'training.skip_rope.desc': 'Rhythm and light feet.',
  'training.ladder_drills.name': 'Ladder Drills',
  'training.ladder_drills.desc': 'Foot speed and the ability to change direction under pressure.',
  'training.heavy_bag.name': 'Heavy Bag',
  'training.heavy_bag.desc': 'Sit down on your punches and learn to keep sitting down on them.',
  'training.medicine_ball.name': 'Medicine Ball',
  'training.medicine_ball.desc': 'Core work. Makes the body shots you take matter less.',
  'training.speed_bag.name': 'Speed Bag',
  'training.speed_bag.desc': 'Hand speed and timing.',
  'training.double_end_bag.name': 'Double-End Bag',
  'training.double_end_bag.desc': 'Accuracy against something that hits back.',
  'training.mitt_work.name': 'Mitt Work',
  'training.mitt_work.desc': 'Combinations, angles, and a trainer shouting at you.',
  'training.slip_rope.name': 'Slip Rope',
  'training.slip_rope.desc': 'Head movement drilled until it is not a decision.',
  'training.sparring_defence.name': 'Defensive Sparring',
  'training.sparring_defence.desc': 'Rounds spent not being hit. Expensive rounds.',
  'training.sparring_volume.name': 'Hard Sparring',
  'training.sparring_volume.desc': 'The most useful and most costly work there is.',
  'training.neck_bridges.name': 'Neck Work',
  'training.neck_bridges.desc': 'A neck that keeps your head where you left it.',
  'training.body_conditioning.name': 'Body Conditioning',
  'training.body_conditioning.desc': 'Learn to take it downstairs.',
  'training.strength_block.name': 'Strength Block',
  'training.strength_block.desc': 'Raw power. Heavy on the joints.',
  'training.plyometrics.name': 'Plyometrics',
  'training.plyometrics.desc': 'Explosiveness in both directions.',
  'training.film_study.name': 'Film Study',
  'training.film_study.desc': 'Free, and quietly one of the best things you can do.',
  'training.altitude_camp.name': 'Altitude Camp',
  'training.altitude_camp.desc': 'A transformed engine, at a price your body remembers.',
  'training.recovery_block.name': 'Recovery Block',
  'training.recovery_block.desc': 'Rest, treatment, and letting the damage settle.',

  // -- Challenge -----------------------------------------------------------
  'challenge.title': 'Challenge Received',
  'challenge.body': '{0} (Rank {1}) has called you out.',
  'challenge.accept': 'Accept',
  'challenge.refuse': 'Refuse',
  'challenge.refuseWarning': 'Refusing drops you to Rank {0}.',

  // -- Endings -------------------------------------------------------------
  'retirement.title': 'Career Complete',
  'ending.boutLimit': 'You reached the end of a full career.',
  'ending.lossStreak': 'The losses ended it.',
  'ending.voluntary': 'You walked away on your own terms.',
  'ending.refusedChallenge': 'You stepped aside.',
  'retirement.finalRank': 'Final Rank',
  'retirement.peakRank': 'Peak Rank',
  'retirement.grade': 'Legacy',
  'retirement.defences': 'Title Defences',
  'retirement.toLegacy': 'Enter the Hall',

  'grade.allTime': 'All-Time Great',
  'grade.great': 'Great',
  'grade.champion': 'Champion',
  'grade.contender': 'Contender',
  'grade.journeyman': 'Journeyman',
  'grade.clubFighter': 'Club Fighter',

  'legacy.title': 'Hall of Careers',
  'legacy.empty': 'No careers have been completed yet.',
  'legacy.target': 'The Standard: {0}',
  'legacy.beaten': 'RECORD BROKEN',

  // -- News ----------------------------------------------------------------
  'news.upset': '{0} upsets {1} and takes their ranking.',
  'news.retired': '{0} announces their retirement.',
  'news.titleDefence': 'You defend the title. Defence number {0}.',
  'news.refused': 'You turned down {0}. The division noticed.',
  'news.rebuild': 'Your team rebuilds you from the bottom of the rankings.',

  // -- Settings ------------------------------------------------------------
  'settings.title': 'Settings',
  'settings.audio': 'Audio',
  'settings.master': 'Master Volume',
  'settings.music': 'Music',
  'settings.sfx': 'Effects',
  'settings.crowd': 'Crowd',
  'settings.mute': 'Mute All',
  'settings.video': 'Display',
  'settings.fullscreen': 'Fullscreen',
  'settings.accessibility': 'Accessibility',
  'settings.screenShake': 'Screen Shake',
  'settings.hitFlash': 'Hit Flash',
  'settings.reducedMotion': 'Reduced Motion',
  'settings.colorSafe': 'Colour-Safe HUD',
  'settings.textScale': 'Text Size',
  'settings.holdToGuard': 'Guard',
  'settings.holdToGuard.hold': 'Hold',
  'settings.holdToGuard.toggle': 'Toggle',
  'settings.riseAssist': 'Knockdown Recovery',
  'settings.riseAssist.tap': 'Repeated Presses',
  'settings.riseAssist.hold': 'Hold Button',
  'settings.riseAssist.auto': 'Automatic',
  'settings.difficulty': 'Difficulty',
  'settings.gameplay': 'Gameplay',
  'settings.debug': 'Developer',
  'settings.showAiDebug': 'AI Intent Overlay',
  'settings.showFrameData': 'Frame & Hitbox Display',
  'settings.data': 'Save Data',
  'settings.export': 'Export Backup',
  'settings.import': 'Import Backup',
  'settings.reset': 'Erase All Data',
  'settings.resetConfirm': 'Erase every career, record and setting? This cannot be undone.',
  'settings.on': 'On',
  'settings.off': 'Off',

  'difficulty.club': 'Club',
  'difficulty.contender': 'Contender',
  'difficulty.title': 'Title',
  'difficulty.legend': 'Legend',

  // -- Controls ------------------------------------------------------------
  'controls.title': 'Controls',
  'controls.keyboard': 'Keyboard',
  'controls.gamepad': 'Gamepad',
  'controls.pressKey': 'Press a key or button…',
  'controls.reset': 'Restore Defaults',
  'controls.deadzone': 'Stick Deadzone',
  'controls.group.movement': 'Movement',
  'controls.group.punches': 'Punches',
  'controls.group.defence': 'Defence',
  'controls.group.system': 'System',
  'controls.noPad': 'No gamepad detected. Connect one to rebind it.',

  'action.up': 'Move Upstage',
  'action.down': 'Move Downstage',
  'action.left': 'Move Left',
  'action.right': 'Move Right',
  'action.jab': 'Jab',
  'action.cross': 'Cross',
  'action.leadHook': 'Lead Hook',
  'action.rearHook': 'Rear Hook',
  'action.uppercutMod': 'Uppercut (hold + hook)',
  'action.guard': 'Guard',
  'action.crouch': 'Crouch / Body',
  'action.slip': 'Slip',
  'action.clinch': 'Clinch',
  'action.confirm': 'Confirm',
  'action.cancel': 'Back',
  'action.pause': 'Pause',

  'punch.jab': 'Jab',
  'punch.cross': 'Cross',
  'punch.leadHook': 'Lead Hook',
  'punch.rearHook': 'Rear Hook',
  'punch.leadUpper': 'Lead Uppercut',
  'punch.rearUpper': 'Rear Uppercut',

  // -- Exhibition / Training Lab -------------------------------------------
  'exhibition.title': 'Exhibition',
  'exhibition.fighterA': 'Your Fighter',
  'exhibition.fighterB': 'Opponent',
  'exhibition.rounds': 'Rounds',
  'exhibition.venue': 'Venue',
  'exhibition.start': 'Fight',
  'lab.title': 'Training Lab',
  'lab.dummy': 'Sparring Partner',
  'lab.dummy.idle': 'Stands Still',
  'lab.dummy.guard': 'Guards High',
  'lab.dummy.crouch': 'Guards Low',
  'lab.dummy.counter': 'Counters',
  'lab.dummy.live': 'Fights Back',
  'lab.reset': 'Reset Positions',
  'lab.moveList': 'Move List',
  'lab.frameData': 'Frame Data',
  'lab.inputDisplay': 'Input Display',
  'lab.hitboxes': 'Hitboxes',
  'lab.startup': 'Startup',
  'lab.active': 'Active',
  'lab.recovery': 'Recovery',
  'lab.reach': 'Reach',
  'lab.hint': 'Everything here is the live simulation. Nothing is simplified.',

  // -- Venues --------------------------------------------------------------
  'venue.ironworks.name': 'The Ironworks',
  'venue.ironworks.desc': 'A converted machine shop. Two hundred people and every one of them close.',
  'venue.harbourdome.name': 'Harbour Dome',
  'venue.harbourdome.desc': 'Cold light, hard seats, and a crowd that has seen better fighters than you.',
  'venue.goldreef.name': 'Gold Reef Arena',
  'venue.goldreef.desc': 'Where the division settles its arguments.',

  // -- Fighters ------------------------------------------------------------
  'scout.rook_maddox': 'Slow and durable. He will not stop coming and he will not go down early.',
  'scout.teo_alvarra': 'Volume from the first bell. Punish the pace or drown in it.',
  'scout.linus_kade': 'Long. If you cannot get past that jab you will not touch him.',
  'scout.dez_okonkwo': 'Southpaw. Lead first and he will make you pay for it.',
  'scout.bram_holt': 'Pressure with real power behind it. He goes to the body early.',
  'scout.nikolai_vasque': 'No obvious weakness. He will find yours.',
  'scout.kwame_asare': 'One punch. That is the whole plan and it usually works.',
  'scout.silas_orrin': 'The champion. He adapts between rounds and he does not panic.',

  'archetype.out_boxer': 'Out-Boxer',
  'archetype.pressure': 'Pressure',
  'archetype.counterpuncher': 'Counterpuncher',
  'archetype.brawler': 'Brawler',
  'archetype.boxer_puncher': 'Boxer-Puncher',

  // -- Saves ---------------------------------------------------------------
  'save.notice.migrated': 'Your save was updated to the current version.',
  'save.notice.recoveredBackup': 'Your save could not be read. A backup was restored.',
  'save.notice.corrupt': 'Your save could not be read. It has been kept so you can export it.',
  'save.error.notJson': 'That file is not readable.',
  'save.error.notObject': 'That file is not a save.',
  'save.error.wrongGame': 'That save is from a different game.',
  'save.error.fromNewerVersion': 'That save is from a newer version of the game.',
  'save.error.writeFailed': 'The save could not be written.',
  'save.exported': 'Backup copied to the clipboard.',
  'save.imported': 'Backup restored.',
  'save.autosaved': 'Saved',

  // -- Credits -------------------------------------------------------------
  'credits.title': 'Credits',
  'credits.body':
    'TEN COUNT is an original game.\n\n' +
    'Design, code, art and audio generated for this project.\n' +
    'Every sprite is drawn procedurally at runtime.\n' +
    'Every sound is synthesised with the Web Audio API.\n' +
    'No third-party art, audio, text or data is included.\n\n' +
    'All fighters, venues, judges and events are fictional.\n' +
    'Any resemblance to real people or organisations is unintended.\n\n' +
    'Built with Phaser, Vite and TypeScript.\n' +
    'See docs/LEGAL_AND_ASSET_LEDGER.md for full provenance.',

  'common.wins': 'W',
  'common.losses': 'L',
  'common.draws': 'D',
  'common.kos': 'KO',
  'common.yes': 'Yes',
  'common.no': 'No',
  'common.none': 'None',
  'common.loading': 'Loading…',
};

/** Resolves a key, substituting `{0}`, `{1}` … with the supplied arguments. */
export function t(key: string, ...args: (string | number)[]): string {
  const raw = STRINGS[key];
  if (raw === undefined) {
    // A missing key is a content bug; surfacing it beats shipping blank text.
    return key;
  }
  if (args.length === 0) return raw;
  return raw.replace(/\{(\d+)\}/g, (m, i) => {
    const v = args[Number(i)];
    return v === undefined ? m : String(v);
  });
}

/** Formats a money value the way every screen should. */
export function money(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1000) return `$${Math.round(v / 1000)}k`;
  return `$${Math.round(v)}`;
}

export function record(w: number, l: number, d: number, ko?: number): string {
  const base = `${w}-${l}${d > 0 ? `-${d}` : ''}`;
  return ko === undefined ? base : `${base} (${ko} KO)`;
}
