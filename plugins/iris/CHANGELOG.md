# Changelog — iris

## 0.1.2

Referências operacionais pessoais abstraídas e consumidores atualizados para o contrato de perfil local do autor.

## 0.1.1

- Registra observação do Codex CLI 0.155.1: contexto herdado com a flag v2 desligada e ligada; isolamento depende do schema exposto, preservando O8 como evidência histórica de código.

- Preserva a fronteira de aprovação para ações destrutivas e efeitos externos ao enxugar perguntas redundantes; teste de contrato após avaliação em sessão Codex real.

## 0.1.0 (2026-11-01)

Primeira versão. Duas skills (`escrever-prompt`, `delegar-agente`), princípios comuns e cartões
por destino (Claude, OpenAI/Codex, Gemini, desconhecido) com fontes oficiais datadas. Consulta
de 2026-11-01; sites da OpenAI e do Google estavam bloqueados no ambiente e as fontes OpenAI
vieram do repositório oficial `openai/codex` (commit `4b4a5cf`).

O README descreve a integração com a forja como dependência declarada: a forja 4.1.0 exige a
`iris` no Claude Code, então instalar a forja instala a `iris`, e desativar a `iris` desativa a
forja. A distribuição Codex da forja não declara essa dependência.

Antes de publicar, duas lentes revisaram fontes e uso; os achados foram conferidos nas fontes:

- O checklist mandava cortar "verifique antes de terminar" como se todo modelo atual já
  verificasse. Isso vale para Opus 5/5.5 e GPT-6; Haiku 5.5 e Sonnet 5.5 em effort baixo pedem o
  contrário. A linha do Sonnet 5.5 separa `low`/`medium` (para cedo) de `xhigh`/`max` (revisa
  demais), que pedem correções opostas.
- "Tire do brief o que o `CLAUDE.md` já diz" valia sem exceção; Explore, Plan e agentes com
  `omitClaudeMd` não carregam `CLAUDE.md`. `CLAUDE_CODE_SUBAGENT_MODEL` é padrão, não imposição
  (só com `_FORCE=1`), e um mod com hook `agent.spawn` troca o modelo da chamada.
- No Codex, o `spawn_agent` com `multi_agent_v2` copia a conversa por padrão (`fork_turns`):
  revisor independente precisa de `fork_turns: "none"`.
- O princípio "instrução conflitante" ganhou fonte Anthropic (A10, memória do Claude Code); o de
  "mudança por evidência" cita os blocos condicionais de A4/A5.
- Destino informado só pela família ou para mais de um destino tem regra própria; `delegar-agente`
  pergunta o destino em agente autônomo como `escrever-prompt` (eval 07) e não reabre a decisão
  de delegar já tomada pelo fluxo chamador. README alinhado às integrações que existem.
