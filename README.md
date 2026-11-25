# Warung Rush

Run a tiny Indonesian warung: prep, cook, plate, and serve seven dishes before customers lose patience.

[![make.fun MML](https://make.fun/badges/mml-1-dark.svg)](https://make.fun)
[![make.fun TPS](https://make.fun/badges/tps-1-dark.svg)](https://make.fun)
[![make.fun WR](https://make.fun/badges/wr-1-dark.svg)](https://make.fun)

## Play locally

Use Node.js 22.18+ or 24+, which can run these TypeScript files directly. From the repository root:

```sh
node serve.ts
```

Open [http://127.0.0.1:8080](http://127.0.0.1:8080), then click **Mulai Masak**. No dependency installation is needed. The game uses local scripts and styles, inline SVG artwork, and synthesized Web Audio sounds.

## How to play

1. Read a ticket on the order board; its chips show each ingredient's preparation route.
2. Click an ingredient crate to pick up one item. Your hand holds one item at a time.
3. Click the required station to put it down: **Talenan** chops, **Wajan** stir-fries, **Panggangan** grills, and **Panci** boils. Wait until it is ready, then click the station or its finished item to pick it up. Some ingredients need two stations; plain rice can go straight to a plate.
4. Click either plate to add the prepared item. Repeat until the plate matches a waiting ticket, then click **Saji** to serve it. The oldest matching ticket is served automatically. Use the trash buttons to clear a mistaken plate or discard the item in your hand.
5. Serve before patience runs out to earn rupiah and a tip based on the customer's remaining patience. Serve again within 12 seconds to keep a combo going; every three consecutive dishes raises the payout multiplier by 0.25, up to ×2. An expired ticket or a lapsed combo timer resets the combo.

The wok and pot each hold two items; the cutting board and grill each hold one. Cook in parallel and use both plates to get ahead. Click the pause or sound button to pause or mute; switching away from the tab also pauses play.

| Key | Action |
| --- | --- |
| `1`–`8` | Pick up rice, noodles, chicken, egg, tofu, tempeh, cabbage, or chili, respectively |
| `Q` / `W` / `E` / `R` | Use the cutting board / wok / grill / pot; with an empty hand, collect a ready item |
| `A` / `S` | Add the held item to plate 1 / plate 2 |
| `Enter` | Serve the first plate that matches a waiting ticket |
| `Esc` | Pause or resume |

## Dishes and days

| Unlock | Dish | Preparation |
| --- | --- | --- |
| Day 1 | Nasi Telur Balado | Plain rice, stir-fried egg, chopped chili |
| Day 1 | Nasi Goreng | Stir-fried rice and egg, chopped chicken |
| Day 1 | Tahu Tempe Sambal | Chop then fry tempeh, fry tofu, chop chili |
| Day 2 | Mie Goreng | Boiled noodles, chopped cabbage, stir-fried egg |
| Day 2 | Gado-Gado | Boiled cabbage and egg, chopped tofu and chili |
| Day 3 | Sate Ayam | Chop then grill chicken, chop chili |
| Day 3 | Soto Ayam | Boiled chicken, noodles, and egg, chopped cabbage |

Each day lasts 100 seconds and the board holds at most four tickets. Day 1 starts with Nasi Telur Balado, a 20-second arrival interval, and 80 seconds of base patience, plus a small recipe allowance and random variation. Each later day shortens the base arrival interval by 1.5 seconds and base patience by 4 seconds, down to 3 and 20 seconds. New arrivals stop during the final 10 seconds; unfinished tickets count as missed at closing.

Unlocked dishes stay available. All seven are available from day 3 onward, and days continue with increasing pressure. The earnings target starts at Rp 80,000 and rises by Rp 30,000 per day. Earn two stars by reaching the target, or three by earning 150% of it; otherwise receive one star. You can continue after any rating.

## Upgrades

At closing, choose one free upgrade and click **Buka Hari Berikutnya**. The choice takes effect on the next day, and repeated choices stack:

| Upgrade | Effect per level |
| --- | --- |
| **Api Mantap** | Cooking speed ×1.3; station duration is divided by 1.3 |
| **Pelanggan Santai** | Patience drains 25% more slowly; drain rate ×0.75 |
| **Sambal Spesial** | Prices and tips increase 25%; payout ×1.25 |

Coins and score carry across days. Upgrades cost no coins, and the current run lives in memory; reloading starts over.

## Project layout

| Path | Purpose |
| --- | --- |
| `main.ts` | Copies `game/` and `screenshots/` into `MAKEFUN_OUTPUT_DIR` (default `/output`), checks the copied `game/index.html`, then writes the canonical dossier |
| `serve.ts` | Serves `game/` locally at `http://127.0.0.1:8080` with caching disabled |
| `vendor/makefun-game.ts` | Vendored make.fun library that validates the package and builds the dossier |
| `game/index.html` | Game shell, menus, templates, and inline SVG artwork |
| `game/style.css` | Layout, colors, and animations |
| `game/js/game.js` | Day loop, input, HUD, combos, modal panels, and upgrades |
| `game/js/recipes.js` | Ingredients, station times, seven recipes, unlocks, and dish artwork |
| `game/js/orders.js` | Ticket arrivals, recipe steps, patience, matching, and expiry |
| `game/js/kitchen.js` | Hand, station slots, preparation, plating, and serving |
| `game/js/audio.js` | Synthesized sound effects, cooking loops, and mute controls |
| `screenshots/` | PNG or JPEG game renders for the dossier; currently empty, so packaging copies the files and then stops at the dossier's missing-image check |

## License

MIT; see [LICENSE](LICENSE).
