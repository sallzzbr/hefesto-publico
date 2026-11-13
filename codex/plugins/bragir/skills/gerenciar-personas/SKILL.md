---
name: gerenciar-personas
description: Use quando o usuário quiser criar, listar, editar, remover ou organizar personas de audiência no workspace, ou quando uma tarefa de escrita precisar de uma persona inexistente.
---

# Gerenciar Personas

Na primeira utilização, leia `../../RUNTIME.md` e
`../../shared/skills/gerenciar-personas/CONTRATO.md`. Este entrypoint e o runtime prevalecem para
paths, ferramentas e autorização.

## Fluxo nativo

1. Resolva `local_personas`. Personas pertencem ao workspace ou destino configurado, nunca a
   `../../shared/` ou ao cache do plugin.
2. Para listar, mostre nome e descritor. Para criar, obtenha nome, contexto, 3 a 5 marcadores de
   calibração e 2 a 3 gatilhos, depois gere slug e Markdown conforme o contrato.
3. Para editar, mostre antes/depois. Para remover, identifique exatamente o arquivo. Migração do
   legado `personas.md` preserva o original.
4. Execute a mutação se já autorizada; caso contrário, apresente o preview e peça aprovação. Sem
   escrita, devolva o arquivo pronto e o destino.

Se o cwd não for um workspace claro, não crie diretório por suposição.
