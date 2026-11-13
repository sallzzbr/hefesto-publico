# Changelog

## 1.0.0 (2026-11-10)

Paridade com o hermes 2.0.0: perfil do negócio, segmento e eixos configuráveis, conectores por categoria, regras com origem rotulada e harness sem comando legado; as skills de revisão e sugestão de arte saem do pacote. Recursos sincronizados em `shared`.

## 0.4.0 (2026-11-10)

Paridade com o hermes 1.6.0: limpeza de prosa e fixtures para o espelho público, sem mudança de comportamento das skills.

## 0.3.10 (2026-11-10)

Paridade com o hermes 1.5.9: endurecimento do harness criativo (ações estruturadas, quoting, validação de entradas, `--log-render`, rota legada com veredito preservado e sinalização `texto_fiel_nao_verificado`) e `allowed-tools` de leitura nas skills analíticas (pré-aprovação, sem concessão de escrita nem bloqueio das demais ferramentas).

Segunda rodada da revisão: o filtro do comando legado recusa também `$'...'`, `$"..."`, `$[...]`, `$~`, `$` seguido de não espaço e parênteses fora de aspas, e `args.python` com espaço em caminho relativo é aceito.

## 0.3.9

Testes da `regua-decisao` passam a usar réguas sintéticas sem relação com as de qualquer conta (CAC breakeven 100, CAC alvo 80, ROAS breakeven 2,00), com os cenários recalculados para as mesmas fronteiras. Sem mudança de comportamento na skill nem no script. Os READMEs de instalação passam a citar a versão vigente do marketplace, conferida por teste.

## 0.3.8

Referências operacionais pessoais abstraídas e consumidores atualizados para o contrato de perfil local do autor.

## 0.3.7

- Runtime do bridge: `responder` com `.lock` preexistente falha com diagnóstico (caminho do lock, execução interrompida, conferir o pid e remover manualmente) em vez do erro cru, sem remover o lock sozinho. O schema mede `minLength` e `maxLength` em pontos de código, não em unidades UTF-16.

## 0.3.6

- Refutação de promessa com justificativa inválida encerra como erro de resposta, sem afirmar promessa falsa, reclassificar o achado ou liberar entrega. Testes do harness e replay pelo bridge verificam a distinção.

## 0.3.5

- Fecha o schema dos itens de findings: campos extras são recusados, inclusive metadados reservados ao controlador. Preserva alvo e acaoSugerida opcionais. Replay pelo bridge verifica rejeição sem mutação de estado e aceitação da resposta corrigida.

## 0.3.4

- Exige justificativa com 20 caracteres sem espaços/invisíveis e ao menos uma letra ou número para aceitar refutação, incluindo confirmação de promessa. Prompts exigem explicar o problema e a evidência. Testes cobrem fronteira 19/20, pontuação, Unicode e replay pelo bridge.

## 0.3.3

- Runtime respeita CODEX_HOME explícito para defaults, sem ler configuração real por fallback.
- Impõe limites de rotas e candidatos, preserva o Python do venv e corrige instruções nativas de análise financeira.
- Corrige execução direta do bridge em paths com symlink e `--preserve-symlinks-main`.

## 0.3.2 (2026-11-03)

- Acompanha o hermes 1.5.2 do Claude: o controlador sincronizado em `shared` aceita os 17 slugs
  A-Q no enum do crit (antes o bridge recusava `verdade_comercial` e os demais K-Q como fora do
  enum) e, com a headline travada, verdade comercial confirmada na headline encerra o run como
  `bloqueado` sem correção, em vez de virar sinalização e fechar verde. Validador sem
  remapeamento de K-Q; resumos nativos de `criativo-fluxo` e `validar-criativo` e a referência
  de execução alinhados. Teste que trava: replay "headline travada com verdade_comercial
  confirmada encerra bloqueado" em `codex/tests/controllers.test.mjs`.
- Revisão independente do HERMES-1, ainda na 0.3.2: controlador e contratos sincronizados com as
  correções do hermes 1.5.2 (promessa da headline sempre em `verdade_comercial`, severidade
  coagida com a trava, alvo sem diferença de caixa, contexto e lookup do catálogo, K e O
  sinalizados). O resumo nativo do `criativo-fluxo` e a referência de execução passam a dizer que
  defeito de render com alvo headline (custo overlay ou ia) segue o fluxo normal; o do
  `validar-criativo` manda a promessa falsa da headline para `verdade_comercial`. Testes que
  travam: dois casos `HERMES-1` em `codex/tests/hermes-pos-q4.test.mjs`.
- Decisões 17A e 18C do dono (2026-11-03), acompanhando o hermes 1.5.2 do Claude: o controlador
  sincronizado em `shared` exige `porque` não vazio em todo veredito de confirmação (o bridge
  recusa a resposta sem ele, e refutação com `porque` só de espaços não descarta o achado) e, com
  a headline travada, emite a solicitação nova `promessa:i<N>` para todo `headline_tem_ideia` na
  headline; `promessaFalsa: true` encerra o run como `bloqueado`. Resumos nativos de
  `criativo-fluxo` e `validar-criativo` e a referência de execução descrevem as duas regras.
  Testes que travam: dois replays em `codex/tests/controllers.test.mjs` (a confirmação de promessa
  pelo bridge e a recusa de veredito e de confirmação de promessa sem `porque`) e um contrato de
  documentação em `codex/tests/hermes-pos-q4.test.mjs`.
- Revisão independente das decisões 17A e 18C, ainda na 0.3.2: controlador sincronizado com as
  correções do hermes 1.5.2 (reclassificado reconhecido pela identidade do objeto, não pelo
  `criterioOriginal` que o bridge aceita como campo extra do crit; `porque` só com caracteres
  invisíveis, como U+200B, não descarta o achado). A referência de execução cita os caracteres
  invisíveis. Teste que trava: o replay da confirmação de promessa em
  `codex/tests/controllers.test.mjs` confere o motivo do bloqueio e o `porque` do catálogo.
- Decisão 19A do dono (2026-11-03): o `RUNTIME.md` ganha a seção "Perguntas ao usuário". Não se pergunta o que dá para verificar por leitura ou comando, o trabalho que não depende da resposta vem antes, a pergunta necessária é curta e completa, fecha a mensagem e encerra o turno, e nada continua executando depois dela; regra de pergunta da skill ou do contrato de domínio se soma. Teste que trava a instrução escrita (não o comportamento): `codex/tests/runtime-pergunta.test.mjs`, que lê o RUNTIME de cada pacote do marketplace Codex.
- Revisão da decisão 19A (2026-11-03): a regra restringe o fim do turno à pergunta direta; pela ferramenta de interação da sessão a resposta volta no mesmo turno, e nada continua executando antes de ela chegar. Sem a ressalva, a seção contradizia a linha do mesmo `RUNTIME.md` que oferece perguntar pela ferramenta de interação ou por pergunta direta, e proibia seguir depois da resposta. Caso novo por pacote em `codex/tests/runtime-pergunta.test.mjs`.

## 0.3.1 — 2026-11-01

- Perfil desconhecido do controlador é erro de args (antes caía em silêncio no default); acento/caixa normalizados.
- Bridge: diagnostica diretório do run existente, pai ausente ou sem escrita; ignora `__pycache__`, `*.pyc` e `.DS_Store` no fingerprint; recusa por fonte alterada lista os arquivos envolvidos e orienta reinstalar a mesma versão em vez de apagar à mão; symlink com nome de cache continua recusado; erro de gravação preserva código e causa e não deixa diretório órfão.

## 0.3.0 — 2026-11-01

- Acompanha o hermes 1.5.0 do Claude: skill nativa nova `regua-decisao`, com o script sincronizado em `shared` (`regua-decisao.mjs`);
  as skills de revisão e sugestão de arte hoje vivem fora do pacote público.
- Resumos nativos de `fadiga-criativa`, `otimizar-verba`, `analise-diaria` e `sintese-semanal`
  apontam para a régua de decisão em vez de repetir limiares; `saude-do-funil` ganha P/V;
  `analisar-produto`, lacunas e re-estética; `auditoria-cro`, modos, estado do achado e 390 px.
- Acompanha o endurecimento da revisão adversarial do hermes 1.5.0: scripts sincronizados com a
  régua em centavos, `reguas` fechada, gatilhos novos e arte sem aprovação calada; resumos
  nativos de `regua-decisao`, `otimizar-verba` (score é prioridade, não veredito),
  `saude-do-funil` (campos do P/V), revisão de arte (venv, canvas compartilhado,
  `png-nao-suportado`), `analise-diaria`, sugestão de arte, `analisar-criativos` e
  `diagnostico-site-funil` (piso de diagnóstico da régua) alinhados ao contrato.
- Adendo do material oficial da plataforma de referência: lucro do período e por real investido na régua
  e nas skills que recomendam, devolutiva com nota e mini coleção na revisão de arte, seis
  etapas e variações na sugestão de arte e checklist de margem, descontos, frete, prazo e site
  próprio no `auditoria-cro`, com os scripts sincronizados.

## 0.2.1 — 2026-10-23

- Sincroniza recursos da versão Claude 1.4.1: custos fixos, reconciliação de plataforma com ledger e regra de rampa.
- Registra o bump da distribuição Codex exigido pela atualização dos recursos compartilhados.

## 0.2.0 — 2026-10-02

- Acompanha o hermes 1.4.0 do Claude: skill nova `analisar-produto` (script Node de cálculo em `shared`, sem PII) e correções do fluxo criativo (`semGeracao`, `flagSobrescrever`, `reproduzir`, `headline`, `headlineTravada` e `sinalizacoes[]`; Catalog Sales sem clonagem de conjunto).
- `analisar-produto`: seção `Sugestão de conjunto` (só sugestão; campo opcional `conjuntos` fornecido pelo workspace, checando conjuntos existentes antes de sugerir um novo).

## 0.1.3 — 2026-09-09

- Rough e produção deixam de repetir geração por fallback ou erro. Falha, ausência de saída ou resposta parcial encerram para reconciliação, preservando parciais; nova tentativa depende de decisão humana e orçamento. Fallbacks sem geração continuam disponíveis.

## 0.1.2

Distribuição pública inicial no marketplace v3.18.0. Metadados apontam para o repositório público; pacote autocontido e política nativa de modelos preservados.

## 0.1.1 — 2026-09-08

- Política Codex explícita: herança de modelo/effort, preferência OpenAI por papel e identidade efetiva separada; instruções históricas de modelo não governam esta distribuição.
- Falha operacional encerra o bridge sem fallback legado; respostas e solicitações interrompidas são preservadas para reconciliação. Achados de conteúdo mantêm os gates e tetos.
- Sincronizada a correção compartilhada de preflight com erro de script.

## 0.1.0 — 2026-09-06

Primeira adaptação Codex. Verificação técnica nesta etapa; avaliação comportamental e publicação seguem o plano do repositório.
