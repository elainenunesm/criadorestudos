'use strict';

/**
 * GIT.JS — Sincroniza tudo (mesmo JSON usado pela pasta conectada, ver
 * js/pasta.js) direto com um repositório Git de verdade (ex: GitHub), sem
 * precisar de GitHub Desktop nem terminal. Roda 100% no navegador com
 * isomorphic-git + LightningFS (sistema de arquivos virtual guardado no
 * IndexedDB) + isomorphic-git/http/web (cliente HTTP baseado em fetch).
 *
 * Como o GitHub não manda os cabeçalhos de CORS que o navegador exige,
 * o tráfego passa por um proxy público (cors.isomorphic-git.org, mantido
 * pelo próprio projeto isomorphic-git) — é a única forma de fazer isso sem
 * servidor próprio. O token de acesso fica salvo no localStorage deste
 * navegador (mostrado com tipo "password" no campo, mas nada é criptografado
 * — é só pra não ficar visível na tela por cima do ombro).
 */

const GIT_CONFIG_KEY = 'construtorGitConfig';
const GIT_CORS_PROXY = 'https://cors.isomorphic-git.org';
const GIT_DIR = '/repo';

let _gitFs = null;
let _gitPfs = null;
let _gitSyncTimeout = null;
let _gitSyncEmAndamento = false;
let _gitSyncPendente = false;

function obterFsGit() {
  if (!_gitFs) {
    _gitFs = new LightningFS('construtor-aulas-git');
    _gitPfs = _gitFs.promises;
  }
  return _gitPfs;
}

function lerConfigGit() {
  try {
    const bruto = localStorage.getItem(GIT_CONFIG_KEY);
    return bruto ? JSON.parse(bruto) : null;
  } catch (e) {
    return null;
  }
}

/** Só os campos NÃO sensíveis da config do Git — pra salvar no JSON da pasta conectada (ver
 * js/pasta.js) e no "Salvar tudo numa pasta" (js/export.js). O token NUNCA entra aqui: se a
 * pasta conectada for a mesma do repositório, esse arquivo pode ser commitado e vazar o token. */
function obterConfigGitSemToken() {
  const config = lerConfigGit();
  if (!config) return null;
  return {
    repoUrl: config.repoUrl || '',
    branch: config.branch || '',
    autorNome: config.autorNome || '',
    autorEmail: config.autorEmail || '',
  };
}

/** Aplica os campos não sensíveis (repoUrl/branch/autor) vindos de um JSON carregado (pasta
 * conectada ou arquivo importado) — sem mexer no token, que continua só no localStorage. */
function aplicarConfigGitParcial(parcial) {
  if (!parcial) return;
  const atual = lerConfigGit() || {};
  const nova = {
    token: atual.token || '',
    repoUrl: parcial.repoUrl || atual.repoUrl || '',
    branch: parcial.branch || atual.branch || '',
    autorNome: parcial.autorNome || atual.autorNome || '',
    autorEmail: parcial.autorEmail || atual.autorEmail || '',
  };
  salvarConfigGit(nova);

  const campoUrl = document.getElementById('gitRepoUrl');
  if (campoUrl) {
    campoUrl.value = nova.repoUrl;
    document.getElementById('gitBranch').value = nova.branch;
    document.getElementById('gitAutorNome').value = nova.autorNome;
    document.getElementById('gitAutorEmail').value = nova.autorEmail;
  }
}

function salvarConfigGit(config) {
  localStorage.setItem(GIT_CONFIG_KEY, JSON.stringify(config));
}

function mostrarStatusGit(mensagem, tipo) {
  const status = document.getElementById('gitSyncStatus');
  if (!status) return;
  status.textContent = mensagem;
  status.classList.toggle('git-sync-ok', tipo === 'ok');
  status.classList.toggle('git-sync-erro', tipo === 'erro');
}

/** Apaga tudo dentro de `dir` no sistema de arquivos virtual (recursivo) — usado antes de cada
 * clone pra garantir uma cópia limpa, sem precisar lidar com merge/histórico divergente. */
async function limparDiretorioVirtual(pfs, dir) {
  let itens;
  try {
    itens = await pfs.readdir(dir);
  } catch (e) {
    return; // diretório não existe ainda, nada pra limpar
  }
  for (const item of itens) {
    const caminho = `${dir}/${item}`;
    const stat = await pfs.stat(caminho);
    if (stat.isDirectory()) {
      await limparDiretorioVirtual(pfs, caminho);
      try {
        await pfs.rmdir(caminho);
      } catch (e) {
        // ENOTEMPTY: alguma coisa apareceu ali de novo entre o passo acima e agora (ex: duas
        // sincronizações rodando ao mesmo tempo) — tenta limpar mais uma vez antes de desistir.
        await limparDiretorioVirtual(pfs, caminho);
        await pfs.rmdir(caminho);
      }
    } else {
      await pfs.unlink(caminho);
    }
  }
}

/** Escreve `conteudo` em `dir/caminhoRelativo`, criando as pastas intermediárias que faltarem
 * (LightningFS não cria pasta pai sozinha, precisa existir antes do writeFile). */
async function escreverArquivoComDiretorios(pfs, dir, caminhoRelativo, conteudo) {
  const partes = caminhoRelativo.split('/');
  partes.pop();
  let atual = dir;
  for (const parte of partes) {
    atual += `/${parte}`;
    await pfs.mkdir(atual).catch(() => {});
  }
  // Texto (string) precisa dizer o encoding; binário (Uint8Array, ex: ícones PNG) vai puro.
  const opcoes = typeof conteudo === 'string' ? 'utf8' : undefined;
  await pfs.writeFile(`${dir}/${caminhoRelativo}`, conteudo, opcoes);
}

/** Clona/atualiza o repositório, escreve o projeto exportado inteiro (mesmos arquivos do
 * "Exportar projeto (.zip)" — index.html, css/js/vendor, aulas, ícones...), comita e envia —
 * chamado tanto pelo botão "Conectar e sincronizar" quanto automaticamente a cada mudança. */
async function sincronizarComGit() {
  const config = lerConfigGit();
  if (!config || !config.repoUrl || !config.token) throw new Error('Configure o repositório e o token primeiro.');

  const pfs = obterFsGit();
  const branch = config.branch || 'main';
  const onAuth = () => ({ username: config.token });

  mostrarStatusGit('Conectando ao repositório...', null);
  await limparDiretorioVirtual(pfs, GIT_DIR);
  await pfs.mkdir(GIT_DIR).catch(() => {});

  /** Mostra o erro original completo (nome/código/stack) no console antes de reembrulhar numa
   * mensagem amigável pra tela — sem isso, a causa real (ex: NotFoundError vs GitPushError vs
   * erro de rede) se perde e só sobra o texto genérico. Abra o console (F12) pra ver o detalhe. */
  function relancarComDetalhe(etapa, e) {
    console.error(`Erro original ao ${etapa}:`, e);
    const detalhe = e && e.code ? `${e.code}: ${e.message}` : (e && e.message) || e;
    throw new Error(`${etapa.charAt(0).toUpperCase() + etapa.slice(1)}: ${detalhe}`);
  }

  try {
    await git.clone({
      fs: _gitFs, http: window.gitHttp, dir: GIT_DIR,
      url: config.repoUrl, ref: branch, singleBranch: true, depth: 1,
      corsProxy: GIT_CORS_PROXY, onAuth,
    });
  } catch (e) {
    // Repositório novo/vazio (sem nenhum commit ainda) não tem branch nenhuma pra clonar —
    // nesse caso, começa um repositório local do zero; o primeiro push cria a branch lá.
    if (!/could not find/i.test(e.message || '')) relancarComDetalhe('ao clonar', e);
    try {
      await limparDiretorioVirtual(pfs, GIT_DIR);
      await pfs.mkdir(GIT_DIR).catch(() => {});
      await git.init({ fs: _gitFs, dir: GIT_DIR, defaultBranch: branch });
      await git.addRemote({ fs: _gitFs, dir: GIT_DIR, remote: 'origin', url: config.repoUrl });
    } catch (e2) {
      relancarComDetalhe('ao iniciar repositório novo', e2);
    }
  }

  mostrarStatusGit('Montando o projeto...', null);
  let arquivos;
  try {
    arquivos = await gerarArquivosProjeto();
  } catch (e) {
    relancarComDetalhe('ao montar o projeto', e);
  }

  mostrarStatusGit('Salvando...', null);
  try {
    for (const [caminho, conteudo] of Object.entries(arquivos)) {
      await escreverArquivoComDiretorios(pfs, GIT_DIR, caminho, conteudo);
    }
    await git.add({ fs: _gitFs, dir: GIT_DIR, filepath: '.' });
  } catch (e) {
    relancarComDetalhe('ao salvar o arquivo', e);
  }

  const status = await git.statusMatrix({ fs: _gitFs, dir: GIT_DIR });
  const semMudanca = status.every(linha => linha[1] === linha[2] && linha[2] === linha[3]);
  if (semMudanca) {
    mostrarStatusGit(`Já está tudo sincronizado (${new Date().toLocaleTimeString('pt-BR')}).`, 'ok');
    return;
  }

  try {
    await git.commit({
      fs: _gitFs, dir: GIT_DIR,
      message: `Atualização do projeto — ${new Date().toLocaleString('pt-BR')}`,
      author: { name: config.autorNome || 'Construtor de Aulas', email: config.autorEmail || 'construtor@local' },
    });
  } catch (e) {
    relancarComDetalhe('ao comitar', e);
  }

  mostrarStatusGit('Enviando pro repositório...', null);
  try {
    await git.push({
      fs: _gitFs, http: window.gitHttp, dir: GIT_DIR,
      remote: 'origin', ref: branch, corsProxy: GIT_CORS_PROXY, onAuth,
    });
  } catch (e) {
    relancarComDetalhe('ao enviar (push)', e);
  }

  mostrarStatusGit(`Sincronizado às ${new Date().toLocaleTimeString('pt-BR')}.`, 'ok');
}

async function conectarGit() {
  const repoUrl = document.getElementById('gitRepoUrl').value.trim();
  const branch = document.getElementById('gitBranch').value.trim() || 'main';
  const token = document.getElementById('gitToken').value.trim();
  const autorNome = document.getElementById('gitAutorNome').value.trim();
  const autorEmail = document.getElementById('gitAutorEmail').value.trim();

  if (!repoUrl || !token) {
    mostrarStatusGit('Preencha ao menos a URL do repositório e o token.', 'erro');
    return;
  }

  salvarConfigGit({ repoUrl, branch, token, autorNome, autorEmail });
  const btnDesconectar = document.getElementById('gitDesconectarBtn');
  if (btnDesconectar) btnDesconectar.style.display = '';

  const btn = document.getElementById('gitConectarBtn');
  if (btn) btn.disabled = true;
  try {
    // Passa pela mesma fila/mutex do autosave (ver executarSincronizacaoGitAutomatica) — clicar
    // aqui enquanto uma sincronização automática já está rodando não pode disparar uma segunda
    // ao mesmo tempo: as duas mexeriam no mesmo diretório virtual junto e corrompiam ele
    // (era a causa do erro "ENOTEMPTY" ao limpar a pasta antes de clonar/iniciar de novo).
    await executarSincronizacaoGitAutomatica();
  } finally {
    if (btn) btn.disabled = false;
  }
}

/** Chamado pelo autosave (js/data.js) a cada criação/edição/exclusão — espera alguns segundos de
 * inatividade antes de sincronizar de verdade, pra não gerar um commit a cada tecla digitada. */
function agendarSincronizacaoGit() {
  const config = lerConfigGit();
  if (!config || !config.repoUrl || !config.token) return; // git não configurado ainda

  clearTimeout(_gitSyncTimeout);
  _gitSyncTimeout = setTimeout(executarSincronizacaoGitAutomatica, 3000);
}

async function executarSincronizacaoGitAutomatica() {
  if (_gitSyncEmAndamento) { _gitSyncPendente = true; return; }
  _gitSyncEmAndamento = true;
  try {
    await sincronizarComGit();
  } catch (e) {
    console.warn('Falha na sincronização automática com o Git:', e);
    mostrarStatusGit('Não deu pra sincronizar: ' + (e.message || e), 'erro');
  } finally {
    _gitSyncEmAndamento = false;
    if (_gitSyncPendente) { _gitSyncPendente = false; executarSincronizacaoGitAutomatica(); }
  }
}

function inicializarGit() {
  const config = lerConfigGit();
  if (!config) return;
  const campoUrl = document.getElementById('gitRepoUrl');
  if (!campoUrl) return;
  campoUrl.value = config.repoUrl || '';
  document.getElementById('gitBranch').value = config.branch || '';
  document.getElementById('gitToken').value = config.token || '';
  document.getElementById('gitAutorNome').value = config.autorNome || '';
  document.getElementById('gitAutorEmail').value = config.autorEmail || '';
  if (config.repoUrl && config.token) {
    mostrarStatusGit(`Configurado: ${config.repoUrl} (branch ${config.branch || 'main'}).`, null);
    const btnDesconectar = document.getElementById('gitDesconectarBtn');
    if (btnDesconectar) btnDesconectar.style.display = '';
  }
}

/** Apaga a configuração do Git salva neste navegador (token incluso) — volta pro estado "nunca
 * conectado". Não mexe no repositório remoto, só para de sincronizar automaticamente daqui. */
function desconectarGit() {
  localStorage.removeItem(GIT_CONFIG_KEY);
  clearTimeout(_gitSyncTimeout);
  ['gitRepoUrl', 'gitBranch', 'gitToken', 'gitAutorNome', 'gitAutorEmail'].forEach(id => {
    const campo = document.getElementById(id);
    if (campo) campo.value = '';
  });
  mostrarStatusGit('Ainda não conectado.', null);
  const btnDesconectar = document.getElementById('gitDesconectarBtn');
  if (btnDesconectar) btnDesconectar.style.display = 'none';
  // Limpa a cópia local do repositório (só um cache, não mexe no remoto) — assim a próxima
  // conexão parte de um clone limpo em vez de reaproveitar o estado de outra conta/token.
  if (_gitFs) {
    indexedDB.deleteDatabase('construtor-aulas-git');
    _gitFs = null;
    _gitPfs = null;
  }
}

inicializarGit();
