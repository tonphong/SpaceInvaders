# Space Invaders: Polarity

A neon twist on the arcade classic, built with plain HTML5 Canvas and JavaScript. No build step, no dependencies, no asset files: graphics, music, and sound are all generated in code. It runs on PC, mobile, and iPad and is hosted on GitHub Pages.

**Version:** 1.1.0

## Play

- **Online:** https://tonphong.github.io/SpaceInvaders/
- **Locally:** the game uses ES modules, so serve the folder instead of opening the file directly:
  ```sh
  python3 -m http.server 8000
  # then open http://localhost:8000
  ```

### Add to home screen

The game has an app icon and a web app manifest, so it can be installed and launched full-screen like an app:

- **iPhone / iPad (Safari):** tap **Share → Add to Home Screen**.
- **Android (Chrome):** open the **⋮** menu, then tap **Add to Home screen** (or **Install app**).

See [CHANGELOG.md](CHANGELOG.md) for release history.

## Menus & progress

- **Continue** picks up at the furthest wave you've reached. **New Run** always starts again from wave 1.
- **Wave Select** lets you replay any wave you've already reached.
- Clearing a wave unlocks the next one for good, and progress is saved in your browser. Losing doesn't send you back to wave 1: **Retry** restarts the wave you were on.
- Every run starts with 3 lives and a score of 0. Your high score is saved separately.
- The pause menu has Resume, Settings, and Quit to Menu. The game-over screen has Retry, Wave Select, and Main Menu.
- On desktop you can use the menus with the mouse or the keyboard (arrow keys + Enter, Esc to go back).

## Settings

| Setting | What it does |
| --- | --- |
| Music volume | Soundtrack level (0% turns the music off and brings back the classic speeding-up "march" beat) |
| Sound effects | Volume of all game sounds |
| Duck music under effects | Music dips briefly whenever an important sound plays, so effects always cut through |
| Mute everything | Master mute (also on the mute key and the ♫ touch button) |
| Difficulty | Relaxed / Normal / Intense: changes field speed, enemy fire rate, and lancer frequency (applies from the next wave) |
| Screen shake / flashes | Turn camera shake and full-screen flashes on or off |
| Touch controls | Auto (show on touch screens), always On, or Off |
| Keyboard | Rebind every action (two keys each). Click a slot and press a key. Esc cancels, Backspace clears |
| Reset | Restore default controls, or reset wave progress (press twice to confirm) |

## Default controls

| Action | Keyboard | Touch (phone / iPad) |
| --- | --- | --- |
| Move | `←` `→` or `A` `D` | Drag the **DRAG** pad (or drag on the playfield) |
| Fire | `Space` / `Z` (hold) | Hold **FIRE** |
| Swap polarity | `X` / `Left Shift` | Tap **SWAP** |
| Pause | `P` / `Esc` | **❚❚** button |
| Mute | `M` | **♫** button |

You can change all keyboard controls in **Settings**.

## Mechanics

1. **Polarity (signature mechanic).** Every enemy is either cyan (round core) or magenta (diamond core). Your shots only damage enemies that match your ship's current polarity. Mismatched shots deflect off harmlessly. From wave 3 on, the whole formation periodically **shifts polarity**, with a warning about a second before each shift.
2. **Pendulum formation.** The formation swings and tilts like a pendulum instead of marching. As columns are destroyed the swing gets wider, and the formation slowly contracts as it descends.
3. **Static field and breach line.** A crackling static field descends from the top and pushes the formation down. If an enemy crosses the red **breach line** you lose a life and the formation is pushed back up. Clear a wave quickly for a bigger **field bonus**.
4. **Weapon heat instead of bunkers.** Each shot adds heat. Hold fire too long and the gun overheats, locking until it cools.
5. **Enemy tiers:** **Darter (20)** sidesteps shots, **Warden (40)** has a shield and takes two hits, and **Lancer (60)** charges a telegraphed full-height laser beam.
6. **Chain multiplier.** Kills within 2.4 s build a chain, and every 4 kills raises the multiplier (up to ×8). A miss or deflection breaks it.
7. **Aggro targeting.** The enemy closest to you (red ring) jitters harder and fires aimed shots.
8. **Courier drone drops.** Destroy the gold Courier (3 hits, any polarity) and catch its capsule for a 12 s power-up: **Spread**, **Aegis** (shield bubble), or **Gunner** (auto-firing drone).

You earn an extra life every 15,000 points (max 6).

## Graphics & audio

- Neon vector sprites are pre-rendered to offscreen canvases, so frames stay fast on phones.
- Other effects: parallax starfield, synthwave grid, particle explosions, glow trails, and a warp transition between waves.
- **Procedural synthwave soundtrack** in A minor. A calm menu theme plays in the menus, and a driving in-game track has drums, bass, pads, an arpeggio, and a lead melody. The in-game track gets more intense (brighter synths, busier drums) as the formation gets closer.
- Music and sound effects run on separate mixer buses. Effects duck the music automatically, and a compressor keeps the overall mix clean.

## Deploying to GitHub Pages

1. Go to **Settings → Pages** in this repository.
2. Under **Build and deployment**, set **Source** to *Deploy from a branch*, pick `main` and `/ (root)`, then save.
3. After a minute the game is live at `https://tonphong.github.io/SpaceInvaders/`.

The `.nojekyll` file tells Pages to serve the files as they are.

## Project structure

```
index.html        page shell, menu panels, touch controls
manifest.webmanifest  home-screen / install metadata
icons/            app icon (SVG source + rendered PNGs)
css/style.css     layout, menus, responsive touch controls
js/game.js        game loop, mechanics, rendering, game flow
js/ui.js          menus: main, wave select, how to play, settings, pause, game over
js/settings.js    saved settings, keybinds, wave progress, high score
js/input.js       keyboard (rebindable) + multi-touch input
js/audio.js       audio mixer (music / SFX buses, ducking) + sound effects
js/music.js       procedural soundtrack sequencer
js/sprites.js     neon vector sprite generation + palette
```

## License

[MIT](LICENSE) © 2026 tonphong
