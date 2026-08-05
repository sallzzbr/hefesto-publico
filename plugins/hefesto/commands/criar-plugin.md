---
description: Scaffoldar um plugin novo no marketplace atual
argument-hint: [nome do plugin] [descrição curta]
---

# /criar-plugin

Invoque a skill `criar-plugin`.

Pedido inicial: $ARGUMENTS

Siga o fluxo da skill: localizar a raiz do marketplace, coletar nome/descrição/categoria, scaffoldar `plugins/<nome>/` e registrar no `marketplace.json`. Finalize rodando `validar-plugin`.
