---
name: orcamento
description: Use quando o usuário quiser lançar despesa ou receita, abrir o mês, gerenciar recorrências, ver status ou fechar o orçamento doméstico em BRL.
---

# Orçamento Doméstico

Na primeira utilização, leia `../../RUNTIME.md`, `../../shared/skills/orcamento/CONTRATO.md` e
`../../shared/skills/orcamento/references/defaults.md`. Para abrir o mês, leia integralmente
`../../shared/skills/orcamento/references/abertura-mes-segura.md`. Este entrypoint e o runtime
prevalecem para paths, ferramentas e autorização.

## Fluxo nativo

1. Resolva a subpasta `orcamento/`, aplique fallback legado somente para leitura e valide os
   cabeçalhos. Dados ficam no Drive; nunca use IDs ou invente operações do conector.
2. Para lançar ou gerenciar recorrências, produza linha/antes/depois em CSV válido e BRL cru,
   mostre-a e grave somente depois do ok (seção abaixo). Releia o alvo antes de escrever e,
   depois, releia e verifique.
3. Para abrir o mês, siga o protocolo seguro: plano completo, uma autorização para o efeito total,
   journal `planejado` persistido e relido antes do primeiro efeito, lote único no livro, lote
   único nas recorrências, releitura e estados verificados. Nunca infira decremento pela mera
   presença de linha. Falha ou retorno incerto exige reconciliação pelo antes/depois e
   `operacao_id`, sem repetir escrita às cegas. Não prometa atomicidade.
4. Para listar recorrências e resumir o mês, execute `../../shared/scripts/recorrencias.py` e
   `../../shared/scripts/resumo_mes.py`. Narre o JSON; não some CSV de cabeça. Aporte (despesa
   na categoria `Investimentos`) e resgate (receita nessa categoria) são transferências, não
   gasto nem renda: narre `investido_no_mes` e `resgatado_no_mes` em linhas próprias,
   `saldo_em_caixa` (que soma o resgate e desconta o aporte) e a taxa de poupança (que conta o
   aporte como poupança e deixa o resgate fora das receitas) como o JSON devolve.
5. Status e fechamento são leitura. Fechar nunca apaga, move ou sobrescreve o livro.

## Confirmação antes de gravar

O pedido de lançar, registrar ou atualizar não autoriza a escrita. Antes de cada gravação no
Drive, mostre a linha ou o lote final exato (arquivo de destino, linhas em CSV cru e, na edição,
o antes/depois) e espere o ok do usuário, como no contrato. A única exceção é o usuário dizer
explicitamente, nesta sessão, que pode gravar sem mostrar. Esta regra prevalece sobre o
reaproveitamento de autorização do runtime.

Sem escrita disponível, entregue plano e preview completos e bloqueie somente a mutação. Não dê
conselho de investimento e nunca grave dados no cache.

## Conferência de proventos históricos

Receitas antigas em `Investimentos` cuja descrição mencione dividendos, proventos, JCP, juros sobre capital, cupom ou rendimento exigem conferir a classificação com o dono. A descrição é indício, não prova: não converter automaticamente nem inferir classificação pela ausência de palavras. Os scripts de resumo e análise histórica retornam `conferencia.estado: classificacao_pendente`, lançamentos identificados e `totais_provisorios: true` nesses casos. Os cálculos preservam as categorias originais; não apresentar totais, taxa de poupança ou comparação entre meses como conferidos enquanto houver pendência, inclusive no mês anterior.

Mostrar o lançamento e perguntar uma classificação por vez, encerrando o turno: resgate do patrimônio ou provento recebido? Reaproveitar resposta já dada para o mesmo lançamento. Resgate permanece transferência; provento recebido entra como receita em outra categoria escolhida pelo dono. Apresentar a correção exata e obter autorização antes de escrever, preservando histórico e evitando duplicação; não alterar planilha nem CSV automaticamente. Recalcular após correção autorizada. Se o dono confirmar resgate, registrar essa decisão na conversa/relatório sem falsificar o dado de origem; o detector pode continuar emitindo o indício, que deve ser confrontado com a confirmação registrada. Ausência de alerta não comprova revisão de todo o histórico.
