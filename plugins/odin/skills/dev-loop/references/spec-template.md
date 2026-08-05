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

```markdown
# SPEC: <título> [<entrega-slug>]

## Objetivo
<1-3 frases. Se veio de um desafio: qual hipótese testa e qual métrica do placar observa.>

## Critérios de aceite (TODOS verificáveis, TODOS com teste)
| # | Critério | Teste que o cobre (path) | Verificação complementar |
|---|---|---|---|
| A1 | <comportamento observável> | `src/.../X.test.ts` (a escrever no portão TDD) | snapshot / curl / preview, se aplicável |

## Non-goals (o que esta entrega NÃO faz)
<corta escopo explicitamente — é aqui que a regra ponytail P1 (não escreva o que não precisa existir) age>

## Restrições
<arquitetura, padrões do projeto, dependências proibidas/permitidas, performance>

## Unidades de trabalho (paralelizáveis)
| # | Unidade | Arquivos/área | Contrato/interface com as outras | Critérios que cobre |
|---|---|---|---|---|
| U1 | | | | A1, A3 |

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
```

## Regras do formato (inegociáveis)

- **Critério não-verificável não entra.** "Ficar bonito" vira "passa no review visual
  (preview/screenshot) sem finding bloqueante"; "ser rápido" vira número medível.
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
os MESMOS blocos deste template, com duas mudanças:

- **A tabela de critérios troca teste por verificação** — sem coluna de teste executável:

  | # | Critério | Forma de verificação | Evidência esperada |
  |---|---|---|---|
  | A1 | <comportamento/resultado observável> | <como será conferido: revisão do dono, números batem com a régua, execução contra casos, instrumentação conferida> | <o que entra no log: print, output, review por escrito, número re-medido> |

  É o **portão de verificação** da trilha não-software: critério sem forma de verificação →
  volta pro Step 4c; a evidência registrada no log é o que autoriza o estado `validado`.
- **Unidades de trabalho é opcional** — só quando fizer sentido fatiar o artefato.

Marcar o título como `# SPEC-lite: <título> [<slug>]` — é esse marcador que sinaliza a
variante. SPEC-lite **nunca** entra no harness do `dev-loop` (exclusivo de software): o
harness a devolve como `bloqueado`, mandando a entrega rodar no modo Solo da `entregar`.
