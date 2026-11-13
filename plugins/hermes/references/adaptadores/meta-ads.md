# Adaptador: plataforma de anúncios (Meta Ads)

Categoria `plataforma de anúncios` do `CONNECTORS.md`. Somente leitura: o hermes recomenda; criar,
pausar ou alterar anúncio é decisão humana, executada fora daqui.

## Doutrina

- Os números de atribuição da plataforma não são lucro de ledger: relatórios os rotulam como
  de plataforma e citam o fator ledger ÷ plataforma do `pnl-mensal`.
- Edição significativa reinicia a fase de aprendizado; a criação conta como edição. A regra
  de aprendizado é oficial (ver `references/regras-origem.md`).
- O plugin não versiona nome de tool do conector: elas se descobrem pela lista de tools do
  servidor instalado, e este adaptador só mapeia os campos. Conector de anúncios não é dado a
  agentes de criação (eles declaram `disallowedTools`).

## Limites

- Atribuição por janela (cliques e visualizações): conversões chegam com atraso e são revisadas;
  janelas recentes subestimam. A janela mínima de veredito da `regua-decisao` existe por isso.
- A API limita a taxa de chamadas e a profundidade do detalhamento (`breakdowns`); relatório
  grande pede paginação.
- Moeda e fuso horário vêm da conta de anúncios; conferir com `moeda` do perfil antes de somar.

## Campos

Mapeamento dos campos da Marketing API (Insights) para o vocabulário do hermes.

| Hermes | Campo da plataforma |
|---|---|
| gasto | `spend` |
| impressões | `impressions` |
| alcance | `reach` |
| frequência | `frequency` |
| cliques no link | `inline_link_clicks` |
| CTR do link | `inline_link_click_ctr` |
| conversões | `actions` (filtrar pelo `action_type` do evento de conversão do perfil) |
| receita atribuída | `action_values` (mesmo `action_type`) |
| ROAS | `purchase_roas` |
| entidade | `ad_id`, `adset_id`, `campaign_id` e os respectivos `*_name` |
