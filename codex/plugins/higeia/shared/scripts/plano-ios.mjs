import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const prefixo = 'com.apple.CoreSimulator.SimRuntime.iOS-';
const uuid = /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i;

export function planoIos(dispositivos, imagens, tipos, modelo, versao) {
  if (!modelo || !/^\d+\.\d+(?:\.\d+)?$/.test(versao)) throw Error('Informe modelo e versão exatos.');
  const destino = prefixo + versao.replaceAll('.', '-');
  const tiposDoModelo = tipos.filter(t => t.name === modelo);
  if (tiposDoModelo.length !== 1 || !tiposDoModelo[0].identifier) throw Error('Tipo de aparelho desconhecido ou ambíguo.');
  const ios = Object.entries(dispositivos).filter(([runtime]) => runtime.startsWith(prefixo))
    .flatMap(([runtime, aparelhos]) => aparelhos.map(({ udid, name, state, isAvailable, deviceTypeIdentifier }) => ({ udid, name, state, isAvailable, deviceTypeIdentifier, runtime })));
  const candidatas = ios.filter(a => a.runtime === destino && a.deviceTypeIdentifier === tiposDoModelo[0].identifier && a.isAvailable);
  if (candidatas.length !== 1) throw Error('O aparelho solicitado está ausente ou é ambíguo.');
  const manter = candidatas[0];
  const remover = ios.filter(a => a !== manter);
  if (ios.some(a => !uuid.test(a.udid)) || new Set(ios.map(a => a.udid)).size !== ios.length
      || remover.some(a => a.state !== 'Shutdown')) throw Error('Identidade ou estado dos aparelhos requer revisão.');
  const imagensIos = Object.values(imagens).filter(i => i.platformIdentifier === 'com.apple.platform.iphonesimulator');
  if (imagensIos.filter(i => i.runtimeIdentifier === destino && i.state === 'Ready').length !== 1
      || imagensIos.some(i => !uuid.test(i.identifier) || !i.runtimeIdentifier?.startsWith(prefixo))
      || new Set(imagensIos.map(i => i.identifier)).size !== imagensIos.length) throw Error('Registro de imagens ambíguo ou incompleto.');
  const removerImagens = imagensIos.filter(i => i.runtimeIdentifier !== destino);
  if (removerImagens.some(i => !i.deletable || i.state !== 'Ready')) throw Error('Imagem ocupada ou indisponível.');
  return { manter, remover: remover.sort((a, b) => a.udid.localeCompare(b.udid)),
    removerImagens: removerImagens.map(({ identifier, version }) => ({ identifier, version })).sort((a, b) => a.identifier.localeCompare(b.identifier)) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const ler = (...args) => JSON.parse(execFileSync('xcrun', ['simctl', ...args], { encoding: 'utf8' }));
    console.log(JSON.stringify(planoIos(ler('list', 'devices', '-j').devices, ler('runtime', 'list', '-j'), ler('list', 'devicetypes', '-j').devicetypes, ...process.argv.slice(2)), null, 2));
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  }
}
