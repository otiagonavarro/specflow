---
name: pr-template
description: Use sempre que for solicitado a fazer commit + push + abrir PR (git-commit, "faça o PR", "abre um PR", "cria a pull request"). Garante que o corpo do PR siga o template oficial do repo em .github/pull_request_template.md em vez de um resumo livre.
---

# PR usando template do repositório

Este repo tem um template de PR fixo em `.github/pull_request_template.md`. Sempre
que o pedido for para commitar, dar push e abrir PR, o corpo do PR (`gh pr create --body`)
DEVE seguir esse template — não escrever um `## Summary` / `## Test plan` genérico.

## Passos

1. Ler `.github/pull_request_template.md` antes de montar o body (o template pode mudar).
2. Preencher cada seção com conteúdo real da mudança, mantendo os cabeçalhos exatos:
   - `# Descrição`
   - `## Contexto` — por que a mudança existe
   - `## Serviço afetado` — `agent-platform` | `ai-agents` | `monorepo (raiz)`
   - `## Mudanças Realizadas` — lista das mudanças principais
   - `## Impacto` — deploy, Slack, notebooks, etc.
   - `## Como Testar`
   - `## Tarefas Relacionadas` — link Jira `AN-XXXX`; se não houver ticket, remover a linha ou marcar `N/A` (nunca deixar `AN-XXXX` de placeholder)
   - `## Observações`
3. Passar esse conteúdo preenchido via `--body "$(cat <<'EOF' ... EOF)"` no `gh pr create`.
4. Mensagem de commit segue convenção normal do repo (conventional commits, ex.: `fix(notebooks): ...`) — o template rege só o corpo do PR, não a mensagem de commit.

## Quando NÃO usar

Se o usuário pedir explicitamente um formato de PR diferente do template, seguir o pedido dele.
