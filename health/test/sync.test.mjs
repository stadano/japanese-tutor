import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import worker from "../worker.js";

const db = new DatabaseSync(":memory:");
db.exec(readFileSync(new URL("../schema.sql", import.meta.url), "utf8"));
const wrap = (sql, args = []) => ({
  bind: (...a) => wrap(sql, a),
  all: async () => ({ results: db.prepare(sql).all(...args) }),
  first: async () => db.prepare(sql).get(...args) ?? null,
  run: async () => db.prepare(sql).run(...args),
  _exec: () => db.prepare(sql).run(...args),
});
const env = {
  HOME_TZ: "UTC", MCP_TOKEN: "t",
  GOOGLE_CLIENT_ID: "cid", GOOGLE_CLIENT_SECRET: "cs", GOOGLE_REFRESH_TOKEN: "rt",
  DB: { prepare: (sql) => wrap(sql), batch: async (s) => s.map((x) => x._exec()) },
};

const D = (n) => new Date(Date.parse("2026-08-29") - n * 864e5).toISOString().slice(0, 10);
const civil = (ymd) => { const [year, month, day] = ymd.split("-").map(Number); return { date: { year, month, day } }; };

const calls = [];
let tokenFails = false;
globalThis.fetch = async (input, init = {}) => {
  const url = String(input);
  const J = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json" } });

  if (url.includes("oauth2.googleapis.com/token")) {
    if (tokenFails) return J({ error: "invalid_grant" }, 400);
    return J({ access_token: "at", expires_in: 3600 });
  }
  calls.push({ url, body: init.body ? JSON.parse(init.body) : null });

  if (url.includes(":dailyRollUp")) {
    const type = url.match(/dataTypes\/([^/]+)\//)[1];
    const mk = (d, v) => ({ civilStartTime: civil(d), ...v });
    if (type === "steps") return J({ rollupDataPoints: [mk(D(1), { steps: { countSum: "9412" } }), mk(D(2), { steps: { countSum: "10380" } })] });
    if (type === "distance") return J({ rollupDataPoints: [mk(D(1), { distance: { millimetersSum: "7250000" } })] });   // 7250 m
    if (type === "total-calories") return J({ rollupDataPoints: [mk(D(1), { totalCalories: { kcalSum: 2410.5 } })] });
    if (type === "active-zone-minutes") return J({ rollupDataPoints: [mk(D(1), { activeZoneMinutes: { sumInFatBurnHeartZone: "18", sumInCardioHeartZone: "12", sumInPeakHeartZone: "4" } })] });
    if (type === "heart-rate") return J({ rollupDataPoints: [mk(D(1), { heartRate: { beatsPerMinuteAvg: 68.4, beatsPerMinuteMin: 51, beatsPerMinuteMax: 162 } })] });
    if (type === "floors") return J({ rollupDataPoints: [] });
    return J({ error: { message: "nope" } }, 400);
  }

  const type = url.match(/dataTypes\/([^/]+)\/dataPoints/)?.[1];
  if (type === "daily-resting-heart-rate")
    return J({ dataPoints: [{ dailyRestingHeartRate: { date: civil(D(1)).date, beatsPerMinute: "57" } }] });
  if (type === "daily-heart-rate-variability")
    return J({ dataPoints: [{ dailyHeartRateVariability: { date: civil(D(1)).date, averageHeartRateVariabilityMilliseconds: 44.8, entropy: 0.71 } }] });
  if (type === "daily-oxygen-saturation")
    return J({ dataPoints: [{ dailyOxygenSaturation: { date: civil(D(1)).date, averagePercentage: 96.2, lowerBoundPercentage: 94, upperBoundPercentage: 98 } }] });
  if (type === "daily-vo2-max") return J({ error: { message: "not available for this user" } }, 403);  // must not abort the run
  if (type === "weight")
    return J({ dataPoints: [{ weight: { sampleTime: { civilTime: civil(D(1)) }, weightGrams: 74300 } }] });
  if (type === "sleep")
    return J({ dataPoints: [{ name: "users/me/dataTypes/sleep/dataPoints/abc", sleep: {
      interval: { startTime: `${D(2)}T06:12:00Z`, endTime: `${D(1)}T14:03:00Z`, civilEndTime: civil(D(1)) },
      metadata: { mainSleep: true },
      summary: { minutesAsleep: "421", minutesInSleepPeriod: "468", minutesAwake: "47", minutesToFallAsleep: "9",
        stagesSummary: [{ type: "DEEP", minutes: "64" }, { type: "REM", minutes: "98" }, { type: "LIGHT", minutes: "259" }] },
    } }] });
  if (type === "exercise")
    return J({ dataPoints: [{ name: "users/me/dataTypes/exercise/dataPoints/run1", exercise: {
      interval: { startTime: `${D(1)}T16:00:00Z`, endTime: `${D(1)}T16:45:00Z`, civilStartTime: civil(D(1)) },
      exerciseType: "RUN", displayName: "Morning Run", activeDuration: "2400s",
      metricsSummary: { caloriesKcal: 388, distanceMillimeters: 6400000, steps: "6120",
        averageHeartRateBeatsPerMinute: "154", activeZoneMinutes: "31" },
    } }] });
  return J({ dataPoints: [] });
};

let failures = 0;
const check = (n, c, d = "") => { console.log(`${c ? "  ok  " : "  FAIL"}  ${n}${c ? "" : "  ← " + d}`); if (!c) failures++; };
const val = (date, metric) => db.prepare("SELECT value FROM daily WHERE date=? AND metric=?").get(date, metric)?.value ?? null;

const res = await worker.fetch(new Request("https://x/sync/t?days=30"), env);
const stats = await res.json();

console.log("\n— sync run —");
check("sync returns 200", res.status === 200, JSON.stringify(stats).slice(0, 200));
check("window covers 30 days ending today inclusive", stats.from === D(29) && stats.to === D(-1), `${stats.from}→${stats.to}`);
check("a failing data type is isolated, not fatal", stats.errors.some((e) => e.startsWith("daily-vo2-max")) && stats.daily > 0, JSON.stringify(stats.errors));

console.log("\n— rollup chunking —");
const hrCalls = calls.filter((c) => c.url.includes("heart-rate") && c.url.includes("dailyRollUp"));
const stepCalls = calls.filter((c) => c.url.includes("/steps/") && c.url.includes("dailyRollUp"));
check("heart-rate (14d cap) chunks a 30d window into 3", hrCalls.length === 3, String(hrCalls.length));
check("steps (90d cap) needs only 1 call", stepCalls.length === 1, String(stepCalls.length));
check("chunks are contiguous and clamped to the window",
  JSON.stringify(hrCalls[0].body.range.start) === JSON.stringify(civil(D(29))) &&
  JSON.stringify(hrCalls[0].body.range.end) === JSON.stringify(hrCalls[1].body.range.start) &&
  JSON.stringify(hrCalls[1].body.range.end) === JSON.stringify(hrCalls[2].body.range.start) &&
  JSON.stringify(hrCalls[2].body.range.end) === JSON.stringify(civil(D(-1))),
  JSON.stringify(hrCalls.map((c) => [c.body.range.start.date, c.body.range.end.date])));
check("windowSizeDays is 1", hrCalls.every((c) => c.body.windowSizeDays === 1));

console.log("\n— units and parsing —");
check("steps stored", val(D(1), "steps") === 9412, String(val(D(1), "steps")));
check("distance mm → m", val(D(1), "distance_m") === 7250, String(val(D(1), "distance_m")));
check("calories stored", val(D(1), "calories_kcal") === 2410.5);
check("azm sums the three zones", val(D(1), "azm") === 34, String(val(D(1), "azm")));
check("hr_avg stored with min/max in extra", val(D(1), "hr_avg") === 68.4 &&
  JSON.parse(db.prepare("SELECT extra FROM daily WHERE date=? AND metric='hr_avg'").get(D(1)).extra).max === 162);
check("resting_hr from daily list", val(D(1), "resting_hr") === 57);
check("hrv stored", val(D(1), "hrv_ms") === 44.8);
check("spo2 stored", val(D(1), "spo2_pct") === 96.2);
check("weight g → kg", val(D(1), "weight_kg") === 74.3, String(val(D(1), "weight_kg")));

console.log("\n— sessions —");
const s = db.prepare("SELECT * FROM sleep").get();
check("sleep filed under wake date", s.date === D(1), s.date);
check("sleep stages parsed", s.deep_minutes === 64 && s.rem_minutes === 98 && s.light_minutes === 259);
check("efficiency computed (421/468 → 90.0)", s.efficiency === 90, String(s.efficiency));
check("sleep mirrored into daily", val(D(1), "sleep_minutes") === 421, String(val(D(1), "sleep_minutes")));
check("sleep keyed by resource name", s.id === "users/me/dataTypes/sleep/dataPoints/abc");

const x = db.prepare("SELECT * FROM exercise").get();
check("exercise duration from interval", x.duration_min === 45, String(x.duration_min));
check("activeDuration '2400s' → 40 min", x.active_min === 40, String(x.active_min));
check("exercise distance mm → m", x.distance_m === 6400, String(x.distance_m));
check("exercise avg hr", x.avg_hr === 154);

console.log("\n— idempotency —");
const before = db.prepare("SELECT COUNT(*) n FROM daily").get().n;
await worker.fetch(new Request("https://x/sync/t?days=30"), env);
const after = db.prepare("SELECT COUNT(*) n FROM daily").get().n;
check("re-syncing upserts rather than duplicating", before === after, `${before} → ${after}`);
check("sleep not duplicated", db.prepare("SELECT COUNT(*) n FROM sleep").get().n === 1);

console.log("\n— token expiry —");
db.prepare("DELETE FROM meta WHERE key='access_token'").run();
tokenFails = true;
const failed = await worker.fetch(new Request("https://x/sync/t?days=3"), env);
const fb = await failed.json();
check("invalid_grant surfaces the re-auth hint",
  JSON.stringify(fb).includes("authorize.mjs"), JSON.stringify(fb).slice(0, 300));

console.log(failures ? `\n${failures} FAILED\n` : "\nall passed\n");
process.exit(failures ? 1 : 0);
