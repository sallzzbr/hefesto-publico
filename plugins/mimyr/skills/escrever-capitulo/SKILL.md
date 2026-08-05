---
description: "Write a new course chapter for a Mimyr mini-course. Use when creating or rewriting module sub-pages with HTML structure, author voice, personas, exercises, and cross-references — escrever um capítulo, reescrever uma página de curso."
---

# Escrever Capítulo

Create or rewrite a complete HTML sub-page for a mini-course module. Use this when a module already exists or when `mimyr:gerar-modulo` has defined the module outline and chapter sequence.

## Workspace

Opera sobre um workspace de curso, com paths resolvidos pela regra única do plugin (workspace `CLAUDE.md` → defaults `local_*` → convenção do cwd; ver `../gerar-curso/references/defaults.md` — menções literais são ilustrativas): exige o `subpage.html` do diretório de templates resolvido (convenção `./templates/subpage.html`) e o de cursos (`./courses/<curso>/`). Se faltar, **PARE** com mensagem clara.

## Skills externas (bragir)

Esta skill consome o plugin bragir (mesmo marketplace):

- **`bragir:escrever-como-antonio`** — invoque `bragir:escrever-como-antonio` para escrever os parágrafos finais na voz do autor. A skill resolve `./perfil-de-voz.md` primeiro e usa fallback do plugin se necessário.
- **`bragir:gerenciar-personas`** — invoque se as personas-alvo do curso não existirem em `./personas/` ou se o usuário pedir uma persona nova. O manifesto `./courses/<curso>/personas.md` continua sendo do curso.

## Before writing

Read:
1. `./perfil-de-voz.md` — voice reference (gerado por `bragir:analisar-voz`)
2. `./courses/<curso>/personas.md` — personas-alvo do curso atual
3. Relevant files in `./personas/`
4. `./templates/subpage.html` — canonical HTML shell for chapter pages
5. `./courses/<curso>/styles.css` — available classes and visual patterns
6. A neighboring chapter from the same module — navigation, density, and local conventions

## Input

The user should provide:
1. Course slug (`<curso>`)
2. Module number and title
3. Chapter title and slug
4. Chapter position: page X of Y, previous/next page titles and URLs
5. Topic scope and desired depth
6. Optional source material: docx excerpts, transcript excerpts, diagnostic notes, references

## Content pattern

Every chapter should contain:

1. **Hook** — 1-2 paragraphs that make the reader care.
2. **Concept** — explanation in Antonio's pattern: afirmação → expansão → exemplo.
3. **Analogy or concrete example** — everyday first, technical second.
4. **Cross-reference** — only when it genuinely helps connect modules.
5. **Mini-exercício** — practical, safe, doable without installing anything.
6. **Checagem rápida** (opcional, recomendada em capítulos conceituais) — 2-3 perguntas de autoavaliação formativa. Usa `<details>/<summary>` nativo (zero JS): o `summary` é a pergunta, o conteúdo expandido é a resposta curta. Coloque ao final, dentro de `<article>`, antes da `subpage-nav`. As perguntas devem cobrir os conceitos-chave do próprio capítulo, na voz do autor ("Sem nota, sem pressão"). Capítulos que já são exercício (`na-pratica`, `caso-real`) não precisam de checagem. Estilo via classe `.checagem` (ver `./courses/<curso>/styles.css`).

Esqueleto da checagem:

```html
<section aria-label="Checagem rápida" class="checagem">
  <h2>Checagem rápida</h2>
  <p>Sem nota, sem pressão. Responda de cabeça e depois abra pra conferir.</p>
  <details>
    <summary>Pergunta sobre um conceito-chave do capítulo?</summary>
    <p>Resposta curta e direta, reforçando o conceito.</p>
  </details>
</section>
```

## HTML rules

- Use `./templates/subpage.html` as the source of truth.
- Replace placeholders with actual content.
- Keep semantic sections: `section.hook`, `section.concept`, optional `aside.cross-ref`, required `aside.mini-exercicio`.
- Include diagrams only when they clarify a concept; use `figure.diagram` and CSS variables.
- Set reading time as word count ÷ 200, rounded up.
- Set progress percentage from `PAGE_NUMBER / TOTAL_PAGES`.
- Verify all `href` paths relative to the chapter file.

## Diagramas SVG

Diagramas são SVG inline com `<text>` em coordenadas fixas, sem layout automático.
Texto que estoura o `viewBox` ou colide com outro texto não aparece no HTML — só na página aberta.
Depois de criar ou editar um diagrama, rode:

    python ${CLAUDE_PLUGIN_ROOT}/scripts/checar_svg_overflow.py ./courses/<curso>

Ele mede a largura real com as métricas das fontes do curso (`./courses/<curso>/fonts/`);
**não estime largura por contagem de caracteres**. Requer o venv do workspace (bootstrap no
README do plugin). Dois erros de projeto já conhecidos: largura codificando significado
(barras que estreitam brigam com o texto) e linhas empilhadas com espaçamento < `font-size`.

## Voice and persona rules

- Write in Antonio's voice through `bragir:escrever-como-antonio`.
- Use "você" and "pessoal", never "aluno" or "estudante".
- Validate the primary personas' fears and constraints before teaching.
- Add depth, career, portfolio, or practice angles when they match the course personas.
- Translate technical jargon on first occurrence; after that, use it naturally.

## Output

Write the final chapter to `./courses/<curso>/modulo-N/<slug>.html`.

After writing, report:
- File written
- Previous/next links checked
- Reading time
- Persona calibration choices
