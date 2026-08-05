---
description: Fecha o mês com um resumo final (receitas, despesas, saldo, taxa de poupança, maiores gastos). Só leitura — nunca apaga nem move dados.
argument-hint: "[mês opcional AAAA-MM] ex.: 2026-06 (padrão: mês atual)"
---

Fechar o mês do orçamento doméstico usando a skill `orcamento`.

Mês (opcional, padrão = mês atual): $ARGUMENTS

1. Use a skill `orcamento`, fluxo "Fechar o mês".
2. Operação SOMENTE LEITURA: não apague, mova, renomeie nem sobrescreva o CSV. Aplique o fallback
   de leitura do caminho legado (regra de resolução da skill) se o mês não existir na pasta
   de orçamento resolvida.
3. Produza o fechamento em BRL: receitas totais, despesas totais, **saldo**, **taxa de poupança**
   (omitida se o mês não tiver receitas), total por categoria (maior → menor) e as maiores
   despesas individuais.
4. Ofereça salvar o fechamento em arquivo separado (`AAAA-MM-resumo.md`) só com confirmação.
5. Isto não é conselho de investimento — é um retrato do mês.
