---
name: analisar-gastos
description: Use quando o usuário quiser entender gastos ao longo do tempo, comparar meses e categorias, detectar variações fora do padrão ou confrontar recorrências com o realizado.
---

# Analisar Gastos

Na primeira utilização, leia `../../RUNTIME.md`,
`../../shared/skills/analisar-gastos/CONTRATO.md` e, para a pasta de dados,
`../../shared/skills/orcamento/references/defaults.md`. Este entrypoint e o runtime prevalecem
para paths, ferramentas e autorização.

## Fluxo nativo

1. Resolva a base do Hestia e leia os livros do período e `recorrencias.csv` quando existir. Sem
   leitura do Drive, informe o bloqueio e peça conexão; não invente números.
2. Materialize cópias temporárias fora do pacote e execute:
   `python3 -B ../../shared/scripts/gastos.py --livros <arquivos...> [--mes AAAA-MM] [--recorrencias <arquivo>]`.
3. Narre o JSON, inclusive `criterios`, `simplificacoes`, `secoes_puladas`, categorias novas e
   base esparsa. Não refaça somas, médias ou desvios mentalmente.
4. Apresente visão do mês, evolução, variações, mudanças mês a mês e recorrências versus realidade
   na ordem e com os limiares do contrato. Descreva; não prescreva cortes. Aporte (despesa na
   categoria `Investimentos`) não é gasto: fica fora da análise por categoria e aparece em
   `investido_no_mes` e `aportes_por_mes`. Resgate (receita nessa categoria) não é renda: fica
   fora das receitas e da taxa e aparece em `resgatado_no_mes` e `resgates_por_mes`.
5. Na comparação com o mês anterior, o saldo do exemplo do contrato ("saldo R$ X, R$ Y acima de
   maio") é a poupança do mês: `poupanca_do_mes` e `poupanca_delta`, com
   `taxa_de_poupanca_anterior_pct` ou o motivo da ausência. O saldo em caixa vai em linha à
   parte: queda do caixa explicada por `investido_delta` não é piora, e alta explicada por
   `resgatado_delta` não é melhora.

## Confirmação antes de gravar

Esta skill é leitura. O pedido de análise não autoriza a escrita de relatório: antes de salvar
um relatório em arquivo separado, mostre o caminho e o conteúdo e espere o ok do usuário. A
única exceção é o usuário dizer explicitamente, nesta sessão, que pode gravar sem mostrar. Esta
regra prevalece sobre o reaproveitamento de autorização do runtime.

Dados ficam no Drive/workspace, nunca no cache.

## Conferência de proventos históricos

Receitas antigas em `Investimentos` cuja descrição mencione dividendos, proventos, JCP, juros sobre capital, cupom ou rendimento exigem conferir a classificação com o dono. A descrição é indício, não prova: não converter automaticamente nem inferir classificação pela ausência de palavras. Os scripts de resumo e análise histórica retornam `conferencia.estado: classificacao_pendente`, lançamentos identificados e `totais_provisorios: true` nesses casos. Os cálculos preservam as categorias originais; não apresentar totais, taxa de poupança ou comparação entre meses como conferidos enquanto houver pendência, inclusive no mês anterior.

Mostrar o lançamento e perguntar uma classificação por vez, encerrando o turno: resgate do patrimônio ou provento recebido? Reaproveitar resposta já dada para o mesmo lançamento. Resgate permanece transferência; provento recebido entra como receita em outra categoria escolhida pelo dono. Apresentar a correção exata e obter autorização antes de escrever, preservando histórico e evitando duplicação; não alterar planilha nem CSV automaticamente. Recalcular após correção autorizada. Se o dono confirmar resgate, registrar essa decisão na conversa/relatório sem falsificar o dado de origem; o detector pode continuar emitindo o indício, que deve ser confrontado com a confirmação registrada. Ausência de alerta não comprova revisão de todo o histórico.
