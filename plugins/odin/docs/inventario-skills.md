# Inventário de capacidades do odin

> Mapa formal das skills e commands: o que cada peça faz, em que etapa da jornada entra,
> o que consome e produz, e onde há sobreposição conhecida. Complementa a
> `roteamento-matrix.md` (que cobre só a ativação). Atualizar sempre que uma skill,
> command ou artefato mudar de contrato.

Jornada de 5 etapas (camada de leitura sobre o double diamond — mapa completo em
`skills/descobrir/references/capa-template.md`):
**1 Descobrir · 2 Definir · 3 Explorar e especificar · 4 Entregar · 5 Acompanhar e aprender**

## Skills

| Skill | Objetivo | Etapa | Entradas | Saídas | Condições de ativação | Dependências | Sobreposições conhecidas |
|---|---|---|---|---|---|---|---|
| `descobrir` | Abrir o Diamante 1: levantar evidência antes de solução; catalogar materiais existentes; detectar tarefa disfarçada; calibrar a proporcionalidade do desafio novo (tier `expresso` × `completo` — a IA recomenda, o dono escolhe; no expresso a mesma conversa fecha o GATE E: problema + placar + 1-2 hipóteses) | 1 | Pedido/problema; capa (se existir); materiais prontos do dono | `desafio.md` (capa nova, com `Tier`), `descobertas.md` (só no completo; no expresso a evidência mínima entra no dossiê mínimo) | Desafio novo, sintoma, "por que a métrica caiu", `/descobrir`, `/desafio` sem desafio | `capa-template`, `contrato-de-conversa`, `metodologias-investigacao`, `metodologias-pesquisa` | Compartilha `metodologias-investigacao` com a exploração do `entregar` (Step 4a); no tier expresso absorve o essencial do DEFINE (régua fixada, baseline nunca inventado) |
| `definir` | Fechar o Diamante 1: problema como fenômeno, placar com régua fixada, hipóteses falseáveis; desafios técnicos (métrica ponte) | 2 | Capa com GATE 1; `descobertas.md`; ou solução técnica sem placar | `dossie.md` §§1-4 (e §6 semeada em desafio técnico) | Fechar problema/placar/hipóteses; "implementar BFF"/refactor sem placar; `/definir` | `capa-template`, `contrato-de-conversa`, `dossie-template`, `metodologias-definicao`, `desafios-tecnicos`, `modelo-desafios` | Solução técnica pronta ativa `definir`, não `entregar` (matriz #5-7) |
| `desenvolver` | Diamante 2, divergir: alavancas por hipótese, ranking aprendizado × reversibilidade, plano da rodada | 3 (explorar) | Capa com GATE 2; `dossie.md` com placar | `alavancas.md`, `plano.md`; dossiê §§5-6 | Dossiê fechado, priorizar, montar rodada; `/desenvolver` | `capa-template`, `contrato-de-conversa`, `metodologias-develop`, `priorizacao-ai-era`, `dossie-template` | Protótipo barato aqui vs entrega no `entregar`: aqui decide O QUE testar, lá executa |
| `entregar` | Diamante 2, convergir: entrega → SPEC → execução → validação com evidência → PR/publicação, com OK por step e portão anti-tarefa; cobre software (Steps 0-11) e não-software (dashboard, prompt/skill/agente, script/consulta/automação, documento/processo, experimento) na trilha por tipo; retomada idempotente (lê Estado + Log `[Step N]` antes de escrever; branch existente pergunta; mutação externa nunca se repete às cegas) | 3 (especificar, via `/spec`) e 4 | Entrega do `plano.md` (qualquer tipo), pedido de código, issue; defaults | `entregas/<slug>.md` (Implementation Pack: vínculo + SPEC + log + estado), branch, PR ou artefato publicado | Pedido de implementar/corrigir/produzir a entrega, formalizar SPEC; `/entregar`, `/spec` | `escada-ponytail` (fonte única da escada + portão TDD, compartilhada — o modo Solo carrega só ela), `dev-loop` (modo Loop; fonte única de custo/spec; só software), `steps-detalhados`, `tipos-de-entrega`, `capa-template`, `contrato-de-conversa`, opcional `superpowers:brainstorming` | `/spec` para no gate (não implementa); desafio disfarçado roteia pro `/desafio` (Step 0.5); construir o mecanismo de acompanhamento é `entregar`, lê-lo é `acompanhar` |
| `dev-loop` | Harness real multi-agente (script `skills/dev-loop/harness/loop.mjs` + agentes `operario`/`arquiteto`/`revisor`/`mecanico`): executa SPEC aprovada em loop até verde com invariantes em código (portão TDD, máx 3 iterações, 2 consultas/unidade, revisão adversarial, auditoria ponytail com dependência nova sem justificativa escrita no diff como bloqueante automático, sem apelação). Modelos por step configuráveis via defaults `dev_loop_*` dentro da whitelist em código (v2.3): `operario` = Sonnet, `revisor` = Opus, `arquiteto` = Fable por default com fallback mecânico pra Opus, `mecanico` = Haiku só nos steps mecânicos (validar; spec sob opt-in) | 4 (execução) | SPEC aprovada + branch de trabalho + perfil de custo + opt-in | Código + testes verdes na working tree + relatório estruturado (persistido no log da entrega) | "Roda o dev-loop", spec aprovada, perfil de custo; `/dev-loop` | `spec-template`, `escada-ponytail` (fonte única, compartilhada com `entregar`), `protocolo-revisao-adversarial`, `contrato-de-conversa`, `skills/dev-loop/harness/loop.mjs`, `agents/*`; invocada pelo `entregar` (modo Loop) | NÃO escreve nos artefatos do desafio além do relatório entregue ao chamador; exclusivo de software (frontmatter) |
| `acompanhar` | Cadência: re-medir com a MESMA régua, atualizar hipóteses, teste anti-tarefa, perseverar/pivotar/encerrar, post-mortem | 5 | Capa + dossiê + plano de desafio existente | Capa atualizada, dossiê §8 (diário do placar), post-mortem | "Como está o desafio", "o placar andou", checkpoint, encerramento; `/acompanhar` | `capa-template`, `contrato-de-conversa`, `metodologias-acompanhamento` | Status de UMA entrega é leitura simples (não ativa); status do DESAFIO ativa |

## Commands sem skill própria

| Command | O que faz | Reusa |
|---|---|---|
| `/desafio` | Roteador: lê a capa, apresenta a jornada de 5 etapas (posição, confiança, pendências) e roteia pela fase; trata artefato `⚠️ desatualizado`, entrada com materiais prontos e tier expresso (GATE E colapsa gates 1-3) | As 6 skills, `capa-template` |
| `/spec` | Produz/valida SPEC aprovada sem implementar (etapa 3, modo especificar) | `entregar` até o Step 4 + `spec-template` |
| `/defaults` | Consulta/atualiza `~/.claude/odin/defaults.md` | `entregar/references/defaults.md` |

## Regra de evolução

O usuário não precisa conhecer as skills: `/desafio` e as descriptions roteiam. Antes de
criar ou alterar uma skill, confira neste inventário se composição, ajuste, extensão ou
melhor orquestração das capacidades existentes resolve. Skill nova só com lacuna que não
fecha de outro jeito — e entra aqui e na `roteamento-matrix.md` no mesmo commit.
