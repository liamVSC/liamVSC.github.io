# Pop Party

A mobile-first, original character-matching puzzle game. Tap groups of two or more matching pals, create power-ups, complete collection goals, earn stars and coins, and unlock more levels.

## Play

The game is served from the `pop-party/` directory of the GitHub Pages site:

https://liamvsc.github.io/pop-party/

If GitHub Pages publishes the repository's `main` branch from the root, the folder is served automatically. No build step or backend is required.

## Controls and rules

- Tap a connected group of 2+ matching pals to pop it.
- Groups of 4+ create rockets, 5+ create bombs, and 9+ create rainbow clears.
- Tiles fall under gravity; empty spaces refill, and cascades can trigger combos.
- Complete the level's collection goals before you run out of moves.
- Wins award coins and stars, and unlock the next level.
- The map lets you replay unlocked levels. Progress is saved locally in the browser.
- Boosters, settings, and the game itself work without an account. No ads or backend are included.

## Development

Requires Node.js 20 or newer. Run the game by serving this folder over HTTP (service workers do not work from `file://`):

```sh
cd pop-party
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

Run rule tests from the repository root:

```sh
node --test pop-party/tests/*.test.cjs
```

## Publishing

The GitHub Actions workflow checks the game-core rules on pushes and pull requests. For the live site, enable GitHub Pages for the repository's `main` branch with the repository root as the publishing source. The `pop-party/` folder will then be available at `/pop-party/`.

## Current scope

- Deterministic board generation and tested group/gravity/level rules.
- Touch-first responsive UI, power-up foundation, cascading refill, local progression and PWA offline cache.
- All progress is browser-local. Clearing site data or switching devices does not sync saves.
