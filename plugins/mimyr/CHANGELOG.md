# Changelog — mimyr

> Histórico anterior à 1.1.6 vive nos commits do repositório privado; o espelho público nasce
> com histórico fresco a cada release, e este arquivo é o que sobrevive à travessia.

## 1.1.6 — 2026-09-02 (harness com teto de concorrência e relatório honesto)

Correções da auditoria adversarial de 2026-09-01.

- **Teto de concorrência** no harness `curso.mjs`: `PARALELO_MAX = 4` escritores simultâneos
  nos perfis paralelos (antes, um curso de 12 capítulos disparava 12 escritores de uma vez).
- **Relatório de modelo efetivo por execução** (`registrarExec`), portado do hermes 1.0.1:
  fallback tardio não re-rotula step que já rodou no tier certo.
- `scripts/checar_svg_overflow.py`: a ajuda embutida mandava rodar `tools/…`; o arquivo vive
  em `scripts/`.
- README: o link do workspace de origem apontava para o perfil do GitHub (repo privado).
