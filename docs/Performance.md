# Measured scale and current limits

Measured 2026-10-11T17:58:54.178Z on **Apple M3 Max, 64 GiB RAM**, darwin/arm64, Node v25.8.1. These are development measurements on a powerful laptop; they do not establish average-laptop performance, resource consumption, battery usage, or agency suitability.

Tested source SHA-256: `a5ac2a3f0f972ea3419fade17ea9dd2d81e06da0234a27d28e0e59f7468567b9`. Raw measurements and CPU operation timings: [performance-results.json](performance-results.json).

These measurements precede the 12 October 2026 storage-accounting correction for inherited property names. They identify that earlier source, not the current validation fingerprint; scale benchmarks were not rerun for this correction.

## Method

Built production app with Chromium headless at 1280 × 900. Normal folder-backed cases have two links per card. A branched case groups 30 items under each main item; a flat case puts all cards on one board. Synthetic grids deliberately measure workload, not an investigation layout recommendation.

Each shape runs five actual editor-open, title-change, autosave, and reload cycles, checking the saved title and browser errors. p95 is the largest observation in five samples; it is a small regression sample, not a population estimate. Save/reload includes the intentional 650 ms autosave delay, server persistence, reload, and Playwright overhead. Cold load is one observation. Ten in-process samples measure validation, cloning, serialization, and geometry. No CPU throttling was used.

| Total cards | Links | Layout   | Cards on main board | Cold load ms | Open editor p95 ms | Save/reload p95 ms |
| ----------: | ----: | -------- | ------------------: | -----------: | -----------------: | -----------------: |
|         100 |   200 | branched |                   4 |       100.97 |              64.56 |            1096.91 |
|         100 |   200 | flat     |                 100 |       122.22 |              90.44 |            1096.48 |
|         500 | 1,000 | branched |                  17 |       111.66 |              71.72 |            1093.82 |
|         500 | 1,000 | flat     |                 500 |       269.82 |              297.3 |            1313.53 |
|       1,000 | 2,000 | branched |                  34 |       114.52 |              73.97 |            1222.54 |
|       1,000 | 2,000 | flat     |                1000 |       483.76 |             422.45 |            1889.31 |
|       3,000 | 6,000 | branched |                 100 |       219.26 |             107.84 |            1877.49 |
|       3,000 | 6,000 | flat     |                3000 |      1910.29 |            1907.57 |             4327.3 |

## What these results mean

Nested boards keep the displayed scene smaller even as case data grows. A 3,000-card case with 100 main-board cards had an editor-open p95 of 107.84 ms here. A flat 3,000-card board remains slow, with editor-open p95 of 1907.57 ms. Do not present the schema ceiling as a guarantee of fluid interaction.

Endpoint and child indexes remove repeated full-case lookups. Memoized scene content skips unrelated dialog/camera updates. Closed select menus now wait until opened to mount their options. The diagram still creates ordinary DOM/SVG elements; it is **not virtualized**. Full workspace validation, serialization, cloning, and revision copies also remain.

For actual investigations, keep the main board focused on key events and organize detail in nested timelines. On phones, Timeline → List provides a readable chronological route. Full-board virtualization, more compact history storage, and tests on slower Windows/macOS hardware are future scale work. The measured architecture and limits are appropriate to describe in a portfolio; unrestricted enterprise-scale claims are not supported.

## Storage growth

Every saved revision retains a complete snapshot. Each case receives a synthetic 1 MiB original, then five title edits; originals are stored once while snapshots grow. Case metadata/history and separate checkpoint journals also occupy space.

| Cards | Additional revisions | Additional snapshot bytes | Originals and intake records |
| ----: | -------------------: | ------------------------: | ---------------------------: |
|   100 |                    5 |                   0.33 MB |                      1.00 MB |
|   500 |                    5 |                   1.68 MB |                      1.00 MB |
| 1,000 |                    5 |                   3.36 MB |                      1.00 MB |
| 3,000 |                    5 |                  10.21 MB |                      1.00 MB |

Case records → Storage reports actual file byte totals and revision count. It excludes external backups and the app registry/signing key, does not follow symbolic links, and never deletes old originals or history. File bytes are not the same as filesystem allocated space.

## Repeat the measurement

```sh
npm run build
npx playwright install chromium
npm run benchmark
```

Set `ANACAPA_BENCH_SIZES` to a comma-separated list (for example `100,500`) for a shorter run. It creates disposable cases in the OS temporary directory, uses an OS-assigned loopback port, and removes those cases afterwards. It does not touch the live workspace or change port 5173. Compare like hardware, browser, viewport, and workload; keep the host details alongside any timing claim.
