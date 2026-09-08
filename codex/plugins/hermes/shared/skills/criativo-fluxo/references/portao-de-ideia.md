# Portão de ideia — ficha, critérios de aceite e artefato

> Paths do workspace (`marketing/`, `branding/`, `contexto/`, `financeiro/`, `scripts/`) resolvem pela regra única do plugin (`defaults.md`, nesta mesma pasta: CLAUDE.md do workspace → defaults `local_*` → convenção descoberta no cwd → default documentado); as menções neste documento são ilustrativas do default, não hardcode.

Contrato do **Portão 1** do `hermes:criativo-fluxo`: o gate de texto que roda **antes de
qualquer geração de imagem**. Existe porque acabamento não é ideia — peça pode passar em
contraste, zona segura e fidelidade tipográfica e ainda assim não dizer nada. Este portão é o
único ponto do fluxo onde a **ideia** é julgada, e ele é bloqueante.

## A inversão (a regra que o portão implementa)

1. UMA ideia clara.
2. A ordem de leitura dessa ideia.
3. Só então a composição.

Nunca o inverso. Começar pelo template/layout e encaixar uma frase dentro dele é o defeito de
origem: produz peça montada, não peça pensada. Hierarquia **não** é "deixar algumas palavras
maiores" — é decidir o que é compreendido primeiro, o que completa ou muda o significado, onde
está o produto e qual ação deve acontecer.

## Os 8 campos

Ordem fixa. Campo vago = portão fechado; não se preenche "depois".

| # | Campo | Preenchido de verdade | Reprovado |
|---|---|---|---|
| 1 | **Objetivo do anúncio** | efeito concreto e único que a peça precisa causar | "vender mais", "gerar awareness" |
| 2 | **Estágio do funil** | topo/meio/fundo + o que isso permite e proíbe na peça | ausente, ou funil que não muda nada na decisão |
| 3 | **Observação humana** | comportamento observável, situação cotidiana, contradição ou característica reconhecível — verdade específica | cumplicidade sem conteúdo ("quem tem, entende"), sentimento genérico |
| 4 | **Headline** | uma, aprovada nos quatro testes de copy (abaixo) | duas opções "pra decidir depois", frase-categoria, punchline vazio |
| 5 | **Produto exibido** | qual produto real aparece e como aparece | "o produto" sem identificação; produto que não existe no catálogo |
| 6 | **Hierarquia de leitura** | 1º / 2º / 3º explícitos, e qual deles é o elemento dominante | lista de elementos sem ordem; "tudo em destaque" |
| 7 | **Esboço textual da composição** | wireframe em palavras: blocos, posições relativas, ordem de leitura, teto de elementos respeitado | descrição de estilo ("moderno, impactante"); qualquer imagem |
| 8 | **Justificativa de cada elemento** | por que cada bloco existe e por que ocupa aquele espaço | justificativa que serve pra qualquer peça |

**Regra do campo 6:** a maior informação da peça tem de carregar o significado principal. Não
aumente expressão vazia porque "parece punchline". Se o elemento dominante não é o que precisa
ser entendido primeiro, a hierarquia está errada — reprove.

**Regra do campo 8:** toda área visual justifica o espaço que ocupa. Região que não destaca
produto, mensagem ou ação é reduzida ou removida — no esboço, antes de virar pixel.

## Os quatro testes de copy (checklist do campo 4)

Resumo operacional para fechar o portão; o contrato completo dos testes é o de
`hermes:sugerir-criativos`, e a crítica pós-render cobra o mesmo.

- **Categoria da headline (passo 0)** — antes de testar, declare: é **hook** (cria
  reconhecimento/dor/desejo) ou **afirmação direta** (diz o que é e para quem, nomeando o
  produto)? A categoria muda quais testes se aplicam, e campo não declarado fecha o portão.
- **Troca do termo definidor** *(só para hook)* — o termo que deveria tornar a peça específica
  (nicho, categoria, público, segmento) pode ser trocado por qualquer outro do mesmo tipo sem a
  frase perder sentido? Então a copy não tem ideia: reescreva. *(ilustração: "se você tem um
  gato laranja, você entende" sobrevive à troca por qualquer outra cor ou raça — logo, não diz nada.)*
  Em **afirmação direta**, sobreviver à troca é a função — o teste não se aplica, e a ficha
  registra `termo_definidor: nao_se_aplica (afirmacao_direta)`. Cuidado: frase que não nomeia o
  produto **não** é afirmação direta; é hook, e o teste vale.
- **Fala humana** — leia em voz alta; rejeite construção que soe traduzida ou gerada.
- **E daí?** — a frase contém uma ideia ou só nomeia uma categoria?
- **Verdade comercial** — o texto não sugere produto, serviço, personalização ou benefício que
  a loja não oferece.

Headline que não passa nos quatro **não entra na ficha**. Corrigir copy depois do render custa
uma iteração inteira; aqui custa uma linha.

## Teto de elementos (aceite dos campos 7 e 8)

Uma peça vende **uma** ideia. Máximo admitido no esboço:

- 1 headline;
- 1 linha complementar (só quando necessária);
- o produto;
- 1 oferta **ou** 1 CTA;
- assinatura discreta da marca.

Headline + parágrafo + lista de benefícios + selo + mockup + oferta + CTA na mesma peça =
reprovado no portão. Informação detalhada pertence à página de destino ou a um criativo
específico de prova.

## Artefato

Grave a ficha aprovada em `<marketing>/registry/criativos/<stem-do-brief>__ideia.md` — o stem
do arquivo de brief, porque o slug canônico só nasce no estágio A. Frontmatter:

```yaml
brief_path: <path do brief>
objetivo: <campo 1>
funil: <topo|meio|fundo>
observacao_humana: <campo 3>
headline: <campo 4>
testes_copy: { termo_definidor: ok, fala_humana: ok, e_dai: ok, verdade_comercial: ok }
produto_exibido: <campo 5>
hierarquia: ["1º ...", "2º ...", "3º ..."]
aprovada_em: <data ISO>   # só com OK explícito do humano; null enquanto não houver
```

Seção legível abaixo: esboço textual (campo 7) e justificativa por elemento (campo 8).

**Consolide os 8 campos no próprio brief** (`briefPath`) além do artefato — o harness lê o
brief, não a ficha; ideia aprovada que não está no brief não chega no diretor de arte.

## Reprovação

Reprovou em qualquer campo → volta pra **ideia**, não pra composição. Não se conserta ideia
fraca mexendo em layout, fonte ou contraste. Reapresente a ficha corrigida; o portão só abre
com OK explícito do humano, e o OK é sobre a ficha — não sobre "seguir e ver como fica".
