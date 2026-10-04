# Changelog

## 0.1.5 — 2026-10-04

- Sinal de duplicação/abstração da auditoria em arquivo da lista de testes protegidos vira pendência (`ponytail.pendenciasEmTestesDaSpec`), sem confirmador e sem bloquear: ninguém no loop pode editar esse arquivo. Achado de lente nesses testes continua bloqueando.
- A confirmação de sinal da auditoria responde `real` e `bloqueante` em campos separados e obrigatórios. Real e não bloqueante vira pendência com o veredito registrado; campo ausente bloqueia. Finding de lente mantém a severidade da lente.
- O helper de hashes emite `<sha256>-<conferência>` e o controlador recalcula a conferência. Evidência que não confere é recolhida uma vez em solicitação própria (`tdd:hashes`, `hashes:i<N>`); duas falhas seguidas encerram como erro de evidência. Só a divergência entre duas coletas conferidas é teste alterado.
- Revisão de contratos do controlador: `2026-10-04-r6`. Run de revisão anterior não é retomado.

## 0.1.4 — 2026-09-11

- Auditor e lentes inspecionam Git sem staging; arquivos novos selecionados e stage são apresentados separadamente. A entrega confere todos os paths staged contra o escopo aprovado antes de commit, preservando conteúdo alheio.

## 0.1.3 — 2026-09-09

- Bloqueantes confirmados de duplicação/abstração continuam bloqueando enquanto reaparecem na auditoria. Mudança do cenário exige nova confirmação; refutação e desaparecimento continuam liberando.

## 0.1.2

Distribuição pública inicial no marketplace v3.18.0. Metadados apontam para o repositório público e descrevem o adaptador Codex e a herança de modelo/esforço; pacote autocontido e política nativa de modelos preservados.

## 0.1.1 — 2026-09-08

- Política Codex explícita: herança de modelo/effort, preferência OpenAI por papel e identidade efetiva separada; instruções históricas de modelo não governam esta distribuição.
- Falha operacional encerra o bridge sem fallback legado; respostas e solicitações interrompidas são preservadas para reconciliação. Achados de conteúdo mantêm os gates e tetos.

## 0.1.0 — 2026-09-06

Primeira adaptação Codex. Verificação técnica nesta etapa; avaliação comportamental e publicação seguem o plano do repositório.
