# Changelog — odin

> Histórico anterior à 2.4.6 vive nos commits do repositório privado; o espelho público nasce
> com histórico fresco a cada release, e este arquivo é o que sobrevive à travessia.

## 2.4.12 — 2026-10-04 (achado que ninguém pode consertar e hash copiado errado)

Duas rodadas reais do dev-loop (perfil máximo, harness 2.4.9) terminaram escaladas sem defeito
de comportamento em aberto. Dois defeitos eram do harness.

- **Teste da SPEC é congelado, então sinal da auditoria nele vira pendência.** Sinal P2/P11 da
  auditoria ponytail localizado num arquivo da lista de testes da SPEC vai para
  `ponytail.pendenciasEmTestesDaSpec`, sem confirmador e sem bloquear. Antes virava bloqueante
  que nenhum operário podia corrigir (o hash do teste é comparado a cada iteração), e desde a
  2.4.10 persistia até o teto. A decisão é do script, pelo arquivo; path sem identidade segura
  segue o fluxo normal. Achado de lente em teste da SPEC continua bloqueando.
- **O confirmador julga fato e severidade do sinal da auditoria em campos separados.** O
  veredito só tinha `real`; a severidade desses sinais é uma constante do script, que nenhum
  revisor classificou. Nas duas rodadas, os 27 sinais confirmados traziam "não bloqueante" no
  texto e bloquearam mesmo assim. Agora `real` e `bloqueante` são obrigatórios nesse veredito:
  real e bloqueante vira retrabalho, real e não bloqueante vira pendência com o veredito
  registrado. Campo ausente bloqueia. Finding de lente mantém a severidade da lente; o schema
  da confirmação dele não oferece o campo.
- **Hash de teste com conferência de transporte.** `hashes-testes.mjs` emite
  `<sha256>-<conferência>` (CRC-32 de `path\nsha`) e o controlador recalcula a conferência em JS
  puro, sem filesystem. Uma troca de dois caracteres na cópia feita pelo agente tinha virado
  "teste alterado" num arquivo que nunca mudou; a mesma troca na base do portão TDD faria toda
  validação correta divergir até o teto.
- **Recoleta única da evidência que não confere**, na base (`tdd:hashes`) e em cada validação
  (`hashes:i<N>`), no operário e registrada em `fallbacks`. Duas falhas seguidas encerram como
  `erro` de evidência. Divergência entre duas coletas conferidas continua bloqueante
  automático, sem confirmação e sem recoleta.
- Revisão de contratos `2026-10-04-r6`. A string não mudou entre a 2.4.9 e a 2.4.11, apesar de
  o harness ter mudado: o log de um run dessas versões não as distingue.
- 16 casos novos em `tests/harness-dev-loop.test.mjs` e `tests/hashes-testes.test.mjs`. O
  script real e o controlador rodam juntos num path com acento e símbolo fora do Latin-1, para
  travar as duas cópias do CRC uma contra a outra.

> **Compatibilidade:** o formato dos valores de `hashesDosTestes` e o schema do veredito de
> sinal da auditoria mudaram. Use run novo; não retome com `resumeFromRunId` um run de revisão
> anterior. Nenhum arg da skill mudou.

## 2.4.11 — 2026-09-11

- Auditor e lentes inspecionam Git sem staging; arquivos novos selecionados e stage são apresentados separadamente. A entrega confere todos os paths staged contra o escopo aprovado antes de commit, preservando conteúdo alheio.

## 2.4.10 — 2026-09-09

- Bloqueantes confirmados de duplicação/abstração continuam bloqueando enquanto reaparecem na auditoria. Mudança do cenário exige nova confirmação; refutação e desaparecimento continuam liberando.

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
