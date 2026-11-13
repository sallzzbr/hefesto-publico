---
name: entregar
description: >-
  Use quando o usuário pedir implementar/corrigir código ("implementa", "corrige", "cria a
  feature") ou chegar com um artefato já encomendado ("me pediram uma tela/página/feature
  de..."), executar uma entrega do plano de um desafio (ou "missão") — de software ou não:
  dashboard, prompt, skill, agente, script, automação, documento, processo, experimento
  ("monta o dashboard do desafio X") —, criar branch/PR de trabalho novo, ou formalizar a
  SPEC sem implementar (/spec — para no gate). Também para RETOMAR entrega interrompida:
  "continua a entrega X", "retoma/termina a entrega", "onde paramos na entrega", "resume work
  on the delivery". Inclui /entregar. Não use para resumo/status/análise sem intenção de
  produzir a entrega, desafio sem placar (descobrir/definir), priorizar alavancas
  (desenvolver), loop com spec já aprovada (dev-loop), re-medir desafio (acompanhar), hotfix
  urgente em produção (fora de scope), nem material SOBRE o desafio (reunião, workshop,
  apresentação — produzir SOBRE não é entrega DO plano).
---

# Entregar — DELIVER: da entrega ao PR (Diamante 2, convergir)

## Overview

Orquestra o ciclo **entrega → SPEC → branch → implementação → validações → PR**. Aprovação por step do usuário; **nunca** mutação externa (commit, push, PR) sem OK explícito na sessão. Genérica entre projetos: detecta defaults e pergunta na dúvida.

## References desta skill (carregar sob demanda)

| Arquivo | Quando carregar |
|---|---|
| `references/steps-detalhados.md` | Ao escrever a spec da entrega no Step 2/4, no gate de qualidade do modo Solo, no registro de desvios, no reporte final e ao retomar entrega interrompida (protocolo de retomada) |
| `references/tipos-de-entrega.md` | No Step 1, quando a entrega não é (só) código de software — taxonomia, adaptação dos steps por tipo e estados da entrega |
| `../descobrir/references/metodologias-investigacao.md` | Step 4a exploração — arqueologia git, mapa de dependências, tracing; compartilhada com `descobrir` |
| `references/patterns-por-projeto.md` | Ao começar a trabalhar num repo — se ele estiver lá, use os valores sem re-detectar |
| `references/convencoes-formatacao.md` | Antes de escrever/editar código pela primeira vez na sessão |
| `references/defaults.md` | Ao ler, criar ou atualizar defaults do usuário |
| `../dev-loop/references/quality-contract.md` | Step 4 e Step 7 em ambos os modos: convenções, sete regras base, perfis por área e decomposição; carregar especialidades selecionadas |
| `../dev-loop/references/escada-ponytail.md` | Step 4 (planejamento) e Step 7 modo Solo — regras ponytail P1–P18 + resumo do portão TDD (fonte única, compartilhada com a `dev-loop`) |
| `../descobrir/references/capa-template.md` | Quando a entrega pertence a um desafio |
| `../descobrir/references/contrato-de-conversa.md` | SEMPRE que precisar de informação do dono — 1 pergunta por vez, "não sei" vira pendência, mostrar o que mudou |

As regras ponytail (P1–P18) e o portão TDD têm fonte única em `../dev-loop/references/escada-ponytail.md` (carregue ESSA reference quando este fluxo os citar — não a `dev-loop/SKILL.md` inteira). O Plano de custo/rigor e o roteamento de modelos continuam definidos na skill **`dev-loop`** (`../dev-loop/SKILL.md`), carregada só no modo Loop.

## ⚡ Confirmação de ativação (OBRIGATÓRIO)

**A PRIMEIRA coisa a fazer**, antes de qualquer outra resposta, pergunta ou ferramenta:

```
🟢 Skill `entregar` ATIVADA — orquestrando a entrega até o PR.
```

## Formas de entrada

| Forma | Exemplo | Rota |
|---|---|---|
| Entrega do plano de um desafio | "faz a entrega frete-no-carrinho" | Step 2, com hipótese/métrica herdadas do `plano.md` |
| Linguagem natural | "implementa o botão de compartilhar no perfil" | Step 0.5 → Step 2 |
| Issue/descrição colada | issue/descrição pronta, colada na conversa | Step 0.5 → Step 2 (idem) |
| **Retomada** | "continua/retoma/termina a entrega X", ou qualquer pedido cujo arquivo de entrega já exista com `Estado` não-terminal | Protocolo de retomada (abaixo) — **reaproveita 0.5 e 1 registrados**, confere dados de branch no Log e volta ao step aberto |

**Resolução de paths:** resolver `dirDesafios`, `dirSpecs` e `arquivoPendencias` nesta ordem:
`CLAUDE.md` do workspace (`## Paths do workspace`) → defaults do usuário (`local_desafios`,
`local_specs`, `local_pendencias`) → convenção descoberta no cwd → default documentado pela
regra 7 de `../descobrir/references/capa-template.md`. Exatamente um candidato existente é
usado; mais de um candidato concorrente exige perguntar; nenhum candidato cai no default
documentado. As menções literais nesta skill são ilustrativas do default, não hardcode.

**Antes de classificar a forma de entrada, procure entrega em andamento:** varrer
`<dirDesafios>/*/entregas/*.md` e `<dirSpecs>/*-spec.md` por arquivo cujo `**Estado:**`
não seja terminal (`entregue`) e que case com o pedido. Achou 1 → retomada. Achou 2+ → perguntar
qual (1 pergunta com a lista). Nenhum → é entrega nova, siga o fluxo normal.

**Rede de segurança contra falso-positivo:** frase ambígua, pedido sem intenção de produzir a entrega ("resume/status/lê/análise"), ou objeto que não é uma entrega (reunião, workshop, apresentação, conversa SOBRE o desafio) → **não assuma o fluxo**; confirme em 1 pergunta curta antes de tomar conta da conversa.

## 🔄 Retomada e idempotência (OBRIGATÓRIO ao re-entrar)

Re-invocar `/entregar` após falha, interrupção ou compactação de contexto **nunca refaz o que
já foi feito** — vale pros dois tiers (expresso e completo). Detalhes em
`references/steps-detalhados.md`; o essencial:

1. **Ler antes de escrever:** se o arquivo da entrega já existe, retomar DELE — o campo
   `**Estado:**` + a última entrada do `## Log de execução` dizem em que step parou (divergindo
   entre si, **o Log ganha**: ele é cronológico, o `Estado` pode ter ficado para trás). Ler
   também a capa do desafio (tier, posição) e imprimir o bloco 📍. NÃO recriar SPEC nem
   descrição já aprovadas (reabrir só com pedido explícito do dono). Steps 0.5 e 1 não se repetem quando registrados. Ler `branchBase` e `branchTrabalho` do Step 5 ou de `[branch-spec]`; se ausentes, seguir a seção "Branch local no planejamento /spec" de `references/steps-detalhados.md`, sem presumir registro.
   Pergunta `[pendente]` sem resposta no Log (ou linha da capa com a Decisão vazia): reapresente a mesma pergunta antes de seguir, sem presumir a resposta nem recomeçar o step. Entrada `[autorização]` vale para a mesma ação, escopo e custo igual ou menor, salvo mutação externa (regras 7 e 8 de `../descobrir/references/contrato-de-conversa.md`).
2. **Step 6 tolerante:** branch já associada à mesma entrega em `[branch-spec]`, conferida no estado real, é reutilizada sem recriar. Fora desse caso, branch `feat/<entrega-slug>` já existe → perguntar (reusar como está /
   recriar do zero / abortar) — nunca falhar nem duplicar com sufixo silencioso.
3. **Log idempotente:** toda entrada do Log referencia o step (`[Step N]`); antes de gravar,
   conferir se a última entrada já registra o mesmo evento — retomada não duplica entradas de
   step, e acrescenta uma entrada `[retomada]` dizendo de onde continuou. Retomada sem
   progresso desde a última (o topo do Log já é uma `[retomada]` e nada mudou no repo) **não**
   grava outra.
4. **Mutação externa nunca se repete às cegas:** commit/push/PR/publicação constam no Log →
   conferir o estado real (git log, `gh pr view`, artefato no ar) antes de qualquer repetição;
   divergência entre Log e estado real → perguntar.

## Quando NÃO usar

- Mudança trivial (typo, 1 linha) — fluxo direto sem skill
- Investigação/análise pura (sem implementação) — fluxo direto (ou skill `descobrir` se for desafio)
- Desafio sem problema/placar estruturado — Step 0.5 desafia
- Hotfix urgente em produção — workflow diferente (fora de scope)

## 💾 Defaults do usuário (persistidos)

Contrato completo: `references/defaults.md`. Arquivo: `~/.claude/odin/defaults.md` — vale pra qualquer projeto/sessão do usuário.

1. Arquivo existente → usar os valores sem re-perguntar; arquivo ou campo ausente → seguir para a convenção do cwd e o default documentado, sem perguntar só por isso (protocolo de `references/defaults.md`). Gravar defaults só quando o usuário pedir (ou via `/defaults`).
2. Override mencionado na conversa vale só para a rodada; regravar default só quando o usuário disser que virou padrão.
3. `/defaults` consulta ou atualiza esses valores sem iniciar fluxo de entrega.

## Pré-requisitos (Step 0)

Validar em paralelo **antes de mutar**; se algo falhar, avisar e parar:

1. `gh --version` — GitHub CLI instalado (se o fluxo terminar em PR)
2. Dentro de git repo: `git rev-parse --is-inside-work-tree`
3. **Working tree limpo:** `git status --short` vazio (ignorar `<arquivoPendencias>`, resolvido acima — no default, `docs/pendencias.md`). Sujo → avisar e perguntar antes de criar branch.

## 🧭 Step 0.5 — Portão de desafio (anti-tarefa, OBRIGATÓRIO)

Antes de planejar QUALQUER entrega, classifique o pedido:

**A) Tarefa legítima** — bug claro, ajuste bem definido, ou entrega do `plano.md` JÁ ligada a hipótese (a entrega referencia a hipótese que testa). → Step 1 direto.

**B) Desafio disfarçado de tarefa** — nasce de um objetivo de resultado ("melhorar retenção") ou objetivo técnico habilitador ("acelerar releases") mas chega como entrega pronta ("faz a tela de X", "implementa BFF"), SEM problema/placar/hipótese registrados. **Condição necessária: a entrega/solução foi definida ANTES do problema** — sem ela, não é B. Agravantes (reforçam, não disparam sozinhos): nenhum número, nenhuma hipótese, ninguém olhou dado, justificativa é "me pediram".

**C) Problema vago sem entrega definida** ("quero melhorar o engajamento") — não é tarefa nem tarefa disfarçada: ainda não existe entrega pra especificar. Ofereça rotear pra `/desafio` (abertura decisão-first da `descobrir`), **sem** o script de solução pronta de B.

Se **B**, NÃO comece a implementar. Diga algo como:

> "Isso parece parte de um desafio, não uma tarefa avulsa. Antes de eu codar: qual placar essa entrega move, e qual hipótese ela testa? Se ainda não temos isso, o `/desafio` estrutura o problema — e aí essa entrega entra no plano testando uma hipótese de verdade."

Usuário topa estruturar → **roteie para `/desafio`** (skills `descobrir`/`definir`) e retome no Step 1 com a entrega ligada a uma hipótese. Usuário decide seguir direto → registrar no `## Log de execução` da entrega: "entrega executada sem desafio estruturado, por decisão do dono" — e seguir. **Você desafia uma vez, com respeito; não sequestra o fluxo.**

## Detecção de defaults do projeto

Antes do Step 1 (leituras em paralelo; conferir antes `references/patterns-por-projeto.md`):

| Item | Como detectar | Fallback |
|---|---|---|
| Nome do repo | `package.json` (`name`, `workspaces`) ou manifesto equivalente | Perguntar |
| Branch principal | `git symbolic-ref refs/remotes/origin/HEAD` | Perguntar |
| Comandos de validação | scripts de `lint`/`typecheck`/`test`/`build` do manifesto do projeto | Perguntar |
| Commitlint scopes | `.commitlintrc*` / `commitlint.config.*` (`scope-enum`) | Perguntar |
| Idioma commit/PR | defaults do usuário; README/CLAUDE.md | Perguntar |
| Template de PR | `.github/PULL_REQUEST_TEMPLATE.md` (e variantes) | Gerar inline |

**Princípio:** em dúvida ou faltando dado → **perguntar** via `AskUserQuestion`. Nunca chutar em algo que cria estado externo.

## Fluxo principal

> **Regra geral: pergunte antes de executar cada step/fase**, exceto os passos mecânicos listados em "Exceções" do Step 7 e o que já está autorizado no Log para a mesma ação e escopo (regras 7 e 8 de `../descobrir/references/contrato-de-conversa.md`). Anuncie o que vai fazer (1 frase, exemplos em `references/steps-detalhados.md`), faça, mostre o resultado e espere OK.

### Step 1 — Entender o pedido

Identificar a forma de entrada (tabela acima) e classificar o **tipo de entrega**: software | prompt/skill/agente | script/consulta/automação | dashboard | documento/processo | experimento. Software → fluxo completo abaixo, sem mudança. Não-software → mesma espinha (SPEC, OK por step, evidência, log), com os steps adaptados por `references/tipos-de-entrega.md` — e Step 7 sempre Solo (o `dev-loop` é exclusivo de software). Ambíguo → `AskUserQuestion`.

### Step 2 — Arquivo da entrega

Em `/spec` ou planejamento sem implementação, executar antes da escrita o protocolo "Branch local no planejamento /spec" de `references/steps-detalhados.md`: base detectada, nome legível aprovado, branch local criada/reutilizada e associação registrada.

Entrega de um desafio → criar/abrir `entregas/<entrega-slug>.md` no diretório do desafio (resolução do diretório no contrato da capa); avulsa → `<dirSpecs>/YYYY-MM-DD-<slug>-spec.md`, com `dirSpecs` já resolvido acima — grave no diretório resolvido, nunca no default literal. Se a entrega pertence a um desafio, ANTES de criar/abrir o arquivo: ler a capa (`desafio.md` do desafio) e imprimir o bloco 📍 (formato no contrato: `../descobrir/references/capa-template.md`). Estrutura e template: `references/steps-detalhados.md`. Entrega vinda do `plano.md` já traz hipótese/métrica — não recriar; completar as seções técnicas. Propor título + descrição estruturada e **só gravar após OK**.

### Step 3 — Branch base

Use a branch principal detectada e informe em uma linha, junto do anúncio do Step 4, sem parada própria; o dono corrige se for outra. Candidatos: a `Branch base` registrada em `references/patterns-por-projeto.md` (tem prioridade; se divergir de `git symbolic-ref refs/remotes/origin/HEAD`, a de `origin/HEAD` é um segundo candidato) ou, sem registro, a de `origin/HEAD`; e a branch atual, quando não é a principal e tem commits fora dela (`git log <principal>..HEAD` não vazio: entrega empilhada). `AskUserQuestion` (**"Em qual branch devo me basear?"**) só se a detecção falhar ou houver mais de um candidato. Guardar como `branchBase` e registrar no contrato de sessão do Step 5.

### Step 4 — Planejamento → SPEC (OBRIGATÓRIO)

A arquitetura segue as **regras ponytail P1–P18** (fonte única: `../dev-loop/references/escada-ponytail.md`): antes de propor qualquer código novo, descer a escada P1–P7 e parar no primeiro degrau que resolve. **P8** é inegociável (segurança, validação de fronteiras e a11y nunca entram no corte) e **P10** exige justificativa escrita para cada dependência nova que a spec propuser.

- **4a — Pré-scan + exploração:** começar econômico por padrão: varredura sequencial ou 1 agente `Explore` para estimar complexidade, riscos e áreas tocadas. Métodos concretos de investigação em `../descobrir/references/metodologias-investigacao.md`. Se antes da SPEC a entrega já mostrar risco médio/alto e houver ganho claro em paralelizar, apresentar um **perfil inicial provisório** (Econômico / Balanceado / Máximo) e deixar o usuário ajustar agentes/modelo/effort. Exploração usa Sonnet no mínimo — JAMAIS haiku. Balanceado/Máximo paralelizam agentes `Explore` por ângulo: arquitetura/padrões, candidatos a reuso, pontos de integração/regressão, `CLAUDE.md`/rules/READMEs/`<dirSpecs>/`.
- **4b — Brainstorming:** `superpowers:brainstorming` se disponível (SEMPRE que estiver); senão conduzir manualmente com o mesmo rigor (intenção → alternativas → trade-offs → convergência). Verificar dependências (PRs, releases, packages).
- **Contrato de qualidade (antes de 4c):** carregar `../dev-loop/references/quality-contract.md`;
  resolver convenções por instruções/configuração e registrar fonte/decisão. Selecionar base +
  perfis da área (typescript/frontend/backend) com seus checks. Planejar interfaces mínimas,
  testes independentes e recorte por responsabilidade; arquivo tocado >400 linhas exige decisão
  em `decomposition`, sem divisão cega ou refatoração geral. Não instalar bibliotecas.
- **4c — SPEC:** no formato canônico `../dev-loop/references/spec-template.md`: objetivo, critérios de aceite TODOS verificáveis e mapeados pra testes executáveis (é esse mapa que alimenta o portão TDD do Step 7), com a coluna `Tipo` (reprodução ou preservação) decidida com o dono, non-goals, restrições, unidades paralelizáveis com contratos e seção única `Contrato de qualidade` no schema canônico; validar software com `spec-ids.mjs <spec> --quality` antes do TDD; gravar na seção `## SPEC` do arquivo da entrega.
  **Quem autora (regra do planner):** spec é trabalho de arquiteto, e o planner titular é **Fable** (Opus é revisor e piso de fallback). Sessão rodando Fable → você mesmo autora. Qualquer outra sessão (**Opus incluso**) → despache o agente `odin:arquiteto` promovido via `model: "fable"` pra desenhar/decompor a SPEC (o frontmatter garante Opus como piso se a promoção não vingar) e **você consolida** o retorno no template; monte o brief do `odin:arquiteto` com `iris:delegar-agente`, que ajusta o texto ao modelo de destino. O default `dev_loop_arquiteto` governa planner e advisor: se estiver `opus`, a sessão Opus autora direto. Racional: erro de spec multiplica em TODAS as unidades da implementação — é o ponto de maior alavancagem do modelo caro.

Iterar até a **spec ser aprovada**. Se o pedido for apenas `/spec` ou "não implementa", parar aqui: entregar a SPEC e, no máximo, registrar um perfil de execução sugerido — sem opt-in de execução, sem Step 7, sem commit automático, push ou PR. A branch local já foi preparada pelo protocolo de `/spec`; registrar aprovação da SPEC e preservar a associação no Log. Se o usuário quer implementar agora, apresentar junto o **Plano de custo/rigor** do `dev-loop` (a sugestão inicial honra o `perfil_custo_padrao` e o tiering `dev_loop_*` dos defaults quando existirem) e perguntar o **modo do Step 7** (Solo × Loop) e, se Loop, confirmar o perfil escolhido + opt-in multi-agente. A IA recomenda; o usuário decide.

### Step 5 — Plano aprovado → log

Registrar no `## Log de execução` do arquivo da entrega, como entrada `[Step 5]`: data, resumo do plano aprovado, hipótese que testa (ou o registro de execução sem desafio, por decisão do dono), modo escolhido (Solo/Loop + perfil) e o **contrato de sessão** — `branchBase`, comandos de validação detectados, scope de commitlint e idioma. É esse registro que sobrevive à compactação e permite a retomada não re-perguntar nem chutar.

### Step 6 — Criar a branch

Se `[branch-spec]` já associa a branch à entrega, conferir estado real e autorização, reutilizar essa branch e não executar os comandos abaixo. Se for preciso trocar com alterações pendentes, parar para decisão; não transportar trabalho silenciosamente.

```bash
git checkout <branchBase> && git pull origin <branchBase> --ff-only
git checkout -b feat/<entrega-slug>
```

Nome segue `convencao_branch` dos defaults (default `feat/<entrega-slug>`), sem sufixo. Confirmar com `git branch --show-current`. **Branch já existe** (retomada) → NÃO falhar nem criar variação com sufixo: perguntar — reusar como está / recriar do zero / abortar — e registrar a escolha no Log.

### Step 7 — Implementação (dois modos)

> **🔴 Portão TDD (vale pros DOIS modos — regra canônica em `../dev-loop/references/escada-ponytail.md`):** implementação NÃO começa sem critérios de aceite materializados em **testes de reprodução vermelhos** (falhando por asserção, pelo motivo certo), ao lado de **controles de preservação** que já passam. O tipo de cada critério vem da coluna `Tipo` da SPEC aprovada, nunca de quem escreve o teste. Implementador não edita teste. Critério sem teste → volta pro Step 4c. Exceção justificada: critério puramente visual → verificação complementar explícita (preview/screenshot/review visual). Implementação que já existe numa retomada não se reverte: o vermelho é medido numa cópia da base. Continuar sem nenhuma reprodução vermelha exige autorização do dono registrada no Log, citada literalmente, e só roda no modo Loop, perfil Máximo; no Solo, a entrega passa para o Loop (ver Modo SOLO), nunca segue no Solo com a exceção.

**Modo LOOP** (recomendado p/ ≥2 unidades ou mudança não-trivial): invocar a skill **`dev-loop`** — começa no portão TDD (etapas 1–2 já aconteceram aqui) e devolve o controle no Step 8. Requer perfil de custo/rigor + opt-in do Step 4. Passe sempre `baseRef` = SHA completo de `git merge-base <branchBase> HEAD` (40 ou 64 hex, como o git imprime; nome de ref, tag ou SHA abreviado é erro de `Args` antes de qualquer agente), calculado uma vez e gravado no Log (o run seguinte lê do Log), nunca o nome da branch: a `branchBase` anda depois do fork e traria trabalho alheio para a revisão e para a cópia da base; com ele, auditoria e lentes leem também o que já foi commitado na branch (checkpoint do Solo, run anterior). Passe `pendenciasPath` = o `<arquivoPendencias>` resolvido, o mesmo valor em todo run da entrega: a impressão da validação o deixa de fora, junto com o arquivo da entrega. `vermelhoNaBase: true` só quando a implementação já existe (retomada, ou fases já implementadas no Solo quando a entrega passa para o Loop). Ao receber o controle de volta, gravar o relatório condensado do loop no Log de execução (template em `references/steps-detalhados.md`), com a linha do `validacaoFinal` que o Step 8 usa.

**Modo SOLO** (mudança pequena, 1 unidade, ou sem harness multi-agente) — quebrar em **fases**; para cada fase:

1. **Anunciar** em 1 frase e pedir OK pra começar. Em software, ler o contrato de qualidade aprovado e aplicar seu recorte durante a implementação, antes do self-review; preservar decisões e atualizar decomposição se o arquivo crescer.
2. **TDD primeiro:** escrever os testes da fase, classificados em reprodução e preservação, **confirmar o vermelho das reproduções** (e o verde dos controles), só então implementar até o verde — sem afrouxar teste pra passar. Implementação já presente (retomada): meça o vermelho numa cópia da base, sem reverter a worktree: `node "${CLAUDE_PLUGIN_ROOT}/skills/dev-loop/scripts/copia-base.mjs" criar <baseRef do Log> '<array JSON dos testes>'` da raiz física do workspace (`--apoio '<JSON>'` para helpers e fixtures do portão, `--vincular '<JSON>'` para diretórios de dependência), rode cada teste pelo próprio comando dentro da cópia (reprodução falha por asserção, preservação passa) e `copia-base.mjs remover <dir>` ao fim. Teste que passa também na base é teste inútil (reescrever ou cortar), não implementação anterior; módulo que a entrega cria (adicionado em `inspecionar-git.mjs alteracoes <baseRef>`) e ainda não existe na base conta como vermelho válido; qualquer outro erro de import, sintaxe ou infraestrutura é evidência inválida. Base que não pode ser medida: registre no Log a decisão do dono nos campos do `rebaselineTdd` (critérios, motivo, quem, quando) e escreva "vermelho não medido", nunca "vermelho confirmado".
3. **Self-review** (checklist em `references/steps-detalhados.md`).
4. **Gate de qualidade (OBRIGATÓRIO)** — seguir `../dev-loop/references/quality-contract.md`
   e o gate expandido de `references/steps-detalhados.md`: conferir cada ID do contrato,
   registrar comandos executados, inventário e evidência por arquivo:linha, incluindo
   decomposição. Aplicar P1–P18 por responsabilidade e risco, sem penalizar interface de uso
   único nem exigir comentário de processo. O relato Solo declara autorrevisão; não equivale
   à auditoria independente do Loop. Problema dentro do escopo → corrigir antes de apresentar.

5. **Apresentar resumo** e **aguardar OK** antes da próxima fase.
6. **Commit de checkpoint opcional** ao fim da fase — só com OK, regras do Step 9.

**Solo sem nenhuma reprodução vermelha** (decisão do dono, 2026-11-03; regra canônica em `../dev-loop/references/escada-ponytail.md`): se o dono quer seguir assim mesmo, a entrega não segue no Solo. Vale por fase, critério a critério: basta uma reprodução da fase que não fica vermelha e que o dono quer manter, em vez de cortar o critério já atendido ou reescrever o teste inútil, mesmo ao lado de outras vermelhas. Explique reprodução e preservação, registre a autorização no Log com a frase do dono citada literalmente e passe para o modo Loop no perfil Máximo: run novo do `dev-loop` com `autorizacoesTdd`, depois do opt-in de custo do Loop pedido e registrado no Log como em qualquer Loop (autorização já registrada vale quando escopo e custo não aumentaram). Quando a entrega passa para o Loop com fases já implementadas no Solo (com ou sem checkpoint commitado), elas contam como implementação anterior: o run leva o `baseRef` do Log com `vermelhoNaBase: true`, e `autorizacoesTdd` cobre só os critérios sem vermelho; sem `vermelhoNaBase`, o portão bloqueia com `implementacao-preexistente`. Registre a troca de modo no Log. Sem esse opt-in, ou sem harness multi-agente para rodar o Loop, a entrega fica bloqueada no portão, sem perguntar pelo opt-in quando não há harness. Controles de preservação e `rebaselineTdd` seguem no Solo como acima.

Ao **fim de cada fase** (com ou sem commit), gravar uma entrada `[Step 7]` no Log dizendo qual fase fechou e qual é a próxima. Sem esse rastro, uma interrupção no meio do Step 7 deixa a retomada sem posição — e testes vermelhos já escritos no disco valem como portão TDD cumprido só se o Log disser que foram escritos e confirmados. Retomada que encontra a implementação já na worktree não reverte nada para fabricar vermelho: no modo Loop, reinvoque o `dev-loop` em run novo com `baseRef` + `vermelhoNaBase: true` (vermelho medido numa cópia da base); quando a base não puder ser medida, com `rebaselineTdd` (critérios aprovados, autorização do dono) e, quando houver, a `validacaoFinal` do relatório anterior em `rebaselineTdd.validacaoAnterior`.

**Exceções (rodar sem perguntar):** leituras, validações locais (lint/typecheck/test), builds não-destrutivos. Falhou → reportar e perguntar.

**Desvios/débitos encontrados:** registrar em `docs/pendencias.md` (protocolo em `references/steps-detalhados.md` — NUNCA commitar esse arquivo) + entrada ⚠️ no Log de execução. Fora do escopo vira pendência pela P14, sem perguntar; pergunte só se o desvio impede um critério da SPEC.

### Step 8 — Validações + testes

Com as fases aprovadas, rodar em paralelo (validação local é passo mecânico, ver "Exceções" do Step 7): lint, typecheck, testes, build, conforme patterns/detecção. Verificação que não é local (entrega não-software com dados reais ou sistema externo, suíte com custo, deploy, publicação, escrita fora do workspace) continua anunciada e com OK. Falhou → reportar últimas ~20 linhas, diagnosticar causa raiz, `AskUserQuestion` (corrigir agora / ignorar com justificativa / pausar). **Não prosseguir com falhas** sem decisão do usuário. Falha de ambiente (cache, temporário ou estado sem escrita, ferramenta ausente) é reportada como ambiente, com o path e a variável que a controla, sem ser escondida nem tratada como regressão; corrigir agora, nesse caso, corrige o ambiente, nunca código ou teste da entrega.

**Reaproveitar a validação do dev-loop** (evita repetir a suíte longa na mesma árvore): se o relatório verde trouxe `validacaoFinal` com `verde: true` e `impressao` não nula, recalcule da raiz física do workspace `node "${CLAUDE_PLUGIN_ROOT}/skills/dev-loop/scripts/hashes-testes.mjs" --impressao '<validacaoFinal.excluidos em JSON>' '<validacaoFinal.excluidosNaoRastreados em JSON>'` (as mesmas listas do loop, nessa ordem: o Log da entrega, fora do diff, e o arquivo de pendências, fora só dos não rastreados, gravados depois da validação). Valor `<sha>-<conferência>` igual por inteiro → cada comando do Step 8 que está em `validacaoFinal.comandos` não roda de novo; registre no Log "validação reaproveitada do dev-loop (iteração N, impressão X)". Comando fora dessa lista roda. Impressão diferente ou nula, exit diferente de 0 do script, ou dúvida concreta sobre o ambiente (venv, `node_modules`, `.env`, versão de ferramenta, que a impressão não cobre) → rode tudo. Se algum comando de validação lê o arquivo da entrega ou o de pendências (lint de markdown, checagem de links, grep no repo), não reaproveite.

### Step 9 — Commit (PEDIR OK — NUNCA sem autorização)

Antes de preparar o commit, inspecione TODO o índice com
`git diff --cached --no-ext-diff --no-textconv` e a lista de paths. Preserve qualquer conteúdo
preexistente: se for alheio ao escopo ou a origem de um trecho estiver incerta, pare e resolva
com o humano. Não remova do stage, sobrescreva ou inclua silenciosamente alterações de outra
tarefa. Mesmo um path autorizado pode conter trechos anteriores não autorizados.

Mostre a lista exata de arquivos, o diff proposto e a mensagem
(`<type>(<scope>): <subject>` + body opcional) via `AskUserQuestion`. Após OK explícito,
substitua os marcadores abaixo por paths literais e JSON com quoting correto. Use lista de
arquivos, não diretórios/globs; rename exige origem e destino. Exclua o path resolvido de
pendências, segredos e arquivos alheios. Então:

```bash
git --literal-pathspecs add -- <paths-específicos>   # NUNCA git add -A nem git add .
node "${CLAUDE_PLUGIN_ROOT}/skills/dev-loop/scripts/inspecionar-git.mjs" staged '<array JSON dos paths autorizados>' &&
  git commit -m "<mensagem + Co-Authored-By: Claude <noreply@anthropic.com>>"
```

O helper lê todos os paths staged, sem alterar o índice: stage vazio ou arquivo fora da
lista retorna exit 1 e impede o commit encadeado. Preserve o diagnóstico e resolva a causa;
não contorne o veto. A conferência de paths complementa a leitura do diff, não aprova seu
conteúdo. Confira novamente se algum processo alterar o índice entre a revisão e o commit.

Registrar a entrada `[Step 9]` no Log **com o hash curto** do commit — é o que permite casar Log e `git log` numa retomada (mensagem de commit não serve: rebase/squash/amend a reescrevem).

Não incluir `docs/pendencias.md`. Hook falhou → NOVO commit (não `--amend`).

### Step 10 — Push + abrir PR (PEDIR OK)

Confirmar a **branch alvo** ("Posso abrir a PR pra `<branchBase>`? Ou outra?"). Após OK: `git push -u origin feat/<entrega-slug>`, preencher o **template de PR do repositório** (senão gerar inline no idioma detectado) e `gh pr create --base <alvo> --head feat/<entrega-slug> --title "<type>(<scope>): <subject> [<entrega-slug>]" --body-file <arquivo>`. Capturar a URL. Defaults com `abrir_pr_padrao=commit-local` → pular o PR com registro no Log.

### Step 11 — Fechar a entrega

Reporte final (template completo em `references/steps-detalhados.md`) como entrada final do Log de execução; atualizar o campo `**Estado:**` do arquivo da entrega (fonte única do estado — o `plano.md` só referencia); marcar a entrega na checklist do `plano.md`; executar o checklist de saída de fase do `capa-template.md` (linha da entrega na tabela de Artefatos, pendências, `Atualizada em`); sugerir `/acompanhar` quando a métrica da hipótese tiver dado pra ler. **Regressão de estado** (ex.: `validado` → `em execução`) só com entrada no Log dizendo o motivo.

## NUNCA fazer

- ❌ `git commit`, `git push`, `gh pr create` sem **autorização explícita** na mesma sessão
- ❌ Publicar dashboard, ativar automação, ligar experimento ou qualquer mutação externa de entrega não-software sem **OK explícito** — equivale ao `git push` sem autorização
- ❌ `git add -A` / `git add .` — sempre paths específicos (evita `.env`/segredos/binários)
- ❌ Commitar `docs/pendencias.md`
- ❌ `git commit --amend` em commit já pushed
- ❌ `--no-verify` sem o usuário pedir
- ❌ Marcar entrega como concluída no `plano.md` com validações vermelhas
- ❌ Pular o brainstorming no planejamento
- ❌ Pular o portão de desafio (Step 0.5) quando o pedido nasce de objetivo de resultado
- ❌ Começar implementação sem critérios de aceite + testes de reprodução vermelhos e controles de preservação verdes (portão TDD), salvo autorização registrada do dono num Loop em perfil Máximo (no Solo, nunca: a entrega passa para o Loop) ou retomada com o vermelho medido na base ou `rebaselineTdd`
- ❌ Afrouxar/editar/skipar teste pra fazê-lo passar
- ❌ Pular validações/testes pra ir mais rápido
- ❌ Hardcodar credenciais (tokens, API keys, senhas)
- ❌ Encadear steps sem pedir OK entre eles (salvo os passos mecânicos de "Exceções" do Step 7 e o que já está autorizado no Log)
- ❌ Em retomada: recriar SPEC/descrição aprovadas, duplicar entrada de log, ou re-executar mutação externa (branch, commit, push, PR, publicação) sem conferir o estado real e perguntar

## Quando perguntar ao usuário

Sempre que houver ambiguidade, preferir perguntar a chutar: entrega de desafio × avulsa; branch base e comandos de validação quando a detecção falhar ou for ambígua; branch alvo da PR; scope do commitlint e idioma; spec vazia; desvio que impede um critério da SPEC; e antes de commit, push e PR. O que é mecânico se verifica e se informa (regra 8 do contrato de conversa).

## Integração com outras skills

Esta skill **invoca** (sem duplicar lógica):

- `descobrir`/`definir` (este plugin) — portão de desafio (Step 0.5) via `/desafio`; no sentido inverso, o plano da rodada do `desenvolver` gera as entregas que entram aqui pelo Step 2
- `dev-loop` (este plugin) — Step 7 modo Loop; fonte única de Plano de custo/rigor e roteamento de modelos (a escada ponytail + portão TDD vivem na reference compartilhada `escada-ponytail.md`, e o formato de spec em `spec-template.md`, ambas nas references dela)
- `superpowers:brainstorming` — Step 4b, se disponível
