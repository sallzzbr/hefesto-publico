# Plugins e Skills de Terceiros que Uso

Catálogo de referência do que está realmente instalado no meu Claude Code, com origem, descrição e como ativar.

> **Snapshot de 2026-04-29.** Reflete o setup desta máquina nesta data. Antes de replicar, rode `/plugin marketplace list` e `/plugin` no seu Claude Code pra ver o que está ativo hoje — versões e nomes mudam.

---

## Marketplaces ativos

| Marketplace | Origem | Pra que serve |
|-------------|--------|---------------|
| `claude-plugins-official` | [anthropics/claude-plugins-official](https://github.com/anthropics/claude-plugins-official) | Diretório oficial da Anthropic com plugins curados |
| `superpowers-marketplace` | [obra/superpowers-marketplace](https://github.com/obra/superpowers-marketplace) | Marketplace do Jesse Vincent (autor do `superpowers`) |
| `hefesto` | [sallzzbr/hefesto](https://github.com/sallzzbr/hefesto) | Meu próprio marketplace (hefesto = forja de plugins; bragir = voz/personas; odin = desafios) |
| `expo-plugins` | [expo/skills](https://github.com/expo/skills) | Skills oficiais da Expo |
| `railway-skills` | [railwayapp/railway-skills](https://github.com/railwayapp/railway-skills) | Skills oficiais da Railway |

---

## Plugins instalados (de terceiros)

### `superpowers` v5.0.7 — Jesse Vincent
Brainstorming, planos de implementação, TDD, debugging sistemático, code review, worktrees e subagents. É o canivete suíço de processo.

**Ativar:** `/plugin` → habilitar `superpowers@superpowers-marketplace`

Skills incluídas:

| Skill | Quando usar |
|-------|-------------|
| `brainstorming` | Antes de qualquer trabalho criativo — explorar ideias, requisitos e design |
| `writing-plans` | Quando tem spec/requisitos e precisa de plano de implementação multi-step |
| `executing-plans` | Executar plano de implementação em sessão separada com checkpoints |
| `subagent-driven-development` | Executar plano com subagents independentes na sessão atual |
| `dispatching-parallel-agents` | Quando tem 2+ tarefas independentes pra rodar em paralelo |
| `test-driven-development` | Antes de escrever código — TDD cycle |
| `systematic-debugging` | Quando encontrar bug — antes de propor fix |
| `requesting-code-review` | Ao completar tasks, antes de mergear |
| `receiving-code-review` | Ao receber feedback de review |
| `finishing-a-development-branch` | Quando implementação está completa, decidir merge/PR/cleanup |
| `using-git-worktrees` | Isolar feature work do workspace atual |
| `verification-before-completion` | Antes de clamar que algo está pronto — rodar verificação |
| `writing-skills` | Criar ou editar skills |
| `using-superpowers` | Auto-invocada no início de cada conversa |

Comandos: `/brainstorm`, `/write-plan`, `/execute-plan`. Agente: `code-reviewer`.

---

### `expo` v1.0.0 — Expo Team
Stack oficial pra Expo/React Native: build, deploy, upgrade, debug e UI nativa.

**Ativar:** `/plugin` → habilitar `expo@claude-plugins-official`

Skills incluídas (13):

| Skill | Quando usar |
|-------|-------------|
| `building-native-ui` | Construir UIs nativas com Expo Router |
| `expo-dev-client` | Build e distribuição de development clients (TestFlight, local) |
| `expo-deployment` | Deploy iOS App Store / Play Store / web / API routes |
| `expo-api-routes` | Criar API routes em Expo Router com EAS Hosting |
| `expo-cicd-workflows` | Escrever YAMLs de EAS workflows |
| `expo-module` | Escrever módulos nativos (Swift/Kotlin/TS) |
| `expo-tailwind-setup` | Setup de Tailwind v4 + react-native-css + NativeWind v5 |
| `expo-ui-swift-ui` | Usar `@expo/ui/swift-ui` (SwiftUI Views/modifiers) |
| `expo-ui-jetpack-compose` | Usar `@expo/ui/jetpack-compose` |
| `use-dom` | Rodar código web em webview no nativo (DOM components) |
| `native-data-fetching` | Network requests, React Query, SWR, loaders do Expo Router |
| `eas-update-insights` | Saúde de OTA updates (crashes, splits embedded vs OTA) |
| `upgrading-expo` | Upgrades de Expo SDK e fix de dependências |

---

### `railway` v1.1.1 — Railway
Operação de infra na Railway pelo Claude Code.

**Ativar:** `/plugin` → habilitar `railway@claude-plugins-official`

| Skill | Quando usar |
|-------|-------------|
| `use-railway` | Criar projetos/services/dbs, deploys, env vars, domains, buckets, métricas, troubleshooting |

---

## Skills WordPress (user-level, em `~/.claude/skills/`)

Skills do ecossistema WordPress instaladas direto na pasta do usuário (não vieram de marketplace registrado). 13 skills cobrindo todo o stack WP — de plugin/theme dev até performance, REST API e Playground.

| Skill | Quando usar |
|-------|-------------|
| `wordpress-router` | Classificar repo WP (plugin/theme/core/Gutenberg) e rotear pra skill certa |
| `wp-plugin-development` | Desenvolver plugins (hooks, activation, admin UI, security, packaging) |
| `wp-block-development` | Blocos Gutenberg (block.json, render dinâmico, deprecations) |
| `wp-block-themes` | Block themes (theme.json, templates, patterns, Site Editor) |
| `wp-rest-api` | Endpoints REST (register_rest_route, controllers, schema, auth) |
| `wp-abilities-api` | API de Abilities (`wp_register_ability`, REST exposure, permissions) |
| `wp-interactivity-api` | Interactivity API (`data-wp-*`, store/state/actions) |
| `wp-wpcli-and-ops` | WP-CLI: search-replace seguro, db, plugins/themes/users, multisite |
| `wp-playground` | WordPress Playground (browser/local, blueprints, debug) |
| `wp-performance` | Profiling e otimização backend (Query Monitor, autoload, cache, cron) |
| `wp-phpstan` | Configurar PHPStan em projetos WP (baselines, typing) |
| `wp-project-triage` | Inspeção determinística de repo WP — gera JSON estruturado |
| `wpds` | UIs com WordPress Design System (componentes, tokens, patterns) |

---

## Marketplaces pra descobrir mais

- [Anthropic Official](https://github.com/anthropics/claude-plugins-official) — diretório curado
- [Claude Marketplaces](https://claudemarketplaces.com/) — diretório com centenas de extensões
- [Build with Claude](https://buildwithclaude.com/) — 500+ extensões da comunidade
- [Awesome Claude Plugins](https://github.com/ComposioHQ/awesome-claude-plugins) — lista curada no GitHub

---

*Última atualização: 2026-04-29*
