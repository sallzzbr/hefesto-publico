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

Carregue `../../dev-loop/references/quality-contract.md` no planejamento e mantenha o contrato
aprovado à vista durante a implementação. Em software, o gate usa os mesmos IDs, perfis,
`qualityExecutions`, `qualityInventory` e `qualityReview` do Loop, com declaração de
**autorrevisão, não independente**. Em SPEC-lite registre evidência pela régua do artefato.
No Solo execute `inspecionar-git.mjs quality <paths-json> [base [pendenciasPath]]` e preserve
seu JSON literal. O argumento final opcional é somente o arquivo de pendências resolvido;
use `HEAD` quando não houver base explícita. Só o passe fora dos alvos, arquivos
tocados/declarados, testes, apoio, SPEC e área de implementação. O helper dispensa apenas
arquivo regular não rastreado ou ausente. Pendência exata regular em HEAD ou índice segue
o inventário normal, inclusive mudanças e remoções; recusa entrada somente na base,
diretórios, symlinks e fuga. Flags `skip-worktree` ou `assume-unchanged` em alvos ou pendências recusam
a inspeção. Arquivos alheios marcados só passam com bytes literais, tipo e modo iguais ao
índice; ausência fora das regras sparse sem mudança base–índice é permitida. Diferenças ocultas, erro de
leitura ou índice unmerged recusam com diagnóstico, sem alterar bits Git. Sem o argumento, todas as omissões continuam visíveis.
Não filtre a saída manualmente; aplique a elegibilidade do contrato canônico.

Ausências sparse elegíveis usam um único lote NUL de membership; fallback prepara regras
e configuração uma vez por inventário, sem cache persistente. Symlink interno válido para
arquivo regular é objeto `symlink`, com zero linhas e bytes positivos de `readlink`, sem
ler conteúdo do alvo. No diff, novo link declarado usa `{path,type:"symlink",targetBase64}`.
Registre classificação, destino literal observado (ou bytes escapados/hex identificados),
resolução interna, limitação e inspeção na SPEC local inventariada. Evidência nontext cita
essa linha real da SPEC; nunca uma linha inventada no link. Links externos, dangling,
diretórios, tipos especiais e pendência-link continuam recusados.

1. Confronte cada check com seus alvos aprovados e registre arquivo:linha e observação
   concreta; outro arquivo inventariado não cobre o alvo. Exceção de citar a SPEC exige
   fonte local autorizada, medição textual e linha existente. Para alvo textual
   intencionalmente vazio (`lines: 0`, `bytes: 0`), cite essa SPEC e declare na observação
   o vazio, sua justificativa e forma de inspeção, como para binary/deleted. Não invente
   linha no alvo nem aplique essa exceção a texto com conteúdo.
   Comandos aprovados devem rodar com alvos iguais e
   saída real, sem cache de qualidade; confronte saída e efeito, não só exit 0. Reconcilie
   arquivos tocados/novos, testes protegidos, apoio TDD e SPEC autorizados no inventário;
   extras exigem decisão de escopo, sem incluir notas privadas automaticamente.
2. Confira fontes das convenções e perfis contra a stack real. Dispensa precisa estar aprovada
   e justificada. Não instalar bibliotecas para produzir verde.
3. Reveja P1/P2: código necessário e reuso efetivamente pesquisado. P13 exige foco e clareza,
   não redução de linhas. Interfaces de uso único podem proteger fronteira e testabilidade.
4. Confira coesão e `decomposition`: arquivo tocado >400 linhas exige decisão de extrair,
   manter com justificativa ou registrar débito fora do escopo. Evite arquivo gigante e
   divisão cega; não refatore o projeto inteiro para atender a um alerta.
5. Confira P17: testes proporcionais ao risco, oráculo independente, negativos e controles
   válidos. Para ramificações, prefira o fluxo mais legível sem criar abstração gratuita.
6. P10: dependência nova exige porquê P1–P5 falharam em SPEC/plano/ADR/PR acessível ou
   comentário útil; cite localização verificável e contexto. Nome de manifesto não basta.
   P18 não exige comentário de processo; JSDoc PT só quando útil ao contrato/manutenção.
7. P14: fora do escopo vira pendência, não diff. Problema no escopo impede declarar o gate
   satisfeito até correção e nova verificação. Exit não zero com relato completo é resultado
   funcional a corrigir/revalidar, quando essa for a causa, não evidência estrutural ausente.
   Falha de ambiente preserva parada operacional; não se corrige no código/teste.

## Self-review do modo Solo — checklist expandido

- ✅ Está de acordo com o **plano** aprovado?
- ✅ Segue a **arquitetura** e os padrões do projeto (estrutura de arquivos, convenções)?
- ✅ Está **padronizado** (nomenclatura, estilo, idioma)?
- ✅ **Espaçamento/legibilidade:** conforme formatter e convenções resolvidas; sem comprimir passos distintos (`convencoes-formatacao.md`, nesta mesma pasta)
- ✅ Reaproveita o que foi identificado na exploração do Step 4?

## Registro de desvios (`docs/pendencias.md`)

> O arquivo de desvios resolve pela regra única (`local_pendencias`, regra 7 do contrato da capa); `docs/pendencias.md` abaixo é o default ilustrativo.

Se durante a implementação aparecer algo **fora do padrão** ou um **problema** (débito técnico, bug pré-existente, inconsistência): anexar ao checklist `docs/pendencias.md` com problema, arquivo e sugestão. Esse arquivo **não é commitado** junto da feature — **nunca incluir no `git add`**. Para garantir que nunca seja versionado por engano sem mexer no `.gitignore` do repo, pode adicioná-lo ao `.git/info/exclude` **deste repo** (com OK do usuário; não usar o gitignore global — afetaria outros repos). Desvio fora do escopo fica para o futuro pela P14, sem perguntar; pergunte "agora ou depois" só quando o desvio impede um critério da SPEC.

**Divisão com a capa (não vaze pendência pro lugar errado):** `docs/pendencias.md` é só pra **débito técnico local do repo** (código, teste frouxo, inconsistência achada de passagem). Pendência ou risco **do desafio** — algo que bloqueia gate, decisão em aberto, dependência externa, item do gate de prontidão — vai pra tabela `Pendências e riscos abertos` da capa (`desafio.md`), que é commitada e visível em qualquer máquina. Na dúvida: se perder o item trava o desafio, é na capa.

## FUPs de implementação — log da entrega

Sem opt-in — é local e barato: o rastro da implementação vai direto para a seção `## Log de execução` do arquivo da entrega. Regras (valem pra qualquer entrada):

- **Toda entrada referencia o step** que a gerou, no início: `[Step N]` (ou `[retomada]`) — é
  isso que torna o log retomável e idempotente (protocolo abaixo).
- Pergunta registrada antes de ser feita e autorização do dono seguem o mesmo formato, com a
  marca depois do step: `[Step N] [pendente] <pergunta>` (recebe a resposta quando respondida,
  não é apagada) e `[Step N] [autorização] <data> · <autor> · <ação> · <escopo> · <citação>`
  (regras 7 e 8 de `../../descobrir/references/contrato-de-conversa.md`).
- **Evidência é resumo + link/path** (PR, path do teste) — nunca dump de log nem diff colado inteiro.
- **NUNCA** credenciais, tokens, API keys ou PII.
- Screenshots continuam no PR — não anexar arquivos no log.
- FUP não introduz informação nova: o conteúdo é o que o usuário já viu/aprovou no chat.

**Template — FUP do dev-loop** (Step 7 modo Loop, ao receber o controle de volta):

```markdown
📓 **FUP — dev-loop concluído**
- ✅ Critérios: A1..An verificados (1 linha de evidência cada)
- 🔴→🟢 TDD: <N> testes escritos no portão; <vermelho confirmado por execução independente | vermelho medido na base <baseRef> | sem vermelho, continuidade por <rebaseline | autorização de <autor> em <data>> (tdd.continuidade)> → verde final
- Vermelho medido (tdd.execucoes): <teste · critério · tipo · exit/tipoFalha · resumo, 1 linha por teste>
- Declaração do operário (tdd.declaracaoDoOperario, só quando disse não ou deixou ressalva): <problemas>
- 🔁 Iterações: <N> rodadas (<findings confirmados vs descartados>)
- 🆘 Consultas: <N> — <decisão de arquitetura em 1 linha cada, se houver>
- 📊 Diff: <arquivos tocados, +/− linhas>; baseRef: <SHA completo do merge-base>
- validacaoFinal: <impressao> · comandos <lista> · excluidos <lista> · excluidosNaoRastreados <lista> (o Step 8 e a próxima retomada recalculam com as duas)
```

"Vermelho confirmado" só entra quando `tdd.vermelhoConfirmado` é true. Run com `tdd.continuidade`
(rebaseline ou `autorizacoesTdd`) registra a continuidade e quem a autorizou, nunca vermelho
confirmado.

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
   revisão registrada, não retomada). Steps 0.5 e 1 não se repetem quando registrados: classificação,
   tipo vêm do Log; `branchBase` e `branchTrabalho` vêm do Step 5 ou de `[branch-spec]`. Campos ausentes seguem "Branch local no planejamento /spec", sem presumir registro existente.
4. **Working tree sujo é esperado numa retomada** (é o trabalho parcial), não a anomalia que o
   Step 0 trata: não pare por causa dele — reportar o que está sujo e seguir. A regra do Step 0
   vale pra entrega nova, antes de criar branch.
5. **Registrar a retomada:** uma entrada `[retomada]` no Log — "retomando do Step N: <como a
   posição foi confirmada>" — e seguir do step aberto. Antes de seguir, `[pendente]` sem resposta (ou linha da capa com a Decisão vazia): reapresente a pergunta, nunca presuma a resposta. `[autorização]` registrada vale para a mesma ação, escopo e custo igual ou menor, sem perguntar de novo, salvo mutação externa (item 6). Não duplicar: se a última entrada já
   registra o evento que seria gravado, não gravar de novo; e retomada sem nenhum progresso
   desde a `[retomada]` anterior não gera entrada nova.
6. **Steps com mutação externa (6, 9, 10 e publicação não-software):** são os únicos onde
   repetir cria estrago —
   - branch já existe → primeiro verificar associação e autorização em `[branch-spec]` conforme a seção "Branch local no planejamento /spec"; mesma entrega confirmada reutiliza sem recriar. Fora desse caso, perguntar: reusar como está / recriar do zero / abortar. Antes de
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
- "🔗 Step 3: branch base `<branchBase>` (detectada; corrija se for outra)"
- "🧠 Step 4 — exploração + brainstorming + spec (escada ponytail)..."
- "💸 Step 4 — plano de custo/rigor: sugiro `<perfil>` para gastar menos tokens com segurança..."
- "🌿 Step 6 — criando branch `feat/<entrega-slug>`..."
- "🔁 Step 7 — modo Loop: disparando o `dev-loop` (N unidades, M agentes)..."
- "✅ Step 8: validações + testes (rodando, passo mecânico; verificação com dados reais, sistema externo ou custo pede OK)"
- "🚀 Step 10 — push + PR (preciso do seu OK)"

## Branch local no planejamento /spec

Para artefatos versionados no repo, em `/spec` ou pedido de gerar SPEC sem implementar, antecipar a preparação da branch para antes de gravar o arquivo da entrega/SPEC do Step 2. Isso não autoriza implementação, opt-in de execução, commit, push ou PR. Preservar a exceção de `tipos-de-entrega.md` para artefatos fora de Git: registrar destino/versionamento, sem inventar branch ou inicializar repositório.

1. Ler Estado e Log existentes antes de escrever. Inspecionar `git status --short` e a branch atual. Entrega nova exige árvore limpa; não trocar de branch com alterações pendentes. Na retomada, alterações da própria entrega podem permanecer na branch correta; se seria necessário trocar de branch, parar e pedir decisão. Prosseguir sem stash, reset ou pull automáticos.
2. Resolver `branchBase` pelo Step 3, somente por leitura. Um candidato inequívoco é anunciado; múltiplos candidatos ou detecção falha exigem uma pergunta. Não escolher silenciosamente outra base nem criar repositório quando Git não estiver disponível.
3. Propor `branchTrabalho` legível pela `convencao_branch` (default `feat/<entrega-slug>`). Validar com `git check-ref-format --branch`. Apresentar nome e base e obter OK para criar/entrar na branch antes de gravar a SPEC. Uma pergunta por vez; reutilizar autorização da sessão para a mesma ação e entrega.
4. Branch inexistente: criar diretamente a partir da base local conferida, `git switch -c <branchTrabalho> <branchBase>`, sem atualizar ou trocar previamente a branch base. Conferir o resultado com `git branch --show-current`. Falha interrompe a escrita da SPEC; não registrar criação como realizada se o comando falhar.
5. Branch existente: conferir o Log, o path da SPEC e o estado real. Associação inequívoca à mesma entrega permite reutilizar sem recriar, renomear ou repetir autorização já registrada. Se pertencer a outra entrega ou a associação estiver ausente/ambígua, perguntar antes de reutilizar ou escolher outro nome; nunca sobrescrever, deletar ou acrescentar sufixo automaticamente. Se estiver ocupada em outra worktree, informar onde está e pedir decisão, sem forçar a troca.
6. Já na branch correta, gravar SPEC e uma entrada `[branch-spec]` no Log com `branchBase`, `branchTrabalho`, path da SPEC e autorização usada. Registrar aprovação da SPEC no Step 4, mesmo sem Step 5. Manter Estado de planejamento até aprovação. Sem commit automático: arquivos não commitados pertencem à árvore de trabalho, não ficam isolados na branch por si só; informar esse estado ao dono.
7. Ao pedir implementação depois, reaproveitar SPEC aprovada e `[branch-spec]`; completar modo/perfil e contrato do Step 5 sem mudar a associação. Step 6 apenas verifica a branch já preparada. SPEC legada sem branchBase ou branchTrabalho exige resolver os campos ausentes e obter autorização antes de criar/trocar branch; registrar a associação somente após conferir a branch correta, sem refazer planejamento aprovado. Não confundir branchBase (nome da base) com baseRef (SHA completo exigido pelo dev-loop).
