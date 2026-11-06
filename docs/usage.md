# Usage

**English** | [Türkçe](usage.tr.md)

This guide walks through every screen in Volta. To understand what the numbers and the analysis mean, see [Reading the results](reading-results.md).

- [Setting up a test](#setting-up-a-test)
- [Variables](#variables)
- [While the test runs](#while-the-test-runs)
- [Saved targets](#saved-targets)
- [Test history](#test-history)
- [Test details](#test-details)
- [Report](#report)
- [CSV export](#csv-export)
- [Language](#language)

## Setting up a test

The form on the left of the **DASHBOARD** page.

### Target URL

The address you want to test, for example `localhost:3000/api/products`. If you leave out `http://`, Volta adds it, like a browser's address bar. `https://` works too, including local servers with self-signed certificates.

Only addresses on your own computer or local network can be tested (see [Safety](../README.md#safety)). The book icon in the field opens your [saved targets](#saved-targets).

### Method and JSON body

- **GET** or **POST**.
- **JSON Body** is optional and sent only with POST requests. It must be valid JSON; Volta checks it before starting. Every request in the test sends the same body, unless you use [variables](#variables).
- **Keys in the JSON Body box:** `Tab` and `Shift+Tab` indent and outdent the line (or every selected line), `Enter` keeps the current indentation. To leave the box with the keyboard, press `Esc`, then `Tab`.

**JSON Body** and **Headers** are sections that open with a click. Closed, each shows a short summary on the right (_48 bytes_, _2 headers · 1 hidden_). With GET, JSON Body is locked. If something in a section is invalid when you start, it opens by itself and shows the problem.

### Headers

Optional. Use them to test endpoints that need a token, a cookie or an API key. Open **Headers** and press **+ Add header**. Each row has a name and a value, for example:

| Name              | Value                  |
| ----------------- | ---------------------- |
| `Authorization`   | `Bearer eyJhbGciOi...` |
| `Accept-Language` | `tr`                   |

- Headers are sent with every request, with GET as well as POST.
- **Pasting:** paste lines like `Authorization: Bearer ...` into a name field and Volta splits them into rows, one per line. Lines copied from your browser's developer tools or from a curl command (`-H "Name: value"`) work too.
- A header with the same name as one Volta sends itself replaces it, for example your own `Content-Type` or `Accept-Encoding`.
- Up to 20 headers and 8 KB in total by default (see [Configuration](configuration.md#requests)).
- **Names:** English letters, digits and symbols like `-` and `_`, without spaces. **Values:** no letters like `ş` or `ğ`; HTTP headers don't support them.
- Some headers are managed by Volta and can't be set: `Host`, `Content-Length`, `Transfer-Encoding`, `Connection`, `Keep-Alive`, `Upgrade`, `TE`, `Trailer` and `Expect`. When pasting, they're skipped with a note.

**Hiding values.** The lock icon on a row hides its value on the test details and in the report, for example `Authorization: Bearer ••••••Oi3x`. Rows named `Authorization`, `Proxy-Authorization` or `Cookie`, or with `token`, `key`, `secret` or `password` in their name, are locked automatically. Locking needs no confirmation; unlocking asks first, because the value will then appear in plain text in the report.

Hiding only changes what's shown. The test still sends the real value, **RUN AGAIN** fills the form with it, and it's saved in the local database file (`prisma/dev.db`) as plain text. Don't share that file, and use test tokens rather than real ones where you can.

### Test type

**Constant Load:** the same number of requests every second for the whole test.

| Field          | Meaning                                                    |
| -------------- | ---------------------------------------------------------- |
| Requests / sec | How many requests to send each second (10–1000 by default) |
| Duration (s)   | How long the test runs (1–60 seconds by default)           |

Use it to check whether your server handles a specific load, for example the traffic you expect at peak time.

**Stepped Ramp:** the load rises in equal steps, so you can see where your server starts to struggle.

| Field        | Meaning                                          |
| ------------ | ------------------------------------------------ |
| Max RPS      | Requests per second in the last step             |
| Duration (s) | Total duration, shared equally between the steps |
| Steps        | Number of steps (2–10 by default)                |

The form shows the plan as you type, for example:

> 4 steps: 100 → 200 → 300 → 400 RPS · 5s each

Each step must last at least 2 seconds, and Max RPS can't be lower than the number of steps. Step rates are rounded to whole numbers.

**Which one first?** If you don't know your server's limits yet, start with a stepped test. Once you know roughly where it breaks, a constant test at that load tells you how it behaves when held there.

### Starting

Press **START TEST**. Before sending the first request, Volta checks that the target is reachable. If your project isn't running or the port is wrong, the test doesn't start and the form tells you why.

Only one test can run at a time.

## Variables

Variables make every request send different values, for example to test a sign-up endpoint with a new user on every request instead of the same email again and again. Write the name in double braces:

| Variable       | Example (request 1)                    | Value                                                                                                        |
| -------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `{{email}}`    | `volta-a1b2c3-1@volta.test`            | `volta-`, the first 6 characters of the test's ID, and the request's number. Unique.                         |
| `{{username}}` | `volta_a1b2c3_1`                       | Like the email, with `_`. Unique.                                                                            |
| `{{name}}`     | `Alex Morgan`                          | A first and a last name from an international list. Not unique.                                              |
| `{{password}}` | `Kp7#mQ2xWv9L`                         | 12 characters. Starts with a letter and contains uppercase and lowercase letters, a digit and a symbol.      |
| `{{n}}`        | `1`                                    | The request's sequence number: 1, 2, 3… in the order the requests are sent.                                  |
| `{{uuid}}`     | `3f2b8c1e-9a4d-4e7b-8c2a-5d6f7e8a9b0c` | A UUID in the standard (version 4) format.                                                                   |

**Where you can use them**

- **The URL's path or query:** `localhost:3000/api/users/{{n}}`, `localhost:3000/api/check?email={{email}}`. Values are URL-encoded (`@` becomes `%40`).
- **String values in the JSON body,** inside quotes: `"email": "{{email}}"`.
- **Header values,** for example `X-Request-Id: {{uuid}}`.

Variables can't be used in the server part of the address (`http://{{n}}.localhost`): Volta checks that the address is local once, before the test, so it must stay the same. An unknown name such as `{{emial}}` keeps the test from starting.

**Why `.test`?** The `.test` domain is reserved for testing and can never belong to a real site. Even if the app you test sends a confirmation email to every new account, the emails reach no one.

To see which values each request sent, download the [CSV](#csv-export).

### Random user

The **Random user** button above the JSON Body section builds a body for you. It's locked while GET is selected and while a test is running.

- Each row is a field name and a type: Email, Username, Full name, Password, Sequence no, UUID or **Fixed value** (you type the value; it's the same in every request).
- It opens with email, username and password. **Add field** adds a row (up to 20), the trash icon removes one.
- To change the order of the rows, drag a row by its handle. With the handle focused, `Alt+↑` / `Alt+↓` move it too.
- **Preview** shows the body with sample values; the real values differ on every request.
- **WRITE TO BODY** puts the body, with its variables (`"email": "{{email}}"`), into the JSON Body box. If the box isn't empty, it asks before replacing it.

## While the test runs

### Live chart

The chart fills in as responses arrive:

- **Average**, **p95** and **p99** latency (left axis)
- **Successful RPS** and **Sent RPS** (right axis, hidden by default for constant tests)
- **Red areas** where errors happened: timeouts, connection errors or 5xx responses

Hover over a point to see the details of that moment: latency values and how many requests were sent, answered and successful in that second.

- **Zoom** with the mouse wheel, **pan** by dragging, and press **RESET** to go back.
- **Click a series name** above the chart to hide or show it.
- The **?** next to the title explains how to read the chart.

### Indicators above the chart

- **Volta lag:** how late Volta's own timer is. A few milliseconds is normal (around 10–15 ms on Windows). If it goes above 50 ms, a warning appears: Volta itself is under strain and the results may be unreliable.
- **MB/s:** how much data the server is sending back.

### Cards, status codes and request log

- **AVERAGE, REQUESTS, MIN, MAX:** totals for the whole test. The small _Now_ value under each one is the last finished second.
- **Status Codes:** every status code and error type with its count and share. Hover over a row for an explanation.
- **Request Log:** one line per second, for example `[5s] 200 req avg 52 ms max 61 ms 200×200`.

Cards, chart titles and summary rows have a faint **?** icon. Hover over it to see what the value means.

### Stopping

Press **STOP TEST** to end the test early. The results so far are saved and analyzed.

### Reloading the page or losing the connection

- **Reloading during a test** is safe. The page reconnects, refills the form (headers included) and redraws the chart from the start.
- **If Volta shuts down** while the page is open, a box appears saying the connection was lost, and keeps trying to reconnect. When Volta is back, reload the page.
- **If Volta shuts down during a test,** the test is marked _Interrupted_ the next time Volta starts, and the part that ran is still analyzed.

### After the test

- The form shows _Test completed._ and the chart stays on screen until you start a new test.
- Open the test from **TEST HISTORY** to see its analysis.
- If you tested an address that isn't in your saved targets at least twice, Volta offers to save it. Choose **NO** and it won't ask again for that address.

## Saved targets

Addresses you test often, with a name you choose.

Open them with the book icon in the **Target URL** field:

- **Search** by name or address.
- **Click an entry** to put its address into the form.
- **+** adds a new entry: a name (up to 40 characters) and an address. Names and addresses must be unique.
- The **trash icon** deletes an entry. Past tests aren't deleted; they show the address instead of the name.

Wherever a test's address is saved, Volta shows the name above it: in the history list, on the test details and in the report. Searching history by a name also finds that address's tests.

## Test history

The **TEST HISTORY** page lists every test, newest first.

| Column       | Meaning                                                                           |
| ------------ | --------------------------------------------------------------------------------- |
| Date / Time  | When the test started                                                             |
| Target URL   | The name (if saved) and the address. The copy icon copies the address.            |
| Method       | GET or POST                                                                       |
| Avg. Latency | Average response time with p95 underneath. Yellow from 500 ms, red from 1 second. |
| Actual RPS   | Requests completed per second                                                     |
| Duration     | Actual duration                                                                   |
| Status       | Running, Completed, Stopped, Failed or Interrupted                                |

- **Search** finds tests by address or saved name.
- **All / GET / POST** filters by method.
- **Sort** switches between newest and oldest.
- **Click a row** to open the test. Hold `Ctrl` (`Cmd` on macOS) to open it in a new tab.

When you come back from a test with **← History**, the list opens on the same page and briefly highlights the test you opened.

### Deleting

- **One test:** open it and press the trash icon at the top.
- **Everything:** **Clear Database** on the history page deletes all tests and their results. To confirm, type the word shown in the dialog. Saved targets are kept.

A running test can't be deleted.

## Test details

Opens when you click a test in the history list.

**Left column**

- **Test Settings:** address, method, test type, RPS, duration, status, date, and the JSON body and headers, if any. Hidden header values appear as `••••` with a lock icon. **RUN AGAIN** fills the dashboard form with these settings (headers with their real values), so you can review them and start the same test.
- **Analysis:** the verdict, estimated capacity, a summary sentence, warnings, a timeline of events and a **RECOMMENDATIONS** button. Recommendations can include a ready-made follow-up test: **RUN THIS TEST** fills the form with it. See [Reading the results](reading-results.md).

**Right column**

- **Test Chart:** the same chart you saw live, point by point.
- **Cards:** average, total requests, min and max.
- **Status Codes**
- **Summary:** p95, p99, standard deviation, actual RPS, error rate, total data and actual duration.
- **Steps** (stepped tests only): target RPS, successful RPS, average, p95, error rate and state for each step.

A banner appears at the top if most responses were redirects: Volta doesn't follow redirects, so you were measuring the redirect itself.

## Report

**GET REPORT** on the test details opens a printable report in a new tab: the result, key metrics, the chart, events, steps, recommendations, status codes, test settings and a short glossary. Hidden header values appear as `••••` in the report too.

Press **SAVE AS PDF** and choose _Save as PDF_ as the destination in your browser's print dialog.

The report has its own language switch, so you can produce it in English or Turkish regardless of the language you use in Volta.

## CSV export

Downloads a test's results as a CSV file, one row per request.

- **Test details:** the **CSV** button, once the test has ended.
- **Dashboard:** when a test with variables ends, a **CSV** button appears next to **Test Setup**. It stays faded until all results are saved.

| Column                      | Meaning                                                                                  |
| --------------------------- | ---------------------------------------------------------------------------------------- |
| `n`                         | The request's sequence number (tests with variables only)                                |
| `email`, `password`, …      | The values the request sent, one column per variable used (tests with variables only)    |
| `status`                    | The status code. Empty if no response arrived; the reason is in `error`.                 |
| `error`                     | `TIMEOUT`, `CONNECTION_REFUSED`, `CONNECTION_RESET` or `NETWORK_ERROR`                   |
| `response_ms`               | Response time in milliseconds                                                            |
| `sent_at`                   | When the request was sent (ISO 8601, UTC)                                                |

- The separator follows the interface language: `;` in Turkish, `,` in English. The file starts with a UTF-8 BOM, so Excel reads it correctly.
- **Values aren't stored.** When you download the CSV, Volta computes them again from the test's key. The same test gives the same values every time.
- **Stopped tests:** requests still waiting for a response when you stop the test are never recorded. They have no row, so their numbers are missing from `n`. The server may still have processed them (for example, created the account).

> **⚠️** Passwords appear in the CSV in plain text. Be careful when you share the file.

## Language

Use **TR / EN** at the top right. On your first visit Volta uses your browser's language, then remembers your choice.
