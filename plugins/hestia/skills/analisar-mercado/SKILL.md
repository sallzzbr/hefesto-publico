---
description: Use quando o usuário quiser entender as compras de mercado — "analisar meu mercado", "o preço do café subiu?", "estou comprando demais?", evolução de preço por produto/marca, desvio de quantidade por semana, ou "onde está mais barato" (pesquisa de preço online na Amazon, Mercado Livre e mercados da região). Análise 100% de leitura sobre a pasta de mercado do hestia no Google Drive (configurável por workspace/defaults); para registrar notas e catálogo, use a skill mercado.
---

# Analisar Mercado

Esta skill lê o histórico de itens de supermercado e devolve **entendimento**: como os preços que
você paga evoluem, quando a quantidade comprada foge do teu padrão, e — sob demanda — como o teu
preço se compara ao online. Descreve com números; não prescreve cortes.

## Regras invioláveis

1. **100% leitura.** Nunca cria, edita ou apaga itens ou catálogo. Única escrita possível: salvar
   um relatório em arquivo SEPARADO (ex.: `Financas/hestia/mercado/analise-2026-07.md`), só com
   confirmação explícita.
2. **Dados via conector do Google Drive**, pela subpasta `mercado/` da pasta-base resolvida
   (regra única em `${CLAUDE_PLUGIN_ROOT}/skills/orcamento/references/defaults.md`: workspace →
   defaults do usuário → default `Financas/hestia/`; caminho, nunca ID — exemplos citam o
   default ilustrativamente). Conector indisponível → PARE e peça para conectar; nunca invente
   números.
3. **Números na frente das frases**, tudo em BRL. "Leite subiu 8,9%" com os valores ao lado, não
   "leite subiu bastante".
4. **Descrever, não prescrever.** Padrões e diferenças, sim; ordem de cortar, não. Sem conselho
   financeiro.

## Base de leitura

- `AAAA-MM-itens.csv` (itens por mês) e `produtos.csv` (catálogo) — contratos definidos na skill
  `mercado`.
- Janela default: **últimos 3 meses** (ou o período pedido). Degradação com aviso:
  - comparação de preço de um item pede **2+ compras** dele;
  - média/desvio de quantidade pede **3+ semanas** com o item;
  - item registrado sem quantidade (só total) fica fora das comparações de unitário — diga
    quantos itens estão nessa situação.
- Preço unitário comparável = valor na `unidade_base` do catálogo (R$/kg, R$/l, R$/un),
  convertendo `g→kg` e `ml→l` quando preciso.
- Arquivos ausentes → explique que ainda não há notas registradas e aponte `/hestia:nota`.

## O preço comparável sai de SCRIPT

**Não converta unidade de cabeça.** Comparar R$/un com R$/kg dá conclusão invertida sobre qual
marca é mais barata — é o erro que este script existe para impedir:

```bash
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/mercado.py \
  --itens <AAAA-MM-itens.csv> --catalogo <produtos.csv> [--inicio ...] [--fim ...]
```

Ele converte para a `unidade_base` do catálogo (`g→kg`, `ml→l`), calcula evolução por produto e
marca a quantidade acima de **média + 1 desvio amostral**. Três recusas que você deve narrar em
vez de contornar: item **fora do catálogo** não é comparado (sem `unidade_base` não há preço
comparável), item com **menos de 3 compras** não ganha desvio, e **unidade sem conversão
conhecida** para o script com erro.

## Análise (`/hestia:mercado`)

Monte nesta ordem (pule seção sem base, dizendo o porquê):

1. **Preço: evolução por produto** — preço unitário ao longo das compras:
   "Leite Itambé: R$ 4,89/l nesta compra, R$ 4,49/l há 3 semanas (+8,9%)".
   Dentro de um mesmo `tipo`, compare marcas pelo histórico:
   "café: Pilão R$ 43,60/kg vs Melitta R$ 39,80/kg no que você pagou".
   Destaque as maiores altas e quedas da janela.
2. **Quantidade: desvio do padrão** — por semana (ISO) ou por compra, item/tipo com quantidade
   acima da média + 1 desvio do histórico: "essa semana foram 6 un de cerveja; tua média é
   3,2 ± 1,1 por semana". Aponte também ausências notáveis (item recorrente que não veio no
   período) — pode ser estoque em casa, não economia; diga isso.
3. **Visão do mês** — gasto de mercado por categoria e por `tipo`, os 5 itens que mais pesaram,
   itens novos no catálogo, comparação com o mês anterior.
4. **Fecho** — 2–3 frases do que mais merece atenção, em tom de observação ("o café responde por
   quase metade da alta do mês"), nunca de ordem.

## Pesquisa de preço online (`/hestia:preco`, sob demanda)

1. Receba o produto (canônico do catálogo ou um `tipo`). Se não souber a **cidade/região** do
   usuário nesta conversa, pergunte antes de buscar "mercados da região".
2. Pesquise na web: Amazon, Mercado Livre e mercados/atacados da região do usuário.
3. Compare lado a lado com o que o usuário pagou (histórico dos itens):
   > Você pagou **R$ 18,90** no Arroz Camil 5kg em 12/07 (Pão de Açúcar).
   > Online hoje (consulta de 23/07): Amazon **R$ 17,50** · Mercado Livre **R$ 16,90 + frete** ·
   > Atacadão (site) **R$ 16,49**.
4. Guardrails:
   - **sempre** cite a fonte e a data da consulta;
   - avise que preço online muda rápido e pode não incluir frete, promoções locais ou exigir
     quantidade mínima;
   - nunca afirme "está mais barato em X" sem os números lado a lado;
   - resultado inexistente ou não confiável → diga que não achou; **não estime**.

## Evolução futura (registrada, fora do escopo atual)

Lista de compras sugerida a partir do padrão (itens recorrentes + preços de referência) — quando
houver meses de histórico acumulados; sempre sugestão, nunca automação de compra.
