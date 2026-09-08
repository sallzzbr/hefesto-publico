---
name: criar-skill
description: "Use when o usuário pedir para criar, adicionar ou scaffoldar uma skill nativa do Codex em um plugin existente."
---

# Criar Skill

Na primeira utilização, leia `../../RUNTIME.md` e `../../shared/skills/criar-skill/references/convencoes-skill.md`. Aplique o formato nativo: frontmatter com `name` e `description`, corpo focado e recursos locais descobertos por links relativos.

## Entrada

Obtenha raiz do plugin, nome em kebab-case, gatilhos concretos para a descrição, entradas, saídas e dependências reais. Verifique se já existe skill sobreposta antes de criar outra.

## Fluxo

Execute, a partir do diretório desta skill:

```sh
node scripts/scaffold-skill.mjs --plugin <raiz-do-plugin> --name <nome> --description <descricao>
```

Substitua o corpo mínimo pelo fluxo específico da capacidade. Mova apenas material condicional ou extenso para `references/`; scripts devem ser standalone quando possível. Rode `validar-plugin` ao terminar.

## Limites

- `name` deve coincidir com o diretório e `description` deve explicar quando usar a skill.
- O script recusa colisões e não sobrescreve `SKILL.md` existente.
- Não declare skills globais, conectores, modelos ou credenciais como disponíveis sem evidência do ambiente.
