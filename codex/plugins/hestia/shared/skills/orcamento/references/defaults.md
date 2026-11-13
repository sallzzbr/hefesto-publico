# Defaults do usuário (Hestia)

Contrato compartilhado por todas as skills e comandos do hestia.

## Arquivo

`~/.claude/hestia/defaults.md` — vale para qualquer projeto/sessão do usuário.

## Resolução da pasta de dados (regra única)

Onde os dados do hestia vivem no Google Drive se resolve nesta ordem:

1. **Config do workspace**: campo `local_dados` na seção `## Paths do workspace` do
   `CLAUDE.md` do repositório atual (quando a sessão roda num workspace consumidor).
2. **Defaults do usuário**: campo `local_dados` deste arquivo.
3. **Convenção descoberta no cwd**: por ser uma pasta remota do Drive, o hestia não tem
   candidato local independente; este nível só reconhece um path já declarado pelo workspace.
4. **Default documentado**: `Financas/hestia/`.

Exatamente um candidato declarado é usado; mais de um candidato concorrente exige perguntar ao
usuário; nenhum candidato nos três primeiros níveis cai no default documentado.

Fallback de LEITURA legado (era `economia-domestica`): se um arquivo não existir na pasta
resolvida mas existir em `local_dados_legado` (default `Financas/economia-domestica/budget/`,
só orçamento), leia de lá, avise e ofereça migrar por cópia — escrita é SEMPRE na pasta
resolvida.

Toda skill e comando do hestia resolve por esta regra; os paths `Financas/hestia/...`
citados em exemplos e templates são **ilustrativos do default, não hardcode**. As subpastas
por domínio são fixas relativamente à base resolvida: `orcamento/`, `mercado/`,
`investimentos/`.

## Campos permitidos

- `local_dados`: pasta-base dos dados no Google Drive (default: `Financas/hestia/`).
  Sempre referida por caminho/nome, NUNCA por ID de pasta.
- `local_dados_legado`: pasta legada de leitura (default:
  `Financas/economia-domestica/budget/`). Vazio = desliga o fallback.

## Campos proibidos

- Tokens, senhas, API keys, cookies.
- IDs de pasta/arquivo do Drive (mudam de ambiente e vazam estrutura da conta).
- PII de terceiros.

## Protocolo

1. Skill que precise da pasta: resolver pela regra acima sem re-perguntar.
2. Sem workspace e sem defaults: usar o default documentado direto — não perguntar
   (o hestia funciona de primeira numa conversa avulsa).
3. Override mencionado na conversa ("usa a pasta X") vale só para a rodada; regravar o
   default só quando o usuário disser que virou padrão.
