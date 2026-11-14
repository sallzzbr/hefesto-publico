# Changelog — odin

> Histórico anterior à 2.4.6 vive nos commits do repositório privado; o espelho público nasce
> com histórico fresco a cada release, e este arquivo é o que sobrevive à travessia.

## 3.0.2

- Dev-loop: todo caminho relatado por agente vira relativo à raiz do workspace antes de ser usado. `arquivosTocados` absoluto sob a raiz deixava o inventário de qualidade vazio (`inspecionar-git.mjs quality` recusa caminho absoluto) e o run terminava em `erro` na fase Validar, antes de a falha funcional voltar ao operário. Fora da raiz, `arquivosTocados` bloqueia na fase Implementar com `motivo: "arquivos-fora-do-workspace"`, `apoio` fora da raiz bloqueia o portão TDD (antes sumia em silêncio) e a evidência de `qualityReview` é normalizada ou recusada nomeando o caminho. O erro do inventário passa a citar os erros do script e os caminhos omitidos. O pedido ao operário e a definição do agente exigem caminho relativo. Relato de arquivos que não fecha com a worktree (arquivo relatado inexistente ou ignorado, arquivo novo não relatado) volta como correção ao operário, natureza `procedimento`, em vez de `erro` terminal; arquivo não rastreado que reaparece depois da correção bloqueia com `motivo: "artefato-nao-rastreado"` e nenhum agente o apaga.

## 3.0.1

- Portão TDD do dev-loop: o pedido ao operário declara a exigência que a conferência já cobrava (o comando de cada teste cita o caminho relativo do arquivo protegido por hash) e traz exemplos por ecossistema, incluindo unittest por arquivo com -k. O bloqueio por comando sem vínculo passa a ensinar a troca do módulo pontilhado pelo caminho. A conferência não mudou: módulo pontilhado segue recusado, por decisão do dono.

## 3.0.0

- Contrato mínimo de qualidade obrigatório na SPEC: sete regras base e especialidades TypeScript, frontend e backend, com convenções, aplicabilidade e decomposição explícitas.
- Preflight canônico, comandos executados sem cache, inventário seguro e revisão independente por regra. Evidência incompleta falha fechado; issues semânticos passam por confirmação antes de retrabalho.
- Alerta de 400 linhas exige decisão de coesão, sem divisão automática. Ponytail preserva fronteiras/testabilidade e aceita justificativas verificáveis em SPEC/plano/ADR/PR, sem comentário de processo obrigatório.
- Corpus público inteiramente sintético com defeitos e controles. Sua validação de formato não equivale a avaliação comportamental com agentes.
- Mudança incompatível: SPECs antigas precisam preencher o contrato e iniciar run novo. Não reaproveitar um run iniciado com pacote anterior; versão preparada localmente, sem release ou instalação.

## 2.6.3

- SPEC prepara branch local com nome e base aprovados antes da escrita, registra associação e reaproveita na implementação. Protege alterações pendentes e colisões; não autoriza commit, implementação, push ou PR. Retomada trata SPEC legada sem branch registrada.

## 2.6.2

- Entrada direta em definir preserva escolha de tier e aprovação do slug/título, uma pergunta por vez. Registra descoberta pulada sem marcar conclusão, trata evidências ausentes e mantém o protocolo próprio do expresso. Contratos nas duas distribuições e referência compartilhada alinhados.

## 2.6.1

- Isola materialização da base sem filtros Git, bloqueia descoberta de repositório, assina bytes reais e protege o reuso da validação.

- Esclarece que teste/comando com escrita de log, cache ou artefato viola somente leitura do revisor, mesmo em arquivo ignorado.

## 2.6.0 (2026-11-02)

Porte, por cima da 2.5.0, do que a implementação paralela da 2.5 pegava e esta não. Onde as duas
faziam a mesma coisa, ficou a 2.5.0. Revisão de contratos do harness: `2026-11-02-r8`.

- **Tipo do critério vem da SPEC.** Coluna `Tipo` (`reprodução` | `preservação`), lida pelo
  `spec-ids.mjs`; teste que contradiz o Tipo bloqueia com `tipo-divergente` antes de medir.
- **O "não" do operário não dispensa a medição.** Com testes, a execução independente roda antes
  e o motivo é o medido, com `tdd`; `nao-confirmado` só quando nada medido explica o "não". Com
  exceção ou rebaseline, o "não" vale para os critérios fora do escopo coberto.
- **Exceção humana exige perfil `maximo`** (decisão do dono, 2026-11-02): `autorizacoesTdd` com
  qualquer item em outro perfil efetivo é erro na fase Args, antes de qualquer agente. Cada
  autorização exige `autorizacao`, a frase literal do dono. Chave desconhecida em
  `autorizacoesTdd` ou `rebaselineTdd` é erro de Args. `rebaselineTdd` não exige perfil máximo.
- **No Solo, a exceção passa para o Loop no perfil máximo** (decisão do dono, 2026-11-03): sem
  nenhuma reprodução vermelha, a entrega nunca segue no Solo; vai para o `dev-loop` no perfil
  `maximo`, em run novo com `autorizacoesTdd` e opt-in de custo registrado no Log, ou fica
  bloqueada no portão (também sem harness multi-agente, e o fallback sequencial não aplica a
  exceção). Vale por fase, critério a critério; fases já implementadas no Solo entram no run como
  implementação anterior, com `baseRef` + `vermelhoNaBase` e a autorização só nos critérios sem
  vermelho. Regra canônica em `escada-ponytail.md`; `entregar`, `dev-loop` e `spec-template.md`
  remetem a ela.
- **Perfil normalizado**: `Máximo` vale `maximo`; perfil desconhecido é erro de Args.
- **Retomada sem reverter.** Args `baseRef` (SHA do merge-base) e `vermelhoNaBase`: o vermelho é
  medido numa cópia descartável da base (`scripts/copia-base.mjs`); teste que falha na cópia por
  import de módulo que a entrega cria conta como vermelho válido. Nesse modo o prompt define
  `vermelhoConfirmado` só como "testes prontos e cobrindo os critérios", e o "não" do operário
  bloqueia com `nao-confirmado` depois da medição. `inspecionar-git.mjs
  alteracoes [base]` detecta implementação anterior ao portão (`implementacao-preexistente`), e
  `diff <paths> [base]` mostra a auditoria e as lentes contra a base, inclusive commits.
- **Reuso de validação no fluxo documentado.** Arg `pendenciasPath`; `hashes-testes.mjs
  --impressao '<excluídos do diff>' '<excluídos só dos não rastreados>'` deixa de fora a SPEC (do
  diff) e as pendências (só dos não rastreados); as listas entram no hash e voltam em
  `validacaoFinal.excluidos` e `validacaoFinal.excluidosNaoRastreados`. Pendências rastreadas,
  symlink ou diretório fazem o script recusar a impressão, e um `pendenciasPath` que a base já
  tem conta como implementação anterior. A impressão cobre o repositório inteiro com cwd em
  subdiretório e inclui o tipo e o bit de execução dos arquivos novos.
- **Ambiente separado de funcional.** Falha de validação traz `natureza` e `evidencia`; só
  ambiente encerra como erro `motivo: "ambiente"` na fase Validar, sem mexer em código.
- **Escada e revisão.** `semCriacao` para unidade que só modifica; `criacoesSemRelato` na
  auditoria; `resumoDaEscalada` por natureza; `buscaChamadores` e recontagem de afirmação
  mecânica pelas lentes e pelo confirmador.
- **Relatório.** `tdd.execucoes`, `tdd.declaracaoDoOperario`, `tdd.implementacaoPreexistente`,
  `tdd.modo`/`baseRef`/`copia` e `modelos.nota` (modelo pedido, não observado); `tdd` também no
  erro de hashes da base.
- **Conversa e entregar.** Pergunta encerra a vez e fica `[pendente]` no Log; autorização
  registrada se reaproveita (nunca para commit, push, PR ou publicação); Step 3 usa a branch
  detectada; Step 8 é mecânico e reaproveita a validação do loop pela impressão.
- **Depende da `iris`.** O `plugin.json` declara `"dependencies": ["iris"]`: o planner monta o
  brief do arquiteto com `iris:delegar-agente`. Instalar `odin@hefesto` instala também
  `iris@hefesto`, e desativar a `iris` desativa o odin na próxima carga de plugins.

Casos que a 2.5.0 do master não pegava:

- Controle verde num critério que a SPEC aprova como mudança abria o portão e fechava verde:
  `pt1: controle verde num critério que a SPEC diz ser de reprodução bloqueia como tipo divergente, antes de medir`.
- `tests/a.test.js` e `./tests/a.test.js` contavam como comandos distintos, e um exit decidia dois
  testes: `pt3: variante trivial do mesmo comando (./ ou espaços) conta como comando repetido, antes de medir`.
- O "não" do operário com testes escritos saía sem medir, sem relatório e com quatro hipóteses:
  `pt4: operário diz não e a medição acha reprodução verde: o motivo é o medido, com relatório`.
- Exceção sobre C2 desligava o "não" do operário sobre C1:
  `re5: exceção ou rebaseline que cobre C2 não desliga o "não" do operário sobre C1`.
- Autorização num run econômico ou balanceado fechava verde com uma ou duas lentes:
  `re1: autorização em perfil econômico ou balanceado é erro de args antes de qualquer agente`.
- Autorização sem a fala do dono e chave com typo passavam caladas (typo em `validacaoAnterior`
  repetia a suíte): `C1f: autorização malformada é erro de args antes de qualquer agente` e
  `ar3: chave desconhecida no rebaseline ou na validação anterior é erro de args, nomeando o campo`.
- `perfil: "Máximo"` rodava o econômico e `"constructor"` lançava TypeError na revisão:
  `ar1: perfil com acento ou caixa é normalizado e roda as três lentes do máximo`.
- Reprodução verde com `src/a.js` já alterado saía como critério atendido, e a ação levava a
  reverter: `re7: reprodução verde com arquivo de produção alterado antes do portão é implementação preexistente, sem reverter`.
- Retomada com rebaseline e teste que não exercita o critério passava sem vermelho em lugar
  nenhum: `re9: retomada com vermelho na base mede numa cópia, fecha verde sem continuidade e sem pedir reversão`
  e `re9: reprodução verde na base não é coberta por rebaseline: lá a implementação não existe`.
- `baseRef: "--upload-pack=x"`, `"a..b"` ou `42` eram aceitos e ignorados:
  `re12: baseRef malformada é erro de args antes de qualquer agente`.
- Checkpoint do Solo commitado e depois Loop: a revisão não via o commit:
  `re13: Git real: com baseRef, a receita da revisão mostra a implementação já commitada que contra HEAD some`
  e `diff com base mostra implementação já commitada que o diff contra HEAD esconde`.
- Gravar o Log na SPEC ou criar as pendências mudava a impressão e o reuso nunca conferia:
  `vr5: Git real: gravar o Log na SPEC e as pendências entre os runs não impede o reuso; mudar código ou trocar a lista impede`.
- Com cwd em `apps/web`, um `libs/nova.js` novo deixava a impressão igual:
  `cwd num subdiretório (monorepo): mudança fora dele muda a impressão, e o excluído é relativo ao cwd`.
- `chmod +x` num arquivo novo, ou symlink novo com os bytes de um arquivo, não mudava a impressão:
  `bit de execução de arquivo novo muda a impressão, e voltar o modo restaura` e
  `symlink novo: troca de alvo muda, link quebrado tem impressão, e link não colide com arquivo de mesmos bytes`.
- `uv run pytest` com EPERM no cache gastava as três iterações devolvendo "Permission denied" como
  correção: `vr2: falha só de ambiente com os testes da SPEC verdes encerra na iteração 1, sem devolver correção nem revisar`.
- Unidade que só corrigia um README escalava no teto por "relato de escada ausente":
  `er1: unidade que só modifica o existente declara semCriacao e fecha verde, com o rastro na escada`.
- O escalado não dizia que só faltava relato com a validação verde:
  `er3: escalada com validação verde e só relato de escada pendente diz isso no resumo, sem virar verde`.
- "Uso único" afirmado sem contar chamadores:
  `er6: a auditoria busca os chamadores antes de afirmar uso único, e o confirmador recebe a busca como alegação`.
- O erro de hashes da base perdia o portão medido:
  `pt6: base de hashes que não confere nem na recoleta sai com o relatório do que foi medido`.
- O relatório apresentava o modelo pedido como efetivo:
  `ar5: a nota de modelo pedido acompanha também o desfecho de erro`.
- Pergunta feita no meio da mensagem e o agente seguia executando (o teste trava a instrução nas
  docs, não o comportamento do agente):
  `contrato de conversa: a pergunta encerra a vez e fica registrada como [pendente] antes de ser feita`.
- O Step 8 repetia a suíte longa que o loop acabara de rodar na mesma árvore (o teste trava a
  instrução; a impressão que permite o reuso tem os casos `vr5` contra Git real):
  `Step 8 reaproveita a validação verde do loop pela impressão com a mesma exclusão`.
- HOME efêmero fazia a entregar perguntar e gravar os defaults a cada sessão (o teste trava a
  instrução nas docs):
  `nenhuma doc do odin manda perguntar só porque o arquivo de defaults falta`.
- Um fsmonitor que perde evento escondia arquivo rastreado alterado da impressão, e a suíte longa
  seria reaproveitada sobre código mudado (já valia no master; o script agora fixa
  `core.fsmonitor=false`, como os outros dois):
  `fsmonitor que perde evento não esconde arquivo rastreado alterado da impressão`.
- Doc que cita arg, motivo ou modo de script que o código não tem (ou omite um que ele aceita):
  os casos `consistência: ...` de `tests/consistencia-args-docs.test.mjs`.
- Finding de lente com `origem: "auditoria-ponytail"` forjado ganhava a pergunta de severidade, e
  "real, não bloqueante" virava pendência em vez de retrabalho; com `sinal: "P11"` forjado, o
  prompt do confirmador recebia as instruções de uso único. O controlador copia só os campos do
  schema da revisão e fixa `origem: "lente"` (decisão 13 do dono, 2026-11-03):
  `d13: finding de lente com origem da auditoria forjado continua bloqueante e o confirmador não recebe a pergunta da auditoria`
  (e a variante `origem e sinal P11 com busca`) e
  `d13: controle: na mesma iteração o sinal plausível da auditoria ganha a pergunta de severidade e o forjado da lente não`.
- Validação com `verde: true` e falha listada fechava o run verde. Agora é não verde, segue o
  fluxo de falha (inclusive a parada por ambiente) e grava `verdeDeclaradoComFalhas` no
  histórico da iteração; na parada por ambiente, que sai antes de a iteração entrar no
  histórico, a marca fica no topo do relatório de erro (decisão 13):
  `d13: validação com verde=true e falha funcional listada não fecha verde: escala no teto com validacaoVerde false`
  e `d13: verde=true com todas as falhas de ambiente cai na saída por ambiente, como verde=false`.

Correção do porte (decisão 13, furo 1; o master não tinha `buscaChamadores` nem o prompt do
sinal `P1-P7`): `buscaChamadores` e `sinal: "P1-P7"` trazidos pela lente montavam o prompt do
confirmador. Com a cópia por lista, eles ficam fora do finding de lente:
`d13: finding de lente com origem e sinal P11 com busca forjado continua bloqueante e o confirmador não recebe a pergunta da auditoria`
e `d13: finding de lente com sinal P1-P7 sem origem forjado continua bloqueante e o confirmador não recebe a pergunta da auditoria`.

Correção do porte (decisão 13, furo 3; o master não tinha modo base): no `vermelhoNaBase`,
`copiaBase.sha` era exigido pelo schema e não era comparado com nada, e uma cópia de outro commit
valia como vermelho na base. A identidade da cópia agora é conferida antes de qualquer bloqueio,
e o que não confere é erro na fase TDD: `alteracoes` precisa ter medido a mesma base
(`comparadoCom` igual à `baseRef`); o sha da cópia é comparado com o sha de `alteracoes`, quando
ele existe, e, com `baseRef` só hex (lida como SHA), precisa começar por ela; e os hashes dos
testes que a cópia executou são conferidos nesse mesmo ponto, não mais depois dos bloqueios, onde
uma cópia com outros bytes e a reprodução verde saía `sem-vermelho` pelo motivo errado. Sem o sha
de `alteracoes` a única conferência é o prefixo, que não distingue commits com o mesmo prefixo; e
com `baseRef` nome de ref não há conferência (erro). A `baseRef` recomendada é o SHA completo do
merge-base. Nome de ref só com hex (tag de data) e SHA de tag anotada o git resolve para outro
commit: o run para, e o detalhe diz que a `baseRef` foi lida como SHA e dá o comando do SHA do
commit (`git rev-parse --verify '<ref>^{commit}'`):
`d13: na base, copiaBase.sha diferente do sha que alteracoes mediu para a mesma base é erro TDD, antes de qualquer diagnóstico`,
`d13: na base, baseRef SHA hex que não é prefixo do SHA da cópia é erro TDD, mesmo com alteracoes concordando`,
`d13: na base, alteracoes que mediu outra ref (comparadoCom diferente da baseRef) é erro TDD, mesmo com os shas concordando`,
`d13: na base, baseRef só com hex que o git resolve como ref ou tag anotada para com o diagnóstico de leitura como SHA`,
`d13: na base, cópia com o sha certo que executou outros bytes de teste é erro TDD antes de qualquer bloqueio`
e `d13: na base, sem como conferir o SHA da cópia (alteracoes sem sha ou com erro e baseRef que não é hex) ou SHA malformado é erro TDD`.

Decisão 24 do dono (2026-11-03): "Exigir SHA completo na baseRef. Fora disso, erro de argumentos
antes de qualquer agente." Substitui a leitura por prefixo e a de ref só com hex do parágrafo
acima: a `baseRef` era qualquer ref, e uma tag de data como `20261103` virava SHA abreviado e
parava o run por engano; SHA abreviado sem o sha de `alteracoes` não distinguia commits com o
mesmo prefixo. Agora a `baseRef`, quando presente, é o SHA completo (40 ou 64 hex) e qualquer
outra forma é erro na fase Args, antes de qualquer agente, com o valor recebido no detalhe e, na
ação, `git merge-base <branchBase> HEAD`, `git rev-parse --verify '<ref>^{commit}'` e o run novo.
Maiúsculas são normalizadas para minúsculas, que vão aos comandos e ao relatório. Na base,
`copiaBase.sha` e o sha de `alteracoes`, quando vem, são iguais à `baseRef`, sem diferença de
caixa, e `comparadoCom` continua tendo que ser ela; SHA de tag anotada, que o git descasca até o
commit, para com o comando do SHA do commit. As docs das duas distribuições mandam gravar e passar
o SHA completo do merge-base. Os casos d13 de prefixo, de ref só com hex e de "sem como conferir"
viraram
`d24: baseRef que não é SHA completo é erro de Args antes de qualquer agente, com o valor recebido e como obter o SHA`,
`d24: baseRef SHA completo de 40 ou 64 caracteres passa, e maiúsculas valem em minúsculas nos comandos e no relatório`,
`d24: na base, copiaBase.sha diferente da baseRef completa é erro TDD, mesmo com alteracoes concordando com a cópia`,
`d24: na base, alteracoes com sha diferente da baseRef completa é erro TDD, mesmo com a cópia igual a ela`,
`d24: na base, baseRef que é SHA de tag anotada (o git resolve para o commit) é erro TDD com o comando do SHA do commit`,
`d24: na base, sem o sha de alteracoes, a cópia de outro commit com o mesmo prefixo é erro TDD, e SHA da cópia malformado também`,
`d24: controle: na base, cópia e alteracoes iguais à baseRef completa fecham verde como hoje`
e, nas docs, `d24: baseRef é o SHA completo do merge-base nas duas distribuições, e outra forma é erro de Args`.
Revisão da decisão 24: o README também cita `baseRef` e agora diz que é o SHA completo de
`git merge-base <branchBase> HEAD` e que outra forma é erro de Args. A lista fechada de docs do
caso acima deixava o README de fora; a varredura
`d24: toda doc do odin que cita baseRef diz que é o SHA completo, e o README diz como obtê-lo`
lê toda doc `.md` das duas distribuições do odin que cita `baseRef` (o CHANGELOG fica de fora).

Compatibilidade:

- Run da revisão `2026-11-01-r7` não retoma com `resumeFromRunId`: os schemas do preflight
  (`tipos`), do portão (`apoio`), da execução independente (`alteracoes`), da validação
  (`natureza`), do operário (`semCriacao`) e da auditoria (`criacoesSemRelato`,
  `buscaChamadores`) mudaram. Abra run novo.
- SPEC sem coluna `Tipo` passa a ser toda de reprodução. Controle de preservação em critério
  próprio (o caso das 4 regressões e 6 controles) bloqueia com `tipo-divergente` até a SPEC
  aprovada ganhar a coluna `Tipo` com `preservação` nesses critérios (entregar, Step 4c).
- Autorização da 2.5.0 sem `autorizacao` não vale: pergunte uma vez ao dono e registre a frase
  literal no Log; não a reconstrua.
- A impressão muda de valor (tipo dos arquivos novos, repositório inteiro, lista de excluídos):
  um `validacaoFinal` da 2.5.0 não confere e a suíte roda uma vez, que é a falha segura.
- O "não" do operário com testes escritos bloqueia depois da execução independente, e não antes
  dela, como decidia a 2.5.0: quem lia `nao-confirmado` como "nada foi medido" lê agora
  `tdd.execucoes`.

## 2.5.0 — 2026-11-01 (portão TDD com reprodução e preservação, exceção humana e retomada tardia)

Dois casos reais. Num, 4 regressões vermelhas e 6 controles verdes travaram no portão, que exigia
que todo teste novo falhasse. No outro, a retomada reabriu o portão com a implementação já na
worktree; os testes verdes bloquearam e o fluxo pediu reversão.

- **Portão classificado.** Cada teste da SPEC declara `tipo` (`reproducao` ou `preservacao`),
  comando próprio e motivo; verificações complementares têm lista própria e não contam como
  teste. A execução independente roda um teste por vez (`execucoes[]` com exit e tipo de falha)
  e o controlador decide: reprodução vermelha por asserção abre o portão ao lado de controles
  verdes; erro de import, sintaxe ou infraestrutura, ou resultado incoerente, é evidência
  inválida (`bloqueado`, não mais `erro`); controle vermelho antes da implementação bloqueia;
  reprodução que nasce verde e suíte só com controles bloqueiam. Execução faltando ou repetida é
  erro de evidência.
- **Depois da implementação**, reprodução ainda vermelha e controle que ficou vermelho são
  bloqueantes automáticos nomeados; `verde` declarado sem uma execução por teste não fecha.
- **Exceção humana** (`autorizacoesTdd`): escopo (critérios), evidência, autor e data, por args
  de um run novo. Cobre só ausência de vermelho; nunca evidência inválida nem controle vermelho.
  O relatório mantém `vermelhoConfirmado` medido e as violações originais e registra
  `tdd.continuidade`. Sem autorização registrada, nada é presumido; autorização malformada é erro
  de args antes de qualquer agente.
- **Retomada tardia** (`rebaselineTdd`): reprodução já verde em critério aprovado vira
  implementação anterior declarada, com worktree preservada e base de hashes recoletada. Com
  `validacaoAnterior` (o novo `validacaoFinal` do relatório verde), a impressão da worktree
  medida por `hashes-testes.mjs --impressao` decide se as validações longas rodam de novo; os
  testes da SPEC rodam sempre.
- **Confirmação de uso único (P11)** manda buscar os chamadores no repositório e citar a busca
  antes de responder: uma revisão tinha afirmado uso único com dois chamadores.
- **Endurecido pela revisão adversarial** (três lentes, seis bloqueantes confirmados): o comando
  de cada teste precisa citar o arquivo que recebe hash, ser único e caber numa linha sem crase;
  cada execução informa `casos`, e sair 0 sem executar caso não é verde; sem nenhum vermelho
  válido na suíte, todo critério com teste precisa de cobertura (o rebaseline cobre critérios
  aprovados, inclusive controle verde); autorização ou rebaseline que não cobre nada não desliga
  o veto do operário (`nao-confirmado`); a validação usa a mesma leitura e coerência do portão; a
  impressão recusa submódulo, repositório aninhado e bits `assume-unchanged`/`skip-worktree`;
  `validacaoFinal` com impressão nula é aceito sem reuso e sai também no desfecho manual.
- Revisão de contratos `2026-11-01-r7`. Casos novos em `tests/harness-dev-loop.test.mjs`,
  `tests/impressao-worktree.test.mjs` e `tests/portao-tdd-docs.test.mjs`.

> **Compatibilidade:** o schema do portão, da execução independente e da validação mudou. Use run
> novo; não retome com `resumeFromRunId` um run da revisão `2026-10-04-r6`.

## 2.4.12 — 2026-10-04 (achado que ninguém pode consertar e hash copiado errado)

Duas rodadas reais do dev-loop (perfil máximo, harness 2.4.9) terminaram escaladas sem defeito
de comportamento em aberto. Dois defeitos eram do harness.

- **Teste da SPEC é congelado, então sinal da auditoria nele vira pendência.** Sinal P2/P11 da
  auditoria ponytail localizado num arquivo da lista de testes da SPEC vai para
  `ponytail.pendenciasEmTestesDaSpec`, sem confirmador e sem bloquear. Antes virava bloqueante
  que nenhum operário podia corrigir (o hash do teste é comparado a cada iteração), e desde a
  2.4.10 persistia até o teto. A decisão é do script, pelo arquivo; path sem identidade segura
  segue o fluxo normal. Achado de lente em teste da SPEC continua bloqueando.
- **O confirmador julga fato e severidade do sinal da auditoria em campos separados.** O
  veredito só tinha `real`; a severidade desses sinais é uma constante do script, que nenhum
  revisor classificou. Nas duas rodadas, os 27 sinais confirmados traziam "não bloqueante" no
  texto e bloquearam mesmo assim. Agora `real` e `bloqueante` são obrigatórios nesse veredito:
  real e bloqueante vira retrabalho, real e não bloqueante vira pendência com o veredito
  registrado. Campo ausente bloqueia. Finding de lente mantém a severidade da lente; o schema
  da confirmação dele não oferece o campo.
- **Hash de teste com conferência de transporte.** `hashes-testes.mjs` emite
  `<sha256>-<conferência>` (CRC-32 de `path\nsha`) e o controlador recalcula a conferência em JS
  puro, sem filesystem. Uma troca de dois caracteres na cópia feita pelo agente tinha virado
  "teste alterado" num arquivo que nunca mudou; a mesma troca na base do portão TDD faria toda
  validação correta divergir até o teto.
- **Recoleta única da evidência que não confere**, na base (`tdd:hashes`) e em cada validação
  (`hashes:i<N>`), no operário e registrada em `fallbacks`. Duas falhas seguidas encerram como
  `erro` de evidência. Divergência entre duas coletas conferidas continua bloqueante
  automático, sem confirmação e sem recoleta.
- Revisão de contratos `2026-10-04-r6`. A string não mudou entre a 2.4.9 e a 2.4.11, apesar de
  o harness ter mudado: o log de um run dessas versões não as distingue.
- 16 casos novos em `tests/harness-dev-loop.test.mjs` e `tests/hashes-testes.test.mjs`. O
  script real e o controlador rodam juntos num path com acento e símbolo fora do Latin-1, para
  travar as duas cópias do CRC uma contra a outra.

> **Compatibilidade:** o formato dos valores de `hashesDosTestes` e o schema do veredito de
> sinal da auditoria mudaram. Use run novo; não retome com `resumeFromRunId` um run de revisão
> anterior. Nenhum arg da skill mudou.

## 2.4.11 — 2026-09-11

- Auditor e lentes inspecionam Git sem staging; arquivos novos selecionados e stage são apresentados separadamente. A entrega confere todos os paths staged contra o escopo aprovado antes de commit, preservando conteúdo alheio.

## 2.4.10 — 2026-09-09

- Bloqueantes confirmados de duplicação/abstração continuam bloqueando enquanto reaparecem na auditoria. Mudança do cenário exige nova confirmação; refutação e desaparecimento continuam liberando.

## 2.4.9 — 2026-09-05 (correções do teste Claude)

- Hashes dos testes calculados com Node/crypto pelo helper `hashes-testes.mjs`. O Workflow recebe o JSON pelo operário e normaliza identidades, sem confundir caminho absoluto/relativo e anotações de linha com mudança de conteúdo. Hash ausente/inválido ou conflitante encerra como erro de evidência.
- Preflight `spec-ids.mjs` verifica a tabela original antes do agente de julgamento. IDs vazios/duplicados bloqueiam; extração posterior precisa preservar os mesmos IDs. O schema do TDD restringe referências aos IDs conhecidos.
- O preflight preserva a coluna de verificação complementar: evita converter path de teste em pendência manual ou omitir exigência humana explícita.
- Invocação local usa `scriptPath` absoluto e passa `workspaceRoot` físico e `scriptsDir`. Revisão `2026-09-05-r5` identificada no log; não retomar runs de revisão anterior.
- Regressões executam helpers reais e comandos transportados, incluindo caminhos com espaços/aspas e symlink externo. Mantido o bloqueio de alteração real de teste.

## 2.4.8 — 2026-09-05 (preparação para teste Claude)

- Portão TDD verifica cobertura de critérios, referências de testes e motivo do RED independente. Critérios manuais pendentes não fecham o run como verde.
- `name` explícito em todas as skills, alinhado ao diretório.

## 2.4.7 — 2026-09-02 (evals com runner de formato)

Pendência da auditoria de 2026-09-01: os 43 casos de `evals/roteamento/` não eram lidos por
nada (`claude plugin eval` segue em early access).

- `tests/evals-formato.test.mjs`: cada frase da matriz tem exatamente um caso, cada
  `criteria.md` cita a frase certa e tem `## Esperado`/`## Score`, e os banners esperados
  existem literalmente nos SKILL.md. Não julga roteamento — trava a estrutura.
- `evals/README.md`: o prompt é "derivado" da frase golden, não "verbatim" (4 casos
  concretizam o placeholder X). Matriz: nota de auditoria de 2026-09-02 (descriptions
  inalteradas desde a v2.2.0, verificado por diff).

## 2.4.6 — 2026-09-02 (o portão TDD vira verificação, não declaração)

Correções da auditoria adversarial de 2026-09-01 (Claude + duas passadas do Codex). A skill
dizia que "portão TDD vermelho" e "implementador não edita teste" eram invariantes no script;
no script só havia a palavra do operário e uma frase no prompt.

- **Vermelho verificado**: depois do portão TDD, o mecânico (haiku) roda SÓ os testes da SPEC
  e reporta o exit (`tdd:vermelho`). Exit 0 = `bloqueado` na fase TDD, antes de qualquer
  implementação. Devolve também o SHA-256 de cada teste.
- **Testes intactos em código**: a validação de cada iteração devolve os hashes de novo
  (`hashesDosTestes`, required no schema); hash diferente ou ausente é bloqueante automático,
  sem confirmação, com origem `testes-intactos`.
- **Teto de concorrência**: `PARALELO_MAX = 4` operários simultâneos nos perfis paralelos
  (antes, `parallel()` despachava todas as unidades de uma vez).
- **Relatório de modelo efetivo por execução** (`registrarExec`), portado do hermes 1.0.1:
  fallback tardio não re-rotula step que já rodou no tier certo; step que não rodou reporta o
  configurado.
- **Teste comportamental do harness** (`tests/harness-dev-loop.test.mjs`): o `loop.mjs` roda
  de verdade com `agent`/`parallel`/`phase`/`log` falsos; 10 casos cobrem args inválidos,
  spec bloqueada, TDD sem vermelho, vermelho não confirmado, teste alterado, auditoria nula,
  P10 barrada até o teto, caminho verde, fallback fable→opus e o teto de concorrência.
- Plano de custo da skill `dev-loop`: piso passa a `3 + iterações × (unidades + lentes + 2)`.

> **Compatibilidade:** o schema da validação ganhou o campo required `hashesDosTestes`. Quem
> reinvoca com `resumeFromRunId` um run anterior à 2.4.6 tem a validação re-executada com o
> prompt novo; nenhum arg da skill mudou.
