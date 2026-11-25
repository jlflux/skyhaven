# Skyhaven

A cozy city builder on a floating island, built with Three.js. Lay roads, build homes and workplaces, attract settlers, finish quests for coins, and raise new land out of the clouds until your hamlet becomes a Sky Capital.

## Play on your phone

1. Deploy the repo (see below) and open the URL on your phone.
2. Add it to your home screen:
   - **iPhone (Safari):** Share → Add to Home Screen.
   - **Android (Chrome):** menu → Add to Home screen / Install app.
3. It opens full screen like an app. After the first load it also works offline.

Your island saves automatically on the device (browser storage), so a save on your phone stays on your phone.

## How it plays

- **Roads:** every building must touch a road connected to the town hall, or it stays closed (red marker).
- **Settlers** move in when there are free homes, open jobs and happiness of at least 45%. Workers pay more tax than the unemployed.
- **Food:** farms feed settlers. If food runs short, happiness drops and growth stops. Windmills next to farms add 50%.
- **Happiness:** gardens, wells, taverns and the temple raise appeal for nearby homes; workshops lower it.
- **Expand:** buy glowing slots around the edge to raise new land. New tiles can bring forest, boulders, ponds or rare crystal veins (the only place a Crystal Mine can go).
- **Quests and petitions:** the quest board pays coins; families occasionally ask for a garden or market near their home.
- **Ranks:** Hamlet → Village (20) → Town (60) → City (150) → Sky Capital (300), each unlocking new buildings.

### Time

- One in-game day lasts about **5 minutes** at normal speed (2× and 3× are available).
- Coins come in every in-game hour; settlers arrive every 3 hours.
- Time **only moves while you're playing**: it pauses when you switch apps or tabs, when the window loses focus, or after 2 minutes without input.
- Use the **skip button** (next to the speed controls) to jump ahead 12 or 24 hours. Quests that need time, like reaching a settler count, have their own "Skip 12h" button.

### Controls

| Action | Mouse / keyboard | Touch |
| --- | --- | --- |
| Pan | Drag (Inspect tool) or right-drag (build tools) | Drag (Inspect) or two fingers |
| Zoom | Scroll | Pinch |
| Turn the island | Q / E or the turn buttons | Turn buttons |
| Build | Pick a card, click a tile (1–9 select cards) | Pick a card, tap a tile |
| Road / Clear / Expand | R / C / X | Tool buttons |
| Pause | Space | Pause button |

## Develop

```bash
npm install
npm run dev      # local dev server
npm run build    # production build in dist/
npm run preview  # serve the production build
```

The whole game lives in `src/main.js` (Three.js scene, simulation, UI wiring); styles and markup are in `index.html`.

## Deploy on Vercel

Import the repo in Vercel. It detects Vite automatically: build command `npm run build`, output directory `dist`. Every push to `main` redeploys.
