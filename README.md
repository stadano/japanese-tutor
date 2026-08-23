# 読 — setup

Two deploys, both free, about five minutes total.

- **Worker** — holds your Anthropic API key and stores your progress. Without it the app still runs, but only on the four passages that ship with it.
- **Pages** — serves the app itself.

---

## 1. The Worker

Create a KV namespace and deploy:

```bash
npm install -g wrangler
wrangler login

wrangler kv namespace create YOMI        # note the id it prints
```

Create `wrangler.toml` next to `worker.js`:

```toml
name = "yomi"
main = "worker.js"
compatibility_date = "2026-01-01"

[[kv_namespaces]]
binding = "YOMI"
id = "PASTE_THE_ID_HERE"
```

Set the two secrets, then deploy:

```bash
wrangler secret put ANTHROPIC_API_KEY   # from console.anthropic.com
wrangler secret put TOKEN               # any long random string you invent
wrangler deploy
```

It prints a URL like `https://yomi.yourname.workers.dev`. Keep that and the TOKEN.

## 2. The app

This repo deploys `index.html`, `manifest.webmanifest`, and `sw.js` to GitHub Pages automatically on push to `main` (see `.github/workflows/deploy.yml`). No build step.

Any static host works equally well — Netlify drop, Cloudflare Pages, whatever you already use.

## 3. Connect

Open the app → **設定** → paste the Worker URL and TOKEN → 保存して接続を確認.

Do this once on each device. The token is the only thing linking them; same token, same progress.

## 4. Home screen

- **iPhone:** Safari → Share → Add to Home Screen
- **Mac/desktop Chrome:** address bar → install icon

It then opens like an app, full screen, no browser chrome. The service worker caches the shell, so it launches in a tunnel — passages you already have work offline; new ones and word lookups need signal.

## 5. Icon

`manifest.webmanifest` references `icon.svg` at the site root. Add your own square SVG there (any viewBox works — `purpose: "any maskable"` means iOS/Android will crop it to a circle/rounded-square, so keep the important art centered with some margin). Until it exists, the app works fine — only the home-screen icon will be a browser default.

---

## Costs

Cloudflare's free tier covers this many times over. The Anthropic usage is the only real cost: four short passages a day is a few cents a month.

## If something breaks

- **"トークンが違います"** — the TOKEN in 設定 doesn't match the Worker secret.
- **"URL に到達できません"** — check the Worker URL, no trailing slash.
- **Passages won't refresh** — 設定 → 本文を初期化 resets the text and keeps your streak.
- **Devices disagree** — 設定 → 今すぐ同期 on both. Merging is additive; nothing is lost, though two devices pushing within the same instant can still race (see below).

## Known limitations

- **Sync has no locking.** `/sync` is a plain read-merge-write; two devices pushing in the same instant can still clobber each other, though this is very unlikely with normal phone/laptop use.
- **The shared token is the only access control.** Anyone who has it can spend your Anthropic budget through `/api`. Keep it private; there's no rate limiting.
- **Dwell time has no on-screen indicator.** A passage needs ~9 seconds on screen to count toward the day; tapping 次へ before that silently doesn't credit it.

## Where your data lives

`localStorage` on each device, plus one KV entry on your own Cloudflare account. Nobody else's servers, no accounts, no telemetry.
