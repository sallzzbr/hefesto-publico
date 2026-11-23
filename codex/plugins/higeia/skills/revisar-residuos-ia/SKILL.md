---
name: revisar-residuos-ia
description: "Review local Git worktrees and workflow leftovers. Use when o usuário pedir para revisar worktrees antigas, investigar branches sem merge, localizar temporários ou entender o que sobrou de sessões de IA."
---

# Revisar resíduos de IA

Leia [o runtime](../../RUNTIME.md) e [o contrato de diagnóstico](../../shared/skills/revisar-residuos-ia/CONTRATO.md). No workspace em análise, rode com Node.js 22+ o [coletor empacotado](../../shared/scripts/diagnostico.mjs) com `residuos --root "<diretório>"`. Resolva o arquivo relativamente a esta skill. Aplique os critérios de escopo, memória opcional, evidência e saída do contrato.
