# Procedência das fixtures

São cenários de teste, não extratos a serem importados por usuários.

- `gastos-*.csv`: valores construídos para os dois exemplos de `analisar-gastos`, conforme `test_golden_gastos.py`, introduzidos em df9d2d3.
- `itens.csv`, `produtos.csv`, `livro*.csv`: exemplos de orçamento e comparação de mercado documentados em `test_golden_orcamento_mercado.py`, introduzidos em 63c83e1; as variantes de aporte, resgate e rebalanceamento são casos de regressão.
- `nota_*.csv`, `recorrencias*.csv`: cenários dos exemplos de `mercado` e cadastro de recorrências, documentados em `test_golden_nota_recorrencias.py`, introduzidos em 1f71e01; notas múltiplas e legado exercitam identidade e compatibilidade do parser.
- `metas.csv`: exemplo didático do progresso da meta, documentado no commit 92f8810 e em `test_golden_investimentos.py`.
- `carteira.csv`, `posicoes_lidas.csv`, `snapshots.csv`, `movimentos.csv`: substituídos nesta revisão por cenário sintético explícito. Não foi possível comprovar a procedência dos valores anteriores. Instituições e ativos são fictícios. Os valores foram escolhidos do zero: carteira 1000/2000/3000/0/4000, posições 1100/1800/3300/500 e ativo novo 600; snapshots 1000→1200 e 2000→2100; movimentos 100/50/25/10/75. Mantêm os casos de alta, queda, saldo zero, ativo ausente e novo, sem conservar a escala ou os percentuais do cenário antigo.

Os goldens de posições e rendimento foram recalculados somente para essa substituição. A revisão compara os campos monetários com contas independentes sobre as constantes sintéticas, verifica percentuais e quantidades e mantém testes independentes de soma, base percentual e ausência de divisão por zero. Nunca atualizar goldens automaticamente para acomodar falha de código.
