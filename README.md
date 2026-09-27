# Space Invader: Polarity

A neon twist on the arcade classic, built with plain HTML5 Canvas and JavaScript. No build step, no dependencies, no asset files. It runs on PC, mobile, and iPad and is hosted on GitHub Pages.

**Version:** 1.0.0

## Play

- **Online:** `https://tonphong.github.io/SpaceInvader/` (after enabling GitHub Pages, see below)
- **Locally:** the game uses ES modules, so serve the folder instead of opening the file directly:
  ```sh
  python3 -m http.server 8000
  # then open http://localhost:8000
  ```

## Controls

| Action | Keyboard | Touch (phone / iPad) |
| --- | --- | --- |
| Move | `←` `→` or `A` `D` | Drag the **DRAG** pad (or drag on the playfield) |
| Fire | `Space` / `Z` (hold) | Hold **FIRE** |
| Swap polarity | `X` / `Shift` / `↓` | Tap **SWAP** |
| Pause | `P` / `Esc` | **❚❚** button |
| Mute | `M` | **♫** button |
| Start / retry | `Enter` | Tap anywhere |

Touch controls show up automatically on touch devices. In portrait they sit below the playfield. In landscape they sit in the side margins.

## Mechanics

What's different from the original Space Invaders:

1. **Polarity (signature mechanic).** Every enemy is either cyan (round core) or magenta (diamond core). Your shots only damage enemies that match your ship's current polarity. Mismatched shots deflect off harmlessly. Swap polarity at any time. From wave 3 on, the whole formation periodically **shifts polarity**. The enemies flicker and a warning shows about a second before each shift.
2. **Pendulum formation.** Instead of marching sideways and stepping down, the formation swings like a pendulum and tilts as it swings. As columns are destroyed the swing gets wider, and the formation slowly contracts as it descends.
3. **Static field and breach line.** A crackling static field descends from the top and pushes the formation down, so it works as a visible timer. If any enemy crosses the red **breach line** you lose a life and the formation is pushed back up. Clearing a wave quickly earns a **field bonus**.
4. **Weapon heat instead of bunkers.** There are no shields to hide behind. Each shot adds heat, and holding fire too long overheats the gun, locking it until it fully cools.
5. **Enemy tiers with distinct behaviors:**
   - **Darter (20):** front rows, erratic, sidesteps incoming shots.
   - **Warden (40):** middle rows, protected by a hex shield, so it takes two hits.
   - **Lancer (60):** back row, charges a telegraphed laser beam (dashed red line), then fires a full-height beam.
6. **Chain multiplier.** Kills within 2.4 s of each other build a chain, and every 4 kills raises the multiplier (up to ×8). A missed or deflected shot breaks the chain.
7. **Aggro targeting.** The enemy closest to you is marked with a red ring. It jitters harder and fires aimed shots, so taking it out first is usually smart.
8. **Courier drone drops.** A gold Courier crosses the top of the screen (3 hits, any polarity damages it). Destroying it drops a capsule you can catch for a 12 s drone power-up:
   - **S – Spread:** two extra angled shots per trigger pull, with no extra heat.
   - **A – Aegis:** a shield bubble that blocks enemy bullets and absorbs one lancer beam.
   - **G – Gunner:** a companion drone that auto-fires neutral shots at the aggro enemy.

Other rules: you start with 3 lives and earn an extra life every 15,000 points (max 6). Getting hit clears enemy bullets on screen and ends your power-up. Your high score is saved in the browser.

## Graphics & audio

- Neon vector sprites are drawn in code and pre-rendered to offscreen canvases, so frames stay fast on phones.
- Other effects: parallax starfield, synthwave grid, particle explosions, screen shake, glow trails, and a warp-speed transition between waves.
- Sound effects are synthesized with the Web Audio API. The "march" beat speeds up as the formation gets closer.
- Rendering stays crisp on high-DPI (Retina) screens.

## Deploying to GitHub Pages

1. Merge this branch into your default branch (e.g. `main`).
2. On GitHub, go to **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to *Deploy from a branch*, pick `main` and `/ (root)`, then save.
4. After a minute the game is live at `https://<username>.github.io/SpaceInvader/`.

The `.nojekyll` file tells Pages to serve the files as they are.

## Project structure

```
index.html        page shell + touch controls
css/style.css     layout, responsive touch controls
js/game.js        game loop, mechanics, rendering, screens
js/sprites.js     neon vector sprite generation + palette
js/input.js       keyboard + multi-touch input
js/audio.js       synthesized sound effects
```
