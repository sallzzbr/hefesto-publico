---
name: dev-loop
description: >-
  Use quando já existe SPEC/plano aprovado e o usuário pede "roda o dev-loop", "implementa em
  loop", "implementação multi-agente", "spec driven", "loop até passar", perfil
  Econômico/Balanceado/Máximo de execução ou /dev-loop. Também é usado pela skill `entregar`
  (gate de implementação, modo Loop). SOMENTE software/código: entrega não-software (dashboard,
  documento, processo, experimento, prompt) roda no modo Solo da `entregar`, nunca aqui. Não use
  para trabalho novo sem spec/plano, mudança trivial, ou pedido de multi-agente ainda sem SPEC;
  nesses casos roteie para `entregar`.
---

# Dev-Loop — harness spec-driven, multi-agente

> Paths do workspace resolvem pela regra única em
> `../descobrir/references/capa-template.md`; os literais nesta skill são ilustrativos do
> default, não hardcode.

## ⚡ Confirmação de ativação (OBRIGATÓRIO)

Primeira linha, antes de qualquer outra coisa:

```
🔁 Skill `dev-loop` ATIVADA — spec fechada, loop aprovado até ficar verde.
```

## O que este arquivo é (e o que ele não é mais)

Os invariantes do loop — portão TDD bloqueante, teto de 3 iterações, teto de 2 consultas por
unidade, revisão adversarial com confirmação de findings, escalada pro humano — **vivem em
código** no harness `harness/loop.mjs` e nos agentes de papel fixo do plugin (`agents/`:
`operario` = Sonnet, `revisor` = Opus, `arquiteto` = Fable por default com fallback mecânico
pra Opus (o frontmatter fixa Opus como PISO; a promoção é override de runtime), `mecanico` =
Haiku, exclusivo dos steps mecânicos whitelisted em código no harness). Desde a v2.3 o
modelo/effort de cada step é configurável via defaults (`~/.claude/odin/defaults.md`, campos
`dev_loop_*`) dentro da whitelist da tabela `MODELOS_STEP` do script — promoção só dentro do
papel, rebaixamento só nos steps mecânicos. Este arquivo define **quando** rodar,
**como montar** a invocação e os princípios que o script aplica. Não re-implemente o loop em
prosa: invoque o harness.

**References (carregar sob demanda):** `references/spec-template.md` (formato canônico da SPEC
+ gate de prontidão) · `references/escada-ponytail.md` (FONTE ÚNICA das regras ponytail P1–P18
+ resumo do portão TDD; compartilhada com a `entregar`) · `references/protocolo-revisao-adversarial.md`
(as 3 lentes que o harness usa; leitura pra entender/ajustar) · `harness/loop.mjs` (o script —
leia o cabeçalho pra montar os args) · `../descobrir/references/contrato-de-conversa.md`
(SEMPRE que precisar de informação do humano — perfil, opt-in, escaladas: 1 pergunta por vez,
com o porquê).

## Portas de entrada (quem autora ≠ quem executa)

A spec de trabalho novo é SEMPRE autorada e aprovada na skill `entregar`. O dev-loop executa:

| Situação | O que fazer |
|---|---|
| Invocado pela `entregar` (modo Loop) | Spec aprovada + perfil + opt-in já dados; branch criada no Step 6 → invocar o harness |
| Direto, com spec aprovada | Validar formato + gate de prontidão → Plano de custo/rigor → opt-in → **garantir branch de trabalho** (criar `feat/<slug>` com OK; NUNCA rodar na main) → invocar o harness |
| Direto, com plano aprovado sem spec formal | Formalizar no template (**regra do planner**, abaixo) + aprovar com o humano → seguir a linha de cima |

**Regra do planner (quem autora a SPEC):** o planner titular é **Fable** — Opus é revisor e
piso de fallback, não planner. Sessão rodando Fable → você mesmo autora a SPEC. Qualquer outra
sessão (**Opus incluso**) → despache o agente `odin:arquiteto` promovido via `model: "fable"`
pra desenhar/decompor a SPEC e **você consolida** o retorno no template; se a chamada promovida
não retornar, o frontmatter garante Opus como piso (mesmo fallback mecânico do harness). O
default `dev_loop_arquiteto` governa os dois papéis do arquiteto — planner (aqui) e advisor
(step `consulta` no loop): se estiver `opus`, a sessão Opus autora direto. Racional: erro de
spec multiplica em TODAS as unidades — é o ponto de maior alavancagem do modelo caro, mais que
qualquer consulta pontual dentro do loop.
| "Multi-agente"/"loop" sem spec/plano | NÃO executar; rotear pra `entregar` |

## Princípios (o que o harness garante)

1. **A spec é o contrato** — pronto = critério verificado com evidência, não opinião.
2. **O melhor código é o que você nunca escreveu** — regras ponytail P1–P18, com enforcement em
   código no harness (`references/escada-ponytail.md`).
3. **Custo consciente, escolha humana** — a IA recomenda o menor gasto seguro; o usuário escolhe.
4. **Revisão adversarial, nunca do autor** — revisores instruídos a REFUTAR; finding plausível é
   confirmado antes de virar retrabalho; 1 revisor por vez, passadas cegas.
5. **O loop tem fim** — 3 iterações; estourou, escala pro humano com diagnóstico.
6. **Nada antes do vermelho** — testes escritos e falhando pelo motivo certo abrem o loop;
   o implementador não edita o teste que precisa passar. Os dois são verificados em código
   desde a 2.4.6: o mecânico roda os testes da SPEC de forma independente (exit 0 = bloqueado)
   e devolve o hash de cada um; a validação de cada iteração devolve os hashes de novo e
   qualquer diferença é bloqueante automático, sem confirmação.
7. **Operário executa, arquiteto pensa** — Sonnet implementa; decisão de arquitetura vira
   consulta ao arquiteto (**Fable quando disponível, senão Opus**), com teto de 2 por unidade
   por iteração; consulta que revela furo na spec escala pro humano. Nunca 2 arquitetos em
   paralelo — o script tem **fila em código**: com operários paralelos, duas unidades bloqueadas
   ao mesmo tempo esperam a vez em vez de decidir arquitetura concorrentemente.

> "Arquiteto" aqui é papel de modelo dentro do loop; decisão de comportamento/spec sobe sempre
> pro **arquiteto humano**.

## 🪜 Regras ponytail (P1–P18) e portão TDD

Fonte única em `references/escada-ponytail.md`: a escada **P1–P7** ("The best code is the code
you never wrote"), o inegociável **P8** (lazy, not negligent), o peso do diff (**P10–P14**) e o
resumo do portão TDD. **Cite pelo número** — a `entregar` usa a mesma reference; não duplique as
regras aqui nem lá.

Parte disso é mecânica, não conselho: o harness faz o operário **relatar em que degrau parou**
para cada coisa que criou, roda uma **auditoria ponytail** do diff em toda iteração (todos os
perfis) e trata **dependência nova sem justificativa escrita no diff (P10)** como bloqueante
automático. Quem decide **se a justificativa existe no diff** é o agente de auditoria; o que se
faz com esse sinal é `if` no script — uma vez sinalizada, a dependência não passa por confirmação,
não tem apelação e o arquiteto não pode autorizá-la. Quem quer a dependência **escreve o porquê no
código** (comentário no manifesto ou no ponto de uso), que é onde a justificativa serve pra quem
vier depois. Duplicação e abstração de uso único viram findings normais, confirmados antes de
virar retrabalho — e não são re-julgadas se já receberam veredito numa iteração anterior.

O **relato de escada** também é cobrado em código: unidade que fecha tocando arquivos e reporta
`escada` vazia vira bloqueante na auditoria. E **auditoria, lente de revisão ou confirmador de
finding que não retornam abortam o run** (`status: "erro"`, reinvocável com `resumeFromRunId`)
em vez de virar "nada encontrado" — senão bastaria uma lente falhar no perfil econômico para o
run fechar verde sem nenhuma revisão adversarial, ou um confirmador falhar para um bloqueante
plausível sumir em silêncio. Portão que falha aberto não é portão (endurecido na 2.3.1, após
revisão adversarial externa).

Duas ressalvas que o código impõe e a prosa não deve esconder:
- A auditoria enxerga o **diff acumulado da branch**, não o da iteração (o script não tem SHA
  base pra recortar). Por isso ela deduplica achados entre iterações, e `linhasAdicionadasAcumuladas` é
  acumulado — não leia como "cresceu tanto nesta rodada".
- **P14 tem uma porta lateral:** a rota mecânica nunca transforma fora-de-escopo em retrabalho,
  mas no perfil Máximo a lente R3 revisa o mesmo diff e *pode* reportar o mesmo trecho como
  bloqueante por P1. Se isso acontecer, é julgamento adversarial legítimo — não um bug.

## 📋 A SPEC

Formato canônico, regras e gate de prontidão: `references/spec-template.md`. Pré-condições que
o harness checa e devolve como bloqueio se faltarem: critérios todos verificáveis e mapeados
pra teste executável; unidades com **arquivos disjuntos e contratos explícitos** (é isso que
permite operários em paralelo sem worktree); pendências bloqueadoras do gate de prontidão
zeradas ou aceitas por escrito.

## 💸 Plano de custo/rigor (OBRIGATÓRIO antes de invocar)

Classifique a complexidade e sugira um perfil — a IA recomenda o menor gasto seguro, o usuário
decide. Se houver `perfil_custo_padrao` nos defaults (`~/.claude/odin/defaults.md`), parta dele
e aponte divergência quando a complexidade pedir outro.

**Tiering de modelo/effort por step (v2.3):** leia também os campos `dev_loop_*` dos defaults
(`dev_loop_haiku`, `dev_loop_arquiteto`, `dev_loop_modelo_por_step`, `dev_loop_effort_por_step`
— contrato em `../entregar/references/defaults.md`) e monte o arg `tiering` do harness a partir
deles: `dev_loop_haiku: desligado` → inclua `validar=sonnet` (e `spec=sonnet`) no mapa de
modelos, ignorando o mapa por step para os mecânicos; `dev_loop_arquiteto: opus` →
`consulta=opus`. Arquivo/campos ausentes → **não pergunte nada e não monte `tiering`**: os
defaults embutidos do script já são o comportamento certo (validar=haiku·low, consulta=fable
com fallback a opus, revisão opus·high). Apresente o tiering efetivo junto do perfil no plano
de custo; ajuste pedido na conversa vale só para a rodada (via `tiering`), sem regravar
defaults.

| Perfil | Quando sugerir | O que muda no harness |
|---|---|---|
| **Econômico** | 1 unidade, bug/ajuste isolado, baixo risco | operários sequenciais · 1 lente de revisão (corretude) |
| **Balanceado** | 2-3 unidades, integração moderada | operários em paralelo · 2 lentes (corretude + segurança/bordas) |
| **Máximo** | arquitetura, segurança/dados/a11y, regressão ampla | operários em paralelo · 3 lentes (+ ponytail/arquitetura) |

Invariantes que NENHUM perfil remove (estão no script, não são negociáveis por perfil, e cada um
tem um caso em `tests/harness-dev-loop.test.mjs` que roda o script com agentes falsos): portão
TDD vermelho **confirmado por execução independente** (step `tdd:vermelho`, no mecânico),
implementador não edita teste (**hash dos testes da SPEC comparado a cada iteração**), teto de
iterações/consultas, **teto de 4 operários simultâneos** nos perfis paralelos, revisor nunca é o
autor, auditoria ponytail em toda iteração, e **Haiku somente nos steps mecânicos whitelisted
em código** — `validar` (rodar validações e reportar) por default e `spec` (checklist de
formato) só sob opt-in nos defaults, porque tem julgamento. TDD, implementação, consulta de
arquitetura, auditoria e revisão **nunca** rebaixam: a whitelist `MODELOS_STEP` do script
recusa (com registro em `modelos.recusados`) qualquer pedido de modelo fora do permitido do
step — promoção só dentro do papel (consulta: opus→fable), rebaixamento só nos mecânicos.
Step em haiku que não retornar cai UMA vez pro operário (Sonnet) e desliga o haiku pelo resto
do run — o tier barato nunca aborta um run.

Apresente: complexidade estimada, perfil sugerido com porquê e o nº esperado de agentes. **Piso**
(nenhuma consulta, nenhum finding plausível): `3 + iterações × (unidades + lentes + 2)` — o `3`
fixo é spec + portão TDD + a execução independente do vermelho (mecânico, haiku); o `+2` por
iteração é o agente de validação e o da auditoria ponytail; as lentes rodam **por iteração**,
não uma vez. Ex.: 3 unidades, Balanceado (2 lentes), 3 iterações → `3 + 3×(3+2+2)` = **24**.
Nos perfis paralelos, no máximo 4 operários rodam ao mesmo tempo (lotes) — mais unidades não
aumentam a concorrência, só o tempo.
Somam-se por cima, e são imprevisíveis: cada consulta ao arquiteto custa 2 (o arquiteto + a
re-invocação do operário), cada duplicação/abstração achada pela auditoria custa 1 de confirmação.
Estime o piso, diga que é piso e a pergunta de **opt-in explícito**: *"posso orquestrar
com multi-agentes? (~N agentes)"*. Sem opt-in → fallback sequencial (abaixo).

## ▶️ Invocar o harness (caminho principal)

Com spec aprovada + branch de trabalho + perfil + opt-in, invoque a tool **Workflow**:

```
Workflow({
  scriptPath: "${CLAUDE_PLUGIN_ROOT}/skills/dev-loop/harness/loop.mjs",
  args: {
    specPath: "docs/desafios/<slug>/entregas/<entrega-slug>.md",  // ou docs/plans/...
    branch: "feat/<entrega-slug>",          // já criada — o harness NÃO cria branch
    perfil: "economico" | "balanceado" | "maximo",
    validacoes: ["<comandos do projeto: lint, typecheck, test, build>"],
    hoje: "<data ISO de hoje>",
    tiering: {                              // OPCIONAL — só quando os defaults/rodada divergem
      modelos: { "consulta": "opus", "validar": "sonnet" },   // dos embutidos do script
      efforts: { "lente": "xhigh" }
    }
  }
})
```

**Regra do `tiering`:** montado a partir dos defaults `dev_loop_*` (seção do plano de custo,
acima) + ajustes da rodada. **Omitir é seguro e é o caso comum**: os defaults embutidos do
script já aplicam consulta=fable (com fallback mecânico a opus), validar=haiku·low e revisão
opus·high. Steps: `spec`, `tdd`, `impl`, `consulta`, `validar`, `auditoria`, `lente`,
`confirmacao`. A whitelist é **em código** (`MODELOS_STEP`): promoção só dentro do papel
(consulta: opus→fable), rebaixamento pra haiku só em `validar`/`spec`; pedido fora disso é
ignorado e registrado em `modelos.recusados` — nunca rebaixa TDD/implementação/revisão, e isso
é garantido por código, não por convenção. O **effort também tem piso** nos steps de julgamento
(`consulta`, `auditoria`, `lente`, `confirmacao`: piso `high`) — pedido abaixo do piso é
recusado com registro; a whitelist protege o rigor, não só o modelo. Fallbacks são do script: chamada fable que não
retorna cai pro piso opus e desliga o override pelo resto do run; chamada haiku que não retorna
cai pro operário Sonnet e desliga o haiku — tudo registrado em `fallbacks`. **Não trate você o
fallback**, não pergunte ao usuário, não faça probe de modelo. Ressalva honesta pra ler o
relatório: o script não distingue "tier/agente indisponível" de "schema inválido/timeout" —
`fallbacks[].causa` diz isso. O revisor é Opus sempre (effort configurável, `high` por
default) — julgamento adversarial não justifica o teto nem aceita o porão. O arg
`modeloArquiteto: "fable"` segue aceito como legado (vira `tiering.modelos.consulta`).

O script roda em background e devolve um resultado estruturado. Trate os 4 desfechos:

- **`status: "verde"`** → todos os critérios com teste verde, validações ok, revisão sem
  bloqueante confirmado. Grave o relatório condensado no destino certo (abaixo) e devolva o
  controle: invocado pela `entregar` → ela retoma no Step 8; standalone → apresente o
  relatório e siga as regras da `entregar` pra qualquer commit/push (OK explícito). O bloco
  `ponytail` do relatório (escada relatada, dependências barradas/autorizadas, duplicações
  unificadas, tamanho do diff) entra no log **inteiro** — é o rastro de como as regras agiram; a
  lista `ponytail.pendenciasForaDeEscopo` vira entrada em `docs/pendencias.md`, nunca retrabalho.
- **`status: "bloqueado"`** (fase Spec ou TDD) → a causa vem em `detalhe`/`acao`: spec com
  furo de formato, pendência bloqueadora aberta, teste que nasceu verde, **nenhum teste
  executável E nenhum comando de validação** (sem isso não existe base pra afirmar verde), ou SPEC-lite
  (variante não-software do `spec-template.md` — a entrega roda Solo na `entregar`, o harness
  é exclusivo de software). Corrigir/rotear na `entregar` (Step 4c) e, se for software,
  reinvocar — o harness não improvisa.
- **`status: "escalado"`** → teto de iterações/consultas estourado ou furo de spec descoberto
  no meio. Apresente o diagnóstico ao humano (`historico`/`detalhe`/`consultas`) e espere
  decisão — loop que não converge é sinal de spec ruim, não de falta de força bruta.
- **`status: "erro"`** → falha de infraestrutura de um agente; reinvocar com
  `resumeFromRunId` aproveita tudo que já completou.

**Destino do relatório (sempre persiste):** entrega de um desafio → seção `## Log de execução`
de `docs/desafios/<slug>/entregas/<entrega-slug>.md` (via `entregar`, ou você mesmo no
standalone). Entrega avulsa → apêndice `## Relatório dev-loop` no próprio
`docs/plans/YYYY-MM-DD-<slug>-spec.md`. Relatório sem casa é rastro perdido. (Os dois
diretórios resolvem pela regra única da regra 7 do contrato da capa — `local_desafios`/
`local_specs`; os paths aqui são ilustrativos do default.)

O merge do trabalho fica na working tree da branch — **o harness nunca commita**; commit/push/PR
seguem os steps da `entregar` com OK explícito.

## 🔁 Fallback sem multi-agente (sem opt-in ou sem a tool Workflow)

O protocolo não muda; só o paralelismo. Execute você mesmo, sequencial, na branch de trabalho:

1. 🔴 Portão TDD: escrever os testes de TODOS os critérios, rodar, confirmar vermelho pelo
   motivo certo (teste que nasce verde é suspeito: critério já atendido → cortar; ou teste
   inútil → reescrever). Sem vermelho, nada de implementação.
2. Implementar unidade a unidade com as regras ponytail (P1–P18), sem tocar nos testes; decisão de
   arquitetura que não é sua → apresentar ao humano como consulta (opções + trade-offs).
3. Validações do projeto + testes da spec.
4. Revisão adversarial: as lentes do perfil, uma por vez, tentando refutar
   (`references/protocolo-revisao-adversarial.md`); finding sem arquivo:linha + cenário é
   descartado; plausível é confirmado antes de retrabalho.
5. Não fechou → próxima iteração (máx 3); estourou → escalar com diagnóstico.

## NUNCA fazer

- ❌ Rodar o harness sem spec aprovada, sem branch de trabalho, ou sem opt-in de custo
- ❌ Rodar pra entrega não-software (isso é modo Solo da `entregar`, trilha por tipo)
- ❌ Re-implementar o loop em prosa quando a tool Workflow existe — o script É o protocolo
- ❌ Começar implementação com o portão TDD aberto, ou editar teste pra fazê-lo passar
- ❌ Ignorar um `status: "escalado"` e reinvocar sem decisão humana
- ❌ Autorar spec de trabalho novo por aqui — exploração/brainstorming/spec são da `entregar`
- ❌ Commit/push/PR por conta própria (o harness aplica diffs na working tree; commits são da `entregar`, com OK)
- ❌ Relatório sem casa: todo run persiste no log da entrega ou no arquivo da spec avulsa
