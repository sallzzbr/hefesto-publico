# Metodologias de pesquisa — frameworks de pensamento no DISCOVER

> Camada **de pensamento** do DISCOVER (skill `descobrir`). A camada de **fontes** (onde olhar, ferramentas MCP) está em `metodologias-investigacao.md` — as duas se complementam: a fonte diz *de onde vem o dado*, o framework diz *como enquadrar o que ele significa*.
>
> **A IA é a guia, não o cardápio.** Diagnostique a situação, escolha **UM** método pelo roteador abaixo, recomende-o em uma frase com o porquê e deixe o humano confirmar. Nunca liste os três como menu.
>
> Princípio herdado: **investigar é executar** — a IA levanta, o humano decide. E um achado só vira evidência **triangulado**: uma fonte é indício, duas que batem é evidência (alimenta o GATE 1).

## Roteador — da decisão ao método

Toda recomendação de investigação parte desta cadeia, nunca do método:

```
decisão necessária → lacuna de conhecimento → risco de decidir sem ela
→ método → evidência esperada → forma de análise
```

Ao recomendar, explicite os elos em 2-3 frases: qual pergunta o método responde, por que ele é **proporcional ao risco** (decisão barata e reversível merece investigação barata; decisão cara e irreversível merece mais), que evidência esperamos obter e **como essa evidência vai influenciar a decisão**. Se nenhuma decisão fica melhor com a evidência, o método não é necessário — investigação sem decisão dependente é lacuna disfarçada de rigor.

### Escolha pela pergunta, não pela moda

| A pergunta do momento é… | Método | Por quê |
|---|---|---|
| "Pra que o cliente 'contrata' isso? O que ele tenta *fazer*?" | **JTBD** (§1) | Enquadra o problema pela tarefa do usuário, antes de qualquer solução — antídoto ao viés de entrega |
| "O que o cliente sente/reclama, e com que frequência?" | **VOC estruturado** (§2) | Transforma ruído qualitativo (tickets, reviews, NPS) em temas priorizados com peso |
| "Onde no funil o número sangra, e há quanto tempo?" | **Análise dados/funil-coorte** (§3) | Localiza a perda numa etapa/segmento/safra — vira baseline e régua do placar |

> Quase sempre você usa **mais de um em sequência**, não em paralelo: JTBD enquadra → dados localizam onde sangra → VOC explica por quê. Mas apresente um de cada vez.

---

## §1. JTBD — Jobs To Be Done

**Responde:** qual é a *tarefa* (job) que o cliente quer resolver quando "contrata" o produto — o progresso que ele busca, não a feature que usa.

**Como aplicar (IA levanta, humano decide):**
1. Escreva o job no formato **"Quando \<situação\>, eu quero \<motivação\>, para \<resultado esperado\>."** Ex.: *"Quando meu benefício libera, quero antecipar sem burocracia, para cobrir uma conta antes do vencimento."*
2. Separe as três dimensões do job: **funcional** (a tarefa em si), **emocional** (como quer se sentir) e **social** (como quer ser visto). A maioria dos desafios de retenção/conversão sangra na emocional/social, não na funcional.
3. Levante evidência do job real cruzando com as fontes: VOC (§2) mostra a linguagem do cliente; funil (§3) mostra onde ele desiste do job.
4. Liste as **alternativas** que o cliente usa hoje pra fazer o mesmo job (inclusive concorrentes e "não fazer nada") — é o benchmark honesto de reversibilidade.

**Como conecta aos gates:** o job vira a base do **problema reformulado** no DEFINE ("clientes não completam o job X na etapa Y"), e cada dimensão não atendida é candidata a **hipótese**. Evita o clássico "problema = falta a minha feature".

**Sinais de qualidade / armadilhas:**
- ✅ O job descreve o progresso do cliente sem citar nenhuma solução do produto.
- ❌ Job disfarçado de feature ("o job é ter um botão de compartilhar") — isso é solução, volte um passo.
- ❌ Confundir o *comprador* com o *usuário* do job quando são pessoas diferentes.

## §2. VOC estruturado — Voice of Customer com peso

**Responde:** o que o cliente sente e reclama, agrupado por tema e **ponderado por frequência × severidade** — não anedota solta.

**Como aplicar (IA levanta, humano decide):**
1. Colete das fontes de VOC (ver `metodologias-investigacao.md` §5): tickets de suporte, avaliações públicas, reviews de loja (iOS/Android), respostas de NPS, transcrições de atendimento/entrevista 1:1 quando houver.
2. **Codifique em temas** — agrupe verbatims por problema, não por palavra. Conte a frequência de cada tema e estime severidade (o cliente abandona? xinga? só reclama?).
3. Monte a tabela **tema × frequência × severidade × etapa da jornada** — priorize o canto superior (frequente + severo + numa etapa que o funil confirma que sangra).
4. Guarde 2-3 **verbatims por tema forte** — a fala do cliente é a evidência que convence no GATE 1 e a linguagem que o JTBD (§1) usa. **Gate de PII (inegociável):** anonimize antes de guardar — remova nome, CPF/documento, telefone, e-mail, nº de contrato e qualquer dado que identifique a pessoa; **nunca** cole o ticket/print integral no dossiê. O que entra no `descobertas.md` é o verbatim redigido + uma referência segura à fonte (ID interno), nunca o dado bruto.

**Como conecta aos gates:** cada tema forte de VOC é uma **hipótese com evidência qualitativa** ("clientes reclamam de X → H: X está causando a queda em Y"). Triangule com o funil (§3): VOC dá o *porquê*, os dados dão o *quanto*.

**Sinais de qualidade / armadilhas:**
- ✅ O tema #1 de VOC bate com a etapa onde o funil mais sangra (convergência = hipótese forte).
- ❌ Priorizar pelo que gritou mais alto (um review raivoso) em vez do que é frequente E severo.
- ❌ Tratar volume de tickets como verdade absoluta — canais enviesam (quem abre ticket ≠ base toda).

## §3. Análise dados/funil-coorte — onde o número sangra

**Responde:** em qual etapa, segmento e safra o resultado se perde, e há quanto tempo — o baseline que vira o placar.

**Como aplicar (IA levanta, humano decide):**
1. **Funil:** liste as etapas da jornada e a conversão etapa→etapa (ver `metodologias-investigacao.md` §2 pra ferramentas — analytics/warehouse do projeto via MCP por sufixo). Corte por plataforma, canal, segmento. Uma queda **concentrada** vale mais que uma média.
2. **Coorte:** compare safras (quem entrou em jan vs mar) na **mesma régua** — separa "mudou o produto" de "mudou o público".
3. **Régua fixada (inegociável):** toda métrica declara **fonte + janela + filtro + grão**. A mesma transição pode medir 44% num painel e 78% noutro só por régua solta. Sem régua, o número não entra no dossiê nem no placar.
4. Reproduza o número rodando a query você mesmo — se não reproduz, não é baseline, é boato.

**Como conecta aos gates:** este método **produz o placar e o baseline** do DEFINE, com a régua que o GATE 2 exige. A etapa que mais sangra costuma ser o KPI primário; o resto vira métrica de suporte.

**Sinais de qualidade / armadilhas:**
- ✅ Dá pra apontar "a perda é X% na etapa Y, no segmento Z, desde a safra W" — e reproduzir a query.
- ❌ Média que esconde a variância (o iOS está ok, o Android despenca — a média parece "meio ruim").
- ❌ Correlação vendida como causa: uma queda coincidir com uma data não prova o motivo — isso é hipótese a testar, não achado fechado.

---

## Fechamento

**Obrigatório:** o DISCOVER entrega um **mapa do problema triangulado por evidência** (não opinião) — é isso que passa no **GATE 1** e alimenta o problema reformulado, o placar e as hipóteses do DEFINE. Os frameworks §1–§3 entram **conforme a pergunta**, não como checklist: use JTBD (§1) quando o risco é viés de solução; VOC (§2) quando a dor do cliente é o eixo; dados/funil (§3) quando precisa localizar onde sangra e fixar baseline. Um mapa forte costuma triangular dois deles — mas o mínimo é evidência que sustente o GATE 1, não "os três preenchidos".
