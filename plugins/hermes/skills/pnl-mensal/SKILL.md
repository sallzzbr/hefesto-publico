---
description: "Build the monthly P&L of an e-commerce operation. Use when the user wants the month's results — P&L mensal, DRE simplificada, fechar o resultado do mês, CAC real e ROAS real do mês, margem do mês."
---

# P&L Mensal

> Paths do workspace (`marketing/`, `branding/`, `contexto/`, `financeiro/`, `scripts/`) resolvem pela regra única do plugin (`criativo-fluxo/references/defaults.md`: CLAUDE.md do workspace → defaults `local_*` → convenção descoberta no cwd → default documentado); as menções nesta skill são ilustrativas do default, não hardcode.


Monta a DRE simplificada do mês de uma operação de e-commerce e calcula os indicadores
reais — fechando o ciclo entre o planejado (unit economics) e o acontecido.

## Cascata (nesta ordem, sem pular linha)

1. **Receita bruta** (pedidos pagos do mês, do ledger do workspace)
2. − descontos concedidos
3. = **Receita líquida**
4. − custo dos produtos (COGS do fornecedor)
5. − taxas de plataforma/pagamento
6. − frete absorvido
7. = **Margem de contribuição**
8. − investimento em ads do mês (da plataforma de ads — dado real, não planejado; sem
   acesso, pergunte o valor)
9. = **Resultado operacional do mês**

## Indicadores derivados

- **Pedidos** e **ticket médio** (receita ÷ pedidos)
- **CAC real** = ads ÷ pedidos atribuíveis · **ROAS real** = receita ÷ ads. **Boost fora da
  régua:** gasto que NÃO otimiza por conversão (boost/impulsionamento e afins — identificado
  pelo `optimization_goal`/objetivo da campanha, NUNCA pelo nome) entra na cascata como
  dinheiro real, mas sai do denominador de CAC real e ROAS real e aparece numa linha própria,
  rotulada — gasto sem compra no denominador contamina a régua e derruba decisão boa.
- **Margem %** por linha da cascata
- **Confronto com a régua**: CAC real vs CAC máximo do `unit-economics` mais recente
  (lookup do relatório — nunca número de memória) — acima/abaixo e por quanto.

## Regras

- Fonte de cada número declarada (ledger, plataforma, estimativa sinalizada).
- Mês incompleto → diga "parcial até dia D" em tudo.
- Grave em `financeiro/relatorios/pnl-AAAA-MM.md`; série mensal permite tendência — cite o
  mês anterior quando existir.
- Português BR; valores em BRL.
