---
description: "Validate an ad creative render adversarially (deterministic pre-flight + finish crit + the 6 post-render idea tests). Use when the user wants to validate a render, check a creative before approval, or audit creative quality — validar criativo, criticar um render, rodar o crivo de qualidade, squint test, teste de 3 segundos, teste de desfoque, a peça tem ideia?"
---

# Validar Criativo (crítica adversarial)

> Paths do workspace (`marketing/`, `branding/`, `contexto/`, `financeiro/`, `scripts/`) resolvem pela regra única do plugin (`criativo-fluxo/references/defaults.md`: CLAUDE.md do workspace → defaults `local_*` → convenção descoberta no cwd → default documentado); as menções nesta skill são ilustrativas do default, não hardcode.


Roda o crivo de qualidade de um render em **três camadas**: **pre-flight determinístico**
(script Pillow do workspace) + crítica de **acabamento** + os **6 testes de ideia
pós-render** — as duas últimas pelo agent isolado `hermes:validador-de-criativo` (nunca quem
produziu). Postura: **refutar a aprovação até a evidência dizer o contrário**. **Ausência de
erro técnico não é aprovação**: a peça tem de ter uma ideia. Grava report SEMPRE — validação
sem report gravado é validação que não aconteceu. (No fluxo completo, quem roda isto é o
harness de `hermes:criativo-fluxo`; esta skill é o caminho avulso e o contrato dos critérios.)

## Camada 1 — pre-flight determinístico

`.venv/bin/python scripts/validar_criativo.py <render> --formato <feed|story|4-5>
--arquetipo <slug> [--texto-esperado "..."] [--baseline <png-da-vencedora>]` — contraste
WCAG, zona segura, dimensão, texto fiel ao brief, proporção/área de texto (vs baseline),
scrim. Exit ≠ 0 em check bloqueante = fail (warns não derrubam).

- **Área de leitura 1:1 / recorte de superfície** (check nomeado): em formato mais alto que
  quadrado, as superfícies de feed exibem só o quadrado central — texto ou elemento
  essencial fora da banda central = **bloqueante**. O cálculo é do script de pre-flight do
  workspace; a margem de segurança se mede da banda, não da borda do quadro.
- **Limitação conhecida do detector:** silhueta de produto recortado sobre fundo claro é
  lida como glifo (a borda vem tracejada — filtro por comprimento de run não resolve).
  Consequência prática, que vira regra: **produto recortado respeita a mesma margem do
  texto**.

## Camada 2 — acabamento (A-J)

Medem **execução**, não ideia. **Qualquer bloqueante fail = veredito FAIL.** Não existe "só
1 fail vira borderline"; borderline fica reservado a warns/sinalizações.

- **A `arquetipo_correto`** — executa o arquétipo esperado.
- **B `rosto_nao_coberto`** — texto não cobre rosto/olhos do sujeito da foto, pessoa ou
  animal (skip se não há).
- **C `principios_duros`** — regras duras da marca (sem ilustração flat, sem letra escrita
  por IA, sem emoji no overlay, scrim com fade natural).
- **D `fidelidade_referencia`** — **bloqueante quando há baseline de vencedora** do
  arquétipo+segmento: paleta, composição, hierarquia e mood seguem o padrão que converte —
  "tecnicamente correto mas genérico" é o que este critério barra. Sem baseline → sinalização.
- **E `fidelidade_estampa`** — com mockup: texto caractere a caractere, distorção ≤ leve,
  cores/layout fiéis, estampa desobstruída (skip com motivo se não há).
- **F `naturalidade_ia`** — cena crível como fotografia: anatomia, caimento de tecido,
  física de sombra/reflexo (skip se não há imagem IA).
- **G `texto_correto`** — todo texto do render E a copy lidos como PT-BR: ortografia,
  acentuação, **concordância**, pontuação. O determinístico só compara com o brief — se o
  brief tem o erro, só este critério pega. Sinais literais de "soa máquina" que reprovam:
  **travessão e meia-risca em copy de anúncio** (não é pontuação natural de quem escreve
  anúncio em PT-BR — vírgula, ponto ou dois-pontos resolvem).
- **H `legibilidade_thumbnail`** — squint test: avalie como miniatura de feed (~150px). A
  frase principal domina? O texto tem tamanho de anúncio ou de nota de rodapé?
- **I `mensagem_completa`** — o que o brief promete está na peça: oferta, prazo/urgência,
  claim, CTA quando pedidos.
- **J `voz_da_marca`** — copy (headline/body/descrição) contra o documento de tom de voz da
  marca: registro, vocabulário proibido, estrutura. Copy institucional/genérica = fail.
  **Oferta nunca abreviada a ponto de ler como preço**: valor de desconto escrito só como
  número, sem a palavra que o marca como desconto, lê como o preço da peça = fail.

## Camada 3 — ideia: os 6 testes pós-render (K-P) + a headline (Q)

**Critérios de primeira classe: mesmo peso, mesma consequência dos A-J.** Existem porque
acabamento impecável já aprovou peça sem ideia. Rode os sete, sempre, depois do render.

- **K `tres_segundos`** — olhe 3 segundos, como no feed, e escreva em UMA frase o que a peça
  comunicou. Frase genérica ("uma marca de camiseta"), ou precisar reler pra responder = fail.
- **L `miniatura`** — reduza ao tamanho real de feed. H pergunta se o texto continua legível;
  L pergunta se a **ideia** sobrevive: reduzida, a peça ainda diz algo específico ou virou
  mancha bonita?
- **M `desfoque`** — desfoque a peça e olhe só as manchas. O que sobressai tem de ser o que
  MAIS importa (o produto e a informação principal). Painel, selo, fundo ou ornamento
  dominando a mancha = hierarquia invertida.
- **N `exclusao`** — remova mentalmente cada elemento, um por vez. Elemento cuja remoção não
  piora a peça é elemento que sobra — liste-os. Região que não destaca produto, mensagem ou
  ação encolhe ou sai.
- **O `coerencia_imagem_copy`** — arte e copy contam a MESMA ideia. Imagem sobre um assunto
  com headline sobre outro são duas peças coladas, não uma.
- **P `verdade_comercial`** — a peça (imagem E texto) não promete produto, variação, serviço,
  personalização ou condição que o negócio não oferece. O que existe se verifica por
  **lookup** do catálogo/contexto do workspace, nunca de memória.
- **Q `headline_tem_ideia`** — a headline contra os 4 testes de copy (contrato completo em
  `hermes:sugerir-criativos`; aqui eles são **cobrados**): **troca do termo definidor**
  — *só para headline de **hook*** (se o termo que deveria tornar a peça específica — nicho,
  categoria, público, segmento — puder ser trocado por qualquer outro do mesmo tipo sem a frase
  perder sentido, não há ideia). Em **afirmação direta** (a frase nomeia o produto e o público:
  "camisetas para quem tem X") sobreviver à troca é a função, e reprovar por isso mata o formato
  que sustenta conta de nicho — **não aplique**. Frase que não nomeia o produto não é afirmação
  direta: é hook, e o teste vale; **fala
  humana** (leia em voz alta; soou traduzido ou gerado = fail); **"e daí?"** (a frase afirma
  algo sobre o sujeito, não só o nomeia — cumplicidade sem verdade específica = fail);
  **verdade comercial**. Headline reprovada reprova a peça, por melhor que a arte esteja.
  *Exemplo ilustrativo:* "Se você tem um X, você entende" falha duas vezes — X troca por
  qualquer outro do mesmo tipo, e "você entende" não diz o que a pessoa reconhece.

## Veredito — "sem erro técnico" não é aprovação

Aprovar exige as quatro coisas juntas: **ideia específica**, **fala natural**,
**legibilidade** e **correção comercial**. Nenhuma delas sai do pre-flight.

- Determinístico verde + A-J verde + qualquer bloqueante K-Q confirmado = **FAIL**.
- Peça tecnicamente impecável e semanticamente vazia é **REPROVADA** — e o report escreve
  isso com estas palavras: *"tecnicamente impecável, semanticamente vazia — REPROVADA"*,
  nomeando o teste que a derrubou.
- "Todos os checks passaram" é evidência insuficiente pra aprovar. Todo PASS declara, em uma
  frase, o que a peça comunica em 3s e qual é a ideia. Não consegue escrever a frase = não é
  PASS.

## Protocolo

1. Colete paths (render, brief, rota/direção, baseline da vencedora, mockup, copy) — os
   obrigatórios ausentes abortam com mensagem clara.
2. Rode o pre-flight; capture o JSON.
3. Invoque o agent `hermes:validador-de-criativo` via Agent tool (isolamento é obrigatório —
   o produtor tem confirmation bias) com todos os paths; findings só com evidência concreta
   (região/trecho + cenário de dano); na dúvida `plausivel`.
4. Finding plausível → **confirmação** por segunda chamada independente antes de virar
   retrabalho (o validador tem histórico de alucinação: evidência > veredito).
5. Consolide: fail = qualquer determinístico bloqueante fail OU qualquer bloqueante **A-Q**
   confirmado. Ação corretiva pela tabela canônica: **overlay** (recompor sobre a base, custo
   zero) / **ia** (re-gerar imagem-base) / **copy** (reescrever texto do anúncio). Falha de
   ideia (K-Q) que não se resolve trocando a headline nem recompondo **não é caso de
   iteração**: escale pra rota/brief — iterar só melhora o acabamento de uma peça vazia.
6. **Grave SEMPRE** — pass ou fail, avulso ou orquestrado:
   `marketing/registry/criativos/<slug>__validacao_iter<N>.md` (frontmatter: slug, iteracao,
   veredito, criterios_falhos, criado_em + os dois reports formatados) e append em
   `_validacoes.csv` (criar com header `slug,iteracao,veredito,criterios_falhos,criado_em`).

## Calibração (regra de TDD do validador)

Mudou critério ou prompt do validador → rode a suite de calibração contra casos reais do
workspace: renders aprovados devem passar, defeitos conhecidos devem falhar (concordância
errada → G; overlay pequeno → H; oferta/rodapé ausente → I; copy institucional → J; headline
que sobrevive à troca do termo definidor → Q; painel opaco dominando a mancha desfocada → M;
elemento que some sem a peça piorar → N; promessa de produto inexistente → P). **Inclua na
suite ao menos um render tecnicamente impecável e sem ideia — ele TEM de reprovar**; se
passar, a camada 3 não está valendo. Sem calibração verde, a mudança não entra.

## Regras

- Nunca alterar o render, o registry canônico ou a copy — só validar e reportar.
- Subagent que falha/retorna lixo = FAIL com ação "revisar manualmente" (fail-closed).
- Iteração começa em 1. Português BR.
