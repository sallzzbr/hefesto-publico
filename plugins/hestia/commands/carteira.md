---
description: Registra movimentos de investimento (aporte/resgate/provento), atualiza posições com print da corretora e gerencia os ativos da carteira.
argument-hint: "[movimento ou print] ex.: \"aportei 2000 no CDB do Banco X\", \"caiu 87,50 de dividendo do IVVB11\" — ou anexe o print"
---

Gerenciar a carteira de investimentos usando a skill `investimentos`.

Pedido (ditado, print anexo ou vazio — aí pergunte): $ARGUMENTS

1. Use a skill `investimentos`: fluxo "Registrar movimento" (aporte/resgate/provento), "Atualizar
   posições" (print da corretora → antes/depois → uma confirmação, reescreve carteira.csv +
   apenda snapshots.csv) ou "Gerenciar carteira" (cadastrar/editar/encerrar ativo), conforme o
   pedido.
2. Dados na pasta de investimentos resolvida pela skill. Extração de print nunca inventa — campo ilegível se
   pergunta; posição sumida do print se pergunta, nunca se apaga sozinha.
3. Aporte/resgate: ofereça o lançamento espelho no livro do orçamento (categoria Investimentos),
   explicando que é transferência de patrimônio, sem duplicar.
4. Respeite o guardrail de investimentos da skill (nunca recomendar ativo, nunca compre/venda).
