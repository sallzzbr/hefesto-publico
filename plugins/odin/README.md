# Odin

> Paths de workspace citados neste README resolvem pela regra única do plugin (regra 7 de
> `skills/descobrir/references/capa-template.md`); os literais abaixo são ilustrativos do
> default, não hardcode.

**O plugin É o double diamond.** Cada fase é uma skill; o desafio (design challenge) vive documentado e acompanhado no próprio repo (`docs/desafios/`).
Não existe um "modo desafio" escondido dentro de uma skill genérica: `descobrir`, `definir`, `desenvolver`, `entregar`, `dev-loop` e `acompanhar` SÃO as fases, uma a uma — você invoca a skill (ou o slash command) certo pra onde o desafio está.

> Até a v1.x o vocabulário era 'missão' (`/missao`, `docs/missoes/`). O `/desafio` detecta `docs/missoes/` legado e oferece migrar.

```
        DIAMANTE 1 — O PROBLEMA CERTO           DIAMANTE 2 — A SOLUÇÃO CERTA
      ◇ /descobrir ──────► /definir ◇          ◇ /desenvolver ─────► /entregar ◇
        divergir            convergir             divergir             convergir
                                                                          │
              cadência ──► /acompanhar            harness de execução ──► /dev-loop
```

## A jornada de 5 etapas

Pro dono do desafio, o diamond é apresentado como uma jornada de 5 etapas — uma camada de leitura, não um fluxo novo (mapa canônico em `skills/descobrir/references/capa-template.md`):

| Etapa | Nome | Por baixo |
|---|---|---|
| 1 | Descobrir | `descobrir` (DISCOVER) |
| 2 | Definir | `definir` (DEFINE) |
| 3 | Explorar e especificar | `desenvolver` (DEVELOP) + `/spec` (SPEC da entrega) |
| 4 | Entregar | `entregar` + `dev-loop` (DELIVER) |
| 5 | Acompanhar e aprender | `acompanhar` (cadência) |

O `/desafio` apresenta essa jornada com posição, confiança da etapa e pendências abertas, e roteia. A jornada não é linear por obrigação: dá pra entrar com materiais prontos, pular gate (com decisão registrada) e voltar de etapa — quando uma decisão anterior muda, a cascata de invalidação marca os artefatos posteriores como `⚠️ desatualizado` na capa.

**Proporcionalidade (tier):** nem todo desafio precisa do processo completo. Ao abrir um desafio novo, a `descobrir` classifica em 1 pergunta (risco, reversibilidade, urgência, pessoas afetadas, evidência disponível) e oferece o tier — `expresso` (capa enxuta, dossiê mínimo, gates 1-3 colapsados num GATE E, sem `alavancas.md`) ou `completo`. A IA recomenda com o porquê; o dono escolhe; a escolha fica na capa e o expresso pode ser promovido a completo depois. O expresso **não** corta os invariantes: régua fixada, critério de sucesso e de abandono por entrega, evidência antes de `validado`, cascata de invalidação.

## O problema que o plugin ataca

Desafio não é tarefa. O anti-padrão mais comum: alguém recebe um objetivo de resultado, por exemplo "melhorar retenção", e pula direto pra uma entrega, por exemplo "faz uma tela nova", sem dado que sustente a causa, sem hipótese sobre por que aquilo moveria o número, sem placar pra saber se moveu depois.
O Odin coloca guard-rails comportamentais nesse fluxo: gates explícitos entre as fases, placar com régua fixada antes de qualquer código, hipóteses escritas antes de escolher alavancas.

Princípio transversal: **a IA nunca pede pro humano "levantar os dados" (ela levanta), e nunca decide sozinha o que é o problema (o humano decide)**. As skills desafiam, mas não sequestram: pular um gate é permitido, desde que a decisão fique registrada na tabela de Decisões da capa.

E a conversa é progressiva, não um questionário: todas as skills seguem o contrato de conversa (`skills/descobrir/references/contrato-de-conversa.md`) — 1 pergunta relevante por vez com o porquê em meia linha, encadeada no que já foi respondido, nunca re-perguntando o que os artefatos registram; "não sei" vira pendência com plano de obtenção, e cada resposta ecoa o que foi atualizado no desafio.

## As 6 skills

| Skill | Fase | Quando dispara | Artefato |
|---|---|---|---|
| `descobrir` | Diamante 1 · DISCOVER | Desafio novo, problema aberto sem dossiê, sintoma sem causa conhecida | `descobertas.md` |
| `definir` | Diamante 1 · DEFINE | Descobertas em mãos: fecha problema + placar + hipóteses; também solução técnica pronta sem placar ("implementar BFF") | `dossie.md` |
| `desenvolver` | Diamante 2 · DEVELOP | Dossiê fechado (GATE 2): ranqueia alavancas e fecha o plano da rodada | `alavancas.md` + `plano.md` |
| `entregar` | Diamante 2 · DELIVER | Pedido de código, entrega do plano (software ou não: dashboard, prompt, documento, processo, experimento…), SPEC sem implementar, ou retomada de entrega interrompida | `entregas/<slug>.md` + PR/artefato |
| `dev-loop` | Diamante 2 · DELIVER (execução) | Spec/plano já aprovado: roda o harness multi-agente até ficar verde | código + testes verdes |
| `acompanhar` | Cadência (transversal) | Desafio em andamento: o placar andou? Em que fase estamos? Post-mortem | capa + diário do placar atualizados |

## Onde o desafio vive

```
docs/desafios/<slug>/
├── desafio.md         # capa: fase, gates, decisões — fonte de verdade
├── descobertas.md     # mapa do problema (DISCOVER)
├── dossie.md          # problema + placar + hipóteses (DEFINE)
├── alavancas.md       # ranking aprendizado × reversibilidade (DEVELOP)
├── plano.md           # plano da rodada: entregas em checklist (DEVELOP)
└── entregas/
    └── <entrega-slug>.md   # SPEC + log de execução (DELIVER) — o "Implementation Pack" da entrega
```

A capa é o contrato: as quatro skills de fase (`descobrir`, `definir`, `desenvolver`, `entregar`) leem `desafio.md` ao entrar — validam o gate e imprimem o bloco 📍 de posição — e escrevem nela ao sair (fase, gates, decisões, `Atualizada em`); o `acompanhar` segue o mesmo contrato a cada checkpoint. O `dev-loop` é o único que não toca os artefatos do desafio: devolve o relatório pro fluxo chamador (`entregar`) registrar no log da entrega.
Não existe um dashboard à parte — o acompanhamento é o próprio repositório.

## Comandos

| Comando | Faz | Bloqueio |
|---|---|---|
| `/desafio` | Roteia para a fase certa do double diamond, lendo a capa do desafio | — |
| `/descobrir` | Entra direto no DISCOVER: levanta evidência antes de opinião | Diagnóstico de entrada (detector de tarefa disfarçada) |
| `/definir` | Entra direto no DEFINE: fecha problema, placar e hipóteses | GATE 1 (mapa com evidência, não opinião) |
| `/desenvolver` | Entra direto no DEVELOP: ranqueia alavancas e fecha o plano da rodada | GATE 2 (problema + placar + hipóteses) |
| `/entregar` | Entra direto no DELIVER: entrega → SPEC → branch → implementação → PR | Portão de desafio (Step 0.5) antes de planejar qualquer entrega |
| `/acompanhar` | Entra direto na cadência: re-mede o placar e força perseverar/pivotar/encerrar | Sem capa/dossiê, roteia pra `/desafio` em vez de inventar checkpoint |
| `/spec` | Formaliza ou valida a SPEC de uma entrega | Não implementa sem OK explícito numa chamada posterior |
| `/dev-loop` | Roda o harness operário × arquiteto até a spec ficar verde | Bloqueia sem spec/plano aprovado + perfil de custo/rigor + opt-in multi-agente |
| `/defaults` | Consulta ou atualiza `~/.claude/odin/defaults.md` | Nunca salva credenciais/PII |

## Agents (papéis fixos do harness)

| Agent | Modelo (piso) | Papel |
|---|---|---|
| `operario` | sonnet | Executa o plano e não decide arquitetura. |
| `arquiteto` | fable (fallback Opus) | Responde consultas e projeta a SPEC, sem digitar código. |
| `revisor` | opus | Faz revisão adversarial e tenta refutar a proposta. |
| `mecanico` | haiku | Roda as validações mecânicas whitelisted e reporta o resultado. |

## O harness (dev-loop)

Desde a v2.0.0 o dev-loop é um **harness real, não um protocolo em prosa**: os invariantes vivem em código no script de Workflow `skills/dev-loop/harness/loop.mjs` e nos agentes de papel fixo em `agents/` — `operario` (Sonnet, executa e não decide arquitetura), `arquiteto` (**Fable por default, com fallback mecânico pra Opus** — responde consultas e projeta SPEC, sem digitar código), `revisor` (Opus, adversarial, tenta refutar) e, desde a v2.3, `mecanico` (**Haiku**, exclusivo dos steps mecânicos: rodar validações por default e checklist de SPEC sob opt-in).

Na v2.3 o modelo/effort de cada step virou **configurável por defaults** (`~/.claude/odin/defaults.md`, campos `dev_loop_*` — a skill lê e monta o arg `tiering`; o script de Workflow não tem filesystem). A regra continua sendo enforcement em código, na tabela `MODELOS_STEP` do script: **promoção só dentro do papel** (consulta: opus→fable), **rebaixamento pra Haiku só nos steps mecânicos whitelisted** — TDD, implementação e revisão nunca rebaixam, e pedido fora da whitelist é ignorado com registro no relatório. Fallbacks são simétricos e mecânicos: chamada Fable que não retorna cai pro piso Opus e desliga o override pelo resto do run; chamada Haiku que não retorna cai pro operário Sonnet e desliga o Haiku (sem distinguir tier indisponível de schema inválido — o relatório diz isso). O rollback do Haiku é 1 linha nos defaults (`dev_loop_haiku: desligado`). O plugin é público e nunca quebra o spawn de quem não tem Fable. Desde a v2.3.1 (endurecimento pós-revisão adversarial externa): o effort dos steps de julgamento tem piso `high` recusado em código (travar só o modelo deixava `auditoria=low` passar com aparência nominal), lente de revisão e confirmador de finding que não retornam **abortam o run** reinvocável em vez de falhar abertos, e toda chamada de agente tem rede contra exceção — o run sempre morre com relatório estruturado, nunca em silêncio.

O que o script garante mecanicamente: portão TDD que só abre com vermelho confirmado pelo motivo certo; teto de 3 iterações e 2 consultas por unidade contados em variável; **relato de escada obrigatório** (o operário diz em que degrau parou para cada coisa que criou) e **auditoria ponytail do diff em toda iteração**, com dependência nova sem justificativa escrita **no diff** virando bloqueante automático: uma vez sinalizada pela auditoria, **nenhum modelo desfaz** — não passa por confirmação, não há rota de apelação e o arquiteto não pode autorizá-la (o que o auditor decide é se a justificativa existe no diff; o que fazer com isso é `if` no script). Auditoria que não retorna **aborta o run** em vez de degradar para "nada encontrado" — portão que falha aberto não é portão; lentes de revisão sequenciais conforme o perfil; finding plausível confirmado antes de virar retrabalho; escalada estruturada pro humano quando o teto estoura ou uma consulta revela furo na SPEC. O harness nunca commita — o diff fica na working tree e commit/push/PR seguem a `entregar`, com OK explícito.

Antes de disparar, a skill apresenta o perfil de custo/rigor (Econômico, Balanceado ou Máximo — muda paralelismo e nº de lentes): a IA recomenda o menor gasto seguro, mas quem escolhe é o usuário, com opt-in explícito de custo multi-agente. Sem opt-in (ou sem a tool Workflow), o protocolo roda em fallback sequencial — mesmas regras, sem paralelismo.

## Instalação

```
/plugin marketplace add sallzzbr/hefesto
/plugin install odin@hefesto
```

Para desenvolvimento local, a partir de um clone deste repositório:

```
/plugin marketplace add ./hefesto
```

## Estrutura

```
plugins/odin/
├── .claude-plugin/
│   └── plugin.json
├── agents/
│   ├── arquiteto.md
│   ├── mecanico.md
│   ├── operario.md
│   └── revisor.md
├── commands/
│   ├── acompanhar.md
│   ├── defaults.md
│   ├── definir.md
│   ├── desafio.md
│   ├── descobrir.md
│   ├── desenvolver.md
│   ├── dev-loop.md
│   ├── entregar.md
│   └── spec.md
├── docs/
│   ├── inventario-skills.md
│   └── roteamento-matrix.md
├── evals/
│   ├── README.md
│   └── roteamento/          # 1 caso de `claude plugin eval` por frase da matriz
└── skills/
    ├── acompanhar/
    │   ├── SKILL.md
    │   └── references/
    │       └── metodologias-acompanhamento.md
    ├── definir/
    │   ├── SKILL.md
    │   └── references/
    │       ├── desafios-tecnicos.md
    │       ├── dossie-template.md
    │       ├── metodologias-definicao.md
    │       └── modelo-desafios.md
    ├── descobrir/
    │   ├── SKILL.md
    │   └── references/
    │       ├── capa-template.md
    │       ├── metodologias-investigacao.md
    │       └── metodologias-pesquisa.md
    ├── desenvolver/
    │   ├── SKILL.md
    │   └── references/
    │       ├── metodologias-develop.md
    │       └── priorizacao-ai-era.md
    ├── dev-loop/
    │   ├── SKILL.md
    │   ├── harness/
    │   │   └── loop.mjs
    │   └── references/
    │       ├── escada-ponytail.md
    │       ├── protocolo-revisao-adversarial.md
    │       └── spec-template.md
    └── entregar/
        ├── SKILL.md
        └── references/
            ├── convencoes-formatacao.md
            ├── defaults.md
            ├── patterns-por-projeto.md
            ├── steps-detalhados.md
            └── tipos-de-entrega.md
```

## Créditos

As **regras ponytail (P1–P18)** que governam o Diamante 2 (planejamento na `entregar`, portão de implementação no `dev-loop`) foram importadas e adaptadas do [ponytail](https://github.com/DietrichGebert/ponytail) — *"The best code is the code you never wrote."* A partir da v2.2 são **regras do odin** e evoluem em `skills/dev-loop/references/escada-ponytail.md`: escada de 7 degraus, "lazy, not negligent" inegociável, dependência nova só com justificativa escrita, nada de abstração de uso único ou arquivo desnecessário, menor diff que funciona, fora de escopo vira pendência. No harness elas não são conselho: o operário relata em que degrau parou, uma auditoria examina o diff a cada iteração e dependência sem justificativa é bloqueante automático.
