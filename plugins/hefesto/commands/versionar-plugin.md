---
description: Bump semver sincronizado de plugin + marketplace
argument-hint: [plugin] [patch|minor|major (opcional)]
---

# /versionar-plugin

Invoque a skill `versionar-plugin`.

Pedido inicial: $ARGUMENTS

Se o grau do bump não foi informado, derive do `git diff` do plugin e proponha com justificativa antes de editar. Sempre os três lugares no mesmo commit, validados por `validar-plugin`.
