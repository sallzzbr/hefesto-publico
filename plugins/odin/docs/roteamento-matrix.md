# Matriz de roteamento — Odin

Teste manual antes de cada release: a description do frontmatter é o que decide a ativação
inicial; as frases abaixo cobrem as colisões prováveis entre as 6 skills.

**Versão executável:** cada frase tem um caso de `claude plugin eval` em `../evals/roteamento/`
(prompt = a frase; grader = qual banner de ativação deve aparecer). Antes de release, rodar
`claude plugin eval plugins/odin` além da auditoria manual. Limitação: o comando está em early
access (na CLI 2.1.211 ainda não executa) — o esqueleto segue o formato documentado e a
auditoria manual permanece obrigatória até ele liberar (`../evals/README.md`).

> **Última auditoria:** 2026-09-02 (v2.4.7) — a superfície de ativação segue a da v2.2.0:
> nenhuma `description` mudou entre v2.2.0 e HEAD (verificado por diff), então os vereditos
> abaixo continuam válidos sem re-rodar as 43 frases. O que entrou: a estrutura dos 43 casos
> de `../evals/` passou a ser travada por teste (`tests/evals-formato.test.mjs`) — frase ↔
> caso, seções do grader e banners existentes.
>
> **Auditoria anterior:** 2026-07-20 (v2.2.0) — **nada mudou na superfície de ativação**: a v2.2
> mexeu só em corpo de skill, agentes, harness e references (Fable com fallback pro arquiteto,
> regras ponytail P1–P18, auditoria ponytail em código). Nenhum frontmatter de skill foi tocado,
> nenhuma `description` alterada — a matriz abaixo segue válida sem re-rodar as 43 frases.
>
> **Auditoria anterior:** 2026-07-20 (v2.1.0) — a `entregar` ganhou gatilhos de retomada e uma
> âncora pra artefato encomendado ("me pediram uma tela/página/feature de..."), sem a qual a
> frase 43 caía na `descobrir`; o gatilho inglês virou "resume work on the delivery" porque
> "resume" isolado colidia com a frase 18 ("Resume a issue #42"). Frases 15, 18-20, 25-26,
> 28-29 e 33-41 re-checadas: veredito mantido. Menor margem hoje: 26 × retomada, 40 (só a
> exclusão nominal de dashboard na `dev-loop` segura) e 36 × `acompanhar`.
>
> **Auditoria v2.0.0:** 2026-07-19 — rode cada frase mentalmente contra as
> descriptions e corrija o frontmatter (não a matriz) quando divergir. Nesta auditoria:
> vocabulário migrou pra "desafio" (frases com "missão" testam o sinônimo, que as
> descriptions mantêm de propósito); `dev-loop` declarou "somente software" (frase 40);
> `acompanhar` ganhou experimento/A-B + inglês (frase 38 agora tem gatilho lexical);
> `desenvolver` ganhou fake door/concierge; `entregar` excluiu documento SOBRE o desafio.
> Frases 15, 18-20, 28-29 e 33-38 re-checadas: veredito mantido.

## Auditoria Codex — 2026-11-03

Esta coluna registra auditoria manual das descriptions nativas, frase a frase, incluindo os
anti-gatilhos. Não é execução de modelo e não prova seleção automática pelo host. Os testes
de contrato verificam presença dos gatilhos/exclusões e integridade da matriz, não qualidade
de roteamento. Uma avaliação com modelo real deve registrar modelo, inputs e saídas separados.

No Codex, `desafio` e `defaults` são skills nativas; `/spec` corresponde a `entregar` somente
até o gate de SPEC. `desafio` fica restrita à navegação explícita; intenção clara seleciona
sua etapa diretamente. Referências históricas a comandos não exigem runtime de slash commands.

| # | Frase | Deve ativar | Não deve ativar | Observação | Codex: auditoria manual e evidência |
|---|---|---|---|---|---|
| 1 | "Recebi a missão de aumentar a recorrência de compra" | `descobrir` | `entregar` | desafio novo | `descobrir` — missão nova |
| 2 | "A conversão do checkout caiu de 3,1% pra 2,4%" | `descobrir` | `acompanhar` | sintoma sem desafio em andamento | `descobrir` — conversão caiu; acompanhar exclui sintoma isolado |
| 3 | "Quero investigar por que as vendas caíram em junho" | `descobrir` | `definir` | investigação divergente | `descobrir` — investigar por que |
| 4 | "Já investiguei; fecha o problema e fixa o placar" | `definir` | `descobrir` | descobertas em mãos | `definir` — descobertas em mãos, fecha problema |
| 5 | "Escreve as hipóteses da missão de recorrência" | `definir` | `desenvolver` | DEFINE | `definir` — escreve hipóteses |
| 6 | "Implementar BFF no app" | `definir` | `entregar` | desafio técnico sem placar | `definir` — BFF sem placar |
| 7 | "Refatorar a arquitetura pra acelerar releases" | `definir` | `dev-loop` | técnica habilitadora | `definir` — arquitetura sem placar |
| 8 | "Criar um design system novo" | `definir` | `entregar` | solução pronta vira problema+placar | `definir` — design system sem placar |
| 9 | "Quais alavancas atacamos primeiro? O dossiê está pronto" | `desenvolver` | `definir` | DEVELOP | `desenvolver` — alavancas com dossiê |
| 10 | "Prioriza as opções pelo que aprendem e se dá pra reverter" | `desenvolver` | `entregar` | priorização AI-era | `desenvolver` — aprendizado e reversibilidade |
| 11 | "Essa solução é barata de fazer com IA, mas será que vale?" | `desenvolver` | `entregar` | aprendizado antes de custo | `desenvolver` — barata com IA mas será que vale |
| 12 | "Monta o plano da rodada com as entregas" | `desenvolver` | `entregar` | fecha o Diamante 2 | `desenvolver` — plano da rodada |
| 13 | "Faz a entrega frete-no-carrinho do plano" | `entregar` | `desenvolver` | entrega ligada a hipótese | `entregar` — entrega do plano |
| 14 | "Implementa o botão de compartilhar no perfil" | `entregar` | `descobrir` | pedido de código (Step 0.5 decide se desafia) | `entregar` — implementa botão |
| 15 | "Faz uma tela nova pra melhorar retenção" (sem hipótese) | `entregar` → portão 0.5 roteia `/desafio` | implementação direta | desafio disfarçado | `entregar → desafio` — tela antes de hipótese, portão 0.5 |
| 16 | "Corrige esse bug de login" | `entregar` | `descobrir` | bug claro | `entregar` — corrige bug |
| 17 | "Pega a issue #42 e implementa" | `entregar` | — | intenção de código | `entregar` — issue e implementa |
| 18 | "Resume a issue #42" | nenhum/fluxo direto | `entregar` | leitura/análise | `nenhum` — exclusão resumo/status de issue |
| 19 | "Status da entrega frete-no-carrinho" | nenhum/fluxo direto | `entregar` | status, não codar | `nenhum` — exclusão status de entrega isolada |
| 20 | "Hotfix urgente em produção: checkout caiu" | nenhum (fora de scope) | `entregar` | anti-gatilho explícito | `nenhum` — hotfix urgente excluído |
| 21 | "Escreve a SPEC da entrega X, não implementa" | `/spec` (entregar até o gate) | `dev-loop` | spec sem implementação | `entregar` — só SPEC, termina no gate |
| 22 | "Roda o dev-loop nessa spec aprovada" | `dev-loop` | `entregar` | spec existente | `dev-loop` — software com SPEC aprovada |
| 23 | "Implementação multi-agente desse bug, sem spec" | `entregar` | `dev-loop` | precisa spec primeiro | `entregar` — dev-loop exclui multi-agente sem SPEC |
| 24 | "Roda o loop em modo econômico" | `dev-loop` (se há spec) | — | perfil não substitui spec | `dev-loop` — modo econômico nesta execução, exige SPEC |
| 25 | "Como está a missão de recorrência? O placar andou?" | `acompanhar` | `descobrir` | desafio em andamento | `acompanhar` — missão em andamento e placar |
| 26 | "Em que fase estamos?" | `acompanhar` | — | posição no diamond | `acompanhar` — em que fase estamos |
| 27 | "Post-mortem da missão do checkout" | `acompanhar` | `descobrir` | encerramento | `acompanhar` — post-mortem |
| 28 | "Revisar a apresentação sobre a missão" | nenhum | `acompanhar` | documento não é checkpoint | `nenhum` — apresentação SOBRE excluída |
| 29 | "Workshop sobre métricas e missões" | nenhum | `descobrir` | conversa SOBRE desafios | `nenhum` — workshop SOBRE excluído |
| 30 | "Why did churn get worse?" | `descobrir` | `entregar` | inglês, problema aberto | `descobrir` — why did churn get worse |
| 31 | "Run the dev-loop until the approved spec passes" | `dev-loop` | `entregar` | inglês, spec aprovada | `dev-loop` — approved spec passes |
| 32 | "Muda meu perfil de custo padrão" | `/defaults` | `entregar` | preferência local | `defaults` — perfil de custo padrão |
| 33 | "Monta o dashboard de acompanhamento da missão de recorrência" | `entregar` (tipo dashboard) | `acompanhar` | construir o mecanismo é entrega; ler o placar é acompanhar | `entregar` — construir dashboard; acompanhar exclui construção |
| 34 | "Escreve o processo de onboarding da entrega X" | `entregar` (tipo documento/processo) | nenhum | entrega não-software do plano | `entregar` — processo do plano |
| 35 | "Cria a skill de triagem prevista no plano" | `entregar` (tipo prompt/skill/agente) | `dev-loop` | dev-loop é exclusivo de software | `entregar` — skill; dev-loop exclui skill |
| 36 | "Configura o experimento A/B da alavanca de frete" | `entregar` (tipo experimento) | `acompanhar` | ligar o experimento é entrega; ler o resultado é acompanhar | `entregar` — configurar experimento; acompanhar lê resultado |
| 37 | "Automatiza o relatório semanal da missão" | `entregar` (tipo script/automação) | `acompanhar` | idem 33 | `entregar` — automação; acompanhar exclui construção |
| 38 | "Analisa os resultados do experimento que rodou" | `acompanhar` | `entregar` | leitura de resultado, não produção de artefato | `acompanhar` — resultados do experimento |
| 39 | "Abre um desafio novo: reduzir o churn do onboarding" | `descobrir` | `entregar` | vocabulário novo | `descobrir` — desafio novo |
| 40 | "Roda o dev-loop nessa spec pra montar o dashboard" | `entregar` (Solo, tipo dashboard) | `dev-loop` | dev-loop é somente software (frontmatter) | `entregar Solo` — dev-loop exclui dashboard mesmo com SPEC |
| 41 | "Monta um fake door pra testar a demanda por frete grátis" | `desenvolver` | `entregar` | teste barato de alavanca, antes de virar entrega | `desenvolver` — fake door antes da entrega |
| 42 | "Quero melhorar o engajamento do app" (sem entrega definida) | `descobrir` (abertura decisão-first normal) | portão anti-tarefa (diagrama "solução pronta") | problema vago de novato: condição necessária do portão ausente — nenhuma entrega/solução definida antes do problema; falta de número/hipótese/dado é agravante, não gatilho | `descobrir` — engajamento sem entrega definida |
| 43 | "Me pediram uma tela de gamificação pra melhorar o engajamento" | `entregar` → portão 0.5 roteia `/desafio` | implementação direta | condição necessária presente (entrega antes do problema) + agravantes (sem número/hipótese, "me pediram") | `entregar → desafio` — me pediram uma tela, portão 0.5 |
