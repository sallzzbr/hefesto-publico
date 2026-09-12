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

Controlador: [curso.mjs](../../../shared/skills/gerar-curso/harness/curso.mjs).

| Papel emitido | Contrato a ler |
|---|---|
| mimyr:escritor-de-capitulo | [escritor](../../../shared/agents/escritor-de-capitulo.md) |
| mimyr:mecanico-de-curso | [mecânico](../../../shared/agents/mecanico-de-curso.md) |
| mimyr:revisor-de-curso | [revisor](../../../shared/agents/revisor-de-curso.md) |

A geração usa os contratos das skills nativas escrever-capitulo e revisar-capitulo e Bragir disponível para voz. Revise os paths reais no contexto de cada escritor: ele só escreve o arquivo designado, nunca shell/template/índice/sidebar/estilo.

## Args e pré-condições

```json
{
  "workspaceRoot": "<raiz absoluta real do workspace>",
  "cursoDir": "<diretório real do curso no workspace>",
  "estruturaPath": "<cursoDir>/estrutura.md",
  "perfil": "balanceado",
  "scriptsDir": "<PLUGIN_ROOT>/shared/scripts",
  "python": "<Python absoluto do venv do workspace>",
  "hoje": "<data ISO real>"
}
```

Expanda todos os marcadores e use cwd do workspace. cursoDir/estruturaPath podem ser relativos ao cwd real, mas prefira absolutos para não perder contexto entre subagentes. Confirme templates de curso/módulo/subpágina, voz local, manifesto e perfis de personas, Bragir e Python/dependências antes de invocar; bootstrap é decisão do workspace e não efeito implícito da skill. Transcrição é dependência distinta com Whisper/ffmpeg.

Aprovação da estrutura é humana e precede prosa. `Status: aprovada` é marca literal obrigatória; cada capítulo tem arquivo único, objetivo, critérios verificáveis, fontes, tom/personas, pré-requisitos e non-goals. Arquivo existente sem `reescrever: true` autorizado bloqueia. O controlador recusa IDs vazios/repetidos, objetivo vazio, critérios vazios e destinos coincidentes antes dos escritores. Shells compartilhados são criados uma vez fora do harness.

`arquivo` é relativo ao curso. Cada escritor relata paths absolutos ou relativos ao workspace; se relatar paths relativos ao curso, deve declarar `baseArquivosTocados: "curso"` na resposta. O padrão é `"workspace"`; não se tenta outra base para fazer o relato coincidir. `workspaceRoot` permite comparar paths relativos com absolutos; sem a base necessária, a validação bloqueia. A comparação exige identidade lexical completa, sem traversal. Antes de despachar, a sessão inspeciona os paths físicos e symlinks. O controlador não tem filesystem: não detecta aliases físicos, corridas ou arquivos omitidos no relato e não constitui sandbox de escrita.

Econômico: capítulos sequenciais e lente didática; balanceado: até 4 simultâneos, didática+voz; máximo acrescenta precisão técnica. Piso de chamadas `1 + iterações × (capítulos + lentes + 1)`, confirmações extras. Máximo 3 iterações; nenhum perfil dispensa portão, checks ou independência. Check/lente/confirmador que não retorna aborta; escrita fora do próprio capítulo é bloqueante automático.

## Desfecho, pós-verde e Solo

- `verde`: execute sidebar, índice e SEO em shared/scripts, uma vez sobre o curso; correções mecânicas autorizadas, checks de links e SVG com métricas reais das fontes. Atualize seo.json/meta e og:image próprios. GA4 usa scripts do workspace, prefixo /<curso>/; não invente tools/injetar_ga4.py quando ausente. Preserve analytics.js/cookie-consent.js próprios quando a configuração exige.
- `bloqueado`: estrutura sem aprovação/critérios ou arquivo existente sem autorização; corrija com o dono antes de reiniciar.
- `escalado`: teto, fonte ausente, falha fora de capítulo ou finding sem capítulo mapeável; shells não viram escopo de escritor por conveniência.
- `erro`: infraestrutura/check/revisor indisponível; registre causa e não declare conteúdo validado.

Persista `<cursoDir>/relatorio-geracao.md`: critérios, iterações, achados confirmados/refutados por capítulo, execuções/modelo real ou não informado e lacunas de revisão. Não escreva tabelas de modelos/fallbacks históricos como se fossem execução Codex. Relate páginas criadas/reusadas e próximo passo; build/deploy/commit/push ficam fora da geração.

Solo permitido: estrutura aprovada → escrever-capitulo em sequência e só no arquivo designado → acentos/travessões em dry-run, SVG, links/placeholders → autorrevisão por didática/voz/técnica do perfil, com evidência e releitura de achados → corrigir apenas capítulos com falha, máximo 3 iterações → pós-verde e mesmo relatório, declarando ausência de revisão independente. Não relaxe pré-requisitos nem transforme uma execução Solo em aprovação pelo harness.
