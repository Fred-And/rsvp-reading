# CLAUDE.md — RSVP Reader

## What this is

Svelte 5 + Vite SPA. No backend, no router. Pure client-side speed reading tool using Rapid Serial Visual Presentation (RSVP). Deployed as static files behind nginx (Docker) or via DigitalOcean App Platform (`do-app.yaml`). PWA-ready (`public/manifest.json`, `public/sw.js`).

## Dev commands

```bash
npm run dev          # Vite dev server with HMR
npm run build        # Production build → dist/
npm run preview      # Preview production build locally
npm test             # Vitest in watch mode
npm run test:run     # Tests once (CI)
npm run test:coverage
```

## Architecture

```
App.svelte              ← orchestrator, owns all state
├── RSVPDisplay.svelte  ← renders word with ORP highlight; supports multi-word frame + RTL
├── Controls.svelte     ← play/pause/stop/restart buttons
├── Settings.svelte     ← all knobs (WPM, fade, pauses, frame size, word-length multiplier)
├── TextInput.svelte    ← paste text or upload PDF/EPUB
└── ProgressBar.svelte  ← clickable seek bar

src/lib/
├── rsvp-utils.js       ← pure functions: parseText, getORPIndex, getWordDelay, extractWordFrame
├── file-parsers.js     ← parsePDF (pdfjs-dist, worker via unpkg CDN), parseEPUB (epubjs)
└── progress-storage.js ← localStorage CRUD under key 'rsvp-reading-session'
```

## Key algorithms

**ORP index** (`rsvp-utils.js:getORPIndex`):
- ≤3 letters → index 0
- 4–5 → 1, 6–9 → 2, 10–12 → 3, 12+ → `floor(log2(len-1))+1`
- Strips non-letter chars before counting; `getActualORPIndex` skips leading punctuation

**Word delay** (`getWordDelay`):
- Base = `60000 / wpm` ms
- Long words (≥12 chars): multiply by `1 + (wordLengthWPMMultiplier/100 * (len-12))`
- Sentence-end punctuation `.!?;:` → `× punctuationMultiplier`
- Comma → `× 1.5`

**Multi-word frame** (`extractWordFrame`):
- Slices `words[centerIdx ± floor(frameSize/2)]`
- Returns `{subset, centerOffset}` so RSVPDisplay can highlight correct word
- `frameWordCount` is always odd (1,3,5,7) — settings slider enforces `step=2`

## State flow

`App.svelte` owns: `words[]`, `currentWordIndex`, `isPlaying`, `isPaused`, all settings. Everything passes down via props; child events bubble up via Svelte `dispatch`. No store is used — all reactive state lives in App.

**Playback loop**: `start()` → `showNextWord()` → `scheduleNextWord()` → `setTimeout(showNextWord, delay)`. Single `intervalId` ref. `stop()` calls `clearTimeout`.

**Focus mode**: `isFocusMode = isPlaying || isPaused`. Hides header + shortcuts; shows minimal controls.

## Settings defaults

| Setting | Default |
|---|---|
| wordsPerMinute | 300 |
| fadeEnabled | true |
| fadeDuration | 150ms |
| pauseOnPunctuation | true |
| punctuationPauseMultiplier | 2× |
| wordLengthWPMMultiplier | 5% |
| pauseAfterWords | 0 (off) |
| pauseDuration | 500ms |
| frameWordCount | 1 |

## PDF worker note

`file-parsers.js` sets `pdfjsLib.GlobalWorkerOptions.workerSrc` to unpkg CDN at runtime. Needs internet access for PDF parsing. Could be bundled locally instead.

## Testing

Vitest + jsdom + `@testing-library/svelte`. Tests live in `src/tests/`. Cover `rsvp-utils`, `file-parsers`, `progress-storage`. No component integration tests yet.

## Docker

```bash
cd docker && docker compose up -d        # build + serve on :8080
docker compose up -d --build             # rebuild after changes
```

`docker/nginx.conf` serves the `dist/` static build.
