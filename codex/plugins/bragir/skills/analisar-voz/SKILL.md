---
name: analisar-voz
description: Use quando o usuário fornecer amostras e quiser extrair ou atualizar um perfil de voz estruturado, inclusive a partir de DOCX, Markdown ou texto.
---

# Analisar Voz

Na primeira utilização, leia `../../RUNTIME.md` e
`../../shared/skills/analisar-voz/CONTRATO.md`. O contrato preserva dimensões de análise e formato;
este entrypoint e o runtime prevalecem para paths, ferramentas e autorização.

## Fluxo nativo

1. Leia integralmente as 3 a 5 amostras, inclusive publicações acessíveis. Para `.docx`, use a skill de documentos do Codex se
   disponível; sem leitor compatível, identifique a lacuna e não alegue análise.
2. Registre título, canal, referência, data disponível, data da leitura e limites de acesso.
   Separe legenda autoral de texto compartilhado de terceiros. Rascunho assistido por IA não
   comprova sozinho a voz. Extraia padrões recorrentes por canal; registre contradições,
   ocorrências isoladas e canais não calibrados.
3. Resolva o destino `local_voz` pela regra única, a mesma que as skills de escrita leem:
   (1) `local_voz` em `## Paths do workspace` do `AGENTS.md`; (2) `local_voz` nos defaults Codex
   (`<CODEX_HOME>/hefesto/bragir/defaults.md` com `CODEX_HOME` definido e não vazio; senão
   `~/.codex/hefesto/bragir/defaults.md`), somente se o usuário já o tiver configurado; (3) perfil
   existente no workspace: `./perfil-de-voz.md`, `./voz/perfil-de-voz.md` ou o legado
   `./voice-profile.md`, com pergunta se houver mais de um; (4) sem nenhum, o default documentado
   é o perfil pessoal `<CODEX_HOME>/hefesto/bragir/perfil-de-voz.md` (com `CODEX_HOME` definido e não vazio; senão `~/.codex/hefesto/bragir/perfil-de-voz.md`), fora do pacote.
   Com `CODEX_HOME` explícito, arquivo ausente ali não autoriza fallback para `~/.codex`.
   Pedido explícito do usuário prevalece: perfil deste projeto sem arquivo existente vai para
   `./perfil-de-voz.md`, inclusive quando outra skill delega a análise exigindo esse arquivo no
   projeto; perfil padrão pessoal vai para o `local_voz` dos defaults, se já configurado, ou para
   o nível 4. Inclua 2 a 3 trechos reais curtos.
4. Anuncie o destino e de qual nível ele veio antes de gravar. Se o arquivo já existir, anuncie
   destino e nível e peça ok antes de sobrescrever, mesmo com a análise já pedida. Mostre o perfil
   antes de uma escrita ainda não autorizada. Sem escrita, entregue o conteúdo pronto e o path de
   destino.

Não ofereça registrar `local_voz` nos defaults nem edite o `defaults.md` do Bragir (`<CODEX_HOME>/hefesto/bragir/defaults.md`, ou
`~/.codex/hefesto/bragir/defaults.md` sem `CODEX_HOME` definido e não vazio): um
`local_voz` ali prevalece sobre o perfil de todo projeto sem `local_voz` no `AGENTS.md`, e o nível 4
já é lido sem esse registro. Em ambiente efêmero, como sessão de nuvem, `~/.codex` pode não
persistir: avise e ofereça gravar no workspace.

Nunca grave perfil no pacote nem no cache do plugin. O pacote não contém perfil de voz.

## Escolha entre perfis locais

Configuração explícita de `local_voz` mantém prioridade sobre a descoberta local; pedido explícito do dono prevalece. Não perguntar por concorrência em níveis inferiores quando o perfil já foi resolvido por um nível superior. Se nenhum perfil de leitura tiver sido resolvido por configuração explícita (inclusive quando ela aponta para scaffold vazio), e houver dois ou mais perfis locais preenchidos entre `./perfil-de-voz.md`, `./voz/perfil-de-voz.md` e `./voice-profile.md`, liste os caminhos e pergunte qual perfil usar; encerre o turno e aguarde. Não escolher pelo nome, ordem da lista, data ou tamanho, nem mesclar conteúdo. Um único perfil local preenchido resolve a leitura; scaffold vazio não conta como perfil de leitura.

Reaproveite a escolha na mesma sessão e no mesmo workspace, inclusive ao passar entre analisar-voz, escrever-como-autor e revisar-naturalidade, sem repetir a pergunta. Reconfira o path: se sumiu, se o workspace mudou, se há nova configuração explícita ou se o dono pediu outra voz, resolva novamente pelos dados atuais. Não grave essa preferência em defaults ou configuração sem pedido explícito. Não mescle perfis nem sobrescreva o não escolhido.

Escolher o perfil não autoriza sobrescrever seu arquivo. Em analisar-voz, continue mostrando destino e pedindo OK antes de sobrescrever. Scaffold existente continua candidato de destino para escrita: se houver múltiplos destinos e nenhuma escolha prévia que resolva, pergunte qual preencher. Uma escolha já dada de perfil resolve o destino correspondente; não substitua silenciosamente o perfil escolhido por um scaffold. A diferença entre leitura e destino de escrita não altera a prioridade da configuração explícita.

## Agendamento opcional

Ao concluir a análise, ofereça uma vez revisão mensal do perfil por material publicado novo, conforme [rotina mensal](../../shared/skills/analisar-voz/references/rotina-mensal.md). Se o dono recusar ou adiar, não insista. Só um pedido explícito seguido da aprovação da prévia concreta autoriza criar a rotina local; não criar na instalação nem alterar defaults ou instalar ferramentas. Reutilize decisões já dadas na sessão, sem presumir autorização para push/PR. Sem ferramenta local compatível, mostre passo a passo manual apoiado na documentação atual, sem declarar agendamento realizado. O teste da rotina exige autorização separada; configurar não é executar.
