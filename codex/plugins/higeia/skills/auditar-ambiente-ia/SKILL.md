---
name: auditar-ambiente-ia
description: "Audit AI skill origins, scopes and overlaps. Use when o usuário pedir para auditar o Claude ou Codex, entender de onde vêm suas skills, conferir plugins e versões em cache ou investigar instruções duplicadas."
---

# Auditar ambiente de IA

Leia [o runtime](../../RUNTIME.md) e [o contrato de diagnóstico](../../shared/skills/auditar-ambiente-ia/CONTRATO.md). No workspace em análise, rode com Node.js 22+ o [coletor empacotado](../../shared/scripts/diagnostico.mjs) com `ambiente --root "<diretório>"`. Resolva o arquivo relativamente a esta skill. Aplique os critérios de escopo, memória opcional, evidência e saída do contrato.
