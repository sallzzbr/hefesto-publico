---
description: "Generate a Mimyr mini-course module from source content. Use when creating a module index plus chapter plan/pages from transcripts, docx files, diagnostics, and templates — criar um módulo, reorganizar um módulo de curso."
---

# Gerar Módulo

Generate a complete module folder for a mini-course, using the workspace directory layout: module index, chapter sub-pages, and optional legacy redirect.

## Workspace

Opera sobre um workspace de curso, com paths resolvidos pela regra única do plugin (workspace `CLAUDE.md` → defaults `local_*` → convenção do cwd; ver `../gerar-curso/references/defaults.md` — menções literais são ilustrativas): exige o diretório de templates e o de cursos resolvidos (convenção `./templates/` e `./courses/<curso>/`). Se o de templates não existir, **PARE** com mensagem clara.

## Skills externas (bragir)

Esta skill consome o plugin bragir (mesmo marketplace):

- **`bragir:escrever-como-antonio`** — use for final prose in Hook, Concept, Real case, Na Prática, Reflita, and module intro copy.
- **`bragir:gerenciar-personas`** — invoke only if `./personas/` is missing and the course needs persona adaptation. The course manifesto remains `./courses/<curso>/personas.md`.

## Input

The user will provide:
1. Course slug (`<curso>`)
2. Module number and title
3. Content scope and source files
4. Transcript(s)
5. Diagnostic file(s)
6. `./perfil-de-voz.md` (resolved by `bragir:escrever-como-antonio`)
7. `./courses/<curso>/personas.md` + referenced files in `./personas/`

## Required reads

Read before generating:
1. `./templates/module-index.html`
2. `./templates/subpage.html`
3. `./courses/<curso>/styles.css`
4. Existing modules in `./courses/<curso>/modulo-*` for navigation and density
5. Relevant diagnostics in `./diagnostics/`

## Output layout

Create or update:

- `./courses/<curso>/modulo-N/index.html` — module landing page generated from `./templates/module-index.html`
- `./courses/<curso>/modulo-N/<capitulo>.html` — capítulos generated from `./templates/subpage.html`
- Root-level redirect legado when needed — a small redirect page from the old module URL to the module index

Do not make the root redirect the canonical content. The canonical module content is the folder index plus capítulos.

## Module generation rules

1. Build a chapter list before writing pages.
2. Each chapter should have one clear learning job.
3. Keep chapter reading time around 4-8 minutes.
4. Use `mimyr:escrever-capitulo` for each chapter that needs full prose.
5. Set module previous/next links across the course.
6. Set chapter previous/next links inside the module.
7. Use `bragir:escrever-como-antonio` for final copy.

## Após criar/remover/reordenar capítulos

Rode os dois scripts do plugin (idempotentes; ver bootstrap do venv no README do plugin):

- `python ${CLAUDE_PLUGIN_ROOT}/scripts/injetar_sidebar.py ./courses/<curso>` — regenera a sidebar (`nav.chapter-toc`) de todos os capítulos, marcando o atual com `aria-current`;
- `python ${CLAUDE_PLUGIN_ROOT}/scripts/atualizar_indice_curso.py ./courses/<curso>` — sincroniza contagem de capítulos e tempo de leitura no `index.html` do curso.

## Content rules

- Write for the course personas, not a generic student.
- Translate technical terms on first occurrence.
- Apply course-specific exclusions from the diagnostic or course plan; do not reuse topic cuts from another course unless the current diagnostic repeats them.
- Replace outdated examples with current, inspectable examples.
- Include practical exercises that work on a phone or browser without setup.

## Output report

After generating, report:
- Module index path
- Chapter paths
- Legacy redirect status
- Any source gaps or assumptions
- Suggested next review with `mimyr:revisar-capitulo`
