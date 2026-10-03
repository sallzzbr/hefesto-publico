# Changelog

## 0.2.0 — 2026-10-02

- Acompanha o hermes 1.4.0 do Claude: skill nova `analisar-produto` (script Node de cálculo em `shared`, sem PII) e correções do fluxo criativo (`semGeracao`, `flagSobrescrever`, `reproduzir`, `headline`, `headlineTravada` e `sinalizacoes[]`; Catalog Sales sem clonagem de conjunto).
- `analisar-produto`: seção `Sugestão de conjunto` (só sugestão; campo opcional `conjuntos` fornecido pelo workspace, checando conjuntos existentes antes de sugerir um novo).

## 0.1.3 — 2026-09-09

- Rough e produção deixam de repetir geração por fallback ou erro. Falha, ausência de saída ou resposta parcial encerram para reconciliação, preservando parciais; nova tentativa depende de decisão humana e orçamento. Fallbacks sem geração continuam disponíveis.

## 0.1.2

Distribuição pública inicial no marketplace v3.18.0. Metadados apontam para o repositório público; pacote autocontido e política nativa de modelos preservados.

## 0.1.1 — 2026-09-08

- Política Codex explícita: herança de modelo/effort, preferência OpenAI por papel e identidade efetiva separada; instruções históricas de modelo não governam esta distribuição.
- Falha operacional encerra o bridge sem fallback legado; respostas e solicitações interrompidas são preservadas para reconciliação. Achados de conteúdo mantêm os gates e tetos.
- Sincronizada a correção compartilhada de preflight com erro de script.

## 0.1.0 — 2026-09-06

Primeira adaptação Codex. Verificação técnica nesta etapa; avaliação comportamental e publicação seguem o plano do repositório.
