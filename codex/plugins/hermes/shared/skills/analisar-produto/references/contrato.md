# Contrato do script analisar-produto

```
node "${CLAUDE_PLUGIN_ROOT}/skills/analisar-produto/scripts/analisar-produto.mjs" --entrada <entrada.json> --saida <dir>
```

Grava `<dir>/analise-produto.md` e `<dir>/analise-produto.csv`; stdout é JSON
`{ parametros, comparacoes[], juncao, aproximados[], vitrine[], lacunas[], reestetica[] }` (`juncao` traz `naoCasou`,
`colisoes` e `aproximados`; `vitrine[]` traz `item, fatia, taxaCompra, sinal, bloco, evidencia`; `lacunas` e
`reestetica` na seção própria abaixo). Exit 0 em sucesso.
Entrada inválida ou com PII: exit 1, mensagem em stderr (sem stack trace e sem eco da entrada), nenhum
arquivo gravado. Se `analise-produto.md`/`.csv` já existem em `--saida`, o script avisa em stderr
(`sobrescrevendo <arquivo>`) e segue com exit 0.

## Entrada (JSON já agregado por item, sem PII)

```json
{
  "periodo": "2026-09",
  "vendas_internas_excluidas": 4,
  "eixos": ["familia", "acabamento"],
  "itens": [{ "item": "Lua Verde", "meta_impressoes": 1000, "meta_cliques": 40, "ga4_views": 300, "ga4_compras": 9 }],
  "catalogo": [{ "item": "Lua Verde", "eixos": { "familia": "FAM-A", "acabamento": "X" } }],
  "excecoes": [{ "de": "Apelido Estranho", "para": "Lua Verde" }],
  "conjuntos": [{ "conjunto": "Conjunto Alfa", "status": "veiculando", "itens": ["Lua Verde"] }],
  "parametros": { "fatiaAlta": 0.15 }
}
```

- `vendas_internas_excluidas` é só a **contagem** (número, em unidades) de vendas internas já retiradas da fonte de vendas (a regra do perfil em `exclusao_vendas_internas`). A fonte de tráfego (GA4) não separa essas vendas: as taxas de compra podem incluí-las. Nunca dados de pessoas.
- **Limitação conhecida:** um único item com compras > views (o GA4 conta unidades, ou a janela é curta) recusa a entrada inteira; corrija ou remova o item na origem.
- Uma linha de `itens` pode trazer só os campos de uma fonte (`meta_*` ou `ga4_*`); as linhas
  do mesmo item são somadas no alvo do catálogo.
- **`eixos` é a lista de nomes de eixo do perfil do negócio** (a skill a injeta; ao menos um, sem duplicata, no formato `^[a-z0-9][a-z0-9_-]{0,80}$` (sem vírgula, quebra de linha, espaço nem maiúscula) e fora dos nomes reservados das
  colunas fixas do CSV; formato e reservados vivem em `references/eixos.json`, a mesma fonte do preflight). Chave de topo fora do contrato (inclusive uma da versão anterior ao lado da nova) é recusada. Todo item do catálogo traz um valor não vazio para cada eixo, e só para eles;
  eixo faltando ou desconhecido recusa a entrada citando o eixo e o item. Não há formato antigo nem alias.
- **Os valores dos eixos vêm só de `catalogo`.** Um `eixos` dentro de uma linha de `itens` é
  ignorado (o ledger erra o atributo; o catálogo é a fonte).
- `excecoes` (array de `{ de, para }`) e `parametros` (objeto) com outro tipo são recusados. `excecoes.para`
  precisa existir no catálogo. `parametros` só aceita as chaves abaixo (chaves herdadas como `constructor` não valem).

- `conjuntos` (**opcional**, fornecido pelo workspace; a skill não lê a conta): array de
  `{ conjunto, status, itens }`. `conjunto` string não vazia; `status` texto livre opcional (ex.: veiculando,
  pausado); `itens` array de strings. Qualquer outra forma é recusada (exit 1, sem relatório parcial). O nome
  em `itens` casa com o catálogo pela mesma normalização da junção (minúsculas, sem acento, só alfanumérico),
  igualdade exata; o que não casar vai para "itens de conjunto fora do catálogo" (não quebra). A varredura de
  PII cobre este campo.

## Sugestão de conjunto (só sugestão; a skill nunca cria nada)

Itens **com evidência** = os dos blocos Produzir e Investir. Para cada uma: coberta por algum conjunto de
`conjuntos` => `reusar: <conjunto> (<status>)` (todos os que a cobrem); sem cobertura => `candidatas a um
conjunto novo: A, B`. `conjuntos` ausente => o relatório diz que a lista não foi informada, manda conferir na
conta antes de criar qualquer um e lista as com evidência como `candidatas a conjunto próprio` (sem recomendar
criar). `conjuntos: []` = nenhum conjunto existente cobre. Nenhum item com evidência => "Nenhum item tem
evidência estatística para conjunto próprio. Não criar conjunto agora." (com ou sem `conjuntos`). A seção sempre
fecha com o aviso de que é só sugestão e de que conjunto novo reinicia o aprendizado e divide a verba.

stdout ganha:

```json
"sugestao_conjunto": { "checou_conta": true,
  "reusar": [{ "item": "Lua Verde", "conjuntos": [{ "conjunto": "Conjunto Alfa", "status": "veiculando" }] }],
  "candidatas_novo": ["Mar Azul"], "fora_do_catalogo": ["Item Fantasma"], "aviso": "..." }
```

`checou_conta` é `true` só quando `conjuntos` veio (inclusive `[]`). O CSV não muda.

## Recusa de PII

O script varre **só os valores string** do JSON já decodificado (escapes `\uXXXX` não escondem nada),
normalizados com NFKC, sem caracteres invisíveis (ZWSP etc.) e com `[at]`/`(at)`/`[dot]` desofuscados.
Detecta: e-mail (inclui largura total e ofuscado); CPF formatado **ou** de 11 dígitos puros (esse último
só com dígito verificador válido); telefone BR com `+55`, parênteses, espaços ou hífen opcionais (10 ou 11
dígitos); endereço iniciado por `R.`, `R `, `Av`, `Av.`, rua, avenida, travessa, alameda, estrada, rodovia,
praça seguido de número, inclusive com aspas. Formatado deixa de ser requisito.

A **saída** (`.md`, `.csv` e os valores string do stdout, o que inclui o eco dos nomes de `naoCasou`,
`colisoes` e `aproximados`) passa pela mesma varredura antes de qualquer gravação. A mensagem de erro diz
o campo (ex.: `itens[3].item`) e o tipo de PII, sem ecoar o valor, e manda renomear.

**Limitação conhecida (falso positivo aceito):** nome de item que parece endereço é recusado, por
exemplo `Estrada Real 2` ou `Rua Neon 7`. Instrução: renomeie o item (no catálogo e nas linhas de
`itens`), por exemplo `Estrada Real v2`, e rode de novo. Dez ou onze dígitos soltos em texto também
podem ser lidos como telefone ou CPF.

## Junção de nomes

1. Tabela de exceções (nome normalizado de `de`). 2. Nome normalizado idêntico (minúsculas, sem
acento, só alfanumérico). 3. Jaccard de tokens >= `jaccardMinimo` (0,5); empate no melhor = não casa.
**Auditoria de colisões:** dois nomes distintos da MESMA fonte caindo no mesmo alvo (variantes
v1/v2) viram alerta, nunca soma silenciosa; também viram alerta duas grafias **aproximadas** (nem exatas
nem por exceção), mesmo de fontes diferentes, com tokens diferentes (v1/v2, `neon` extra).
**Casamentos aproximados:** todo casamento que não foi exato nem por exceção sai em
`aproximados: [{ de, para, jaccard }]` (stdout e seção do `.md`): a soma acontece, mas nunca em silêncio.
O que não casou é listado por fonte (`meta`/`ga4`).

## Estatística (fórmula fixa)

- Taxa de compra = compras / views (GA4), por item e por grupo.
- Teste de duas proporções com variância combinada, bicaudal: `z = (p1 - p2) / sqrt(p(1-p)(1/n1 + 1/n2))`,
  `p-valor = erfc(|z| / sqrt(2))`. Alfa 0,05.
- Poder (80%): `nMinimo = (1,959964 * sqrt(2 p̄ q̄) + 0,841621 * sqrt(p1 q1 + p2 q2))² / (p1 - p2)²` por grupo,
  com `p̄ = (p1 + p2) / 2`. `semPoder` quando o menor grupo (views) < `nMinimo`.
- Rótulo: `p >= 0,05` = "não comprovado"; `p < 0,05` com poder = "comprovado"; `p < 0,05` sem poder =
  "sem poder para afirmar" (nunca vai para "afirmado").
- Comparações: para **cada eixo**, os valores dele par a par. Cada comparação do stdout traz `eixo` (o eixo
  cujos valores se comparam) e `escopo`: `total` (o grupo todo) ou, **dentro de cada estrato**, os demais eixos
  fixos (`<eixo>:<valor>`, separados por vírgula com mais de um). Um estrato é uma combinação de valores dos
  demais eixos. Só o primeiro eixo lista os estratos na saída; todos os eixos entram no ajuste. O total
  "comprovado" é ajustado por Cochran-Mantel-Haenszel nesses estratos
  e **só fica afirmado se o efeito ajustado for significativo e no mesmo sentido do total**. Senão sai com
  `confundida: true` e vai para "não comprovado": ajustado não significativo = "inversão (paradoxo de
  Simpson): <demais eixos> explica(m) o total"; ajustado significativo em sentido oposto = "não comprovado após
  ajuste por <demais eixos>". Sem estrato compartilhado: "não separável de <demais eixos>". Com um único eixo
  não há o que controlar e o ajuste não se aplica.
- Sem correção para comparações múltiplas: muitos valores geram muitos pares; leia p-valores
  limítrofes com cautela.

## Vitrine, lacunas e re-estética (limiares nomeados, ecoados em `parametros`)

| Parâmetro | Padrão | Significado |
|---|---|---|
| `fatiaAlta` | 0,15 | fatia de impressões que "domina" a vitrine |
| `fatiaBaixa` | 0,03 | fatia de impressões "escondida" |
| `razaoConversaoBaixa` | 0,7 | taxa do item / taxa média: abaixo converte pouco |
| `razaoConversaoAlta` | 1,3 | taxa do item / taxa média: acima converte muito |
| `minViewsSinal` | 200 | views mínimas para receber sinal, bloco ou re-estética |
| `jaccardMinimo` | 0,5 | similaridade mínima na junção de nomes |
| `lacunaMaxItens` | 1 | célula do catálogo (um valor por eixo) com até N itens vira lacuna de portfólio |
| `razaoCliqueAlta` | 1,3 | CTR do item / CTR médio: a partir disso chama clique (re-estética) |
| `razaoCompraBaixa` | 0,7 | taxa de compra do item / taxa média: até isso vende pouco (re-estética) |

Sinais: `fatia-alta-conversao-baixa` (candidato Rever), `fatia-baixa-conversao-alta` (candidato Investir).
Sem sinal e conversão >= `razaoConversaoAlta` x a média: candidato Produzir.

**Evidência obrigatória:** o item só entra em Produzir/Investir/Rever se o teste de duas proporções
item contra o resto der p < 0,05 **com poder** (mesma regra do rótulo "comprovado"). O rótulo vai em
`vitrine[].evidencia`. Quem passou o corte mas não tem evidência fica em `## Observações (não comprovado)`,
sem verbo de ação. Os três títulos aparecem sempre ("Nenhum item com evidência." se vazio). `sinal`,
`fatia` e `taxaCompra` continuam no JSON.

## Lacunas de portfólio e re-estética

**`lacunas[]`:** com 1 ou 2 eixos, para cada combinação de valores dos eixos presentes no **catálogo** (um valor por eixo), a célula
com contagem de itens do catálogo `<= lacunaMaxItens` vira `{ celula: { <eixo>: <valor> }, itens }` (célula
sem item entra com 0). Ordem: contagem crescente, depois a ordem dos eixos. Conta só o catálogo: linha de dados
sem item no catálogo não preenche célula, e os valores de eixo do ledger não valem. É contagem, não venda: lacuna não
prova demanda. Com **3 ou mais eixos** a célula é um **par de eixos** (um valor em cada, para cada par na ordem do perfil; `celula` traz só as duas chaves): o produto de todos explodiria. A lista emitida tem teto de 500 linhas; o excedente vai em `lacunas_omitidas` e o relatório avisa. No `.md`: `## Lacunas de portfólio`.

**`reestetica[]` (bom clique, compra fraca):** item com CTR (cliques / impressões) `>= razaoCliqueAlta` x o
CTR médio (cliques / impressões do catálogo todo) e taxa de compra `<= razaoCompraBaixa` x a média, com pelo
menos `minViewsSinal` views. Cada candidata passa por dois testes de duas proporções item contra o resto, com
a fórmula da seção Estatística: clique (impressões no papel de views, cliques no de compras) e compra.
`comprovada: true` só com CTR **maior** que o resto e compra **menor** que o resto, os dois "comprovado"
(p < 0,05 com poder); senão `comprovada: false`. `evidenciaClique`/`evidenciaCompra` são o rótulo de cada teste
(o rótulo não carrega o sentido; o sentido entra só em `comprovada`). Sem correção para comparações múltiplas:
cada item é um teste, p limítrofe pede cautela.

```json
"lacunas": [{ "celula": { "familia": "FAM-B", "acabamento": "Y" }, "itens": 0 }],
"reestetica": [{ "item": "Lua Verde", "eixos": { "familia": "FAM-A", "acabamento": "Y" }, "ctr": 0.15, "razaoClique": 3.67,
  "taxaCompra": 0.002, "razaoCompra": 0.055, "evidenciaClique": "comprovado", "pClique": 3.9e-147,
  "evidenciaCompra": "comprovado", "pCompra": 1.0e-9, "comprovada": true }]
```

No `.md`, a comprovada vai para `## Candidatas a re-estética` com a recomendação "mesma ideia, nova cor, fonte ou
estrutura" (o título aparece sempre; "Nenhum item com evidência." se vazio); a sem evidência só aparece em
`## Observações (não comprovado)`, sem recomendação. O CSV não muda.

## CSV de saída (uma linha por item do catálogo; `item`, uma coluna por eixo na ordem de `eixos`, depois as colunas fixas)

```
item,familia,acabamento,impressoes,cliques,views,compras,taxa_compra,fatia_impressoes,sinal_vitrine,bloco
```

`taxa_compra` e `fatia_impressoes` com 6 casas; `taxa_compra` vazia sem views; `bloco` em
`produzir`, `investir`, `rever` ou vazio (vazio também quando falta evidência). Células de texto que
começam com `=`, `+`, `-` ou `@` saem com apóstrofo na frente; células com `\r`, `\n`, vírgula ou aspas
são aspeadas. No `.md`, quebras de linha em nomes viram espaço.
