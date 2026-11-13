---
name: investimentos
description: Use quando o usuário quiser registrar movimentos, atualizar posições por extrato ou imagem da corretora, gerenciar ativos ou criar e editar metas de investimento.
---

# Investimentos

Na primeira utilização, leia `../../RUNTIME.md`,
`../../shared/skills/investimentos/CONTRATO.md` e `../../shared/skills/orcamento/references/defaults.md`. Este
entrypoint e o runtime prevalecem para paths, ferramentas e autorização.

## Fluxo nativo

1. Resolva a subpasta `investimentos/` e valide os cabeçalhos de carteira, movimentos, snapshots
   e metas antes de propor alteração.
2. Extraia apenas fatos visíveis nos documentos do usuário. Para posições, materialize os dados
   e execute `python3 -B ../../shared/scripts/posicoes.py` conforme o contrato; não calcule variação
   de cabeça.
3. Monte o lote completo com antes/depois: movimentos são append-only, carteira guarda estado
   atual, snapshots preservam histórico e metas são declarações do usuário. O espelho de aporte
   no livro do orçamento é despesa na categoria `Investimentos`: o resumo o mostra como investido
   no mês, fora das despesas e da análise de gastos, e o conta como poupança. O espelho de
   resgate é receita nessa categoria: o resumo o mostra como resgatado no mês, fora das receitas
   e da taxa, e o soma no saldo em caixa. Provento não usa esse espelho.
4. Mostre o lote e grave somente depois do ok (seção abaixo). Releia os alvos imediatamente
   antes da gravação; depois, releia e confronte com o resultado esperado. Retorno incerto exige
   reconciliação, nunca repetição cega.

## Confirmação antes de gravar

O pedido de lançar, registrar ou atualizar não autoriza a escrita. Antes de cada gravação no
Drive, mostre a linha ou o lote final exato (arquivo de destino, linhas em CSV cru e, na edição,
o antes/depois) e espere o ok do usuário, como no contrato. A única exceção é o usuário dizer
explicitamente, nesta sessão, que pode gravar sem mostrar. Esta regra prevalece sobre o
reaproveitamento de autorização do runtime.

Sem escrita do conector, entregue o lote pronto e bloqueie a mutação. Não invente operação de
Drive. Nunca recomende ativo, corretora, compra ou venda.

## Conferência de proventos históricos

Receitas antigas em `Investimentos` cuja descrição mencione dividendos, proventos, JCP, juros sobre capital, cupom ou rendimento exigem conferir a classificação com o dono. A descrição é indício, não prova: não converter automaticamente nem inferir classificação pela ausência de palavras. Os scripts de resumo e análise histórica retornam `conferencia.estado: classificacao_pendente`, lançamentos identificados e `totais_provisorios: true` nesses casos. Os cálculos preservam as categorias originais; não apresentar totais, taxa de poupança ou comparação entre meses como conferidos enquanto houver pendência, inclusive no mês anterior.

Mostrar o lançamento e perguntar uma classificação por vez, encerrando o turno: resgate do patrimônio ou provento recebido? Reaproveitar resposta já dada para o mesmo lançamento. Resgate permanece transferência; provento recebido entra como receita em outra categoria escolhida pelo dono. Apresentar a correção exata e obter autorização antes de escrever, preservando histórico e evitando duplicação; não alterar planilha nem CSV automaticamente. Recalcular após correção autorizada. Se o dono confirmar resgate, registrar essa decisão na conversa/relatório sem falsificar o dado de origem; o detector pode continuar emitindo o indício, que deve ser confrontado com a confirmação registrada. Ausência de alerta não comprova revisão de todo o histórico.
