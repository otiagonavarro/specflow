<!-- markdownlint-disable -->
<div align="center">
  <img src="./assets/logo.svg" alt="navarro" width="200" />
    <h1>kanbam-code</h1>

[![Node.js](https://img.shields.io/badge/node-%3E%3D18.18.0-339933?logo=node.js&logoColor=white)](package.json)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white)](package.json)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](package.json)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)](package.json)
[![Express](https://img.shields.io/badge/Express-4-000000?logo=express&logoColor=white)](package.json)
[![npm](https://img.shields.io/badge/npm-not%20published-red?logo=npm&logoColor=white)](#getting-started)
[![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey)](#prerequisites)
[![PRs](https://img.shields.io/badge/PRs-welcome-brightgreen)](.github/pull_request_template.md)

</div>

**Jira-integrated kanban UI + local Express API.** The browser never holds Jira tokens; the server reads them from `.env` or from in-app Settings.

**Repository:** [github.com/tiagornandrade/kanbam-code](https://github.com/tiagornandrade/kanbam-code)

**Works on macOS, Windows, and Linux** (Node.js + Git for the `create` flow).

**Not on the public npm registry.** Bare `npx kanbam-code …` will 404. Either use **`npx --package=github:tiagornandrade/kanbam-code kanbam-code …`** (see below) or clone the repo and run commands locally.

---

## Features

- **Issues, My Issues, Inbox, Epics, Projects** — list and board views, filters, and Jira-backed pagination.
- **Board metrics** — throughput, lead-time distribution, scatter plot, and sprint-aware summaries when the board has an active sprint. Metrics use **historical Jira data** (created and resolution dates) over a **configurable window** (e.g. 90–1095 days) on the dashboard; the API paginates results and applies a **safety cap** on sample size so very large sites stay bounded (details and copy live in the in-app “How metrics are calculated” section).
- **Settings** — Jira domain, project key, board id, and API token are stored for the **server** only (never exposed to the client bundle).
- **CLI** — `kanbam-code create` clones and installs; `kanbam-code init` runs the same stack as `npm run init` from inside a clone.

The **user interface language** is Brazilian Portuguese; code and this README stay in English.

---

## Getting Started

### From any folder (recommended)

You do **not** need to be inside this repository. Pick a parent directory (e.g. `~/projects`), then run:

```bash
npx --package=github:tiagornandrade/kanbam-code kanbam-code create my-dashboard
cd my-dashboard
npm run init
```

- **`create`** clones the repo into `./my-dashboard`, runs `npm install`, and prints the next step.
- **`npm run init`** creates `.env` from `.env.example` if needed, starts the **API** (default port **58471**), then the **UI** (default **58470**). Open the URL printed in the terminal.

Stop with **Ctrl+C**.

> **Fork?** After you fork on GitHub, either pass your repo URL explicitly:
>
> ```bash
> npx --package=github:YOUR_USER/kanbam-code kanbam-code create my-dashboard https://github.com/YOUR_USER/kanbam-code.git
> ```
>
> or set `package.json` → `repository.url` on your fork so `create` uses the right clone URL, or set the env var **`KANBAM_CODE_REPO`** to your `https://github.com/.../kanbam-code.git`.

### One-liner (clone + install + run)

```bash
git clone https://github.com/tiagornandrade/kanbam-code.git && cd kanbam-code && npm install && npm run init
```

### Already cloned (development)

```bash
cd kanbam-code
npm install
npm run init
```

Same as **`npm start`**.

### Install globally (no `npx` each time)

The package isn't on the public npm registry yet, but you can still install the `kanbam-code` command globally:

```bash
# Option A — straight from GitHub
npm install -g github:tiagornandrade/kanbam-code

# Option B — from a local clone (symlinks the repo as the global bin)
git clone https://github.com/tiagornandrade/kanbam-code.git
cd kanbam-code && npm install
npm link
```

Either way, the `kanbam-code` command becomes available everywhere:

```bash
kanbam-code create my-dashboard
kanbam-code init
kanbam-code --help
```

> Once published to npm, this becomes simply `npm install -g kanbam-code`.

### Start from any folder (npx)

The package is **not** on the public npm registry. Use GitHub as the package source:

```bash
npx --package=github:tiagornandrade/kanbam-code kanbam-code init
```

Point at your clone (keeps `.env`, Jira settings, and `LOCAL_REPOS_ROOT`):

```bash
npx --package=github:tiagornandrade/kanbam-code kanbam-code init ~/projects/kanbam-code
```

Or set once in your shell profile:

```bash
export KANBAM_CODE_HOME=~/projects/kanbam-code
npx --package=github:tiagornandrade/kanbam-code kanbam-code init
```

> Bare `npx kanbam-code` will 404. Always pass `--package=github:…`.

### Start only (from inside the repo)

After **`npm install`** in the clone:

```bash
npm run init
# or
npx kanbam-code init
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
| Git        | `kanbam-code create` and manual clone |

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
| `kanbam-code create [dir] [git-url]` | Clone + `npm install` into `./dir` (default dir: `kanbam-code`) |
| `kanbam-code init` | Same as `npm run init` when run inside a clone |
| `kanbam-code update [dir]` | Update an existing install — `git pull` + `npm install` for a clone, or `npm install -g <repo>` for a global install |
| `kanbam-code --help` | Show usage |

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

**`404 Not Found - GET https://registry.npmjs.org/kanbam-code`**

- The app is **not published** to npm. `npx kanbam-code` looks there first and fails.
- **First-time setup from another folder:**  
  `npx --package=github:tiagornandrade/kanbam-code kanbam-code create my-dashboard`  
  then `cd my-dashboard && npm run init`.
- **Already in a clone:** `npm install` then `npx kanbam-code init` or `npm run init`.

**There is no `kanbam-code install` command**

- Use **`create`** (clone + `npm install`) or run **`npm install`** yourself inside the repo.

**`npx` cannot find the package**

- Use the full form: `npx --package=github:OWNER/kanbam-code kanbam-code create …`
- You need network access to GitHub.

**`git clone` fails**

- Install [Git](https://git-scm.com/) and check the repository URL (fork / `KANBAM_CODE_REPO`).

**Port already in use**

- Free **58471** (or your `SERVER_PORT`) for the API, or change it in `.env`.
- For the UI, `init` usually auto-picks another port; or set `VITE_PORT`.

**Old `.env` still has `SERVER_PORT=3001`**

- The app keeps using that value until you align with **58471** / **58470** or refresh `.env` from `.env.example`.

---

## Note

This repo was originally scaffolded for AI Studio; optional `GEMINI_API_KEY` in `.env` is not required for the Jira dashboard.
