# PRD — RSVP Reader (Fork Roadmap)

## What it is

Browser-based speed reader. Text (or PDF/EPUB) is displayed one word at a time at a fixed focal point with the Optimal Recognition Point (ORP) letter highlighted in red. Eliminates saccades (eye scanning) to increase reading speed. No backend, no account needed — all state in localStorage.

## Current feature set (upstream)

| Area | Details |
|---|---|
| Input | Paste text, upload PDF or EPUB |
| Display | Single-word or multi-word frame (1/3/5/7 words), ORP red highlight, monospace font, RTL support |
| Speed | 50–1000 WPM slider + presets (200/300/400/500), word-length-based slowdown |
| Pacing | Punctuation pause (configurable multiplier), periodic pause every N words |
| Effects | Word fade (50–300ms) |
| Navigation | Progress bar (clickable seek), jump-to (word # or %), keyboard shortcuts |
| Persistence | localStorage save/resume session (text + position + all settings) |
| UX | Focus mode hides chrome while reading, mobile touch controls, PWA manifest |
| Deployment | Docker/nginx, DigitalOcean App Platform config |

## What's missing / potential additions

### High value for personal use

**Reading list / library**
- Save multiple texts by title, not just one active session
- IndexedDB instead of localStorage (handles large books)
- Resume from any saved title on return

**Article import**
- URL input → server-side or Readability.js fetch-and-parse
- Browser extension / bookmarklet to send current tab's article text

**Comprehension aids**
- Chunk mode: group by phrase/clause instead of individual word
- Paragraph boundary pause: longer stop at end of paragraph
- Re-read last N words shortcut

**Statistics / progress**
- WPM tracking over sessions (actual vs. set)
- Words read today / this week
- Per-book progress percentage with time-to-finish estimate

**Text formatting awareness**
- Strip markdown/HTML before display
- Detect and skip page numbers, headers, footnote markers from PDFs

**Customization**
- Font size control (currently fixed `clamp(3rem, 8vw, 6rem)`)
- Font family picker (some users prefer serif for comprehension)
- ORP highlight color picker (red may not work for color-blind users)
- Light/sepia theme option

**Accessibility**
- `prefers-reduced-motion` respects fade setting
- Screen reader mode: announce word count and progress

### Lower priority / stretch

- Cloud sync (reading position across devices)
- Shared reading mode (two people at same pace)
- Text-to-speech fallback for hard words
- Browser extension for in-page RSVP selection

## Technical constraints

- No backend today — keep features client-only unless there's a clear reason to add a server
- PDF worker sourced from unpkg CDN; large PDF files may be slow — investigate bundling worker locally
- Svelte 5 (rune-based reactivity may be worth migrating to for cleaner state management)
- All settings/state currently in `App.svelte` — as features grow, consider Svelte stores

## Non-goals (keep upstream's philosophy)

- No ads, no telemetry, no account wall
- No "social" features
- No gamification / streaks
