/**
 * 健康 — backend.
 *
 * Three jobs:
 *   cron          → pulls the last few days from the Google Health API into D1
 *   GET  /sync    → the same pull, on demand, with an optional backfill window
 *   POST /mcp/... → an MCP server, so Claude can query the store from anywhere
 *
 * Built against the Google Health API v4 discovery document (rev. 20260826).
 * Same shape as ../worker.js: one file, secrets server-side, deploy and forget.
 */

const API = "https://health.googleapis.com/v4";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization,MCP-Protocol-Version",
  "Access-Control-Max-Age": "86400",
};

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

// ---------------------------------------------------------------- civil dates

const tz = (env) => env.HOME_TZ || "UTC";

/** Today where the user actually is, not where the datacenter is. */
function todayIn(zone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
  return parts; // en-CA formats as YYYY-MM-DD
}

const addDays = (ymd, n) => {
  const d = new Date(ymd + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

const toCivil = (ymd) => {
  const [year, month, day] = ymd.split("-").map(Number);
  return { date: { year, month, day } };
};

const fromDate = (d) =>
  d ? `${d.year}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}` : null;

const num = (v) => (v === undefined || v === null || v === "" ? null : Number(v));

// ------------------------------------------------------------------- Google auth

/**
 * Access tokens last an hour; refresh tokens last 7 days while the OAuth app sits
 * in "Testing". We cache the former in D1 and let the latter fail loudly.
 */
async function accessToken(env) {
  const cached = await env.DB.prepare("SELECT value FROM meta WHERE key='access_token'").first();
  if (cached) {
    const { token, expires } = JSON.parse(cached.value);
    if (Date.now() < expires - 60_000) return token;
  }

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      refresh_token: env.GOOGLE_REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
  });
  const body = await res.json();

  if (!res.ok) {
    // invalid_grant here almost always means the 7-day testing-mode expiry bit.
    const hint = body.error === "invalid_grant"
      ? " — refresh token expired or revoked; run `node authorize.mjs` again and update the secret"
      : "";
    throw new Error(`token refresh failed: ${body.error || res.status}${hint}`);
  }

  const value = JSON.stringify({
    token: body.access_token,
    expires: Date.now() + (body.expires_in ?? 3600) * 1000,
  });
  await env.DB.prepare(
    "INSERT INTO meta (key,value) VALUES ('access_token',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value"
  ).bind(value).run();

  return body.access_token;
}

async function gh(env, path, { method = "GET", body, params } = {}) {
  const url = new URL(API + path);
  for (const [k, v] of Object.entries(params || {})) if (v != null) url.searchParams.set(k, v);

  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${await accessToken(env)}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : {};
}

/** Walks every page of a list-shaped endpoint so callers don't have to. */
async function listAll(env, dataType, filter, pageSize = 1000) {
  const out = [];
  let pageToken;
  do {
    const page = await gh(env, `/users/me/dataTypes/${dataType}/dataPoints`, {
      params: { filter, pageSize, pageToken },
    });
    out.push(...(page.dataPoints || []));
    pageToken = page.nextPageToken || undefined;
  } while (pageToken && out.length < 20_000);
  return out;
}

// ---------------------------------------------------------------- what we pull

/**
 * Daily rollups. `maxDays` is the API's own cap on the range per call — 14 days
 * for the heart-rate family, 90 for everything else.
 */
const ROLLUPS = [
  { type: "steps", maxDays: 90, rows: (v) => [["steps", num(v.steps?.countSum), "count"]] },
  { type: "distance", maxDays: 90, rows: (v) => [["distance_m", num(v.distance?.millimetersSum) / 1000, "m"]] },
  { type: "floors", maxDays: 90, rows: (v) => [["floors", num(v.floors?.countSum), "count"]] },
  { type: "total-calories", maxDays: 14, rows: (v) => [["calories_kcal", num(v.totalCalories?.kcalSum), "kcal"]] },
  {
    type: "active-zone-minutes", maxDays: 90,
    rows: (v) => {
      const z = v.activeZoneMinutes;
      if (!z) return [];
      const total = (num(z.sumInFatBurnHeartZone) || 0) + (num(z.sumInCardioHeartZone) || 0) + (num(z.sumInPeakHeartZone) || 0);
      return [["azm", total, "min", { fatBurn: num(z.sumInFatBurnHeartZone), cardio: num(z.sumInCardioHeartZone), peak: num(z.sumInPeakHeartZone) }]];
    },
  },
  {
    type: "heart-rate", maxDays: 14,
    rows: (v) => {
      const h = v.heartRate;
      if (!h) return [];
      return [["hr_avg", h.beatsPerMinuteAvg, "bpm", { min: h.beatsPerMinuteMin, max: h.beatsPerMinuteMax }]];
    },
  },
];

/** Daily-summary data types, which are plain list calls filtered on `.date`. */
const DAILIES = [
  {
    type: "daily-resting-heart-rate", field: "daily_resting_heart_rate",
    row: (dp) => {
      const d = dp.dailyRestingHeartRate;
      return d && ["resting_hr", num(d.beatsPerMinute), "bpm", fromDate(d.date)];
    },
  },
  {
    type: "daily-heart-rate-variability", field: "daily_heart_rate_variability",
    row: (dp) => {
      const d = dp.dailyHeartRateVariability;
      return d && ["hrv_ms", d.averageHeartRateVariabilityMilliseconds, "ms", fromDate(d.date),
        { deepRmssd: d.deepSleepRootMeanSquareOfSuccessiveDifferencesMilliseconds, entropy: d.entropy }];
    },
  },
  {
    type: "daily-oxygen-saturation", field: "daily_oxygen_saturation",
    row: (dp) => {
      const d = dp.dailyOxygenSaturation;
      return d && ["spo2_pct", d.averagePercentage, "%", fromDate(d.date),
        { lower: d.lowerBoundPercentage, upper: d.upperBoundPercentage }];
    },
  },
  {
    type: "daily-vo2-max", field: "daily_vo2_max",
    row: (dp) => {
      const d = dp.dailyVo2Max;
      return d && ["vo2_max", d.vo2Max, "ml/kg/min", fromDate(d.date), { level: d.cardioFitnessLevel, estimated: d.estimated }];
    },
  },
];

// -------------------------------------------------------------------- the sync

const upsertDaily = (env) =>
  env.DB.prepare(
    `INSERT INTO daily (date,metric,value,unit,extra,synced_at) VALUES (?,?,?,?,?,?)
     ON CONFLICT(date,metric) DO UPDATE SET
       value=excluded.value, unit=excluded.unit, extra=excluded.extra, synced_at=excluded.synced_at`
  );

async function syncRollups(env, from, to, stats) {
  const now = new Date().toISOString();
  for (const spec of ROLLUPS) {
    // Chop the window into chunks the API will actually accept.
    for (let s = from; s < to; s = addDays(s, spec.maxDays)) {
      const e = addDays(s, spec.maxDays) < to ? addDays(s, spec.maxDays) : to;
      let res;
      try {
        res = await gh(env, `/users/me/dataTypes/${spec.type}/dataPoints:dailyRollUp`, {
          method: "POST",
          body: { range: { start: toCivil(s), end: toCivil(e) }, windowSizeDays: 1 },
        });
      } catch (err) {
        stats.errors.push(`${spec.type}: ${err.message}`);
        continue;
      }

      const stmts = [];
      for (const point of res.rollupDataPoints || []) {
        const date = fromDate(point.civilStartTime?.date);
        if (!date) continue;
        for (const [metric, value, unit, extra] of spec.rows(point)) {
          if (value === null || value === undefined || Number.isNaN(value)) continue;
          stmts.push(upsertDaily(env).bind(date, metric, value, unit, extra ? JSON.stringify(extra) : null, now));
          stats.daily++;
        }
      }
      if (stmts.length) await env.DB.batch(stmts);
    }
  }
}

async function syncDailies(env, from, to, stats) {
  const now = new Date().toISOString();
  for (const spec of DAILIES) {
    let points;
    try {
      points = await listAll(env, spec.type, `${spec.field}.date >= "${from}" AND ${spec.field}.date < "${to}"`);
    } catch (err) {
      stats.errors.push(`${spec.type}: ${err.message}`);
      continue;
    }

    const stmts = [];
    for (const dp of points) {
      const row = spec.row(dp);
      if (!row) continue;
      const [metric, value, unit, date, extra] = row;
      if (!date || value === null || value === undefined) continue;
      stmts.push(upsertDaily(env).bind(date, metric, num(value), unit, extra ? JSON.stringify(extra) : null, now));
      stats.daily++;
    }
    if (stmts.length) await env.DB.batch(stmts);
  }
}

async function syncWeight(env, from, to, stats) {
  const now = new Date().toISOString();
  let points;
  try {
    points = await listAll(env, "weight", `weight.sample_time.civil_time >= "${from}" AND weight.sample_time.civil_time < "${to}"`);
  } catch (err) {
    stats.errors.push(`weight: ${err.message}`);
    return;
  }

  // More than one weigh-in a day is common; the last one wins.
  const stmts = [];
  for (const dp of points) {
    const w = dp.weight;
    const date = fromDate(w?.sampleTime?.civilTime?.date);
    if (!w || !date) continue;
    stmts.push(upsertDaily(env).bind(date, "weight_kg", num(w.weightGrams) / 1000, "kg", null, now));
    stats.daily++;
  }
  if (stmts.length) await env.DB.batch(stmts);
}

async function syncSleep(env, from, to, stats) {
  const now = new Date().toISOString();
  let points;
  try {
    // A night is filed under the morning you woke up, which is what civil_end_time gives us.
    points = await listAll(env, "sleep", `sleep.interval.civil_end_time >= "${from}" AND sleep.interval.civil_end_time < "${to}"`, 200);
  } catch (err) {
    stats.errors.push(`sleep: ${err.message}`);
    return;
  }

  const stmts = [];
  for (const dp of points) {
    const s = dp.sleep;
    if (!s) continue;
    const date = fromDate(s.interval?.civilEndTime?.date);
    if (!date) continue;

    const stage = (type) =>
      num((s.summary?.stagesSummary || []).find((x) => x.type === type)?.minutes);
    const asleep = num(s.summary?.minutesAsleep);
    const inPeriod = num(s.summary?.minutesInSleepPeriod);

    stmts.push(
      env.DB.prepare(
        `INSERT INTO sleep (id,date,start_time,end_time,minutes_asleep,minutes_in_period,minutes_awake,
           minutes_to_fall_asleep,efficiency,deep_minutes,rem_minutes,light_minutes,is_main_sleep,raw,synced_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
         ON CONFLICT(id) DO UPDATE SET
           date=excluded.date, minutes_asleep=excluded.minutes_asleep, minutes_in_period=excluded.minutes_in_period,
           minutes_awake=excluded.minutes_awake, minutes_to_fall_asleep=excluded.minutes_to_fall_asleep,
           efficiency=excluded.efficiency, deep_minutes=excluded.deep_minutes, rem_minutes=excluded.rem_minutes,
           light_minutes=excluded.light_minutes, raw=excluded.raw, synced_at=excluded.synced_at`
      ).bind(
        dp.name || `${date}:${s.interval?.startTime}`,
        date,
        s.interval?.startTime || null,
        s.interval?.endTime || null,
        asleep, inPeriod,
        num(s.summary?.minutesAwake),
        num(s.summary?.minutesToFallAsleep),
        asleep && inPeriod ? Math.round((asleep / inPeriod) * 1000) / 10 : null,
        stage("DEEP"), stage("REM"), stage("LIGHT"),
        s.metadata?.mainSleep ? 1 : 0,
        JSON.stringify(s),
        now
      )
    );
    stats.sleep++;

    // Mirror the headline number into `daily` so one query can span everything.
    if (asleep !== null && s.metadata?.mainSleep !== false) {
      stmts.push(upsertDaily(env).bind(date, "sleep_minutes", asleep, "min", null, now));
    }
  }
  if (stmts.length) await env.DB.batch(stmts);
}

async function syncExercise(env, from, to, stats) {
  const now = new Date().toISOString();
  let points;
  try {
    points = await listAll(env, "exercise", `exercise.interval.civil_start_time >= "${from}" AND exercise.interval.civil_start_time < "${to}"`, 200);
  } catch (err) {
    stats.errors.push(`exercise: ${err.message}`);
    return;
  }

  const stmts = [];
  for (const dp of points) {
    const x = dp.exercise;
    if (!x) continue;
    const date = fromDate(x.interval?.civilStartTime?.date);
    if (!date) continue;

    const m = x.metricsSummary || {};
    const mins = (iso) => {
      // Durations arrive as protobuf strings like "3600s".
      const n = num(String(iso ?? "").replace(/s$/, ""));
      return n === null ? null : n / 60;
    };
    const duration = x.interval?.startTime && x.interval?.endTime
      ? (Date.parse(x.interval.endTime) - Date.parse(x.interval.startTime)) / 60000
      : null;

    stmts.push(
      env.DB.prepare(
        `INSERT INTO exercise (id,date,start_time,end_time,type,display_name,duration_min,active_min,
           calories_kcal,distance_m,steps,avg_hr,azm,raw,synced_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
         ON CONFLICT(id) DO UPDATE SET
           duration_min=excluded.duration_min, active_min=excluded.active_min, calories_kcal=excluded.calories_kcal,
           distance_m=excluded.distance_m, steps=excluded.steps, avg_hr=excluded.avg_hr, azm=excluded.azm,
           raw=excluded.raw, synced_at=excluded.synced_at`
      ).bind(
        dp.name || `${date}:${x.interval?.startTime}`,
        date,
        x.interval?.startTime || null,
        x.interval?.endTime || null,
        x.exerciseType || null,
        x.displayName || null,
        duration,
        mins(x.activeDuration),
        m.caloriesKcal ?? null,
        m.distanceMillimeters != null ? m.distanceMillimeters / 1000 : null,
        num(m.steps),
        num(m.averageHeartRateBeatsPerMinute),
        num(m.activeZoneMinutes),
        JSON.stringify(x),
        now
      )
    );
    stats.exercise++;
  }
  if (stmts.length) await env.DB.batch(stmts);
}

/**
 * `days` back from today, inclusive. Re-syncing recent days on every run is
 * deliberate: watches backfill late, and upserts make it free.
 */
async function syncAll(env, days = 3) {
  const to = addDays(todayIn(tz(env)), 1); // exclusive end, so today counts
  const from = addDays(to, -Math.max(1, days));
  const stats = { from, to, daily: 0, sleep: 0, exercise: 0, errors: [] };

  await syncRollups(env, from, to, stats);
  await syncDailies(env, from, to, stats);
  await syncWeight(env, from, to, stats);
  await syncSleep(env, from, to, stats);
  await syncExercise(env, from, to, stats);

  await env.DB.prepare(
    "INSERT INTO meta (key,value) VALUES ('last_sync',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value"
  ).bind(JSON.stringify({ at: new Date().toISOString(), ...stats })).run();

  return stats;
}

// ------------------------------------------------------------------ MCP server

const TOOLS = [
  {
    name: "health_daily",
    description:
      "Daily health metrics for a date range: steps, distance_m, floors, calories_kcal, azm, hr_avg, resting_hr, hrv_ms, spo2_pct, vo2_max, weight_kg, sleep_minutes. Returns one row per day with the requested metrics as columns.",
    inputSchema: {
      type: "object",
      properties: {
        start: { type: "string", description: "Start date, YYYY-MM-DD (inclusive)." },
        end: { type: "string", description: "End date, YYYY-MM-DD (inclusive). Defaults to today." },
        metrics: { type: "array", items: { type: "string" }, description: "Metric names to include. Omit for all." },
      },
      required: ["start"],
    },
  },
  {
    name: "health_sleep",
    description: "Sleep sessions for a date range, with stage breakdown and efficiency. A night is filed under the date you woke up.",
    inputSchema: {
      type: "object",
      properties: {
        start: { type: "string", description: "Start date, YYYY-MM-DD (inclusive)." },
        end: { type: "string", description: "End date, YYYY-MM-DD (inclusive). Defaults to today." },
      },
      required: ["start"],
    },
  },
  {
    name: "health_workouts",
    description: "Logged exercise sessions for a date range: type, duration, calories, distance, average heart rate.",
    inputSchema: {
      type: "object",
      properties: {
        start: { type: "string", description: "Start date, YYYY-MM-DD (inclusive)." },
        end: { type: "string", description: "End date, YYYY-MM-DD (inclusive). Defaults to today." },
        type: { type: "string", description: "Optional exercise-type substring filter, e.g. 'RUN'." },
      },
      required: ["start"],
    },
  },
  {
    name: "health_trend",
    description: "Aggregate one metric over time — average, min, max and count per bucket. Use this for questions about trends rather than pulling every day.",
    inputSchema: {
      type: "object",
      properties: {
        metric: { type: "string", description: "Metric name, e.g. 'resting_hr' or 'sleep_minutes'." },
        start: { type: "string", description: "Start date, YYYY-MM-DD (inclusive)." },
        end: { type: "string", description: "End date, YYYY-MM-DD (inclusive). Defaults to today." },
        bucket: { type: "string", enum: ["day", "week", "month"], description: "Grouping. Defaults to week." },
      },
      required: ["metric", "start"],
    },
  },
  {
    name: "health_status",
    description: "What the store knows: date coverage, row counts per metric, and when the last sync ran. Check here first if data looks missing.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "health_sync",
    description: "Pull fresh data from Google now. Use after a gap, or to backfill history with a larger `days` value.",
    inputSchema: {
      type: "object",
      properties: { days: { type: "integer", description: "How many days back to re-pull. Default 3, max 400." } },
    },
  },
];

const text = (s) => ({ content: [{ type: "text", text: s }] });

/** Rows → a compact markdown table. Cheaper to read than JSON, for both of us. */
function table(rows) {
  if (!rows.length) return "No data in that range.";
  const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const fmt = (v) =>
    v === null || v === undefined ? "" : typeof v === "number" ? String(Math.round(v * 100) / 100) : String(v);
  return [
    `| ${cols.join(" | ")} |`,
    `| ${cols.map(() => "---").join(" | ")} |`,
    ...rows.map((r) => `| ${cols.map((c) => fmt(r[c])).join(" | ")} |`),
  ].join("\n");
}

async function callTool(env, name, args = {}) {
  const end = args.end || todayIn(tz(env));
  const start = args.start;

  if (name === "health_daily") {
    const { results } = await env.DB.prepare(
      "SELECT date, metric, value FROM daily WHERE date >= ? AND date <= ? ORDER BY date, metric"
    ).bind(start, end).all();

    const wanted = args.metrics?.length ? new Set(args.metrics) : null;
    const byDate = new Map();
    for (const r of results) {
      if (wanted && !wanted.has(r.metric)) continue;
      if (!byDate.has(r.date)) byDate.set(r.date, { date: r.date });
      byDate.get(r.date)[r.metric] = r.value;
    }
    return text(table([...byDate.values()]));
  }

  if (name === "health_sleep") {
    const { results } = await env.DB.prepare(
      `SELECT date, minutes_asleep, minutes_in_period, efficiency, deep_minutes, rem_minutes,
              light_minutes, minutes_awake, start_time, end_time
       FROM sleep WHERE date >= ? AND date <= ? AND is_main_sleep = 1 ORDER BY date`
    ).bind(start, end).all();
    return text(table(results));
  }

  if (name === "health_workouts") {
    const { results } = await env.DB.prepare(
      `SELECT date, display_name, type, duration_min, calories_kcal, distance_m, avg_hr, azm
       FROM exercise WHERE date >= ? AND date <= ? AND (? IS NULL OR type LIKE ?) ORDER BY start_time`
    ).bind(start, end, args.type ?? null, args.type ? `%${args.type}%` : null).all();
    return text(table(results));
  }

  if (name === "health_trend") {
    const bucket = args.bucket || "week";
    const expr = bucket === "day" ? "date"
      : bucket === "month" ? "substr(date,1,7)"
      : "date(date, 'weekday 1', '-7 days')";
    const { results } = await env.DB.prepare(
      `SELECT ${expr} AS bucket, ROUND(AVG(value),2) AS avg, MIN(value) AS min, MAX(value) AS max, COUNT(*) AS days
       FROM daily WHERE metric = ? AND date >= ? AND date <= ?
       GROUP BY bucket ORDER BY bucket`
    ).bind(args.metric, start, end).all();
    return text(results.length ? table(results) : `No '${args.metric}' data between ${start} and ${end}. Try health_status to see what is stored.`);
  }

  if (name === "health_status") {
    const cover = await env.DB.prepare("SELECT MIN(date) a, MAX(date) b, COUNT(*) n FROM daily").first();
    const { results: metrics } = await env.DB.prepare(
      "SELECT metric, COUNT(*) days, MIN(date) first, MAX(date) last FROM daily GROUP BY metric ORDER BY metric"
    ).all();
    const last = await env.DB.prepare("SELECT value FROM meta WHERE key='last_sync'").first();
    const sleep = await env.DB.prepare("SELECT COUNT(*) n FROM sleep").first();
    const ex = await env.DB.prepare("SELECT COUNT(*) n FROM exercise").first();
    return text(
      `Coverage: ${cover?.a || "—"} → ${cover?.b || "—"} (${cover?.n || 0} daily rows, ` +
      `${sleep?.n || 0} sleep sessions, ${ex?.n || 0} workouts)\n` +
      `Last sync: ${last?.value || "never"}\n\n` + table(metrics)
    );
  }

  if (name === "health_sync") {
    const stats = await syncAll(env, Math.min(args.days ?? 3, 400));
    return text(
      `Synced ${stats.from} → ${stats.to}: ${stats.daily} daily rows, ${stats.sleep} sleep, ${stats.exercise} workouts.` +
      (stats.errors.length ? `\n\nErrors:\n- ${stats.errors.join("\n- ")}` : "")
    );
  }

  throw new Error(`unknown tool: ${name}`);
}

async function mcp(request, env) {
  const req = await request.json();
  const reply = (result) => json({ jsonrpc: "2.0", id: req.id, result });
  const fail = (code, message) => json({ jsonrpc: "2.0", id: req.id ?? null, error: { code, message } });

  // Notifications carry no id and want no body.
  if (req.method?.startsWith("notifications/")) return new Response(null, { status: 202, headers: CORS });

  switch (req.method) {
    case "initialize":
      return reply({
        // Echo the client's version back; this server is stateless either way,
        // so it works before and after the 2026-07-28 session removal.
        protocolVersion: req.params?.protocolVersion || "2025-06-18",
        capabilities: { tools: {} },
        serverInfo: { name: "kenkou-health", version: "1.0.0" },
      });
    case "ping":
      return reply({});
    case "tools/list":
      return reply({ tools: TOOLS });
    case "tools/call":
      try {
        return reply(await callTool(env, req.params?.name, req.params?.arguments || {}));
      } catch (err) {
        // Tool errors belong in the result, not the JSON-RPC envelope — the model
        // should see them and be able to react.
        return reply({ content: [{ type: "text", text: `Error: ${err.message}` }], isError: true });
      }
    default:
      return fail(-32601, `method not found: ${req.method}`);
  }
}

// ---------------------------------------------------------------------- routing

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS });

    const url = new URL(request.url);
    const bearer = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");

    // The secret lives in the path because that is all a Claude custom connector
    // gives you to work with. Header auth works too, for anything scripted.
    const m = url.pathname.match(/^\/(mcp|sync)(?:\/([^/]+))?$/);
    if (!m) return json({ error: "not found" }, 404);
    if ((m[2] || bearer) !== env.MCP_TOKEN) return json({ error: "bad token" }, 401);

    try {
      if (m[1] === "mcp" && request.method === "POST") return await mcp(request, env);
      if (m[1] === "sync") return json(await syncAll(env, Number(url.searchParams.get("days")) || 3));
    } catch (err) {
      return json({ error: err.message }, 500);
    }
    return json({ error: "method not allowed" }, 405);
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(syncAll(env, 3));
  },
};
