# Origem das regras numéricas e decisórias

Cada regra do hermes que decide ou limita uma recomendação tem uma origem declarada. Três
categorias, sem quarta:

- **oficial**: documentada pela plataforma ou fonte primária; a linha traz a URL.
- **metodologia**: decisão fixa do plugin, com valor e piso no script (hoje, a janela mínima de
  veredito e o que depende dela). Não é heurística de mercado: o `config` só a ajusta para cima.
- **heurística**: convenção de mercado; vira parâmetro do perfil do
  negócio (`config` da `regua-decisao`); os limiares do `analisar-produto` têm valor de referência
  declarado em `contrato.md` e podem ser sobrescritos em `parametros`. A coluna Parâmetro diz qual chave a governa.

A saída da `regua-decisao.mjs` traz `regras_aplicadas` com `{ regra, origem, fonte | parametro }`
para cada regra aplicada; esta tabela é a lista completa e é conferida pelo contrato
(`tests/test_skill_contracts.py`). Regra nova entra aqui no mesmo diff que a cria.

## Régua de decisão (`skills/regua-decisao`)

| Regra | Origem | Fonte ou parâmetro |
|---|---|---|
| `aprendizado-edicao` | oficial | https://www.facebook.com/business/help/112167992830700 (edição significativa reinicia o aprendizado) |
| `aprendizado-eventos` | oficial | https://www.facebook.com/business/help/112167992830700 (limiar de eventos, guarda opcional) |
| `janela-minima` | metodologia | `janela_minima_veredito_dias` (valor e piso de 7 no script) |
| `janela-mista` | metodologia | `janela_minima_veredito_dias` |
| `piso-diagnostico` | heurística | `piso_diagnostico` |
| `degrau-recente` | metodologia | `janela_minima_veredito_dias` |
| `piso-reversao` | metodologia | `janela_minima_veredito_dias` (e o CAC breakeven da régua) |
| `reverter-degrau` | metodologia | `janela_minima_veredito_dias` |
| `pausa` | heurística | `piso_veredito_pausa`; o piso efetivo nunca fica abaixo do CAC breakeven e, quando é ele que governa, a saída cita `reguas.cac_breakeven` e `piso_efetivo` |
| `piso-pausa` | heurística | `piso_veredito_pausa` |
| `sinais-divergentes` | heurística | régua do unit-economics citada em `reguas.fonte` |
| `escala-sem-sinal` | heurística | `conversoes_minimas_escala` |
| `intervalo-degrau` | heurística | `intervalo_minimo_degrau_dias` (aceita 3 a 7) |
| `escala` | heurística | `conversoes_minimas_escala` sobre a régua do unit-economics |
| `dentro-da-regua` | heurística | régua do unit-economics citada em `reguas.fonte` |
| `faixa-lucro` | heurística | `lucro_por_real_referencia_min` e `lucro_por_real_referencia_max` (informa, não decide) |
| `piso_opiniao_fadiga` | heurística | `piso_opiniao_fadiga` (abaixo dele a fadiga não opina) |

## Sinais do `analisar-produto` (`skills/analisar-produto`)

| Regra | Origem | Parâmetro |
|---|---|---|
| `fatiaAlta` | heurística | fatia de impressões a partir da qual o item domina a vitrine |
| `fatiaBaixa` | heurística | fatia de impressões até a qual o item está escondido |
| `razaoConversaoBaixa` | heurística | taxa do item ÷ taxa média, abaixo disso converte pouco |
| `razaoConversaoAlta` | heurística | taxa do item ÷ taxa média, acima disso converte muito |
| `minViewsSinal` | heurística | views mínimas para receber sinal |
| `jaccardMinimo` | heurística | similaridade mínima de tokens na junção de nomes |
| `lacunaMaxItens` | heurística | itens do catálogo até os quais a célula (ou o par de eixos, com 3 ou mais) é lacuna de portfólio |
| `razaoCliqueAlta` | heurística | CTR do item ÷ CTR médio, acima disso chama clique |
| `razaoCompraBaixa` | heurística | taxa de compra do item ÷ média, abaixo disso vende pouco |

## Moeda

Pisos e valores em dinheiro usam a `moeda` do perfil do negócio (código de 3 letras); nenhuma
regra assume uma moeda.
