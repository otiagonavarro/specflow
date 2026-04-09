<!-- markdownlint-disable -->
# Codebase map — kanbam-code

**Generated:** 2026-04-09

## Executive summary

This repository is a **React 19 + Vite 6** single-page app with a **separate Express proxy** (`server/`) that holds Jira (and optional GitHub) credentials in **process environment** / `.env` and forwards calls to **Jira REST API v3** and **Jira Agile REST 1.0**. The browser never sends Jira tokens; it calls same-origin `/api/*`, which Vite proxies to `SERVER_PORT` (default **58471**). Issue lists use **JQL search with `nextPageToken` pagination** (`/rest/api/3/search/jql` via the proxy). Board views map issues to columns using **board configuration from Agile API** plus **`jiraBoardColumns` / `jiraStatusUi` fallbacks**. UI strings for navigation and most screens go through **`src/locales/`** (Brazilian Portuguese messages). **No automated test suite** is present in the repo (`npm run lint` is `tsc --noEmit` only).

---

## Tech stack

| Layer | Technology | Notes |
|--------|------------|--------|
| UI | React 19, `react-dom` | Entry: `src/main.tsx`, root app: `src/App.tsx` |
| Styling | Tailwind CSS 4, `@tailwindcss/vite` | `src/index.css`, Vite plugin |
| Motion | `motion` (Framer Motion successor) | Page transitions, buttons |
| Icons | `lucide-react` | |
| Markdown | `react-markdown`, `remark-gfm` | e.g. OpenSpec CLI output |
| Build / dev | Vite 6, `@vitejs/plugin-react` | Dev UI port **58470**; defaults in `scripts/dev-ports.mjs` |
| Backend | Express 4, `tsx` + `tsconfig.server.json` | `server/index.ts` |
| Config load | `dotenv` | Server loads `.env` from cwd; see `server/index.ts` |
| TypeScript | ~5.8 | Strict checking via `tsc --noEmit` |
| AI (dependency) | `@google/genai` in `package.json`, `GEMINI_API_KEY` in `vite.config.ts` `define` | **Not imported under `src/`** in current tree; `ProposalFlow` is a static/demo UI |

---

## Directory map (high signal)

```shell
kanbam-code/
├── server/
│   ├── index.ts              # Express app, mounts routers, /api/health
│   ├── envFile.ts            # Read/write .env map; JIRA_ENV_KEYS, GITHUB_ENV_KEYS
│   ├── localRepo.ts          # Resolve repo paths under LOCAL_REPOS_ROOT
│   ├── openspecRunner.ts     # OpenSpec CLI invocation
│   └── routes/
│       ├── config.ts         # GET/POST/DELETE /api/config → .env
│       ├── jira.ts           # Jira proxy (largest route module)
│       ├── github.ts         # GitHub API proxy
│       └── workspace.ts      # Local repos listing, OpenSpec endpoints
├── src/
│   ├── main.tsx              # StrictMode + LocaleProvider + App
│   ├── App.tsx               # View router, TopBar/Sidebar, NewIssueModal
│   ├── api/                  # Browser fetch wrappers → /api/*
│   ├── components/           # Screens and modals
│   ├── hooks/                # useIssues, useBoardColumns, useBoardScope, useJiraMyself
│   ├── lib/                  # jiraBoardColumns, jiraStatusUi, openspecBindings
│   └── locales/              # LocaleProvider, messages (pt-BR UI copy)
├── scripts/
│   ├── dev-ports.mjs         # DEFAULT_UI_DEV_PORT / DEFAULT_API_PORT (58470 / 58471)
│   └── run-init.mjs          # `npm run init`: API then Vite
├── vite.config.ts            # /api → 127.0.0.1:SERVER_PORT, alias `@`
├── tsconfig.server.json      # Server TypeScript project
├── .env.example              # Documented env vars (no secrets)
└── package.json              # dev, server, build, lint scripts
```

---

## Architecture

### Client / server boundary

1. **Browser** loads the Vite app from port **58470** by default (high-range ports to avoid common dev collisions).
2. **Relative fetches** to `/api/...` hit the Vite dev server, which **proxies** to Express (`vite.config.ts`).
3. **Express** (`server/index.ts`) reads `JIRA_*`, `GITHUB_*`, `LOCAL_REPOS_ROOT`, `SERVER_PORT` from **`process.env`** (after `dotenv` + optional writes from Settings).
4. **Jira calls** use **Basic auth** (`email:api_token`) from env only — see `resolveCreds` in `server/routes/jira.ts`.
5. **Config API** (`server/routes/config.ts`) **merges** integration settings into the **`.env` file** via `server/envFile.ts`, then `reloadDotenv()`.

### Data flow (Jira)

```text
Component → src/api/jira.ts (fetch)
         → /api/jira/* (Vite proxy)
         → server/routes/jira.ts
         → https://{JIRA_DOMAIN}/rest/api/3/...  OR  .../rest/agile/1.0/...
```

- **Issue search / pagination:** `POST /api/jira/issues/jql` → server `postSearchJqlToAtlassian` → Jira **`/rest/api/3/search/jql`** with `nextPageToken` (see `server/routes/jira.ts` ~L121–L128, L699–L716).
- **Agile boards / columns / scope:** `jiraAgileFetch` → `/rest/agile/1.0/board`, board configuration, etc.
- **Avatars:** `GET /api/jira/avatar-proxy` avoids exposing credentials to the client for image URLs.

### API surface (Express)

| Prefix | Router file | Purpose |
|--------|-------------|---------|
| `/api/config` | `server/routes/config.ts` | Read/write Jira + local workspace paths to `.env` |
| `/api/jira` | `server/routes/jira.ts` | Jira REST/Agile proxy (myself, issues, JQL, transitions, boards, projects, metrics, avatar proxy, …) |
| `/api/github` | `server/routes/github.ts` | `GET /prs`, `/repo`, `/recent-prs` (token from env) |
| `/api/workspace` | `server/routes/workspace.ts` | `GET /local-repos`, OpenSpec `openspec-status`, `openspec-changes`, `POST openspec-run` |
| `/api/health` | `server/index.ts` | Liveness + flags for Jira/local repos config |

**Client mirrors:** `src/api/config.ts`, `src/api/jira.ts`, `src/api/github.ts`, `src/api/workspace.ts`, `src/api/types.ts`.

---

## Main user flows

| Flow | Entry | Key files |
|------|--------|-----------|
| **Projects → Board insights** | Sidebar **Projetos** → pick board | `src/components/Projects.tsx` → `App.tsx` sets `board-dashboard` → `src/components/BoardDashboard.tsx` (`fetchBoardMetrics`, `fetchJiraBoards`) |
| **Epics (dashboard)** | Sidebar **Épicos** | `src/components/Dashboard.tsx` — JQL epics (`jqlAllEpics`, `jqlEpicsForProject`), `useJiraJqlPages`, optional board scope via `useDefaultBoardScopeJql` |
| **Epic detail / proposal** | Click epic on dashboard | `EpicDetail.tsx`, `ProposalFlow.tsx` (top bar also opens proposal) |
| **Issues** | Sidebar **Issues** | `src/components/Issues.tsx` — project/all JQL builders, filters, list vs board, `IssueDetailModal`, `PaginationBar` |
| **My Issues** | Sidebar **Minhas issues** | `src/components/MyIssues.tsx` — `buildAssigneeIssuesJql`, same pagination/column patterns as Issues |
| **Inbox** | Sidebar **Inbox** | `src/components/Inbox.tsx` — **local mock state only** (no Jira notifications API wired) |
| **Settings** | Sidebar **Configurações** | `src/components/Settings.tsx` — Jira form, `saveIntegrationPayload`, local repos via `fetchLocalRepoFolders`, profile via `useJiraMyself` |
| **New issue** | FAB / sidebar | `src/components/NewIssueModal.tsx` → `POST /api/jira/issues` |

View state is **in-memory** in `App.tsx` (`currentView`, `selectedEpic`, `boardForDashboard`); no React Router in the paths above.

---

## Notable patterns

### Pagination (`useIssues` / JQL)

- `src/hooks/useIssues.ts` — `useJiraJqlPages`: loads first page, then **appends** pages when user goes “next” and server returns `nextPageToken`.
- Default page size constant: `DEFAULT_JQL_PAGE_SIZE` (**25**) in `src/api/jira.ts`.
- In-memory **cache** (30s TTL) for some issue fetches in `src/api/jira.ts` (`Map` + `CACHE_TTL_MS`).
- UI: `src/components/PaginationBar.tsx`.

### Board columns and status mapping

- Server exposes **`GET /api/jira/board/:boardId/columns`** — parses Agile board **column configuration** (status names/ids): `parseBoardConfigurationColumns` in `server/routes/jira.ts`.
- Client **`useBoardColumns`** (`src/hooks/useBoardColumns.ts`) → `fetchBoardColumns` in `src/api/jira.ts`.
- **`buildBoardColumnModel`** (`src/lib/jiraBoardColumns.ts`) assigns each issue to a column by **statusId** first, then exact/normalized status name; overflow → **“other”** column.
- If columns are missing, **`fallbackColumnsFromIssues`** derives columns from distinct statuses (sorted with `jiraStatusSortWeight`).
- **`jiraStatusUi.ts`** — `categorizeJiraStatus`, presentation helpers, done-like detection; used by Dashboard epics and issue rows.

### Locales

- **`LocaleProvider`** wraps the app in `src/main.tsx`.
- Copy lives in `src/locales/messages.ts`; helpers in `src/locales/LocaleContext.tsx`, `src/locales/index.ts`.
- **`App.tsx` / `Sidebar` / `TopBar` / major screens** use `useLocale().t(...)` for Portuguese UI.
- **Exception:** `Settings.tsx` defines `SECTIONS` with **English** labels (`Workspace`, `Profile`, …) — mixed with `t()` elsewhere in the same file.

---

## External integrations

| Service | How | Credentials |
|---------|-----|-------------|
| **Jira Cloud/Server** | REST v3 + Agile 1.0 via proxy | `JIRA_DOMAIN`, `JIRA_EMAIL`, `JIRA_API_TOKEN`; optional `JIRA_PROJECT_KEY`, `JIRA_BOARD_ID` |
| **GitHub** | `api.github.com` from `server/routes/github.ts` | `GITHUB_TOKEN`; repos from `GITHUB_REPOS` or legacy `GITHUB_REPO` |
| **Local filesystem** | `LOCAL_REPOS_ROOT` — subfolders as repos | Set in `.env` or Settings; server must access path |
| **OpenSpec** | `server/openspecRunner.ts` + workspace routes | Optional `OPENSPEC_CLI_PATH` in `.env.example` |

---

## Configuration / environment

- **Documented template:** `.env.example` (Jira, `LOCAL_REPOS_ROOT`, `SERVER_PORT`, `GEMINI_API_KEY`, `APP_URL`).
- **Runtime merge:** Saving integrations in the app updates **`.env`** through `server/routes/config.ts` and `server/envFile.ts` (keys listed in `JIRA_ENV_KEYS`, `GITHUB_ENV_KEYS`).
- **Client config cache:** `src/api/config.ts` — `loadConfigFromServer` on app boot; `getConfig()` / `isJiraConfigured()` for gating API calls.
- **Vite:** `SERVER_PORT` selects proxy target; `GEMINI_API_KEY` injected as `process.env.GEMINI_API_KEY` at build time for client bundle (currently unused in `src/`).

---

## Risks / tech debt callouts

1. **`NODE_TLS_REJECT_UNAUTHORIZED = '0'`** in `server/index.ts` — disables TLS verification for all server-side HTTPS (including Jira/GitHub). Risk for MITM; should be scoped or removed for production.
2. **Secrets in `.env` on disk** — expected for local dev; ensure `.env` is gitignored and never committed (orchestration/docs only reference `.env.example`).
3. **No tests** — no `*.test.*` / `*.spec.*`; regressions rely on manual checks.
4. **`@google/genai` / Gemini** — dependency present; **no current usage in `src/`**; README still references Gemini setup — easy to confuse future agents.
5. **Inbox** — UI shell without backend (`src/components/Inbox.tsx`).
6. **`ProposalFlow`** — demo/static logs, not wired to deployment or Gemini.
7. **Large route module** — `server/routes/jira.ts` is very long (~1200+ lines); harder to navigate and test.
8. **Mixed locale discipline** — some English strings remain in Settings section headers.

---

## Suggested next docs

- **`.planning/codebase/ARCHITECTURE.md`** — deeper sequence diagrams per feature (if using GSD mappers).
- **Runbook:** exact dev commands (`npm run dev` + `npm run server`), port matrix, and required Jira scopes for API tokens.
- **JQL catalog:** document builders in `src/api/jira.ts` (`buildAllIssuesJql`, `buildAssigneeIssuesJql`, epic JQL helpers) for support/debugging.
- **OpenSpec:** document expected repo layout under `LOCAL_REPOS_ROOT` and CLI contract from `server/openspecRunner.ts`.

---

*End of codebase map.*
