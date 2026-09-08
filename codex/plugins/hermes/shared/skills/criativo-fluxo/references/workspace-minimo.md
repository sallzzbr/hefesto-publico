# Workspace mínimo sintético do criativo-fluxo

Este exemplo descreve o contrato de arquivos que um workspace consumidor precisa fornecer.
Ele serve para montar um fixture descartável e para adaptar scripts reais do projeto. O Hermes
não inclui `gerar_imagem.py`, compositores, validador, Pillow, credenciais ou uma implementação
falsa desses componentes.

```text
workspace/
├── .venv/
│   ├── bin/python                     # Windows: Scripts/python.exe
│   └── lib/pythonX.Y/site-packages/PIL/
├── branding/
│   ├── principios-criativos.md
│   ├── arquetipos-criativos.md
│   └── tom-de-voz-aplicado.md
├── contexto/
│   └── identidade-visual.md
├── marketing/
│   ├── criativos/{briefs,base,renders}/
│   ├── registry/criativos/
│   └── producao/pacotes-aprovacao/
└── scripts/
    ├── gerar_imagem.py                # somente para capacidade imagem-ia
    ├── compor_texto.py                # ao menos um compor_*.py
    └── validar_criativo.py
```

Os quatro diretórios-base podem ter outros nomes. Resolva `local_marketing`, `local_branding`,
`local_contexto` e `local_scripts` pela regra canônica de `references/defaults.md` (na mesma
pasta desta referência) e passe os resultados ao verificador; paths relativos são
interpretados a partir de `--workspace`.

## Contratos dos scripts do consumidor

`gerar_imagem.py` recebe prompt e destino conforme o comando produzido pela rota e grava uma
imagem nesse destino. É requisito exclusivo de `--capability imagem-ia`. Autenticação, flags e
provedor pertencem ao workspace.

`compor_*.py` recebe os argumentos declarados em `comandoOverlay` e grava o render composto no
destino declarado. Pelo menos um compositor precisa existir tanto para `texto` quanto para
`imagem-ia`.

`validar_criativo.py` aceita o render, `--formato`, `--arquetipo` e, quando aplicáveis,
`--texto-esperado` e `--baseline`. Ele devolve ao mecânico um resultado estruturado com `ok`,
`artefatos` e `falhas`; falha operacional não pode virar aprovação.

O preflight verifica apenas que esse layout está presente, incluindo o pacote `PIL` no venv.
Ele deliberadamente não importa Pillow nem executa esses scripts. Portanto, exit `0` não prova
qualidade visual, credenciais válidas, compatibilidade de flags ou sucesso de uma geração real;
essas fronteiras só são observáveis no teste manual do workspace.
