# Changelog

## 0.1.10 (2026-11-10)

Paridade com o mimyr 1.1.14: higiene de resíduos de nome, sem mudança de comportamento.

## 0.1.9

Referências operacionais pessoais abstraídas e consumidores atualizados para o contrato de perfil local do autor.

## 0.1.8

- Runtime do bridge: `responder` com `.lock` preexistente falha com diagnóstico (caminho do lock, execução interrompida, conferir o pid e remover manualmente) em vez do erro cru, sem remover o lock sozinho. O schema mede `minLength` e `maxLength` em pontos de código, não em unidades UTF-16.

## 0.1.7

- Runtime respeita CODEX_HOME explícito para defaults, sem ler configuração real por fallback.
- Respeita templates e Python resolvidos, delimita correções por capítulo e recusa verde com falhas.
- Corrige execução direta do bridge em paths com symlink e `--preserve-symlinks-main`.

- Falha mecânica com campo extra `capitulo` não desvia o roteamento por arquivo nem oculta falha fora do escopo.

## 0.1.6 — 2026-11-01

- Perfil desconhecido do controlador é erro de args (antes caía em silêncio no default); acento/caixa normalizados.
- Bridge: diagnostica diretório do run existente, pai ausente ou sem escrita; ignora `__pycache__`, `*.pyc` e `.DS_Store` no fingerprint (scripts Python de shared/ rodados sem `-B` deixavam de recusar a retomada); recusa por fonte alterada lista os arquivos envolvidos e orienta reinstalar a mesma versão em vez de apagar à mão; symlink com nome de cache continua recusado; erro de gravação preserva código e causa e não deixa diretório órfão.
- Decisão 19A do dono (2026-11-03): o `RUNTIME.md` ganha a seção "Perguntas ao usuário". Não se pergunta o que dá para verificar por leitura ou comando, o trabalho que não depende da resposta vem antes, a pergunta necessária é curta e completa, fecha a mensagem e encerra o turno, e nada continua executando depois dela; regra de pergunta da skill ou do contrato de domínio se soma. Teste que trava a instrução escrita (não o comportamento): `codex/tests/runtime-pergunta.test.mjs`, que lê o RUNTIME de cada pacote do marketplace Codex.
- Revisão da decisão 19A (2026-11-03): a regra restringe o fim do turno à pergunta direta; pela ferramenta de interação da sessão a resposta volta no mesmo turno, e nada continua executando antes de ela chegar. Sem a ressalva, a seção contradizia a linha do mesmo `RUNTIME.md` que oferece perguntar pela ferramenta de interação ou por pergunta direta, e proibia seguir depois da resposta. Caso novo por pacote em `codex/tests/runtime-pergunta.test.mjs`.

## 0.1.5 — 2026-09-11

- Revisão de acessibilidade usa melhorar_a11y.py --dry-run: mostra alterações propostas sem escrever no original. A aplicação explícita mantém o modo de correção e idempotência; opção inválida é recusada antes de escrever.

## 0.1.4 — 2026-09-09

- Geração valida objetivo, critérios, IDs e destinos disjuntos antes dos escritores. Relatos de escrita exigem path lexical completo e base explícita; workspaceRoot resolve bases relativas/absolutas. Limite físico de symlinks e efeitos omitidos permanece explícito.

## 0.1.3

Distribuição pública inicial no marketplace v3.18.0. Metadados apontam para o repositório público; pacote autocontido e política nativa de modelos preservados.

## 0.1.2 — 2026-09-08

- Política Codex explícita: herança de modelo/effort, preferência OpenAI por papel e identidade efetiva separada; instruções históricas de modelo não governam esta distribuição.
- Falha operacional encerra o bridge sem fallback legado; respostas e solicitações interrompidas são preservadas para reconciliação. Achados de conteúdo mantêm os gates e tetos.

## 0.1.1 — 2026-09-06

- Recursos compartilhados sincronizados com mimyr 1.1.8. Sincronização do índice preserva a duração de cursos curtos, sem arredondar tempo positivo para zero; reaplicação permanece idempotente.

## 0.1.0 — 2026-09-06

Primeira adaptação Codex. Verificação técnica nesta etapa; avaliação comportamental e publicação seguem o plano do repositório.
