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
4. Mostre a tabela completa que vai gravar e peça ok antes de escrever no calendário. Ao gravar,
   preserve cabeçalho, as 12 linhas e os ciclos anteriores.
5. O pedido de planejar ou atualizar a agenda não autoriza gravar sem mostrar. Só grave direto
   se o usuário disser explicitamente, nesta sessão, que pode gravar sem mostrar. Esta regra da
   skill prevalece sobre o reaproveitamento de autorização do runtime.
6. Mudar o `status` de rascunhos agendados no frontmatter é mutação separada: mostre os arquivos e
   o campo alterado e peça ok da mesma forma.

Sem ok nem dispensa explícita, entregue a tabela pronta e não grave. Nunca grave no pacote ou cache.
