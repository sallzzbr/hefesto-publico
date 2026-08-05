---
description: Use quando o usuário quiser registrar uma nota/cupom de supermercado (foto, PDF/print do app ou ditado), catalogar os produtos comprados por tipo/marca/quantidade, lançar a compra no orçamento agrupada por categoria, ou gerenciar o catálogo de produtos. Os dados ficam na pasta de mercado do hestia no Google Drive (configurável por workspace/defaults). Para análise de preços e quantidades, use a skill analisar-mercado.
---

# Mercado — Registro de Notas e Catálogo

Esta skill ensina como transformar notas de supermercado em dados estruturados: itens com
quantidade e preço em CSVs mensais, e um catálogo vivo que dá identidade estável aos produtos
("ARROZ AGULH CAMIL T1 5KG" na nota é sempre "Arroz Camil 5kg" nos dados). Esta skill é só
INSTRUÇÃO: quem acessa o Drive é o conector do Google Drive.

## Regras invioláveis

1. **Dados ficam no Google Drive**, na pasta resolvida (ver "Onde ficam os dados"; caminho,
   nunca ID). Conector indisponível → PARE e peça para conectar; nunca invente dados.
2. **Confirme antes de QUALQUER escrita**, mostrando exatamente o que será gravado.
3. **Exibir em BRL, gravar no formato cru** (`R$ 18,90` na tela; `18,90` no CSV — vírgula
   decimal, sem milhar, sem `R$`).
4. **Extração nunca inventa.** Campo ilegível na foto/PDF → pergunte; não estime.
5. Sem conselho financeiro; esta skill registra e organiza.

## Onde ficam os dados

Subpasta `mercado/` da pasta-base do hestia, resolvida pela regra única de
`${CLAUDE_PLUGIN_ROOT}/skills/orcamento/references/defaults.md` (workspace → defaults do
usuário → default `Financas/hestia/`); os paths citados nos exemplos são ilustrativos do
default, não hardcode. CSVs com separador `;` e escape RFC 4180 adaptado (padrão do
plugin — ver skill `orcamento`).

### Itens do mês — `AAAA-MM-itens.csv`

```
data;mercado;produto;quantidade;unidade;valor_unitario;valor_total
```

- `data`: AAAA-MM-DD (data da nota).
- `mercado`: nome do estabelecimento como o usuário o chama ("Pão de Açúcar").
- `produto`: **sempre o nome canônico do catálogo** — nunca o texto cru da nota.
- `quantidade`: número com vírgula decimal (`2`, `0,650`).
- `unidade`: `kg` | `g` | `l` | `ml` | `un`.
- `valor_unitario` e `valor_total`: formato cru. Guardar os dois valida a extração
  (quantidade × unitário ≈ total, tolerância de centavos).

Exemplo:

```
data;mercado;produto;quantidade;unidade;valor_unitario;valor_total
2026-07-12;Pão de Açúcar;Arroz Camil 5kg;1;un;18,90;18,90
2026-07-12;Pão de Açúcar;Leite Itambé Integral 1l;6;un;4,89;29,34
2026-07-12;Pão de Açúcar;Filé de frango;0,850;kg;24,90;21,17
```

### Catálogo vivo — `produtos.csv`

```
produto;tipo;marca;categoria;unidade_base;apelidos
```

- `produto`: nome canônico legível ("Arroz Camil 5kg").
- `tipo`: agrupador de comparação entre marcas ("arroz", "café", "cerveja").
- `marca`: marca ("Camil"); vazio quando não se aplica (hortifruti).
- `categoria`: categoria do ORÇAMENTO (Alimentação, Limpeza, Higiene, Bebidas, Pet…) — usada no
  lançamento agrupado no livro (Fluxo 2).
- `unidade_base`: unidade de comparação do preço unitário (`kg`, `l`, `un`).
- `apelidos`: nomes crus vistos nas notas, separados por `|` — cresce a cada nota casada, para
  os próximos casamentos serem automáticos.

Exemplo:

```
produto;tipo;marca;categoria;unidade_base;apelidos
Arroz Camil 5kg;arroz;Camil;Alimentação;kg;ARROZ AGULH CAMIL T1 5KG|ARROZ CAMIL 5KG
Detergente Ypê 500ml;detergente;Ypê;Limpeza;un;DET YPE CLEAR 500ML
```

## Fluxo 1 — Registrar nota

1. Receba a nota: **foto do cupom**, **PDF/print do app do mercado**, ou **ditado** em linguagem
   natural ("comprei no atacadão: 2kg de arroz Camil 18,90, 6 leites Itambé…").
2. Extraia mercado, data e itens (nome cru, quantidade, unidade, valor unitário, valor total).
   - Ilegível/ambíguo → pergunte os campos que faltam. Nunca estime.
   - Se o total da nota estiver visível, confira contra a soma dos itens; divergência → mostre e
     pergunte antes de seguir.
   - Item sem quantidade legível → registre com `quantidade` e `valor_unitario` vazios e só o
     `valor_total`; avise que ele fica fora das comparações de preço unitário.
3. **Case cada item com o catálogo** (`produtos.csv`):
   - primeiro por `apelidos` (comparação exata, ignorando maiúsculas);
   - depois por semelhança de nome/tipo/marca;
   - sem match → proponha entrada nova (produto canônico, tipo, marca, categoria, unidade_base
     sugeridos, todos editáveis pelo usuário).
   - Nome cru novo de produto já conhecido → proponha acrescentar ao `apelidos`.
4. Mostre a **tabela final completa** (itens com nomes canônicos, quantidades, valores, soma
   conferida + o que muda no catálogo) e grave TUDO com **uma única confirmação**: linhas novas
   em `AAAA-MM-itens.csv` + entradas/apelidos novos em `produtos.csv`. Arquivo ausente → crie com
   o cabeçalho, avisando.
5. **Nota repetida?** Antes de gravar, se já houver itens do mesmo mercado na mesma data com o
   mesmo total, aponte e peça uma confirmação extra ("parece a mesma nota de 12/07 — registrar
   mesmo assim?").
6. Depois de gravar, siga para o Fluxo 2 (oferta de lançamento no livro).

## Fluxo 2 — Lançar no livro do orçamento (agrupado por categoria)

Nota de mercado quase nunca é só Alimentação.

### O agrupamento sai de SCRIPT

**Não some os grupos de cabeça.** Esta é a única conta do hestia cujo resultado é **gravado**: as
linhas vão para o livro do orçamento e de lá viram base das médias, desvios e tendências da skill
`analisar-gastos`. Erro aqui não produz uma frase errada — produz um histórico errado, e ele
contamina toda análise futura.

```bash
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/nota.py \
  --itens <AAAA-MM-itens.csv> --catalogo <produtos.csv> \
  --data <AAAA-MM-DD> --mercado "<nome>" [--total-da-nota <total impresso na nota>]
```

Ele agrupa por `categoria`, devolve as linhas prontas em `lancamento_proposto.linhas`, confere
`quantidade × valor_unitario ≈ valor_total` por item (tolerância de **1 centavo** — é o que custa
o mercado truncar onde a conta exata arredondaria) e, com `--total-da-nota`, confere a soma dos
itens contra o total impresso.

O que você **narra em vez de contornar**:

- **Divergência é relatada, não recusada.** `divergencias_de_extracao` e
  `conferencia_do_total_da_nota` fazem o script sair 0 de propósito: vale aqui a regra do Fluxo 1
  ("mostre e pergunte antes de seguir"), e a decisão de gravar assim mesmo é do usuário.
- **`nao_coberto` maior que zero** significa item fora do catálogo — o lançamento cobre **menos**
  do que a nota. Diga o valor. Lançar menos do que se gastou é o modo de falha deste fluxo, e ele
  acontece por omissão na narrativa, não por erro de conta.
- **`metodo` vem nulo** de propósito: o script lê o CSV, não vê a nota. Use o método da nota se
  visível; senão pergunte.
- **`lancamento_proposto` nulo** quer dizer que a seleção pegou mais de uma nota — a descrição
  nomeia mercado e data, então filtre com `--data` e `--mercado`.
- **Recusa por `valor_total` com mais de 2 casas**: não é valor pagável nem gravável, e
  arredondar por conta própria faria a soma das linhas gravadas divergir da nota.

### Passos

1. Rode o `nota.py` acima; os grupos e as linhas vêm dele.
2. Ofereça lançar no livro do orçamento (`Financas/hestia/orcamento/AAAA-MM.csv`, contrato da
   skill `orcamento`) **uma linha de despesa por categoria**:
   > Lançar no orçamento? `12/07 — Alimentação R$ 312,40 · Limpeza R$ 48,90 · Higiene R$ 27,30`
   > (descrição: "Mercado Pão de Açúcar — nota de 12/07"). Confirma?
3. Uma confirmação para o lote inteiro. Método de pagamento: use o da nota se visível; senão
   pergunte.
4. **Não duplicar**: se o livro do mês já tiver lançamento com a mesma descrição, aponte e não
   proponha de novo.
5. O usuário pode recusar (os itens ficam registrados mesmo assim) ou ajustar a categoria de um
   item antes de confirmar (ajuste vale para o catálogo também, com o antes/depois mostrado).

## Fluxo 3 — Gerenciar catálogo

1. Listar (agrupado por categoria ou tipo), renomear o canônico, ajustar tipo/marca/categoria/
   unidade_base, acrescentar/limpar apelidos, remover entrada, ou **fundir duplicatas** (dois
   canônicos que são o mesmo produto: um vira apelido do outro, apelidos migram juntos).
2. Toda escrita mostra o antes/depois e **confirma antes**.
3. Fusão ou renomeação NUNCA reescreve os `AAAA-MM-itens.csv` antigos automaticamente — o
   histórico fica como está, a menos que o usuário aceite a oferta explícita e separada de
   atualizar também os meses anteriores.

## Formatação BRL ↔ cru (referência)

| Exibir (usuário) | Gravar (CSV) |
| --- | --- |
| `R$ 1.234,56` | `1234,56` |
| `R$ 18,90` | `18,90` |
| `R$ 0,90` | `0,90` |
