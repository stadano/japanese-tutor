import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import worker from "../worker.js";

const db = new DatabaseSync(":memory:");
db.exec(readFileSync(new URL("../schema.sql", import.meta.url), "utf8"));

// Minimal D1 shim over node:sqlite.
const wrap = (sql, args = []) => ({
  bind: (...a) => wrap(sql, a),
  all: async () => ({ results: db.prepare(sql).all(...args) }),
  first: async () => db.prepare(sql).get(...args) ?? null,
  run: async () => db.prepare(sql).run(...args),
  _exec: () => db.prepare(sql).run(...args),
});
const env = {
  HOME_TZ: "America/Los_Angeles",
  MCP_TOKEN: "secret123",
  DB: { prepare: (sql) => wrap(sql), batch: async (stmts) => stmts.map((s) => s._exec()) },
};

// Seed two weeks of plausible data.
const now = "2026-08-29T00:00:00Z";
const day = (n) => new Date(Date.parse("2026-08-28") - n * 864e5).toISOString().slice(0, 10);
for (let i = 0; i < 14; i++) {
  const d = day(i);
  const rows = [["steps", 8000 + i * 120, "count"], ["resting_hr", 58 + (i % 4), "bpm"],
    ["sleep_minutes", 400 + (i % 5) * 12, "min"], ["hrv_ms", 42.5 + i * 0.3, "ms"]];
  for (const [m, v, u] of rows)
    db.prepare("INSERT INTO daily (date,metric,value,unit,synced_at) VALUES (?,?,?,?,?)").run(d, m, v, u, now);
  db.prepare(`INSERT INTO sleep (id,date,minutes_asleep,minutes_in_period,efficiency,deep_minutes,rem_minutes,light_minutes,is_main_sleep,synced_at)
    VALUES (?,?,?,?,?,?,?,?,1,?)`).run(`s${i}`, d, 400 + (i % 5) * 12, 440, 92.1, 70, 95, 250, now);
}
db.prepare(`INSERT INTO exercise (id,date,type,display_name,duration_min,calories_kcal,distance_m,avg_hr,synced_at)
  VALUES ('e1',?, 'RUN','Run',32.5,310,5200,152,?)`).run(day(2), now);

const call = async (path, body) =>
  worker.fetch(new Request("https://x" + path, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  }), env);

const rpc = async (method, params, id = 1) => {
  const res = await call("/mcp/secret123", { jsonrpc: "2.0", id, method, params });
  return { status: res.status, body: res.status === 202 ? null : await res.json() };
};

let failures = 0;
const check = (name, cond, detail = "") => {
  console.log(`${cond ? "  ok  " : "  FAIL"}  ${name}${cond ? "" : "  ← " + detail}`);
  if (!cond) failures++;
};

console.log("\n— protocol —");
const init = await rpc("initialize", { protocolVersion: "2025-06-18" });
check("initialize echoes protocol version", init.body?.result?.protocolVersion === "2025-06-18", JSON.stringify(init.body));
check("initialize advertises tools", !!init.body?.result?.capabilities?.tools);
const newer = await rpc("initialize", { protocolVersion: "2026-07-28" });
check("initialize honours 2026-07-28", newer.body?.result?.protocolVersion === "2026-07-28");
const notif = await call("/mcp/secret123", { jsonrpc: "2.0", method: "notifications/initialized" });
check("notification returns 202, no body", notif.status === 202);
const list = await rpc("tools/list");
check("tools/list returns 6 tools", list.body?.result?.tools?.length === 6, String(list.body?.result?.tools?.length));
check("every tool has an inputSchema", list.body.result.tools.every((t) => t.inputSchema?.type === "object"));
const bad = await rpc("nope/nope");
check("unknown method → -32601", bad.body?.error?.code === -32601);

console.log("\n— auth —");
const wrongTok = await call("/mcp/wrong", { jsonrpc: "2.0", id: 1, method: "tools/list" });
check("wrong path token → 401", wrongTok.status === 401);
const noRoute = await worker.fetch(new Request("https://x/nope"), env);
check("unknown route → 404", noRoute.status === 404);
const bearer = await worker.fetch(new Request("https://x/mcp", {
  method: "POST", headers: { Authorization: "Bearer secret123", "Content-Type": "application/json" },
  body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }) }), env);
check("bearer header auth works", bearer.status === 200);

console.log("\n— tools —");
const tool = async (name, args) => {
  const r = await rpc("tools/call", { name, arguments: args });
  return r.body?.result;
};
const daily = await tool("health_daily", { start: day(13), end: day(0) });
check("health_daily not an error", !daily?.isError, JSON.stringify(daily));
check("health_daily pivots metrics into stable, sorted columns", daily.content[0].text.split("\n")[0] === "| date | hrv_ms | resting_hr | sleep_minutes | steps |", daily.content[0].text.split("\n")[0]);
check("health_daily returns 14 days", daily.content[0].text.trim().split("\n").length === 16);

const filtered = await tool("health_daily", { start: day(13), end: day(0), metrics: ["steps"] });
check("metrics filter narrows columns", filtered.content[0].text.split("\n")[0] === "| date | steps |", filtered.content[0].text.split("\n")[0]);

const sleep = await tool("health_sleep", { start: day(13), end: day(0) });
check("health_sleep returns rows", sleep.content[0].text.includes("minutes_asleep"), sleep.content[0].text.slice(0, 120));

const w = await tool("health_workouts", { start: day(13), end: day(0) });
check("health_workouts finds the run", w.content[0].text.includes("RUN"), w.content[0].text);
const wf = await tool("health_workouts", { start: day(13), end: day(0), type: "SWIM" });
check("workout type filter excludes", wf.content[0].text.includes("No data"), wf.content[0].text);
const wNoFilter = await tool("health_workouts", { start: day(13), end: day(0) });
check("null type filter does not drop rows", wNoFilter.content[0].text.includes("RUN"));

for (const bucket of ["day", "week", "month"]) {
  const t = await tool("health_trend", { metric: "resting_hr", start: day(13), end: day(0), bucket });
  check(`health_trend bucket=${bucket}`, !t.isError && t.content[0].text.includes("avg"), t.content[0].text.slice(0, 200));
}
const trendDefault = await tool("health_trend", { metric: "sleep_minutes", start: day(13), end: day(0) });
check("health_trend defaults to week", trendDefault.content[0].text.includes("bucket"), trendDefault.content[0].text);
const missing = await tool("health_trend", { metric: "nonexistent", start: day(13), end: day(0) });
check("missing metric gives a useful message", missing.content[0].text.includes("health_status"), missing.content[0].text);

const status = await tool("health_status", {});
check("health_status reports coverage", /Coverage: 2026-.* → 2026-/.test(status.content[0].text), status.content[0].text.slice(0, 200));
check("health_status counts sessions", status.content[0].text.includes("14 sleep sessions") && status.content[0].text.includes("1 workouts"), status.content[0].text.split("\n")[0]);

const empty = await tool("health_daily", { start: "2020-01-01", end: "2020-01-05" });
check("empty range says so", empty.content[0].text === "No data in that range.", empty.content[0].text);

console.log(failures ? `\n${failures} FAILED\n` : "\nall passed\n");
process.exit(failures ? 1 : 0);
