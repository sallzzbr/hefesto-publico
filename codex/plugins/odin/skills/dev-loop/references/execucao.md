# Execução do controlador no Codex

Esta referência substitui integralmente a invocação e os modelos da plataforma histórica. Leia o RUNTIME da raiz do pacote. `PLUGIN_ROOT` abaixo significa a raiz física do pacote instalado, resolvida a partir da skill; não é uma variável de ambiente suposta. `RUN_DIR` é um diretório novo de execução dentro do workspace autorizado, fora do cache do plugin. Os comandos usam caminhos absolutos concretos, com quoting de shell; os marcadores são substituídos antes de executar.

## Contrato de replay

1. Valide os gates do domínio e autorização do escopo/custo. Escreva `args.json` com os campos da seção abaixo: objeto puro, sem wrapper, `scriptPath`, `tiering`, `modeloArquiteto` ou credenciais. O bridge escolhe o controlador pelo manifesto do pacote. Ele não chama modelo, API ou conector; os efeitos reais são executados por você e pelos subagentes autorizados.
2. Execute da raiz física do workspace:

   ```sh
   node "<PLUGIN_ROOT>/runtime/bridge.mjs" iniciar "<RUN_DIR>" "<args.json>"
   ```

   O diretório pai do run precisa existir; `RUN_DIR` deve ser novo. Não escreva os args dentro de `RUN_DIR` antes de iniciar. O controlador é o arquivo byte-idêntico listado abaixo, dentro de shared; nunca o importe para substituir o protocolo com um loop de prosa.
3. Leia JSON de saída. `status: "aguardando"` traz `solicitacoes` com `id`, `papel`, `prompt`, `schema`, `modeloSolicitado`, `effort` e, quando presentes, `label`/`fase`. Execute somente solicitações realmente emitidas. Leia o contrato do papel pela tabela abaixo junto do RUNTIME; repasse prompt e schema completos, paths reais e escopo de escrita. Uma solicitação não autoriza ampliar escopo ou gastos.
4. Use ferramentas Codex disponíveis. Mecânica pode ser realizada pela sessão, preservando independência da execução dos testes e coleta de evidências. Autoria, seleção/revisão e confirmação exigem contextos independentes quando o protocolo pede: o autor nunca valida seu próprio trabalho. Use um subagente apropriado por solicitação de papel; não reutilize um autor como revisor. Revisores são somente leitura, inclusive shell; não mutam arquivos nem delegam novos trabalhos. Lentes rodam na ordem emitida; chamadas independentes podem executar em paralelo dentro do teto do domínio e da ferramenta, desde que autorizado.
5. Registre outputs/arquivos realmente observados. Capture comandos, exit codes e referências de evidência; não invente hashes, checks, leitura de imagem, status ou achados para preencher schema. Escreva `resposta.json` com envelope:

   ```json
   {"resultado": {"campos": "exatamente conforme o schema da solicitação"}}
   ```

   O exemplo ilustra o envelope, não um resultado válido para todos os papéis. Inclua `modeloEfetivo` somente se a ferramenta disponibilizou a identidade real do executor (string). Não deduza modelo da sua preferência, do nome do papel ou dos tiers legados. Ausência significa desconhecido/não informado. Falha real usa `{"erro":"causa concreta"}` em vez de resultado falso; não envie resultado e erro juntos.
6. Persista a resposta com:

   ```sh
   node "<PLUGIN_ROOT>/runtime/bridge.mjs" responder "<RUN_DIR>" "<request-id>" "<resposta.json>"
   node "<PLUGIN_ROOT>/runtime/bridge.mjs" proximo "<RUN_DIR>"
   ```

   Inspecione cada retorno e repita até `status: "concluido"`. O bridge valida schema e id pendente antes de aceitar; resposta rejeitada não vale como execução concluída. Não responda id antigo ou pertencente a outro run. Se `responder` já trouxe saída atual, use-a sem repetir trabalho. `proximo` recupera estado persistido após interrupção; não requer reiniciar o run. Antes de repetir um efeito cuja resposta não foi persistida, confira o arquivo/estado real para não sobrescrever nem gastar duas vezes.
7. `concluido` é término do controlador, não aprovação: leia `resultado.status` e trate cada desfecho abaixo. Preserve relatório e execuções reais. Não atribua aliases/fallbacks históricos a modelos Codex. Não invente API de retomada: `resumeFromRunId` pertence à invocação legada; aqui a retomada é `proximo`. Um terminal erro/escalado não se resolve apagando state.json: corrija a causa, obtenha a decisão humana exigida e confira efeitos existentes antes de um run novo. Mudança da fonte/fingerprint exige run novo, sem editar estado nem o controlador.

## Modelo, custo e disponibilidade

Leia [MODELOS.md](../../../MODELOS.md): modelo e effort herdam a sessão por padrão. Preferências explícitas usam `execucaoCodex.papeis` em args; não são identidade efetiva. Ignore modelos/efforts/fallbacks no frontmatter e no corpo dos papéis históricos. O bridge encerra qualquer envelope `erro` sem fallback e registra solicitações interrompidas para reconciliação. `resultado` negativo válido segue os gates e tetos do domínio. Os perfis `economico`, `balanceado`, `maximo` preservam rigor, lentes e lotes; não são modelos ou preços.

Sem subagentes disponíveis/autorizados, não simule revisão independente preenchendo o bridge sozinho. Se o dono optar pelo Solo já previsto no contrato deste domínio, execute a sequência Solo da seção abaixo e registre literalmente `modo: Solo; revisão independente não realizada`. Não atribua o resultado aos gates executáveis do harness, nem chame autorrevisão de independente. Revisão independente pendente e verificação humana pendente permanecem explícitas no relatório. Autorizações já dadas são reutilizadas; escolha pendente não se presume pelo silêncio.

## Controlador e contratos de papel

Controlador: [loop.mjs](../../../shared/skills/dev-loop/harness/loop.mjs).

| Papel emitido | Contrato a ler |
|---|---|
| odin:operario | [operario](../../../shared/agents/operario.md) |
| odin:arquiteto | [arquiteto](../../../shared/agents/arquiteto.md) |
| odin:revisor | [revisor](../../../shared/agents/revisor.md) |
| odin:mecanico | [mecanico](../../../shared/agents/mecanico.md) |

O planejador trabalha como arquiteto Codex; fonte com identidade/modelo fixo só fornece responsabilidades de domínio. Leia [SPEC](../../../shared/skills/dev-loop/references/spec-template.md), [ponytail](../../../shared/skills/dev-loop/references/escada-ponytail.md) e [revisão adversarial](../../../shared/skills/dev-loop/references/protocolo-revisao-adversarial.md).

## Inspeção Git somente leitura

Auditoria e lentes executam o comando emitido com
`<PLUGIN_ROOT>/shared/skills/dev-loop/scripts/inspecionar-git.mjs diff`, da raiz física do
workspace. Ele separa working tree rastreada contra HEAD, índice e novos arquivos relatados.
Resolva `declaradosNaoInspecionados` (relatados ausentes/ignorados) e confira `novosNaoIncluidos` contra a SPEC antes de declarar leitura completa; selecione paths
novos autorizados explicitamente, sem ler notas locais/segredos por conveniência. Binários
exigem inspeção própria. Falha não é diff vazio. Nunca prepare ou limpe stage durante revisão.
Commits anteriores integrantes do escopo exigem leitura separada contra a base aprovada.

## Args e pré-condições

```json
{
  "workspaceRoot": "<raiz física absoluta obtida com pwd -P>",
  "scriptsDir": "<PLUGIN_ROOT>/shared/skills/dev-loop/scripts",
  "specPath": "<arquivo aprovado de entrega ou SPEC avulsa>",
  "branch": "<branch de trabalho já criada e confirmada>",
  "perfil": "economico",
  "validacoes": ["<comando real do projeto>"],
  "hoje": "<data ISO real>"
}
```

Nunca rode na branch principal nem invente branch/comandos. `workspaceRoot` e `scriptsDir` são absolutos expandidos e correspondem ao projeto e ao pacote desta execução. specPath pode ser absoluto; se relativo, resolve contra workspaceRoot. O controlador não cria branch. Lista de validações vazia não dispensa testes da SPEC.

No portão, execute [spec-ids.mjs](../../../shared/skills/dev-loop/scripts/spec-ids.mjs) para IDs originais e [hashes-testes.mjs](../../../shared/skills/dev-loop/scripts/hashes-testes.mjs) para SHA-256 real conforme prompt/CLI dos helpers. SPEC precisa mapear critérios a testes executáveis; duplicatas, referência inexistente, unidade sem contrato/disjunção, prontidão aberta e SPEC-lite bloqueiam. Vermelho deve falhar pela razão de domínio correta e ser confirmado por execução independente; teste que nasce verde não abre implementação. Implementador não altera os testes protegidos; hash muda gera bloqueante automático, erro de coleta não prova adulteração.

Perfil: econômico, 1 lente corretude; balanceado, corretude+segurança/bordas; máximo acrescenta ponytail/arquitetura. Piso `3 + iterações × (unidades + lentes + 2)`, com consultas e confirmações extras; concorrência de operários até 4 e consultas de arquitetura serializadas, até 2 por unidade/iteração. Auditoria ponytail em todas as iterações, máximo 3. Dependência nova sem justificativa escrita no diff e escada vazia em unidade com arquivos tocados bloqueiam. Não recrie esses julgamentos fora das solicitações.

## Desfecho e Solo

- `verde`: grave relatório completo no Log de execução da entrega ou apêndice Relatório dev-loop da SPEC avulsa. Inclua bloco ponytail inteiro, critérios, testes, hashes, revisões/confirmados/refutados e execuções reais; pendenciasForaDeEscopo vão ao arquivo de pendências resolvido. Diff/auditoria são acumulados da branch, não incremento da última iteração. Retorne a entregar Step 8.
- `bloqueado`: apresente causa e ação, volte à SPEC/TDD. Fase VerificacaoManual exige evidência humana ainda pendente, nunca declaração de todos os critérios verificados.
- `escalado`: mostre histórico/consultas/diagnóstico; teto ou furo de SPEC requer decisão do dono.
- `erro`: preserve evidência da falha, sem converter revisor/confirmador ausente em zero findings.

Solo permitido pelo contrato: branch aprovada → testes vermelhos → registrar hashes → unidades sequenciais sem alterar testes → validações e hashes → autorrevisão pelas lentes do perfil e confirmação por releitura → até 3 iterações → diagnóstico ao humano. A limitação de independência precisa ser visível. Não marque esse modo como resultado verde emitido pelo bridge. Commit/push/PR são externos ao loop e exigem autorização própria.
