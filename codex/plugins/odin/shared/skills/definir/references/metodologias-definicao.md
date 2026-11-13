# Metodologias de definição — frameworks de convergência no DEFINE

> Camada de pensamento do **DEFINE** (skill `definir`): fechar o problema, o placar e as hipóteses. Alguns métodos aqui também alimentam a skill `entregar`, onde a alavanca escolhida vira SPEC.
>
> **A IA é a guia, não o cardápio.** Escolha **UM** método pelo roteador, recomende com o porquê, deixe o humano confirmar. Definir é **convergir** — cortar é parte do trabalho, não falha.

## Roteador — escolha pela pergunta

| A pergunta do momento é… | Método | Fase exata |
|---|---|---|
| "Qual é o problema, escrito sem embutir solução?" | **Problem statement** (§1) | Entrada do DEFINE — reforça o portão anti-tarefa |
| "Como podemos abrir opções sem travar na primeira ideia?" | **How Might We** (§2) | Ponte DEFINE→DEVELOP — reenquadra a oportunidade em pergunta generativa |
| "Como conecto o placar às alavancas de forma rastreável?" | **Opportunity Solution Tree** (§3) | Espinha do DEFINE→DEVELOP — resultado → oportunidades → soluções → experimentos |
| "Como escrevo uma hipótese que dá pra testar?" | **Hypothesis canvas** (§4) | Fecha o DEFINE e alimenta a SPEC da skill `entregar` |

---

## §1. Problem statement — o problema sem solução embutida

**Responde:** qual é o problema, escrito como fenômeno observável — quem, quando, qual impacto — sem nomear nenhuma entrega.

**Como aplicar:**
1. Formato: **"\<Segmento\> não consegue / deixa de \<fazer o quê\>, \<quando/onde\>, o que causa \<impacto no placar\>. Evidência: \<achado do DISCOVER\>."**
2. Teste do "sem solução": se a frase contém uma entrega ("falta uma tela de X"), reescreva — isso é solução, não problema.
3. Amarre ao job (JTBD, `../../descobrir/references/metodologias-pesquisa.md` §1) e à etapa que sangra (funil): o problema é o job **não completado** numa etapa específica.

**Como conecta aos gates:** é a primeira metade do **GATE 2**. Um problem statement limpo é o que separa desafio de tarefa — e o que a skill `acompanhar` relê pra detectar degeneração.

**Armadilhas:** ❌ problema que é sintoma ("o NPS caiu" — por quê?); ❌ problema tão amplo que qualquer entrega "resolve"; ❌ problema que já pressupõe a causa (isso é hipótese, não problema).

## §2. How Might We (HMW) — reenquadrar em pergunta generativa

**Responde:** como transformar o problema numa **pergunta que abre soluções** sem fixar na primeira ideia — o motor da divergência do DEVELOP.

**Como aplicar:**
1. Pegue o problem statement (§1) e reescreva como **"Como poderíamos \<verbo\> \<para quem\> \<resultado\>?"** Ex.: *"Como poderíamos reduzir o atrito da antecipação para quem tem o benefício liberado?"*
2. Calibre a **amplitude**: HMW largo demais ("como poderíamos melhorar o app?") não gera; estreito demais ("como poderíamos mover o botão?") já é solução. Gere 2-3 variações em amplitudes diferentes.
3. Cada HMW abre uma rodada de alavancas no DEVELOP — de UI, copy, fluxo, CRM, dado, regra de negócio, processo, arquitetura.

**Como conecta aos gates:** o HMW é a ponte mental entre GATE 2 e GATE 3 — ele pega o problema fechado e reabre o leque de alavancas que a priorização AI-era (`../../desenvolver/references/priorizacao-ai-era.md`) vai ranquear no DEVELOP.

**Armadilhas:** ❌ HMW com solução embutida ("como poderíamos adicionar um chatbot?"); ❌ pular direto pra alavancas sem reenquadrar (você trava na ideia óbvia).

## §3. Opportunity Solution Tree (OST) — do placar às alavancas, rastreável

**Responde:** como conectar, numa árvore, o **resultado** (placar) → **oportunidades** (problemas/necessidades do DISCOVER) → **soluções** (alavancas) → **experimentos** (como testar) — mantendo tudo rastreável até a métrica.

**Como aplicar (IA monta a árvore, humano poda):**
1. **Raiz = o placar** (o KPI primário com régua, do DEFINE).
2. **Oportunidades** = os problemas/jobs descobertos no DISCOVER (JTBD, VOC), como galhos. Uma oportunidade é uma necessidade não atendida, **não** uma solução.
3. **Soluções** = as alavancas candidatas sob cada oportunidade. A "tela nova", o "BFF", o "refactor" entram aqui como galhos que competem — nunca como raiz.
4. **Experimentos** = como cada solução testa a hipótese barato (protótipo, feature flag, A/B).
5. Escolha **uma oportunidade-alvo** por rodada (não ataque a árvore toda) — foco é convergência.

**Como conecta aos gates:** a OST é o artefato que atravessa GATE 2→GATE 3. Ela garante que a alavanca escolhida (a que vai virar SPEC na skill `entregar`) tem linhagem até o placar — o oposto do "fizemos porque pediram". Na skill `acompanhar`, a árvore mostra qual ramo foi validado/refutado.

**Armadilhas:** ❌ oportunidade que é solução disfarçada; ❌ árvore que vira lista de features sem ligação com o placar; ❌ atacar muitas oportunidades ao mesmo tempo (dispersão dentro do próprio desafio).

### A cadeia de derivação da métrica (OST + régua, de ponta a ponta)

Todo indicador do placar deve descer esta cadeia — ela amarra a árvore (§3) à régua fixada do §2 do dossiê:

```
problema → resultado desejado → comportamento esperado → sinal observável
→ indicador → fonte → baseline → meta
```

Os dois elos do meio são os que faltam com mais frequência: **qual comportamento** do usuário/sistema muda se o problema for resolvido, e **qual sinal observável** (evento, registro, log) revela essa mudança. Indicador que não nasce de um comportamento com sinal é métrica de vaidade — mede atividade, não mudança. Classifique cada indicador como **leading** (antecede o resultado) ou **lagging** (confirma o resultado) e declare os **guardrails** (o que não pode piorar enquanto o KPI primário sobe) — campos correspondentes no §2 do `dossie-template.md`.

## §4. Hypothesis canvas — hipótese que dá pra testar

**Responde:** como escrever cada hipótese num formato que já nasce testável — e que vira critério de SPEC na skill `entregar`.

**Como aplicar:**
1. Formato: **"Acreditamos que \<alavanca\> para \<segmento\> vai gerar \<efeito no placar\>. Saberemos que acertamos quando \<métrica + limiar + janela\>. Estaremos errados se \<critério de abandono\>."**
2. Classifique: **forte** (evidência do DISCOVER a sustenta) / **fraca** (plausível, sem evidência) / **não-testável-hoje** (falta instrumentação — e destravar isso pode ser o primeiro entregável).
3. Declare o **critério de abandono** junto com o de sucesso — hipótese sem critério de morte vira dogma.

**Como conecta aos gates:** completa o **GATE 2** (hipóteses escritas e priorizadas). E é a ponte pra execução: o "saberemos que acertamos quando…" vira **critério de aceite verificável** na SPEC da skill `entregar`, que por sua vez alimenta o portão TDD do `dev-loop`. Uma hipótese bem escrita já é meio critério de teste.

**Armadilhas:** ❌ hipótese sem métrica ("vai melhorar a experiência"); ❌ sucesso sem abandono; ❌ hipótese favorita do dono blindada de teste — desafie inclusive essa.

---

## Fechamento

**Obrigatório pro GATE 2:** o problema escrito **sem solução embutida** (§1) e as **hipóteses testáveis com critério de abandono** (§4) — esse é o piso anti-tarefa. How Might We (§2) e Opportunity Solution Tree (§3) entram **quando a pergunta pede** (reabrir o leque de alavancas; tornar rastreável do placar às alavancas) — são poderosos, mas não obrigatórios em todo desafio. Fechado o GATE 2, o DEVELOP recebe uma alavanca escolhida com hipótese pronta pra virar SPEC.
