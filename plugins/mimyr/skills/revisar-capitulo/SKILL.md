---
description: "Review a Mimyr course chapter before publication. Use when checking generated HTML pages for voice, personas, structure, links, accessibility, SEO, exercises, and consistency — revisar um capítulo, revisar uma página antes de publicar."
---

# Revisar Capítulo

> Os paths de workspace citados abaixo (`./courses/`, `./personas/`, `./templates/`, `./diagnostics/`, `./transcriptions/`) resolvem pela regra única do plugin (`../gerar-curso/references/defaults.md`: CLAUDE.md do workspace → defaults `local_*` → convenção descoberta no cwd → default documentado) e são ilustrativos do default, não hardcode.


Review an existing chapter page and return actionable fixes before publication.

## Required reads

Read:
1. The chapter HTML file
2. `perfil-de-voz.md`
3. `./courses/<curso>/personas.md`
4. Referenced files in `./personas/`
5. Neighboring chapter pages for navigation and tone continuity
6. `./courses/<curso>/styles.css` when checking class usage

## Review checklist

Check:

- **Voz** — Antonio's tone, paragraph rhythm, rhetorical questions, no dry academic opening.
- **Personas** — primary personas get the promised tone, depth, and reassurance; secondary personas are not ignored when the course manifesto asks for them.
- **Structure** — hook, concept, examples, optional cross-ref, required `mini-exercicio`.
- **Exercise** — specific, doable without installing anything, safe, connected to the concept.
- **Links** — every `href` resolves relative to the file location.
- **Acessibilidade** — check acessibilidade with semantic headings, alt/aria where needed, skip link preserved, tables/figures readable.
- **SEO** — title and meta description are specific and not duplicated.
- **Navigation** — page number, progress, previous/next links, breadcrumb.
- **HTML hygiene** — no unresolved placeholders, no broken class names, no duplicated IDs.

## Checagens determinísticas (scripts do plugin)

Para achados mecânicos em batch, os scripts em `${CLAUDE_PLUGIN_ROOT}/scripts/` complementam a revisão
(requerem o venv do workspace — bootstrap no README do plugin):

- `corrigir_acentos.py <dir> --dry-run` — palavras sem acento no texto visível;
- `remover_travessao.py <dir> --dry-run` — travessões na prosa (contrato da voz);
- `melhorar_a11y.py <arquivo>` — aria-labels de navegação, scopes de tabela, table-wrap;
- `checar_svg_overflow.py <dir-do-curso>` — texto de SVG estourando o viewBox.

## Output format

Report findings in this order:

1. **Bloqueadores** — must fix before publication.
2. **Melhorias recomendadas** — quality improvements.
3. **Ajustes editoriais** — voice, clarity, examples.
4. **Checks OK** — what passed.

For each issue, include:
- file path
- line or nearby marker when possible
- proposed correction

If no issues are found, say that clearly and mention any residual risk.
