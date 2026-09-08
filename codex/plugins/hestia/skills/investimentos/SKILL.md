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
   e execute `python3 ../../shared/scripts/posicoes.py` conforme o contrato; não calcule variação
   de cabeça.
3. Monte o lote completo com antes/depois: movimentos são append-only, carteira guarda estado
   atual, snapshots preservam histórico e metas são declarações do usuário.
4. Releia os alvos imediatamente antes da gravação. Execute somente se a mutação já estiver
   autorizada; caso contrário, mostre o preview e peça aprovação. Depois, releia e confronte com
   o resultado esperado. Retorno incerto exige reconciliação, nunca repetição cega.

Sem escrita do conector, entregue o lote pronto e bloqueie a mutação. Não invente operação de
Drive. Nunca recomende ativo, corretora, compra ou venda.
