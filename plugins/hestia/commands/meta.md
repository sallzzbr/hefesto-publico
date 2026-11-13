---
description: Cria, edita ou conclui metas de investimento ("juntar 30 mil até jun/2027") e planeja o aporte mensal com simulação em 3 cenários.
argument-hint: "[meta] ex.: \"reserva de emergência de 30 mil até junho de 2027\", \"listar\", \"mudar o aporte da reserva pra 1000\""
---

Gerenciar metas de investimento usando as skills `investimentos` e `analisar-investimentos`.

Pedido (pode vir vazio — aí liste as metas): $ARGUMENTS

1. Use a skill `investimentos`, fluxo "Gerenciar metas" — o cadastro vive em
   `metas.csv`, na pasta de investimentos resolvida pela skill
   (`meta;valor_alvo;data_alvo;aporte_mensal_planejado;criada_em;observacao`). Toda escrita
   confirmada. Meta nunca é vinculada a ativo específico.
2. Ao criar uma meta, ofereça o planejamento: a simulação da skill `analisar-investimentos`
   calcula o aporte mensal necessário em 3 cenários (premissas explícitas, aceitas pelo usuário);
   o valor escolhido vira o `aporte_mensal_planejado`.
3. Para acompanhamento (progresso, ritmo, projeção de chegada), aponte `/hestia:investimentos`.
