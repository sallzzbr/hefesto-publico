---
name: analisar-investimentos
description: Use quando o usuário quiser entender carteira, proventos, rendimento, evolução e metas, ou simular juros compostos e aporte necessário com premissas explícitas.
---

# Analisar Investimentos

Na primeira utilização, leia `../../RUNTIME.md`,
`../../shared/skills/analisar-investimentos/CONTRATO.md` e `../../shared/skills/orcamento/references/defaults.md`.
Este entrypoint e o runtime prevalecem para paths, ferramentas e autorização.

## Fluxo nativo

1. Resolva `investimentos/` e leia carteira, movimentos, snapshots e metas. Sem leitura do Drive,
   pare com instrução útil; nunca estime dados ausentes.
2. Para rendimento, metas e simulação, execute respectivamente `../../shared/scripts/rendimento.py`,
   `meta.py` e `juros_compostos.py`. Use as tabelas em `../../shared/tabelas/`. Narre recusas,
   base insuficiente, bruto/líquido e tributação exatamente como o contrato define. Rendimento usa
   somente fluxos entre os snapshots efetivos de cada ativo; fluxo na mesma data da fronteira,
   sem horário, deixa a ordem incerta e o ativo fora do cálculo. Com várias metas no cadastro,
   `--meta` não atribui fluxos: ritmo exige histórico realmente recortado e declaração
   `--movimentos-da-meta <nome>`, ou permanece indisponível sem inventar rateio.
3. Simulação exige premissas aceitas e sempre usa três cenários. Taxas são hipóteses declaradas,
   nunca previsão. Não calcule de cabeça nem contorne exit de recusa.
4. Educação, cálculo e simulação são permitidos. Opinião somente se pedida e apenas sobre
   alocação entre classes, com disclaimer. Nunca recomende ativo, corretora, compra ou venda.

Esta skill não altera dados. Salvar relatório separado segue autorização. Mudança de meta vai para
`investimentos`. Dados nunca ficam no cache.
