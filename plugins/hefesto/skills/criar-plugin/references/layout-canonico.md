# Layout canônico de marketplace + plugin

Referência da forja. Vale para qualquer repo-marketplace de Claude Code, não só o hefesto.

```
<repo>/                                     # raiz = marketplace
├── .claude-plugin/
│   └── marketplace.json                    # manifesto do marketplace (SÓ na raiz)
├── plugins/
│   └── <plugin>/
│       ├── .claude-plugin/
│       │   └── plugin.json                 # manifesto do plugin (SÓ aqui)
│       ├── README.md
│       ├── skills/
│       │   └── <skill>/
│       │       ├── SKILL.md                # nome do diretório = nome da skill
│       │       ├── references/             # material de apoio carregado sob demanda
│       │       ├── scripts/                # scripts .mjs/.py da skill (ver regra 6)
│       │       └── harness/                # opcional: Workflow self-contained quando a skill orquestra agentes
│       ├── scripts/                        # scripts compartilhados por várias skills do plugin
│       │   └── requirements.txt            # se houver deps pip (regra 6)
│       ├── tests/                          # opcional: contratos de skill / testes dos scripts / harness
│       ├── commands/
│       │   └── <comando>.md
│       └── agents/
│           └── <agente>.md                  # agentes fixos do harness quando houver
├── README.md
├── LICENSE
└── .gitignore
```

## Regras duras

1. `plugin.json` fica em `plugins/<plugin>/.claude-plugin/` — nunca na raiz do plugin, nunca na raiz do repo.
2. `marketplace.json` fica só na raiz do repo — nunca dentro de plugin.
3. Skills vivem em `plugins/<plugin>/skills/<nome>/SKILL.md`; o diretório é o nome da skill.
4. `source` no `marketplace.json` é path relativo string (`"./plugins/<plugin>"`); `"source": "."` não é válido.
5. Sem paths absolutos de SO em arquivo versionado (drive de Windows, home Unix). Dentro do plugin: `${CLAUDE_PLUGIN_ROOT}`. No projeto do usuário: paths relativos ao cwd.
6. Scripts são permitidos por plugin (precedentes: harness do odin, validador da forja, scripts Python do mimyr) — em `skills/<skill>/scripts/` quando servem a uma skill só, ou `plugins/<plugin>/scripts/` quando compartilhados. **Sem build step e sem install automático, nunca.** Deps pip são permitidas quando: (a) existe `requirements.txt` junto dos scripts; (b) cada skill que os invoca documenta o bootstrap de venv no primeiro uso; (c) sem o venv, a skill para com mensagem clara em vez de falhar silenciosamente. Deps pesadas/opcionais (ex.: torch) vão em requirements separado.
7. Recursos que a skill lê (templates, perfis) ficam dentro do plugin e são referenciados via `${CLAUDE_PLUGIN_ROOT}/...`.
8. Dados do usuário (personas, perfis de projeto, CSVs) ficam no projeto/workspace do usuário, nunca dentro do plugin.

## marketplace.json mínimo

```json
{
  "name": "<marketplace>",
  "owner": { "name": "<nome>", "url": "<url>" },
  "metadata": { "description": "<uma frase>", "version": "0.1.0" },
  "plugins": [
    {
      "name": "<plugin>",
      "source": "./plugins/<plugin>",
      "description": "<uma frase>",
      "version": "0.1.0",
      "category": "<categoria>",
      "tags": ["<tag>"]
    }
  ]
}
```

## Versionamento (resumo)

- `metadata.version` versiona o marketplace: minor ao adicionar plugin ou skill nova.
- `plugins[].version` no marketplace.json sempre alinha com o `plugin.json` correspondente.
- Semver por plugin: minor = skill nova; patch = ajuste em skill existente; major = quebra de contrato (renomear/remover skill usada por terceiros, mudar onde dados do usuário ficam).
