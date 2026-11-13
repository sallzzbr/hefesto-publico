# Migração do hermes 1.x para 2.0.0

Mapa completo do que muda de contrato na 2.0.0, para quem consome o plugin com dados e scripts próprios. A redação do `CHANGELOG.md` resume; este arquivo tem as chaves literais. A coluna "Antes" lista identificadores da 1.x como código, de propósito: é a única forma de o consumidor localizar o que renomear.

## Ordem segura

1. Deixe os dados compatíveis com a 1.5.8 antes do bump (colunas, chaves, frontmatter), sem mudar comportamento.
2. Declare os paths do workspace, as heurísticas da régua e o perfil do negócio.
3. Feche os runs abertos do criativo-fluxo (rota aprovada na 1.x não é reaproveitada: a saída agora é presa ao segmento).
4. Só então instale a 2.0.0, fora da rotina diária.

## O que o consumidor deve criar

| Arquivo | Conteúdo |
|---|---|
| `contexto/perfil-do-negocio.md` (ou o path de `local_perfil`) | `moeda`, `segmentos` (a lista das pastas de render que o negócio já usa, uma por segmento) e `eixos` do catálogo; `modelo`, `pais` e os demais campos são opcionais; formato em `references/perfil-do-negocio.md` |
| `manifesto-scripts.json` ao lado dos scripts (ou o path de `local_manifesto`) | uma entrada por compositor: `nome`, `executavel` e `campos` (`saida`, `base`, `formato`, `textos`, `opcoes`), `logRender` e `sobrescrever` opcionais; sem ele o preflight reprova |
| `config` da `regua-decisao` | `moeda` (código de 3 letras) e as 7 heurísticas: `piso_diagnostico` 50, `piso_opiniao_fadiga` 100, `piso_veredito_pausa` 200, `conversoes_minimas_escala` 10, `intervalo_minimo_degrau_dias` 7, `lucro_por_real_referencia_min` 0,70, `lucro_por_real_referencia_max` 1,50 (valores da 1.x, em reais) |

## Mapa de chaves

O mapa abaixo descreve o campo da versão anterior pelo papel que ele tinha, sem repetir o identificador antigo: o plugin público não carrega o vocabulário de um negócio específico. Quem precisa do nome literal o encontra no próprio código da 1.x instalado.

### `analisar-produto`

| Antes (1.x) | Depois (2.0.0) |
|---|---|
| entrada: lista de itens vendidos, com três campos fixos por linha (o nome do item e dois atributos de classificação do negócio original) | `itens[]` com `item` por linha; os valores de cada eixo vêm de `catalogo[].eixos` |
| `catalogo[]` com os mesmos três campos fixos | `catalogo[]` com `item` e o mapa `eixos` (um valor por eixo do perfil) |
| campo de vendas da casa excluídas (a contagem de vendas internas) | `vendas_internas_excluidas` (contagem em unidades) |
| `conjuntos[]` com a lista de itens sob o nome antigo | `conjuntos[].itens` |
| parâmetro do limite de itens por célula de lacuna, sob o nome antigo | `parametros.lacunaMaxItens` |
| saída: `vitrine[]` com o nome do item sob o campo antigo | `vitrine[].item` |
| saída: `lacunas[]` com os dois atributos fixos de classificação | `lacunas[]` = `{ celula: { <eixo>: <valor> }, itens }`; com 3 ou mais eixos a célula é um par de eixos |
| CSV com três colunas fixas (item e os dois atributos) | CSV com `item` e uma coluna por eixo |
| resumo e relatório com rótulos fixos de um negócio específico | só números, vereditos e nomes de item; os eixos vêm do perfil |
| entradas da 1.x aceitas | formato antigo recusado (sem alias): chave desconhecida é erro |

### `regua-decisao`

| Antes (1.x) | Depois (2.0.0) |
|---|---|
| heurísticas com default no script | as 7 heurísticas e `moeda` obrigatórias em `config` |
| saída `R$250,00` | `BRL 250,00` (código da moeda do perfil) |
| origem `heurística` para a janela mínima | origem `metodologia` |
| rótulo da 1.x que atribuía as heurísticas a uma fonte pessoal | `heurística de mercado` e `referência de mercado` (campos `rotulo`, `lucro.rotulo`, `lucro.texto`) |

Nenhuma decisão (pausar, manter, escalar, reverter-degrau) muda por causa da renomeação.

### Harness do `criativo-fluxo` e rotas

| Antes (1.x) | Depois (2.0.0) |
|---|---|
| rota com a chave de segmento da versão anterior (uma categoria do negócio original, por peça) e render na pasta com esse nome | rota com `segmento`, também por peça, e render em `renders/<segmento>/`; o perfil lista os permitidos em `segmentos` e o harness recusa o que não estiver na lista (`args.segmentos`); `compor.saida` presa a `<marketing>/criativos/renders/<segmento da rota>/<slug da rota>.png` |
| `args.logRender` e a flag de sobrescrever da rota | removidos; `logRender` e a flag de sobrescrever vêm do `manifesto-scripts.json`, obrigatório |
| rota sem `acoes` (comando legado de rough e overlay em texto livre) | removida; rota sem `acoes` é erro |
| critério de fidelidade à arte do negócio original (17 critérios) | substituído por `fidelidade_mockup` (17 critérios), bloqueante mesmo sem baseline quando há mockup; `fidelidade_referencia` segue bloqueante só com baseline |
| `logRender` fixo por compositor no manifesto | aceita os marcadores `{slug}`, `{segmento}` e `{hoje}` (data ISO): log datado ou nomeado por peça cabe no manifesto; a ação `validar` da rota também aceita um `logRender` próprio |

## Skills que saem do pacote

As skills de revisão e de sugestão de arte da 1.x e o script de validação de arte que as acompanhava deixam de fazer parte do plugin público. Quem as usa deve mantê-las como skills do próprio projeto (`.claude/skills/`) ou num plugin próprio.

## O que o consumidor ajusta nos próprios dados

- Renomear as colunas dos CSVs, o frontmatter das fichas e o script de reindexação do registry num commit único.
- Adaptar o script de agregação de vendas por item e a coluna composta do ledger às chaves novas.
- Não reescrever rotas aprovadas antigas: elas ficam como histórico.
- Atualizar os testes do projeto que leem a saída do `analisar-produto` (golden), o reindex do registry e os docs que citam as chaves antigas.
- Cada pasta de renders existente vira um item de `segmentos`; o nome igual ao da pasta atual evita mover arquivos.
