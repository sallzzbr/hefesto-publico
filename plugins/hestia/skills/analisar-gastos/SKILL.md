---
description: Use quando o usuário quiser entender os próprios gastos ao longo do tempo — "analisar meus gastos", "como estão meus gastos", "onde estou gastando mais", evolução por categoria, comparação entre meses, variações fora do padrão, ou conferir se as recorrências bateram com a realidade. Análise 100% de leitura sobre os CSVs de orçamento do hestia no Google Drive (pasta configurável por workspace/defaults); para lançar/abrir/fechar o mês, use a skill orcamento.
---

# Analisar Gastos

Esta skill lê o histórico do orçamento doméstico e devolve **entendimento**: evolução, médias,
variações fora do padrão e divergências entre o planejado e o real. Ela existe para a fase
"entender antes de controlar" — descreve padrões com números; não impõe limites nem prescreve
cortes.

## Regras invioláveis

1. **100% leitura.** Esta skill nunca cria, edita ou apaga lançamentos, cadastros ou arquivos.
   A única escrita possível é salvar um relatório em arquivo SEPARADO (ex.:
   `Financas/hestia/orcamento/analise-2026-06.md`), e só com confirmação explícita do usuário.
2. **Dados via conector do Google Drive**, pela subpasta `orcamento/` da pasta-base resolvida
   (regra única em `${CLAUDE_PLUGIN_ROOT}/skills/orcamento/references/defaults.md`: workspace →
   defaults do usuário → default `Financas/hestia/`; caminho, nunca ID — exemplos citam o
   default ilustrativamente). Conector indisponível → PARE e peça para conectar; nunca invente
   números.
3. **Números na frente das frases.** "Alimentação está 32% acima da tua média de 6 meses", não
   "Alimentação subiu bastante". Tudo em BRL (`R$ 1.234,56`).
4. **Descrever, não prescrever.** A skill aponta padrões e diferenças; a decisão de cortar,
   remanejar ou manter é do usuário. Não é aconselhamento financeiro nem de investimento.

## Base de leitura

- Livros mensais `AAAA-MM.csv` (formato `data;tipo;categoria;descricao;valor;metodo`; arquivos
  no cabeçalho antigo, sem `tipo`, são lidos como só-despesas). Aplique o mesmo fallback de
  leitura do caminho legado da skill `orcamento` (`local_dados_legado`, default
  `Financas/economia-domestica/budget/`), avisando quando usar.
- `recorrencias.csv` (cadastro), quando existir.
- Janela default: o mês analisado **mais os 6 meses anteriores** (ou o período que o usuário
  pedir). A média histórica é a **dos meses anteriores** — o mês analisado não entra na base
  contra a qual ele é medido, por isso "média de 6 meses" quer dizer os 6 que vieram antes.
  Use o que existir:
  - 1 mês de dados → só a visão do mês; diga que comparação precisa de pelo menos 2.
  - 2 meses → variações mês a mês, sem média histórica.
  - 3+ meses → média e desvio entram.
  Nunca fabrique média de base curta sem dizer o tamanho da base ("média de 2 meses").

## As contas saem de SCRIPT

**Não some, não tire média e não calcule desvio de cabeça.** Todas as cinco seções abaixo vêm
prontas daqui — a tua parte é narrar, não recalcular:

```bash
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/gastos.py \
  --livros <AAAA-MM.csv> [<AAAA-MM.csv> ...] [--mes AAAA-MM] [--recorrencias recorrencias.csv]
```

Passe **um caminho por mês da janela**; o mês de cada lançamento sai do campo `data`, não do nome
do arquivo. Sem `--mes`, analisa o mais recente. O JSON traz `criterios` e `simplificacoes`: leia
antes de escrever a frase, porque é lá que está o que o número quer dizer.

Quatro recusas e omissões que você **narra em vez de contornar**:

- **`--mes` sem lançamento** para com erro. Não analise um mês vazio "aproximando" pelo anterior.
- **Seção sem base** vem `null` com o motivo em `secoes_puladas` — repasse o motivo ao usuário
  (é a degradação da seção anterior), nunca preencha a seção por conta própria.
- **Categoria nova no mês** sai em `categorias_novas_no_mes`, fora das variações: sem gasto na
  base não existe "X% acima da média", e afirmar um percentual ali seria inventar.
- **Não existe rótulo de "limítrofe"** no JSON, de propósito. O script devolve
  `folga_sobre_o_limite` (a menor distância até um limiar atingido) e `criterios_atingidos`:
  folga pequena, ou um só critério batendo, é o caso que a seção 3 abaixo manda tratar como
  observação e não como alarme.

## Saídas

Monte a análise nesta ordem (pule seção sem base, avisando o porquê):

1. **Visão do mês** — receitas, despesas, saldo e taxa de poupança (saldo ÷ receitas; sem
   receitas no mês, diga isso e omita a taxa), comparados ao mês anterior ("saldo R$ 1.240,00,
   R$ 380,00 acima de maio").
2. **Evolução por categoria** — série dos últimos N meses por categoria de despesa, marcando a
   tendência (subindo / estável / caindo) pelo movimento dos últimos 3 meses. A régua é
   monotonicidade estrita: sobe-sobe é "subindo", desce-desce é "caindo", e qualquer
   zigue-zague é "estável" — inclusive o que termina alto. Mês sem lançamento na categoria vale
   R$ 0,00 na série e na média, para que o tamanho da base seja o mesmo em toda categoria.
3. **Variações fora do padrão** — destaque categoria cujo gasto no mês está **acima da média
   histórica + 1 desvio padrão** OU **mais de 30% acima da média**, no formato "Alimentação está
   32% acima da tua média de 6 meses (R$ 2.640,00 vs R$ 2.000,00)". Os limiares são heurística de
   apresentação — mencione casos limítrofes como observação, não alarme; use a
   `folga_sobre_o_limite` e os `criterios_atingidos` do JSON para saber o quão apertada foi a
   chamada. Categoria com `base_esparsa` (que só aparece em alguns meses da base) é observação,
   nunca alarme. Aponte também o desvio para baixo quando for notável (pode ser conta que não
   chegou, não economia).
4. **Maiores mudanças mês a mês** — as 3 categorias que mais cresceram e as que mais caíram em
   valor absoluto vs mês anterior.
5. **Recorrências × realidade** — com `recorrencias.csv` presente: recorrência cujo valor lançado
   divergiu do cadastro (assinatura que subiu de preço), e recorrência prevista que não apareceu
   no mês. O casamento é **só pelo nome na descrição**, sem o valor — de propósito, e diferente
   da checagem de "já lancei isso?" da skill `orcamento`: com o valor no casamento, a assinatura
   que subiu de preço cairia em "não apareceu" e o aumento ficaria invisível. Receita recorrente
   entra também: salário que não caiu é notícia. Sem cadastro, pule a seção avisando que não há
   recorrências cadastradas.

Feche com um resumo de 2–3 frases do que mais merece atenção — em tom de observação, não de
ordem.

## Evolução futura (registrada, fora do escopo atual)

Com meses suficientes acumulados (4+), esta skill poderá oferecer um **orçamento sugerido** por
categoria, derivado do padrão real de gastos — sempre como sugestão que o usuário aceita, ajusta
ou ignora; nunca como limite imposto ou controle automático.
