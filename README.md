<h1 align="center">
  <img src="docs/images/logo.svg" alt="" height="36" align="top"> Volta
</h1>

<p align="center">
  <b>Find your local server's limits before your users do.</b><br>
  Visual load testing for localhost: live charts and an automatic analysis that explains the results in plain language.
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-f4c21a" alt="License: MIT"></a>
  <img src="https://img.shields.io/badge/node-%E2%89%A5%2022.19-339933?logo=node.js&logoColor=white" alt="Node.js 22.19 or newer">
  <img src="https://img.shields.io/badge/platform-Windows%20%C2%B7%20Linux-64d8d7" alt="Tested on Windows and Linux">
  <a href="https://github.com/ard-daskiran/voltaload/actions/workflows/ci.yml"><img src="https://github.com/ard-daskiran/voltaload/actions/workflows/ci.yml/badge.svg" alt="CI status"></a>
</p>

<p align="center">
  <a href="#installation">Installation</a> ·
  <a href="docs/usage.md">Usage</a> ·
  <a href="docs/reading-results.md">Reading the results</a> ·
  <a href="docs/configuration.md">Configuration</a>
</p>

<p align="center"><b>English</b> | <a href="README.tr.md">Türkçe</a></p>

![Volta running a stepped test](docs/images/live-test.gif)

## What is Volta?

Load testing measures how a server holds up when many requests arrive at the same time. Volta does this for you: it sends the number of requests per second you choose to an address (for example `localhost:3000/api/products`), measures the responses and shows the result on a live chart.

## Why Volta?

Before you ship your project, you usually don't know how many requests it can handle. Volta runs in your browser, needs no scripts and interprets the results for you:

> _Your server handled up to 200 RPS without trouble, a queue started building at 300 RPS and it collapsed at 400 RPS._

It runs on your own computer and needs nothing but Node.js.

## Features

- **Constant and stepped tests:** send requests at a fixed rate, or raise the load step by step to find where your server starts to struggle.
- **Live chart:** average, p95 and p99 latency, sent and successful requests per second, with errors highlighted as they happen.
- **Automatic analysis:** a verdict (Healthy, Borderline, Strained or Collapsed), an estimated capacity range, a timeline of what happened and recommendations with a ready-to-run follow-up test.
- **History:** every test with its chart and analysis, searchable and filterable.
- **Report:** a printable page you can save as a PDF.
- **Saved targets:** keep the addresses you test often.
- **GET and POST** requests, with an optional JSON body.
- **English and Turkish** interface.

## Requirements

- [Node.js](https://nodejs.org) 22.19 or newer (the LTS version is recommended)

Nothing else. The database is a local file that is created during setup.

## Installation

```bash
git clone https://github.com/ard-daskiran/voltaload.git
cd voltaload
npm install
npm start
```

Then open **http://localhost:4400** in your browser.

`npm install` also prepares everything Volta needs: it checks your Node.js version, creates the database and a `.env` file with the default settings. `npm start` builds and starts Volta. Press `Ctrl+C` in the terminal to stop it.

**Updating:** run `git pull`, then `npm install` and `npm start` again. Your test history is kept.

## Your first test

1. Start the project you want to test, for example at `http://localhost:3000`.
2. Open Volta and enter the address you want to test, for example `localhost:3000/api/products`.
3. Choose a constant test with **50** requests per second for **10** seconds, and start it.
4. Watch the live chart. When the test ends, open it from **Test History** to see the analysis.

Next, try a stepped test (for example up to 400 requests per second in 4 steps over 20 seconds) to see where your server starts to struggle.

**Guides:**

- [Usage](docs/usage.md): every option, the target book, history and reports
- [Reading the results](docs/reading-results.md): the chart, the verdict, capacity, events and recommendations
- [Configuration](docs/configuration.md): limits, timeout, port and other settings

## Screenshots

<table>
  <tr>
    <th width="50%">Test details and analysis</th>
    <th width="50%">Test history</th>
  </tr>
  <tr>
    <td valign="top"><img src="docs/images/test-detail.png" alt="Test details"></td>
    <td valign="top"><img src="docs/images/history.png" alt="Test history"></td>
  </tr>
</table>

## Safety

Volta is built to test your own software on your own computer:

- **Only local and private network addresses** can be tested: `localhost`, `127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `::1` and `fc00::/7`. Volta checks the address a name actually resolves to and connects only to that address, so a name can't be pointed somewhere else during a test.
- **The interface is only reachable from your computer** (`127.0.0.1`), and requests coming from other websites open in your browser are rejected.
- **Built-in limits:** 1000 requests per second and 60 seconds by default, one test at a time. Redirects are not followed.
- **TLS certificates are not verified,** so local HTTPS servers with self-signed certificates can be tested.

## Performance

Volta sends requests at a precise rate from a separate thread and measures its own timing during the test (shown as _Volta lag_).

In our tests on Windows, Volta stayed comfortable up to about **3000 requests per second**. At **4000** it showed a short warm-up spike in the first second, then ran normally. The default limit is 1000 and can be raised in [`src/config.ts`](docs/configuration.md).

Results depend on your computer. Keep in mind that Volta and the server you test usually share the same CPU.

## Your data

Test results stay on your computer, in a local SQLite file (`prisma/dev.db`). Volta doesn't send them anywhere.

The interface loads its styles, fonts and some libraries from public CDNs, so your browser needs an internet connection when it opens the page.

## Disclaimer

> **⚠️** Volta is a development tool for load testing software you own or are authorized to test, on your own machine or local network. By design it only sends requests to local and private network addresses. Using it against systems without the owner's permission is your responsibility alone. Volta is provided "as is", without warranty of any kind; the author is not liable for any damage resulting from its use or misuse (see [LICENSE](LICENSE)).

## License

[MIT](LICENSE) © 2026 Arda Daşkıran

In short: you can use, modify and distribute Volta freely, including in commercial projects, as long as the copyright notice is kept. The software comes with no warranty. The full text in [LICENSE](LICENSE) is what applies.

Built with Node.js, TypeScript, Express, Socket.IO, Prisma, SQLite and Chart.js.
