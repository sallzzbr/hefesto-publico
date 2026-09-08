# Steps detalhados — aprofundamento do entregar

> Paths do workspace resolvem pela regra única em
> `../../descobrir/references/capa-template.md`; os literais nesta referência são ilustrativos
> do default, não hardcode.

> Carregue a seção certa quando o SKILL.md mandar. O fluxo essencial está no SKILL.md;
> aqui ficam templates e critérios expandidos.

## Template de descrição da entrega (Step 2)

Usar as seções aplicáveis — omitir as que não fizerem sentido:

- **OBJETIVO** (1-2 frases)
- **CONTEXTO / OBJETIVO ESTRATÉGICO** (se a entrega pertence a um desafio: qual problema, qual hipótese testa, qual métrica do placar observa)
- **BENEFÍCIOS PARA O PRODUTO**
- **O QUE SERÁ ENTREGUE**
- **REGRAS E LÓGICAS**
- **POSICIONAMENTO / LAYOUT** (se UI)
- **ACESSIBILIDADE** (se UI)
- **DECISÕES TÉCNICAS**
- **CENÁRIOS DE TESTES (QA)**
- **CRITÉRIOS DE ACEITE**

Para bug/correção, focar em: **PROBLEMA**, **CAUSA RAIZ (se conhecida)**, **COMPORTAMENTO ESPERADO**, **CRITÉRIOS DE ACEITE**.

## Step 2 — arquivo da entrega

A entrega vive em `<dirDesafios>/<slug>/entregas/<entrega-slug>.md` (entrega de um desafio; `docs/desafios/` é o default — resolução no contrato da `capa-template.md`) ou em `<dirSpecs>/YYYY-MM-DD-<slug>-spec.md` (entrega avulsa, sem desafio; default `docs/plans/`).

Estrutura do arquivo:

- `# Entrega: <título>`
- Linha de vínculo — só em entrega de um desafio: `**Desafio:** <slug> · **Hipótese:** H<n> · **Métrica:** <do placar>`
- `**Tipo:** <software | prompt/skill/agente | script/consulta/automação | dashboard | documento/processo | experimento>` (taxonomia em `tipos-de-entrega.md`, nesta pasta)
- `**Estado:** <planejado | em execução | implementado | validado | parcialmente validado | bloqueado | pronto para merge | pronto para produção | entregue>` — atualizar a cada mudança; `validado` exige evidência no log
- `## SPEC` — formato canônico em `../../dev-loop/references/spec-template.md` (com gate de prontidão preenchido antes do OK; o arquivo completo — vínculo + SPEC + log — é o **Implementation Pack** da entrega)
- `## Log de execução` — cronológico: plano aprovado, FUPs do loop, desvios, reporte final

Entrega vinda do `plano.md` já traz hipótese/métrica — não recriar; completar apenas as seções técnicas que faltarem.

## Gate de qualidade do modo Solo (Step 7) — critérios expandidos

Responder **por escrito** (1 frase cada). Não basta marcar ✅; tem que justificar. Se a resposta a qualquer uma expuser um problema, **corrigir antes de apresentar** — não passar pra próxima fase com débito conhecido. Este gate é a contraparte Solo da **auditoria ponytail** que o harness roda em código a cada iteração — as perguntas citam as regras de `../../dev-loop/references/escada-ponytail.md` em vez de reexplicá-las:

1. **Esse código precisa existir? (P1)** — resolve de fato o que a fase se propôs? Sem código morto, sem sobra de scaffolding, sem solução que não casa com o problema?
2. **Existe algo parecido na base pra reaproveitar? (P2)** — busquei (`grep`/`find`) por componente/hook/util/função equivalente antes de escrever? Se existe e não usei, por quê?
3. **Dá pra escrever com menos código e mais legível? (P13)** — tem duplicação, abstração desnecessária, ou trecho que ficaria mais claro decomposto em funções nomeadas (ver "Design de Funções" do projeto)?
4. **Está escrito de forma orientada a testes? (P17)** — a lógica está em peças puras/testáveis isoladas (não acoplada a I/O, estado global ou JSX)? Dá pra escrever um teste sem mockar meio mundo? Lógica não-trivial deixou pelo menos UM check executável pra trás?
5. **Evita ciclos de ramificação?** — minimizei `if/else` aninhados? Usei early-return/guard clauses, lookup maps, ou polimorfismo no lugar de cadeias de condicionais (complexidade ciclomática baixa)?
6. **Toda dependência nova tem justificativa por escrito? (P10)** — para cada pacote adicionado, escrevi por que P1–P5 falharam (não existe na base, nem na stdlib, nem na plataforma, nem numa dependência já instalada)? Sem esse texto, a dependência sai.
7. **Criei abstração de uso único ou arquivo desnecessário? (P11/P12)** — tem wrapper/helper/interface com um só chamador? Tem arquivo novo cujo conteúdo cabia num arquivo existente que já era o lugar natural?
8. **Mexi em algo fora do escopo? (P14)** — reformatei ou refatorei código que a fase não pedia? Se sim, reverter: isso vira pendência em `docs/pendencias.md`, não diff desta entrega.

## Self-review do modo Solo — checklist expandido

- ✅ Está de acordo com o **plano** aprovado?
- ✅ Segue a **arquitetura** e os padrões do projeto (estrutura de arquivos, convenções)?
- ✅ Está **padronizado** (nomenclatura, estilo, idioma)?
- ✅ **Espaçamento/legibilidade:** statements e blocos lógicos separados por linha em branco — código não "grudado" (`convencoes-formatacao.md`, nesta mesma pasta)
- ✅ Reaproveita o que foi identificado na exploração do Step 4?

## Registro de desvios (`docs/pendencias.md`)

> O arquivo de desvios resolve pela regra única (`local_pendencias`, regra 7 do contrato da capa); `docs/pendencias.md` abaixo é o default ilustrativo.

Se durante a implementação aparecer algo **fora do padrão** ou um **problema** (débito técnico, bug pré-existente, inconsistência): anexar ao checklist `docs/pendencias.md` com problema, arquivo e sugestão. Esse arquivo **não é commitado** junto da feature — **nunca incluir no `git add`**. Para garantir que nunca seja versionado por engano sem mexer no `.gitignore` do repo, pode adicioná-lo ao `.git/info/exclude` **deste repo** (com OK do usuário; não usar o gitignore global — afetaria outros repos). Perguntar ao usuário se quer corrigir o desvio **agora** ou **deixar pro futuro**.

**Divisão com a capa (não vaze pendência pro lugar errado):** `docs/pendencias.md` é só pra **débito técnico local do repo** (código, teste frouxo, inconsistência achada de passagem). Pendência ou risco **do desafio** — algo que bloqueia gate, decisão em aberto, dependência externa, item do gate de prontidão — vai pra tabela `Pendências e riscos abertos` da capa (`desafio.md`), que é commitada e visível em qualquer máquina. Na dúvida: se perder o item trava o desafio, é na capa.

## FUPs de implementação — log da entrega

Sem opt-in — é local e barato: o rastro da implementação vai direto para a seção `## Log de execução` do arquivo da entrega. Regras (valem pra qualquer entrada):

- **Toda entrada referencia o step** que a gerou, no início: `[Step N]` (ou `[retomada]`) — é
  isso que torna o log retomável e idempotente (protocolo abaixo).
- **Evidência é resumo + link/path** (PR, path do teste) — nunca dump de log nem diff colado inteiro.
- **NUNCA** credenciais, tokens, API keys ou PII.
- Screenshots continuam no PR — não anexar arquivos no log.
- FUP não introduz informação nova: o conteúdo é o que o usuário já viu/aprovou no chat.

**Template — FUP do dev-loop** (Step 7 modo Loop, ao receber o controle de volta):

```markdown
📓 **FUP — dev-loop concluído**
- ✅ Critérios: A1..An verificados (1 linha de evidência cada)
- 🔴→🟢 TDD: <N> testes escritos no portão, vermelho confirmado → verde final
- 🔁 Iterações: <N> rodadas (<findings confirmados vs descartados>)
- 🆘 Consultas: <N> — <decisão de arquitetura em 1 linha cada, se houver>
- 📊 Diff: <arquivos tocados, +/− linhas>
```

**Template — FUP de desvio/pendência** (Step 7, junto do registro em `docs/pendencias.md`):

```markdown
⚠️ **FUP — desvio/pendência**
- Problema: <1-2 frases> (<arquivo>)
- Decisão: <corrigido agora | registrado para depois em docs/pendencias.md>
```

Cada entrada é acrescentada ao `## Log de execução` na hora — vira uma entrada no log, não um comentário à parte.

## Protocolo de retomada (re-entrada após falha, interrupção ou compactação)

Válido pros dois tiers (expresso e completo). Ao re-entrar no fluxo de uma entrega:

1. **Localizar a entrega:** varrer `<dirDesafios>/*/entregas/*.md` e
   `<dirSpecs>/*-spec.md` por `**Estado:**` não-terminal; 1 match → é essa; 2+ → perguntar
   qual; nenhum → não é retomada, é entrega nova. Buscar no default literal quando o
   workspace resolveu outro diretório é o que faz a retomada virar entrega duplicada.
2. **Reconstituir a posição lendo, nunca assumindo:** abrir o arquivo da entrega; o campo
   `**Estado:**` + a última entrada `[Step N]` do Log dizem onde parou (divergindo entre si,
   **o Log ganha** — é cronológico; o `Estado` pode não ter sido atualizado). Ler a capa do
   desafio (tier, fase) e imprimir o bloco 📍. Cruzar com o estado real do repo:
   `git branch --show-current`, `git log --oneline <branch> -20`, `git status --short`,
   `git rev-parse @{u}` (a branch já foi pushed?) e — sempre que houver branch de trabalho,
   não só quando o Log cita PR — `gh pr view <branch>`.
3. **Não reabrir o que foi aprovado:** descrição (Step 2) e SPEC (Step 4c) aprovadas não se
   recriam nem se reescrevem em retomada — reabrir só com pedido explícito do dono (e aí é
   revisão registrada, não retomada). Steps 0.5, 1 e 3 também não se repetem: classificação,
   tipo e `branchBase` vêm do Log.
4. **Working tree sujo é esperado numa retomada** (é o trabalho parcial), não a anomalia que o
   Step 0 trata: não pare por causa dele — reportar o que está sujo e seguir. A regra do Step 0
   vale pra entrega nova, antes de criar branch.
5. **Registrar a retomada:** uma entrada `[retomada]` no Log — "retomando do Step N: <como a
   posição foi confirmada>" — e seguir do step aberto. Não duplicar: se a última entrada já
   registra o evento que seria gravado, não gravar de novo; e retomada sem nenhum progresso
   desde a `[retomada]` anterior não gera entrada nova.
6. **Steps com mutação externa (6, 9, 10 e publicação não-software):** são os únicos onde
   repetir cria estrago —
   - branch já existe → perguntar: reusar como está / recriar do zero / abortar. Antes de
     oferecer "recriar", **listar o que se perde** (`git log <branch> --not <branchBase>
     --oneline`) e exigir OK explícito pra deletar; commit não pushed some do alcance normal.
   - commit/push/PR/publicação já registrados no Log → conferir o estado real antes de
     qualquer repetição; **nunca** re-executar às cegas.
7. **Divergência entre Log e estado real** — os dois sentidos têm tratamentos diferentes:
   - **Log registra, repo não mostra:** antes de concluir que se perdeu, procurar
     (`git log --all --oneline | head -30`, `git reflog -20`, `git stash list`,
     `git branch --contains`) — pode ser branch errada em checkout, reset/rebase, ou hook que
     falhou depois do Log. Achado → reportar onde está e seguir. Não achado → reportar como
     trabalho perdido e perguntar (refazer / abandonar / investigar mais); nunca refazer
     silenciosamente.
   - **Repo mostra, Log não registra** (sessão morreu antes de gravar): reconciliar é
     permitido e é o certo — acrescentar a entrada `[Step N]` faltante marcada
     `(reconciliada na retomada)` com a evidência real (hash do commit, URL do PR), e seguir.
     Isso não é "reabrir o aprovado": é registrar o que já aconteceu.
   - Dono também não sabe explicar a divergência → não force: registre o item na tabela
     `Pendências e riscos abertos` da capa, marque a entrega `bloqueado` e pare.
8. **Steps sem mutação externa** (validações, leituras, self-review): re-executar é barato e
   seguro — na dúvida sobre a integridade do resultado anterior, rode de novo.

## Reporte final (Step 11) — template completo

Reportar com URLs clicáveis:

- ✅ **PR aberto:** `<gh-pr-url>`
- ✅ **Entrega:** `<dirDesafios>/<slug>/entregas/<entrega-slug>.md` (log atualizado, checklist do `plano.md` marcada)
- 🧭 **Desafio (se aplicável):** qual hipótese essa entrega testa e qual métrica observar a partir de agora — sugerir agendar o `/acompanhar`
- 📋 **Pendências registradas** em `docs/pendencias.md` (se houver) — relembrar de tratar
- 📸 Relembrar de adicionar screenshots ao PR se for feature de UI
- 📋 Resumo do que mudou (1-3 bullets)

## Sinalização ao usuário (exemplos)

Antes de cada step principal, anunciar em 1 frase — curto, específico, escaneável:

- "🧭 Step 0.5 — portão de desafio: isso é tarefa ou desafio disfarçado?"
- "📋 Step 2 — abrindo o arquivo da entrega `entregas/<entrega-slug>.md`..."
- "🔗 Step 3 — qual branch base?"
- "🧠 Step 4 — exploração + brainstorming + spec (escada ponytail)..."
- "💸 Step 4 — plano de custo/rigor: sugiro `<perfil>` para gastar menos tokens com segurança..."
- "🌿 Step 6 — criando branch `feat/<entrega-slug>`..."
- "🔁 Step 7 — modo Loop: disparando o `dev-loop` (N unidades, M agentes)..."
- "✅ Step 8 — validações + testes (preciso do seu OK)"
- "🚀 Step 10 — push + PR (preciso do seu OK)"
