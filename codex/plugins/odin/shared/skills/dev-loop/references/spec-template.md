# SPEC — formato canônico (fonte única)

> Paths do workspace resolvem pela regra única em
> `../../descobrir/references/capa-template.md`; os literais neste template são ilustrativos
> do default, não hardcode.

> **Autoria:** a spec de trabalho novo é produzida e aprovada na skill `entregar` (etapa de planejamento),
> usando ESTE formato. O `dev-loop` consome a spec aprovada — e só a autora (etapa 2) no modo
> standalone, formalizando um plano que o humano já aprovou.
>
> Salvar na seção SPEC de `<dirDesafios>/<slug>/entregas/<entrega-slug>.md` (entrega de um desafio) ou em `<dirSpecs>/YYYY-MM-DD-<slug>-spec.md` (avulsa), na branch de trabalho. Os dois diretórios chegam resolvidos pela regra 7 da capa; os defaults são `docs/desafios/` e `docs/plans/`.

## Template

````markdown
# SPEC: <título> [<entrega-slug>]

## Objetivo
<1-3 frases. Se veio de um desafio: qual hipótese testa e qual métrica do placar observa.>

## Critérios de aceite (TODOS verificáveis, TODOS com teste)
| # | Critério | Tipo | Teste que o cobre (path) | Verificação complementar |
|---|---|---|---|---|
| A1 | <comportamento observável que hoje falta ou está errado> | reprodução | `src/.../X.test.ts` (a escrever no portão TDD) | snapshot / curl / preview, se aplicável |
| A2 | <comportamento correto hoje que a mudança não pode quebrar> | preservação | `src/.../X.test.ts` | |

## Non-goals (o que esta entrega NÃO faz)
<corta escopo explicitamente — é aqui que a regra ponytail P1 (não escreva o que não precisa existir) age>

## Restrições
<arquitetura, padrões do projeto, dependências proibidas/permitidas, performance>

## Unidades de trabalho (paralelizáveis)
| # | Unidade | Arquivos/área | Contrato/interface com as outras | Critérios que cobre |
|---|---|---|---|---|
| U1 | | | | A1, A3 |

## Contrato de qualidade
```json
{
  "version": 1,
  "profiles": ["base"],
  "conventions": [{"source": "AGENTS.md", "decision": "Preservar arquitetura documentada, identificadores novos em inglês e documentação útil em português."}],
  "checks": [
    {"id":"Q-NAMES","applicability":"required","reason":"Nomes novos expressam intenção.","paths":["src/receipt.js"],"verification":"review","command":""},
    {"id":"Q-COMMENTS","applicability":"required","reason":"Documentar somente contrato não evidente.","paths":["src/receipt.js"],"verification":"review","command":""},
    {"id":"Q-BOUNDARIES","applicability":"required","reason":"Validar entrada externa antes do domínio.","paths":["src/receipt.js"],"verification":"review","command":""},
    {"id":"Q-TESTABILITY","applicability":"required","reason":"Verificar sucesso e rejeição com oráculo independente.","paths":["tests/receipt.test.js"],"verification":"command","command":"node --test tests/receipt.test.js"},
    {"id":"Q-COHESION","applicability":"required","reason":"Manter cálculo separado de persistência.","paths":["src/receipt.js"],"verification":"review","command":""},
    {"id":"Q-ERRORS","applicability":"required","reason":"Falha de entrada não pode parecer sucesso.","paths":["src/receipt.js"],"verification":"review","command":""},
    {"id":"Q-PROJECT","applicability":"required","reason":"Preservar contratos e configuração existente.","paths":["src/receipt.js"],"verification":"review","command":""}
  ],
  "decomposition": []
}
```
<Exemplo sintético: substituir fontes, alvos, motivos e comando pelos reais. Acrescentar perfis
por área e seus IDs; nenhuma instalação implícita. Para arquivo textual tocado >400 linhas,
incluir {path, trigger, decision, verification} em decomposition. Fonte: quality-contract.md.>

## Validações do projeto
<lint/typecheck/test/ci:local detectados — o "verde" mecânico do loop>

## Riscos
<o que pode dar errado nesta entrega e como mitigar/observar — técnico, de produto ou de dado>

## Dependências
<PRs, releases, packages, acessos, dados, pessoas ou decisões externas de que a entrega depende>

## Definição de pronto
<o que precisa ser verdade pra declarar a entrega concluída, além dos critérios de aceite:
validações verdes, evidência registrada, doc/instrução de uso quando aplicável, rollout/rollback quando aplicável>

## Decisões
### Tomadas
| Data | Decisão | Por quê |
|---|---|---|
### Abertas
| Decisão pendente | Quem decide | Bloqueia o quê |
|---|---|---|

## Gate de prontidão (readout — preencher ANTES do OK final da spec)
- **Suficiente:** <o que já está claro o bastante pra executar com segurança>
- **Incompleto:** <o que ainda falta ou está vago>
- **Risco de avançar agora:** <1-2 frases honestas>
- **Pendências bloqueadoras:** <impedem começar — zeradas ou não há aprovação>
- **Pendências aceitas conscientemente:** <o dono decidiu avançar mesmo assim — registrar o porquê>
````

## Regras do formato (inegociáveis)

- **Contrato de qualidade obrigatório em software**, com seção/bloco únicos e formato de
  `quality-contract.md`. Validar com `spec-ids.mjs <spec> --quality` antes do TDD. Perfis por
  área, convenções e decisões de decomposição são parte da aprovação, não checklist posterior.
  Nenhuma regra base omitida; dispensa só contextual e justificada; alvos relativos concretos.

- **Critério não-verificável não entra.** "Ficar bonito" vira "passa no review visual
  (preview/screenshot) sem finding bloqueante"; "ser rápido" vira número medível.
- **Tipo do critério (coluna `Tipo`):** `reprodução` (default quando a coluna ou a célula
  falta) é o comportamento que hoje está ausente ou errado: o teste falha por asserção antes da
  implementação e passa depois. `preservação` é o controle de um comportamento correto hoje que a
  mudança não pode quebrar: o teste começa verde e continua verde. A SPEC aprovada decide o tipo,
  com o dono; quem escreve o teste não o reclassifica (divergência bloqueia o portão com
  `tipo-divergente`). Só a coluna conta: o sufixo `(R)`/`(P)` no texto do critério não é lido.
  Suíte só de controles não demonstra que a mudança é necessária e não abre o portão sem
  autorização registrada do dono num Loop em perfil `maximo` (no Solo, a entrega passa para o
  Loop; regra canônica em `escada-ponytail.md`) ou rebaseline aprovado na retomada.
- **Todo critério mapeia pra pelo menos um teste executável.** Critério que não dá pra testar
  automaticamente (ex.: visual) precisa declarar explicitamente a verificação complementar
  (preview/screenshot/review) — e é exceção justificada, não regra.
- **Unidades têm contratos explícitos entre si** (tipos, interfaces, props) — é isso que permite
  implementação paralela sem conflito.
- **Uma unidade = implementável e testável de forma independente.** Se duas unidades tocam o
  mesmo arquivo, ou viram uma, ou o contrato define quem cria e quem consome.
- **A tabela `critério ↔ teste` é viva:** o portão TDD a atualiza com os paths reais dos testes
  escritos; critério sem teste = portão aberto = implementação não começa.

## Variante não-software (SPEC-lite)

Entrega não-software (dashboard, documento/processo, prompt/skill/agente, script/consulta sem
teste executável, experimento — trilha de `../../entregar/references/tipos-de-entrega.md`) usa
os MESMOS blocos deste template, com as adaptações abaixo:

- **A tabela de critérios troca teste por verificação** — sem coluna de teste executável:

  | # | Critério | Forma de verificação | Evidência esperada |
  |---|---|---|---|
  | A1 | <comportamento/resultado observável> | <como será conferido: revisão do dono, números batem com a régua, execução contra casos, instrumentação conferida> | <o que entra no log: print, output, review por escrito, número re-medido> |

  É o **portão de verificação** da trilha não-software: critério sem forma de verificação →
  volta pro Step 4c; a evidência registrada no log é o que autoriza o estado `validado`.
- **Contrato de qualidade:** use as regras pertinentes como régua explícita de revisão do
  artefato; o JSON executável e os perfis de software não entram no harness para SPEC-lite.
- **Unidades de trabalho é opcional** — só quando fizer sentido fatiar o artefato.

Marcar o título como `# SPEC-lite: <título> [<slug>]` — é esse marcador que sinaliza a
variante. SPEC-lite **nunca** entra no harness do `dev-loop` (exclusivo de software): o
harness a devolve como `bloqueado`, mandando a entrega rodar no modo Solo da `entregar`.
