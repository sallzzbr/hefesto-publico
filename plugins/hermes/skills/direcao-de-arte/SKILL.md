---
description: "Decide the art direction of an ad creative before any production. Use when the user wants visual routes, aesthetic decisions or reference anchoring for a brief — direção de arte, decidir arquétipo e paleta, ancorar criativo em referência, propor rotas visuais sem gastar API."
---

# Direção de Arte

> Paths do workspace (`marketing/`, `branding/`, `contexto/`, `financeiro/`, `scripts/`) resolvem pela regra única do plugin (`criativo-fluxo/references/defaults.md`: CLAUDE.md do workspace → defaults `local_*` → convenção descoberta no cwd → default documentado); as menções nesta skill são ilustrativas do default, não hardcode.


Entre o brief e a produção, decide a direção estética como um diretor de estúdio: interroga
o brief, monta a prancheta e propõe rotas visuais executáveis — **cada escolha ancorada em
referência real**. Não gera imagem: decide. (No fluxo completo, quem roda isto é o harness
de `hermes:criativo-fluxo` via agent `hermes:diretor-de-arte`; esta skill é o caminho avulso
e o contrato do método.)

**Ordem inegociável: ideia → hierarquia → composição.** Nunca comece pelo template encaixando
uma frase dentro dele. Primeiro UMA ideia clara, depois a ordem de leitura dela, só então a
composição que serve essa ordem. Template escolhido antes da hierarquia é rota nascida errada.

## Princípios de design (inegociáveis, valem pra qualquer marca)

1. **Uma mensagem por peça** — rota que precisa de duas ideias são duas rotas.
2. **Hierarquia é semântica, não tamanho** (seção abaixo): a maior informação da peça carrega
   o principal significado; um único elemento dominante e o olho percorre na ordem da mensagem.
3. **Contraste, alinhamento, proximidade, repetição** — declare onde cada um trabalha.
4. **Respiro**: white space é decisão, não sobra.
5. **Tipografia disciplinada**: ≤ 2 famílias, papéis fixos (a identidade visual da marca diz quais).
6. **Legibilidade em thumbnail é critério de composição**, não de revisão.
7. **Nenhuma decisão tácita**: toda escolha cita a referência que a ancora (vencedora >
   concorrente > inspiração) ou o trecho do brief que a exige.
8. **A camada de marca do workspace vence**: princípios duros, arquétipos e identidade visual
   do workspace são contrato. Em conflito, a marca ganha da sua ideia.

## Hierarquia semântica (antes de qualquer estilização)

Hierarquia **não** é "deixar algumas palavras maiores". Antes de escolher corpo, peso, cor ou
posição, responda as quatro perguntas — rota que não as responde está incompleta:

1. **Qual informação deve ser compreendida primeiro?**
2. **Qual informação completa ou muda o significado da primeira?**
3. **Qual é o produto?** (o que se vende, visível na peça)
4. **Qual ação deve acontecer?**

Só então estilize, seguindo essa ordem de leitura. Regras duras:

- **A maior informação da peça contém o principal significado.** Se o elemento dominante for
  lido sozinho e não informar nada, a hierarquia está invertida — reescreva a rota.
- **Proibido ampliar expressão vazia** só porque "parece punchline". Cumplicidade sem verdade
  específica não vira headline dominante; vira ruído grande.
- Cada nível da hierarquia existe porque responde a uma das quatro perguntas. Elemento que não
  responde a nenhuma **não entra na peça**.

## Economia da peça (teto de elementos e de espaço)

Uma peça vende **uma** ideia. Teto por peça:

- 1 headline;
- 1 linha complementar — só quando necessária;
- o produto;
- 1 oferta **ou** 1 CTA (não os dois disputando atenção);
- assinatura discreta da marca.

**Proibido empilhar** headline + parágrafo + lista de benefícios + selo + mockup + estampa +
oferta + CTA na mesma peça. Detalhe, benefício e prova pertencem à **página de destino** ou a
um **criativo de prova específico** — proponha outra peça em vez de espremer tudo nesta.

**Toda área visual justifica o espaço que ocupa.** Região que não destaca produto, mensagem ou
ação é reduzida ou removida — inclusive faixas, fundos e blocos decorativos herdados do template.

**Anúncio de produto:** o produto real — e a arte aplicada nele (estampa/print), quando houver
— é o elemento visual principal. A oferta **não** pode ganhar mais atenção que ele: primeiro a
pessoa deseja a peça, depois percebe a condição promocional.

## Contraste sem painel

**Painel opaco grande não é estrutura automática.** Bloco chapado ocupando meia peça vira
página de destino comprimida e rouba o protagonismo do produto. Quando o texto precisar de
contraste, escolha e **declare** uma destas quatro:

1. **caixa ajustada ao conteúdo** (respira o texto, não a peça inteira);
2. **gradiente localizado**, só sob o texto;
3. **texto em área negativa da imagem** (céu, parede, fundo liso já existente na foto);
4. **card pequeno sobreposto** à fotografia.

**Recurso automático exige justificativa por rota:** caixa-alta, contorno, sombra, fonte
inclinada e centralização são permitidos, nunca default. Cada um que a rota usar vem com o
motivo escrito ("caixa-alta só na oferta, pra separar do corpo"). Sem motivo, não usa — efeito
empilhado lê como amador e derruba a percepção de qualidade do produto.

## Recorte de superfície (área de leitura 1:1)

Superfícies de feed **recortam formato mais alto que quadrado para o quadrado central** — o
que estiver fora dele simplesmente não é exibido. Regra de composição, não de revisão:

- **Tudo que carrega a mensagem** — headline, produto, oferta, assinatura — mora na **banda
  central** (em 4:5, o quadrado central do quadro). O que sobra acima e abaixo é respiro
  descartável, nunca conteúdo.
- **Margem de segurança se mede da BANDA, não da borda do quadro**: elemento "dentro da
  margem" do quadro alto pode estar inteiro fora do quadrado que o feed exibe.
- Formatos derivados (story, 1:1) são **recomposições**, não recortes da peça alta.

## Produção sobre produto

Princípios de estúdio para peça em que o produto físico aparece — cada um nasceu de defeito
real que passou por composição "correta":

**Fotografia de produto**

- **Recorte de e-commerce é catálogo, não anúncio.** A foto de listagem serve pra escolher,
  não pra desejar — anúncio pede tratamento (luz direcional, textura visível, enquadramento
  decidido), não a foto da vitrine colada num fundo.
- **Sombra de contato obrigatória** em produto sobre superfície ou fundo: é a ausência dela
  que faz a peça parecer colada — não a qualidade do recorte.
- **Mockup vem da fonte oficial do produto** (o canal onde ele é vendido), nunca de arquivo
  solto em pasta local: se a peça não está na fonte oficial, ela não está à venda e não
  entra em anúncio.
- **Coleção usa template único**: mesmo tipo de foto, mesma escala, mesma direção de luz,
  peças alinhadas pela base. Fotos de fontes misturadas não formam sistema — e nenhum ajuste
  de layout conserta isso.
- **Peça escura não sobrepõe peça escura** (nem fundo escuro): sem separação de valor o
  produto some e sobra texto flutuando.

**Estampa sobre cena**

- **Geometria de impressão é atributo do PRODUTO, medida nele** — nunca média de loja.
  Posição e proporção da arte variam por produto; um número médio erra em todos.
- **Conteúdo ≠ canvas:** antes de escalar ou posicionar uma arte, recorte o bounding box do
  conteúdo real — escalar o canvas inteiro (com as margens vazias junto) entorta toda a
  conta de proporção.
- **Textura modulada por luminância SUAVIZADA:** modular a arte pela luminância crua do
  tecido serrilha traço fino; suavize o mapa antes de aplicar.
- **Posição medida no produto real, nunca estimada:** estimar de olho bate na gola ou sai do
  peito — meça na foto do produto e grave a medida.

**Quadro montado vence cena recortada.** Quando a cena gerada/fotografada não fecha o
layout, recortar troca um defeito por outro. Monte a superfície no tamanho do quadro e
posicione o produto onde a hierarquia pede — a peça nasce no formato, não é adaptada a ele.

**Portfólio: duas peças não argumentam a mesma coisa.** Duas peças do mesmo conjunto com o
mesmo argumento canibalizam o leilão e tornam o resultado inatribuível. Diferencie o
**argumento**, não só a arte.

## Processo

1. **Briefing interrogado — o mínimo inclui a ideia** — produto, público, objetivo, UMA
   mensagem central **e a ideia aprovada no Portão 1** consolidada no brief: observação humana,
   headline aprovada nos 4 testes de copy e hierarquia de leitura (contrato em
   `criativo-fluxo/references/portao-de-ideia.md`). Faltou o mínimo → devolva o que falta; não
   complete com suposição. **Brief sem ideia não vira rota**, inclusive neste caminho avulso —
   as rotas daqui alimentam o estágio `produzir`, que não reabre a questão da ideia.
2. **Prancheta** — leia a camada de marca do workspace (`branding/`,
   `contexto/identidade-visual.md`) e busque referências no banco visual
   (`marketing/referencias/banco-visual/_indice.csv`): hit direto (arquétipo + segmento) →
   relaxar filtro → fallback textual (sinalize `fallback_textual: true`). Selecione 2-4,
   leia o PNG **e** o .md de cada uma. Compile: baseline (a vencedora-régua), paleta, o que
   clonar, o que evitar, aprendizados de produção registrados no branding.
   **Cláusula de inferência (bloqueante)** — antes de tratar uma medição da prancheta (ou um
   aprendizado registrado) como regra de rota, responda: (1) **quantos casos** foram olhados,
   e com que **variância**? (2) a amostra cobre as **variantes relevantes** (cor/modelo/
   contexto)? (3) qual **contra-exemplo** barato refutaria — foi checado? Medição sem essas
   três respostas entra na prancheta como OBSERVAÇÃO, não como regra.
3. **Rotas** — 2-3 rotas genuinamente distintas (composição/ângulo/mood, não variações da
   mesma ideia). **Cada rota declara obrigatoriamente**: a ideia única em uma frase, as
   respostas às quatro perguntas da hierarquia na ordem de leitura, o recurso de contraste
   escolhido entre os quatro, e **a justificativa de cada elemento presente** (por que existe
   e por que ocupa o espaço que ocupa). Rota sem hierarquia declarada e sem justificativa por
   elemento é **entrega incompleta** — não apresente, complete. Além disso, por rota:
   arquétipo (slug canônico da marca), composição executável,
   `prompt_ia` quando houver imagem gerada (fotografia realista, nunca ilustração; **sem
   texto na imagem** — texto é overlay programático), comando de rough barato, comando de
   overlay previsto completo, referência-âncora e porquê. Brief pedindo arquétipo diferente
   do trilho vencedor → **sinalize o conflito**, não resolva sozinho.
4. **Artefato auditável** — grave `marketing/registry/criativos/<slug>__rotas.md`
   (frontmatter: slug, brief_path, prancheta, rotas completas, `rota_aprovada: null`,
   criado_em) + seção legível com, por rota, ideia única, ordem de leitura, recurso de
   contraste e a justificativa de cada elemento. Rota sem esses quatro não vai pro artefato.
5. **Aprovação é humana e VISUAL** — apresente as rotas (com roughs quando existirem) e
   espere a escolha. Nunca marque `rota_aprovada` sem decisão explícita do humano.

## Regras

- Não gera imagem final, não valida render, não escreve copy nova — papéis do fluxo.
- Não invente cores fora da identidade visual da marca; cor nova precisa vir de referência.
- Texto de arte curto (a regra da marca define o teto; padrão ≤ 5 palavras por linha).
- Rota que estoura o teto de elementos, cujo dominante não carrega o significado principal ou
  que usa painel opaco grande é **reescrita antes do rough** — não vá pra produção "pra ver
  como fica"; conceito errado sai caro na 6ª iteração.
- Português BR.
