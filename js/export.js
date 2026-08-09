'use strict';

/**
 * EXPORT.JS — Gera um projeto de aulas (html/css/js/images) a partir da
 * árvore de ciclos (js/data.js), no formato de dados usado pelo "estudos"
 * (js/data/modulos.mjs + um arquivo por aula em js/data/questoes/), com o
 * conteúdo real preenchido na aba "Conteúdo da aula" (js/conteudo.js).
 * Os arquivos gerados usam extensão .mjs (não .js) de propósito — o Windows
 * trata .js solto como script "perigoso" (mesma extensão usada por vírus via
 * Windows Script Host) e bloqueia/quarentena ao extrair um .zip baixado.
 * .mjs funciona idêntico no navegador (a extensão não importa pra <script
 * src>) e não entra nessa lista de bloqueio.
 */

function formatarValorJs(valor) {
  return JSON.stringify(valor);
}

/** Serializa qualquer valor (string/number/boolean/array/objeto) como literal JS legível. */
function paraJs(valor, nivel) {
  nivel = nivel || 1;
  const indent = '  '.repeat(nivel);
  const indentFechar = '  '.repeat(nivel - 1);

  if (valor === null || valor === undefined) return "''";
  if (typeof valor === 'string') return formatarValorJs(valor);
  if (typeof valor === 'number' || typeof valor === 'boolean') return String(valor);

  if (Array.isArray(valor)) {
    if (valor.length === 0) return '[]';
    const itens = valor.map(v => `${indent}${paraJs(v, nivel + 1)}`).join(',\n');
    return `[\n${itens}\n${indentFechar}]`;
  }

  const chaves = Object.keys(valor).filter(k => !k.startsWith('_'));
  if (chaves.length === 0) return '{}';
  const itens = chaves.map(k => `${indent}${k}: ${paraJs(valor[k], nivel + 1)}`).join(',\n');
  return `{\n${itens}\n${indentFechar}}`;
}

/** licao.html é HTML cru multi-linha — sai como template literal, igual ao estudos. */
function paraJsLicao(licao) {
  const html = String((licao && licao.html) || '').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
  return `{
    titulo: ${formatarValorJs((licao && licao.titulo) || '')},
    html: \`${html}\`,
  }`;
}

function construirPlano(ciclos, trilhas) {
  const etapas = [];
  const niveis = [];

  ciclos.forEach(ciclo => {
    const etapaIds = [];

    ciclo.materias.forEach(materia => {
      etapas.push({
        id: materia.id,
        titulo: materia.titulo,
        materia: materia.titulo,
        aulas: materia.aulas,
      });
      etapaIds.push(materia.id);
    });

    niveis.push({
      id: ciclo.id,
      titulo: ciclo.titulo,
      etapas: etapaIds,
      insigniaUrl: ciclo.insigniaUrl || '',
    });
  });

  // Só entram ciclos que ainda existem de verdade (protege contra referência a um ciclo já excluído).
  const idsCiclosValidos = new Set(niveis.map(n => n.id));
  const trilhasPlano = (trilhas || []).map(t => ({
    id: t.id,
    titulo: t.titulo,
    ciclos: (t.cicloIds || []).filter(id => idsCiclosValidos.has(id)),
  }));

  return { etapas, niveis, trilhas: trilhasPlano };
}

function gerarModulosJs(plano) {
  const etapasTexto = plano.etapas.map(etapa => {
    const aulasTexto = etapa.aulas.map(aula => `      {
        id:      ${aula.id},
        titulo:  ${formatarValorJs(aula.titulo)},
        arquivo: ${formatarValorJs('aula-' + aula.id)},
        icone:   'padrao',
      }`).join(',\n');

    return `  {
    id:      ${etapa.id},
    titulo:  ${formatarValorJs(etapa.titulo)},
    materia: ${formatarValorJs(etapa.materia)},
    aulas: [
${aulasTexto}
    ],
  }`;
  }).join(',\n');

  const niveisTexto = plano.niveis.map(nivel => `  {
    id:          ${nivel.id},
    titulo:      ${formatarValorJs(nivel.titulo)},
    etapas:      [${nivel.etapas.join(', ')}],
    insigniaUrl: ${formatarValorJs(nivel.insigniaUrl || '')},
  }`).join(',\n');

  const trilhasTexto = plano.trilhas.map(t => `  {
    id:     ${t.id},
    titulo: ${formatarValorJs(t.titulo)},
    ciclos: [${t.ciclos.join(', ')}],
  }`).join(',\n');

  return `'use strict';

/**
 * MODULOS.MJS — Gerado pelo Construtor de Aulas.
 * Estrutura de módulos e aulas. O conteúdo de cada aula (exemplos,
 * exercícios, resumo) fica em js/data/questoes/aula-N.mjs.
 */
const MODULOS = [
${etapasTexto}
];

/**
 * NIVEIS.JS — Agrupa etapas em ciclos.
 */
const NIVEIS = [
${niveisTexto}
];

/**
 * TRILHAS — caminhos opcionais compostos por um subconjunto dos ciclos (NIVEIS). Os ciclos que
 * não aparecem em nenhuma trilha são a sequência básica, sempre liberada; a aluna só pode
 * escolher uma trilha depois de concluir todos eles (ver vendor/estudo/js/niveis.mjs).
 */
const TRILHAS = [
${trilhasTexto}
];
`;
}

/** Ordem final de exibição das telas, como tokens simples ('antesComecar', 'exemplo0', 'checagem1', 'resumo', 'licao')
 * — reaproveita montarPassos() (js/conteudo.js) pra garantir que os índices batem exatamente com os arrays exportados abaixo. */
function serializarOrdem(conteudo) {
  return montarPassos(conteudo).map(p => (p.tipo === 'exemplo' || p.tipo === 'checagem') ? `${p.tipo}${p.idx}` : p.tipo);
}

function gerarAulaJs(aula, tituloEtapa) {
  const c = aula.conteudo;
  return `'use strict';

/**
 * AULA-${aula.id}.MJS — ${aula.titulo}
 * Gerado pelo Construtor de Aulas (aba "Conteúdo da aula").
 */
window.AULA_DATA = {
  id:     ${aula.id},
  modulo: ${formatarValorJs(tituloEtapa)},
  titulo: ${formatarValorJs(aula.titulo)},

  // Ordem das telas na sequência de estudo — definida em "Estrutura das telas".
  ordem: ${paraJs(serializarOrdem(c))},

  antesComecar: ${paraJs(c.antesComecar)},

  exemplo: ${paraJs(c.exemplo)},

  checagem: ${paraJs(c.checagem)},

  resumo: ${paraJs(c.resumo)},

  licao: ${paraJsLicao(c.licao)},

  questoes: [],
};
`;
}

function gerarLeiaMeImages() {
  return `Coloque aqui as imagens usadas nas aulas (ex: aula-3-diagrama.png).
Referencie o caminho "images/nome-do-arquivo" no conteúdo da aula.
`;
}

/**
 * Arquivos "motor" (tela inicial com trilha/trava/estrelas + tela de estudo)
 * — não dependem do curso específico, então vêm prontos em vez de serem
 * gerados. O conteúdo vem embutido em js/vendor-embutido.js (VENDOR_ARQUIVOS)
 * em vez de fetch(), porque fetch() de arquivo local é bloqueado pelo
 * navegador quando o index.html é aberto direto (file://) — se mudar algo em
 * vendor/estudo/, regenere js/vendor-embutido.js.
 */
function carregarArquivosVendor() {
  return { ...VENDOR_ARQUIVOS };
}

/** Troca os placeholders {{APP_...}} do cabeçalho pelos valores definidos na aba "Mais". */
function aplicarIdentidadeVisual(arquivos) {
  const logoHtml = logoHtmlInterno(); // js/config.js — mesma lógica ícone/imagem do preview
  const faviconHref = gerarFaviconHref(); // js/config.js
  ['index.html', 'estudo.html'].forEach(caminho => {
    arquivos[caminho] = arquivos[caminho]
      .replaceAll('{{APP_TITULO}}', escaparHtmlExport(CONFIG_APP.titulo || 'Minhas Aulas'))
      .replaceAll('{{APP_SUBTITULO}}', escaparHtmlExport(CONFIG_APP.subtitulo || ''))
      .replaceAll('{{APP_LOGO_HTML}}', logoHtml)
      .replaceAll('{{APP_FAVICON_HREF}}', faviconHref)
      .replaceAll('{{APP_COR}}', CONFIG_APP.cor);
  });

  // Sobrescreve as variáveis de cor (:root padrão já está no topo do arquivo,
  // esse bloco extra vem depois e vence a cascata — ver comentário em
  // vendor/estudo/css/inicio.css).
  const paleta = gerarPaletaCss(CONFIG_APP.cor);
  const blocoRoot = ':root {\n' + Object.entries(paleta).map(([k, v]) => `  ${k}: ${v};`).join('\n') + '\n}\n';
  ['css/inicio.css', 'css/estudo.css'].forEach(caminho => {
    arquivos[caminho] = arquivos[caminho] + '\n' + blocoRoot;
  });
}

function escaparHtmlExport(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** manifest.json do app exportado — mesmo título/cor/ícone escolhidos na aba Layout. */
function gerarManifestExport(icones) {
  const nome = CONFIG_APP.titulo || 'Minhas Aulas';
  return JSON.stringify({
    name: nome,
    short_name: nome.length > 15 ? nome.slice(0, 15) : nome,
    description: CONFIG_APP.subtitulo || 'App de estudos gerado pelo Construtor de Aulas',
    start_url: './index.html',
    scope: './',
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: '#ffffff',
    theme_color: CONFIG_APP.cor,
    lang: 'pt-BR',
    icons: icones,
  }, null, 2);
}

/** Service worker do app exportado — network-first (sempre busca a versão mais nova, só cai pro
 * cache offline), pré-cacheando exatamente os arquivos que foram exportados dessa vez. */
function gerarSwExport(caminhosArquivos) {
  const lista = JSON.stringify(['./', ...caminhosArquivos.map(c => './' + c)], null, 2);
  return `'use strict';

/**
 * SW.JS — Gerado pelo Construtor de Aulas. Estratégia network-first: busca
 * a versão mais nova na rede primeiro, e só usa o cache quando estiver
 * offline (o cache existe pra permitir abrir sem internet).
 */
const CACHE = 'app-estudos-v1';
const ARQUIVOS = ${lista};

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ARQUIVOS.map(u => new Request(u, { cache: 'reload' }))))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(chaves => Promise.all(chaves.filter(k => k !== CACHE).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then(resposta => {
        const copia = resposta.clone();
        caches.open(CACHE).then(cache => cache.put(event.request, copia));
        return resposta;
      })
      .catch(() => caches.match(event.request).then(cached => cached || (event.request.mode === 'navigate' ? caches.match('./index.html') : undefined)))
  );
});
`;
}

async function exportarProjeto() {
  const plano = construirPlano(CICLOS, TRILHAS);
  const arquivos = carregarArquivosVendor();
  aplicarIdentidadeVisual(arquivos);

  arquivos['js/data/modulos.mjs'] = gerarModulosJs(plano);
  arquivos['images/LEIA-ME.txt'] = gerarLeiaMeImages();

  plano.etapas.forEach(etapa => {
    etapa.aulas.forEach(aula => {
      arquivos[`js/data/questoes/aula-${aula.id}.mjs`] = gerarAulaJs(aula, etapa.titulo);
    });
  });

  const { icones, arquivosBinarios } = await gerarIconesPwaExport();
  Object.assign(arquivos, arquivosBinarios);
  arquivos['manifest.json'] = gerarManifestExport(icones);
  arquivos['sw.js'] = gerarSwExport(Object.keys(arquivos));

  const blob = criarZip(arquivos);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'construtor-aulas-export.zip';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Salva TODO o trabalho (ciclos/matérias/aulas/conteúdo + config de marca) num arquivo .json,
 * numa pasta que a usuária escolhe — é o "salvar meu progresso no Construtor", diferente do
 * "Exportar projeto (.zip)" (que gera o app pronto pra estudar). Em navegadores com File System
 * Access API (Chrome/Edge), grava direto na pasta escolhida; nos outros, baixa o arquivo normal. */
async function salvarProjetoJson() {
  const git = typeof obterConfigGitSemToken === 'function' ? obterConfigGitSemToken() : null;
  const dados = { savedAt: new Date().toISOString(), config: CONFIG_APP, ciclos: CICLOS, trilhas: TRILHAS, git };
  const conteudoJson = JSON.stringify(dados, null, 2);

  if ('showDirectoryPicker' in window) {
    let pastaHandle;
    try {
      pastaHandle = await window.showDirectoryPicker();
    } catch (e) {
      return; // usuária cancelou o seletor de pasta
    }
    const arquivoHandle = await pastaHandle.getFileHandle('construtor-aulas.json', { create: true });
    const writable = await arquivoHandle.createWritable();
    await writable.write(conteudoJson);
    await writable.close();
    return;
  }

  // Sem suporte a escolher pasta (Firefox/Safari) — baixa o .json normalmente.
  const blob = new Blob([conteudoJson], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'construtor-aulas.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
