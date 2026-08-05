---
description: "Analyze a lesson (transcript + docx) and produce a pedagogical diagnostic. Use when evaluating source material before transforming it into a Mimyr mini-course module — analisar uma aula, diagnóstico pedagógico de uma unidade."
---

# Análise de Aula

> Os paths de workspace citados abaixo (`./courses/`, `./personas/`, `./templates/`, `./diagnostics/`, `./transcriptions/`) resolvem pela regra única do plugin (`../gerar-curso/references/defaults.md`: CLAUDE.md do workspace → defaults `local_*` → convenção descoberta no cwd → default documentado) e são ilustrativos do default, não hardcode.


Analyze a teaching unit by cross-referencing its written content (`.docx`) with its video transcript to produce a pedagogical diagnostic.

## Skills externas (bragir)

Esta skill consome o plugin bragir (mesmo marketplace):

- **`bragir:gerenciar-personas`** — se a análise de adequação às personas não encontrar `./personas/`, ofereça invocar `bragir:gerenciar-personas` antes de seguir. Se `./courses/<curso>/personas.md` não existir, registre no diagnóstico que o manifesto de personas do curso ficou pendente.

## Input

The user will provide:
1. A `.docx` file (e-book/unit content)
2. A transcript `.md` file (video lecture)
3. The target course slug (`<curso>`)
4. Optional supporting files: video script, quiz questions, references

Read all provided files before writing the diagnostic. For transcript evidence, preserve useful timestamps.

Se a fonte ainda estiver em vídeo ou docx bruto, os scripts do plugin preparam o material
(requerem o venv do workspace — bootstrap no README do plugin; transcrição usa
`requirements-transcricao.txt` e `ffmpeg`):

- `python ${CLAUDE_PLUGIN_ROOT}/scripts/extract_docx.py <arquivo.docx>` — extrai o texto do docx (sem deps);
- `python ${CLAUDE_PLUGIN_ROOT}/scripts/extrair_audio.py <video>` — extrai áudio 16kHz mono WAV;
- `python ${CLAUDE_PLUGIN_ROOT}/scripts/transcrever.py <audio>` — transcreve com Whisper local, gerando `.md` com timestamps.

## Before analysis

Read:
1. `./courses/<curso>/personas.md` — personas-alvo do curso
2. Referenced files in `./personas/`
3. Existing diagnostics in `./diagnostics/` for tone and depth conventions

If personas are missing, continue only after noting the limitation or after `bragir:gerenciar-personas` creates the missing persona files.

## Analysis framework

Evaluate across these dimensions:

1. **Objetivos de aprendizagem** — implicit/explicit objectives, clarity, measurability, fit for a 5-7 min reading experience.
2. **Coerência conteúdo ↔ vídeo** — overlap, gaps, contradictions, places where the video adds cases or demonstrations.
3. **Conteúdo desatualizado** — deprecated tools, old statistics, hype topics, or weak current relevance.
4. **Gaps pedagógicos** — missing prerequisites, unexplained jargon, jumps in difficulty.
5. **Oportunidades de melhoria** — stronger analogies, exercises, examples, splits, and cross-references.
6. **Adequação às personas** — whether primary personas' fears, depth needs, vocabulary, and exercises are respected.
7. **Mapeamento para micro-módulos/capítulos** — candidate pages, hooks, examples, exercises, and source evidence for each.

## Evidence standard

- Cite concrete source evidence under **Evidências usadas**.
- Include transcript timestamps when available.
- Quote only short excerpts; paraphrase the rest.
- Separate evidence from recommendation: first what source says, then what Mimyr should do with it.

## Output

Write the diagnostic to `./diagnostics/<slug-da-unidade>.md`.

Use this structure:

```markdown
# Diagnóstico — [Unit Name]

## Resumo

## Evidências usadas
- [docx] ...
- [transcript 00:00:00] ...

## Objetivos de aprendizagem
## Coerência conteúdo ↔ vídeo
## Conteúdo desatualizado
## Gaps pedagógicos
## Oportunidades de melhoria
## Adequação às personas
## Mapeamento para micro-módulos

### Recomendações prioritárias
1. ...
2. ...
3. ...
```
