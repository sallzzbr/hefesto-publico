# Perfil do negócio

Arquivo do workspace do consumidor, lido e validado por `scripts/verificar_workspace.py`
(`--perfil "<local_perfil resolvido>"`; default `perfil-do-negocio.md` na raiz do workspace). O path
se resolve pela regra única: campo `local_perfil` da seção `## Paths do workspace` do CLAUDE.md, depois
dos defaults do usuário, depois do cwd, depois o default. Perfil ausente é pergunta ao usuário; o
script nunca assume valor.

## Formato

Markdown com **uma linha `chave: valor` por campo**, sem lista, negrito nem recuo. Títulos e prosa
em outras linhas são ignorados. Cada chave aparece **uma vez**: chave repetida é inválida.

| Chave | Valor | Validação |
|---|---|---|
| `modelo` | modelo de negócio (ex.: `e-commerce`) | texto não vazio |
| `evento_conversao` | evento que conta como venda | texto não vazio |
| `metrica_norte` | métrica que o negócio otimiza | texto não vazio |
| `moeda` | código de 3 letras maiúsculas (`BRL`, `EUR`) | formato |
| `pais` | código de 2 letras maiúsculas (`BR`, `PT`) | formato |
| `canais_ativos` | canais separados por vírgula | lista sem item vazio nem repetido |
| `aprovador` | quem aprova criativo e verba | texto não vazio |
| `segmentos` | segmentos permitidos, separados por vírgula; cada rota escolhe um, que nomeia a subpasta de renders (`renders/<segmento>/`) | cada item em minúsculas, dígitos, `-` e `_`; sem repetição |
| `eixos` | eixos de análise do `analisar-produto`, separados por vírgula | mesmo formato do segmento, sem repetição, sem nome reservado |
| `exclusao_vendas_internas` | regra para tirar da conta as vendas internas | texto não vazio |

O segmento é **por peça**: cada rota do criativo-fluxo carrega um `segmento` e o render sai em `renders/<segmento>/<slug>.png`; o perfil só declara a lista permitida (a skill a injeta no harness como `args.segmentos`, e o harness recusa rota com segmento fora dela). O campo único `segmento` da primeira versão da 2.0 não existe mais e não há alias: perfil com ele reprova com `perfil.segmentos`.

Os campos `modelo`, `pais`, `evento_conversao`, `metrica_norte`, `canais_ativos`, `aprovador` e `exclusao_vendas_internas` são **opcionais**: nenhuma skill do plugin os consome hoje, então ausentes viram aviso em `warnings` (`perfil.<campo>`); presentes e inválidos continuam bloqueando. Os demais são obrigatórios. Campo obrigatório ausente ou campo inválido entra em `missing` como `perfil.<campo>`; arquivo ausente, como
`perfil.arquivo`. O JSON devolve o perfil lido em `perfil`.

## Exemplo (fictício)

```
# Perfil do negócio

modelo: e-commerce
evento_conversao: purchase
metrica_norte: receita líquida
moeda: BRL
pais: BR
canais_ativos: meta-ads, analytics
aprovador: Responsável Exemplo
segmentos: acessorios, presentes
eixos: familia, acabamento, porte
exclusao_vendas_internas: pedidos com o cupom interno de teste
```

As heurísticas de decisão (pisos, janelas, intervalos) não ficam neste arquivo: vêm da seção
`## Réguas de decisão` do CLAUDE.md ou dos defaults e entram em `config` da `regua-decisao`.
