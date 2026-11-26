# Higeia

Diagnóstico local de ambientes de IA, caches e simuladores. Node.js 22+; a revisão de repositórios também requer Git. A consulta ao Munin é opcional.

## Skills

| Skill | O que faz |
|---|---|
| `auditar-ambiente-ia` | Mostra a origem de skills, instalações e versões em cache e compara arquivos homônimos. |
| `revisar-residuos-ia` | Revisa resíduos de IA e arquiva worktrees inativas com prova de merge ou de cópia remota. |
| `limpar-computador` | Mede o espaço no Mac e limpa caches de Chrome, Claude e Slack com prévia e medição após reabertura. |
| `limpar-desenvolvimento` | Mede caches e simuladores no macOS e limpa módulos recompiláveis do Clang com verificação do ganho real. |

Peça “audite as skills deste projeto” ou “revise as worktrees antigas desta pasta”. Informe o diretório para ampliar a análise. A saída vai para a conversa.

O inventário considera os perfis locais, fontes de projeto e diretórios usuais de instalação. Habilitação declarada pode depender da confiança do projeto e de políticas administrativas. A idade do último commit, versões antigas no cache e histórico de uso desconhecido são sinais para investigar. A análise Git local usa as referências disponíveis no disco.

Para investigar um rascunho que sobrou no Codex, peça “confira se o Stop do Higeia está habilitado e com confiança neste projeto”. A auditoria usa `diagnostico.mjs ambiente --hooks-codex --root "<projeto>"` e mostra o estado de cada evento segundo o Codex CLI. Para confirmar que o hook executou, confira o resultado de uma sessão de teste. Sem o CLI ou sem suporte à consulta, o inventário de arquivos continua disponível.

Em uma dúvida de continuidade, a consulta ao contexto de projeto ou branch do Munin recupera até três notas pertinentes. Em máquinas sem o motor ou o acervo, as duas skills continuam.

## Conferir uma execução

Peça “confira se este workflow terminou, onde ficou a entrega e como retomar”. Informe a pasta do run Codex ou o registro do Claude se estiver fora das pastas examinadas no projeto. O relatório mostra o estado que o executor registrou, o desfecho do controlador e os arquivos que ele identificou. Uma execução encerrada pode ter terminado com bloqueio. Entregas e checkpoints ficam preservados.

## Arquivar uma worktree

Peça “confira se a worktree desta branch já foi integrada e prepare o arquivamento”. Informe a base e o remoto quando houver mais de uma opção. A prévia consulta o servidor e mostra o commit, a ação e o identificador do plano. A aplicação exige uma worktree limpa e evidência de que a sessão encerrou. Para branches com pelo menos 14 dias sem atividade Git e sem merge comprovado, o Higeia envia os commits se necessário e confere a ponta da branch no destino. A branch local continua disponível. Para recriar o checkout, use `git worktree add <nova-pasta> <branch>`.

## Potencial de limpeza

Os diagnósticos incluem `espaco`. Para uma estimativa conjunta, execute `node scripts/diagnostico.mjs espaco --root "<raiz dos projetos>" --root "<pasta de worktrees>"` com o script do pacote. O modo combinado mede uma única vez os caminhos sobrepostos. Cada volume mostra a capacidade, o espaço disponível, os bytes dos candidatos condicionais e seu percentual da capacidade. Uma referência de branch sozinha ocupa espaço compartilhado pelo Git e fica fora do cálculo.

Entram como candidatos condicionais as worktrees secundárias limpas integradas à base local, as pastas apenas com marcador do Codex e uma cópia excedente de cada arquivo de skill idêntico em outra origem. Confirme o vínculo com a sessão ou o gerenciador de plugins antes de qualquer ação. O tamanho de um pacote inteiro não pode ser inferido a partir de seu SKILL.md. Outras worktrees e artefatos ambíguos ficam em `preservarBytes`. O indicador cobre os locais examinados.

Em sistemas POSIX, a medida usa blocos alocados; no Windows usa tamanho lógico identificado no relatório. A medição preserva links simbólicos e exclui do potencial arquivos com vários hard links, que podem continuar alocados por outro caminho. Clones e snapshots do APFS também podem reduzir o espaço efetivamente liberado. Falhas de leitura aparecem em `limites` e marcam a estimativa parcial.

## Instaladores em Downloads

Peça “guarde este instalador de Downloads em quarentena” ou “restaure meu instalador”. A skill limpar-computador aceita arquivos regulares .pkg, .mpkg e .dmg no macOS. A quarentena ocupa o mesmo volume e permite recuperar o arquivo.

## Desenvolvimento no macOS

O modo `desenvolvimento` mede nas pastas padrão do usuário os caches identificados de Node, Python, Gradle, Xcode, Homebrew, SwiftPM, CocoaPods e Playwright. Em `espaco --desenvolvimento`, o mesmo inventário entra uma vez no total com as raízes de Git e IA. Cada categoria tem potencial em GB decimais e percentual da capacidade do volume. Os stores compartilhados ficam identificados para investigação.

O coletor lê o registro de imagens e os dispositivos do CoreSimulator. Compara versões numéricas da mesma plataforma e mede o arquivo de imagem no disco de origem. Aparelhos desligados sem inicialização, apps ou contêineres observados entram em revisão individual, inclusive na versão mais recente. Um sinal de uso preserva os dados do aparelho e mantém a imagem dependente e seu cache dyld fora do potencial até esclarecer a necessidade de compatibilidade. A imagem mais recente e registros incertos ficam preservados. O relatório distingue as ferramentas instaladas pelo uv e os ambientes encontrados no cache compartilhado. O Android AVD e suas imagens entram como ocupação a preservar. A cobertura inclui os caminhos padrão e as imagens registradas em DMG. Veja como o Xcode gerencia a retirada de [runtimes e dispositivos](https://developer.apple.com/documentation/safari-developer-tools/adding-additional-simulators).

### Limpar módulos do Clang

Peça “mostre a prévia do cache recriável do Xcode, limpe e confira quanto voltou ao disco”. A skill mede o subconjunto recompilável de ModuleCache.noindex, verifica o uso e reconstrói Foundation antes de expurgar os originais. Uma segunda compilação verifica a ferramenta. O relatório traz a redução da pasta, a variação líquida do espaço livre em GB e o percentual da capacidade do volume. Requer macOS, Xcode e Python 3.8+.

### Investigar ambientes Python

Use `node scripts/diagnostico.mjs uv --executavel "<nome>" --root "<projeto>"`. As raízes repetíveis indicam quais ambientes de projeto conferir. Sem filtro, o coletor investiga todos os ambientes Python sob `archive-v0`. Ele cruza os links dos índices do uv, as instalações da ferramenta, executáveis do usuário, as pastas `.venv` indicadas, o ambiente ativo e uma amostra dos arquivos abertos visíveis ao usuário no macOS. Mostra composição, referências, motivos e GB por classe. A análise mantém fontes diretas e itens adicionais na raiz para revisão individual. A medição expressa uma hipótese de recriação, sujeita à disponibilidade das dependências e à preservação do estado do consumidor. O coletor só lê arquivos e metadados.

Para executar as provas de Claude-Mem, rode `python3 -B scripts/verificar-claude-mem.py` e forneça o JSON do modo uv a `python3 -B scripts/provar-ambientes-uv.py` pela entrada padrão. Para preparar uma lista exata de aparelhos e imagens, rode `node scripts/plano-ios.mjs "<modelo a manter>" "<versão do iOS>"`. Os três comandos produzem evidência em leitura. A skill descreve como verificar o consumidor e medir o ganho após uma retirada autorizada.

## Rascunhos por sessão

No macOS e Linux, Codex e Claude Code recebem uma instrução em `SessionStart` para criar cada arquivo descartável com o comando `novo` fornecido pelo hook. Ele cria um arquivo vazio numa pasta privada do usuário e registra um segundo link para o mesmo arquivo. O próximo `Stop` normal recolhe esse rascunho se a identidade conferir. Uma sessão que apenas faz diagnósticos dispensa a criação de reservas. São necessários Node.js 22+, Python 3.8+ e suporte a hard links no volume temporário.

- **Entrega** — grave o resultado no projeto ou mova o rascunho para o destino final antes de concluir. Se a resposta apontar para uma reserva ou para a pasta da sessão, o hook retém o arquivo e pede ao agente que confira o destino e atualize o link.
- **Trabalho entre turnos ou em segundo plano** — aplique `reter CAMINHO` antes de iniciar e `liberar CAMINHO` quando terminar. O Claude pode informar trabalho em segundo plano no evento de parada. Nesse caso a coleta aguarda outro turno.
- **Interrupção** — o inventário reaparece na retomada da mesma sessão, enquanto o sistema mantiver a pasta temporária. Use `listar` para conferi-lo. Um arquivo substituído por uma gravação atômica fica para revisão.
- **Cobertura** — a limpeza alcança arquivos criados pelo reservador. Pastas de build, arquivos anteriores e temporários de outras ferramentas ficam fora da coleta. Os diagnósticos continuam disponíveis no Windows.

Abra uma nova sessão após instalar ou atualizar o plugin. No Codex, confira a habilitação e a confiança dos dois hooks em `/hooks`. No Claude Code, use `/hooks` para conferir a origem. O modo de diagnóstico não requer executar nenhum comando do reservador.
