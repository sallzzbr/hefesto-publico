---
name: analisar-produto
description: "Analyze which product attributes (the axes of the business profile) actually explain sales, with a deterministic statistical script. Use when the user asks 'qual atributo vende mais', análise de produto, qual item produzir, investir ou rever, concentração da vitrine, 'a diferença é real ou é sorte', Simpson/confusão entre atributos. Somente leitura."
allowed-tools: Read, Grep, Glob, Bash(node:*)
---

# Analisar Produto

> Paths do workspace (`marketing/`, `financeiro/`, `contexto/`) resolvem pela regra única do plugin (`criativo-fluxo/references/defaults.md`); recurso do plugin por `${CLAUDE_PLUGIN_ROOT}`.

Responde, com número e sem achismo: **o que decide a venda de um item, qual dos eixos do perfil do negócio
(família, acabamento, porte...)?** Os eixos vêm de `eixos` no `perfil-do-negocio.md` do workspace (path por
`local_perfil` na regra única de paths; o preflight `verificar_workspace.py --perfil`, descrito em
`criativo-fluxo`, devolve o perfil lido). Perfil ausente: pergunte ao usuário, nunca assuma eixos. O cálculo é feito por script (`${CLAUDE_PLUGIN_ROOT}/skills/analisar-produto/scripts/analisar-produto.mjs`),
nunca de cabeça: o modelo monta a entrada, roda, e traduz o resultado.

## Roteiro

1. **Monte o JSON de entrada** já agregado por item (Meta: impressões e cliques; GA4: views e
   compras do item), com `eixos` do perfil, mais a tabela de catálogo (`item` e o mapa `eixos` com um valor
   por eixo) e a tabela de exceções de nomes. Contrato exato em `references/contrato.md`.
2. **Sem PII.** Nada de e-mail, CPF, telefone, endereço ou nome de cliente. A contagem de compras da
   venda interna (a regra do perfil em `exclusao_vendas_internas`, quando houver) já retirada da fonte de vendas, que a fonte de tráfego não separa, entra só como número, em unidades, em `vendas_internas_excluidas`. O script recusa PII em qualquer formato (e-mail, CPF com ou sem pontuação, telefone, endereço, inclusive
   ofuscados) tanto na entrada quanto na saída; a mensagem diz o campo, e a saída é renomear o item
   (nome parecido com endereço, como `Estrada Real 2`, é falso positivo conhecido).
3. **Os valores dos eixos vêm do catálogo, nunca do ledger** (o ledger erra o atributo).
4. **Rode o script** e leia o `.md`, o `.csv` e o JSON do stdout:

   ```
   node "${CLAUDE_PLUGIN_ROOT}/skills/analisar-produto/scripts/analisar-produto.mjs" --entrada <entrada.json> --saida <dir>
   ```

5. **Confira a junção de nomes** antes de qualquer conclusão: colisões (v1/v2 no mesmo alvo),
   casamentos aproximados (`aproximados`: somados, mas nunca em silêncio) e itens que não casaram
   distorcem a soma. Corrija com `excecoes` e rode de novo.
6. **Sugira conjunto (só sugestão).** O workspace fornece, se puder, `conjuntos` na entrada (conjuntos
   existentes: nome, status e itens que cobrem); a skill não lê a conta. Antes de sugerir qualquer conjunto
   novo, o relatório confere se um existente já serve (`reusar`) e só então lista `candidatas a um conjunto
   novo`; sem a lista, diz que não deu para checar. A skill nunca cria nada: criar é decisão humana, depois de
   avaliar um conjunto existente compatível (conjunto novo reinicia o aprendizado e divide a verba).
7. **Apresente na ordem do relatório** (`references/template-relatorio.md`): afirmado, não
   comprovado, depois Produzir, Investir, Rever, Observações e Sugestão de conjunto.

## Regras de leitura (inegociáveis)

- **Afirmado só com p < 0,05 e poder.** "Sem poder para afirmar" e "não comprovado" nunca viram
  recomendação nem "tendência".
- **Controle de confusão:** cada eixo é comparado no total **e dentro de cada estrato dos demais eixos**. O controle é um teste
  estratificado (Cochran-Mantel-Haenszel): se a diferença do total não se sustenta depois de controlar
  os demais eixos, ou se o efeito ajustado tiver sentido oposto ao do total, vai para "não comprovado"
  (paradoxo de Simpson, inclusive com reversão). Efeito de mesmo sentido em todos os estratos continua
  afirmado. Estrato isolado sem poder não conta como confusão. Eixos sem estrato em comum são "não separáveis": nunca afirme nenhum dos dois.
- **Canal "sem anúncio" do GA4 vem contaminado por pedidos internos e de conhecidos**; declare
  isso sempre que usar esse canal.
- **Produzir, Investir e Rever exigem evidência:** item contra o resto com p < 0,05 e poder. Sem isso
  o item vai para "Observações (não comprovado)", que nunca vira recomendação.
- Limiares de vitrine são parâmetros nomeados (`references/contrato.md`), nunca números soltos;
  ecoe os usados no relatório.
- Sugestão de conjunto é só sugestão: nunca crie, nem proponha criar sem antes citar a checagem de conjuntos existentes.
- Somente leitura: a skill não altera conta, campanha nem catálogo. A decisão é do humano.

## Saídas

`analise-produto.md` (relatório) e `analise-produto.csv` (cabeçalho fixo em `references/contrato.md`).
Opcional: um PDF leigo montado pelo agente a partir do `.md` (sem script nesta versão).
O relatório e o stdout trazem também as lacunas de portfólio (`lacunas`) e as candidatas a re-estética
(`reestetica`; só a comprovada recomenda): as duas alimentam a escolha do que desenvolver a seguir.

## Poder estatístico (fórmula fixa)

Mínimo de views por grupo para detectar a diferença observada com alfa 0,05 bicaudal e poder 80%,
fórmula em `references/contrato.md`. Amostra menor que isso: declare "sem poder para afirmar".
