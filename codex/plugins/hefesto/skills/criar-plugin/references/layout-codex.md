# Layout de plugin Codex

```text
<plugin>/
├── .codex-plugin/
│   └── plugin.json
└── skills/
    └── <skill>/
        ├── SKILL.md
        ├── references/
        ├── scripts/
        └── assets/
```

O manifesto mínimo gerado contém `name`, `version`, `description` e `skills: "./skills/"`. `name` deve ser igual ao diretório do plugin. Declare `apps` ou `mcpServers` somente quando os respectivos arquivos e configurações reais existirem.

O scaffold não cria entrada de marketplace por padrão. Em um repositório que já tenha marketplace Codex, preserve seu schema e só o edite quando o pedido incluir registro ou publicação.
