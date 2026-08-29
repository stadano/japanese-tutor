-- 健康 — local store for Google Health data.
--
-- The point of keeping our own copy: Google expires refresh tokens after 7 days
-- for apps in "Testing" status. When that happens the sync stops, but everything
-- already pulled stays queryable. Re-auth restores the feed. It never costs history.

-- One row per (day, metric). Scalar daily numbers live here.
CREATE TABLE IF NOT EXISTS daily (
  date       TEXT NOT NULL,          -- YYYY-MM-DD, the user's civil date
  metric     TEXT NOT NULL,          -- steps | resting_hr | hrv_ms | sleep_minutes | ...
  value      REAL,                   -- the number, in the unit named by `unit`
  unit       TEXT,
  extra      TEXT,                   -- JSON: anything worth keeping that isn't the headline number
  synced_at  TEXT NOT NULL,
  PRIMARY KEY (date, metric)
);
CREATE INDEX IF NOT EXISTS daily_metric_date ON daily (metric, date);

-- One row per sleep session, keyed by its API resource name.
CREATE TABLE IF NOT EXISTS sleep (
  id            TEXT PRIMARY KEY,
  date          TEXT NOT NULL,       -- civil date of waking; the night "belongs" to the morning
  start_time    TEXT,
  end_time      TEXT,
  minutes_asleep      REAL,
  minutes_in_period   REAL,
  minutes_awake       REAL,
  minutes_to_fall_asleep REAL,
  efficiency    REAL,                -- asleep / in_period, as a percentage
  deep_minutes  REAL,
  rem_minutes   REAL,
  light_minutes REAL,
  is_main_sleep INTEGER,
  raw           TEXT,
  synced_at     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS sleep_date ON sleep (date);

-- One row per workout.
CREATE TABLE IF NOT EXISTS exercise (
  id             TEXT PRIMARY KEY,
  date           TEXT NOT NULL,
  start_time     TEXT,
  end_time       TEXT,
  type           TEXT,
  display_name   TEXT,
  duration_min   REAL,
  active_min     REAL,
  calories_kcal  REAL,
  distance_m     REAL,
  steps          INTEGER,
  avg_hr         REAL,
  azm            REAL,
  raw            TEXT,
  synced_at      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS exercise_date ON exercise (date);

-- Cached access token, sync cursors, last-error breadcrumbs.
CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT
);
