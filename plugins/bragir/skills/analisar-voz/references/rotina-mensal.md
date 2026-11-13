# Rotina mensal de atualização da voz

## Oferta e consentimento

Ao terminar a análise de voz, ofereça uma vez: "Quer agendar uma revisão mensal do perfil com base nos novos posts publicados?" Encerre o turno ao perguntar. Se recusar ou adiar, conclua sem criar nada e não insista. Aceitar ouvir a proposta não autoriza criar rotina, push ou PR. Nunca criar, habilitar ou configurar rotina na instalação do plugin.

Após pedido explícito, descubra sem escrita os checkouts e a ferramenta LOCAL disponível. Consulte configuração e contexto antes de perguntar o que falta, uma decisão por vez. Não instale app, plugin, pacote ou ferramenta; não edite crontab, launchd, arquivos internos do agendador ou configurações pessoais para contornar falta de ferramenta. Não substitua por tarefa em nuvem: a execução depende dos checkouts locais.

Prepare uma prévia concreta: nome, máquina/projeto local, frequência, dia, hora, fuso, caminhos resolvidos, prompt completo, acesso ao método e autorização para commit/push/PR e comentários apenas desta tarefa. Explicitar sandbox, modo de aprovação e acesso de rede/Git/tmp necessários à execução sem supervisão. Não selecionar acesso total, desativar sandbox ou dispensar aprovações sem OK específico; se o ambiente exigiria interação impossível na rotina, explicar o bloqueio antes de ativar. Proponha mensalmente no dia 2 às 14h23, America/Sao_Paulo, se o dono não definiu agenda; a proposta não é agendamento. Computador ligado e app aberto são requisitos quando o executor local depender deles; confira e informe a condição real da ferramenta. Verifique fuso e confirme a próxima ocorrência apresentada pelo agendador; se não conseguir representar o fuso/recorrência pedidos, pare na proposta e explique, sem converter silenciosamente.

Só após aprovação dessa prévia crie ou atualize pela ferramenta nativa local realmente disponível. Inspecione seu schema atual; não invente comando de CLI ou API nem escolha modelo/effort diferente sem pedido. Esta rotina usa sessão nova a cada execução, sem contexto anterior: confirme esse modo standalone na prévia. Se a ferramenta exigir modelo/effort, use valores explicitamente escolhidos ou a configuração real da sessão, nunca um alias inventado. Antes de criar, consulte rotinas equivalentes acessíveis; não duplique uma existente, e uma rotina pausada só é reativada com pedido. Após escrever, releia e confira agenda, fuso, estado, prompt e projeto. Retorne identificador e como editar/pausar; configuração não comprova execução.

Sem ferramenta local compatível, forneça passo a passo manual: (1) abrir o agendador local do app escolhido, consultando sua documentação oficial atual para os controles reais; (2) selecionar o projeto local correto; (3) colar o prompt parametrizado abaixo; (4) preencher e conferir dia/hora/fuso e próxima ocorrência; (5) revisar permissões e ativar somente por decisão do dono. Não invente telas ou declarar que foi configurado. Teste manual exige autorização separada e deve conferir ferramentas de push/PR; não disparar automaticamente ao configurar.

## Parâmetros da prévia

Na preparação, resolver paths por pedido explícito > `local_*` no `CLAUDE.md` do workspace (no Codex, `AGENTS.md`) > defaults `local_*` do usuário > convenção descoberta no cwd > default documentado. Paths literais abaixo são ilustrativos. Exatamente um candidato é usado; mais de um exige perguntar. Esta descoberta pertence à configuração interativa, não à execução agendada, que recebe paths já fixados e não lê defaults pessoais. Perfil resolvido fora do repositório de voz não serve como destino desta rotina de PR: explicar o limite e aguardar escolha explícita de destino versionado, sem copiar ou mover perfil pessoal automaticamente.

- `<repositorio-voz>`: remoto confirmado do projeto consumidor, nunca o repositório do plugin presumido.
- `<checkout-voz>` e `<checkout-metodo>`: checkouts locais reais, somente no prompt configurado; não versionar caminhos absolutos nesta referência. O segundo contém a fonte do método Bragir.
- `<branch-base-voz>` e `<branch-metodo>`: branches remotas conferidas, sem presumir main/master; não criar nem alterar branches do dono.
- `<perfil-local>`, `<posts-publicados>`, `<analises-metricas>` e `<diretriz-escrita>`: paths relativos resolvidos no repositório de voz; exemplos de convenção são `voz/perfil-de-voz.md`, `posts/publicados`, `metricas/analises` e uma diretriz de escrita do projeto. Se houver ambiguidade, perguntar. Diretriz ausente deve ser declarada na prévia e omitida dos pathspecs, nunca tratada como path literal.
- `<autorizacao-registrada>`: escopo e referência à aprovação real da prévia, nunca autorização herdada deste template.

Substituir todos os marcadores de configuração antes de agendar. Não interpretar paths do usuário como código de shell: passar argumentos estruturados ou aplicar quoting correto. `<sha>`, `<sha-voz-base>`, `<branch do PR>`, `<data de corte>` e `AAAA-MM` no procedimento abaixo são valores calculados na execução. Manter os defaults pessoais fora da rotina. O prompt registra só os parâmetros necessários; não copiar tokens, configurações privadas ou dados pessoais desnecessários.

## Prompt da tarefa

```text
Tarefa mensal: proposta de atualização do perfil de voz canônico no repositório <repositorio-voz>.

Você roda numa sessão nova, sem contexto anterior. Autorização registrada pelo dono: <autorizacao-registrada>. Ela deve cobrir esta agenda, os repositórios e a criação/atualização de proposta com commit, push, PR e comentário de atualização. Se ausente ou fora desse escopo, pare e relate, sem inventar autorização. A tarefa nunca faz merge.

Regras:
- Não faça merge, force-push nem edite tags. Não mexa em nada fora do worktree temporário, da branch remota e do PR desta tarefa.
- Escreva em português, sem travessão (o caractere "—") no texto que você escreve.
- Não peça nem aceite token. Se faltar acesso, pare e relate o bloqueio.

1. Acesso. O checkout do repositório de voz está em <checkout-voz> e o do método em <checkout-metodo>. Os dois são do dono: não mude branch, índice nem arquivo de nenhum deles, e use git --no-optional-locks em todo comando neles.
   - Confira a ferramenta de PR (gh autenticado com acesso a <repositorio-voz>, ou conector GitHub da sessão). Sem ela, pare e relate antes de qualquer escrita.
   - No repositório de voz, rode git fetch origin e fixe <sha-voz-base> = git rev-parse origin/<branch-base-voz>. Se git rev-parse --is-shallow-repository responder true, pare e relate; não faça unshallow no checkout do dono.
   - Se git status --porcelain -- <perfil-local> <posts-publicados> <analises-metricas> <diretriz-escrita> ou git log --oneline origin/<branch-base-voz>..<branch-base-voz> -- <perfil-local> <posts-publicados> <analises-metricas> <diretriz-escrita> mostrar algo, pare e relate: há material do dono ainda não enviado. Mudança em outros caminhos não bloqueia.
   - Crie o worktree da tarefa destacado e fora dos dois checkouts: git worktree add --detach "$(mktemp -d)/bragir" origin/<branch-base-voz>. Não crie branch local no checkout do dono. No worktree, confira a credencial de push com git push --dry-run origin HEAD:refs/heads/voz/teste-acesso; sem ela, pare e relate.
   - No checkout do método, a única escrita permitida é git fetch origin <branch-metodo>. Anote <sha> = git rev-parse origin/<branch-metodo> e leia arquivos só com git show <sha>:<caminho>. Não use checkout, switch, pull, stash, reset ou worktree no checkout do método, nem leia a árvore de trabalho dele, que pode estar em outra branch.

2. Contrato. No worktree do repositório de voz, leia AGENTS.md e CLAUDE.md quando existirem, respeitando o runtime da sessão, e <diretriz-escrita>, que guarda correções do dono. Se a diretriz tiver sido declarada ausente na configuração, registre o limite e não invente correções. No checkout do método, leia git show <sha>:plugins/bragir/skills/analisar-voz/SKILL.md.
   Do método valem:
   - as dimensões de análise;
   - a separação por canal, com canal não amostrado marcado como não calibrado;
   - fontes e limites;
   - trechos literais curtos com procedência;
   - nenhum exemplo fabricado;
   - o aviso de que material assistido por IA não comprova voz sozinho.
   Não valem a escolha de amostras pelo usuário nem o pedido de ok antes de sobrescrever: o PR é o pedido de ok. Não leia ~/.claude/bragir/ nem ~/.codex/hefesto/bragir/ (perfis pessoais e defaults) e não grave nada fora do worktree temporário do repositório de voz.

3. PR anterior. Liste os PRs do repositório de voz, abertos e fechados, cuja branch começa com voz/atualizacao- ou cujo título começa com "voz: atualização mensal do perfil".
   a. Um PR aberto: no worktree da tarefa, rode git checkout --detach origin/<branch do PR>. Leia os commits e os comentários de revisão desde a abertura; edições e pedidos do dono são correções. Os passos 4 a 8 usam o perfil e as correções dessa branch; os posts e análises vêm de <sha-voz-base>, não do HEAD do PR. Se houver mudança, acrescente um commit e comente o que mudou. Se não houver, não comente; só registre no resultado.
   b. Mais de um PR aberto: não abra outro; pare e relate.
   c. Nenhum aberto, e o mais recente fechado sem merge: não reproponha o que ele propunha. Só conta material que não estava listado nele. Sem esse material, termine com "PR <link> fechado sem merge; nada novo desde então".

4. Data de corte e registro. O perfil tem frontmatter YAML com atualizado_em: AAAA-MM-DD e material_incorporado (lista de post_id e caminhos de análise). Sem o campo atualizado_em, use git log -1 --format=%cs -- <perfil-local>. Sem o arquivo, não há data de corte.

5. Material novo. Leia posts e análises do snapshot <sha-voz-base> atualizado no passo 1, inclusive quando houver PR aberto. Liste caminhos com git ls-tree e leia conteúdos com git show nesse SHA; use git log <sha-voz-base> para datas de commit. Não faça merge da base no PR nem leia material do checkout do dono.
   - Posts: arquivos .md de <posts-publicados>/ com status: publicado e data_publicacao maior ou igual à data de corte.
   - Análises: arquivos .md de <analises-metricas>/ cujo último commit (git log <sha-voz-base> -1 --format=%cs -- <arquivo>) é maior ou igual à data de corte. Nunca use a data de modificação do sistema de arquivos.
   - Ignore README.md, .gitkeep, arquivos que começam com "_" e tudo que já estiver em material_incorporado.
   - Sem data de corte, conta todo arquivo que passe nesses filtros.
   Autoria: posts publicados costumam nascer de rascunhos de escrever-como-autor. Conta como evidência de voz só o que o dono escreveu ou editou; quando der, compare no git o rascunho com a versão publicada. Sem essa distinção, o achado vira nota para o dono, não mudança no perfil. Análises de métricas alimentam só a seção "Aprendizados das métricas".

6. Sem perfil. Se <perfil-local> não existe e não há material novo, não crie branch nem PR; termine com "sem perfil local e sem material novo; forneça amostras para analisar-voz". Se há material novo, a proposta cria um perfil novo apenas a partir das amostras do dono, pelo método analisar-voz, com:
   - frontmatter (atualizado_em, material_incorporado e origem com o SHA do método);
   - nota de origem com fontes e limites;
   - as mudanças apoiadas no material.
   Nos pontos para o dono decidir, o PR avisa que o merge disponibiliza o perfil local para as skills de escrita.

7. Nada novo. Se o perfil existe e não há material novo, não crie branch nem PR; termine com "nada novo desde <data de corte>". Se houve material mas nenhuma mudança ou nota resultou dele, também não abra PR; termine listando o material lido e dizendo que não houve proposta.

8. Proposta. Faça mudanças mínimas e rastreáveis: cada uma cita o post_id ou o caminho da análise que a sustenta.
   Correção do dono é:
   - todo trecho do perfil vindo de commit que não seja desta tarefa;
   - toda edição do dono na branch do PR;
   - toda correção registrada na diretriz de escrita.
   Não remova nem reescreva correção; o que a contradiz vira nota. Não apague a seção "Aprendizados das métricas" sem evidência. A regra "sem travessão" vale para o texto que você escreve; trechos copiados ou citados ficam literais. Acrescente a material_incorporado os itens usados e atualize atualizado_em para hoje.

9. Entrega:
   - Sem PR aberto: se git ls-remote --heads origin voz/atualizacao-AAAA-MM devolver algo, pare e relate; não reutilize nem force. Se não devolver, faça o commit no worktree e rode git push origin HEAD:refs/heads/voz/atualizacao-AAAA-MM.
   - Com PR aberto: faça o commit no worktree e rode git push origin HEAD:refs/heads/<branch do PR>, sem force. Se o push for recusado, pare e relate.
   - Commit com mensagem "docs(voz): ..." explicando o porquê.
   - Só sem PR aberto: abra PR para <branch-base-voz> com o título "voz: atualização mensal do perfil (AAAA-MM)".
   - Corpo do PR: material lido (lista de arquivos, SHA do método e SHA da base de voz), mudanças com a evidência de cada uma e pontos para o dono decidir.
   - Nunca faça merge. No fim, rode git -C <checkout-voz> worktree remove <caminho do worktree>. Se a execução parar antes, informe o caminho que ficou.

10. Resultado. Responda com o link do PR (ou a frase de término do passo que encerrou a execução), a branch, o SHA do commit, a lista de arquivos lidos e qualquer bloqueio encontrado.
```
