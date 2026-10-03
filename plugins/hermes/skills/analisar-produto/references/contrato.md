# Contrato do script analisar-produto

```
node "${CLAUDE_PLUGIN_ROOT}/skills/analisar-produto/scripts/analisar-produto.mjs" --entrada <entrada.json> --saida <dir>
```

Grava `<dir>/analise-produto.md` e `<dir>/analise-produto.csv`; stdout é JSON
`{ parametros, comparacoes[], juncao, aproximados[], vitrine[] }` (`juncao` traz `naoCasou`, `colisoes` e
`aproximados`; `vitrine[]` traz `estampa, fatia, taxaCompra, sinal, bloco, evidencia`). Exit 0 em sucesso.
Entrada inválida ou com PII: exit 1, mensagem em stderr (sem stack trace e sem eco da entrada), nenhum
arquivo gravado. Se `analise-produto.md`/`.csv` já existem em `--saida`, o script avisa em stderr
(`sobrescrevendo <arquivo>`) e segue com exit 0.

## Entrada (JSON já agregado por estampa, sem PII)

```json
{
  "periodo": "2026-09",
  "casa_excluida": 4,
  "estampas": [{ "estampa": "Lua Verde", "raca": "ignorada", "estilo": "ignorado",
                 "meta_impressoes": 1000, "meta_cliques": 40, "ga4_views": 300, "ga4_compras": 9 }],
  "catalogo": [{ "estampa": "Lua Verde", "raca": "RACA-A", "estilo": "X" }],
  "excecoes": [{ "de": "Apelido Estranho", "para": "Lua Verde" }],
  "conjuntos": [{ "conjunto": "Conjunto Alfa", "status": "veiculando", "estampas": ["Lua Verde"] }],
  "parametros": { "fatiaAlta": 0.15 }
}
```

- `casa_excluida` é só a **contagem** (número, em unidades) de compras da família já retiradas das vendas do ERP. O GA4 não separa família: as taxas de compra (GA4) podem incluir compras da casa. Nunca dados dela.
- **Limitação conhecida:** uma única estampa com compras > views (o GA4 conta unidades, ou a janela é curta) recusa a entrada inteira; corrija ou remova a estampa na origem.
- Uma linha de `estampas` pode trazer só os campos de uma fonte (`meta_*` ou `ga4_*`); as linhas
  da mesma estampa são somadas no alvo do catálogo.
- **Raça e estilo vêm só de `catalogo`.** As colunas `raca`/`estilo` das linhas de `estampas` são
  ignoradas (o ledger erra a raça; o catálogo é a fonte).
- `excecoes` (array de `{ de, para }`) e `parametros` (objeto) com outro tipo são recusados. `excecoes.para`
  precisa existir no catálogo. `parametros` só aceita as chaves abaixo (chaves herdadas como `constructor` não valem).

- `conjuntos` (**opcional**, fornecido pelo workspace; a skill não lê a conta): array de
  `{ conjunto, status, estampas }`. `conjunto` string não vazia; `status` texto livre opcional (ex.: veiculando,
  pausado); `estampas` array de strings. Qualquer outra forma é recusada (exit 1, sem relatório parcial). O nome
  em `estampas` casa com o catálogo pela mesma normalização da junção (minúsculas, sem acento, só alfanumérico),
  igualdade exata; o que não casar vai para "estampas de conjunto fora do catálogo" (não quebra). A varredura de
  PII cobre este campo.

## Sugestão de conjunto (só sugestão; a skill nunca cria nada)

Estampas **com evidência** = as dos blocos Produzir e Investir. Para cada uma: coberta por algum conjunto de
`conjuntos` => `reusar: <conjunto> (<status>)` (todos os que a cobrem); sem cobertura => `candidatas a um
conjunto novo: A, B`. `conjuntos` ausente => o relatório diz que a lista não foi informada, manda conferir na
conta antes de criar qualquer um e lista as com evidência como `candidatas a conjunto próprio` (sem recomendar
criar). `conjuntos: []` = nenhum conjunto existente cobre. Nenhuma estampa com evidência => "Nenhuma estampa tem
evidência estatística para conjunto próprio. Não criar conjunto agora." (com ou sem `conjuntos`). A seção sempre
fecha com o aviso de que é só sugestão e de que conjunto novo reinicia o aprendizado e divide a verba.

stdout ganha:

```json
"sugestao_conjunto": { "checou_conta": true,
  "reusar": [{ "estampa": "Lua Verde", "conjuntos": [{ "conjunto": "Conjunto Alfa", "status": "veiculando" }] }],
  "candidatas_novo": ["Mar Azul"], "fora_do_catalogo": ["Estampa Fantasma"], "aviso": "..." }
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
o campo (ex.: `estampas[3].estampa`) e o tipo de PII, sem ecoar o valor, e manda renomear.

**Limitação conhecida (falso positivo aceito):** nome de estampa que parece endereço é recusado, por
exemplo `Estrada Real 2` ou `Rua Neon 7`. Instrução: renomeie a estampa (no catálogo e nas linhas de
`estampas`), por exemplo `Estrada Real v2`, e rode de novo. Dez ou onze dígitos soltos em texto também
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

- Taxa de compra = compras / views (GA4), por estampa e por grupo.
- Teste de duas proporções com variância combinada, bicaudal: `z = (p1 - p2) / sqrt(p(1-p)(1/n1 + 1/n2))`,
  `p-valor = erfc(|z| / sqrt(2))`. Alfa 0,05.
- Poder (80%): `nMinimo = (1,959964 * sqrt(2 p̄ q̄) + 0,841621 * sqrt(p1 q1 + p2 q2))² / (p1 - p2)²` por grupo,
  com `p̄ = (p1 + p2) / 2`. `semPoder` quando o menor grupo (views) < `nMinimo`.
- Rótulo: `p >= 0,05` = "não comprovado"; `p < 0,05` com poder = "comprovado"; `p < 0,05` sem poder =
  "sem poder para afirmar" (nunca vai para "afirmado").
- Comparações: raças par a par no `total` e **dentro de cada estilo** (`estilo:<nome>`), mais estilos
  entre si (`estilos`, controlado por raça). O total "comprovado" é ajustado por Cochran-Mantel-Haenszel
  e **só fica afirmado se o efeito ajustado for significativo e no mesmo sentido do total**. Senão sai com
  `confundida: true` e vai para "não comprovado": ajustado não significativo = "inversão (paradoxo de
  Simpson): o estilo explica o total"; ajustado significativo em sentido oposto = "não comprovado após
  ajuste por estilo". Sem estrato compartilhado: "não separável do estilo" (ou "da raça", na comparação
  entre estilos).
- Sem correção para comparações múltiplas: muitas raças geram muitos pares; leia p-valores
  limítrofes com cautela.

## Vitrine (limiares nomeados, ecoados em `parametros`)

| Parâmetro | Padrão | Significado |
|---|---|---|
| `fatiaAlta` | 0,15 | fatia de impressões que "domina" a vitrine |
| `fatiaBaixa` | 0,03 | fatia de impressões "escondida" |
| `razaoConversaoBaixa` | 0,7 | taxa da estampa / taxa média: abaixo converte pouco |
| `razaoConversaoAlta` | 1,3 | taxa da estampa / taxa média: acima converte muito |
| `minViewsSinal` | 200 | views mínimas para receber sinal ou bloco |
| `jaccardMinimo` | 0,5 | similaridade mínima na junção de nomes |

Sinais: `fatia-alta-conversao-baixa` (candidato Rever), `fatia-baixa-conversao-alta` (candidato Investir).
Sem sinal e conversão >= `razaoConversaoAlta` x a média: candidato Produzir.

**Evidência obrigatória:** a estampa só entra em Produzir/Investir/Rever se o teste de duas proporções
estampa contra o resto der p < 0,05 **com poder** (mesma regra do rótulo "comprovado"). O rótulo vai em
`vitrine[].evidencia`. Quem passou o corte mas não tem evidência fica em `## Observações (não comprovado)`,
sem verbo de ação. Os três títulos aparecem sempre ("Nenhuma estampa com evidência." se vazio). `sinal`,
`fatia` e `taxaCompra` continuam no JSON.

## CSV de saída (cabeçalho fixo, uma linha por estampa do catálogo)

```
estampa,raca,estilo,impressoes,cliques,views,compras,taxa_compra,fatia_impressoes,sinal_vitrine,bloco
```

`taxa_compra` e `fatia_impressoes` com 6 casas; `taxa_compra` vazia sem views; `bloco` em
`produzir`, `investir`, `rever` ou vazio (vazio também quando falta evidência). Células de texto que
começam com `=`, `+`, `-` ou `@` saem com apóstrofo na frente; células com `\r`, `\n`, vírgula ou aspas
são aspeadas. No `.md`, quebras de linha em nomes viram espaço.
