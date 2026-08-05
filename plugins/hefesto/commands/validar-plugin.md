---
description: Validar manifestos, versões e skills do marketplace/plugin
argument-hint: [nome do plugin (opcional — default: todos)]
---

# /validar-plugin

Invoque a skill `validar-plugin`.

Pedido inicial: $ARGUMENTS

Rode o script `validar.mjs` (com `--plugin <nome>` se o usuário especificou um), interprete a saída, proponha correções para os erros e aponte os achados de julgamento que o script não cobre.
