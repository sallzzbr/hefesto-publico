---
destino: fontes
aplicaA: "Fontes primárias dos cartões, datas de consulta e procedimento de atualização"
consultadoEm: 2026-11-01
revisarAte: 2027-02-01
fontes: [A1, A2, A3, A4, A5, A6, A7, A8, A9, O1, O2, O3, O4, O5, O6, O7, O8, G1, G2]
---

# Fontes e atualização

Toda orientação dos cartões cita um ID desta tabela. Consulta feita em 2026-11-01. "Acesso"
diz como o texto foi lido: `direto` (página oficial lida), `espelho oficial` (cópia mantida
pelo próprio provedor num repositório oficial), `trecho de busca` (só o resumo do buscador —
usado apenas como pista, nunca como base de orientação).

| ID | Fonte | Escopo | Acesso | Volatilidade |
|---|---|---|---|---|
| A1 | [Prompting best practices](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices) | Modelos Claude atuais; técnicas gerais e agentes | direto | média |
| A2 | [Prompting Claude Opus 5.5](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5-5) | Opus 5.5 | direto | alta |
| A3 | [Prompting Claude Fable 5.1](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-fable-5-1) | Fable 5.1 / Mythos 5.1 | direto | alta |
| A4 | [Prompting Claude Sonnet 5.5](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-sonnet-5-5) | Sonnet 5.5 | direto | alta |
| A5 | [Prompting Claude Haiku 5.5](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-haiku-5-5) | Haiku 5.5 | direto | alta |
| A6 | [Claude Code: subagents](https://code.claude.com/docs/en/sub-agents) | Claude Code (produto) | direto | média |
| A7 | [Claude Code: skills](https://code.claude.com/docs/en/skills) | Claude Code (produto) | direto | média |
| A8 | [Claude Code: best practices](https://code.claude.com/docs/en/best-practices) (dateModified 2026-10-30) | Claude Code (produto): instruções determinísticas × não determinísticas, conselhos superados | direto | média |
| A9 | [Prompting Claude Opus 5](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5) | Opus 5 (e ponto de partida declarado do Opus 5.5) | direto | alta |
| A10 | [Claude Code: memória e `CLAUDE.md`](https://code.claude.com/docs/en/memory) | Claude Code (produto): carga e consistência de instruções | direto | média |
| O1 | [GPT-6 prompting best practices — cópia em openai/codex](https://github.com/openai/codex/blob/4b4a5cf25aa5b064c866218b405c848745fd280f/codex-rs/skills/src/assets/samples/openai-docs/references/prompting-guide.md) (página viva: `developers.openai.com/api/docs/guides/latest-model/gpt-6-astra.md#prompting-best-practices`) | Família GPT-6 | espelho oficial | alta |
| O2 | [Upgrading to the GPT-6 model family — cópia em openai/codex](https://github.com/openai/codex/blob/4b4a5cf25aa5b064c866218b405c848745fd280f/codex-rs/skills/src/assets/samples/openai-docs/references/upgrading-to-gpt-6-astra.md) | Migração GPT-6 (API e prompts) | espelho oficial | alta |
| O3 | [Skill Creator do Codex](https://github.com/openai/codex/blob/4b4a5cf25aa5b064c866218b405c848745fd280f/codex-rs/skills/src/assets/samples/skill-creator/SKILL.md) | Codex (produto): escrita de skills | espelho oficial | média |
| O4 | [Codex self-knowledge](https://github.com/openai/codex/blob/4b4a5cf25aa5b064c866218b405c848745fd280f/codex-rs/skills/src/assets/samples/openai-docs/references/codex-self-knowledge.md) | Codex (produto): superfícies de customização | espelho oficial | média |
| O6 | [GPT-5.6 prompting — julgamento de migração, cópia em openai/codex](https://github.com/openai/codex/blob/a5082373f18119dc5d3eb993267c97f37880935d/codex-rs/skills/src/assets/samples/openai-docs/references/prompting-guide.md) (versão histórica de 2026-07-29; página viva: `developers.openai.com/api/docs/guides/model-guidance?model=gpt-5.6#prompting-best-practices`) | GPT-5.6; o próprio arquivo diz ser julgamento de migração, não a seção viva literal | espelho oficial | média |
| O7 | [GPT-5.5 prompting guide — openai/skills](https://github.com/openai/skills/blob/49f948faa9258a0c61caceaf225e179651397431/skills/.curated/openai-docs/references/prompting-guide.md) | GPT-5.5 | espelho oficial | média |
| O8 | Código do Codex em [openai/codex@4b4a5cf](https://github.com/openai/codex/tree/4b4a5cf25aa5b064c866218b405c848745fd280f/codex-rs): `core/src/tools/handlers/multi_agents_spec.rs` (herança de modelo no spawn), `core/src/agent/child_config.rs` (`model` por chamada e `default_subagent_model`), `core/src/tools/handlers/multi_agents_v2/spawn.rs` e `multi_agents/spawn.rs` (herança da conversa: `fork_turns`, `fork_context`), `features/src/lib.rs` (`multi_agent_v2` desligado por padrão) e `ext/skills/src/catalog_prompt.rs` (leitura de skill pelo agente principal) | Codex (produto): subagentes e skills; lido, não executado | espelho oficial | alta |
| O5 | [Model migration and prompting](https://github.com/openai/codex/blob/4b4a5cf25aa5b064c866218b405c848745fd280f/codex-rs/skills/src/assets/samples/openai-docs/references/model-migration.md) | Escolha de guia por modelo-alvo | espelho oficial | média |
| G1 | [Prompting techniques — google-gemini/cookbook](https://github.com/google-gemini/cookbook/blob/b06b824cf2ea29f9543ffa14adcee68b5f934a9b/examples/prompting/README.md) | Técnicas genéricas para a API Gemini | espelho oficial | média |
| G2 | [README do google-gemini/cookbook](https://github.com/google-gemini/cookbook/blob/b06b824cf2ea29f9543ffa14adcee68b5f934a9b/README.md) | Modelos em destaque na data | espelho oficial | alta |

Limitação da consulta de 2026-11-01: `developers.openai.com`, `platform.openai.com`,
`cookbook.openai.com` e `ai.google.dev` estavam bloqueados na rede do ambiente; as fontes O*
vieram do repositório oficial `openai/codex` no commit `4b4a5cf` (2026-11-01) e as G* do
`google-gemini/cookbook` no commit `b06b824` (2026-10-27). A página oficial de prompting do
Gemini não foi lida; o cartão Gemini é deliberadamente genérico.

## Como atualizar (manutenção do plugin)

1. Para cada cartão com `revisarAte` vencido, ou quando o provedor anunciar nova família:
   abra cada fonte da tabela; procure páginas novas por modelo (a página A1 lista as páginas
   por modelo; a O5 aponta o guia vigente da OpenAI).
2. Troque afirmações que mudaram, cite o ID, atualize `consultadoEm` e `revisarAte` (padrão: +3
   meses) e a coluna "Acesso". Fonte só por trecho de busca não sustenta orientação.
3. Orientação que vale só para um modelo vai na tabela "por modelo" do cartão, nunca em
   `principios.md`. Algo só entra nos princípios se os dois provedores o dizem.
4. Rode `node --test plugins/iris/tests/contratos.test.mjs` (formato, IDs e datas) e registre no CHANGELOG.

Quem usa o plugin não edita estes arquivos: a skill avisa quando `revisarAte` passou e trata
a orientação como possivelmente desatualizada.
