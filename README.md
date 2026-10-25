# LifeStation · 生活站

> A single-file personal workspace that grows into a **lifelong growth database** —
> every task you finish, habit you check in, and note you write becomes structured,
> analyzable evidence of how you learn, work, and grow.

**Live demo:** https://4e02747cedc7482d94dcddbc44e8af01.app.workbuddy.link/
*(All data stays in your own browser's localStorage — the demo starts empty and private.)*

<!-- TODO: add a real screenshot at docs/assets/screenshot.png -->

---

## Why I built this

Most to-do apps stop at "task done ✅". I wanted to answer harder questions:

- Which **domains** am I actually investing in — and how is that shifting week by week?
- Of all the things I **learn**, which ones later get **applied, validated, or reused**?
- What **evidence of progress** can I point to — beyond a raw count of completed tasks?

LifeStation is my answer: a zero-dependency, open-in-a-tab workspace that records
daily execution (tasks, habits, projects, courses, reading) and continuously turns
that raw activity into a **contribution-weighted growth model**.

---

## What's inside

### 🏠 Data-first dashboard

- **Today board** — todos, calendar, habit check-ins, overdue projects, inbox, aggregated across all modules; click any item to edit it in place
- **Domain Overview** — contribution scores per domain over 7 / 30 / 90 days, with period-over-period change
- **Knowledge Conversion** — tracks the real pipeline *learned (E1–E3) → applied (E4) → produced (E5/E6)*, and reports how many domains actually converted (no vanity numbers)
- **Evidence of Progress** — concrete output events (finished books, completed courses, reusable notes) linked to their projects and topics

### 🌱 Topic system (the growth database)

- 21 record tables feed a unified **topic contribution model**:
  `score = record-type weight × topic-role weight × stage weight`
- Six-stage evidence semantics: `E1 Explore → E2 Learn → E3 Synthesize → E4 Apply → E5 Output → E6 Reuse`
- **Structured record linking**: any task/habit/note can reference existing plans, projects, courses, or other tasks — child records then *inherit* their parents' topics automatically
- Topic hygiene: auto-generated junk topics are quarantined behind an `_auto` flag and triaged in a dedicated review panel (merge / keep / remove)

### 🔍 Analysis pages

- **Topic Development** — 12-week contribution histogram, four-step growth path with real evidence, recent completion timeline
- **Relation Explorer** — co-occurrence networks between domains, backed by actual shared records

### ⚙️ Engineering

- **One self-contained HTML file** — no build step, no framework, no network dependency; open it and it works (Monet's public-domain paintings are inlined as compressed backgrounds)
- **Dual storage stack** — localStorage by default, with a silent-write sync layer designed for optional cloud backends
- **13 test suites, 400+ assertions** — the entire app logic (aggregation, inheritance, migration, routing) is extracted from the HTML and regression-tested in Node `vm` + jsdom on every change
- **Real bugs found and fixed**: a DST-transition timing bug in the habit heatmap (date comparison drifted on clock-change days), duplicate legacy-code shadowing, seed-data migration traps (substring-only title matching)

---

## Repository layout

```
lifestation/
├── README.md                  # you are here
├── LICENSE                    # MIT
├── src/
│   └── 生活站.html             # the whole app (~1.2 MB, single file)
├── scripts/                   # 13 regression test suites + legacy upgrade scripts
│   ├── v2_test.js … v2i_dashboard_boards_test.js
│   └── README.md
└── docs/                      # design docs, architecture notes, AI testing guide
```

---

## Running tests

```bash
node scripts/v2i_dashboard_boards_test.js   # each suite is standalone, zero dependencies
# jsdom-based suites additionally need: NODE_PATH=<path-to>/node_modules
```

Every suite extracts the relevant functions out of the HTML source, runs them in a
Node `vm` sandbox against fixtures, and asserts on both static structure and behavior —
so the single-file architecture doesn't mean "untestable".

---

## Design principles

1. **Evidence over vanity metrics** — a finished task only counts once it maps to a topic, a stage, and (where possible) a project
2. **Anti-pollution by default** — titles never auto-become topics; new topics require explicit confirmation
3. **Single source of truth per concept** — one contribution model, one stage vocabulary, one linking schema
4. **Boring tech, obsessive polish** — vanilla JS, one file, but with audit trails, migration flags, and idempotent upgrades

---

## License

MIT. Artwork: Claude Monet paintings (public domain).
