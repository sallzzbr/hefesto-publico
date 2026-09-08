# Metodologias de acompanhamento — frameworks do checkpoint

> Camada de pensamento da skill `acompanhar`: re-medir o placar com honestidade e decidir perseverar/pivotar/encerrar. Alimenta as 5 perguntas do checkpoint.
>
> **A IA é a guia, não o cardápio.** Escolha **UM** método pelo roteador, recomende com o porquê, deixe o humano confirmar.
>
> Regra de ouro herdada: **mesma régua sempre** (fonte + janela + filtro + grão). Trocar a régua pra o número ficar bonito é o pecado capital do checkpoint.

## Roteador — escolha pela pergunta

| A pergunta do momento é… | Método |
|---|---|
| "O placar mexeu, mas a métrica-guia demora — o que olho enquanto isso?" | **North Star + input metrics** (§1) |
| "Esse número já é resultado final ou é sinal adiantado?" | **Leading vs lagging** (§2) |
| "Rodamos uma alavanca isolada — ela funcionou de verdade?" | **Experiment readout / A-B** (§3) |
| "Como amarro isso ao ritmo de OKR da área?" | **OKR check-in** (§4) |
| "Por onde vamos PERCEBER o resultado no dia a dia?" | **Mecanismo de acompanhamento** (§5) |

---

## §1. North Star + input metrics

**Responde:** qual é a métrica-guia do desafio e quais **métricas de entrada acionáveis** a movem — pra medir progresso antes do resultado final chegar.

**Como aplicar:**
1. Nomeie a **North Star** do desafio (normalmente o placar primário) e monte a árvore de **inputs**: as 3-5 métricas que, se movidas, movem a guia. Ex.: North Star "contratos ativos renovados" ← inputs "logins recorrentes", "aceite de termo", "conclusão do fluxo".
2. Todo checkpoint reporta os **inputs** mesmo quando a North Star ainda não reagiu — é o que separa "está andando" de "está parado".
3. Cada input carrega a **mesma régua fixada** do dossiê.

**Como conecta ao checkpoint:** responde a pergunta 2 ("o placar andou?") com granularidade — se a guia não mexeu mas os inputs certos mexeram, é sinal de perseverar; se nem os inputs mexeram, é sinal de pivotar.

**Armadilhas:** ❌ input que ninguém controla (não é acionável); ❌ árvore de inputs que não fecha matematicamente na guia; ❌ celebrar input sem olhar se a guia responde depois.

## §2. Leading vs lagging indicators

**Responde:** este número é **lagging** (resultado final, demora, difícil de mover) ou **leading** (sinal adiantado, move primeiro, prevê o lagging)?

**Como aplicar:**
1. Classifique cada métrica do placar: **lagging** (ex.: retenção 90d, receita) vs **leading** (ex.: primeiro login, ativação D1).
2. No checkpoint, leia o **leading primeiro** — ele diz pra onde o lagging vai antes de o lagging virar. Um leading positivo com lagging ainda parado ≠ fracasso; é cedo.
3. Se você só tem lagging, o primeiro entregável da próxima rodada pode ser **instrumentar um leading** (gap de dado é achado, ver `../../descobrir/references/metodologias-investigacao.md` §6).

**Como conecta ao checkpoint:** evita o erro de encerrar/pivotar cedo demais (lagging ainda não virou) ou tarde demais (leading já apontava fracasso há 2 checkpoints). Informa diretamente a **decisão de arquiteto** (perseverar/pivotar/encerrar).

**Armadilhas:** ❌ tratar leading como resultado ("ativação subiu, desafio vencido" — e a retenção?); ❌ leading que não tem relação causal comprovada com o lagging (é só correlação).

## §3. Experiment readout / A-B — a alavanca funcionou mesmo?

**Responde:** o movimento no placar veio da alavanca ou do acaso/sazonalidade? Leitura honesta de experimento.

**Como aplicar:**
1. Antes de declarar vitória, cheque: havia **grupo de controle** ou baseline comparável? O **tamanho de amostra** sustenta a conclusão? O efeito é **significante** ou está dentro do ruído?
2. Reporte o efeito com **intervalo**, não ponto ("+3 a +7pp", não "+5pp cravado"). Declare a janela e se houve sazonalidade concorrente.
3. Se o experimento foi inconclusivo, isso **é** o achado — não force narrativa. Hipótese fica **pendente**, não validada.

**Como conecta ao checkpoint:** é o rigor por trás da pergunta 3 ("o que aprendemos?"). Uma hipótese só vira **validada/refutada** com leitura honesta; sem isso, vira "sinto que funcionou" — exatamente o "sinto que melhorou" da lista NUNCA fazer.

**Armadilhas:** ❌ p-hacking / olhar o resultado e escolher a métrica que deu bom; ❌ parar o teste quando ficou bonito; ❌ confundir ausência de significância com prova de que não funciona.

## §4. OKR check-in

**Responde:** como o placar do desafio conversa com os Key Results da área — pra o desafio não virar uma ilha desalinhada do ritmo da empresa.

**Como aplicar:**
1. Mapeie o placar do desafio pro **KR** que ele serve (se não serve nenhum, isso é uma conversa de arquiteto: o desafio está no roadmap certo?).
2. No check-in, reporte **confiança** no KR (on-track / em risco / atrasado) com a evidência do placar — não só o número, a leitura.
3. Alinhe a **cadência** do checkpoint com a cadência de OKR da área, pra o aprendizado do desafio entrar na revisão certa.

**Como conecta ao checkpoint:** dá a moldura externa pra decisão de arquiteto — perseverar/pivotar/encerrar também considera o alinhamento com os KRs vigentes, não só a saúde interna do desafio.

**Armadilhas:** ❌ inventar um KR pra justificar o desafio a posteriori; ❌ reportar % de progresso sem a leitura de confiança; ❌ desafio que não serve KR nenhum e ninguém questiona.

## §5. Mecanismo de acompanhamento — nem sempre é dashboard

**Responde:** qual mecanismo vai nos permitir **perceber o resultado e tomar uma decisão** — a pergunta certa não é "que dashboard montar", é "por onde a decisão vai chegar".

**Como aplicar:**
1. Escolha o mecanismo pela cadência e pelo custo, não pelo hábito: **consulta re-executada** (o default do odin — a IA roda a mesma query do plano de mensuração a cada checkpoint), **alerta** (quando cruzar um limiar, avise — bom pra guardrails), **scorecard/relatório periódico** (quando várias pessoas precisam ler), **planilha** (quando a coleta é manual e pequena), **análise de experimento** (§3, quando há A/B rodando), **revisão periódica/rotina operacional** (quando o sinal é qualitativo ou de processo). Dashboard só quando alguém vai **olhar recorrentemente** — dashboard sem leitor é instrumentação de vaidade.
2. Amarre o mecanismo ao **plano de mensuração** do dossiê (§8): cada indicador declara fonte, fórmula, quem mede, frequência, janela, segmentos e limitações. Se o dado não existe, o mecanismo começa por um **plano de instrumentação** (gap é achado — `../../descobrir/references/metodologias-investigacao.md` §6).
3. Defina **antes** o que dispara cada decisão: que leitura representa sucesso, falha ou inconclusivo — e o que se faz em cada caso (continuar, iterar, ampliar, interromper, investigar de novo). É o critério de sucesso/abandono do plano da rodada operacionalizado.

**Como conecta ao checkpoint:** o mecanismo é o *como* das perguntas 2 e 3 do checkpoint. Sem ele, o acompanhamento vira evento heroico (alguém lembra de medir); com ele, vira rotina que produz decisão.

**Armadilhas:** ❌ dashboard como resposta automática ("acompanhar = dashboard"); ❌ mecanismo sem dono nem cadência; ❌ alerta sem limiar decidido antes (todo número vira "interessante" e nada vira decisão).

---

## Fechamento

**Obrigatório em todo checkpoint:** o placar re-medido na **mesma régua** e a **decisão** explícita (perseverar/pivotar/encerrar) — isso nunca é opcional. Os métodos §1–§5 entram **só quando a pergunta do roteador se aplica**: North Star/leading-lagging (§1/§2) quando o placar é lagging e você precisa de sinal adiantado; experiment readout (§3) quando houve experimento/alavanca isolada; OKR check-in (§4) quando o desafio serve um KR; mecanismo de acompanhamento (§5) quando ainda não está claro por onde o resultado vai ser percebido no dia a dia. Um checkpoint sem experimento rodando não "falha" por não ter §3 — só não usa §3. O aprendizado durável (hipótese validada/refutada, régua corrigida, alavanca que funcionou) vira registro no Diário do placar (`dossie.md`) e no post-mortem da capa.
