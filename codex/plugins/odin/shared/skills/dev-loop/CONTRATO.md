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

**References (carregar sob demanda):** `references/quality-contract.md` (piso obrigatório do
planejamento à execução e auditoria; carregar perfis adjacentes selecionados na SPEC) · `references/spec-template.md` (formato canônico da SPEC
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
pra desenhar/decompor a SPEC e **você consolida** o retorno no template (monte o brief do `odin:arquiteto` com `iris:delegar-agente`, que ajusta o texto ao modelo de destino); se a chamada promovida
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
6. **Nada antes do vermelho** — testes de **reprodução** falhando pelo motivo certo abrem o
   loop, ao lado de **controles de preservação** que já passam (portão classificado, 2.5.0; o
   tipo vem da coluna `Tipo` da SPEC, nunca do agente, desde a 2.6.0); o
   implementador não edita o teste que precisa passar. Os dois são verificados em código: o
   mecânico roda CADA teste da SPEC pelo próprio comando, de forma independente, e executa o
   script Node de hashes; a validação de cada iteração repete as duas coisas, e teste alterado,
   reprodução ainda vermelha ou controle que ficou vermelho é bloqueante automático, sem
   confirmação. Cada hash viaja com uma conferência que o controlador recalcula (desde a
   2.4.12): cópia errada do agente é erro de transporte, recolhido uma vez, e nunca conta como
   teste alterado.
7. **Operário executa, arquiteto pensa** — Sonnet implementa; decisão de arquitetura vira
   consulta ao arquiteto (**Fable quando disponível, senão Opus**), com teto de 2 por unidade
   por iteração; consulta que revela furo na spec escala pro humano. Nunca 2 arquitetos em
   paralelo — o script tem **fila em código**: com operários paralelos, duas unidades bloqueadas
   ao mesmo tempo esperam a vez em vez de decidir arquitetura concorrentemente.

> "Arquiteto" aqui é papel de modelo dentro do loop; decisão de comportamento/spec sobe sempre
> pro **arquiteto humano**.

## Contrato de qualidade em todos os perfis

Carregue `references/quality-contract.md` antes de formalizar a SPEC e antes de implementar.
Convenções com fonte, perfis por área e decisões de decomposição orientam o trabalho desde o
planejamento. Preflight usa `spec-ids.mjs <spec> --quality`; contrato ausente ou inválido
bloqueia antes do TDD. Operários, correções e lentes recebem o contrato aprovado e recorte da
unidade, sem reabrir decisões por gosto. Arquivo tocado >400 linhas exige `decomposition`;
recorte por responsabilidade, sem divisão cega nem refatoração geral.

A validação independente retorna `qualityExecutions` dos comandos aprovados e
`qualityInventory` literal do helper `inspecionar-git.mjs quality <paths-json> [base [pendenciasPath]]`, reconciliado com os
arquivos tocados/novos, testes protegidos, apoio TDD e SPEC já autorizados. Extras exigem
reconciliação de escopo, sem incluir notas privadas automaticamente. Quando todo problema do
inventário vem do relato do operário (arquivo em `arquivosTocados` que não existe ou é ignorado,
ou arquivo novo não relatado), o harness devolve correção ao operário (natureza `procedimento`)
em vez de `erro`, dentro do teto de iterações. O argumento final é
um único arquivo de pendências resolvido; sem base explícita, passe `HEAD`. O harness só o
injeta fora de alvos, arquivos tocados/declarados, testes, apoio, SPEC e área de unidade.
O helper dispensa somente arquivo regular não rastreado ou ausente. Pendência exata regular
em HEAD ou índice segue o inventário normal, inclusive mudanças e remoções; recusa entrada
somente na base, diretório, symlink ou fuga. Flags `skip-worktree` ou `assume-unchanged` em alvos ou pendências recusam a inspeção.
Arquivos alheios marcados só passam com bytes literais, tipo e modo iguais ao índice;
ausência fora das regras sparse sem mudança base–índice é permitida, conforme `references/quality-contract.md`. Não filtre o
JSON manualmente nem dispense outros novos. Não há cache dessas
execuções nesta versão. A auditoria recebe as execuções literais, inclusive saída, e retorna
`qualityReview`, vinculando cada ID aos seus alvos aprovados; outro arquivo inventariado não
substitui o alvo. Citação excepcional da SPEC exige fonte medida como texto e linha existente.
Confira perfis, decomposição, alvo e relatório pelo conteúdo. Falta/duplicata/omissão é erro
de evidência; relato completo com exit não zero segue correção/revalidação se funcional,
ou parada operacional se ambiental. Issue semântico segue confirmação e pode ser refutado.
Não confunda schema completo com qualidade provada.
Preserve contrato, inventário, execuções, cobertura e limitações no relatório final.

Ausências sparse elegíveis usam um único lote NUL de membership; fallback prepara regras
e configuração uma vez por inventário, sem cache persistente. Symlink interno válido para
arquivo regular é objeto `symlink`, com zero linhas e bytes positivos de `readlink`, sem
ler conteúdo do alvo. No diff, novo link declarado usa `{path,type:"symlink",targetBase64}`.
Registre classificação, destino literal observado (ou bytes escapados/hex identificados),
resolução interna, limitação e inspeção na SPEC local inventariada. Evidência nontext cita
essa linha real da SPEC; nunca uma linha inventada no link. Links externos, dangling,
diretórios, tipos especiais e pendência-link continuam recusados.


## 🪜 Regras ponytail (P1–P18) e portão TDD

Fonte única em `references/escada-ponytail.md`: a escada **P1–P7** ("The best code is the code
you never wrote"), o inegociável **P8** (lazy, not negligent), o peso do diff (**P10–P14**) e o
resumo do portão TDD. **Cite pelo número** — a `entregar` usa a mesma reference; não duplique as
regras aqui nem lá.

Parte disso é mecânica, não conselho: o harness faz o operário **relatar em que degrau parou**
para cada coisa que criou, roda uma **auditoria ponytail** do diff em toda iteração (todos os
perfis) e trata **dependência nova sem justificativa durável verificável (P10)** como
bloqueante (natureza `dependencia`). A auditoria cita fonte em SPEC/plano/ADR/PR acessível
ou comentário útil, com arquivo:linha ou URL com âncora e contexto do porquê P1–P5 falharam.
Booleano ou nome de manifesto não bastam; não é obrigatório comentar o processo no código.
Duplicação e abstração sem responsabilidade útil seguem confirmação antes de retrabalho.
A contagem de chamadores sustenta uma alegação factual, não um juízo de arquitetura:
interfaces de uso único podem proteger fronteira e testabilidade. Busque chamadores reais
(testes, reexports e imports dinâmicos incluídos) e registre comando/contagem em `buscaChamadores`.
A
mesma regra vale para as lentes: afirmação sobre uso, chamadores ou impacto restrito ("nenhum
chamador", "afeta só Y") só entra como `confirmado` com a busca executada citada no cenário;
sem ela, é `plausivel`, e o confirmador de finding de lente reconta antes de virar retrabalho
(contagem que não bate refuta). O `porque` da confirmação de lente não vai ao relatório: a
busca força a conferência, não vira evidência gravada. Como a severidade desses sinais nasce de uma constante do script e nenhum
revisor a classificou, o confirmador responde duas perguntas em campos separados (desde a
2.4.12): `real` (o fato existe?) e `bloqueante` (viola critério de aceite, quebra em cenário
real ou toca segurança?). Real e bloqueante vira retrabalho; real e não bloqueante vira
pendência, registrada com o veredito em `ponytail.duplicacoesEAbstracoes` (`confirmado: true`,
`severidade: "nao-bloqueante"`). Esse segundo campo só existe para sinal da auditoria: finding
de lente mantém a severidade que a lente classificou, e o confirmador não pode rebaixá-la.
Origem e roteamento do finding de lente são do controlador (2.6.0): ele copia só os campos do
schema da revisão (`arquivo`, `linha`, `resumo`, `cenario`, `severidade`, `confianca`) e fixa
`origem: "lente"` e `natureza: "revisao"`. `origem`, `sinal` ou `buscaChamadores` trazidos pela
lente são descartados, então ela não ganha a pergunta de severidade nem o prompt de sinal da
auditoria.
Para o mesmo arquivo, alegação e cenário, o veredito é reaproveitado: refutação ou "real, não
bloqueante" não pagam novo confirmador, mas um sinal confirmado como bloqueante continua
bloqueante enquanto a auditoria atual o apontar. Se o cenário mudar, exige novo veredito; se o
sinal desaparecer da auditoria atual, deixa de bloquear. O cache não verifica mudança de
código por si só.

**Teste da SPEC é congelado dentro do loop.** A regra dos testes intactos proíbe qualquer
operário de editá-lo, então um sinal de duplicação/abstração localizado num arquivo da lista
de testes da SPEC não tem quem conserte: como bloqueante, o run só podia terminar escalado no
teto. O script decide pelo arquivo, sem rota de modelo: o sinal vai para
`ponytail.pendenciasEmTestesDaSpec`, **sem confirmador e sem julgamento** (é alegação da
auditoria, não veredito). Arquivo de apoio que o portão TDD criou fora dessa lista não é
protegido por hash e segue o fluxo normal. Achado de **lente** num teste da SPEC continua
bloqueando: pode ser teste que não cobre o critério, e isso é furo do portão, não peso de diff.
Como ninguém no loop pode editar o teste, esse caso termina em escalada pro humano.

O **relato de escada** também é cobrado em código: unidade que fecha tocando arquivos com
`escada` vazia **e sem `semCriacao: true`** vira bloqueante na auditoria (natureza
`procedimento`). `semCriacao` é a declaração de quem só modificou o que existia (linha, texto,
comando, configuração) sem criar função, arquivo ou dependência: até a 2.5.0 o prompt mandava
`escada: []` nesse caso e o código bloqueava a mesma resposta, e a unidade ficava presa até o
teto. A declaração não é passe livre: a auditoria confronta o diff acumulado com **todas** as
escadas declaradas no run (de qualquer iteração, inclusive das unidades com `semCriacao`) e lista
em `criacoesSemRelato` a função, o arquivo ou a dependência criada que não aparece em nenhuma; cada
item vira sinal `P1-P7` plausível, de natureza `procedimento`, julgado pelo confirmador (que recebe
a escada acumulada). Os testes da SPEC nascem no portão e ficam fora desse confronto. E **auditoria, lente de revisão ou confirmador de
finding que não retornam abortam o run** (`status: "erro"`, reinvocável com `resumeFromRunId`)
em vez de virar "nada encontrado" — senão bastaria uma lente falhar no perfil econômico para o
run fechar verde sem nenhuma revisão adversarial, ou um confirmador falhar para um bloqueante
plausível sumir em silêncio. Portão que falha aberto não é portão (endurecido na 2.3.1, após
revisão adversarial externa).

Duas ressalvas que o código impõe e a prosa não deve esconder:
- A auditoria enxerga o **diff acumulado**, não o da iteração: contra `baseRef` quando ele é
  passado (inclui os commits da entrega), senão a working tree contra HEAD. Não há recorte por
  iteração. Por isso ela deduplica achados entre iterações, e `linhasAdicionadasAcumuladas` é
  acumulado: não leia como "cresceu tanto nesta rodada".
- **P14 tem uma porta lateral:** a rota mecânica nunca transforma fora-de-escopo em retrabalho,
  mas no perfil Máximo a lente R3 revisa o mesmo diff e *pode* reportar o mesmo trecho como
  bloqueante por P1. Se isso acontecer, é julgamento adversarial legítimo — não um bug.

## 🔴 Portão TDD: reprodução, preservação e exceções (2.5.0, 2.6.0)

O portão antigo exigia que **todo** teste novo falhasse, e travou um caso real com 4 regressões
vermelhas e 6 controles verdes. O contrato agora separa três coisas, cada uma ligada a um
critério e a um motivo:

- **Teste de reprodução**: prova o comportamento pedido; falha antes por asserção, passa depois.
- **Controle de preservação**: protege comportamento que já existe; pode nascer verde e precisa
  continuar verde.
- As **verificações complementares** (lint, preview, revisão) têm lista própria e nunca contam
  como teste.

**O tipo do critério vem da coluna `Tipo` da SPEC** (`references/spec-template.md`), que o
`scripts/spec-ids.mjs` extrai junto com os IDs; coluna ausente ou célula vazia é reprodução, e o
sufixo `(R)`/`(P)` no texto do critério não é lido. O operário classifica cada teste, mas não
reclassifica o critério: critério de reprodução cujos testes não têm nenhuma reprodução, ou
critério de preservação com teste de reprodução, bloqueia com `tipo-divergente` antes da
execução. Mudar o `Tipo` é decisão do dono na SPEC (Step 4c da `entregar`), num run novo. Controle
extra dentro de um critério de reprodução é aceito.

Cada teste traz o **comando que roda só ele**: uma linha, sem crase, citando o próprio arquivo do
teste (o que recebe hash) e diferente do comando de qualquer outro teste. Em arquivo dividido por
mais de um teste, o comando precisa isolar o caso (filtro pelo nome): comandos que só diferem por
`./` no path ou por espaços contam como repetidos, e controle vermelho num arquivo que ele divide
com uma reprodução manda conferir primeiro se o comando isola o caso. O mecânico executa um
por vez e informa exit, tipo de falha e quantos `casos` o comando executou; sair 0 sem executar
caso nenhum (filtro que não casa) não é verde. O controlador classifica, em código: **evidência inválida** (erro de import, sintaxe ou infraestrutura, ou
resultado incoerente) e **controle vermelho** antes da implementação bloqueiam sem exceção
possível; **ausência de vermelho** (reprodução que nasce verde, ou suíte só com controles)
bloqueia, salvo rebaseline ou autorização. Sem nenhum vermelho válido na suíte, todo critério com
teste precisa de cobertura, inclusive os só de controle. Suíte mista com reprodução vermelha e
controles verdes abre o portão. Depois da implementação, reprodução vermelha e controle vermelho são bloqueantes
automáticos, e `verde` declarado sem uma execução por teste não fecha.

**O "não" do operário** (`vermelhoConfirmado: false`) não dispensa a medição: com testes escritos,
a execução independente roda antes, e os bloqueios medidos (`evidencia-invalida`,
`controle-vermelho`, `sem-vermelho`, `tipo-divergente`, `implementacao-preexistente`) têm
precedência e levam as ressalvas do operário no detalhe. Se a medição não acha violação que
explique o "não", o portão sai `nao-confirmado` com `tdd` (o vermelho foi medido e a divergência
está no relato, que o detalhe separa). Sem teste nenhum para medir, também sai `nao-confirmado`,
sem medição e sem `tdd`. Com `autorizacoesTdd` ou
`rebaselineTdd`, o prompt do portão lista os critérios cobertos e o "não" julga só os de fora:
critério com teste fora do escopo coberto continua bloqueando. Com `vermelhoNaBase`, as reproduções
já passam na worktree e o prompt do portão define `vermelhoConfirmado` uma vez só: `true` quando os
testes estão prontos e cobrem os critérios. O "não" nesse modo diz que não estão e também bloqueia
com `nao-confirmado` depois da medição, porque o vermelho na cópia da base (inclusive o import de
módulo que a entrega cria) não mostra se o teste cobre o critério. Operário que diz "não há vermelho"
enquanto a medição deu vermelho, ou o contrário, se reconcilia rodando o comando de novo antes de
cortar, reescrever ou pedir autorização.

**Implementação anterior ao portão.** O mecânico também lista os arquivos alterados
(`inspecionar-git.mjs alteracoes [<baseRef>]`). O que mudou fora dos testes da SPEC, do `apoio`
declarado, do arquivo da SPEC e do `pendenciasPath` (este só quando a base não o tem) vai para `tdd.implementacaoPreexistente`
(`detectada`, `comparadoCom`, `arquivos`). Reprodução verde com implementação detectada bloqueia
com `implementacao-preexistente`: **não reverta**, siga pela retomada abaixo. Sem detecção, o
motivo é `sem-vermelho` (critério já atendido ou teste inútil). Sem `baseRef`, a implementação já
commitada na branch não aparece na lista. O `apoio` (array `apoio` no retorno do portão) são os
helpers e fixtures que o portão criou ou editou fora da lista de testes da SPEC: não recebem hash
nem contam como implementação; apoio declarado num arquivo de unidade de trabalho bloqueia
antes da medição (o portão não implementa produção).

**Exceção humana (`autorizacoesTdd`).** Só o dono autoriza continuar sem vermelho, e só para
ausência de vermelho. Antes de pedir a decisão, explique ao dono a diferença entre reprodução e
preservação e mostre o que foi medido (uma pergunta, com o porquê, pelo contrato de conversa).
Com o sim, registre a autorização no Log da entrega (entrada nova
`[Step N] [autorização] <data> · <autor> · <ação> · <escopo> · <citação>`, com a frase do dono
literal; regra 8 do contrato de conversa) e passe-a nos args de um **run novo**:
`{ criterios: [IDs do escopo], evidencia, autorizadoPor, registradaEm, autorizacao, motivo? }`.
`autorizacao` é a citação literal do dono, copiada do Log; sem ela não há exceção. O harness
confere presença e forma, não autenticidade: paráfrase ou frase do agente é fabricação, não
autorização. Autorização da 2.5.0 registrada sem citação: pergunte uma vez, dizendo por quê;
nunca reconstrua a frase. A exceção exige perfil `maximo` (decisão do dono, 2026-11-02): as três
lentes compensam a continuidade sem vermelho, e `autorizacoesTdd` com qualquer item num perfil
efetivo diferente de `maximo` termina como erro na fase `Args`, antes de qualquer agente, com a
ação de reinvocar em run novo com perfil `maximo`. No Solo da `entregar` não há exceção: a entrega
que quer seguir sem vermelho passa para cá, em run novo no perfil `maximo` (decisão do dono,
2026-11-03; regra canônica em `references/escada-ponytail.md`). Quando a entrega passa para cá com
fases já implementadas no Solo, elas contam como implementação anterior: o run leva `baseRef` +
`vermelhoNaBase: true`, e `autorizacoesTdd` cobre só os critérios sem vermelho (sem isso, o portão
bloqueia com `implementacao-preexistente`). `rebaselineTdd` não exige perfil Máximo.
Campo desconhecido em `autorizacoesTdd` ou `rebaselineTdd` também é erro de `Args`. Autorização
já registrada no Log para o mesmo escopo, a mesma evidência e a mesma entrega é repassada ao run
novo sem nova pergunta. Sem autorização registrada, o harness não presume exceção, nem de prosa,
nem de `problemas` do operário. Nada se edita no controlador nem no estado. O relatório mantém
`vermelhoConfirmado` como foi medido (`false`) e as violações originais, e acrescenta
`tdd.continuidade` (com a `autorizacao` ecoada); a autorização não altera relatório anterior: o
run bloqueado continua bloqueado no Log.

**Retomada tardia: vermelho medido na base (`baseRef` + `vermelhoNaBase`).** Se a implementação
já existe na worktree quando o portão reabre, **nunca reverta** (nem stash) para fabricar vermelho.
O caminho preferido é um run novo com `baseRef` (o SHA completo de `git merge-base <branchBase> HEAD`,
calculado uma vez e gravado no Log; nunca o nome da branch, que anda e traria trabalho alheio) e
`vermelhoNaBase: true` (exige `baseRef`; sem ele é erro de `Args`). O prompt do portão diz que a
implementação já existe e que as reproduções vão passar na worktree; o mecânico cria uma cópia
descartável da base fora do workspace com
`node "<scriptsDir>/copia-base.mjs" criar <baseRef> '<testes da SPEC em JSON>' --apoio '<apoio em JSON>'`
(`--vincular` para diretórios de dependência, `--pai` para o diretório pai da cópia), roda cada teste
com o mesmo `comando` dentro dela e remove a cópia (`copia-base.mjs remover <dir>`). A identidade
da cópia é conferida antes de qualquer bloqueio do portão, e o que não confere é erro na fase TDD
(run novo, worktree intacta): o vermelho, ou a falta dele, medido em outra cópia não vale como
medido na base. Os hashes dos testes na cópia precisam ser iguais aos da worktree. `alteracoes`
precisa ter medido a mesma base (`comparadoCom` igual à `baseRef`). O sha da cópia
(`copiaBase.sha`) e o sha que `alteracoes` resolveu, quando ele existe, precisam ser iguais à
`baseRef`, sem diferença de caixa: os helpers devolvem minúsculas, e os comandos levam a `baseRef`
já normalizada. Como a `baseRef` é sempre o SHA completo, a cópia confere mesmo quando
`alteracoes` vem sem sha ou com erro. SHA de tag anotada o git resolve para o commit, e a cópia
não confere: passe o SHA do commit, de `git rev-parse --verify '<ref>^{commit}'`.
Reprodução vermelha por asserção na base é vermelho válido, sem continuidade.
Na cópia, teste que falha por import de um módulo **criado pela entrega** (aparece como adicionado
em `inspecionar-git.mjs alteracoes` contra a base) conta como vermelho válido: é o comportamento
ausente; qualquer outro erro de import, sintaxe ou infraestrutura continua evidência inválida.
Teste que passa também na base não reproduz nada (teste inútil): bloqueia, e no modo base
`rebaselineTdd` não o cobre (a premissa de implementação anterior é falsa na base); só
`autorizacoesTdd`. O relatório registra `tdd.modo`, `tdd.baseRef` e `tdd.copia` (`sha`,
`vinculados`, `removida`).

**Retomada tardia quando a base não pode ser medida (`rebaselineTdd`).** Reinvoque em run novo com
`rebaselineTdd: { criteriosAprovados: [IDs da SPEC aprovada], motivo, autorizadoPor,
registradaEm, validacaoAnterior? }`, com `autorizadoPor` e `registradaEm` de quem aprovou de fato (copiados do Log):
reprodução já verde num critério aprovado vira implementação anterior
**declarada** no relatório (`tdd.continuidade.rebaseline.implementacaoAnterior`, com a evidência
do git quando houver), controle verde
de critério aprovado numa suíte toda verde fica coberto (`criteriosCobertos`), a worktree é
preservada e os hashes da base são coletados de novo; critério fora dos aprovados continua
bloqueando. Para não repetir a suíte longa sem mudança, passe também `validacaoAnterior` (o
`validacaoFinal` do relatório verde anterior, inteiro): a cada iteração o mecânico mede a árvore com
`hashes-testes.mjs --impressao '<excluídos do diff>' '<excluídos só dos não rastreados>'`; impressão igual e conferida, mesmos comandos e validação
anterior verde = as validações longas não rodam de novo (registro em `validacoesReaproveitadas`);
os testes da SPEC rodam sempre. Qualquer dúvida na impressão executa tudo.

**O que a impressão cobre.** Ela deixa de fora, porque o fluxo grava neles depois da validação, o
arquivo da SPEC (`specPath`, que recebe o Log e o relatório), excluído do diff e dos não
rastreados, e o `pendenciasPath`, excluído só da lista de não rastreados. O arquivo de pendências
nunca é commitado: pendências rastreadas (HEAD ou índice), symlink ou diretório fazem o script
recusar a impressão, e aí não há reuso. Antes, um `pendenciasPath` que apontava para código
rastreado (unidade com área de diretório, módulo fora das unidades) escondia o código e a
validação longa era reaproveitada sobre ele. Excluído que é diretório também é recusado, e
`pendenciasPath` igual a um arquivo de unidade é erro na fase Spec. As listas entram no próprio
hash e voltam em `validacaoFinal.excluidos` (a do diff) e `validacaoFinal.excluidosNaoRastreados`
(a dos não rastreados). Passe o mesmo `pendenciasPath` em todos os runs da entrega: lista
diferente nunca confere. Limite dessa exclusão: se algum
comando de validação lê esses arquivos (lint de markdown, checagem de links, grep no repo), não
reaproveite. As variáveis `GIT_*_PATHSPECS` do ambiente (como `GIT_LITERAL_PATHSPECS=1`) não
desligam a exclusão: o script as retira antes de chamar o git. Arquivo novo
não rastreado entra com o tipo (arquivo, symlink) e o bit de execução, então trocar o modo de um
script novo muda a impressão. Limite que a
impressão não cobre: arquivos ignorados pelo Git e o ambiente (venv, node_modules, `.env`,
versão de ferramenta). Se algo disso mudou desde a validação anterior, não passe
`validacaoAnterior`. Submódulo, repositório aninhado ou bit `assume-unchanged`/`skip-worktree`
fazem o script recusar a impressão, e aí não há reuso. `validacaoFinal` emitido por uma revisão
anterior do harness em geral não confere com a impressão nova (lista de excluídos, tipo e modo
dos arquivos novos): roda tudo uma vez, que é a falha segura.

**O relatório `tdd`** sai em todo desfecho posterior à classificação do portão, inclusive no erro
de hashes da base, e traz: `tdd.execucoes` (o resultado medido de cada teste no portão: `teste`,
`criterio`, `tipo`, `comando`, `exitZero`, `tipoFalha`, `casos`, `resumo`; é o vermelho que o Log
registra, diferente de `modelos.execucoes` do bridge Codex), `tdd.declaracaoDoOperario`
(`vermelhoConfirmado` e `problemas` como o operário relatou; o `vermelhoConfirmado` do topo é o
medido) e `tdd.continuidade`. Quando a declaração diz "não" ou traz ressalva, o Log leva a
declaração e as ressalvas mesmo no relatório condensado.

## Ambiente × funcional na validação

Cada falha da validação do projeto vem com `natureza` (`funcional`, `ambiente`, `indeterminada`)
e `evidencia` (o path ou a variável que controla o cache, o temporário ou o estado); é um campo
diferente do `tipoFalha` das execuções por teste. `ambiente` é cache, temporário ou estado sem
escrita, ferramenta ausente ou rede. O controlador para o run com `status: "erro"`, fase
`Validar`, `motivo: "ambiente"` quando todas as falhas da iteração são de ambiente, nenhum teste da
SPEC falhou por asserção e nenhum teste da SPEC mudou (os hashes são conferidos antes): em vez de
mandar operários mexerem em código ou teste para contornar permissão. A parada leva `historico` e
`tdd`. Falhas mistas seguem o loop, e o operário recebe nas correções a natureza de cada falha:
falha de ambiente não se corrige mudando código nem teste (vira pendência), e teste da SPEC que
falhou por infraestrutura do ambiente também não. A classificação é de modelo: só pode parar o
loop, nunca aprová-lo. Validação que declara `verde: true` e lista falha não é verde (2.6.0): o
controlador a trata como não verde (a falha segue o fluxo acima, inclusive a parada por ambiente),
loga a incoerência e marca `verdeDeclaradoComFalhas: true` no histórico da iteração; na parada
por ambiente, que sai antes de a iteração entrar no histórico, a marca fica no topo do relatório
de erro, ao lado de `motivo: "ambiente"`.

Comandos de validação são executados literalmente, num shell que não herda `export` da sessão:
para cache ou temporário graváveis, ponha a variável no próprio comando de `validacoes`
(ex.: `UV_CACHE_DIR=.cache/uv uv run pytest`), com o diretório fora da árvore ou ignorado pelo Git
(o uv grava um `.gitignore` no próprio cache; um `.cache/pip` não ignorado muda a impressão e
desliga o reuso). Mudar o comando muda `comandos`, e um `validacaoFinal` anterior deixa de ser
reaproveitado (falha segura).

## Inspeção do trabalho sem escrita

Auditoria e lentes recebem o comando concreto `inspecionar-git.mjs diff <paths> [baseRef]` em
`${CLAUDE_PLUGIN_ROOT}/skills/dev-loop/scripts/`. Execute da raiz física do workspace com
Node já disponível. A saída separa mudanças rastreadas (contra HEAD, ou contra `baseRef` quando o
run o recebeu, e aí inclui os commits da entrega; `comparadoCom` diz qual), conteúdo staged e novos
arquivos relatados pelo operário/testes. Argumento a mais ou base inválida saem com erro. `novosNaoIncluidos` lista nomes cujo conteúdo ainda
não foi lido: confronte com a SPEC e inclua somente arquivos autorizados em nova chamada.
Resolva também `declaradosNaoInspecionados`: paths relatados ausentes/ignorados não foram lidos.
Binários exigem inspeção própria. Falha do comando bloqueia a revisão; não equivale a diff
vazio. O helper não faz staging nem escreve arquivos. Mudanças já commitadas na branch entram na
revisão pelo `baseRef` que a `entregar` passa; run sem `baseRef` (standalone) não as vê, e o
commit fica sem revisão do loop até um run com a base.

O helper não prova a autorização dos paths, não detecta efeitos omitidos fora do Git e não
isola o shell. O revisor nunca corrige, encena ou limpa o índice; o passo de commit pertence
à `entregar`, que verifica todo o stage antes de prosseguir.

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

Run com `autorizacoesTdd` só roda no perfil **Máximo** (seção do portão): apresente esse custo no
plano; se o perfil já aprovado era menor, o custo aumentou e a pergunta volta ao dono (regra 8 do
contrato de conversa). O mesmo vale para a entrega que chega do Solo por falta de vermelho: perfil
e opt-in multi-agente são pedidos e registrados no Log como em qualquer Loop; sem opt-in, ou sem
harness multi-agente (sem a tool Workflow), ela fica bloqueada no portão, e sem harness o opt-in
nem se pede.

Invariantes que NENHUM perfil remove (estão no script, não são negociáveis por perfil, e cada um
tem um caso em `tests/harness-dev-loop.test.mjs` que roda o script com agentes falsos): portão
TDD com reprodução vermelha **confirmada por execução independente, teste a teste** (step
`tdd:vermelho`, no mecânico),
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
re-invocação do operário), cada duplicação/abstração achada pela auditoria custa 1 de confirmação
(sinal em teste da SPEC não custa: vira pendência sem confirmador), e cada evidência de hashes
que não confere custa 1 de recoleta.
Estime o piso, diga que é piso e a pergunta de **opt-in explícito**: *"posso orquestrar
com multi-agentes? (~N agentes)"*. Sem opt-in → fallback sequencial (abaixo).

## ▶️ Invocar o harness (caminho principal)

Com spec aprovada + branch de trabalho + perfil + opt-in, resolva `CLAUDE_PLUGIN_ROOT` desta
skill para um caminho absoluto e invoque a tool **Workflow** por `scriptPath` explícito.
Nunca substitua por `name: odin-dev-loop` durante teste local: uma instalação global pode
resolver esse nome para outra versão. Verifique no transcript a linha
`odin-dev-loop: revisão de contratos 2026-11-02-r8` identifica o portão legado preservado. Depois de validar o novo contrato, o harness também emite `odin-dev-loop: contrato de qualidade v1`; sem esta segunda marca não atribua ao run a verificação de qualidade desta versão.
Use um run novo após alterar o harness, sem reaproveitar `resumeFromRunId` de outra revisão (run da
revisão 2026-11-01-r7 não é retomado).

O sandbox Workflow não tem filesystem nem APIs Node. Os operários executam os scripts
standalone `scripts/spec-ids.mjs <spec> --quality` (tabela e contrato originais, antes do julgamento) e
`scripts/hashes-testes.mjs` (SHA-256 real via Node nos dois pontos). O controlador valida o
JSON transportado; erro de coleta é erro de evidência, não prova de que o teste foi alterado.
Quem leva esse JSON ao controlador é um modelo copiando 64 caracteres por arquivo, então o
script emite cada valor como `<sha256>-<conferência>` (CRC-32 de `path\nsha`) e o controlador
recalcula a conferência em JS puro. Valor que não confere — na base do portão ou numa
validação — dispara **uma** recoleta, em chamada própria no operário (`tdd:hashes`,
`hashes:i<N>`), registrada em `fallbacks`. Se a recoleta também não conferir, o run encerra
como `erro` de evidência. Só a divergência entre duas coletas conferidas é teste alterado.
O preflight também extrai a coluna `Verificação complementar`: coluna vazia não cria pendência
manual, e exigência explícita não pode ser omitida pelo agente. Os scripts não instalam
dependências nem escrevem no projeto.

Invoque:

```
Workflow({
  scriptPath: "${CLAUDE_PLUGIN_ROOT}/skills/dev-loop/harness/loop.mjs",
  args: {
    workspaceRoot: "<raiz absoluta física do projeto, obtida com pwd -P>", // obtido pela sessão, não pelo sandbox
    scriptsDir: "${CLAUDE_PLUGIN_ROOT}/skills/dev-loop/scripts", // resolvido para absoluto
    specPath: "docs/desafios/<slug>/entregas/<entrega-slug>.md",  // ou docs/plans/...
    branch: "feat/<entrega-slug>",          // já criada — o harness NÃO cria branch
    perfil: "economico" | "balanceado" | "maximo",
    validacoes: ["<comandos do projeto: lint, typecheck, test, build>"],
    hoje: "<data ISO de hoje>",
    baseRef: "<SHA completo de git merge-base <branchBase> HEAD>", // recomendado; obrigatório com vermelhoNaBase
    pendenciasPath: "<arquivo de pendências resolvido>", // OPCIONAL: não rastreado, fica fora da impressão
    vermelhoNaBase: true,                    // OPCIONAL: retomada, vermelho medido numa cópia da base
    tiering: {                              // OPCIONAL — só quando os defaults/rodada divergem
      modelos: { "consulta": "opus", "validar": "sonnet" },   // dos embutidos do script
      efforts: { "lente": "xhigh" }
    },
    autorizacoesTdd: [ /* OPCIONAL: autorização registrada do dono, com `autorizacao` literal; perfil maximo */ ],
    rebaselineTdd: { /* OPCIONAL: retomada com a implementação na worktree e a base sem medição */ }
  }
})
```

**`perfil`** aceita `economico`, `balanceado` ou `maximo` sem diferença de caixa ou acento
(`"Máximo"` vale `maximo`, o rótulo da tabela de perfis); perfil desconhecido é erro na fase `Args`,
antes de qualquer agente, em vez de cair no econômico em silêncio. Os args são validados na fase
`Args`, e também param ali, antes de qualquer agente: `pendenciasPath` fora do workspace e
`baseRef` que não é o SHA completo do commit (40 ou 64 caracteres hex; decisão do dono,
2026-11-03). Nome de ref, tag e SHA abreviado são recusados com o valor recebido no detalhe; o
SHA sai de `git merge-base <branchBase> HEAD` ou, para uma ref, de
`git rev-parse --verify '<ref>^{commit}'`, e o run novo o leva. Maiúsculas valem como minúsculas:
o harness normaliza, e comandos e relatório levam a forma minúscula.

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
`fallbacks[].causa` diz isso. O modelo que `modelos.porStep` registra é o **pedido** ao runtime
na chamada que retornou, não o observado (`modelos.nota`): o efetivo pode diferir (apelido da
família da sessão resolve para o modelo exato da sessão; `CLAUDE_CODE_SUBAGENT_MODEL_FORCE=1`; mod
com hook `agent.spawn`). Não grave no Log "a revisão rodou em opus" como fato observado. O revisor é Opus sempre (effort configurável, `high` por
default) — julgamento adversarial não justifica o teto nem aceita o porão. O arg
`modeloArquiteto: "fable"` segue aceito como legado (vira `tiering.modelos.consulta`).

O script roda em background e devolve um resultado estruturado. Trate os 4 desfechos:

- **`status: "verde"`** → todos os critérios com teste verde, validações ok, revisão sem
  bloqueante confirmado. Grave o relatório condensado no destino certo (abaixo) e devolva o
  controle: invocado pela `entregar` → ela retoma no Step 8; standalone → apresente o
  relatório e siga as regras da `entregar` pra qualquer commit/push (OK explícito). O bloco
  `ponytail` do relatório (escada relatada, dependências barradas/autorizadas, duplicações
  unificadas, tamanho do diff) entra no log **inteiro** — é o rastro de como as regras agiram.
  Três coisas dele viram entrada em `docs/pendencias.md`, nunca retrabalho:
  `ponytail.pendenciasForaDeEscopo`, `ponytail.pendenciasEmTestesDaSpec` (sinais não julgados
  em testes congelados) e os itens de `ponytail.duplicacoesEAbstracoes` com `confirmado: true`
  e `severidade: "nao-bloqueante"` (reais, julgados como pendência). O bloco `ponytail` sai
  também nos desfechos `escalado` e `erro` do loop, então essas listas não dependem do verde.
- **`status: "bloqueado"`** → a causa vem em `detalhe`/`acao`: na fase Spec/TDD, spec vazia ou
  com furo de formato, IDs de critério/unidade repetidos, unidade ligada a critério inexistente,
  pendência bloqueadora aberta, critério funcional sem teste, referência de teste inválida,
  mapa de tipos da SPEC ausente ou inválido, teste sem tipo ou sem comando, ou um `motivo` do
  portão: `evidencia-invalida` (corrigir ambiente ou teste; nenhuma autorização cobre),
  `controle-vermelho` (controle precisa nascer verde; em arquivo dividido com uma reprodução,
  conferir antes se o comando isola o caso), `sem-vermelho` (cortar, reescrever, rebaseline ou
  autorização do dono; nunca reverter; ler `tdd.violacoes` para separar reprodução verde de suíte
  sem vermelho), `tipo-divergente` (o teste contradiz a coluna `Tipo`; mudar o tipo é decisão do
  dono na SPEC), `implementacao-preexistente` (a implementação já existe; não reverter, run novo
  com `baseRef` + `vermelhoNaBase: true`, ou `rebaselineTdd` quando a base não puder ser medida),
  e `nao-confirmado` (o operário disse "não" e a medição não explica, ou não havia teste para
  medir: ler as ressalvas e `tdd.execucoes`, reconciliar e repetir o portão em run novo). Antes de pedir ao dono qualquer decisão sobre o portão, explique a diferença
  entre reprodução e preservação. Na fase Implementar, `arquivos-fora-do-workspace`: um
  operário relatou em `arquivosTocados` caminho fora da raiz (`arquivosForaDoWorkspace` lista
  unidade e caminho). Caminho absoluto sob a raiz o harness converte sozinho; fora dela, confira
  se houve edição em outro checkout, desfaça lá e inicie run novo. Na fase Validar,
  `artefato-nao-rastreado`: um arquivo não rastreado voltou depois da correção ao operário
  (`artefatos`); em geral a validação o recria. Incluí-lo no `.gitignore` ou declará-lo na SPEC e
  iniciar run novo; nenhum agente apaga o arquivo. Ou SPEC-lite
  (variante não-software do `spec-template.md` — a entrega roda Solo na `entregar`, o harness
  é exclusivo de software). Na fase `VerificacaoManual`, as validações automáticas passaram,
  mas `verificacoesManuaisPendentes` ainda exige evidência humana; não declare todos os critérios
  verificados. Corrigir/rotear na `entregar` (Step 4c) e, se for software, reinvocar — o harness
  não improvisa.
- **`status: "escalado"`** → teto de iterações/consultas estourado ou furo de spec descoberto
  no meio. Apresente o diagnóstico ao humano (`historico`, `detalhe`, `consultas` e, na escalada
  por teto de iterações da fase Loop, a única que o traz, `resumoDaEscalada`) e espere decisão.
  `resumoDaEscalada` diz se a última validação estava verde
  (`validacaoVerde`), conta as falhas de validação por natureza (`falhasDeValidacaoPorNatureza`) e
  os bloqueantes da última iteração por natureza (`bloqueantesPorNatureza`): `procedimento`
  (relato de escada), `integridade-dos-testes` (teste da SPEC alterado), `dependencia` (P10),
  `funcional` (teste da SPEC vermelho por asserção depois da implementação), `evidencia`
  (execução faltando ou incoerente), `qualidade` (check semântico do contrato confirmado), `indeterminada`, `peso-de-diff` (sinal da auditoria) e
  `revisao` (lente). Com bloqueante funcional, loop que não converge é sinal de spec ruim, não de
  falta de força bruta. `somenteProcedimento: true` não é verde e não é falha funcional: a última
  validação fechou verde, sem falha registrada, e os bloqueantes restantes são só de procedimento,
  que se resolvem sem retrabalho de implementação; diga isso ao dono. O harness não converte isso
  em verde: aceitar é decisão do dono, registrada.
- **`status: "erro"`** → falha de infraestrutura de um agente; reinvocar com
  `resumeFromRunId` aproveita tudo que já completou. Exceções, em que o resume devolveria as
  mesmas respostas do cache e cabe **run novo** (siga o `acao` do relatório):
  execução independente incompleta pede run novo (teste sem execução, repetida ou desconhecida
  no portão); erro de **evidência de hashes** (a coleta e a recoleta não conferiram); cópia da
  base com hashes divergentes, com sha que não confere com a `baseRef` ou com `alteracoes` de
  outra base; e
  `motivo: "ambiente"` na fase Validar (todas as falhas da iteração eram de ambiente: corrija o
  ambiente; não é regressão demonstrada, e também não foi descartada). Na fase TDD nada foi implementado. Depois que a implementação existe na worktree,
  o run novo leva `baseRef` + `vermelhoNaBase: true` ou, quando a base não puder ser medida,
  `rebaselineTdd` com os critérios aprovados e a autorização do dono (nunca preenchida pelo
  agente), sem `validacaoAnterior` (a validação não fechou verde). Erro de hashes na fase
  Validar passa a conferência dos testes da SPEC contra o estado do portão ao humano. Perfil
  desconhecido, args malformados e `autorizacoesTdd` fora do perfil `maximo` são erro na fase
  `Args`, antes de qualquer agente: corrija os args.

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

0. Validar o contrato com `spec-ids.mjs <spec> --quality` e aplicar `references/quality-contract.md`
   no planejamento, implementação e revisão. Registrar evidência por check, inventário e
   decomposição; declarar autorrevisão sem atribuir independência a este fallback.
1. 🔴 Portão TDD: escrever os testes de TODOS os critérios, classificados pela coluna `Tipo` da
   SPEC em reprodução e preservação, cada um com comando próprio; rodar um a um e confirmar
   reprodução vermelha por asserção e controles verdes (teste de reprodução que nasce verde é
   suspeito: critério já atendido → cortar; teste inútil → reescrever). Implementação já
   presente: medir o vermelho numa cópia da base (`scripts/copia-base.mjs criar <baseRef>`),
   nunca reverter a worktree; base que não pode ser medida → rebaseline declarado no Log.
   Erro de import, sintaxe ou infraestrutura não é vermelho. Sem vermelho, nada de implementação:
   a exceção humana (`autorizacoesTdd`) é arg do harness e não vale neste fallback, nem com as
   lentes do perfil uma por vez; sem o harness no perfil `maximo`, a entrega fica bloqueada no
   portão (regra canônica em `references/escada-ponytail.md`).
2. Implementar unidade a unidade com as regras ponytail (P1–P18), sem tocar nos testes; decisão de
   arquitetura que não é sua → apresentar ao humano como consulta (opções + trade-offs).
3. Validações do projeto + testes da spec + comandos e inventário de qualidade, sem cache destes últimos.
4. Revisão adversarial: as lentes do perfil, uma por vez, tentando refutar
   (`references/protocolo-revisao-adversarial.md`); finding sem arquivo:linha + cenário é
   descartado; plausível é confirmado antes de retrabalho; afirmação mecânica (uso único, nenhum
   chamador) é recontada com a busca.
5. Não fechou → próxima iteração (máx 3); estourou → escalar com diagnóstico.

## NUNCA fazer

- ❌ Rodar o harness sem spec aprovada, sem branch de trabalho, ou sem opt-in de custo
- ❌ Rodar pra entrega não-software (isso é modo Solo da `entregar`, trilha por tipo)
- ❌ Re-implementar o loop em prosa quando a tool Workflow existe — o script É o protocolo
- ❌ Começar implementação com o portão TDD aberto, ou editar teste pra fazê-lo passar
- ❌ Reverter, fazer stash ou descartar implementação existente para fabricar vermelho (use `rebaselineTdd`)
- ❌ Presumir autorização do dono, ou editar controlador ou estado para destravar o portão
- ❌ Ignorar um `status: "escalado"` e reinvocar sem decisão humana
- ❌ Autorar spec de trabalho novo por aqui — exploração/brainstorming/spec são da `entregar`
- ❌ Commit/push/PR por conta própria (o harness aplica diffs na working tree; commits são da `entregar`, com OK)
- ❌ Relatório sem casa: todo run persiste no log da entrega ou no arquivo da spec avulsa
