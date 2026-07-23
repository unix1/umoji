# AGENTS.md

## Project

umoji is a vanilla JS SPA: search/compose emoji and sync the message into the URL path (e.g. `/🎉🔥`). No framework, no bundler — static files in `public/` served by Cloudflare Workers assets.

## Layout

| Path | Role |
|------|------|
| `public/index.html` | Shell + UI structure |
| `public/app.js` | All app logic (search, message, URL sync, clipboard) |
| `public/styles.css` | Styles; design tokens in `:root` |
| `public/emoji-data.js` | Generated/static dataset: `window.UMOJI_DATA` (`{c, w}` entries) |
| `wrangler.jsonc` | Workers assets config; `not_found_handling: single-page-application` so emoji paths hit the SPA |

## Commands

- `npm run dev` — local preview via Wrangler
- `npm run deploy` — deploy assets

## Conventions

- Keep it a plain static site. Do not add a build step, framework, or package runtime deps unless explicitly requested.
- Prefer small, focused edits in `app.js` / `styles.css` / `index.html`. Avoid rewriting the URL/message model unless the task requires it.
- URL contract: app base path + emoji-only leaf. Preserve `BASE_PATH` / history sync behavior when changing routing.
- Emoji extraction uses Unicode property escapes with fallbacks; keep paste/input paths emoji-only (strip non-emoji).
- `emoji-data.js` is large — don't reformat or hand-edit it casually; change generation/source if regenerating.
- Match existing CSS variables and layout; keep the UI compact and keyboard-friendly.
- Do not commit secrets or `.dev.vars`. Do not force-push or amend unless asked.
