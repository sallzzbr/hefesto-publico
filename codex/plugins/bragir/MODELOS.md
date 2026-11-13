# Política de modelos no Codex

Esta é a política nativa dos seis plugins. Leia-a junto de RUNTIME.md antes de despachar agentes. Ela substitui instruções de modelos, effort e fallback das fontes históricas em `shared/`, tanto no frontmatter quanto nas seções do corpo. Preserve responsabilidades, gates, limites e independência dos papéis.

## Padrão: herdar a sessão

Sem escolha explícita do usuário, herde o modelo e o esforço de raciocínio da sessão. Omita os overrides no despacho. Não escolha outro modelo por chamar um papel de mecânico, escritor ou revisor. Uma configuração de agente local que imponha outro modelo também é um override e precisa respeitar a escolha do usuário.

O Codex permite herança e configuração explícita por agente; a combinação realmente disponível depende do host e do modelo. Consulte a ferramenta/configuração efetiva antes de usar um override. [Documentação de subagentes](https://learn.chatgpt.com/docs/agent-configuration/subagents).

| Responsabilidade | Padrão deste pacote | Exemplos OpenAI para escolha explícita, se disponíveis |
|---|---|---|
| Executar scripts, coletar saídas e hashes | Modelo e effort da sessão | `gpt-5.6-luna`, `gpt-5.6-terra` |
| Escrever, implementar, planejar ou dirigir | Modelo e effort da sessão | `gpt-5.6-terra`, `gpt-6-astra` |
| Revisar e confirmar em contexto independente | Modelo e effort da sessão | `gpt-6-astra` |

Os nomes são exemplos de configuração observados no host de teste em 2026-09-08. Não constituem catálogo de disponibilidade, recomendação automática, equivalência com modelos de outro fornecedor ou garantia de custo/qualidade. A avaliação desta adaptação usa herança; não comparou esses modelos. Perfis econômico, balanceado e máximo alteram lotes e rigor do domínio, não o modelo.

## Preferência explícita por papel no bridge

Opcionais em `args.json`, além dos argumentos de domínio:

```json
{
  "execucaoCodex": {
    "papeis": {
      "odin:mecanico": { "modelo": "gpt-5.6-luna", "effort": "medium" }
    }
  }
}
```

Inclua apenas papéis existentes em `shared/agents/` deste pacote, com o prefixo do plugin. Para Mimyr e Hermes, use os nomes da tabela de papéis da referência de execução nativa. Cada papel aceita somente `modelo` e `effort`; campos omitidos herdam a sessão. `papeis: {}` mantém toda a herança. Não transporte `tiering`, `modeloArquiteto` nem mapas de fallback históricos.

O bridge valida estrutura, papel existente, formato de identificador OpenAI (`gpt-*` ou `o` seguido de número) e valores de effort (`none`, `minimal`, `low`, `medium`, `high`, `xhigh`, `max`, `ultra`). Isso não prova que um identificador existe, que a conta tem acesso ou que o modelo suporta o effort. Esses formatos delimitam a configuração desta versão; novos formatos exigem atualização explícita.

Cada solicitação inclui `modeloSolicitado` e `effort`, ambos `null` quando herdados. São preferências a aplicar no executor, não mecanismos de execução: o bridge não inicia sessões. Verifique suporte e autorização antes do despacho. Se não puder atender uma preferência explícita, registre `{"erro":"causa observada"}` e encerre esse run; não substitua silenciosamente o modelo ou reduza o esforço. A alternativa depende de nova decisão do usuário. Não instale modelos, CLI ou conectores para contornar a ausência.

## Identidade e revisão

`modeloEfetivo` só vem da identidade disponibilizada pelo executor. Preferência, nome de papel e frontmatter não são prova. Omita o campo quando desconhecido; o relatório registrará `não informado pelo executor`. O bridge preserva a preferência separada da identidade informada e não atesta a veracidade do envelope.

Revisão independente exige outro contexto e acesso às evidências. Pode usar o mesmo modelo da autoria; trocar apenas o nome do papel no contexto do autor não cria independência. Sem contexto separado, registre pendência. Um revisor externo de outro fornecedor é integração opcional, fora deste adaptador; não presuma CLI, credenciais, suporte ou execução dessa integração.

## Falha operacional e retomada

Um envelope `erro` encerra o run Codex com `status: concluido` e `resultado.status: erro`. Isso vale para toda falha operacional, inclusive acesso, execução interrompida e resposta incerta; nenhum fallback histórico é tentado. O relatório preserva `falhasOperacionais`, execuções conhecidas e `solicitacoesInterrompidas`. Respostas já persistidas continuam em `state.json`.

Uma solicitação interrompida pode já ter produzido efeito fora do bridge. Não a classifique como cancelada, não executada ou revertida sem verificar. Preserve as respostas que chegarem depois do encerramento como evidência externa; não as injete no run terminal. Reconcilie todos os ramos e artefatos antes de iniciar outro run. O bridge não desfaz efeitos nem oferece rollback.

Um `resultado` válido com achados ou `ok: false` continua pelo contrato de domínio: pode bloquear, corrigir ou escalar conforme o caso e seus tetos. Erro de script no preflight Hermes é falha operacional de domínio, mesmo quando vem dentro de `resultado`; preserva o preflight e encerra sem crítica ou recomposição.

Atualização dos arquivos do runtime/shared muda o fingerprint. Runs de versões anteriores são preservados e recusados pela nova fonte. Termine com a fonte original quando apropriado ou reconcilie os efeitos e abra outro run; nunca edite o fingerprint para forçar retomada.
