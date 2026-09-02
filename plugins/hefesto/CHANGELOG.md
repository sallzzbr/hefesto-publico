# Changelog — hefesto

> Histórico anterior à 3.1.5 vive nos commits do repositório privado; o espelho público nasce
> com histórico fresco a cada release, e este arquivo é o que sobrevive à travessia.

## 3.1.6 — 2026-09-02 (convenções que descrevem a prática)

Pendência da auditoria de 2026-09-01: `criar-skill/references/convencoes-skill.md` prescrevia o
que 26 das 42 skills do marketplace não seguiam. Agora separa o que o `validar.mjs` **cobra**
(description presente, 60–1024 chars) do que é recomendação, registra os dois dialetos de
`description` (verbo EN × "Use quando…" PT), torna o command decisão por plugin, e nomeia as
exceções de emoji funcional. Sem mudança de comportamento nas skills.

- `tests/validar-plugin-manifestos.test.mjs` (21 casos): frontmatter, semver, `source`,
  `--plugin`, marketplace ausente, plugin fora do manifesto, avisos × erros — a metade do
  validador que o mutation testing mostrava sem teste. Entra no `stryker.conf.json`.

## 3.1.5 — 2026-09-02 (changelog)

- CHANGELOG novo. O gate de bump do marketplace (`scripts/verificar-bump.mjs`) passa a cobrar
  entrada aqui a cada versão. Sem mudança de comportamento nas skills.
