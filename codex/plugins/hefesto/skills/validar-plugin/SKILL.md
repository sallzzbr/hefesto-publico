---
name: validar-plugin
description: "Use when o usuário pedir para validar um plugin Codex, conferir seu manifesto, skills, metadata ou paths antes de distribuir."
---

# Validar Plugin

Na primeira utilização, leia `../../RUNTIME.md`. Use o script desta skill para as regras mecânicas e complemente com revisão humana de gatilhos, clareza e dependências.

## Fluxo

Execute, a partir do diretório desta skill:

```sh
node scripts/validar.mjs <raiz-do-plugin>
```

Exit `0` indica que o manifesto e as skills passaram; exit `1` lista erros. Corrija erros dentro do escopo autorizado e rode novamente.

## Cobertura

O script exige `.codex-plugin/plugin.json`, `name`, semver, descrição, `skills: "./skills/"`, diretório de skills e frontmatter com `name` igual ao diretório e descrição. Ele também rejeita paths absolutos de SO e travessia, exceto os contratos internos `../../RUNTIME.md` e `../../shared/...`.

O script não prova qualidade das instruções, funcionamento de conectores ou instalação no app. Não apresente essas propriedades como validadas.
