# Evals do odin

Casos executáveis de `claude plugin eval` derivados das frases golden de
`../docs/roteamento-matrix.md` (a matriz continua sendo a fonte legível; este diretório é a
versão executável dela).

## Layout

Um diretório por frase, no formato `evals/**/prompt.md + graders/*.md` documentado pelo
`claude plugin eval --help`:

```
evals/roteamento/<NN>-<slug>/
├── prompt.md            # a frase golden, verbatim
└── graders/
    └── criteria.md      # critério LLM: qual banner de ativação deve (e não deve) aparecer
```

O sinal observável é o **banner de ativação** que toda skill imprime como primeira linha
(ex.: `🧭 Skill \`descobrir\` ATIVADA`). Casos "nenhum/fluxo direto" verificam a ausência de
qualquer banner. Casos com comportamento extra (portão 0.5, /spec parando no gate, falta de
spec bloqueando o dev-loop) declaram isso em "Comportamento adicional".

## Como rodar

```bash
claude plugin eval plugins/odin                       # todos os casos
claude plugin eval plugins/odin --case 'roteamento/42*'  # um caso
```

Rodar **antes de cada release**, junto da auditoria manual da matriz.

## Limitação conhecida

`claude plugin eval` está em **early access** (na CLI 2.1.211 o comando responde
"`plugin eval` is currently in early access" e não executa). Este esqueleto segue o formato
documentado no `--help` (`evals/**/prompt.md + graders/*.md`), mas ainda não foi executado de
ponta a ponta; quando o comando liberar, validar o formato na primeira rodada e ajustar o que
o runner exigir. Até lá, a auditoria manual da matriz continua sendo o teste de release.

Vale lembrar: os casos rodam sem scaffold de projeto — frases que pressupõem estado (spec
aprovada, dossiê pronto) avaliam só a ATIVAÇÃO da skill certa; o gate interno da skill pode
legitimamente bloquear depois do banner.
