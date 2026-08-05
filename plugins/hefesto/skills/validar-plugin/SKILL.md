---
description: "Validate a Claude Code plugin/marketplace repo: manifests, versions in sync, skill frontmatter, portable paths. Use when the user asks to validar um plugin, checar o marketplace, conferir versões/frontmatter antes de commitar, ou como verificação final de criar-plugin/criar-skill/versionar-plugin."
---

# Validar Plugin

Valida um repo-marketplace e seus plugins. As checagens objetivas são feitas por script determinístico — não reimplemente na mão o que o script já cobre; seu papel é rodá-lo, interpretar a saída e corrigir.

## Como rodar

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/validar-plugin/scripts/validar.mjs" [raiz-do-marketplace] [--plugin <nome>]
```

- Sem argumentos: encontra a raiz do marketplace subindo a partir do cwd e valida todos os plugins.
- `--plugin <nome>`: valida só um plugin.
- Exit 0 = sem erros (avisos podem existir); exit 1 = há erros.

## O que o script checa

- `marketplace.json` parseia; `metadata.version` é semver; cada entrada tem `name`, `source` (string relativa `./...`, sem `..`), `version`; avisa entrada sem description/category/tags.
- Cada plugin listado existe em disco, tem `plugins/<nome>/.claude-plugin/plugin.json` válido, `name` igual ao diretório e à entrada, `version` semver alinhada com o marketplace, `description` presente (erro); avisa se faltar author, license, keywords ou homepage/repository.
- `README.md` e `AGENTS.md`, quando existirem na raiz, têm o inventário de plugins alinhado com `marketplace.json` na linha-resumo principal.
- `README.md` de cada plugin, quando existir, inventaria o que está em disco nas seções reconhecidas de `Skills`, `Commands/Comandos` e `Agents` (incluindo subseções); nomes fantasmas, itens faltando e seções vazias viram erro.
- O bloco `## Estrutura` do `README.md` de um plugin, quando existir, é tratado como contrato de caminhos: a raiz documentada precisa bater com o diretório real e cada item listado precisa existir em disco com o tipo esperado.
- Todo diretório em `skills/` tem `SKILL.md` com frontmatter fechado por linha `---` exata e `description` não-vazia de até 1024 chars. O parser rejeita valor que é só comentário YAML (`description: # TODO`) e scalar multilinha (`>`, `|`) sem conteúdo — a coleta de linhas indentadas para na primeira chave seguinte.
- Todo `commands/*.md` e `agents/*.md` tem frontmatter com `description`.
- Nenhum arquivo de texto relevante do plugin fora de `tests/` (`.md`, `.mjs`, `.js`, `.json`, `.py`, `.sh`, `.txt`, `.yml`, `.yaml`) contém path absoluto de Windows (erro) ou de home Unix (aviso). O próprio `skills/validar-plugin/scripts/validar.mjs` é ignorado nesse scan para não se autossinalizar; symlinks também são ignorados com aviso (proteção contra ciclos).
- **Path de domínio sem cláusula completa de resolução é erro**: detectar estrutura relativa de workspace consumidor dentro ou fora de backticks, em qualquer arquivo de texto da skill (`.md`, `.mjs`, `.js`, `.json`, `.py`, `.sh`, `.txt`, `.yml`, `.yaml`) — o mesmo escopo do scan de portabilidade, porque path hardcoded em prompt de `.py` quebra igual ao de um `.md`. O próprio arquivo que contém o path deve declarar `CLAUDE.md` do workspace → defaults do usuário com `local_*` → convenção descoberta no cwd → default documentado, ou delegar explicitamente à referência canônica `references/.../defaults.md`; nos dois casos, marcar paths literais como ilustrativos. Uma palavra isolada como “resolução”, outro `.md` da skill ou um prefixo interno apenas parcialmente coincidente não libera o arquivo. Prefixos internos reais do plugin e paths já injetados por `DIR.*` não contam.
- Plugins em disco que não estão no `marketplace.json` (aviso).
- `--plugin` sem nome é erro de uso (exit 1), nunca validação silenciosa de tudo.

## Depois de rodar

1. Reporte ao usuário: erros primeiro, depois avisos, com path e correção proposta.
2. Corrija os erros (ou peça decisão quando a correção tiver mais de um caminho — ex.: versão dessincronizada pode subir ou descer).
3. Rode de novo até exit 0.
4. O que o script não vê — julgamento humano/IA: description com gatilhos fracos, skill duplicando outra, instruções vagas de I/O. Aponte esses achados separadamente como sugestões.

## Important

- O script não tem dependências — só Node. Se `node` não existir na máquina, informe e caia para a checagem manual (JSON via `python3 -m json.tool` + inspeção dos frontmatters).
- Avisos de home Unix podem ser falso-positivo em documentação de exemplo; confirme antes de "corrigir".
