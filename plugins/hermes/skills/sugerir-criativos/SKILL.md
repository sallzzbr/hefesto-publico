---
description: "Generate a portfolio of 5 complete ad concepts covering distinct angles. Use when the user wants creative concepts or briefs for a product/audience — sugerir criativos, gerar conceitos de anúncio, montar briefs de teste, portfólio de ângulos (escalar vencedor, dor, resultado, prova social, não testado)."
---

# Sugerir Criativos

> Paths do workspace (`marketing/`, `branding/`, `contexto/`, `financeiro/`, `scripts/`) resolvem pela regra única do plugin (`criativo-fluxo/references/defaults.md`: CLAUDE.md do workspace → defaults `local_*` → convenção descoberta no cwd → default documentado); as menções nesta skill são ilustrativas do default, não hardcode.


Gera **5 conceitos completos** prontos pra produção, cada um cobrindo um ângulo distinto —
uma **aposta de portfólio**: 1 conservador, 3 contrastantes, 1 exploratório. Cada conceito
vira um brief com hipótese, arte, copy e critério de teste. **Não chama API de ads** —
trabalha de contexto local + (opcionalmente) a análise de criativos mais recente.

## Os 5 ângulos (não são opcionais)

1. **Escalar o vencedor** — variação direta do melhor anúncio rodando: mesmo hook + mesmo
   framework; muda só formato/visual (ou 1 variável isolada). Extrai volume do provado.
2. **Dor (PAS)** — Problema → Agitação → Solução. Hook = dor do cliente.
3. **Resultado (BAB)** — Before → After → Bridge. Hook = transformação/benefício.
4. **Prova social / UGC** — testimonial, review, momento autêntico, estética lo-fi.
5. **Ângulo não testado** — combinação `hook × framework × arquétipo` identificada como
   ausente pela análise de criativos mais recente (`hermes:analisar-criativos`); sem análise
   disponível, declare o default escolhido e o banner de aviso (abaixo).

## Antes de gerar

Colete (pergunte o que faltar; **não prossiga** sem produto + público + objetivo):
produto/diferencial, público-alvo (persona, dores/desejos), objetivo (conversão/tráfego/
lead), padrão de vencedores (da análise recente ou descrito pelo usuário), insights de
concorrentes (se houver), restrições (mandatórios/proibidos/claims vigentes).

Leia a camada de marca do workspace: princípios criativos, arquétipos canônicos, claims e
ofertas vigentes (**nunca inventar promo**), tom de voz aplicado **com a lista de frases
banidas da marca (lookup obrigatório, nunca de memória)**, personas/mascotes, e a
camada de evidência (vencedoras narradas, frases validadas, análise de criativos mais
recente em `marketing/inteligencia/analises-criativas/` se existir).

## Portão de copy — os 4 testes (nenhum conceito sai sem passar)

> **Esta seção é o contrato canônico dos 4 testes.** Quatro pontos do fluxo os cobram e citam
> este texto como fonte: o Portão 1 de `hermes:criativo-fluxo`
> (`criativo-fluxo/references/portao-de-ideia.md`), o diagnóstico de
> `hermes:evoluir-vencedor`, o critério **Q** de `hermes:validar-criativo` e o agent
> `hermes:validador-de-criativo`. Mudou um teste aqui → propague nos quatro na mesma
> alteração; versão divergente é bug, não variação local.

Copy se aprova por **ideia**, não por acabamento. Rode os quatro testes na headline antes de
escrevê-la no brief e de novo antes de entregar. **Falhou um = reescreve** — não "ajusta
depois na produção", porque na produção ninguém mede isso.

### Passo 0 — declare a categoria da headline (muda quais testes se aplicam)

Nem toda headline tem a mesma função, e aplicar o teste errado reprova peça boa. **Declare a
categoria antes de testar**; categoria não declarada = trate como hook.

| Categoria | O que a headline faz | Exemplo de forma |
|---|---|---|
| **Hook** | cria reconhecimento, humor, dor ou desejo | "quem tem X entende", observação, PAS/BAB |
| **Afirmação direta** | diz **o que é** e **para quem** — é o anúncio se apresentando | "Camisetas para quem tem X" |

**O teste 1 (troca do termo definidor) só vale para hook.** Numa afirmação direta, sobreviver à
troca é a *função*: a frase é um molde que serve a cada segmento com o termo trocado, e a
especificidade vem da segmentação e do produto mostrado, não da frase. Aplicar o teste 1 aqui
reprova exatamente o formato que costuma sustentar conta de nicho.

Os testes **2, 3 e 4 valem sempre**, nas duas categorias.

> ⚠️ Isto não é brecha para voltar à cumplicidade vazia. "Se você tem um X, você entende" **não**
> é afirmação direta: não diz o que se vende nem apresenta o produto — é hook fracassado, e
> continua reprovado. A afirmação direta nomeia o produto; se a frase não nomeia, é hook.

1. **Troca do termo definidor** *(só para headline de **hook** — ver Passo 0)* — o termo que
   deveria tornar a peça específica (nicho, categoria, público, segmento, cenário) pode ser
   trocado por outro do mesmo tipo sem a frase perder sentido? Então a frase não fala do
   sujeito, não fala de nada. Reescreva até a troca **quebrar** a frase. *(Exemplo ilustrativo:
   "Se você tem um gato laranja, você entende" sobrevive intacta com qualquer outra cor ou raça
   no lugar — reprovada.)* Em **afirmação direta**, pule este teste e registre no brief que ele foi pulado
   por categoria — silêncio aqui vira acusação de descuido na revisão.
2. **Fala humana** — leia em voz alta. Soou traduzido, publicitário de estoque ou gerado por
   modelo (paralelismo perfeito demais, adjetivo empilhado, inversão pomposa, "mais que
   um…")? Reprovada. O teste é literal: uma pessoa real diria isso para outra? Dois sinais
   literais de "soa máquina": **travessão e meia-risca em copy** (não é pontuação natural de
   quem escreve anúncio em PT-BR — vírgula, ponto ou dois-pontos resolvem); e **oferta
   abreviada a ponto de ler como preço** — valor de desconto nunca aparece só como número:
   sem a palavra que o marca como desconto, o leitor lê o preço da peça.
3. **"E daí?"** — faça a pergunta à frase. Se a única resposta é "essa categoria/esse público
   existe", não há ideia. A frase precisa **afirmar alguma coisa** sobre o sujeito, não
   apenas nomeá-lo.
4. **Verdade comercial** — a frase não pode sugerir produto, variação, serviço ou
   personalização que a loja não oferece. Confira contra catálogo e claims vigentes do
   workspace **por lookup, na hora** — nunca de memória. Sem certeza do que existe, pergunte;
   não escreva.

**Cumplicidade não é ideia.** Rejeite headline que cria cumplicidade **sem entregar uma
verdade específica** — a fórmula "quem é do grupo X entende / sabe / sente". Ela convida o
leitor pro clube e nunca diz o que ele reconheceu: "você entende" não informa **o quê**.
Troque o convite pela observação — diga a coisa que só quem convive com aquele sujeito sabe,
e a cumplicidade acontece sozinha.

## De onde vem copy que passa

De **comportamento observável**: o que o sujeito faz, onde, quando, contra o quê; a situação
doméstica reconhecível; a contradição (o que a pessoa diz × o que ela faz); a característica
que só quem convive nota. Nunca de adjetivo afetivo genérico — sentimento declarado no lugar
de cena é o atalho que produz frase intercambiável.

- **Frases banidas são camada de marca**: a lista específica vive no workspace (tom de voz
  aplicado / princípios criativos) e se consulta **por lookup** a cada rodada, nunca de
  memória. O padrão a reconhecer é sempre o mesmo: **fórmula afetiva genérica que caberia no
  anúncio de qualquer concorrente trocando só o nome da marca** — se cabe, está banida por
  definição, esteja ou não na lista.

## Cada conceito (bloco completo)

- **Hipótese**: "Apostamos que [público] vai responder a [ângulo] porque [razão ancorada em
  dado/comportamento — cite a fonte]".
- **Observação humana**: em 1 frase, a verdade específica observável que sustenta a headline.
  Sem ela o conceito não é escrito — headline sem observação é template com palavra dentro.
- **Arte**: arquétipo (slug canônico da marca), formato, composição executável (plano
  principal, ambiente, texto sobreposto exato ≤ ~5 palavras + posição, cor dominante),
  orientação.
- **Copy**: headline (≤125 chars) **aprovada nos 4 testes** — declare no brief o resultado do
  teste de troca do termo definidor —, body (situação → desenvolvimento conforme framework →
  CTA com oferta vigente), CTA button (valores da plataforma: `SHOP_NOW`, `LEARN_MORE`...),
  URL destino. Copy **original** — inspirar em padrão de concorrente, nunca copiar texto.
- **Teste**: variável isolada vs anúncio referência (**exatamente UMA**), sinal de sucesso e
  critério de pausa **ancorados no CAC alvo do unit-economics mais recente** — nunca números
  de memória; sem relatório disponível, declare faixa e marque "ajustar com o humano".

## Gravação

6 arquivos em `marketing/criativos/briefs/`: `AAAA-MM-DD-<tema>-c1.md` … `-c5.md` (um por
conceito, frontmatter: tema, angulo, publico_alvo, objetivo, observacao_humana, criado_em,
status: a-produzir, baseado_em_analise) + `-backlog.md` (tabela-resumo com prioridade 🔴 evidência / 🟡 clássico
/ 🟢 exploração e links).

## Regras

- **Nunca fabricar dados de performance** — número citado tem fonte (análise, snapshot,
  unit-economics ou o próprio usuário).
- Conceito com headline reprovada em qualquer um dos 4 testes **não entra no backlog**:
  reescreve ou cai. Ângulo obrigatório não é licença pra entregar frase vazia — se o ângulo
  não rendeu ideia, diga isso e proponha o que falta descobrir sobre o público.
- Rodou sem análise de criativos recente (>30d ou inexistente) → banner no topo do backlog:
  "⚠️ Conceitos baseados só em contexto da marca, não validados em padrões da conta".
- Saída é briefing: esta skill não produz arte nem publica. Próximo passo:
  `hermes:criativo-fluxo` (fluxo completo com rotas) por brief aprovado — o portão de ideia de
  lá refaz os 4 testes antes de qualquer imagem; brief que já chega aprovado poupa uma volta.
- Português BR.
