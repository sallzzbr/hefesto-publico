---
description: "Audit the STRUCTURE of an ads account against a 9-dimension scorecard. Use when the user wants a structural health check of campaigns — auditoria de estrutura, conta bem montada, sobreposição de públicos, quantos ads por conjunto, higiene da conta de ads."
---

# Auditoria de Estrutura

> Paths do workspace (`marketing/`, `branding/`, `contexto/`, `financeiro/`, `scripts/`) resolvem pela regra única do plugin (`criativo-fluxo/references/defaults.md`: CLAUDE.md do workspace → defaults `local_*` → convenção descoberta no cwd → default documentado); as menções nesta skill são ilustrativas do default, não hardcode.


Audita a **estrutura** das campanhas ativas de uma conta de ads — não a performance. A
distinção importa: problema estrutural (conta mal montada) sabota a performance por baixo, e
otimizar verba em cima de estrutura ruim é polir o pior lugar.

## Scorecard fixo — 9 dimensões (✅ / ⚠️ / 🛑 cada)

1. **Objetivo da campanha** coerente com a meta declarada (conversão pra vender; tráfego só
   com propósito declarado).
2. **Nº de campanhas ativas** vs verba: verba pequena pulverizada em muitas campanhas =
   nenhuma sai da learning phase (🛑 quando a verba média por campanha não sustenta ~50
   conversões/semana).
3. **Bid strategy** explícita e consistente (lowest cost vs cost cap vs bid cap — e por quê).
4. **Sobreposição de públicos**: conjuntos ativos disputando a mesma audiência (leilão
   interno). Sinal: um conjunto starved com outro escalando no mesmo público.
5. **Posicionamentos**: automático como default; manual só com razão documentada.
6. **Evento de otimização** no nível certo do funil (compra quando há volume; evento acima
   só com justificativa de volume).
7. **Janela de atribuição** consistente entre campanhas comparadas (comparar 7d-click com
   1d-view mente).
8. **Ads por conjunto: 2-5.** 1 = sem teste interno; >5 = verba pulverizada, criativos
   starved. Audite também a regra de **nascimento**: conjunto novo nasce com **≥2 anúncios**
   — subir com 1 só é teste sem comparação interna desde o dia 1. E o trade-off explícito
   antes de criar conjunto novo: avaliar entrar como **anúncio novo em conjunto existente
   compatível** — evita reset de learning e não aumenta a verba total; conjunto novo só
   quando o público/argumento exige separação.
9. **Diversidade criativa** dentro do conjunto: formatos/ângulos distintos, não 4 variações
   da mesma arte.

## Protocolo

1. Colete a árvore campanha → conjunto → ad (MCP da plataforma, leitura pura). ARCHIVED
   ignorado; PAUSED conta como inativo (mas aponte pausado-com-verba esquecida).
2. Avalie as 9 dimensões com **evidência por item** (id/nome + número) — checklist sem
   evidência não vale.
3. **Top 3 problemas estruturais** ranqueados por impacto, cada um com correção concreta e
   custo dela (ex.: mexer em conjunto reseta learning — vale?).
4. Grave em `marketing/inteligencia/auditorias-estrutura/AAAA-MM-DD.md`.

## Regras

- **Somente leitura** — nenhuma alteração na plataforma.
- Estrutura ≠ performance: CPA alto NÃO entra aqui (é assunto das skills de verba/fadiga);
  entra o que o CAUSA por construção.
- Cadência sugerida: mensal, ou após qualquer reestruturação relevante.
- Português BR.
