# Changelog — hermes

## 2.0.0 (2026-11-10)

Generalização do plugin para qualquer negócio de comércio online, sem alias (quebra de contrato):

- Perfil do negócio no workspace (`perfil-do-negocio.md`, path por `local_perfil`; formato em `references/perfil-do-negocio.md`). Obrigatórios: moeda, `segmentos` e eixos. Opcionais, com aviso quando ausentes porque nenhuma skill os consome: `modelo`, `pais`, `evento_conversao`, `metrica_norte`, `canais_ativos`, `aprovador` e `exclusao_vendas_internas`. `verificar_workspace.py` valida cada campo e nomeia o problema em `missing` (`perfil.<campo>`).
- O manifesto de scripts (`manifesto-scripts.json`, path por `local_manifesto`, default `<local_scripts>/manifesto-scripts.json`) é obrigatório: o preflight reporta `scripts.manifesto` em `missing` quando ele falta, não é JSON ou não traz a lista `scripts`.
- Chave de segmento do schema de rotas passa a `segmento`, **por peça** como na 1.x: cada rota carrega o seu e o render vai para `renders/<segmento>/<slug>.png`. O perfil declara a lista permitida (`segmentos`, separados por vírgula, em formato de slug e sem repetição); a skill a injeta como `args.segmentos` e o harness recusa a rota cujo segmento não esteja nela (o `args.segmento` único não existe, sem alias). O harness valida o segmento como slug (com ou sem `args.segmentos`) e só aceita `compor.saida` exatamente `<marketing>/criativos/renders/<segmento da rota>/<slug da rota>.png`; o `renderJaExiste` do portão olha esse arquivo.
- O `analisar-produto` lê os eixos do perfil (`item` e `eixos` na entrada, no CSV e no relatório) e controla cada eixo pelos demais. Nome de eixo segue o formato de `references/eixos.json` e não colide com coluna fixa (a mesma lista vale no preflight); chave de topo desconhecida na entrada é recusada. Com 3 ou mais eixos a lacuna de portfólio é a célula de um par de eixos, com teto de 500 linhas e aviso do excedente (`lacunas_omitidas`); com 2 eixos o resultado é o mesmo de antes.
- Conectores por categoria em `CONNECTORS.md`, com adaptadores em `references/adaptadores/`; as skills analíticas deixam de nomear tool de fornecedor.
- Regras numéricas e decisórias rotuladas `oficial`, `heurística` ou `metodologia` (`references/regras-origem.md`); heurísticas viram parâmetros do perfil e a saída da `regua-decisao` traz a origem de cada regra aplicada. A janela mínima de veredito (valor e piso de 7 dias no script) passa a `metodologia`; a regra de pausa informa o piso efetivo (`piso_efetivo`) e cita `reguas.cac_breakeven` quando é o CAC breakeven que governa.
- Comando legado do harness `criativo.mjs` removido: rota sem `acoes` retorna `erro` antes de qualquer agente. O critério de fidelidade específico de arte sai do enum do harness e entra `fidelidade_mockup` (17 critérios), próprio e neutro: bloqueante mesmo sem baseline de vencedora quando há mockup do produto (a severidade declarada pelo crit é coagida a bloqueante, com registro); `fidelidade_referencia` segue bloqueante só com baseline.
- As skills de revisão e sugestão de arte foram removidas deste plugin.

Migração (passos, na ordem):

1. Criar o `perfil-do-negocio.md` no workspace e o `manifesto-scripts.json` ao lado dos scripts (ou no path de `local_manifesto`); sem o manifesto o preflight reprova.
2. `regua-decisao`: passar `moeda` (código de 3 letras do perfil) e as 7 heurísticas obrigatórias em `config` (`piso_diagnostico`, `piso_opiniao_fadiga`, `piso_veredito_pausa`, `conversoes_minimas_escala`, `intervalo_minimo_degrau_dias`, `lucro_por_real_referencia_min`, `lucro_por_real_referencia_max`). Valores de referência que reproduzem o comportamento da 1.x, na moeda do perfil: 50, 100, 200, 10, 7, 0,70 e 1,50. A saída passa a formatar dinheiro com o código da moeda: `R$250,00` vira `BRL 250,00`.
3. `analisar-produto`: a chave de itens da versão anterior vira `itens`, com `item` por linha, e `eixos` passa a ser a lista do perfil; no conjunto, a lista de itens se chama `itens`; o limite de itens por célula de lacuna passa a `lacunaMaxItens`; na saída, a chave de item da vitrine vira `item` e `lacunas[]` vira `{ celula: { <eixo>: <valor> }, itens }`; o campo `casa_excluida` vira `vendas_internas_excluidas`. O mapa literal antigo → novo de todas as chaves (`analisar-produto`, `regua-decisao`, harness e rotas), o que muda de saída e o que o consumidor deve criar estão em `references/migracao-2.0.md`.
4. Harness `criativo.mjs`: `args.logRender` e a flag `flagSobrescrever` da rota deixam de existir (o `logRender` e a flag de sobrescrever vêm do manifesto de scripts, que passa a ser obrigatório); rota sem `acoes` é erro; renomear a chave de segmento nas rotas aprovadas, declarar `segmentos` no perfil e manter `compor.saida` em `renders/<segmento da rota>/<slug>.png`.

Limites conhecidos da 2.0.0:

- Os limiares do `analisar-produto` mantêm valor de referência no script (parâmetros nomeados e sobrescrevíveis em `parametros`); só a `regua-decisao` os exige no `config`.
- As heurísticas da `regua-decisao` não ficam no arquivo de perfil validado: vêm do CLAUDE.md ou dos defaults.
- Sem baseline de vencedora, `fidelidade_referencia` vira sinalização; a fidelidade ao mockup do produto continua bloqueante por `fidelidade_mockup`.
- O `logRender` do manifesto é um caminho por compositor; veja "logRender" em `references/migracao-2.0.md` para o log datado por peça.

## 1.6.0 (2026-11-10)

Limpeza do que vai ao espelho público. Feito: créditos e rótulos de origem nominais saem do README (raiz e do plugin) e deste CHANGELOG; o rótulo das heurísticas passa a "heurística de mercado"; as menções a workspace e conta de um caso original viram redação neutra nas skills, no harness e nos testes; as entradas 1.5.3 a 1.5.8 ganham data; o fixture `perfil-plataforma-exemplo.json` passa a nomear um fornecedor fictício (`ImpressoraExemplo`) com URL `example.invalid`, e o teste que o lê deixa de chamar a tabela de modelos de "oficial" (`MODELOS_DE_EXEMPLO`).

Mudança de comportamento na saída do script `regua-decisao.mjs`: o campo `rotulo` das heurísticas e o campo `lucro.rotulo`/`lucro.texto` passam a dizer "heurística de mercado" e "referência de mercado", no lugar do rótulo anterior. Quem compara essas strings (testes, relatórios) precisa atualizar. Nenhuma decisão (pausar, manter, escalar, reverter-degrau) muda.

O restante da prosa de nicho e a remoção do fixture de perfil de plataforma foram tratados na 2.0.0.

O detector de dados pessoais do guard do espelho distingue melhor intervalo numérico de telefone e ID sequencial de CPF; formas de e-mail de destino remoto exigem o formato de destino (usuário de serviço e caminho), não a palavra `ssh` na linha.

## 1.5.9 (2026-11-10)

Segurança do harness `criativo.mjs`: rotas passam a declarar `acoes` estruturadas e o harness monta o argv com quoting por valor, sem repassar texto livre do diretor ao mecânico; `compor` só aceita compositor e opções declarados no manifesto (posições `posicao` únicas e sem buraco); entradas (`slug`, `hoje`, caminhos, `python`) são validadas antes de qualquer agente; o validador recebe `--log-render`, e na rota com `acoes` `pass` com `skip` no texto fiel vira `unknown` e escala. Com o manifesto de scripts presente, rota sem `acoes` é recusada (`bloqueado`), nunca rebaixada ao comando livre. Os 4 agents declaram `disallowedTools`.

Rota legada (sem `acoes`) mantém o veredito da 1.5.8: com texto esperado, pre-flight sem `checks`, sem `texto_fiel` ou com `texto_fiel: skip` ainda fecha verde, agora com a sinalização `texto_fiel_nao_verificado` no relatório; `args.logRender` é opcional nela. Vem marcada `legado: true`. O filtro de operadores do comando legado entende aspas: fora de aspas recusa `| > < ; &`, crase, quebra de linha, `$(` e expansão de variável (`$VAR`, `${VAR}`, `$1`); dentro de aspas simples ou duplas, `| > < ; &` são texto, e `$(`, crase e `$VAR` dentro de aspas duplas seguem recusados. Aspa não fechada é recusada. Segunda rodada da revisão: o scanner também recusa fora de aspas o que modela mal, como `$'...'` (em bash e zsh a barra invertida não fecha a aspa ANSI-C e a cauda executava), `$"..."`, `$[...]`, `$~`, `$` seguido de qualquer não espaço e parênteses (qualificador de glob do zsh); `args.python` com espaço no caminho relativo (`meu venv/bin/python`) passa a ser aceito e lançador com argumentos segue recusado. Render e baseline do legado passam pela validação de path.

Limites conhecidos: o filtro do legado NÃO contém executável livre (`python -c`, `rm`, `curl`) nem torna o comando seguro; a contenção real é a rota com `acoes`, e o legado segue sujeito à confiança no agente que escreveu a string. `args.python` aceita um executável só (`uv run python` é recusado; use um wrapper). O bloqueio de MCP de anúncios nos agents usa curingas (`mcp__*ads*`, `mcp__*anuncios*`) cujo casamento depende do runtime e não cobre servidor sem esses termos no nome; o teste confere a declaração, não o efeito. As skills analíticas declaram `allowed-tools: Read, Grep, Glob`, que PRÉ-APROVA essas ferramentas de leitura e não concede escrita; não é restrição: as demais ferramentas continuam chamáveis e passam pelas permissões normais do usuário (a restrição de fato é `disallowedTools`, usada nos agents). Skills cujo corpo manda gravar arquivo ou chamar MCP/script do workspace seguem funcionando, pedindo permissão a cada uso. Pre-flight sem `checks` com texto esperado escala como `unknown` só na rota com `acoes`. Candidato do produtor com path inválido escala antes da composição (na rota legada, também com metacaractere de shell).

## 1.5.8 (2026-11-10)

Testes da `regua-decisao` passam a usar réguas sintéticas sem relação com as de qualquer conta (CAC breakeven 100, CAC alvo 80, ROAS breakeven 2,00), com os cenários recalculados para as mesmas fronteiras. Sem mudança de comportamento na skill nem no script.

## 1.5.7 (2026-11-09)

Referências operacionais pessoais abstraídas e consumidores atualizados para o contrato de perfil local do autor.

## 1.5.6 (2026-11-04)

- Refutação de promessa com justificativa inválida encerra como erro de resposta, sem afirmar promessa falsa, reclassificar o achado ou liberar entrega. Testes do harness e replay pelo bridge verificam a distinção.

## 1.5.5 (2026-11-04)

- Fecha o schema dos itens de findings: campos extras são recusados, inclusive metadados reservados ao controlador. Preserva alvo e acaoSugerida opcionais. Replay pelo bridge verifica rejeição sem mutação de estado e aceitação da resposta corrigida.

## 1.5.4 (2026-11-04)

- Exige justificativa com 20 caracteres sem espaços/invisíveis e ao menos uma letra ou número para aceitar refutação, incluindo confirmação de promessa. Prompts exigem explicar o problema e a evidência. Testes cobrem fronteira 19/20, pontuação, Unicode e replay pelo bridge.

## 1.5.3 (2026-11-03)

- Impõe limites de rotas e candidatos, preserva o Python do venv e corrige instruções nativas de análise financeira.

## 1.5.2 (2026-11-03)

- **Verdade comercial na headline travada fechava verde.** O enum do critério no harness só tinha
  os slugs A-J, o prompt do crit pedia "(A-J)" e o validador mandava levar K-Q para o slug vizinho
  (P e Q para `voz_da_marca`). Com `headlineTravada`, "[P verdade_comercial] promete personalização
  que o catálogo não oferece", registrado como `voz_da_marca` com alvo headline, virava
  sinalização e o run recomendava aprovar uma promessa falsa. Decisão 14 do dono: com a headline
  travada, só a verdade comercial continua bloqueando.
- K-Q viram contrato executável: os 17 slugs (A-Q) no enum do `CRIT_SCHEMA` e no prompt do crit;
  o validador usa o slug próprio de cada critério, sem remapear.
- Trava de headline: `verdade_comercial` com alvo headline nunca é sinalizada; segue a
  confirmação normal e, confirmada, encerra o run como `bloqueado` (fase Crit) logo depois da
  confirmação, com reports gravados e ação para o dono (destravar ou trocar a headline e
  reinvocar), sem queimar iteração. `headline_tem_ideia` com alvo headline passa a ser
  sinalizada, com motivo visível. Defeito de render (custo overlay ou ia) segue o fluxo normal.
- Testes que travam: casos `HERMES-1 (a)` a `(g)` em `tests/harness-criativo-fluxo.test.mjs`
  (bloqueado sem correção, confirmador no plausível, sinalização da ideia, controles de voz e de
  render, fluxo normal sem a trava e na imagem, prompt e enum com os 17 slugs); enum exato em A-Q
  e varredura contra instrução de remapear em `tests/test_harness_contracts.py`.
- Revisão independente do HERMES-1, ainda na 1.5.2:
  - Q listava "verdade comercial" entre os seus 4 testes, então a promessa falsa da headline podia
    sair como `headline_tem_ideia`, que a trava rebaixa. O 4º teste de copy agora é julgado e
    reportado em P (`verdade_comercial`, nunca `headline_tem_ideia`) no validador, no
    `validar-criativo` e no prompt do crit.
  - Com a trava, `verdade_comercial` na headline declarada `nao-bloqueante` é coagida a
    bloqueante, com registro em `severidadeCoagida` no histórico da iteração; antes ia para os
    não-bloqueantes e o run fechava verde.
  - `alvo` comparado sem diferença de caixa ou espaço ("Headline", "headline ") na trava e no
    bloqueio da verdade comercial.
  - O crit e a confirmação de `verdade_comercial` recebem a pasta de contexto resolvida e a
    instrução de lookup do catálogo.
  - Leitura literal da regra 2 da decisão 14: `tres_segundos` e `coerencia_imagem_copy` com alvo
    headline voltam a ser sinalização com qualquer custo (antes eram remapeados para
    `mensagem_completa`); `miniatura`, `desfoque` e `exclusao` com custo overlay ou ia seguem o
    fluxo normal, como quando iam para `legibilidade_thumbnail`.
  - `criativo-fluxo/SKILL.md`: o descarte de `copyCorrigida` aparece como efeito da trava, separado
    da verdade comercial sem trava.
  - Testes que travam: `HERMES-1 (h)` a `(l)` em `tests/harness-criativo-fluxo.test.mjs` e dois
    contratos de prosa em `tests/test_harness_contracts.py`.
- Decisão 17A do dono (2026-11-03), justificativa em toda refutação: `{real: false}` sem `porque`
  descartava o finding. O `VEREDITO_SCHEMA` exige `porque` (string, `minLength` 1) em todo
  veredito, e o controlador, como segunda camada, só descarta refutação com `porque` não vazio
  depois de tirar os espaços; sem ele o finding segue bloqueante, com `refutacaoRecusada` e o
  motivo em `findingsJulgados`. Vale para os 17 critérios A-Q.
- Decisão 18C do dono (2026-11-03): com `headlineTravada`, todo `headline_tem_ideia` com alvo
  headline, em qualquer severidade e confiança, passa antes por uma confirmação de promessa
  (`promessa:i<N>`, schema com `promessaFalsa` e `porque` obrigatórios, prompt com a pasta de
  contexto resolvida e lookup do catálogo). `promessaFalsa: true` reclassifica o finding como
  `verdade_comercial` bloqueante (registro em `reclassificados` no histórico) e encerra o run como
  `bloqueado`, igual à verdade comercial na headline travada, com o detalhe dizendo que veio de
  `headline_tem_ideia`; `false` com `porque` segue o tratamento de antes; `false` sem `porque` é
  falha fechada; confirmador que não retorna é erro. Sem a trava, nada muda. Docs em
  `criativo-fluxo`, `validar-criativo` e no validador.
- Testes que travam: casos `17A` e `18C` em `tests/harness-criativo-fluxo.test.mjs` (refutação sem
  porque nos 17 critérios e controle com porque, schema, verdade comercial plausível na trava,
  promessa verdadeira e falsa nas quatro combinações de severidade e confiança, prompt com o
  contexto, confirmador nulo, sem trava e alvo fora da headline) e dois contratos em
  `tests/test_harness_contracts.py`.
- Revisão independente das decisões 17A e 18C, ainda na 1.5.2:
  - O atalho do `headline_tem_ideia` reclassificado decidia pelo campo `criterioOriginal` do
    finding, que o crit podia mandar (os itens do `CRIT_SCHEMA` aceitam campo extra). O campo
    forjado pulava a T3 de um finding plausível, tirava `voz_da_marca` da sinalização da trava e
    encerrava `bloqueado` uma verdade comercial plausível sem confirmação. O controlador agora
    reconhece o reclassificado pela identidade do objeto que ele mesmo criou, no atalho e no
    detalhe do bloqueio.
  - A segunda camada da 17A só usava `trim`, que não tira formatação Unicode: `porque` só com
    U+200B ou U+2060 passava no `minLength` e no `trim` e descartava o finding com justificativa
    em branco. O controlador tira também `\p{Cf}` e os ignoráveis por padrão antes de testar, na
    T3 e na confirmação de promessa.
  - Testes que travam: caso novo `18C: criterioOriginal forjado pelo crit não roteia` em
    `tests/harness-criativo-fluxo.test.mjs`; os casos `17A` e `18C` de refutação sem `porque`
    ganham `porque` só com caracteres invisíveis; o de `promessaFalsa: true` passa a cobrir a
    grafia do alvo (`Headline`, `headline `, ` HEADLINE`) e a conferir o motivo e o `porque` da
    confirmação de promessa no bloqueio, em `reclassificados` e em `findingsJulgados`.

## 1.5.1 — 2026-11-01

- **Perfil fora do enum não cai mais em silêncio no balanceado.** Ausente continua no balanceado documentado; "Máximo" (acento/caixa) é normalizado; valor desconhecido é erro de args antes de qualquer agente (mesmo padrão do MIMYR-01, revisão geral de 2026-11-01).

## 1.5.0 — 2026-11-01 (conta pequena destravada, régua de decisão única, revisão de arte e CRO)

Conta com poucas compras por semana não tinha conjunto saindo do aprendizado, e a guarda
"menos de 50 eventos = em aprendizado" fazia as skills de tráfego nunca opinarem.

- Skill nova `regua-decisao`: fonte única da árvore pausar / manter / escalar / reverter-degrau,
  calculada por script determinístico (`scripts/regua-decisao.mjs`, Node sem dependências), com
  saída fechada, motivo com os números e rótulo de origem da regra (regra de plataforma,
  heurística de mercado, decisão da metodologia). Janela mínima de veredito de 7 dias, sem
  configuração para baixo; reverter degrau só 7 dias depois do degrau e com CPA acima do
  breakeven; piso de pausa efetivo nunca abaixo de um CAC breakeven. Registra a heurística
  "pausar com R$35 a R$45 em 3 dias" como avaliada e rejeitada.
- Endurecida pela revisão adversarial antes da publicação: dinheiro comparado em centavos e ROAS
  em centésimos (CPA no breakeven exato não pausa mais por ponto flutuante); `reguas` fechada e
  coerente (campo desconhecido ou alvo pior que o breakeven sai com exit 1); gatilhos novos
  `janela-mista` (janela que começa antes da edição ou do degrau), `piso-diagnostico`,
  `piso-reversao` (sem venda, reverter só com um CAC breakeven de gasto) e `intervalo-degrau`
  (espera de escala, heurística de mercado); o degrau fica em avaliação até uma semana depois
  da primeira janela mínima inteira depois dele (14 dias no padrão) e, consolidado, desempenho
  ruim segue a regra de pausa; a janela não começa antes do último degrau mais do que a janela
  mínima obriga, para qualquer veredito; a reversão conta como edição; sinais divergentes nos dois sentidos; motivo
  sempre com a relação verdadeira.
- A régua devolve também o lucro do período (margem de contribuição da receita menos o gasto,
  sem custo fixo; com números da plataforma de anúncios, rotulado como lucro de plataforma, com
  o fator ledger ÷ plataforma a aplicar) e o lucro por real investido, com a faixa de referência de mercado de
  R$0,70 a R$1,50 por real (sobrescrevível); o lucro informa e não muda a árvore, e as skills
  que recomendam mostram os dois, porque retorno menor por real pode dar lucro total maior.
- Pisos de gasto unificados, com papel e campo sobrescrevível pelo workspace: diagnóstico R$50,
  opinião de fadiga R$100, veredito de pausa R$200 (referência R$200 a R$250).
- `fadiga-criativa` e `otimizar-verba`: o limiar de eventos de aprendizado vira campo opcional do
  workspace (desligado por padrão), com fallback de 7 dias desde a última edição + piso de gasto.
  As duas, mais `analise-diaria` e `sintese-semanal`, referenciam a `regua-decisao` em vez de
  copiar a regra.
- `saude-do-funil`: linha P/V (visualizações de conteúdo ÷ visualizações da página de destino),
  rotulada como heurística.
- Skill nova de revisão de arte (hoje fora do pacote público): validação técnica determinística
  de um arquivo contra o perfil de plataforma do workspace, mais crítica adversarial, com veredito
  e ação por achado. Dependência pip documentada, com bootstrap de venv na skill; o plugin não
  instala nada. Endurecida pela revisão adversarial.
- Skill nova de sugestão de arte (hoje fora do pacote público): cerca de 10 ideias por segmento a
  partir do relatório do `analisar-produto`, ranqueadas por evidência, com ficha que vira linha no
  registry.
- `analisar-produto`: saídas `lacunas` (combinação de eixos com poucos itens) e `reestetica` (bom
  clique, compra fraca), com parâmetros nomeados; CSV inalterado.
- `auditoria-cro`: modos `proprio` e `concorrente`, capacidades do painel e decisões vigentes do
  workspace (achado decidido ou travado vira nota de 1 linha), estado do achado entre rodadas,
  celular a 390 px primeiro e checklist operacional de loja, com os itens do adendo: margem
  por pedido com a oferta em vigor (heurística de mercado de 10/15/20%, com o CAC real do
  período), descontos progressivo, Pix e cupom sem empilhar, ordem das opções de frete pela data,
  prazo de entrega por região testado no carrinho e, em site próprio, favicon, página Sobre e
  ícones de confiança.

## 1.4.1 — 2026-10-10

- `pnl-mensal`: a cascata ganha **custos fixos** depois do resultado operacional, com o aviso de que custo fixo vazio ou "a confirmar" deixa o resultado "antes de custos fixos" e nenhum mês pode ser declarado positivo sem a ressalva. Custo fixo nunca entra no CAC nem no ROAS breakeven (são marginais por pedido). Passo novo de **reconciliação plataforma × ledger** (contagens, diferença e causas possíveis, sem declarar causa sem conciliar por dia).
- `unit-economics`: item 6 calcula **pedidos por mês para cobrir os custos fixos**, sem alterar os breakevens.
- `otimizar-verba`: regra de rampa explícita (até ~20% por degrau, 3 a 7 dias entre degraus; salto acima de 20% a 30% reseta o aprendizado; conjunto novo paga aprendizado).
- `analise-diaria` e `saude-do-funil`: rotulam o número lido na plataforma como "CPA de plataforma", citam o fator ledger ÷ plataforma e não o apresentam como lucro.
- Testes de contrato novos para os quatro pontos.

## 1.4.0 — 2026-10-02

- Skill nova `analisar-produto`: qual item do catálogo vende e por que. Script Node sem dependências (`scripts/analisar-produto.mjs`) recebe o agregado por item já sem PII e entrega relatório `.md` e `.csv`: três lentes (vitrine, atenção, compra), teste de duas proporções com poder, segmento comparado dentro de cada estilo com controle de confusão (inclui a reversão do paradoxo de Simpson), junção de nomes com auditoria de colisões e lista de aproximados, concentração da vitrine e recomendações em Produzir, Investir e Rever só com evidência estatística. Segmento e estilo vêm da tabela de catálogo, nunca do ledger. Recusa entrada com PII e entrada incoerente (compras acima de views).
- Fluxo criativo: rota com `semGeracao: true` segue o caminho sem geração em qualquer arquétipo; `flagSobrescrever` (validada, checada por token) é anexada nas iterações de correção e no reuso de render existente; `args.reproduzir` e `args.headline` definem a reexecução depois de decisão humana, e a troca da headline preserva body e descrição; `headlineTravada` transforma finding de redação sobre a headline em sinalização ao humano (`sinalizacoes[]`) e proíbe a reescrita automática da copy.
- `criativo-fluxo/SKILL.md`: Catalog Sales deixa de prescrever clonagem de conjunto (cria-se do zero; clonar herda o produto promovido, imutável) e documenta como invocar o harness sem cópia quando o `scriptPath` do cache é recusado.
- `analisar-produto`: relatório ganha a seção `## Sugestão de conjunto` (só sugestão; a skill nunca cria nada). Campo opcional `conjuntos` na entrada (fornecido pelo workspace); antes de sugerir um conjunto novo, confere se um existente já cobre o item (`reusar`) e lista só `candidatas a um conjunto novo`; sem a lista, avisa que não deu para checar. stdout ganha `sugestao_conjunto`; o CSV não muda.

## 1.3.5 — 2026-09-09

- Rough e produção deixam de repetir geração por fallback ou erro. Falha, ausência de saída ou resposta parcial encerram para reconciliação, preservando parciais; nova tentativa depende de decisão humana e orçamento. Fallbacks sem geração continuam disponíveis.

## 1.3.4 — 2026-09-08

- Preflight com falha operacional de script encerra o fluxo com erro e preserva o diagnóstico, inclusive sem artefato. Falhas visuais continuam pelo ciclo de correção.

## 1.3.3 — 2026-09-05 (preparação para teste Claude)

- Corrigido YAML de metadados detectado por `claude plugin validate`: campos com colchetes ou dois-pontos passam a ser strings entre aspas.
- Preflight somente leitura verifica os arquivos exigidos por capacidade antes de gerar criativos; contrato sintético documenta os scripts que o workspace consumidor precisa fornecer. Não valida credenciais ou qualidade visual.
- `name` explícito em todas as skills, alinhado ao diretório.

## 1.3.2 — 2026-09-02 (redação de réguas reais no histórico)

Patch de higiene, achado da auditoria adversarial de 2026-09-01: a entrada 1.0.0 deste
arquivo e um comentário em `tests/test_skill_contracts.py` citavam as réguas reais de CAC
de um workspace real como exemplo de hardcode inconsistente. Os números viram `R$X × R$Y`
— o exemplo continua fazendo sentido sem o dado do negócio, e o espelho público deixa de
precisar de scrub nesses dois arquivos. Sem mudança de comportamento nas skills.

## 1.3.1 — 2026-08-06 (URLs do repositório público)

Patch de metadado: `homepage`/`repository` do plugin.json apontam para o espelho
público `sallzzbr/hefesto-publico` (rename do marketplace). Sem mudança de
comportamento nas skills.

## 1.3.0 — 2026-07-31 (a sessão de operação de 30/07 vira metodologia)

Uma sessão real de operação gerou 18 aprendizados; a auditoria de cobertura mostrou que só 1
já morava no plugin. Sobe o que é metodologia; payloads de API e números do negócio ficam no
workspace, por contrato.

- **Recorte de superfície (área de leitura 1:1)**: superfícies de feed recortam formato mais
  alto que quadrado para o quadrado central — a margem se mede da BANDA, não da borda do
  quadro. Regra de composição em `direcao-de-arte` + check nomeado e bloqueante na Camada 1
  de `validar-criativo` (cálculo delegado ao pre-flight do workspace), espelhados nos agents.
  Inclui a limitação conhecida do detector: silhueta de produto sobre fundo claro é lida como
  glifo → produto recortado respeita a mesma margem do texto.
- **Produção sobre produto** (`direcao-de-arte`): fotografia de produto (recorte de
  e-commerce é catálogo, não anúncio; sombra de contato; mockup da fonte oficial; template
  único em coleção; peça escura não sobrepõe peça escura), arte sobre cena (geometria de
  aplicação é atributo do PRODUTO medido — nunca média de loja; conteúdo ≠ canvas: bbox antes
  de escalar; textura modulada por luminância suavizada; posição medida, nunca estimada),
  quadro montado vence cena recortada, e portfólio sem argumento repetido.
- **Cláusula de inferência** (bloqueante) nos 3 pontos onde medição vira regra — promoção de
  aprendizado do `criativo-fluxo`, prancheta da `direcao-de-arte`, registro da
  `sintese-semanal`: (1) quantos casos, com que variância? (2) a amostra cobre as variantes
  relevantes? (3) qual contra-exemplo barato refutaria — foi checado? Sem as três respostas,
  a medição entra como observação, não como regra. Travada por teste de contrato.
- **Boost fora da régua** nas 5 skills analíticas (`analise-diaria`, `saude-do-funil`,
  `otimizar-verba`, `pnl-mensal`, `analisar-criativos`): tráfego que não otimiza por
  conversão sai de CPA/ROAS/CTR e de qualquer veredito, identificado por `optimization_goal`
  (nunca pelo nome da entidade); o gasto real sobrevive em linha própria, rotulada. Teste de
  contrato novo.
- **Janela de leitura**: métrica acumulada do período (ex.: frequência MTD) cresce por
  definição e nunca é proxy de diária — fadiga só em janelas iguais e adjacentes
  (`fadiga-criativa`, `analise-diaria`). E pós-ativação em lote, conferência NOMINAL do que
  voltou a ACTIVE — lote ressuscita pausado de propósito (`analise-diaria`).
- **Estrutura**: conjunto nasce com ≥2 anúncios, e o trade-off explícito "anúncio novo em
  conjunto compatível × conjunto novo" — reset de learning e verba total na mesa
  (`auditoria-de-estrutura`, `otimizar-verba`).
- **Voz**: travessão e meia-risca como sinal literal de "soa máquina" em copy PT-BR, e
  oferta nunca abreviada a ponto de ler como preço (`sugerir-criativos` teste 2, critérios
  G/J de `validar-criativo` e do agent validador).
- **Aviso de subida por objetivo** no pacote do `criativo-fluxo`: subida via API tem regra
  própria por objetivo (ex.: Catalog Sales exige formato de creative e clonagem de conjunto
  específicos) — o pacote aponta para o playbook do workspace; o plugin segue sem payloads.
- Higiene: README atualizado (critérios A-Q, Portão 1 na linha do fluxo), entradas 1.2.1 e
  1.2.2 restauradas ao CHANGELOG (o squash do PR #2 as tinha engolido), gate de bump do CI
  passa a cobrar entrada de CHANGELOG, e teste anti-vazamento ampliado (nomes de
  negócio/pessoa, escopo `.md`+`.mjs`, CHANGELOG na whitelist) com as limpezas
  correspondentes. 33 testes de contrato (+2).

## 1.2.2 — 2026-07-28 (agents de julgamento read-only por configuração)

Fase 2 do cerco do marketplace, na parte que toca o hermes: restrição declarada vira
restrição verificada.

- **`validador-de-criativo` ganha `disallowedTools`** (Write/Edit/NotebookEdit/Task/Agent —
  Task e Agent porque spawnar subagent é escrever por procuração): a regra "você não corrige
  nada e não escreve arquivos" era só prosa; agora é configuração honrada pelo runtime
  (verificado despachando agent restrito em sessão limpa) e travada por teste.
- **Testes de contrato novos** (`tests/test_contratos_de_agente.py`), com a lista por
  **exceção**: o teste varre `agents/` e cobra a restrição de todo agent que não esteja na
  lista de quem PRODUZ artefato — agent novo de julgamento não nasce sem restrição com a
  suíte verde. `mecanico-de-criativo`, `produtor-de-criativo` e `diretor-de-arte` mantêm
  escrita, com o porquê de cada um escrito no próprio teste (a leitura do contrato de cada
  agente decidiu, não a simetria dos nomes).
- No marketplace (fora do plugin, mas cobrando-o): **gate de bump** no CI
  (`scripts/verificar-bump.mjs`) — mudança em arquivo do plugin sem bump de versão reprova;
  `tests/` fica de fora por não ser contrato publicado.

## 1.2.1 — 2026-07-28 (categoria de headline no portão de copy)

Patch: corrige a aplicação cega do teste de **troca do termo definidor**, que reprovava
headline de afirmação direta — o formato que costuma sustentar conta de nicho. A 1.2.0
encodou os 4 testes de copy tratando toda headline como hook; são duas categorias com
funções distintas.

- **Passo 0 novo no contrato canônico** (`sugerir-criativos`): declarar a categoria da
  headline antes de testar. **Hook** (cria reconhecimento/dor/desejo) → o teste 1 VALE.
  **Afirmação direta** (diz o que é e para quem, nomeando o produto) → o teste 1 NÃO vale:
  sobreviver à troca é a função — a frase é um molde que serve a cada segmento com o termo
  trocado, e a especificidade vem da segmentação e do produto mostrado, não da frase.
- **A trava que impede a brecha:** afirmação direta tem de NOMEAR o produto. Frase que só
  convida pro clube ("se você tem um X, você entende") não nomeia nada — continua sendo hook
  e continua reprovada, que era o caso que originou a 1.2.0.
- Propagado nos cinco pontos que cobram os testes (versão divergente é bug, não variação
  local): o contrato em `sugerir-criativos`, o Portão 1 em `portao-de-ideia`, o critério Q de
  `validar-criativo`, o agent `validador-de-criativo` e o agent `diretor-de-arte`.
  `evoluir-vencedor` passa a declarar a categoria junto da hipótese.

> **Compatibilidade:** sem mudança de contrato de entrada nem de saída das skills — quem já
> usa a 1.2.0 não precisa mudar nada.

## 1.2.0 — 2026-07-27 (o estúdio passa a ter critério de ideia, não só de acabamento)

Causa raiz: os criativos nasciam do **template** com uma frase encaixada dentro, e os
validadores mediam só acabamento (contraste, zona segura, fidelidade tipográfica). Uma peça
cuja headline sobrevivia à troca do termo definidor passava com todos os checks verdes. O
fluxo não tinha, em ponto nenhum, um critério de **ideia**.

- **Portão 1 — ideia** (novo, bloqueante, em `criativo-fluxo`): gate de **texto puro** antes
  de qualquer chamada de API de imagem, com 8 campos (objetivo, estágio do funil, observação
  humana, headline, produto exibido, hierarquia de leitura, esboço textual da composição,
  justificativa por elemento). Contrato completo em
  `criativo-fluxo/references/portao-de-ideia.md`; artefato `<stem>__ideia.md`. O portão visual
  dos roughs continua existindo e vira **Portão 2** — são dois portões distintos, e rough não
  aprova ideia.
- **Rede de segurança no harness**: o *briefing interrogado* do diretor passa a recusar
  (`bloqueado`, antes de gerar qualquer rough, custo zero) o brief que chega sem observação
  humana, sem headline aprovada nos 4 testes ou sem hierarquia de leitura. Vale também no
  caminho avulso da `direcao-de-arte`.
- **4 testes de copy** obrigatórios em `sugerir-criativos` (contrato canônico) e cobrados em
  `evoluir-vencedor`, no Portão 1 e na validação: troca do termo definidor · fala humana ·
  "e daí?" · verdade comercial. Regra central: headline que cria **cumplicidade sem entregar
  verdade específica** é reprovada. Em `evoluir-vencedor`, a headline do vencedor deixa de ser
  herança automática — performance valida a peça, não a frase.
- **Hierarquia semântica** em `direcao-de-arte` e no agent `diretor-de-arte`: a maior
  informação da peça carrega o principal significado (proibido ampliar expressão vazia), teto
  de elementos por peça (1 headline + 1 linha complementar + produto + 1 oferta/CTA +
  assinatura), painel opaco grande proibido como estrutura automática, e 4 alternativas
  legítimas de contraste (caixa ajustada, gradiente localizado, área negativa, card pequeno).
- **6 testes pós-render** como critérios de primeira classe em `validar-criativo` e no agent
  `validador-de-criativo` (K-Q): 3 segundos, miniatura, desfoque, exclusão, coerência
  imagem-copy, verdade comercial, mais a headline. **Ausência de erro técnico não aprova
  peça**: peça tecnicamente impecável e semanticamente vazia é reprovada.

> **Compatibilidade:** brief que passava na 1.1.x pode ser recusado agora no briefing
> interrogado se não trouxer observação humana, headline aprovada nos 4 testes e hierarquia de
> leitura. É o contrato funcionando, não falha de infraestrutura — nenhuma API de imagem é
> gasta na recusa. Correção: rodar o Portão 1 e consolidar os 8 campos no brief.

## 1.1.2 — 2026-07-27 (padronização da regra de paths)

- As skills passam a citar a cadeia completa de quatro níveis (`CLAUDE.md` do workspace →
  defaults `local_*` → convenção descoberta no cwd → default documentado) e a chamar os
  paths literais de ilustrativos **do default**, não da convenção — o texto abreviado
  contradizia a referência canônica que ele mesmo aponta.
- O README do plugin declara a delegação à regra única, agora que o validador o cobre.

> **Compatibilidade da 1.1.1:** o campo de segmento virou obrigatório nas rotas do
> `ROTAS_SCHEMA`, e o portão do estágio `produzir` recusa rota aprovada sem ele. Artefato
> `__rotas.md` gerado antes da 1.1.1 não tem o campo e será bloqueado com `status: erro` na
> fase Portão — isso é o contrato funcionando, não falha de infraestrutura. Correção:
> acrescentar o segmento à rota aprovada no artefato (o valor é o segmento temático usado na
> subpasta de renders) e reinvocar.

## 1.1.1 — 2026-07-27 (correções pós-review da Fase 8)

- `analise-diaria` volta a cobrir o modo snapshot absorvido de `/meta-snapshot`: períodos
  válidos, consolidação `level=account`, top 5 `level=campaign`, gasto mínimo configurável,
  separação de dados insuficientes e relatório persistido. Erros de permissão deixam de
  trocar silenciosamente o período pedido.
- O harness fecha o contrato entre a chave histórica de segmento e o segmento temático genérico:
  o diretor a preenche por rota e o portão recusa resposta aprovada sem o valor.
- A regra única de paths passa a exigir os quatro níveis por arquivo, com descoberta
  determinística no cwd e delegação explícita a referências canônicas.

## 1.1.0 — 2026-07-27 (Fase 8: paths resolvidos + rituais promovidos do workspace)

- **Regra única de resolução de paths**: os diretórios-base (`marketing/`, `branding/`,
  `contexto/`, `financeiro/`, `scripts/`) deixam de ser hardcode — resolvem por
  CLAUDE.md do workspace (`## Paths do workspace`) → defaults do usuário (`local_*`) →
  convenção do cwd. Campos novos no contrato de defaults; toda skill carrega a cláusula
  ("exemplos são ilustrativos da convenção").
- **Harness recebe paths prontos**: arg opcional `dirs` no `criativo.mjs` (mesmo padrão do
  `tiering`) — a skill resolve, o harness nunca lê config. Prompts internos usam as bases
  injetadas; ausência = convenção canônica (retrocompatível).
- **4 skills novas (rituais promovidos do workspace hermes)**: `analise-diaria` (portfólio
  3 níveis, série dia-a-dia, réguas por lookup, veredito fechado), `saude-do-funil`
  (topo/meio/fundo com benchmark citado), `sintese-semanal` (3 ações ranqueadas com
  número-prova) e `diagnostico-site-funil` (SITE × ANÚNCIO × DESTINO + alavancas de AOV).
  Tudo genérico: zero ID de conta, zero número decorado — réguas sempre por lookup do
  unit-economics vigente.
- Suposição de domínio de nicho removida do agent `diretor-de-arte` (vira `<segmento>`
  definido pelo workspace).

## 1.0.1 — 2026-07-26 (endurecimento pós-revisão adversarial dupla: Opus 5 + Codex)

Findings adjudicados de dois revisores externos independentes (espelho do odin 2.3.1).
Bloqueantes corrigidos no harness `criativo.mjs`:

- **Pre-flight fail-closed de verdade**: `pf.ok` agora é lido — exit ≠ 0 sem falha nomeada
  (crash do script ≠ reprovação) aborta o run reinvocável em vez de fechar verde sem checks.
- **Portão do estágio B endurecido**: `renderJaExiste`/`reproduzir`/`roughExiste` viram
  `required` no schema (omissão não anula mais a proteção de sobrescrita) e `portao.rota` é
  guardado antes do deref (resposta parcial não mata mais o run sem relatório).
- **Recusa de brief é resposta conforme**: `ROTAS_SCHEMA` exige só `ok` — brief vago volta
  como `bloqueado` com o que falta, não como falso erro de infra; ok=true incompleto vira
  erro nomeado.
- **"Zero API em texto" em código**: finding com custo `ia` em arquétipo `texto` é coergido
  a overlay (registrado no histórico) + belt no bloco de geração — nunca mais geração com
  prompt `null`.
- **`{{BASE}}` substituído em código**: o comando de overlay carrega o placeholder (validado
  no portão; exigido do diretor e da correção) e o harness troca pelo candidato selecionado —
  o mecânico nunca mais recebe pedido em prosa pra editar comando.

Enforcement adicional: aprovação de rota é VISUAL em código (rota aprovada sem rough no
disco = bloqueado); escalado de meio de loop com iteração no histórico passa pelo pacote
(reports SEMPRE) via `escaladoComPacote`; correção no-op escala em vez de queimar teto;
`criterio` do crit virou **enum** no schema; relatório de modelos passa a registrar a
execução real por step (fallback tardio não re-rotula step que já rodou); texto livre em
comando de shell ganhou escape; teto de rodadas de IA documentado como derivado do teto de
iterações no default. SKILL.md traduz TODOS os campos dos defaults (`criativo_produtor`,
`criativo_perfil` e os overrides por step estavam órfãos) e corrige a contagem de agentes e
o afunilamento N-1 no plano de custo. +5 testes de contrato (23 no total) fixando cada fix.

No workspace hermes (commit próprio): réguas hardcoded removidas dos commands vivos
(lookup obrigatório do unit-economics), `docs/guia-de-uso.md` e `docs/arquitetura.md`
reescritos pro modelo 9 commands + plugin, e varredura das referências mortas aos 14
commands removidos (READMEs de pasta, meta-ads, estratégia, brief ativo).

## 1.0.0 — 2026-07-25 (Fase 7 do megaplano)

Plugin novo, com a metodologia generalizável do diagnóstico da geração criativa
(`docs/superpowers/specs/2026-07-25-hermes-fase7-diagnostico-e-design.md`).

- **Harness `criativo.mjs`** (skill `criativo-fluxo`), padrão odin 2.3.x / mimyr 1.1.0, em
  2 estágios com aprovação visual humana no meio:
  - Estágio A: briefing interrogado (portão de brief) → prancheta → 2-3 rotas visuais →
    1 rough barato por rota → humano escolhe VENDO (não lendo direção abstrata).
  - Estágio B: portão de `rota_aprovada` em código (sem API de imagem com portão aberto) →
    N candidatos em paralelo (correção da geração de amostra única) → seleção pelo validador
    contra a baseline → composição → pre-flight → crítica adversarial fail-closed →
    confirmação de finding plausível → correção pela tabela fail→ação com política de custo
    em código (overlay recompõe grátis; IA re-gera, teto de rodadas) → pacote com rationale
    e reports gravados SEMPRE.
  - Teto de 3 iterações e 3 rodadas de IA em código; tiering por step com whitelist,
    recusas registradas, fallbacks com desliga-pelo-run (fable→opus, promoção→piso,
    haiku→sonnet); relatório com modelos efetivos em todo desfecho.
- **4 agents de papel fixo**: `diretor-de-arte` (piso opus, promoção fable default —
  espelho do arquiteto do odin), `produtor-de-criativo` (sonnet), `validador-de-criativo`
  (opus), `mecanico-de-criativo` (haiku, só steps whitelisted).
- **Validador endurecido** (correção do diagnóstico "22 validações, 0 fail"): postura de
  refutar, critérios novos bloqueantes G `texto_correto` (concordância/ortografia — caso
  "CHEGAM"), H `legibilidade_thumbnail` (squint test), I `mensagem_completa` (oferta/prazo/
  CTA), J `voz_da_marca` (copy vs tom de voz — antes ninguém validava copy); D
  `fidelidade_referencia` vira bloqueante com baseline; **qualquer bloqueante = fail** (fim
  do "1 fail = borderline").
- **12 skills**: 6 do fluxo criativo (`criativo-fluxo`, `direcao-de-arte`,
  `sugerir-criativos`, `validar-criativo`, `evoluir-vencedor`, `analisar-criativos`) + 6
  analíticas (`unit-economics` com cenários de verba, `pnl-mensal`, `fadiga-criativa`,
  `otimizar-verba`, `auditoria-de-estrutura`, `auditoria-cro`). Réguas de decisão viram
  **lookup do unit-economics mais recente** (mata os hardcodes inconsistentes R$X × R$Y
  do workspace).
- **Testes de contrato** em `tests/` (harness, agents, skills, portabilidade, versões).
- Sem dependência do bragir (deliberado — voz da marca ≠ voz pessoal; documentado no README).
