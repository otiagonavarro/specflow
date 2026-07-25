<!-- markdownlint-disable -->
<div align="center">
  <img src="./assets/logo.svg" alt="navarro" width="200" />
    <h1>specflow</h1>

[![Node.js](https://img.shields.io/badge/node-%3E%3D18.18.0-339933?logo=node.js&logoColor=white)](package.json)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white)](package.json)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](package.json)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)](package.json)
[![Express](https://img.shields.io/badge/Express-4-000000?logo=express&logoColor=white)](package.json)
[![npm](https://img.shields.io/badge/npm-not%20published-red?logo=npm&logoColor=white)](#getting-started)
[![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey)](#prerequisites)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![PRs](https://img.shields.io/badge/PRs-welcome-brightgreen)](.github/pull_request_template.md)

</div>

**Jira-integrated kanban UI + local Express API.** The browser never holds Jira tokens; the server reads them from `.env` or from in-app Settings.

**Repository:** [github.com/tiagornandrade/specflow](https://github.com/tiagornandrade/specflow)

**Works on macOS, Windows, and Linux** (Node.js + Git for the `create` flow).

**Not on the public npm registry.** Bare `npx specflow …` will 404. Either use **`npx --package=github:tiagornandrade/specflow specflow …`** (see below) or clone the repo and run commands locally.

---

## Features

- **Issues, My Issues, Inbox, Epics, Projects** — list and board views, filters, and Jira-backed pagination.
- **Board metrics** — throughput, lead-time distribution, scatter plot, and sprint-aware summaries when the board has an active sprint. Metrics use **historical Jira data** (created and resolution dates) over a **configurable window** (e.g. 90–1095 days) on the dashboard; the API paginates results and applies a **safety cap** on sample size so very large sites stay bounded (details and copy live in the in-app “How metrics are calculated” section).
- **Settings** — Jira domain, project key, board id, and API token are stored for the **server** only (never exposed to the client bundle).
- **CLI** — `specflow create` clones and installs; `specflow init` runs the same stack as `npm run init` from inside a clone.

The **user interface language** is Brazilian Portuguese; code and this README stay in English.

---

## Getting Started

### From any folder (recommended)

You do **not** need to be inside this repository. Pick a parent directory (e.g. `~/projects`), then run:

```bash
npx --package=github:tiagornandrade/specflow specflow create my-dashboard
cd my-dashboard
npm run init
```

- **`create`** clones the repo into `./my-dashboard`, runs `npm install`, and prints the next step.
- **`npm run init`** creates `.env` from `.env.example` if needed, starts the **API** (default port **58471**), then the **UI** (default **58470**). Open the URL printed in the terminal.

Stop with **Ctrl+C**.

> **Fork?** After you fork on GitHub, either pass your repo URL explicitly:
>
> ```bash
> npx --package=github:YOUR_USER/specflow specflow create my-dashboard https://github.com/YOUR_USER/specflow.git
> ```
>
> or set `package.json` → `repository.url` on your fork so `create` uses the right clone URL, or set the env var **`SPECFLOW_REPO`** to your `https://github.com/.../specflow.git`.

### One-liner (clone + install + run)

```bash
git clone https://github.com/tiagornandrade/specflow.git && cd specflow && npm install && npm run init
```

### Already cloned (development)

```bash
cd specflow
npm install
npm run init
```

Same as **`npm start`**.

### Install globally (no `npx` each time)

The package isn't on the public npm registry yet, but you can still install the `specflow` command globally:

```bash
# Option A — straight from GitHub
npm install -g github:tiagornandrade/specflow

# Option B — from a local clone (symlinks the repo as the global bin)
git clone https://github.com/tiagornandrade/specflow.git
cd specflow && npm install
npm link
```

Either way, the `specflow` command becomes available everywhere:

```bash
specflow create my-dashboard
specflow init
specflow --help
```

> Once published to npm, this becomes simply `npm install -g specflow`.

To update a global install later, run **`specflow update`**. It keeps a persistent clone at `~/.specflow/src` (pulling/cloning + `npm install` there), then relinks the global bin to it — this avoids `npm install -g github:…`, which symlinks into npm's own cache tmp folder and can fail once npm garbage-collects it mid-install.

### Start from any folder (npx)

The package is **not** on the public npm registry. Use GitHub as the package source:

```bash
npx --package=github:tiagornandrade/specflow specflow init
```

Point at your clone (keeps `.env`, Jira settings, and `LOCAL_REPOS_ROOT`):

```bash
npx --package=github:tiagornandrade/specflow specflow init ~/projects/specflow
```

Or set once in your shell profile:

```bash
export SPECFLOW_HOME=~/projects/specflow
npx --package=github:tiagornandrade/specflow specflow init
```

> Bare `npx specflow` will 404. Always pass `--package=github:…`.

### Start only (from inside the repo)

After **`npm install`** in the clone:

```bash
npm run init
# or
npx specflow init
```

---

## Verify

- UI loads at the host/port Vite prints (default **http://localhost:58470**).
- API health: **http://localhost:58471/api/health** (or your `SERVER_PORT`).
- In the app, open **Projects**, pick a board, and open **metrics** to confirm Jira data and the history window selector.
- Typecheck: **`npm run lint`**.

---

## Prerequisites

| Tool        | Required for              |
|------------|---------------------------|
| Node.js 18.18+ | Always                  |
| npm 9+     | Always                    |
| Git        | `specflow create` and manual clone |

---

## Ports (defaults)

High-range ports reduce clashes with common stacks (3000, 5173, 8080):

| Service | Port  | Override        |
|---------|-------|-----------------|
| UI      | 58470 | `VITE_PORT` in `.env` |
| API     | 58471 | `SERVER_PORT` in `.env` |

If **58470** is busy, `npm run init` picks the next free port and prints it (it never steals `SERVER_PORT`).

---

## CLI reference

| Command | Description |
|---------|-------------|
| `specflow create [dir] [git-url]` | Clone + `npm install` into `./dir` (default dir: `specflow`) |
| `specflow init` | Same as `npm run init` when run inside a clone |
| `specflow update [dir]` | Update an existing install — `git pull` + `npm install` for a clone; for a global install, pulls/clones into `~/.specflow/src`, runs `npm install`, then relinks the global bin to it |
| `specflow --help` | Show usage |

---

## npm scripts

| Script | Description |
|--------|-------------|
| `npm run init` | `.env` bootstrap if needed, then API + UI |
| `npm start` | Same as `init` |
| `npm run dev` | Vite only (API must already be running) |
| `npm run server` | Express only |
| `npm run build` | Production build of the frontend |
| `npm run preview` | Preview the production build locally |
| `npm run clean` | Remove `dist/` |
| `npm run list` | Print all npm scripts (same as `npm run`) |
| `npm run lint` | `tsc --noEmit` |

---

## Configuration

See **`.env.example`**. Secrets stay in environment variables or `.env` — never commit them.

---

## Troubleshooting

**`404 Not Found - GET https://registry.npmjs.org/specflow`**

- The app is **not published** to npm. `npx specflow` looks there first and fails.
- **First-time setup from another folder:**
  `npx --package=github:tiagornandrade/specflow specflow create my-dashboard`
  then `cd my-dashboard && npm run init`.
- **Already in a clone:** `npm install` then `npx specflow init` or `npm run init`.

**There is no `specflow install` command**

- Use **`create`** (clone + `npm install`) or run **`npm install`** yourself inside the repo.

**`npx` cannot find the package**

- Use the full form: `npx --package=github:OWNER/specflow specflow create …`
- You need network access to GitHub.

**`git clone` fails**

- Install [Git](https://git-scm.com/) and check the repository URL (fork / `SPECFLOW_REPO`).

**Port already in use**

- Free **58471** (or your `SERVER_PORT`) for the API, or change it in `.env`.
- For the UI, `init` usually auto-picks another port; or set `VITE_PORT`.

**Old `.env` still has `SERVER_PORT=3001`**

- The app keeps using that value until you align with **58471** / **58470** or refresh `.env` from `.env.example`.

---

## License

Distributed under the **MIT License**. See [`LICENSE`](LICENSE) for details.

---

## Note

This repo was originally scaffolded for AI Studio; optional `GEMINI_API_KEY` in `.env` is not required for the Jira dashboard.
