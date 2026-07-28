# Nintendo DS Library

A personal Nintendo DS game-collection tracker. Preloaded with all 3,255 officially released DS games — just tick the ones you own, rate them, add notes and playtime.

**[Live demo](https://hexlions.github.io/ds-game-library/)**

## Features

- Full DS library preloaded (title, developer, publisher, release year, JP/NA/EU/AU region flags)
- Real box art for ~74% of games (via [libretro-thumbnails](https://github.com/libretro-thumbnails/Nintendo_-_Nintendo_DS)), generated box-style placeholder cover for the rest — every card has an image
- Tick owned games, rate, add notes/playtime/status, override cover art
- Search, filter by region / owned-only, sort
- Dark/light theme toggle
- Your collection saves to a local JSON file (via the File System Access API in Chrome/Edge) or export/import JSON (all browsers) — nothing is sent to a server

## Running it

Just open `index.html` in a browser (Chrome or Edge recommended for the file save/open feature). No build step, no dependencies.

## Publishing on GitHub Pages

1. Push this folder to a GitHub repo.
2. Repo **Settings → Pages → Build and deployment → Source**: select **Deploy from a branch**.
3. Branch: `main`, folder: `/ (root)`. Save.
4. Your site goes live at `https://<username>.github.io/<repo>/` within a minute or two.

## Data sources & credits

- Game list, developers/publishers, release dates and region availability: [Wikipedia — List of Nintendo DS games](https://en.wikipedia.org/wiki/List_of_Nintendo_DS_games) (CC BY-SA).
- Box art: [libretro-thumbnails/Nintendo_-_Nintendo_DS](https://github.com/libretro-thumbnails/Nintendo_-_Nintendo_DS), community-maintained, hotlinked via jsDelivr (no images are hosted in this repo).

## Privacy

Your collection data (owned/rating/notes/etc.) stays on your device — in a JSON file you choose, or in browser localStorage as a backup. Nothing is uploaded anywhere.
