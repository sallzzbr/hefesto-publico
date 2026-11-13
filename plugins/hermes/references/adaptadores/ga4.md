# Adaptador: analytics (GA4)

Categoria `analytics` do `CONNECTORS.md`. Somente leitura, para o funil do site e a leitura de
eventos de compra.

## Doutrina

- Analytics mede comportamento no site; receita e lucro continuam sendo do ledger. Divergência
  entre as duas fontes é achado, não erro a esconder.
- O evento de conversão vem do perfil do negócio; a skill não assume `purchase`.

## Limites

- Amostragem e limiar de privacidade podem ocultar linhas em recortes pequenos.
- Dados do dia corrente são parciais; análises usam dias fechados.
- Atribuição de canal do analytics difere da atribuição da plataforma de anúncios; os dois
  números não se somam nem se comparam sem rótulo.

## Campos

Mapeamento dos campos da Data API (GA4) para o vocabulário do hermes.

| Hermes | Campo da plataforma |
|---|---|
| sessões | `sessions` |
| usuários ativos | `activeUsers` |
| contagem de evento | `eventCount` (por `eventName`) |
| compras | `ecommercePurchases` ou `transactions` |
| receita de compra | `purchaseRevenue` |
| canal | `sessionDefaultChannelGroup` |
| página | `pagePath` |
