<!-- markdownlint-disable -->
# Changelog

Todas as mudanças relevantes deste repositório são documentadas neste arquivo.

Este changelog foi gerado a partir do `git log` da branch `main`, sem tags de versão
disponíveis no histórico. O estado mais recente considerado é o commit `a45455b`
de 2026-07-16.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/).

---

## [0.1.0] — 2026-10-20

Primeira release versionada. Publicada como GitHub Release (com o `dist/` em zip)
e como pacote npm `@otiagonavarro/specflow` no GitHub Packages.

### Added
- Geração de artefatos `.specflow/<feature>/` (`intent.md`, `spec.md`, `plan.md`, `provenance.json`) seguindo o playbook AI-native SDLC.
- Review do PR aberto da task (AI-native SDLC Stage 5), com publicação opcional do review no GitHub.
- Respostas do LLM via streaming, suporte ao SDK da Anthropic e modelo separado para review.
- Antigravity IDE e Kiro na seção "Open in IDE".
- Specs no formato OpenSpec (proposal, tasks, design) geradas pelo servidor.
- Escolha de provedor de LLM e API key nas Settings.
- Comando `specflow update` para instalações existentes.
- Workflow de CD disparado por tag, criando a GitHub Release e publicando o pacote.

### Changed
- Projeto renomeado de `kanbam-code` para `specflow`; licença MIT adicionada.
- Gráficos de throughput e lead time do dashboard reformulados para facilitar a leitura.
- Logo atualizado.

### Fixed
- Seta do dropdown "Local repository" desalinhada e painel do OpenSpec cortando o conteúdo depois do aviso de salvo.
- Favicon do app.
- Chave da NVIDIA lida do `.env` e modelos padrão aposentados substituídos.
- Endurecimento da geração de artefatos e do review de PR conforme feedback de review.
- `specflow update` não usa mais `npm install -g <git-url>`.

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
