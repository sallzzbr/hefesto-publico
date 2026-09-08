# Changelog — odin

> Histórico anterior à 2.4.6 vive nos commits do repositório privado; o espelho público nasce
> com histórico fresco a cada release, e este arquivo é o que sobrevive à travessia.

## 2.4.9 — 2026-09-05 (correções do teste Claude)

- Hashes dos testes calculados com Node/crypto pelo helper `hashes-testes.mjs`. O Workflow recebe o JSON pelo operário e normaliza identidades, sem confundir caminho absoluto/relativo e anotações de linha com mudança de conteúdo. Hash ausente/inválido ou conflitante encerra como erro de evidência.
- Preflight `spec-ids.mjs` verifica a tabela original antes do agente de julgamento. IDs vazios/duplicados bloqueiam; extração posterior precisa preservar os mesmos IDs. O schema do TDD restringe referências aos IDs conhecidos.
- O preflight preserva a coluna de verificação complementar: evita converter path de teste em pendência manual ou omitir exigência humana explícita.
- Invocação local usa `scriptPath` absoluto e passa `workspaceRoot` físico e `scriptsDir`. Revisão `2026-09-05-r5` identificada no log; não retomar runs de revisão anterior.
- Regressões executam helpers reais e comandos transportados, incluindo caminhos com espaços/aspas e symlink externo. Mantido o bloqueio de alteração real de teste.

## 2.4.8 — 2026-09-05 (preparação para teste Claude)

- Portão TDD verifica cobertura de critérios, referências de testes e motivo do RED independente. Critérios manuais pendentes não fecham o run como verde.
- `name` explícito em todas as skills, alinhado ao diretório.

## 2.4.7 — 2026-09-02 (evals com runner de formato)

Pendência da auditoria de 2026-09-01: os 43 casos de `evals/roteamento/` não eram lidos por
nada (`claude plugin eval` segue em early access).

- `tests/evals-formato.test.mjs`: cada frase da matriz tem exatamente um caso, cada
  `criteria.md` cita a frase certa e tem `## Esperado`/`## Score`, e os banners esperados
  existem literalmente nos SKILL.md. Não julga roteamento — trava a estrutura.
- `evals/README.md`: o prompt é "derivado" da frase golden, não "verbatim" (4 casos
  concretizam o placeholder X). Matriz: nota de auditoria de 2026-09-02 (descriptions
  inalteradas desde a v2.2.0, verificado por diff).

## 2.4.6 — 2026-09-02 (o portão TDD vira verificação, não declaração)

Correções da auditoria adversarial de 2026-09-01 (Claude + duas passadas do Codex). A skill
dizia que "portão TDD vermelho" e "implementador não edita teste" eram invariantes no script;
no script só havia a palavra do operário e uma frase no prompt.

- **Vermelho verificado**: depois do portão TDD, o mecânico (haiku) roda SÓ os testes da SPEC
  e reporta o exit (`tdd:vermelho`). Exit 0 = `bloqueado` na fase TDD, antes de qualquer
  implementação. Devolve também o SHA-256 de cada teste.
- **Testes intactos em código**: a validação de cada iteração devolve os hashes de novo
  (`hashesDosTestes`, required no schema); hash diferente ou ausente é bloqueante automático,
  sem confirmação, com origem `testes-intactos`.
- **Teto de concorrência**: `PARALELO_MAX = 4` operários simultâneos nos perfis paralelos
  (antes, `parallel()` despachava todas as unidades de uma vez).
- **Relatório de modelo efetivo por execução** (`registrarExec`), portado do hermes 1.0.1:
  fallback tardio não re-rotula step que já rodou no tier certo; step que não rodou reporta o
  configurado.
- **Teste comportamental do harness** (`tests/harness-dev-loop.test.mjs`): o `loop.mjs` roda
  de verdade com `agent`/`parallel`/`phase`/`log` falsos; 10 casos cobrem args inválidos,
  spec bloqueada, TDD sem vermelho, vermelho não confirmado, teste alterado, auditoria nula,
  P10 barrada até o teto, caminho verde, fallback fable→opus e o teto de concorrência.
- Plano de custo da skill `dev-loop`: piso passa a `3 + iterações × (unidades + lentes + 2)`.

> **Compatibilidade:** o schema da validação ganhou o campo required `hashesDosTestes`. Quem
> reinvoca com `resumeFromRunId` um run anterior à 2.4.6 tem a validação re-executada com o
> prompt novo; nenhum arg da skill mudou.
