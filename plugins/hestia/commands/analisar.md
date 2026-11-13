---
description: Analisa o histórico de gastos — evolução por categoria, médias, variações fora do padrão, recorrências × realidade. Só leitura; descreve padrões, não prescreve cortes.
argument-hint: "[período opcional] ex.: 2026-05, \"últimos 3 meses\" (padrão: últimos 6 meses)"
---

Analisar os gastos do orçamento doméstico usando a skill `analisar-gastos`.

Período (opcional, padrão = últimos 6 meses): $ARGUMENTS

1. Use a skill `analisar-gastos` (100% leitura; a skill `orcamento` é só para lançar/abrir/fechar).
2. Leia os livros mensais da pasta de orçamento resolvida pela skill na janela pedida, degradando com aviso
   se a base for curta (comparação pede 2+ meses; média/desvio, 3+).
3. Produza, em BRL e com números na frente: visão do mês (poupança do mês e taxa de poupança,
   com o aporte contado como poupança e o resgate fora das receitas; investido no mês, resgatado
   no mês e saldo em caixa em linhas próprias), evolução por categoria, variações fora do padrão
   (média + desvio ou >30% da média), maiores mudanças mês a mês e recorrências × realidade (se
   houver cadastro). A comparação com o mês anterior é pela poupança; queda do caixa explicada
   pelo aporte maior não é piora. Aporte (`Investimentos`) não é gasto: fica fora da análise por
   categoria.
4. Feche com 2–3 frases do que mais merece atenção — observação, não ordem; nada de conselho de
   investimento.
