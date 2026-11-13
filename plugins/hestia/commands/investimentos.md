---
description: Analisa os investimentos — visão da carteira, proventos e rendimento, evolução do patrimônio e acompanhamento das metas. Só leitura.
argument-hint: "[foco opcional] ex.: \"proventos do semestre\", \"evolução\", \"metas\""
---

Analisar os investimentos usando a skill `analisar-investimentos`.

Foco (opcional, padrão = análise completa): $ARGUMENTS

1. Use a skill `analisar-investimentos` (100% leitura; escrever é com `/hestia:carteira` e
   `/hestia:meta`).
2. Leia a pasta de investimentos resolvida pela skill (carteira, movimentos, snapshots, metas), degradando com
   aviso quando a base for curta (2+ snapshots para evolução; 3+ meses para ritmo de meta).
3. Produza, com números na frente e em BRL: visão da carteira (alocação por classe, vencimentos,
   posições desatualizadas), extrato de proventos & rendimento (separando aporte de rendimento),
   evolução do patrimônio e o acompanhamento de cada meta (progresso, ritmo real vs planejado,
   projeção honesta de chegada).
4. Respeite o guardrail: opinião só se o usuário pedir explicitamente, só sobre alocação entre
   classes, com o disclaimer "não é assessoria; a decisão é sua".
