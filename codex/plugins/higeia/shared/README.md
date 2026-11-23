# Higeia

Diagnóstico local de ambientes de IA, caches e simuladores. Node.js 22+; a revisão de repositórios também requer Git. A consulta ao Munin é opcional.

## Skills

| Skill | O que faz |
|---|---|
| `auditar-ambiente-ia` | Mostra a origem de skills, instalações e versões em cache e compara arquivos homônimos. |
| `revisar-residuos-ia` | Inventaria branches, worktrees, arquivos locais e possíveis resíduos de execuções. |
| `limpar-desenvolvimento` | Mede caches de desenvolvimento e simuladores anteriores no macOS em GB e percentual do volume. |

Peça “audite as skills deste projeto” ou “revise as worktrees antigas desta pasta”. Informe o diretório para ampliar a análise. A saída vai para a conversa.

O inventário considera os perfis locais, fontes de projeto e diretórios usuais de instalação. Habilitação declarada pode depender da confiança do projeto e de políticas administrativas. A idade do último commit, versões antigas no cache e histórico de uso desconhecido são sinais para investigar. A análise Git local usa as referências disponíveis no disco.

Em uma dúvida de continuidade, a consulta ao contexto de projeto ou branch do Munin recupera até três notas pertinentes. Em máquinas sem o motor ou o acervo, as duas skills continuam.

## Potencial de limpeza

Os diagnósticos incluem `espaco`. Para uma estimativa conjunta, execute `node scripts/diagnostico.mjs espaco --root "<raiz dos projetos>" --root "<pasta de worktrees>"` com o script do pacote. O modo combinado mede uma única vez os caminhos sobrepostos. Cada volume mostra a capacidade, o espaço disponível, os bytes dos candidatos condicionais e seu percentual da capacidade. Uma referência de branch sozinha ocupa espaço compartilhado pelo Git e fica fora do cálculo.

Entram como candidatos condicionais as worktrees secundárias limpas integradas à base local, as pastas apenas com marcador do Codex e uma cópia excedente de cada arquivo de skill idêntico em outra origem. Confirme o vínculo com a sessão ou o gerenciador de plugins antes de qualquer ação. O tamanho de um pacote inteiro não pode ser inferido a partir de seu SKILL.md. Outras worktrees e artefatos ambíguos ficam em `preservarBytes`. O indicador cobre os locais examinados.

Em sistemas POSIX, a medida usa blocos alocados; no Windows usa tamanho lógico identificado no relatório. A medição preserva links simbólicos e exclui do potencial arquivos com vários hard links, que podem continuar alocados por outro caminho. Clones e snapshots do APFS também podem reduzir o espaço efetivamente liberado. Falhas de leitura aparecem em `limites` e marcam a estimativa parcial.

## Desenvolvimento no macOS

O modo `desenvolvimento` mede nas pastas padrão do usuário os caches identificados de Node, Python, Gradle, Xcode, Homebrew, SwiftPM, CocoaPods e Playwright. Em `espaco --desenvolvimento`, o mesmo inventário entra uma vez no total com as raízes de Git e IA. Cada categoria tem potencial em GB decimais e percentual da capacidade do volume. Os stores compartilhados ficam identificados para investigação.

O coletor lê o registro de imagens e os dispositivos do CoreSimulator. Compara versões numéricas da mesma plataforma e mede o arquivo de imagem no disco de origem. Aparelhos desligados sem inicialização, apps ou contêineres observados entram em revisão individual, inclusive na versão mais recente. Um sinal de uso preserva os dados do aparelho e mantém a imagem dependente e seu cache dyld fora do potencial até esclarecer a necessidade de compatibilidade. A imagem mais recente e registros incertos ficam preservados. O relatório distingue as ferramentas instaladas pelo uv e os ambientes encontrados no cache compartilhado. O Android AVD e suas imagens entram como ocupação a preservar. A cobertura inclui os caminhos padrão e as imagens registradas em DMG. Veja como o Xcode gerencia a retirada de [runtimes e dispositivos](https://developer.apple.com/documentation/safari-developer-tools/adding-additional-simulators).

### Investigar ambientes Python

Use `node scripts/diagnostico.mjs uv --executavel "<nome>" --root "<projeto>"`. As raízes repetíveis indicam quais ambientes de projeto conferir. Sem filtro, o coletor investiga todos os ambientes Python sob `archive-v0`. Ele cruza os links dos índices do uv, as instalações da ferramenta, executáveis do usuário, as pastas `.venv` indicadas, o ambiente ativo e uma amostra dos arquivos abertos visíveis ao usuário no macOS. Mostra composição, referências, motivos e GB por classe. A análise mantém fontes diretas e itens adicionais na raiz para revisão individual. A medição expressa uma hipótese de recriação, sujeita à disponibilidade das dependências e à preservação do estado do consumidor. O coletor só lê arquivos e metadados.

Para executar as provas de Claude-Mem, rode `python3 -B scripts/verificar-claude-mem.py` e forneça o JSON do modo uv a `python3 -B scripts/provar-ambientes-uv.py` pela entrada padrão. Para preparar uma lista exata de aparelhos e imagens, rode `node scripts/plano-ios.mjs "<modelo a manter>" "<versão do iOS>"`. Os três comandos produzem evidência em leitura. A skill descreve como verificar o consumidor e medir o ganho após uma retirada autorizada.
