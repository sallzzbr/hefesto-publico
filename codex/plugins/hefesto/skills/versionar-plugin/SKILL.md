---
name: versionar-plugin
description: "Use when o usuário pedir para alterar a versão semver de um plugin Codex após uma correção, nova capacidade ou quebra de contrato."
---

# Versionar Plugin

Na primeira utilização, leia `../../RUNTIME.md`.

## Entrada

Identifique o plugin, a versão atual em `.codex-plugin/plugin.json` e a mudança desde a última versão. Classifique `patch` para correção compatível, `minor` para capacidade compatível e `major` para quebra de contrato.

## Fluxo

1. Proponha o grau com justificativa quando ele não tiver sido informado.
2. Atualize `version` no manifesto do plugin.
3. Se o usuário também colocou um marketplace Codex no escopo, alinhe a referência conforme o schema existente; não crie nem altere marketplace por presunção.
4. Atualize changelog existente quando fizer parte do pacote. Não crie arquivos auxiliares sem necessidade.
5. Rode `validar-plugin` e reporte a versão anterior, a nova e o resultado.

## Limites

- Não misture manifestos Claude e Codex.
- Não instale, publique, commite ou faça push sem autorização correspondente.
- Versionamento não demonstra compatibilidade; valide o comportamento afetado separadamente.
