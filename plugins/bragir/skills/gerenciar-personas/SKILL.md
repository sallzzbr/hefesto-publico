---
description: "Create, list, edit, or remove audience personas in the current project (./personas/). Use when the user asks to criar/listar/editar/remover uma persona, scaffoldar um diretório de personas, ou quando outra skill (ex.: escrever-como-antonio) precisa de uma persona que ainda não existe no projeto."
---

# Gerenciar Personas

Personas descrevem audiências específicas para calibrar tom, exemplos e gatilhos em skills de escrita. Vivem no **projeto atual**, não no plugin, porque cada projeto/cliente/contexto tem personas próprias.

## Resolução de localização

Resolver nesta ordem: (1) `local_personas` na seção `## Paths do workspace` do `CLAUDE.md`;
(2) `local_personas` nos defaults do usuário (`~/.claude/bragir/defaults.md`); (3) convenção
descoberta no cwd — diretório `./personas/` e depois arquivo único `./personas.md`; (4) default
documentado `./personas/`. Exatamente um candidato existente é usado; mais de um candidato
concorrente exige perguntar. Como esta skill é o scaffold explícito de personas, nenhum
candidato permite criar o default após confirmação. Os paths literais são ilustrativos do
default, não hardcode.

Chame o diretório resultante de `<personas>`. O arquivo único `./personas.md` é legado:
permite listar/ler; para criar, editar ou remover, ofereça migrar seu conteúdo para
`<personas>/*.md` com confirmação, preservando o original. Nunca ignore um `local_personas`
resolvido para escrever no default.

## Operações

### Criar persona nova

1. Se `<personas>/` não existir e nenhum alvo legado tiver sido resolvido, crie após a
   confirmação de scaffold.
2. Peça ao usuário (se ainda não forneceu): nome, contexto curto (uma frase), 3–5 marcadores de calibração, e 2–3 gatilhos de linguagem.
3. Slugify o nome: lowercase, remover acentos/diacríticos, trocar espaços e pontuação por hífen, colapsar hífens repetidos. Exemplos: `"Maria José"` → `maria-jose`, `"Dr. João Silva"` → `dr-joao-silva`, `"Camila"` → `camila`. Escreva em `<personas>/<slug>.md` com o template abaixo.
4. Confirme o arquivo criado e o conteúdo.

### Template de persona

```markdown
# <Nome> (<descritor curto>)

## Contexto
<uma frase sobre quem é e o que quer>

## Calibração
- <marcador 1: tom, profundidade, o que validar antes>
- <marcador 2>
- <marcador 3>

## Gatilhos de linguagem
- "<expressão que ressoa>"
- "<outra expressão>"

## O que evitar
- <armadilha comum ao escrever pra essa pessoa>
```

### Listar personas

Leia `<personas>/*.md` (ou o arquivo legado resolvido) e imprima nome + descritor de cada uma.

### Editar persona existente

Abra o `.md`, mostre conteúdo atual, aplique as mudanças pedidas, reescreva.

### Remover persona

Confirme com o usuário antes de deletar o arquivo.

## Importante

- Nunca escreva personas dentro do plugin (`${CLAUDE_PLUGIN_ROOT}`). Elas pertencem ao projeto do usuário.
- Se o usuário estiver num diretório que claramente não é um projeto (home, `/tmp`),
  confirme antes de criar o diretório resolvido.
- Ao criar a primeira persona de um projeto, ofereça sugerir 2–3 personas-base se o usuário quiser um ponto de partida.
