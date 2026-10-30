# Reading the results

**English** | [Türkçe](reading-results.tr.md)

What Volta measures, what the chart shows and how the automatic analysis reaches its conclusions.

- [The measurements](#the-measurements)
- [The chart](#the-chart)
- [The analysis](#the-analysis)
  - [Verdict](#verdict)
  - [Estimated capacity](#estimated-capacity)
  - [Events](#events)
  - [Steps table](#steps-table)
  - [Recommendations](#recommendations)
  - [Warnings](#warnings)
- [Special cases](#special-cases)
- [Limits of the analysis](#limits-of-the-analysis)

## The measurements

| Measure                | Meaning                                                                                                                                                            |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Average**            | Average time of requests that got a response or timed out. Connection errors are left out: they return instantly and would make the server look faster than it is. |
| **p95**                | 95% of requests were answered faster than this. It leaves out the slowest 5% and shows the worst case most users experience.                                       |
| **p99**                | 99% of requests were answered faster than this. If it's much higher than p95, some requests are occasionally very slow.                                            |
| **Min / Max**          | The fastest and slowest response. A max equal to the timeout (2.5 s by default) means at least one request timed out.                                              |
| **Standard deviation** | How much response times vary. Small means consistent; large means sometimes fast, sometimes slow.                                                                  |
| **Actual RPS**         | Requests completed per second over the whole test (total requests ÷ actual duration), errors included.                                                             |
| **Error rate**         | Share of requests with a server error (5xx) or no response (timeout, connection error).                                                                            |
| **Actual duration**    | From the first request to the last response. It can be a little longer than the configured duration, because Volta waits for requests still on their way.          |

**Why aren't 4xx responses errors?** A 401, 404 or 429 is a deliberate answer: the server is working and chose to reject the request. Volta doesn't count them in the error rate, but the analysis warns you when most responses are 4xx, because then your test settings are probably wrong. Mostly 401 or 403 gets its own warning: the request's token or cookie is probably the problem (see [Recommendations](#recommendations)).

**Percentiles** are calculated with the nearest-rank method, the same way everywhere in Volta (live chart, summary and analysis).

**Latency colors.** In the history list, the steps table and the report, latencies of **500 ms** and above are shown in yellow, **1 second** and above in red.

## The chart

| Line                                         | Axis                       |
| -------------------------------------------- | -------------------------- |
| Average (yellow), p95 (cyan), p99 (lavender) | Latency, left              |
| Successful RPS (solid) and Sent RPS (dashed) | Requests per second, right |
| Red areas                                    | Errors at that moment      |

How to read it:

- **Average and p95 flat and close together:** the server is healthy.
- **p95 and p99 rising while the average stays flat:** a queue is starting to form. This is usually the first sign of strain.
- **Successful RPS falling below Sent RPS:** the server can't keep up with incoming requests.
- **Red areas:** timeouts, connection errors or 5xx responses.
- **A short spike in the first moments:** connections are being set up. It's normal and the analysis ignores the first second.

The chart places each result at the moment its **response arrived**: it shows what the server was sending back at that moment. With a slow server (say, 2 seconds per request) the chart starts 2 seconds in, because nothing came back before that.

## The analysis

The analysis runs when you open a finished test. It works on the raw results, one second at a time, and places each result in the second its request was **sent**. The question it answers is: _could the server handle the load sent in that second?_

This is why an event can appear a few seconds before you see it on the chart. If requests sent at second 17 time out after 2.5 seconds, the analysis says _"Errors started"_ at 17, while the chart turns red at 19.5.

The first second is a warm-up and isn't used for the verdict (unless the step is too short to leave it out).

### Verdict

Each step (or the whole test, for a constant test) gets one of four states: **Healthy**, **Borderline**, **Strained** or **Collapsed**. Five measures are checked, and **the worst one decides**:

| Measure                                              | Borderline                                                        | Strained                                | Collapsed |
| ---------------------------------------------------- | ----------------------------------------------------------------- | --------------------------------------- | --------- |
| **Error rate** (5xx and requests with no response)   | ≥ 1%                                                              | ≥ 5%                                    | ≥ 25%     |
| **Connection errors** (refused or reset connections) |                                                                   |                                         | ≥ 1%      |
| **Successful requests ÷ target requests**            | below 90%                                                         | below 75%                               | below 50% |
| **p95 compared to the baseline**                     | ≥ 2× the baseline, and at least +50 ms                            | ≥ 5× the baseline, and at least +200 ms |           |
| **p95, fixed limits**                                | ≥ 500 ms                                                          | ≥ 1000 ms                               |           |
| **Rising trend** (queue building up)                 | p95 at the end of the step ≥ 1.5× its start, and at least +100 ms |                                         |           |

If requests were sent but no responses came back at all, the state is **Collapsed**.

**The baseline** is the server's healthy latency: the median p95 of the first 3 seconds after the warm-up, in the first step, ignoring seconds with connection errors. The "at least +50 / +200 ms" part keeps very fast endpoints from raising false alarms: going from 3 ms to 7 ms is more than twice as slow, but it doesn't matter.

A server that is already slow from the very first second has no healthy baseline. The analysis then says so (_"The server was strained from the first second"_) and relies on the fixed limits.

**The rising trend** compares the median p95 of the first few seconds of a step with its last few seconds. It needs at least 4 seconds with responses, so very short steps can't show it.

The verdict shown at the top is the state at the **highest load** tested. The sentence underneath tells the whole story, for example:

> The server was healthy up to 100 RPS, started to strain at 200 RPS, was strained at 300 RPS, collapsed at 400 RPS.

All thresholds are in `src/analysis/thresholds.ts`.

### Estimated capacity

| Shown as        | Meaning                                                            |
| --------------- | ------------------------------------------------------------------ |
| **200–300 RPS** | Handled 200, broke at 300. The real limit is somewhere in between. |
| **≥ 400 RPS**   | Handled everything tested. No limit was found; try a higher load.  |
| **< 100 RPS**   | Couldn't handle even the first step (or the constant load).        |

A step counts as handled if it's Healthy, or Borderline **only** because latency rose. A Borderline step with errors or missing responses doesn't count.

The capacity is an estimate from one test. Repeat it: results right at the limit can vary between runs by one step.

### Events

The timeline under the verdict. Seconds are counted from the start of the test, by when requests were sent.

A problem becomes an event only if it lasts **at least 2 seconds in a row**, so a single slow second doesn't raise an alarm.

| Event                                                       | When it appears                                                                         |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Test started · 100 RPS                                      | The first request was sent                                                              |
| Step 2 · 200 RPS                                            | A new step began                                                                        |
| Latency rose: p95 52 → 547 ms                               | p95 reached the Borderline level relative to the baseline (≥ 2× and at least +50 ms)    |
| Queue building up: p95 keeps rising                         | A step had a rising trend (shown in the middle of that step)                            |
| Errors started: TIMEOUT                                     | 5xx responses and timeouts reached 1% of requests. The codes of that second are listed. |
| Error rate peaked: 100%                                     | The second with the highest error rate, if it reached at least 5%                       |
| Cannot connect to the server                                | At least 1% of connections were refused or reset, or no responses came back at all      |
| The server is responding again                              | No connection errors and error rate below 1% again                                      |
| The server was strained from the first second               | No healthy baseline could be measured                                                   |
| Test finished / stopped / interrupted / ended with an error | How the test ended                                                                      |

Connection errors have their own event, so they're not counted in _"Errors started"_ as well.

### Steps table

Only for stepped tests. One row per step:

| Column         | Meaning                                                              |
| -------------- | -------------------------------------------------------------------- |
| Target         | The step's requests per second                                       |
| Successful RPS | Of the requests sent during this step, how many succeeded per second |
| Average, p95   | Latency of those requests                                            |
| Errors         | Their error rate                                                     |
| State          | Healthy, Borderline, Strained or Collapsed                           |

Because results are counted by when they were sent, Successful RPS can stay high in a step where the server was already slow: the requests did succeed, just late. The state still shows the problem through latency.

### Recommendations

Rules that look at what happened and suggest what to check next.

**About the server**

| Recommendation                                   | When it appears                                                                                                             |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| **The server rejects requests under overload**   | 503 or 429 in at least 1% of responses. (If most responses are 429, only 503 counts here; 429 gets its own recommendation.) |
| **The application returns errors**               | Any other 5xx code in at least 1% of responses                                                                              |
| **Requests are timing out**                      | At least 1% of requests timed out                                                                                           |
| **Even a single request may not finish in time** | 90% or more of requests timed out: the problem is probably the request itself, not the load                                 |
| **The connection to the server was lost**        | At least 1% of connections were refused or reset                                                                            |
| **Some requests are very slow**                  | p99 is at least 3× p95 **and** at least 100 ms higher, while the error rate is below 1%                                     |
| **Latency comes from the request itself**        | The server is slow but stable (see [Special cases](#special-cases))                                                         |

**About the test**

| Recommendation                               | When it appears                                                                                                                                                                        |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Requests were rejected as unauthorized**   | Half or more of the responses are 401 or 403: the token or cookie may be missing, wrong or expired. Check your [headers](usage.md#headers). Shown instead of _Most responses are 4xx_. |
| **Most responses are 4xx**                   | Half or more of the responses are 4xx (except 429), but not mostly 401/403: the URL, method, body or headers may be wrong                                                              |
| **Most responses are redirects**             | Half or more of the responses are 301, 302, 303, 307 or 308                                                                                                                            |
| **Rate limiter active**                      | Half or more of the responses are 429                                                                                                                                                  |
| **Few requests: percentiles are unreliable** | Fewer than 10 requests per second on average                                                                                                                                           |

**Next test.** These come with a ready-made follow-up test: a stepped test with **10 steps over 30 seconds**. **RUN THIS TEST** fills the form with it.

| Recommendation                  | When                                            | Follow-up test goes up to                                 |
| ------------------------------- | ----------------------------------------------- | --------------------------------------------------------- |
| **Find the exact limit**        | Capacity is a range, e.g. 200–300               | The upper end (300), in finer steps                       |
| **Find the capacity**           | Couldn't handle even the first load, e.g. < 100 | The same load (100), starting from a tenth of it          |
| **Possibly close to the limit** | Handled the load, but latency rose (Borderline) | 1.5× the load                                             |
| **Try a higher load**           | Handled the load comfortably                    | 2× the load (no test if Volta's maximum was already used) |

Follow-up tests never exceed Volta's `MAX_TARGET_RPS`.

The capacity recommendations are left out on purpose when the results can't say anything about capacity: most responses are 4xx, redirects or 429, 90% of requests timed out, half of the requests failed to connect, or the server is slow but stable.

### Warnings

Shown above the events:

- **Volta was under strain:** Volta's own lag went above 50 ms during the test (the first second is ignored). The measurements may be off. Lower the load or close other programs.
- **The test was stopped / interrupted / ended with an error:** the analysis covers only the part that ran. It ends at the last request whose response was recorded.
- **Redirects, 4xx, 401/403 or 429:** the results don't reflect the server's real performance.

## Special cases

**Slow but stable.** Every request takes about 2 seconds, but there are no errors, the server keeps up and latency doesn't grow with load: the only problem is the fixed latency limit. The verdict is still _Borderline_ (p95 ≥ 500 ms) or _Strained_ (p95 ≥ 1 s), but the capacity is shown as _≥ tested load_ and the sentence says _"The server is stable under load but slow"_. Lowering the load won't make it faster, so Volta suggests looking at the request itself instead of capacity tests.

**Rate limiter.** If most responses are 429, you measured the rate limiter's setting, not the server. Disable the limiter for the test or exempt Volta's requests.

**Redirects.** Volta doesn't follow redirects. If your address redirects (for example to a login page), enter the final address directly.

**Too short.** A test that ran for less than 1 second (for example stopped right away) isn't analyzed: there's not enough data.

**Stopped tests.** When you stop a test, requests still on their way never get their responses recorded. The analysis therefore ends at the last request whose response was recorded, so a slow server isn't mistaken for one that stopped responding.

## Limits of the analysis

The analysis is built from automatic rules applied to the measured numbers. It can be wrong. Volta sees your server only from the outside: it doesn't know your CPU, memory, database or logs. Use the analysis as a starting point and combine it with what you know about your application.

Volta and the server you test usually share the same computer. At high loads they compete for the same CPU, so a limit found locally isn't necessarily the limit in production.
