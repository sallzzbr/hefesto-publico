---
name: validar-plugin
description: "Use when o usuário pedir para validar um plugin Codex, conferir seu manifesto, skills, metadata ou paths antes de distribuir."
---

# Validar Plugin

Na primeira utilização, leia `../../RUNTIME.md` e o [contrato de domínio](../../shared/skills/validar-plugin/CONTRATO.md). Use o script desta skill para as regras mecânicas e complemente com revisão humana de gatilhos, clareza e dependências.

## Fluxo

Execute da raiz do workspace (nunca de dentro do pacote instalado: path relativo criaria ou leria arquivos no cache do plugin), com o caminho real do script resolvido a partir desta skill (`PLUGIN_DIR` no RUNTIME):

```sh
node "<PLUGIN_DIR>/skills/validar-plugin/scripts/validar.mjs" <raiz-do-plugin>
```

Exit `0` indica que o manifesto e as skills passaram; exit `1` lista erros. Corrija erros dentro do escopo autorizado e rode novamente.

## Cobertura

O script exige `.codex-plugin/plugin.json`, `name`, semver, descrição, `skills: "./skills/"`, diretório de skills e frontmatter com `name` igual ao diretório e descrição. Ele também rejeita paths absolutos de SO e travessia, exceto os contratos internos `../../RUNTIME.md` e `../../shared/...`.

O script não prova qualidade das instruções, funcionamento de conectores ou instalação no app. Não apresente essas propriedades como validadas.

### Formato de frontmatter aceito

O validador nativo e o checker da distribuição usam o mesmo parser standalone, sem dependências. Aceitam campos escalares de texto e o campo opcional `metadata` como mapa indentado de strings, por exemplo:

```yaml
metadata:
  short-description: "Resumo da capacidade"
  version: "1.0"
```

As chaves usam letras, números e hífens, começando por letra; valores não vazios podem usar aspas duplas (escapes JSON), aspas simples (aspas internas duplicadas) ou texto simples sem sintaxe YAML especial. Use aspas para números, booleanos e valores ambíguos. Comentários em linhas próprias são aceitos. A indentação do mapa deve ser consistente, com espaços.

Não é um parser YAML geral: listas, mapas adicionais, aliases, tags, strings em bloco e comentários após valores não são suportados. Sintaxe não suportada, chaves duplicadas, metadata vazio ou escalar e valores que não sejam strings produzem erro, sem ignorar linhas. Metadados não substituem `name` e `description` obrigatórios na raiz.
