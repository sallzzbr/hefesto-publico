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

Controlador: [criativo.mjs](../../../shared/skills/criativo-fluxo/harness/criativo.mjs).

| Papel emitido | Contrato a ler |
|---|---|
| hermes:diretor-de-arte | [diretor](../../../shared/agents/diretor-de-arte.md) |
| hermes:produtor-de-criativo | [produtor](../../../shared/agents/produtor-de-criativo.md) |
| hermes:mecanico-de-criativo | [mecânico](../../../shared/agents/mecanico-de-criativo.md) |
| hermes:validador-de-criativo | [validador](../../../shared/agents/validador-de-criativo.md) |

Leia também [portão de ideia](../../../shared/skills/criativo-fluxo/references/portao-de-ideia.md) e [workspace mínimo](../../../shared/skills/criativo-fluxo/references/workspace-minimo.md). Preflight é [verificar_workspace.py](../../../shared/scripts/verificar_workspace.py), somente leitura. Composição, geração e validar_criativo.py são recursos do workspace: o plugin não fornece gerador nem credenciais.

## Preflight e orçamento

Passe ao preflight os caminhos absolutos resolvidos via `--workspace`, `--marketing`, `--branding`, `--contexto`, `--scripts`, `--venv`, `--python`. Venv e Python devem apontar para o mesmo ambiente. Antes das rotas, omita capability para exigir ambas; arquétipo conhecido permite `--capability texto` ou `--capability imagem-ia`. Exit não zero/JSON inválido bloqueia; missing deve ser relatado por inteiro. Exit zero prova presença/layout, não credencial ou funcionamento de produção. Banco visual vazio não bloqueia: baselinePath:null, D vira sinalização, ancoragem degradada explícita.

Antes de iniciar rotas, exija ficha de ideia de oito campos aprovada e consolidada no brief. Sem aprovada_em não há rough, mockup ou geração. Perfil econômico/balanceado/máximo: 2/3/3 rotas e 2/3/4 candidatos. Roughs IA = 1 por rota; candidatos iniciais=N, regenerações=N−1 (mínimo 2), até 3 rodadas/iterações. Estime chamadas e orçamento, sem equivaler perfis a preços Codex. Estágio A usa 1 diretor+1 mecânico/rota; B usa portão, produtor/seleção quando gerar, composição/preflight/crítica por iteração, confirmações/correções necessárias e pacote final. Texto tem zero chamadas de imagem, sempre.

## Args do estágio A

```json
{
  "estagio": "rotas",
  "briefPath": "<brief real com ideia aprovada>",
  "python": "<Python absoluto do venv>",
  "hoje": "<data ISO real>",
  "perfil": "balanceado",
  "dirs": {
    "marketing": "<base absoluta resolvida>",
    "branding": "<base absoluta resolvida>",
    "contexto": "<base absoluta resolvida>",
    "scripts": "<scripts reais do workspace>"
  }
}
```

`dirs` completo é obrigatório nesta skill mesmo nos defaults. Os prompts mecânicos usam estes diretórios: não troque scripts do workspace por paths do plugin. Use a mesma raiz de workspace em todos os executores.

`resultado.status: aguardando-rota` é terminal do estágio A. Abra todos os roughs e apresente junto de nome/arquétipo/referência e hierarquia; rota que contradiz ideia volta ao diretor. Somente escolha explícita do humano vendo os roughs permite `rota_aprovada` e `aprovada_em` em __rotas.md. Esse é o Portão 2, distinto da ideia.

## Args do estágio B

Crie novo args.json e novo RUN_DIR com os mesmos python/hoje/perfil/dirs reais, `estagio: "produzir"` e `rotasPath: "<artefato __rotas.md aprovado>"` no lugar de briefPath. Não altere args do run A. Rota deve ter rough no disco; render existente exige `reproduzir: true` autorizado.

Preserve `{{BASE}}` no comando de overlay IA: o controlador faz a substituição pelo candidato selecionado, o mecânico não reescreve comando. Validador independente escolhe candidato e julga preflight+acabamento A–J+ideia K–Q. Qualquer bloqueante confirmado é FAIL; falha operacional de preflight/revisor/seleção/confirmação/pacote é erro, nunca verde. Correção overlay/copy não regenera imagem; texto nunca aciona IA; correção sem mudança escala.

## Desfecho, pacote e Solo

- `verde`: apresente render, roughs/candidatos, rationale de seleção, copy e não-bloqueantes. Verde não autoriza publicação; registry canônico só recebe aprovado após OK humano no pacote.
- `bloqueado`: brief/rota/aprovação/render existente sem autorização; resolva causa com o dono.
- `escalado`: teto, impossibilidade de geração/composição ou rough zero; preserve pacote/diagnóstico e aguarde decisão.
- `erro`: preserve evidência e identifique solicitação que falhou; não esconda como ausência de achado.

Reports de iteração são obrigatórios em verde/escalado quando houve iteração, incluindo _validacoes.csv. Aprendizado só vira regra com amostra/variância, variantes e contraexemplo checado, senão OBSERVAÇÃO. A saída inclui ficha/headline, rota, iterações/rodadas, veredito, pacote/render e execuções/modelo real. Upload aponta para playbook específico do objetivo no workspace; sem payloads/credenciais inventados nem publicação automática.

Solo previsto: os dois portões humanos permanecem; ideia→prancheta/rotas→roughs→escolha visual→candidatos→seleção local declarada sem independência→composição→preflight→autocrítica A–Q→releitura de plausíveis→correção por causa, máximo 3 iterações e 2 regenerações após inicial→pacote/reports. Preserve limite de gasto; a ausência de seleção/crítica independente permanece como lacuna, nunca relato falso de harness executado.
