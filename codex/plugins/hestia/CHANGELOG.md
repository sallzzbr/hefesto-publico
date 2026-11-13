# Changelog

## 0.2.3

Fixtures com procedência incerta substituídas por cenário sintético explícito; procedência documentada nos testes.

## 0.2.2

- Sinaliza possíveis proventos históricos classificados como Investimentos no resumo e na análise entre meses, com totais provisórios e classificação pendente. Mantém dados e cálculos originais até decisão e correção autorizada; nunca migra lançamentos automaticamente.

## 0.2.1

- Runtime respeita CODEX_HOME explícito para defaults, sem ler configuração real por fallback.
- Alinha a descrição de recorrências na abertura e distingue estimativa do relatório de reconciliação pelo journal.

## 0.2.0 (2026-11-02)

- Gravar exige mostrar e confirmar, como no Claude (achado CX-01). As seis skills nativas deixam
  de tratar o pedido de lançar ou registrar como autorização: mostram a linha ou o lote final e
  esperam o ok, salvo dispensa explícita do usuário na sessão. A regra fica nas skills e prevalece
  sobre o reaproveitamento de autorização do runtime compartilhado.
- Recursos compartilhados sincronizados com hestia 0.13.0: aporte e resgate como transferências
  no resumo e na análise de gastos (investido e resgatado no mês em linhas próprias, saldo em
  caixa que soma o resgate e desconta o aporte, taxa de poupança com o aporte como poupança e o
  resgate fora das receitas, comparação com o mês anterior pela poupança) e identificador próprio
  por nota de mercado (`--nota` no `nota.py`), com a compatibilidade dos arquivos sem a coluna e
  `--sem-nota` para as linhas antigas de arquivo migrado.
- As skills nativas `orcamento`, `analisar-gastos`, `investimentos` e `mercado` narram o resgate
  em `resgatado_no_mes`, comparam meses pela poupança (`poupanca_delta`) sem ler a queda do
  caixa por aporte como piora, e selecionam a compra antiga de arquivo migrado com `--sem-nota`.
- Decisão 19A do dono (2026-11-03): o `RUNTIME.md` ganha a seção "Perguntas ao usuário". Não se pergunta o que dá para verificar por leitura ou comando, o trabalho que não depende da resposta vem antes, a pergunta necessária é curta e completa, fecha a mensagem e encerra o turno, e nada continua executando depois dela; regra de pergunta da skill ou do contrato de domínio se soma. Teste que trava a instrução escrita (não o comportamento): `codex/tests/runtime-pergunta.test.mjs`, que lê o RUNTIME de cada pacote do marketplace Codex.
- Revisão da decisão 19A (2026-11-03): a regra restringe o fim do turno à pergunta direta; pela ferramenta de interação da sessão a resposta volta no mesmo turno, e nada continua executando antes de ela chegar. Sem a ressalva, a seção contradizia a linha do mesmo `RUNTIME.md` que oferece perguntar pela ferramenta de interação ou por pergunta direta, e proibia seguir depois da resposta. Caso novo por pacote em `codex/tests/runtime-pergunta.test.mjs`.

## 0.1.5 — 2026-11-01

- Skills nativas rodam os scripts com `python3 -B`: sem isso o Python gravava `__pycache__` dentro do pacote instalado, contra o RUNTIME (achado HES-07).
- `analisar-mercado` passa um único CSV em `--itens`, como o `mercado.py` aceita; janela de vários meses concatena os meses num temporário (achado HES-02/CX-03).

## 0.1.4 — 2026-09-09

- Rendimento usa a janela efetiva de snapshots por ativo, informa fluxos externos e recusa ordem intradiária incerta. Ritmo de metas não replica fluxo global entre potes: cadastro com várias metas exige recorte declarado para uma meta, preservando progresso sem projeção quando ausente.

## 0.1.3

Distribuição pública inicial no marketplace v3.18.0. Metadados apontam para o repositório público; pacote autocontido e política nativa de modelos preservados.

## 0.1.2 — 2026-09-08

- Política Codex explícita: herança de modelo/effort, preferência OpenAI por papel e identidade efetiva separada; instruções históricas de modelo não governam esta distribuição.

## 0.1.1 — 2026-09-06

- Recursos compartilhados sincronizados com hestia 0.12.4. Análise de mercado exclui linhas sem quantidade/preço unitário das comparações e informa os campos ausentes, preservando o gasto. Quantidades e desvios usam a unidade-base do catálogo, explicitada no resultado. Quantidades pequenas preservam precisão suficiente para não aparecerem como zero.

## 0.1.0 — 2026-09-06

Primeira adaptação Codex. Verificação técnica nesta etapa; avaliação comportamental e publicação seguem o plano do repositório.
