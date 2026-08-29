# 健康 — Google Health in Claude

Your Google Health data (Fitbit / Pixel Watch, whatever feeds the app) pulled nightly
into a database you own, and exposed to Claude as an MCP connector. Once it's up you
can ask about your sleep, resting heart rate or training load from Claude on any
device, the same way you'd ask about a file.

Two deploys' worth of effort, most of it one-time console clicking.

---

## Why it syncs instead of proxying

Google expires refresh tokens after **7 days** for OAuth apps still in "Testing"
status, and the health scopes are restricted enough that leaving Testing means
going through app verification. A server that called Google live would therefore
break every week and take your history with it.

So it doesn't. A nightly cron copies the last few days into D1 and keeps them.
When the token does expire, the sync pauses and every question you can ask still
works — you re-authorize in about thirty seconds and the feed resumes. Nothing is
lost, and queries are instant besides.

---

## 1. Google Cloud

1. Create a project at [console.cloud.google.com](https://console.cloud.google.com).
2. **APIs & Services → Library →** enable **Google Health API**.
3. **OAuth consent screen →** External. Fill in app name, your email, and a
   privacy-policy link (your GitHub Pages URL is fine for a personal app).
4. Add these scopes:

   ```
   .../auth/googlehealth.activity_and_fitness.readonly
   .../auth/googlehealth.sleep.readonly
   .../auth/googlehealth.health_metrics_and_measurements.readonly
   .../auth/googlehealth.profile.readonly
   ```

5. Add your own Google account under **Test users**. This is the account the
   Google Health app uses.
6. **Credentials → Create credentials → OAuth client ID → Desktop app.** Note the
   client ID and secret.

## 2. Get a refresh token

On your own machine, not in a cloud session — it needs a browser:

```bash
node authorize.mjs <client-id> <client-secret>
```

It opens Google, you approve, and it prints a refresh token.

## 3. Deploy

```bash
wrangler d1 create kenkou            # note the id it prints
cp wrangler.example.toml wrangler.toml   # paste the id in, set HOME_TZ
wrangler d1 execute kenkou --remote --file=schema.sql

wrangler secret put GOOGLE_CLIENT_ID
wrangler secret put GOOGLE_CLIENT_SECRET
wrangler secret put GOOGLE_REFRESH_TOKEN
wrangler secret put MCP_TOKEN         # any long random string you invent

wrangler deploy
```

It prints a URL like `https://kenkou.yourname.workers.dev`.

## 4. Backfill

The cron only pulls the last three days. Grab your history once:

```bash
curl "https://kenkou.yourname.workers.dev/sync/YOUR_MCP_TOKEN?days=365"
```

Expect this to take a minute and to report a few errors for data types your
devices don't produce — that's fine, each type fails independently. The API caps
ranges at 90 days (14 for the heart-rate family); the worker chunks around that
for you.

## 5. Connect it to Claude

**claude.ai → Settings → Connectors → Add custom connector**, with:

```
https://kenkou.yourname.workers.dev/mcp/YOUR_MCP_TOKEN
```

That's it. The connector is then available in Claude on web, desktop, mobile, and
in Claude Code.

The token sits in the URL because a custom connector gives you nowhere else to put
it. It's the same bargain as `../worker.js`: not Fort Knox, but the URL is
unguessable and the data only moves if someone has it. Treat that URL like a
password. `Authorization: Bearer` works too, for anything scripted.

## 6. When it stops (day 7)

The sync starts failing with `invalid_grant`. Re-run step 2, then:

```bash
wrangler secret put GOOGLE_REFRESH_TOKEN
```

Stored data is untouched throughout. If the weekly ritual grates, publishing the
OAuth app to "In production" removes the expiry — that path runs through Google's
verification review, which is a real process for restricted health scopes but a
one-time one.

---

## What Claude can ask

| Tool | For |
|---|---|
| `health_daily` | Day-by-day metrics over a range |
| `health_sleep` | Sleep sessions with stage breakdown and efficiency |
| `health_workouts` | Logged exercise — type, duration, calories, distance, average HR |
| `health_trend` | One metric aggregated by day, week or month |
| `health_status` | Coverage, row counts, last sync — check here when data looks missing |
| `health_sync` | Pull now, or backfill with a bigger `days` |

Metric names in the `daily` table: `steps`, `distance_m`, `floors`,
`calories_kcal`, `azm`, `hr_avg`, `resting_hr`, `hrv_ms`, `spo2_pct`, `vo2_max`,
`weight_kg`, `sleep_minutes`.

A night's sleep is filed under the date you woke up.

---

## Tests

No dependencies, no build — the suites stub Google's API and run the worker
against an in-memory SQLite database:

```bash
node test/mcp.test.mjs     # protocol, auth, and every tool's queries
node test/sync.test.mjs    # unit conversions, rollup chunking, idempotency
```

---

## Notes

- Built against the Google Health API v4 discovery document, revision 20260826.
- Recent days are re-pulled on every run and upserted. Watches backfill late, so
  yesterday's numbers keep moving for a while; re-syncing is cheap and makes that
  a non-problem.
- Your health data passes through this Worker and into Anthropic's API when you
  ask about it. Worth deciding on purposefully rather than by default.
