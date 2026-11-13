# Tipos de entrega — a trilha certa pra cada artefato

> Carregada no Step 1, quando a entrega não é (só) código de software. A espinha do fluxo é
> a MESMA pra todo tipo: arquivo da entrega com vínculo à hipótese → SPEC com critérios
> verificáveis + gate de prontidão → OK por step → execução → **validação com evidência** →
> log → estado atualizado. O que muda por tipo é COMO se implementa e COMO se valida.
> Não aplique o loop de desenvolvimento de software a tudo.

## Taxonomia

| Tipo | Exemplos | Onde o artefato vive |
|---|---|---|
| **software** | feature, correção, refactor | repo (branch → PR) — fluxo completo do SKILL.md, Steps 0-11 |
| **prompt / skill / agente** | prompt de produção, SKILL.md, agente configurado | repo ou config do usuário |
| **script / consulta / automação** | script utilitário, query salva, cron, integração | repo, warehouse, ferramenta de automação |
| **dashboard** | painel de acompanhamento, scorecard | ferramenta de BI/analytics |
| **documento / processo** | doc de decisão, playbook, processo operacional, comunicação | repo, wiki, ferramenta de docs |
| **experimento** | A/B, fake door, concierge configurado e no ar | plataforma de experimento + registro no desafio |

Entrega mista (ex.: feature + dashboard) → uma entrega por artefato, cada uma com seu tipo,
ou uma entrega com o tipo dominante e os demais como critérios de aceite.

## Adaptação dos steps (não-software)

Os steps do SKILL.md valem com estas substituições — os demais (0.5 portão de desafio, 1, 2,
4 SPEC, 5 log, 11 fechamento) são idênticos:

- **Step 0 (pré-requisitos):** `gh`/git/working tree só se o artefato viver no repo. Fora do
  repo, o pré-requisito vira acesso à ferramenta de destino (BI, warehouse, wiki).
- **Step 3/6 (branch):** só quando o artefato é versionado no repo. Fora dele, registrar no
  arquivo da entrega **onde o artefato vive** (URL/path) e como versioná-lo ou reverter.
- **Step 7 (implementação):** sempre modo **Solo** — o `dev-loop` é **exclusivo de software**
  (portão TDD, testes executáveis, worktrees não se aplicam a um documento ou dashboard).
  O portão TDD vira o **portão de verificação**: antes de produzir o artefato, deixar escrito
  no SPEC *como cada critério de aceite será verificado*. A SPEC usa a variante **SPEC-lite**
  de `../../dev-loop/references/spec-template.md`: mesmos blocos, tabela
  `critério ↔ forma de verificação ↔ evidência esperada` (sem coluna de teste) e Unidades de
  trabalho opcional. Critério sem forma de verificação → volta pro Step 4c.
- **Step 8 (validações):** executar as verificações declaradas, por tipo:
  - *prompt/skill/agente:* rodar contra casos de teste representativos (inclusive adversos) e
    registrar entradas → saídas; skill segue as convenções do repo alvo.
  - *script/consulta:* executar com dados reais ou amostra; conferir resultado contra fonte
    independente (a triangulação de `../../descobrir/references/metodologias-investigacao.md`).
  - *dashboard:* números batem com a régua fixada do dossiê (mesma fonte+janela+filtro+grão);
    leitor consegue tirar a decisão que o mecanismo de acompanhamento previu.
  - *documento/processo:* revisão do dono (e de quem executa o processo); critérios de aceite
    checados um a um.
  - *experimento:* instrumentação confere antes de ligar; leitura honesta depois
    (`../../acompanhar/references/metodologias-acompanhamento.md` §3).
- **Step 9/10 (commit/push/PR):** só para artefatos no repo. Fora dele, a mutação externa
  equivalente (publicar dashboard, ativar automação, ligar experimento) exige o MESMO OK
  explícito — publicar sem OK é o `git push` sem autorização desta trilha.

## Estados da entrega

Vocabulário fechado (campo `**Estado:**` do arquivo da entrega, ver `steps-detalhados.md`):

`planejado → em execução → implementado → validado → entregue`, com os desvios
`parcialmente validado` (parte dos critérios com evidência), `bloqueado` (dependência ou
decisão aberta) e, para software, `pronto para merge` / `pronto para produção` entre
`validado` e `entregue`.

**Regra inegociável:** `validado` (mesmo parcial) só com **evidência registrada no log** —
output de execução, print, número re-medido, review por escrito. Sem evidência, o estado
máximo é `implementado`. "Sinto que funciona" não muda estado.
