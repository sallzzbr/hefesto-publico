# Defaults do usuário (Odin)

Contrato compartilhado entre as skills do Odin e o comando `/defaults`.

## Arquivo

`~/.claude/odin/defaults.md` — vale para qualquer projeto/sessão do usuário.

## Resolução de paths do workspace (regra única)

Resolver nesta ordem: (1) campo correspondente na seção `## Paths do workspace` do
`CLAUDE.md`; (2) campo dos defaults do usuário neste arquivo; (3) convenção descoberta no cwd;
(4) default documentado em cada campo abaixo. Exatamente um candidato existente é usado; mais
de um candidato concorrente exige perguntar; nenhum candidato cai no default documentado. Os
paths literais são ilustrativos do default, não hardcode. O contrato completo é a regra 7 de
`../../descobrir/references/capa-template.md`.

## Campos permitidos

- `idioma`: idioma de commit/PR/reporte (default: pt-BR).
- `perfil_custo_padrao`: Econômico | Balanceado | Máximo — sugestão inicial do dev-loop
  (a escolha por execução continua sendo do usuário, por sessão).
- `convencao_branch`: padrão de nome de branch (default: `feat/<entrega-slug>`).
- `local_desafios`: onde criar desafios no projeto (default: `docs/desafios/`);
  legado: `local_missoes` é lido como fallback.
- `local_specs`: onde vivem as entregas avulsas/SPECs (default: `docs/plans/`).
- `local_pendencias`: arquivo local de desvios/débitos, nunca commitado
  (default: `docs/pendencias.md`).
- `abrir_pr_padrao`: `pr` | `commit-local` | `perguntar` (default: perguntar).

### Tiering do dev-loop (v2.3)

Quem aplica é o harness (`skills/dev-loop/harness/loop.mjs`), que **não lê este arquivo** —
a skill `dev-loop` lê os campos abaixo e monta o arg `tiering` da invocação. A whitelist é em
código no script (tabela `MODELOS_STEP`): promoção só dentro do papel (consulta: opus→fable),
rebaixamento pra haiku só nos steps mecânicos (`validar`; `spec` sob opt-in) — valor fora
disso é ignorado com registro no relatório, nunca aplicado. Campos ausentes = defaults
embutidos do script; não perguntar nada.

- `dev_loop_haiku`: `ligado` | `desligado` (default: ligado) — flag de rollback dos steps
  mecânicos em haiku. `desligado` → a skill monta o tiering com `validar=sonnet` (e
  `spec=sonnet`), ignorando o mapa por step para esses steps.
- `dev_loop_arquiteto`: `fable` | `opus` (default: fable) — modelo-alvo do arquiteto nos
  DOIS papéis: advisor (step `consulta` do loop) e planner (autoria/decomposição de SPEC —
  com fable, até sessão Opus despacha o agente promovido em vez de autorar direto); fable cai
  pra opus automaticamente quando o tier não responde.
- `dev_loop_modelo_por_step`: mapa `step=modelo` separado por vírgula (ex.:
  `validar=haiku, spec=sonnet`). Steps: `spec`, `tdd`, `impl`, `consulta`, `validar`,
  `auditoria`, `lente`, `confirmacao`.
- `dev_loop_effort_por_step`: mapa `step=effort` (`low`|`medium`|`high`|`xhigh`), ex.:
  `consulta=xhigh, validar=low`. Defaults embutidos: consulta=xhigh, validar=low,
  auditoria/lente/confirmacao=high, demais herdam da sessão. Os steps de julgamento
  (`consulta`, `auditoria`, `lente`, `confirmacao`) têm **piso `high`** — pedido abaixo é
  recusado pelo harness com registro, igual modelo fora da whitelist.

## Campos proibidos

- Tokens, senhas, API keys, cookies, refresh tokens.
- PII de terceiros.

## Protocolo

1. Skill que precise de um default: ler o arquivo. Se existe, usar os valores sem re-perguntar.
2. Arquivo ausente ou campo ausente: continuar para a convenção descoberta no cwd e depois o
   default documentado; não perguntar apenas porque os defaults do usuário não existem.
3. Override mencionado na conversa vale só para a rodada; regravar default só quando o usuário
   disser que virou padrão.
4. `/defaults` consulta ou atualiza esse arquivo sem iniciar fluxo de entrega.

## `/defaults`

Ao atualizar: mostrar valores atuais → perguntar qual campo → confirmar o novo valor → salvar
só campos permitidos → reportar o caminho do arquivo.
