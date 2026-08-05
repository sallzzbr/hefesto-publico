---
description: Analisa as compras de mercado — evolução de preço unitário por produto/marca, quantidades fora do teu padrão semanal, visão do mês. Só leitura.
argument-hint: "[período ou produto opcional] ex.: \"julho\", \"últimos 2 meses\", \"café\""
---

Analisar as compras de mercado usando a skill `analisar-mercado`.

Período ou produto (opcional, padrão = últimos 3 meses): $ARGUMENTS

1. Use a skill `analisar-mercado`, seção "Análise".
2. Leia `AAAA-MM-itens.csv` + `produtos.csv`, na pasta de mercado resolvida pela skill, na janela pedida, degradando
   com aviso se a base for curta (2+ compras por item para preço; 3+ semanas para média/desvio).
3. Produza, com números na frente e em BRL: evolução de preço unitário (por produto e entre
   marcas do mesmo tipo), desvios de quantidade vs teu padrão semanal, visão do mês (categorias,
   top 5, itens novos).
4. Feche com 2–3 frases de observação — sem prescrever cortes.
