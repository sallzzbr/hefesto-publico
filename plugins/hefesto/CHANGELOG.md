# Changelog — hefesto

## 4.2.4 (2026-11-10)

O validador deixa de cobrar no inventário dos docs (README e AGENTS) o plugin que o inventário de publicação exclui da distribuição.

## 4.2.3

Referências operacionais pessoais abstraídas e consumidores atualizados para o contrato de perfil local do autor.

> Histórico anterior à 3.1.5 vive nos commits do repositório privado; o espelho público nasce
> com histórico fresco a cada release, e este arquivo é o que sobrevive à travessia.

## 4.2.2

- O validador de plugins deixa de aceitar `description:valor` e `name:valor` sem espaço depois dos dois-pontos, que YAML não lê como esses campos; `description:` seguido de bloco (`>`, `|`) continua válido. Paridade com a correção do frontmatter na distribuição Codex. Coberto em validar-plugin-manifestos.test.mjs.

## 4.2.1

- Criar-skill segue a convenção de atalhos do plugin e pergunta somente diante de padrão ausente ou ambíguo; pacote somente Codex mantém a skill nativa sem commands/. Contrato coberto em scaffold-marketplace.test.mjs.

## 4.2.0

- Forja gera as duas distribuições em repositório com inventário Codex, com colisões verificadas antes de escrever e pacote nativo autocontido.

## 4.1.1

- Corrige validação de faixas de dependências, argumentos e portabilidade; valida recursos nativos Codex recursivamente.

## 4.1.0 (2026-11-02)

- A forja passa a exigir o plugin `iris` no Claude Code: o `plugin.json` declara
  `"dependencies": ["iris"]`, resolvido neste marketplace. Efeito para quem instala: instalar
  `hefesto@hefesto` instala também `iris@hefesto`, e desativar a `iris` desativa a forja na
  próxima carga de plugins. Quem já tem a forja recebe a `iris` ao atualizá-la (auto-update do
  marketplace, ou `claude plugin update hefesto` seguido de `/reload-plugins`).
- `criar-plugin` usa `iris:delegar-agente` para escrever agentes e `criar-skill` usa
  `iris:escrever-prompt` para calibrar corpo e `description`; sai o caminho alternativo "quando
  instalado".
- `validar.mjs` confere `dependencies` do `plugin.json` no formato da doc oficial (`"nome"`,
  `"nome@marketplace"` ou `{ name, marketplace?, version? }`): nome que não está no
  marketplace é erro; dependência de outro marketplace é erro sem
  `allowCrossMarketplaceDependenciesOn` e aviso com ele. Antes o campo passava sem conferência,
  e um nome errado só aparecia como plugin desativado para quem instalasse.
- `criar-plugin` orienta declarar em `dependencies` o plugin sem o qual o novo plugin não
  funciona; `validar-plugin` documenta a checagem nova.
- Distribuição Codex fora desta decisão: o manifesto Codex não tem campo de dependência.

## 4.0.1 — 2026-11-01

- `criar-plugin` e `criar-skill` indicam o plugin `iris` (quando instalado) para calibrar a `description` e o corpo de agentes e skills ao modelo de destino; sem ele, as convenções da forja continuam valendo.

## 4.0.0 — 2026-09-05 (correções do teste Claude)

- Quebra de contrato do validador: toda skill exige `name`, inclusive plugins externos. Migração: adicionar `name` igual ao diretório no frontmatter. Commands e agents preservam suas regras.
- `criar-skill` fornece molde completo e exige releitura + validação após escrever. `criar-plugin` aplica a mesma regra quando o pedido inclui uma primeira skill.
- Regressão cobre ausência de `name`; fixtures positivas agora declaram o campo.

## 3.1.7 — 2026-09-05 (preparação para teste Claude)

- Corrigido YAML de metadados detectado por `claude plugin validate`: campos com colchetes ou dois-pontos passam a ser strings entre aspas.
- Metadado `name` explícito nas skills e no scaffold; validador recusa nome inválido ou divergente do diretório sem rejeitar skills externas Claude que omitem o campo.
- `name` explícito em todas as skills, alinhado ao diretório.

## 3.1.6 — 2026-09-02 (convenções que descrevem a prática)

Pendência da auditoria de 2026-09-01: `criar-skill/references/convencoes-skill.md` prescrevia o
que 26 das 42 skills do marketplace não seguiam. Agora separa o que o `validar.mjs` **cobra**
(description presente, 60–1024 chars) do que é recomendação, registra os dois dialetos de
`description` (verbo EN × "Use quando…" PT), torna o command decisão por plugin, e nomeia as
exceções de emoji funcional. Sem mudança de comportamento nas skills.

- `tests/validar-plugin-manifestos.test.mjs` (21 casos): frontmatter, semver, `source`,
  `--plugin`, marketplace ausente, plugin fora do manifesto, avisos × erros — a metade do
  validador que o mutation testing mostrava sem teste. Entra no `stryker.conf.json`.

## 3.1.5 — 2026-09-02 (changelog)

- CHANGELOG novo. O gate de bump do marketplace (`scripts/verificar-bump.mjs`) passa a cobrar
  entrada aqui a cada versão. Sem mudança de comportamento nas skills.
