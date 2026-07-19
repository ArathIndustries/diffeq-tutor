# diffeq-tutor

**Status: EARLY PREVIEW.** One topic module and one cheat sheet. Not a full course tutor yet.

Interactive, browser-based study tools for ordinary differential equations. Static HTML — no build step, no server, no dependencies beyond KaTeX loaded from CDN.

**Live site:** https://arathindustries.github.io/diffeq-tutor/

## What is here now

| Page | Content |
|---|---|
| [`series_solutions_tutor.html`](https://arathindustries.github.io/diffeq-tutor/series_solutions_tutor.html) | Interactive tutor: 12 fully worked problems on series solutions near ordinary points and Cauchy–Euler equations (singular-point classification, indicial equation, all three root cases). Step-by-step reveal, quiz mode, per-problem completion tracking. |
| [`problems_series_solutions.html`](https://arathindustries.github.io/diffeq-tutor/problems_series_solutions.html) | Quick-reference companion sheet for the same topics: formulas, decision tables, worked examples, searchable dark theme with a print mode. |
| [`cheatsheet_series_methods.html`](https://arathindustries.github.io/diffeq-tutor/cheatsheet_series_methods.html) | Higher-Order & Series Methods cheat sheet: undetermined coefficients, spring/mass systems, power series toolbox, 6-step series method, Euler equation cases, common-confusion notes. Print-compact layout. |

## Architecture

Pages are built on a shared engine vendored in [`shared/`](shared/):

- **`tutor-core.js`** — `TutorCore` module: `renderProblem()` renders a problem object (prompt, reference box, labeled steps with "why" annotations, answer box) into a card; quiz mode hides solutions until revealed; completion state persists in `localStorage` under a per-module prefix; TOC and progress-bar updates.
- **`tutor-core.css`** — card, step, badge, progress, and TOC styles (dark theme).
- **`cheatsheet-core.js` / `cheatsheet-core.css`** — searchable cheat-sheet shell with two themes: dark interactive and 3-column print-compact.

Math rendering: KaTeX 0.16 via jsdelivr CDN with `auto-render`.

The same engine drives a separate statics tutor (not in this repo); problem content is plain JavaScript objects, so adding a topic module means writing a problem array and one HTML shell.

## Roadmap

- Port the statics-tutor architecture (multi-module landing, per-module progress) into a full ODE course tutor.
- Additional topic modules: first-order methods, second-order constant-coefficient, Laplace transforms, systems.
- Additional cheat sheets per exam-scale topic cluster.

No timeline is committed; this repository is published as a working preview of the engine and one complete module.

## Running locally

Open any HTML file in a browser. KaTeX requires network access (CDN); everything else is local.

---

A Forged Tool · © Arath Industries
