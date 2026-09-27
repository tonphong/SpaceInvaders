# Changelog

All notable changes to Space Invaders: Polarity are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project uses [Semantic Versioning](https://semver.org/).

## [1.1.0] - 2026-09-27

### Added
- **Main menu** with Continue, New Run, Wave Select, How to Play, and Settings. It works with mouse, touch, or keyboard (arrow keys + Enter, Esc to go back).
- **Wave progress that saves.** Clearing a wave unlocks it permanently. Continue resumes at your furthest wave, and New Run always starts again from wave 1.
- **Wave Select** to replay any wave you've reached.
- **Game-over menu** with Retry (restarts the wave you lost on, not wave 1), Wave Select, and Main Menu.
- **Pause menu** with Resume, Settings, and Quit to Menu.
- **Settings:**
  - Music volume, sound-effect volume, mute, and a "duck music under effects" toggle.
  - Difficulty: Relaxed, Normal, or Intense.
  - Screen shake and screen flash toggles.
  - Touch controls: Auto, On, or Off.
  - Rebindable keyboard controls, with two keys per action. Assigning a key that another action uses moves it to the new action.
  - Reset controls, and reset wave progress (press twice to confirm).
- **Procedural synthwave soundtrack.** A calm menu theme and a driving in-game track with drums, bass, pads, an arpeggio, and a lead melody. The in-game track gets more intense as the formation gets closer. Music and effects are mixed on separate channels, and effects briefly lower the music so they always cut through.
- **App icon and web app manifest,** so the game can be added to the home screen on iPhone, iPad, and Android and launch full-screen.
- MIT license.
- This changelog.

### Changed
- Renamed to **Space Invaders: Polarity** to match the repository name.
- The classic speeding-up "march" beat now only plays when the music volume is set to 0%.
- The title screen was redesigned around the new menu. Enemy info and rules moved to How to Play.
- Settings, progress, and high score are stored under new `spaceinvaders.*` browser keys. Your v1.0.0 high score carries over.

## [1.0.0] - 2026-09-27

### Added
- First release: a neon twist on Space Invaders, built with HTML5 Canvas, with no build step and no asset files.
- **Polarity:** shots only damage enemies of your ship's color (cyan or magenta), and mismatched shots deflect off. From wave 3, the whole formation periodically shifts polarity.
- **Pendulum formation** that swings and tilts, sweeps wider as columns fall, and contracts as it descends.
- **Static field and breach line:** a descending field pushes the formation down, and an enemy crossing the breach line costs a life. Clearing a wave quickly earns a field bonus.
- **Weapon heat** in place of bunkers. Holding fire too long overheats the gun.
- **Three enemy types:** Darter (dodges shots), Warden (shielded, two hits), and Lancer (fires a telegraphed full-height beam).
- **Chain multiplier** up to ×8, broken by a missed or deflected shot.
- **Aggro targeting:** the enemy closest to you fires aimed shots.
- **Courier ship** that drops a power-up when destroyed: Spread, Aegis, or Gunner.
- Neon vector graphics: particles, screen shake, a parallax starfield, a synthwave grid, and a warp effect between waves.
- Synthesized sound effects (Web Audio).
- Keyboard controls, plus touch controls for phones and iPads in both portrait and landscape.
- High score saved in the browser.
- Ready to host on GitHub Pages.

[1.1.0]: https://github.com/tonphong/SpaceInvaders/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/tonphong/SpaceInvaders/releases/tag/v1.0.0
