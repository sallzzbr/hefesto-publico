---
name: planejar-agenda
description: Use quando o usuário pedir planejamento ou atualização de calendário editorial com rascunhos e ideias do workspace, em ciclos de quatro semanas.
---

# Planejar Agenda

Na primeira utilização, leia `../../RUNTIME.md` e
`../../shared/skills/planejar-agenda/CONTRATO.md`. O contrato preserva cadência, 12 slots e estados;
este entrypoint e o runtime prevalecem para paths, ferramentas e autorização.

## Fluxo nativo

1. Resolva agenda, rascunhos e ideias. Se o calendário não existir, informe que falta o
   workspace editorial e não crie scaffold.
2. Leia as regras locais. Use a segunda-feira fornecida como início ou peça apenas esse dado.
3. Monte exatamente 12 slots em seg/qua/sex por quatro semanas. Só associe `post_id` encontrado;
   conteúdo ausente mantém o slot `vago`.
4. Mostre a tabela completa e preserve ciclos anteriores. Escreva se a atualização já estiver
   autorizada; caso contrário, peça aprovação. Alterar frontmatter de rascunhos é mutação separada.

Sem escrita, entregue a tabela pronta. Nunca grave no pacote ou cache.
