---
name: preparar-jogo
description: "Prepare a portable game workspace. Use when pedir iniciar um jogo, preparar projeto de game, organizar agentes ou criar estrutura de GDD e memória local, sem exigir engine, Munin ou acervo compartilhado."
---

# Preparar jogo

## Input
Brief do jogo, diretório consumidor e responsáveis conhecidos. Engine, estilo, orçamento e grupo podem estar pendentes; não inventar.

## Before
Leia `${CLAUDE_PLUGIN_ROOT}/references/contrato.md` e `${CLAUDE_PLUGIN_ROOT}/references/compartilhamento.md`. Resolva local_jogo pela regra de paths do contrato. Pedir preparação autoriza criar documentação, não sobrescrever arquivos existentes. Inventariar conteúdo existente e adaptar o índice; divergência exige decisão antes de substituir. Consulta e registro de aprendizado seguem o contrato comum.

## Output
Na base resolvida, criar somente arquivos ausentes: projeto.md a partir do template, gdd/README.md, historico/indice.md, aprendizados/indice.md, producao/estado.md e agentes/ com os seis contratos de `${CLAUDE_PLUGIN_ROOT}/agents/`. Preencher objetivo e pendências conhecidos. No scaffold, criar os documentos referenciados pelo índice do GDD como rascunhos com responsável, perguntas e histórico, ou remover do mapa entradas ainda não criadas: nenhum link quebrado.

Copiar também os templates de registro, fase, incremento, briefs e playtest para modelos/ do projeto, junto das referências contrato.md, historico.md, compartilhamento.md e avaliacao.md em referencias/. Ao copiar referências, adaptar links ../templates/ para ../modelos/ e substituir menções à localização do plugin por referencias/ e agentes/ locais. Paths dos exemplos permanecem ilustrativos. O objetivo é permitir retomada sem plugin, não levar instruções de instalação.

Mesclar uma seção TitBits em AGENTS.md e CLAUDE.md existentes (ou criá-los se ausentes), apontando para projeto.md, GDD, índices e estado. Não apagar instruções de outras ferramentas. Se CLAUDE.md já importar AGENTS.md, preservar import e adicionar só a seção em AGENTS.md. Registrar local_jogo como path relativo em Paths do workspace. Não declarar acervo configurado nem grupo autorizado sem decisão humana. Dados de um jogo são tratados como privados para divulgação, mas visibilidade desconhecida bloqueia compartilhamento entre repositórios.

## Important
Documento preparado não é jogo implementado. Preservar arquivos de outra sessão; segunda execução reconcilia sem duplicar contratos ou redefinir decisões. Saída lista arquivos criados/preservados, lacunas, próxima ação e responsável. Exemplo sintético: puzzle de espelhos, engine pendente, próxima ação desenhar uma fase prototipável; sem afirmar build existente.

## Resolução de paths
Pedido explícito > local_jogo no CLAUDE.md do workspace > defaults pessoais local_* > exatamente uma convenção descoberta no cwd > default documentado docs/jogo/. Paths citados são ilustrativos. Múltiplos candidatos exigem esclarecimento. No Codex, usar AGENTS.md e defaults do RUNTIME.md. Acervo só por configuração explícita e autorização.

## Continuidade opcional
Copiar também a referência continuidade.md para referencias/ e templates prototipo.md, lancamento.md, assets.md e ux.md para modelos/, adaptando links locais. Documentação do jogo permanece suficiente sem scripts ou instalação. Consultar `${CLAUDE_PLUGIN_ROOT}/references/continuidade.md`.
Só com pedido explícito de ativação, gravar/mesclar .titbits/config.json na raiz do workspace, formato 1, enabled:true e local_jogo relativo já resolvido. Adicionar .titbits/cache/ ao .gitignore sem substituir regras existentes; não mudar hooks/permissões globais ou de outros plugins. Conferir Node 22+ e registro dos eventos no runtime; ausência fica pendente. Migração 0.1 preserva conteúdo/IDs e precisa mapear relações e conferir baseline explicitamente. Preparar documentação por si só não ativa hooks.
