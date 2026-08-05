---
description: "Analyze an author's writing style from docx/markdown samples and generate a structured voice profile. Use when the user has 3-5 writing samples and wants a perfil-de-voz.md (voice profile) capturing tone, structure, vocabulary, analogies and pedagogical patterns — útil para clonar a voz de um autor."
---

# Analisar Voz

Read the provided documents and extract a structured voice profile for the author.

## Input

The user will specify 3-5 documents (docx, markdown, txt) to analyze. Read each one using the Read tool. Para arquivos `.docx`, a skill oficial `docx` da Anthropic precisa estar instalada no ambiente.

## Analysis dimensions

For each document, identify patterns in:

1. **Tom e registro** — formal/informal, nivel de formalidade, uso de "voce" vs "senhor"
2. **Abertura de secoes** — como o autor comeca capitulos, topicos, paragrafos
3. **Estrutura de frase** — comprimento medio, uso de perguntas retoricas, listas
4. **Fechamento de secoes** — como encerra (motivacional, reflexivo, resumo)
5. **Analogias e metaforas** — exemplos recorrentes, fontes de analogia (cotidiano, profissional)
6. **Vocabulario caracteristico** — palavras e expressoes frequentes, bordoes
7. **Relacao com o leitor** — como se posiciona (professor, mentor, colega), como trata duvidas
8. **Citacoes e referencias** — como integra fontes academicas no texto
9. **Elementos pedagogicos** — caixas (Saiba Mais, Na Pratica, Reflita), check-ins, exercicios
10. **Marcadores de personalidade** — humor, empatia, assertividade, humildade

## Output format

Resolver o destino nesta ordem: (1) `local_voz` na seção `## Paths do workspace` do
`CLAUDE.md`; (2) `local_voz` nos defaults do usuário (`~/.claude/bragir/defaults.md`); (3)
convenção descoberta no cwd — perfil existente em `./voz/perfil-de-voz.md` ou legado
`./voice-profile.md`; (4) default documentado `./perfil-de-voz.md`. Exatamente um candidato
existente é usado; mais de um candidato concorrente exige perguntar; nenhum candidato cai no
default documentado. Os paths literais são ilustrativos do default, não hardcode.

Cada projeto que consome a voz tem o seu próprio perfil — assim dá pra tunar tom e exemplos por
contexto sem mexer no default global. Um arquivo só de scaffold (placeholders `<!-- -->`) conta
como existente para ESCRITA: é exatamente ele que você vai preencher. Se resolver o nome legado,
ofereça renomear para `perfil-de-voz.md` em vez de criar um segundo arquivo.

**Override** (só quando o usuário pedir explicitamente, ex.: "atualiza meu perfil de voz padrão" ou "atualiza o perfil de voz do bragir"): escrever em `${CLAUDE_PLUGIN_ROOT}/perfil-de-voz.md`. Esse é o fallback usado por `escrever-como-antonio` quando o projeto não tem `./perfil-de-voz.md` próprio.

Após gerar o perfil resolvido, sugira ao usuário commitar o arquivo no repo do projeto.

Use esta estrutura:

```
# Perfil de Voz — [Nome do Autor]

## Resumo (2-3 frases)

## Tom e registro
## Como abre secoes
## Como fecha secoes
## Analogias recorrentes
## Vocabulario caracteristico
## Estrutura de frase
## Relacao com o leitor
## Uso de citacoes
## Elementos pedagogicos
## Exemplos reais (trechos representativos)
```

Include 2-3 **trechos reais** (curtos, <30 palavras) dos documentos analisados como exemplos concretos do estilo.

## Important

- Extract patterns, not individual instances. The profile should generalize.
- Note contradictions or register shifts between documents (e.g., more formal in e-book vs. informal in video script).
- The profile will be used as input for content generation — be specific enough that another AI could replicate the voice.
