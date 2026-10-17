# Configuration

**English** | [Türkçe](configuration.tr.md)

Volta works without any configuration. This page is for when you want to change a limit, the port or where the data is stored.

Settings live in two places:

| File | What's in it |
|---|---|
| `.env` | Your own machine's settings: the port and the database file |
| `src/config.ts` | Test limits and how Volta behaves: maximum RPS, test duration, request timeout and more |

After changing either file, **restart Volta** (`Ctrl+C`, then `npm start`). The interface picks up the new limits by itself: the form's hints, its checks and the texts that mention the timeout all follow the settings.

## Invalid settings

Volta checks every setting when it starts. If a value is invalid, it doesn't start and lists everything that's wrong:

```
Volta could not start: invalid settings (src/config.ts or .env).
  - MAX_TARGET_RPS cannot be higher than 4000 (current: 5000)
  - VOLTA_PORT cannot be 80 (browsers leave the default port out of the address). Use another port, e.g. 4400
Fix them and restart Volta.
```

So a typo can't silently break a test.

## `.env`

Created from `.env.example` during `npm install`. Every value is optional; if `.env` is missing, Volta uses the defaults.

| Setting | Default | Description |
|---|---|---|
| `VOLTA_PORT` | `4400` | The port Volta's interface runs on: `http://localhost:4400`. Change it if 4400 is already in use. Allowed: 1–65535, except 80. |
| `DATABASE_URL` | `file:./prisma/dev.db` | The SQLite file where tests are stored. A relative path is resolved from the project folder, so it doesn't matter which folder you start Volta from. |

Example:

```dotenv
VOLTA_PORT=5500
DATABASE_URL="file:./prisma/dev.db"
```

**Why not `PORT`?** Many developers set `PORT` in their terminal for their own project. Volta uses its own name so it never picks that up and clashes with the server you're testing.

**The address can't be changed.** Volta always listens on `127.0.0.1`, so it's reachable only from your own computer. This is deliberate: a load testing tool shouldn't be accidentally exposed to the whole network.

## `src/config.ts`

### Test limits

| Setting | Default | Allowed | Description |
|---|---|---|---|
| `MIN_TARGET_RPS` | `10` | ≥ 1 | Lowest requests per second a test can use. Below 10, percentiles (p95, p99) rely on too few requests. |
| `MAX_TARGET_RPS` | `1000` | ≤ 4000 | Highest requests per second. Volta was tested comfortably up to 3000; see [Performance](../README.md#performance). |
| `MIN_DURATION_SECONDS` | `1` | ≥ 1 | Shortest test, in seconds. |
| `MAX_DURATION_SECONDS` | `60` | ≥ 1 | Longest test, in seconds. |
| `MIN_STEP_COUNT` | `2` | ≥ 2 | Fewest steps in a stepped test. |
| `MAX_STEP_COUNT` | `10` | ≥ 2 | Most steps in a stepped test. |
| `MIN_STEP_DURATION_SECONDS` | `2` | > 0 | Each step must last at least this long, so a growing queue has time to show. |

The upper limits can't be lower than the lower ones.

### Requests

| Setting | Default | Allowed | Description |
|---|---|---|---|
| `REQUEST_TIMEOUT_MS` | `2500` | 1000–30000 | How long Volta waits for a response before counting the request as a timeout. Raise it to test slow endpoints, such as AI calls. |
| `MAX_BODY_KB` | `100` | 1–1024 | Largest JSON body a test can send. The body is sent with every request and saved with the test. |
| `CONNECT_CHECK_TIMEOUT_MS` | `2000` | > 0 | Before a test starts, Volta checks that the target is reachable. If it can't connect within this time, the test doesn't start. |
| `MAX_URL_LENGTH` | `2000` | ≥ 1 | Longest target URL, in characters. |
| `MAX_SEARCH_LENGTH` | `200` | ≥ 1 | Longest text in the search boxes (history and saved targets). |

**About the timeout's upper limit:** with a slow server, every request waits until the timeout. At 1000 RPS and a 30-second timeout, up to 30,000 requests can be in flight at once. Raise the timeout only as much as you need.

### Warnings

| Setting | Default | Description |
|---|---|---|
| `WORKER_LAG_WARNING_MS` | `50` | If Volta's own timing lags more than this, the *"Volta is under strain"* warning is shown and the test is marked as possibly unreliable. The first second of a test is ignored (connections are being set up). |

### Advanced

These control the live chart and how results are saved. The defaults work well; change them only if you know why.

| Setting | Default | Rule | Description |
|---|---|---|---|
| `LIVE_WINDOW_MS` | `200` | Must divide 1000 evenly (100, 200, 250, 500…) | Length of one point on the live chart. The live chart, a reloaded page and the test details all use the same windows. |
| `DB_FLUSH_INTERVAL_MS` | `500` | > 0 | How often results are written to the database during a test. |
| `WORKER_BATCH_INTERVAL_MS` | `100` | > 0 | How often the test engine hands over its results. |
| `LIVE_EMIT_DELAY_MS` | `150` | Greater than `WORKER_BATCH_INTERVAL_MS` | How long the live stream waits after a window ends before sending it, so the window's last results make it in. |

## Common changes

**Higher load:** `MAX_TARGET_RPS = 3000`. Keep in mind that Volta and your server usually share the same CPU; watch the *Volta lag* indicator during the test.

**A slow endpoint:** if every request takes 4 seconds, all of them time out with the default 2.5 s. Set `REQUEST_TIMEOUT_MS = 10000` and Volta will measure them instead.

**Longer tests:** `MAX_DURATION_SECONDS = 300`. Each request is saved as one row, so a 5-minute test at 1000 RPS adds 300,000 rows to the database and its detail page takes longer to open. You can delete old tests from **Test History** at any time.

**Another port:** `VOLTA_PORT=5500` in `.env`.

## Analysis thresholds

The rules behind the analysis (when a step counts as *Borderline* or *Strained*, what counts as a queue building up, when a recommendation appears) are in `src/analysis/thresholds.ts`. They're not meant as settings: changing them changes what Volta concludes about your server. [Reading the results](reading-results.md) explains how they work.

## Updating

`src/config.ts` is part of Volta's code. If you change it and a new version also changes this file, `git pull` may stop and ask you to deal with your local change first. Note your changes so you can reapply them; `.env` is never touched by updates.
