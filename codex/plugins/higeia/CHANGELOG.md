# Changelog

## 0.13.0 — 2026-11-26

- Mostra tamanho ocupado e ação por item na revisão das categorias pessoais do macOS. Preserva arquivos parciais ou de controle conhecidos e os nomes finais associados em Downloads.
- Guarda e restaura arquivos selecionados de Downloads, Mesa, Documentos e Filmes no mesmo volume, sem sobrescrever destinos. Mostra a ocupação da quarentena e mantém a recuperação de instaladores.

## 0.12.0 — 2026-11-25

- Em falhas de validação do Hermes e do Mimyr, distingue uma chamada interrompida de uma resposta já salva. Reconhece registros antigos e orienta repetir a validação dos arquivos existentes quando o replay repetiria o resultado.

- A revisão de resíduos identifica o estado de workflows pelo registro Claude ou pelo controlador Codex de origem. Confere a origem antes de associar arquivos e identifica material para revisão. No Claude, cruza o pedido de reinvocação com o histórico das chamadas e indica quais etapas um replay poderia repetir. No Codex, mostra os pedidos pendentes e a incerteza sobre a atividade da sessão.

## 0.11.0 — 2026-11-25

- Permite guardar um instalador selecionado de Downloads em quarentena e restaurá-lo ao nome original ou a outro nome escolhido. O diagnóstico mostra o espaço ocupado na quarentena.

## 0.10.1 — 2026-11-23

- A prévia de caches continua quando a leitura de um app é negada. O relatório identifica os apps medidos e calcula o subtotal em GB e percentual do volume.
- Ao encontrar acesso negado, a skill mostra onde conferir a permissão do app no macOS e como testar a leitura depois.

## 0.10.0 — 2026-11-23

- A skill `limpar-computador` mede em leitura os caches recriáveis e separa downloads, Lixeira, arquivos grandes e relatórios antigos para decisão. A prévia traz GB, percentual do volume e limites de acesso.
- Com autorização, o Higeia limpa caches de Chrome, Claude Desktop e Slack. Mede a redução após reabrir cada app e apresenta a variação de espaço livre do volume.

## 0.9.0 — 2026-11-23

- A limpeza de desenvolvimento estreia com módulos recompiláveis do Clang no macOS. A prévia seleciona arquivos pelo formato e pela identidade. A aplicação isola o lote, reconstrói Foundation pelo Xcode e mede o espaço disponível depois de verificar o compilador.

## 0.8.0 — 2026-11-23

- A auditoria consulta o Codex CLI para mostrar a habilitação e a confiança dos hooks SessionStart e Stop do Higeia por projeto. Falha na consulta preserva o restante do inventário.

## 0.7.0 — 2026-11-23

- Arquiva uma worktree secundária inativa após verificar o merge na base remota ou, para branches antigas, a cópia exata do commit no destino do push. A prévia identifica o checkout e a aplicação reconfere os arquivos locais antes da remoção.

## 0.6.0 — 2026-11-23

- Os hooks de sessão reservam e recolhem rascunhos individuais no macOS e Linux. Arquivos retidos ficam disponíveis na retomada e entregas movidas para o projeto são preservadas.

## 0.5.0 — 2026-11-23

- Confere a busca semântica do Claude-Mem, testa o erro de cada ambiente Chroma do uv e gera o plano de simuladores por modelo, versão e identificador.

## 0.4.0 — 2026-11-22

- Investiga ambientes arquivados pelo uv em leitura com evidência de vínculos, arquivos abertos e composição. A skill avalia o fluxo real de teste ao propor quais simuladores manter.

## 0.3.1 — 2026-11-22

- Refina a triagem de simuladores pelo histórico de inicialização, apps e contêineres observados. Distingue ferramentas instaladas com uv de ambientes encontrados no cache.

## 0.3.0 — 2026-11-22

- Nova skill `limpar-desenvolvimento` para medir caches e versões anteriores de simuladores no macOS. Mostra por categoria os GB e o percentual do volume, com revisão separada dos dados dos dispositivos.

## 0.2.0 — 2026-11-22

- Mede o potencial condicional em bytes e em percentual da capacidade de cada volume. O modo `espaco` consolida diagnósticos e raízes sobrepostas.

## 0.1.0

- Diagnóstico em leitura de skills e plugins, branches, worktrees e diretórios de execução. Contexto do Munin opcional por projeto e branch.
