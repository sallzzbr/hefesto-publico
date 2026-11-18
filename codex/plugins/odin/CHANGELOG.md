# Changelog

## 1.1.2

- Dev-loop: limpeza sem mudança de comportamento do harness. Os scripts passam a importar dois módulos comuns em `skills/dev-loop/scripts/`: `crc32.mjs` (a conferência CRC-32, antes copiada em `hashes-testes.mjs` e `mutantes.mjs`) e `copia-descartavel.mjs` (git sem fsmonitor, `dentro`, `relativoSeguro`, pares de opção, escolha do diretório pai e o gitfile que bloqueia o git na cópia, antes duplicados entre `copia-base.mjs` e `mutantes.mjs`). A cópia do CRC em `harness/loop.mjs` fica, porque o script de Workflow não importa módulos, e um teste compara as duas. No harness, o caminho da SPEC e os alvos do contrato deixam de ser recalculados, a composição do agente revisor vem de uma função só e saem as guardas de forma do inventário que `inventarioUtilizavel` já tornava inalcançáveis. `inspecionar-git.mjs quality` lê `core.ignoreCase` uma vez. Duas diferenças visíveis, aprovadas pelo dono: os erros do `--pai` de `mutantes.mjs` usam o texto de `copia-base.mjs` (com a origem e a dica de ambiente), e `copia-base.mjs` aceita saída do git até 256 MB, como `mutantes.mjs` (antes falhava acima de 16 MB). Sem arg, motivo, natureza ou dependência novos.

## 1.1.1

- Dev-loop: nota do agente no inventário deixa de virar `erro` genérico. Entrada de `qualityInventory.uninspected` que não é caminho, ou mensagem de `errors` que não começa por `<caminho>: ` de um caminho de `uninspected` (fora da recusa global), passa a disparar a recoleta única da 3.0.4, na validação e nas medições `spec:inventario` e `tdd:inventario`, com a entrada recusada no prompt; na segunda falha o desfecho é `erro` com `campo`, `chamada`, `recoleta` e `acao` de run novo. O pedido da validação deixa de mandar reconciliar `uninspected`: manda copiar as duas listas como o script as emite e diz que checks `review` são do auditor e não entram em `qualityInventory` nem em `qualityExecutions`. Caso real: run `wf_a8f187f3-e1d`, Validar i2. Sem arg, motivo, natureza ou dependência novos.

## 1.1.0

- Dev-loop: fase Mutar. Nos perfis balanceado e máximo, quando a iteração fecharia verde, o harness pede ao mecânico um único comando de `mutantes.mjs medir` (script novo, só `node:`): gera até 20 mutantes determinísticos só nas linhas acrescentadas contra a base (cota por arquivo em rodízio e, dentro dele, um por linha espalhado do começo ao fim), aplica cada um numa cópia descartável da worktree, roda os comandos dos testes da SPEC e dos reforços aceitos e restaura. Sobrevivente confirmado como real vira bloqueante de natureza `mutacao` com path:linha, a troca e o pedido de caso novo em arquivo de reforço (`reforcos[]` no retorno do operário; nunca o teste da SPEC nem o apoio); o reforço só é aceito quando o mesmo mutante morre na medição seguinte pelo comando do próprio reforço (`mortoPor`) e depois é protegido por hash; até lá o sobrevivente real fica pendente, identificado pela troca e não pelo id, vai em `--prioridade` na medição seguinte e, se não reaparecer ou a medição não valer, continua bloqueando até o teto. O script limpa a cópia e o comando em andamento quando é interrompido por sinal, ignora link simbólico e binário nas linhas acrescentadas e nunca cria vínculo através de link da cópia. Equivalente fica em `mutacao.equivalentes` com o porquê; sobrevivente real no fim do teto termina `escalado`. Ambiente, controle que falha, zero candidato e evidência ruim viram `mutacao.status: "nao-medida"` com a causa, nunca "100% morto". Perfil econômico não mede.
- Dev-loop: o relatório de `verde` e `escalado` traz `paraConferir` (até três linhas, em prioridade fixa, com o comando de `inspecionar-git.mjs diff` do arquivo de produção que mais cresceu) e `numeros` (testes, mutantes mortos, amostrados e candidatos, iterações). Critérios da SPEC passam a ser escritos como Dado/Quando/Então no template e nas instruções de `entregar` e do arquiteto; SPEC antiga continua aceita.

## 1.0.4

- Dev-loop: evidência de agente com falha de formato deixa de matar o run. O harness pede o campo de novo uma vez, em chamada própria `recoleta:<campo>:<iteração>` com o que falhou no prompt, para `qualityReview` (revisor), `qualityExecutions`, `qualityInventory` e `execucoes` (operário), e só então decide. Segunda falha de `qualityReview`, `qualityExecutions` ou `qualityInventory` vira `erro` nomeando `campo`, `chamada`, `recoleta`, `detalhe` e `acao`; segunda falha de `execucoes` continua bloqueante `portao-tdd` de natureza `evidencia`. A recoleta passa pela mesma validação da resposta original e nunca dispensa a prova. O que antes só aparecia na validação passa a ser medido cedo: `spec:inventario` na fase Spec e `tdd:inventario` logo depois do portão TDD bloqueiam por filtro ou flag do git e por arquivo de texto acima de 400 linhas sem decisão em `decomposition`, antes do trabalho caro; na validação, arquivo de produção acima de 400 linhas volta como correção (origem `inventario-quality`, natureza `qualidade`). Teste ou apoio da SPEC removido e citado num check `required` volta como `testes-intactos` ou `apoio-intacto` em vez de `erro`. Sem arg novo, motivo novo, natureza nova ou dependência nova.
- Dev-loop, correções da revisão da 3.0.4: a ação da recusa por filtro manda achar o nome com `git check-attr filter` e desligar os dois drivers (`clean` e `process`, como no Git LFS); o caminho da flag `skip-worktree` ou `assume-unchanged` na ação fica inteiro mesmo com `:` ou `;`; na fase Spec, inventário só com erros por caminho pedido é recolhido em vez de aceito como recusa global; `fallbacks[].de` registra o tier da chamada que errou também na segunda recoleta da mesma validação; o bloqueante de tamanho acompanha a correção de alvo ausente; as docs deixam de prometer bloqueio por `smudge`, dizem que a segunda falha de `execucoes` é o bloqueante de evidência e devolvem as regras de decomposição ao título delas.

## 1.0.3

- Dev-loop: evidência de agente com deslize de formato ou de declaração volta como correção ou bloqueio nomeado em vez de `erro` terminal. O apoio do portão TDD passa a ser protegido por hash como os testes: apoio alterado depois do portão vira bloqueante automático (origem `apoio-intacto`, natureza `integridade-do-apoio`), e apoio com barra final, `ausente` ou `nao-regular` bloqueia o portão nomeando o caminho. `hashes-testes.mjs` devolve as sentinelas `ausente` e `nao-regular` pela linha de comando. Alvo `required` do contrato de qualidade ausente ou ignorado volta como correção (origem `inventario-quality`, natureza `funcional`). Com `core.ignoreCase=true`, `inspecionar-git.mjs quality` devolve `aliases` e o harness usa o nome canônico do git. `arquivosTocados` com barra invertida, sufixo de linha e coluna ou alias de raiz do macOS é normalizado; path de teste com sufixo `::caso` ou `:linha:coluna` é limpo; a regra P10 aceita `onde` com intervalo de linhas, crases, parênteses, vírgula ou dois-pontos; o veredito do sinal da auditoria exige `porque`; a auditoria reporta `linhasRemovidasAcumuladas` e entrega que só remove código não é auditoria cega. Sem arg novo, motivo novo ou dependência nova.

## 1.0.2

- Dev-loop: todo caminho relatado por agente vira relativo à raiz do workspace antes de ser usado. `arquivosTocados` absoluto sob a raiz deixava o inventário de qualidade vazio (`inspecionar-git.mjs quality` recusa caminho absoluto) e o run terminava em `erro` na fase Validar, antes de a falha funcional voltar ao operário. Fora da raiz, `arquivosTocados` bloqueia na fase Implementar com `motivo: "arquivos-fora-do-workspace"`, `apoio` fora da raiz bloqueia o portão TDD (antes sumia em silêncio) e a evidência de `qualityReview` é normalizada ou recusada nomeando o caminho. O erro do inventário passa a citar os erros do script e os caminhos omitidos. O pedido ao operário e a definição do agente exigem caminho relativo. Relato de arquivos que não fecha com a worktree (arquivo relatado inexistente ou ignorado, arquivo novo não relatado) volta como correção ao operário, natureza `procedimento`, em vez de `erro` terminal; arquivo não rastreado que reaparece depois da correção bloqueia com `motivo: "artefato-nao-rastreado"` e nenhum agente o apaga.

## 1.0.1

- Portão TDD do dev-loop: o pedido ao operário declara a exigência que a conferência já cobrava (o comando de cada teste cita o caminho relativo do arquivo protegido por hash) e traz exemplos por ecossistema, incluindo unittest por arquivo com -k. O bloqueio por comando sem vínculo passa a ensinar a troca do módulo pontilhado pelo caminho. A conferência não mudou: módulo pontilhado segue recusado, por decisão do dono.

## 1.0.0

- Contrato mínimo de qualidade obrigatório na SPEC: sete regras base e especialidades TypeScript, frontend e backend, com convenções, aplicabilidade e decomposição explícitas.
- Preflight canônico, comandos executados sem cache, inventário seguro e revisão independente por regra. Evidência incompleta falha fechado; issues semânticos passam por confirmação antes de retrabalho.
- Alerta de 400 linhas exige decisão de coesão, sem divisão automática. Ponytail preserva fronteiras/testabilidade e aceita justificativas verificáveis em SPEC/plano/ADR/PR, sem comentário de processo obrigatório.
- Corpus público inteiramente sintético com defeitos e controles. Sua validação de formato não equivale a avaliação comportamental com agentes.
- Mudança incompatível: SPECs antigas precisam preencher o contrato e iniciar run novo. Não reaproveitar um run iniciado com pacote anterior; versão preparada localmente, sem release ou instalação.

## 0.4.3

- Runtime do bridge: `responder` com `.lock` preexistente falha com diagnóstico (caminho do lock, execução interrompida, conferir o pid e remover manualmente) em vez do erro cru, sem remover o lock sozinho. O schema mede `minLength` e `maxLength` em pontos de código, não em unidades UTF-16.

## 0.4.2

- SPEC prepara branch local com nome e base aprovados antes da escrita, registra associação e reaproveita na implementação. Protege alterações pendentes e colisões; não autoriza commit, implementação, push ou PR. Retomada trata SPEC legada sem branch registrada.

## 0.4.1

- Entrada direta em definir preserva escolha de tier e aprovação do slug/título, uma pergunta por vez. Registra descoberta pulada sem marcar conclusão, trata evidências ausentes e mantém o protocolo próprio do expresso. Contratos nas duas distribuições e referência compartilhada alinhados.

## 0.4.0

- Skills nativas desafio e defaults, descriptions alinhadas às 43 frases e exigência de Iris para briefs. Defaults respeitam CODEX_HOME em todo o pacote.

## 0.3.1

- Isola materialização da base sem filtros Git, bloqueia descoberta de repositório, assina bytes reais e protege o reuso da validação.
- Corrige execução direta do bridge em paths com symlink e `--preserve-symlinks-main`.

- Esclarece que teste/comando com escrita de log, cache ou artefato viola somente leitura do revisor, mesmo em arquivo ignorado.

## 0.3.0 (2026-11-02)

- Sincroniza o controlador do odin 2.6.0 (revisão de contratos `2026-11-02-r8`): coluna `Tipo`
  da SPEC com `tipo-divergente`; "não" do operário medido antes de bloquear; `autorizacoesTdd`
  só no perfil `maximo`, com a citação literal em `autorizacao` e erro de Args para chave
  desconhecida; perfil normalizado (`Máximo` vale `maximo`).
- Decisão do dono de 2026-11-03: no Solo, a exceção ao portão passa para o Loop no perfil
  `maximo` (run novo com `autorizacoesTdd` e opt-in de custo registrado no Log), nunca segue no
  Solo, nem com autorrevisão pelas lentes do perfil; sem subagentes fica bloqueada no portão. Vale
  por fase, critério a critério; fases já implementadas no Solo entram no run com `baseRef` +
  `vermelhoNaBase` e a autorização só nos critérios sem vermelho. `entregar`, `dev-loop` e
  `execucao.md` dizem isso.
- Retomada sem reverter: args `baseRef` e `vermelhoNaBase` medem o vermelho numa cópia da base
  (`shared/skills/dev-loop/scripts/copia-base.mjs`), e nesse modo o "não" do operário (testes
  não prontos ou sem cobrir o critério) bloqueia com `nao-confirmado`; `inspecionar-git.mjs alteracoes [base]`
  detecta `implementacao-preexistente` e `diff <paths> [base]` mostra os commits da entrega à
  auditoria e às lentes.
- Arg `pendenciasPath`: `hashes-testes.mjs --impressao '<excluídos do diff>' '<excluídos só dos
  não rastreados>'` deixa de fora a SPEC (`validacaoFinal.excluidos`) e as pendências, só como
  não rastreadas (`validacaoFinal.excluidosNaoRastreados`); pendências rastreadas fazem o script
  recusar a impressão. Cobre o repositório inteiro e o tipo e o bit de execução dos arquivos novos.
- Validação com `natureza`; só ambiente encerra como erro `motivo: "ambiente"`. `semCriacao`,
  `criacoesSemRelato`, `buscaChamadores` e `resumoDaEscalada` passam pelo bridge.
- Relatório com `tdd.execucoes`, `tdd.declaracaoDoOperario` e `tdd.implementacaoPreexistente`.
- Decisão 13 do dono (2026-11-03), sincronizada do controlador: finding de lente leva só os campos
  do schema da revisão, com `origem: "lente"` fixada pelo controlador; validação com `verde: true`
  e falha listada não é verde (`verdeDeclaradoComFalhas` no histórico da iteração; na parada por
  ambiente, no topo do relatório de erro); no `vermelhoNaBase`, a identidade da cópia é conferida
  antes de qualquer bloqueio, e o que não confere é erro TDD: `alteracoes` medido contra a mesma
  `baseRef` (`comparadoCom`), `copiaBase.sha` igual ao sha de `alteracoes` quando ele existe e,
  com `baseRef` só hex, começando por ela, e hashes dos testes da cópia iguais aos da worktree.
  Sem o sha de `alteracoes`, só o prefixo confere, e ele não distingue commits com o mesmo
  prefixo: use o SHA completo do merge-base. Nome de ref só com hex e SHA de tag anotada resolvem
  para outro commit: passe o SHA do commit. Os casos e testes estão no CHANGELOG do odin 2.6.0; o
  replay do modo base passou a usar um sha de cópia coerente com a `baseRef`.
- Decisão 24 do dono (2026-11-03), sincronizada do controlador: `baseRef` só como SHA completo
  (40 ou 64 hex); nome de ref, tag e SHA abreviado são erro na fase Args, antes de qualquer
  pedido de trabalho, com o valor recebido e o comando do SHA. Maiúsculas viram minúsculas. Na
  base, `copiaBase.sha` e o sha de `alteracoes` são iguais à `baseRef`, e a leitura por prefixo da
  linha acima deixa de existir. `execucao.md`, `entregar` e `dev-loop` nativas mandam gravar e
  passar o SHA completo do merge-base. O replay do modo base passou a usar a `baseRef` completa:
  `replay Codex: baseRef que não é SHA completo encerra em Args sem pedir trabalho`.
- Skills nativas: a pergunta encerra o turno e fica `[pendente]` no Log; autorização registrada
  no Log se reaproveita (commit, push, PR e publicação pedem OK na sessão corrente).
- Bridge: diagnostica diretório do run existente (run ou não), pai ausente ou sem escrita; erro de
  gravação preserva código e causa e não deixa diretório órfão; ignora `__pycache__`, `*.pyc` e
  `.DS_Store` no fingerprint, mantendo a recusa de symlink com esses nomes; recusa por fonte
  alterada lista os arquivos novos, removidos e alterados e orienta reinstalar a mesma versão em
  vez de apagar à mão. O pacote odin já levava esse bridge desde o merge da 0.2.0 sem bump; esta
  linha registra a mudança.
- Dependência da `iris`: o manifesto Codex não tem campo de dependência. A skill nativa usa
  `delegar-agente` do pacote iris quando ele está disponível no ambiente.

Casos que a 0.2.0 não pegava (o controlador é a cópia byte-idêntica do Claude; os casos de
controlador estão no CHANGELOG do odin 2.6.0, com o teste de cada um):

- Autorização num run econômico ou balanceado fechava verde com uma ou duas lentes:
  `replay Codex: autorização fora do perfil máximo encerra em Args sem pedir trabalho`.
- Retomada com a implementação na worktree só seguia por rebaseline, sem vermelho medido:
  `replay Codex: retomada com vermelho na base mede na cópia e fecha verde sem continuidade`.
- Unidade que só modificava o existente escalava no teto: escada vazia com arquivos tocados era
  bloqueante, e o schema do operário não tinha como declarar `semCriacao`:
  `replay Codex: semCriacao, criacoesSemRelato e buscaChamadores passam pelo bridge, e a impressão exclui a SPEC`.
- `uv run pytest` com EPERM no cache gastava as três iterações:
  `replay Codex: falha só de ambiente encerra como erro de ambiente, e natureza fora do enum é recusada`.
- Preflight sem `tipos` e execução sem `alteracoes` eram aceitos:
  `replay Codex: o bridge impõe o schema novo do preflight (tipos) e da execução independente (alterações)`.

Guarda nova, não caso da 0.2.0: `consistência: o desfecho bloqueado cita exatamente os motivos que o
portão emite, nas duas distribuições` reprova doc que cite motivo que o controlador não emite. Foi
ela que achou, na integração do próprio porte, a citação de `divergencia-operario` que as docs
portadas traziam.

Compatibilidade: run criado pela 0.2.0 (revisão `2026-11-01-r7`) não retoma com `proximo` depois
de atualizar o pacote; abra `RUN_DIR` novo. SPEC sem coluna `Tipo` é toda de reprodução: controle
em critério próprio bloqueia com `tipo-divergente` até a SPEC aprovada ganhar a coluna com
`preservação`. Um `validacaoFinal` da 0.2.0 não confere com a impressão nova e a suíte roda uma vez.
- Decisão 19A do dono (2026-11-03): o `RUNTIME.md` ganha a seção "Perguntas ao usuário". Não se pergunta o que dá para verificar por leitura ou comando, o trabalho que não depende da resposta vem antes, a pergunta necessária é curta e completa, fecha a mensagem e encerra o turno, e nada continua executando depois dela; regra de pergunta da skill ou do contrato de domínio se soma. As skills nativas e o contrato de conversa do Odin, que já traziam a regra, não mudam. Teste que trava a instrução escrita (não o comportamento): `codex/tests/runtime-pergunta.test.mjs`, que lê o RUNTIME de cada pacote do marketplace Codex.
- Revisão da decisão 19A (2026-11-03): a regra restringe o fim do turno à pergunta direta; pela ferramenta de interação da sessão a resposta volta no mesmo turno, e nada continua executando antes de ela chegar. Sem a ressalva, a seção contradizia a linha do mesmo `RUNTIME.md` que oferece perguntar pela ferramenta de interação ou por pergunta direta, e proibia seguir depois da resposta. Caso novo por pacote em `codex/tests/runtime-pergunta.test.mjs`.

## 0.2.0 — 2026-11-01

- Sincroniza o controlador do odin 2.5.0: portão TDD com testes de reprodução e controles de preservação, comando próprio por teste e execução independente um a um. Suíte mista com reprodução vermelha e controles verdes abre o portão; evidência inválida (import, sintaxe, infraestrutura) e controle vermelho bloqueiam sem exceção; reprodução ou controle vermelho depois da implementação é bloqueante automático.
- Exceção humana (`autorizacoesTdd`) e retomada tardia (`rebaselineTdd`) entram por args de um run novo, sem editar `state.json` nem o controlador; o relatório mantém `vermelhoConfirmado` medido e registra `tdd.continuidade`.
- Reuso de validação longa por impressão da worktree (`hashes-testes.mjs --impressao`) e `validacaoFinal` no relatório verde.
- Confirmação de abstração de uso único busca os chamadores antes de responder.
- Endurecido pela revisão adversarial: comando de teste ligado ao arquivo protegido, único e numa linha; `casos` executados obrigatórios; escopo de ausência de vermelho do contrato; veto do operário só cai com exceção usada; impressão recusa submódulo, repositório aninhado e bits de índice.
- Revisão de contratos `2026-11-01-r7`: run de revisão anterior não é retomado.

## 0.1.5 — 2026-10-04

- Sinal de duplicação/abstração da auditoria em arquivo da lista de testes protegidos vira pendência (`ponytail.pendenciasEmTestesDaSpec`), sem confirmador e sem bloquear: ninguém no loop pode editar esse arquivo. Achado de lente nesses testes continua bloqueando.
- A confirmação de sinal da auditoria responde `real` e `bloqueante` em campos separados e obrigatórios. Real e não bloqueante vira pendência com o veredito registrado; campo ausente bloqueia. Finding de lente mantém a severidade da lente.
- O helper de hashes emite `<sha256>-<conferência>` e o controlador recalcula a conferência. Evidência que não confere é recolhida uma vez em solicitação própria (`tdd:hashes`, `hashes:i<N>`); duas falhas seguidas encerram como erro de evidência. Só a divergência entre duas coletas conferidas é teste alterado.
- Revisão de contratos do controlador: `2026-10-04-r6`. Run de revisão anterior não é retomado.

## 0.1.4 — 2026-09-11

- Auditor e lentes inspecionam Git sem staging; arquivos novos selecionados e stage são apresentados separadamente. A entrega confere todos os paths staged contra o escopo aprovado antes de commit, preservando conteúdo alheio.

## 0.1.3 — 2026-09-09

- Bloqueantes confirmados de duplicação/abstração continuam bloqueando enquanto reaparecem na auditoria. Mudança do cenário exige nova confirmação; refutação e desaparecimento continuam liberando.

## 0.1.2

Distribuição pública inicial no marketplace v3.18.0. Metadados apontam para o repositório público e descrevem o adaptador Codex e a herança de modelo/esforço; pacote autocontido e política nativa de modelos preservados.

## 0.1.1 — 2026-09-08

- Política Codex explícita: herança de modelo/effort, preferência OpenAI por papel e identidade efetiva separada; instruções históricas de modelo não governam esta distribuição.
- Falha operacional encerra o bridge sem fallback legado; respostas e solicitações interrompidas são preservadas para reconciliação. Achados de conteúdo mantêm os gates e tetos.

## 0.1.0 — 2026-09-06

Primeira adaptação Codex. Verificação técnica nesta etapa; avaliação comportamental e publicação seguem o plano do repositório.
