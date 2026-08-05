# Defaults do usuário (mimyr)

Contrato dos defaults locais consumidos pelas skills do mimyr.

## Arquivo

`~/.claude/mimyr/defaults.md` — vale para qualquer workspace/sessão do usuário.

## Resolução de paths do workspace (regra única)

Os diretórios do workspace de curso se resolvem nesta ordem: (1) campo correspondente na
seção `## Paths do workspace` do `CLAUDE.md` do repositório atual; (2) campo dos defaults do
usuário neste arquivo; (3) convenção descoberta no cwd; (4) default documentado em cada campo
abaixo. Exatamente um candidato existente é usado; mais de um candidato concorrente exige
perguntar ao usuário; nenhum candidato cai no default documentado. Toda skill do mimyr resolve
por esta regra; os paths citados em skills, agents e exemplos são **ilustrativos do default,
não hardcode**.

## Campos permitidos

### Paths do workspace

- `local_cursos`: diretório dos cursos (default: `./courses/`).
- `local_templates`: diretório dos templates HTML (default: `./templates/`).
- `local_personas`: diretório das personas (default: `./personas/`).
- `local_transcricoes`: diretório das transcrições (default: `./transcriptions/`).
- `local_diagnosticos`: diretório dos diagnósticos (default: `./diagnostics/`).

### Tiering do gerar-curso

Quem aplica é o harness (`skills/gerar-curso/harness/curso.mjs`), que **não lê este arquivo**
(script de Workflow não tem filesystem) — a skill `gerar-curso` lê os campos abaixo e monta o
arg `tiering` da invocação. A whitelist é em código no script (tabela `MODELOS_STEP`):
promoção só dentro do papel (`escrever`: sonnet→opus), rebaixamento pra haiku só nos steps
mecânicos (`checks`; `estrutura` sob opt-in) — valor fora disso é ignorado com registro no
relatório (`modelos.recusados`), nunca aplicado. Campos ausentes = defaults embutidos do
script; não perguntar nada.

- `gerar_curso_perfil_padrao`: `Econômico` | `Balanceado` | `Máximo` — sugestão inicial do
  plano de custo (a escolha por execução continua sendo do usuário, por sessão).
- `gerar_curso_haiku`: `ligado` | `desligado` (default: ligado) — flag de rollback dos steps
  mecânicos em haiku. `desligado` → a skill monta o tiering com `checks=sonnet` (e
  `estrutura=sonnet`), ignorando o mapa por step para esses steps.
- `gerar_curso_escritor`: `sonnet` | `opus` (default: sonnet) — modelo-alvo do step
  `escrever` (um escritor por capítulo). `opus` promove a escrita quando a voz pede o tier
  acima; a promoção cai pra sonnet automaticamente (com registro em `fallbacks`) quando a
  chamada promovida não retorna.
- `gerar_curso_modelo_por_step`: mapa `step=modelo` separado por vírgula (ex.:
  `checks=haiku, estrutura=sonnet`). Steps: `estrutura`, `escrever`, `checks`, `lente`,
  `confirmacao`.
- `gerar_curso_effort_por_step`: mapa `step=effort` (`low`|`medium`|`high`|`xhigh`), ex.:
  `lente=xhigh, checks=low`. Defaults embutidos: checks=low, lente/confirmacao=high, demais
  herdam da sessão. Os steps de julgamento (`lente`, `confirmacao`) têm **piso `high`** —
  pedido abaixo é recusado pelo harness com registro, igual modelo fora da whitelist.

## Campos proibidos

- Tokens, senhas, API keys, cookies, refresh tokens.
- PII de terceiros.

## Protocolo

1. Skill que precise de um default: ler o arquivo. Se existe, usar os valores sem re-perguntar.
2. Arquivo ausente: **não perguntar nada e não montar `tiering`** — os defaults embutidos do
   script já são o comportamento certo (escrever=sonnet, checks=haiku·low, revisão opus·high).
3. Override mencionado na conversa vale só para a rodada (via arg `tiering`); regravar default
   só quando o usuário disser que virou padrão.
