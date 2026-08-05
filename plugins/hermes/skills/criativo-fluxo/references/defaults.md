# Defaults do usuário — hermes (contrato)

Arquivo: `~/.claude/hermes/defaults.md`. Lido pelas **skills** do hermes (o harness não tem
filesystem — a skill traduz os campos nos args `tiering` e `dirs`). Campos ausentes =
defaults embutidos do script. Formato: um campo por linha, `campo: valor`.

## Resolução de paths do workspace (regra única)

Os diretórios-base do workspace se resolvem nesta ordem: (1) campo correspondente na seção
`## Paths do workspace` do `CLAUDE.md` do repositório atual; (2) campo dos defaults do usuário
neste arquivo; (3) convenção descoberta no cwd; (4) default documentado na tabela abaixo.
Exatamente um candidato existente é usado; mais de um candidato concorrente exige perguntar ao
usuário; nenhum candidato cai no default documentado. Toda skill do hermes resolve por esta
regra; paths citados em skills, agents e no harness são **ilustrativos do default, não
hardcode**. A skill `criativo-fluxo` injeta as bases resolvidas no harness via arg `dirs`
(mesmo padrão do `tiering` — o harness nunca lê config).

| Campo | Default | O que é |
|---|---|---|
| `local_marketing` | `marketing/` | Base de criativos, registry, referências, produção e inteligência |
| `local_branding` | `branding/` | Princípios criativos, arquétipos, tom de voz aplicado |
| `local_contexto` | `contexto/` | Identidade visual e cérebro do negócio |
| `local_financeiro` | `financeiro/` | Relatórios (unit-economics, P&L) e ledger |
| `local_scripts` | `scripts/` | Scripts Pillow/GA4 do workspace (com `.venv`) |

## Campos

| Campo | Valores | Default | Efeito |
|---|---|---|---|
| `criativo_diretor` | `fable` \| `opus` | `fable` | Modelo do step `rotas` (diretor de arte). `opus` desliga a promoção a Fable. Fallback fable→opus é automático e desliga a promoção pelo run. |
| `criativo_haiku` | `ligado` \| `desligado` | `ligado` | `desligado` → steps mecânicos (`roughs`, `composicao`, `preflight`, `pacote`) rodam em sonnet. Rollback de 1 linha se o haiku degradar. |
| `criativo_produtor` | `sonnet` \| `opus` | `sonnet` | Promoção dos steps `producao`/`correcao` (montagem de prompt e tradução de correção). |
| `criativo_perfil` | `economico` \| `balanceado` \| `maximo` | `balanceado` | Nº de rotas (2/3/3) e de candidatos por rodada (2/3/4). |
| `criativo_modelo_por_step` | `step=modelo` separados por vírgula | — | Override fino; passa por whitelist em código (`MODELOS_STEP`). Pedido fora do permitido é recusado e registrado em `modelos.recusados`. |
| `criativo_effort_por_step` | `step=effort` separados por vírgula | — | Idem; steps de julgamento (`rotas`, `selecao`, `crit`, `confirmacao`) têm piso `high` — pedido abaixo do piso é recusado. |

## Exemplo

```
criativo_diretor: fable
criativo_haiku: ligado
criativo_perfil: balanceado
criativo_effort_por_step: crit=xhigh
```

## Steps que existem (whitelist do harness)

`rotas` (diretor, fable→opus) · `roughs` (mecânico, haiku) · `portao` (produtor, sonnet;
haiku opt-in) · `producao` (produtor, sonnet→opus) · `selecao` (validador, opus fixo) ·
`composicao` (mecânico, haiku) · `preflight` (mecânico, haiku) · `crit` (validador, opus
fixo) · `confirmacao` (validador, opus fixo) · `correcao` (produtor, sonnet→opus) · `pacote`
(mecânico, haiku). Step desconhecido no override é recusado com registro — nunca aplicado em
silêncio.
