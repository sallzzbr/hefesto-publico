# Changelog

## 0.2.5 (2026-11-10)

Paridade com o hefesto 4.2.4: validador que dispensa, no inventário dos docs, o plugin que o inventário de publicação exclui da distribuição.

## 0.2.4

Referências operacionais pessoais abstraídas e consumidores atualizados para o contrato de perfil local do autor.

## 0.2.3

- `criar-skill` standalone recusa `skills/` ou destino que seja symlink, em vez de gravar fora do plugin. O parser de frontmatter recusa `chave:valor` sem espaço depois dos dois-pontos, que um leitor YAML não lê como mapa.
- A cópia do validador de plugins (`shared/`) acompanha o validador Claude 4.2.2, que também passa a exigir o espaço depois dos dois-pontos em `name` e `description`.

## 0.2.2

- Validador nativo aceita metadata como mapa de strings com parser compartilhado pelo checker; recusa duplicações, indentação inconsistente e estruturas não suportadas. Regressões executam ambos os validadores em fixtures isoladas.

## 0.2.1

- Criar-skill segue a convenção de atalhos do plugin e pergunta somente diante de padrão ausente ou ambíguo; pacote somente Codex mantém a skill nativa sem commands/. Contrato coberto em scaffold-marketplace.test.mjs.

## 0.2.0

- Forja dual condicional e exigência explícita de Iris na autoria, com defaults isolados por CODEX_HOME.

## 0.1.5

- Corrige validação de faixas de dependências, argumentos e portabilidade; valida recursos nativos Codex recursivamente.

- Explicita os links dos quatro entrypoints para seus contratos de domínio empacotados, mantendo o fluxo e layout nativos.

## 0.1.4 (2026-11-02)

- Sincroniza a forja 4.1.0 em `shared/`: os contratos de `criar-plugin` e `criar-skill` citam a
  `iris` como uso direto e a cópia do `validar.mjs` confere `dependencies` do `plugin.json`
  Claude. O manifesto Codex não tem campo de dependência: este pacote não exige a `iris`, e as
  skills nativas não mudam. A decisão do lado Codex fica para uma sessão Codex.
- Decisão 19A do dono (2026-11-03): o `RUNTIME.md` ganha a seção "Perguntas ao usuário". Não se pergunta o que dá para verificar por leitura ou comando, o trabalho que não depende da resposta vem antes, a pergunta necessária é curta e completa, fecha a mensagem e encerra o turno, e nada continua executando depois dela; regra de pergunta da skill ou do contrato de domínio se soma. Teste que trava a instrução escrita (não o comportamento): `codex/tests/runtime-pergunta.test.mjs`, que lê o RUNTIME de cada pacote do marketplace Codex.
- Revisão da decisão 19A (2026-11-03): a regra restringe o fim do turno à pergunta direta; pela ferramenta de interação da sessão a resposta volta no mesmo turno, e nada continua executando antes de ela chegar. Sem a ressalva, a seção contradizia a linha do mesmo `RUNTIME.md` que oferece perguntar pela ferramenta de interação ou por pergunta direta, e proibia seguir depois da resposta. Caso novo por pacote em `codex/tests/runtime-pergunta.test.mjs`.

## 0.1.3 — 2026-11-01

- Sincroniza a forja 4.0.1: indicação do plugin `iris` para calibrar agentes e skills ao modelo de destino.
- Scripts da forja rodam da raiz do workspace com o caminho real do script; a instrução "a partir do diretório desta skill" fazia path relativo criar o plugin dentro do pacote instalado (achado hefesto-03/CX-02).

## 0.1.2

Distribuição pública inicial no marketplace v3.18.0. Metadados apontam para o repositório público; pacote autocontido e política nativa de modelos preservados.

## 0.1.1 — 2026-09-08

- Política Codex explícita: herança de modelo/effort, preferência OpenAI por papel e identidade efetiva separada; instruções históricas de modelo não governam esta distribuição.

## 0.1.0 — 2026-09-06

Primeira adaptação Codex. Verificação técnica nesta etapa; avaliação comportamental e publicação seguem o plano do repositório.

- Correção validada na etapa 3: referências Markdown locais sem `../` agora exigem recurso existente e sem symlink; destinos com parênteses e títulos também são conferidos.
