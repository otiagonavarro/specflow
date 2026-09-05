<!-- markdownlint-disable -->
# Changelog

Todas as mudanças relevantes deste repositório são documentadas neste arquivo.

Este changelog foi gerado a partir do `git log` da branch `main`, sem tags de versão
disponíveis no histórico. O estado mais recente considerado é o commit `a45455b`
de 2026-07-16.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/).

---

## [2026-09-05]

### Changed

- chore(assets): update logo artwork — *Tiago Ribeiro Navarro de Andrade*

---

## [2026-09-03]

### Fixed

- fix(nimSpecGenerator): dedupe capability slugs and validate delta shape — *Tiago Ribeiro Navarro de Andrade*

---

## [2026-09-02]

### Added

- feat(server): generate OpenSpec-shaped specs (proposal, tasks, design, spec deltas) — *Tiago Ribeiro Navarro de Andrade*

### Changed

- chore(skills): add local workflow skills (tdd, codebase-design, productivity) — *Tiago Ribeiro Navarro de Andrade*

---

## [2026-07-25]

### Added

- docs: add MIT license — *Tiago Ribeiro Navarro de Andrade*
- rename(project): kanbam-code -> specflow — *Tiago Ribeiro Navarro de Andrade*

### Fixed

- fix(cli): stop using npm install -g <git-url> in "update" — *Tiago Ribeiro Navarro de Andrade*

---

## [2026-07-24]

### Added

- add skills — *Tiago Ribeiro Navarro de Andrade*
- feat(cli): add "kanbam-code update" for existing installs — *Tiago Ribeiro Navarro de Andrade*
- ci: rewrite CI for this repo, add tag-triggered CD release workflow — *Tiago Ribeiro Navarro de Andrade*
- docs: regenerate CHANGELOG from git log, add stack badges to README — *Tiago Ribeiro Navarro de Andrade*
- feat(dashboard): rework throughput and lead-time charts for readability — *Tiago Ribeiro Navarro de Andrade*
- feat(settings): allow choosing LLM provider and API key, override NVIDIA default — *Tiago Ribeiro Navarro de Andrade*

### Fixed

- fix(ci): scope markdownlint pathspec with :(glob) magic — *Tiago Ribeiro Navarro de Andrade*

---

## [2026-07-16] — `2b10b10` (PR #5)

### Chore
- Atualizado `package-lock.json` após `npm link` local, refletindo o campo `bin` e bumps de dependências transitivas.

## [2026-06-08] — `e013641` (PR #4)

### Docs
- Atualizações no README.

## [2026-05-24] — `0a526c9` (PR #3)

### Added
- Gerador de spec via NVIDIA NIM (`server/nimSpecGenerator.ts`), com API key e modelo configuráveis por `NVIDIA_API_KEY` / `NVIDIA_SPEC_MODEL`.
- `nvidiaDefaults.ts` centralizando credenciais padrão da NVIDIA.
- Rotas de spec (`server/routes/spec.ts`) e `specflowWriter.ts` para persistir specs geradas.
- `repoContext.ts` para introspecção do repositório local (git-aware).
- `ideLauncher.ts` para abrir arquivos no VS Code / Cursor / JetBrains.
- Componente de ícones de marca de IDE (`src/components/IdeBrandIcons.tsx`).
- `ideDeepLinks.ts` para geração de deep links de editores.
- Cliente de API de spec (`src/api/spec.ts`); atualização da API de workspace.
- `AGENTS.md` com documentação de agentes/automação; diretório `openspec/` com artefatos de spec.

### Changed
- `OpenSpecMenu`, `IssueDetailModal`, `EpicDetail` atualizados para o fluxo de geração de spec.
- `bin/specflow.mjs` marcado como executável; fluxo `npx --package=github:` aprimorado.
- README atualizado com instruções de npx hospedado no GitHub e variável `SPECFLOW_HOME`.
- `.env.example` com placeholders de `NVIDIA_API_KEY` e `NVIDIA_SPEC_MODEL`.

## [2026-04-09] — `28cc41a` (PR #2)

### Docs
- README expandido: link do repositório, visão geral de funcionalidades (issues, métricas de board com janela histórica), modelo de segurança das Settings, CLI, nota sobre UI em PT-BR, passos de verificação e scripts de list/preview/clean.

## [2026-04-09] — `bf7f22b` (PR #1)

### Added
- UI React completa em português do Brasil.
- Integração com API do Jira via servidor Express local (proxy).
- Fluxos de Settings e Projects; Issues com paginação; dashboards de board com janela histórica configurável.
- CLI `specflow` (`create`/`init`), scripts de init com portas altas por padrão, `--strictPort` no Vite.
- `package-lock.json`, tsconfig do servidor, locales, hooks e mapa de planejamento.
- README com orientação de uso via npx a partir do GitHub e `npm run list`.

## [2026-04-05] — `b3a5093`

### Added
- Estrutura inicial do projeto (Monolith OS): README, `.gitignore`, `package.json`, configuração de Vite, TypeScript e tooling relacionado.

## [2026-04-05] — `0748abb`

### Added
- Commit inicial do repositório.
