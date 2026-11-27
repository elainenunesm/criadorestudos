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
        icone: materia.icone || '',
        iconeUrl: materia.iconeUrl || '',
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

    // Ícone escolhido no Construtor (menu da matéria): vai pronto como markup SVG (ou link de imagem), pra o
    // player não precisar conhecer a lista de ícones. Sem escolha, o player decide pelo nome da matéria.
    let iconeLinhas = '';
    if (etapa.icone === 'externo' && etapa.iconeUrl) {
      iconeLinhas = `    iconeUrl: ${formatarValorJs(etapa.iconeUrl)},\n`;
    } else if (etapa.icone && typeof ICONES_TIPO !== 'undefined' && ICONES_TIPO[etapa.icone]) {
      iconeLinhas = `    iconeSvg: ${formatarValorJs(ICONES_TIPO[etapa.icone]('currentColor'))},\n`;
    }
    return `  {
    id:      ${etapa.id},
    titulo:  ${formatarValorJs(etapa.titulo)},
    materia: ${formatarValorJs(etapa.materia)},
${iconeLinhas}    aulas: [
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

/** Ordem final de exibição das telas, como tokens simples ('antesComecar', 'exemplo0', 'checagem1', 'lista0', 'timeline0', 'jogoSinais0', 'agrupamento0', 'distribuicao0', 'resumo', 'licao')
 * — reaproveita montarPassos() (js/conteudo.js) pra garantir que os índices batem exatamente com os arrays exportados abaixo. */
function serializarOrdem(conteudo) {
  return montarPassos(conteudo).map(p => (p.tipo === 'exemplo' || p.tipo === 'checagem' || p.tipo === 'lista' || p.tipo === 'timeline' || p.tipo === 'jogoSinais' || p.tipo === 'agrupamento' || p.tipo === 'distribuicao' || p.tipo === 'mapaMental' || p.tipo === 'tabelaAnimada' || p.tipo === 'mapaConceitual' || p.tipo === 'mapaInterativo') ? `${p.tipo}${p.idx}` : p.tipo);
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

  lista: ${paraJs(c.lista)},

  timeline: ${paraJs(c.timeline)},

  jogoSinais: ${paraJs(c.jogoSinais)},

  agrupamento: ${paraJs(c.agrupamento)},

  distribuicao: ${paraJs(c.distribuicao)},

  mapaMental: ${paraJs(c.mapaMental)},

  tabelaAnimada: ${paraJs(c.tabelaAnimada)},

  mapaConceitual: ${paraJs(c.mapaConceitual)},

  mapaInterativo: ${paraJs(c.mapaInterativo)},

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

/** Monta o mapa completo de arquivos do projeto pronto pra rodar (caminho -> conteúdo, string ou
 * Uint8Array pros binários) — o mesmo conteúdo que vira o .zip do "Exportar projeto", reaproveitado
 * também pela sincronização com o Git (js/git.js), que manda o projeto inteiro, não só os dados. */
async function gerarArquivosProjeto() {
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

  return arquivos;
}

async function exportarProjeto() {
  const arquivos = await gerarArquivosProjeto();
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
  const dados = { savedAt: new Date().toISOString(), config: CONFIG_APP, grupos: GRUPOS, ciclos: CICLOS, trilhas: TRILHAS, git };
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

/* ---------------------------------------------------------------------- */
/* EXPORTAR PDF — documento de estudo com todo o conteúdo (Ciclo > Etapa >  */
/* Matéria > Aula), pra imprimir ou salvar como PDF pelo navegador.        */
/* Reaproveita renderFraseComDestaque/escaparHtml (js/conteudo.js).        */
/* ---------------------------------------------------------------------- */

/** Sentença (array de palavras) com a(s) certa(s) marcada(s) em negrito/verde. */
function pdfRenderSentencaComCorreta(sentenca, corretaOuCorretas) {
  const corretos = Array.isArray(corretaOuCorretas) ? corretaOuCorretas : [corretaOuCorretas];
  return (sentenca || []).map((tok, i) => corretos.includes(i) ? `<strong class="pdf-certo">${escaparHtml(tok)}</strong>` : escaparHtml(tok)).join(' ');
}

/** Sentença com o(s) rótulo(s) de cada palavra marcada entre colchetes (Múltiplos Rótulos). */
function pdfRenderSentencaComRotulos(sentenca, rotulos) {
  return (sentenca || []).map((tok, i) => {
    const rot = (rotulos || [])[i];
    return rot ? `<strong class="pdf-certo">${escaparHtml(tok)}</strong><sub> [${escaparHtml(rot.replace(/;/g, ', '))}]</sub>` : escaparHtml(tok);
  }).join(' ');
}

function pdfRenderExemplo(item) {
  let html = '';
  if (item.texto) html += `<div class="pdf-item-icone">${pdfIcone(item.tipo, '#4A80F0', item.iconeUrl, '#eef2ff')}<span>${renderFraseComDestaque(item.texto, item.textoDestaque, item.textoDestaqueNegrito)}</span></div>`;
  if (item.conclusao) html += `<p>${renderFraseComDestaque(item.conclusao, item.conclusaoDestaque, item.conclusaoDestaqueNegrito)}</p>`;
  if (item.obs) html += `<p class="pdf-obs">${renderFraseComDestaque(item.obs, item.obsDestaque, item.obsDestaqueNegrito)}</p>`;
  (item.pontos || []).forEach(p => { if (p.texto) html += `<div class="pdf-item-icone">${pdfIcone(p.tipo, '#4A80F0', p.iconeUrl, '#eef2ff') || '•'}<span>${renderFraseComDestaque(p.texto, p.textoDestaque, p.textoDestaqueNegrito)}</span></div>`; });
  if (item.cardImagem) {
    const ci = item.cardImagem;
    if (ci.imagemUrl) html += `<img class="pdf-img" src="${escaparHtml(ci.imagemUrl)}" alt="">`;
    if (ci.titulo) html += `<p><strong>${escaparHtml(ci.titulo)}</strong></p>`;
    if (ci.subtitulo) html += `<p>${escaparHtml(ci.subtitulo)}</p>`;
    if (ci.texto) html += `<p>${escaparHtml(ci.texto)}</p>`;
  }
  if (item.cardLink) {
    const cl = item.cardLink;
    if (cl.titulo) html += `<p><strong>${escaparHtml(cl.titulo)}</strong></p>`;
    if (cl.subtitulo) html += `<p>${escaparHtml(cl.subtitulo)}</p>`;
    if (cl.texto) html += `<p>${escaparHtml(cl.texto)}</p>`;
    if (cl.modo !== 'download' && cl.url) html += `<p>${escaparHtml(cl.url)}</p>`;
    else if (cl.modo === 'download' && cl.arquivoNome) html += `<p>Arquivo: ${escaparHtml(cl.arquivoNome)}</p>`;
  }
  if (item.flashcard) {
    html += `<p><strong>Frente:</strong> ${escaparHtml(item.flashcard.frente || '')}<br><strong>Verso:</strong> ${escaparHtml(item.flashcard.verso || '')}</p>`;
  }
  ['audio', 'gravacao', 'gravacaoAluno'].forEach(campo => {
    const a = item[campo];
    if (!a) return;
    if (a.titulo) html += `<p><strong>${escaparHtml(a.titulo)}</strong></p>`;
    if (a.subtitulo) html += `<p>${escaparHtml(a.subtitulo)}</p>`;
    if (a.texto) html += `<p>${escaparHtml(a.texto)}</p>`;
  });
  if (item.palavraSelecionavel) {
    const ps = item.palavraSelecionavel;
    if (ps.titulo) html += `<p><strong>${escaparHtml(ps.titulo)}</strong></p>`;
    if (ps.subtitulo) html += `<p>${escaparHtml(ps.subtitulo)}</p>`;
    if (ps.instrucao) html += `<p>${escaparHtml(ps.instrucao)}</p>`;
    if ((ps.sentenca || []).length) html += `<p>${pdfRenderSentencaComCorreta(ps.sentenca, ps.correta)}${ps.rotulo ? ` <em>(${escaparHtml(ps.rotulo)})</em>` : ''}</p>`;
  }
  if (item.palavraSelecionavelMultipla) {
    const psm = item.palavraSelecionavelMultipla;
    if (psm.instrucao) html += `<p>${escaparHtml(psm.instrucao)}</p>`;
    if ((psm.sentenca || []).length) html += `<p>${pdfRenderSentencaComCorreta(psm.sentenca, psm.corretas || [])}${psm.rotulo ? ` <em>(${escaparHtml(psm.rotulo)})</em>` : ''}</p>`;
  }
  if (item.palavraPointLabelExemplo) {
    const pl = item.palavraPointLabelExemplo;
    if (pl.titulo) html += `<p><strong>${renderFraseComDestaque(pl.titulo, pl.tituloDestaque, [])}</strong></p>`;
    if (pl.instrucao) html += `<p>${escaparHtml(pl.instrucao)}</p>`;
    if ((pl.sentenca || []).length) html += `<p>${pdfRenderSentencaComCorreta(pl.sentenca, pl.corretas || [])}${pl.rotulo ? ` <em>(${escaparHtml(pl.rotulo)})</em>` : ''}</p>`;
  }
  if (item.palavraMultiplosRotulos) {
    const pmr = item.palavraMultiplosRotulos;
    if (pmr.instrucao) html += `<p>${escaparHtml(pmr.instrucao)}</p>`;
    if ((pmr.sentenca || []).length) html += `<p>${pdfRenderSentencaComRotulos(pmr.sentenca, pmr.rotulos)}</p>`;
  }
  return html || '<p class="pdf-vazio">(sem conteúdo)</p>';
}

function pdfRenderChecagem(item) {
  let html = '';
  if (item.subtitulo && item.invertido) html += `<p class="pdf-sub">${renderFraseComDestaque(item.subtitulo, item.subtituloDestaque, item.subtituloDestaqueNegrito)}</p>`;
  if (item.titulo) html += `<p><strong>${renderFraseComDestaque(item.titulo, item.tituloDestaque, item.tituloDestaqueNegrito)}</strong></p>`;
  if (item.subtitulo && !item.invertido) html += `<p class="pdf-sub">${renderFraseComDestaque(item.subtitulo, item.subtituloDestaque, item.subtituloDestaqueNegrito)}</p>`;

  if (item.multiplosRotulos) {
    if ((item.sentenca || []).length) html += `<p>${pdfRenderSentencaComRotulos(item.sentenca, item.rotulos)}</p>`;
  } else if (Array.isArray(item.sentenca)) {
    if (item.sentenca.length) html += `<p>${pdfRenderSentencaComCorreta(item.sentenca, item.correta)}</p>`;
  } else if (item.opcoes) {
    const letras = 'ABCDEFGH';
    html += '<ul class="pdf-opcoes">' + item.opcoes.map((op, i) =>
      `<li${i === item.correta ? ' class="pdf-certo"' : ''}>${letras[i] || i + 1}) ${escaparHtml(op)}${i === item.correta ? ' ✓' : ''}</li>`
    ).join('') + '</ul>';
  }
  if (item.feedbackCorreto) html += `<p class="pdf-fb pdf-fb-ok">✓ ${escaparHtml(item.feedbackCorreto)}</p>`;
  if (item.feedbackErrado) html += `<p class="pdf-fb pdf-fb-erro">✗ ${escaparHtml(item.feedbackErrado)}</p>`;
  return html || '<p class="pdf-vazio">(sem conteúdo)</p>';
}

/** Envolve o conteúdo de uma seção (Antes de começar/Exemplo/Checagem/...) num
 * cartão com rótulo colorido — cada tipo tem sua cor (mesmas do resto do app),
 * pra ficar fácil identificar de relance ao folhear o PDF. */
function pdfSecao(rotulo, corTipo, corpoHtml) {
  if (!corpoHtml) return '';
  return `<div class="pdf-secao" style="border-left-color:${corTipo}">
    <p class="pdf-rotulo" style="color:${corTipo}">${escaparHtml(rotulo)}</p>
    ${corpoHtml}
  </div>`;
}

/* ── Peças visuais do PDF: ícones, imagens e mapas desenhados em SVG (autocontido, com as cores da aula) ── */

/** Ícone redondo/quadrado com o desenho do "tipo" (mesmos ícones do editor), na cor e fundo escolhidos. */
function pdfIcone(tipo, cor, iconeUrl, fundo) {
  if (!tipo || tipo === 'nenhum') return '';
  return `<span class="pdf-ico" style="background:${fundo || '#f0eaff'}">${iconeTipo(tipo, cor || '#5B2BCB', iconeUrl)}</span>`;
}

/** Quebra um texto em linhas de até `max` caracteres (pra caber dentro de uma caixa do SVG). */
function pdfQuebra(texto, max) {
  const palavras = String(texto || '').split(/\s+/).filter(Boolean);
  const linhas = [];
  let atual = '';
  palavras.forEach(p => {
    if (atual && (atual + ' ' + p).length > max) { linhas.push(atual); atual = p; }
    else atual = atual ? `${atual} ${p}` : p;
  });
  if (atual) linhas.push(atual);
  return linhas.length ? linhas : [''];
}

/** Caixa arredondada com texto centralizado (cada item de `linhas` é uma linha; `negritoAte` deixa as N primeiras em negrito). */
function pdfSvgCaixa(x, y, w, h, o) {
  const fonte = o.fonte || 12, passo = fonte + 3;
  const cx = x + w / 2;
  const ini = y + h / 2 - ((o.linhas.length - 1) * passo) / 2 + fonte * 0.35;
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="${o.fundo}" stroke="${o.borda}" stroke-width="1.5"${o.tracejado ? ' stroke-dasharray="5 3"' : ''}/>`
    + o.linhas.map((l, i) => `<text x="${cx}" y="${ini + i * passo}" text-anchor="middle" font-size="${fonte}" font-weight="${i < (o.negritoAte || 0) ? 700 : 500}" fill="${o.cor}">${escaparHtml(l)}</text>`).join('');
}

/** Mesmo layout de árvore do player (profundidade + ordem das folhas). */
function pdfLayoutArvore(nos) {
  const filhosDe = new Map();
  nos.forEach(n => { if (n.paiId) { if (!filhosDe.has(n.paiId)) filhosDe.set(n.paiId, []); filhosDe.get(n.paiId).push(n.id); } });
  let folha = 0;
  const ordem = new Map(), prof = new Map();
  const visitar = (id, d) => {
    prof.set(id, d);
    const fs = filhosDe.get(id) || [];
    if (!fs.length) { ordem.set(id, folha++); return; }
    fs.forEach(f => visitar(f, d + 1));
    const xs = fs.map(f => ordem.get(f));
    ordem.set(id, (Math.min(...xs) + Math.max(...xs)) / 2);
  };
  nos.filter(n => !n.paiId).forEach(n => visitar(n.id, 0));
  return { ordem, prof };
}

/** Desenha uma árvore de nós em SVG. `info(no, i)` devolve { linhas, fundo, borda, cor, tracejado, negritoAte }.
 * Testa a árvore deitada e em pé e fica com a que melhor aproveita a largura da página. */
function pdfSvgArvore(nos, info) {
  if (!nos.length) return '';
  const L = pdfLayoutArvore(nos);
  const W = 160, M = 14;
  const infos = nos.map((no, i) => info(no, i));
  const alturas = infos.map(inf => Math.max(40, inf.linhas.length * 15 + 18));
  const H = Math.max(...alturas);
  const montar = vertical => {
    const pos = new Map();
    let maxX = 0, maxY = 0;
    nos.forEach((no, i) => {
      const d = L.prof.get(no.id) || 0, o = L.ordem.get(no.id) || 0;
      const x = (vertical ? o * (W + 28) : d * (W + 64)) + M;
      const y = (vertical ? d * (H + 46) : o * (H + 22)) + M;
      pos.set(no.id, { x, y, h: alturas[i] });
      maxX = Math.max(maxX, x + W); maxY = Math.max(maxY, y + H);
    });
    return { pos, w: maxX + M, h: maxY + M, vertical };
  };
  const a = montar(false), b = montar(true);
  const escala = m => Math.min(700 / m.w, 880 / m.h);
  const m = escala(b) > escala(a) * 1.05 ? b : a;

  let linhas = '', caixas = '';
  nos.forEach((no, i) => {
    const p = m.pos.get(no.id);
    caixas += pdfSvgCaixa(p.x, p.y + (H - p.h) / 2, W, p.h, infos[i]);
    const pai = no.paiId && m.pos.get(no.paiId);
    if (pai) {
      const cor = infos[i].borda;
      if (m.vertical) {
        const x0 = pai.x + W / 2, y0 = pai.y + H / 2 + pai.h / 2 - (H - pai.h) / 2, x1 = p.x + W / 2, y1 = p.y + (H - p.h) / 2, my = (y0 + y1) / 2;
        linhas += `<path d="M${x0},${y0} C${x0},${my} ${x1},${my} ${x1},${y1 - 2}" fill="none" stroke="${cor}" stroke-width="1.8" marker-end="url(#pdfSeta)"/>`;
      } else {
        const x0 = pai.x + W, y0 = pai.y + H / 2, x1 = p.x, y1 = p.y + H / 2, mx = (x0 + x1) / 2;
        linhas += `<path d="M${x0},${y0} C${mx},${y0} ${mx},${y1} ${x1 - 2},${y1}" fill="none" stroke="${cor}" stroke-width="1.8" marker-end="url(#pdfSeta)"/>`;
      }
    }
  });
  return `<svg class="pdf-mapa-svg" viewBox="0 0 ${m.w} ${m.h}" style="max-width:${Math.round(Math.min(m.w * 1.5, 720))}px" font-family="Segoe UI, Helvetica, Arial, sans-serif">
    <defs><marker id="pdfSeta" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill="#5724D6"/></marker></defs>
    ${linhas}${caixas}</svg>`;
}

/** Mapa Mental: conceito no centro e os tópicos em volta, com a cor de cada tópico e as setas coloridas. */
function pdfSvgMapaMental(mm) {
  const topicos = mm.topicos || [];
  const cores = ['#3B82F6', '#F97316', '#EAB308', '#16A34A', '#EF4444', '#7C3AED', '#0891B2', '#DB2777'];
  const BW = 190;
  const caixas = topicos.map(t => {
    const linhas = [...pdfQuebra(t.titulo || '', 24), ...String(t.texto || '').split('\n').flatMap(l => l.trim() ? pdfQuebra('• ' + l.trim(), 27) : [])].slice(0, 9);
    return { t, linhas, negritoAte: pdfQuebra(t.titulo || '', 24).length, h: Math.max(46, linhas.length * 15 + 18) };
  });
  const maxH = Math.max(46, ...caixas.map(c => c.h));
  const rx = topicos.length > 2 ? 290 : 230, ry = topicos.length > 1 ? Math.max(150, maxH * 1.3 + 40) : 0;
  const cx = rx + BW / 2 + 12, cy = ry + maxH / 2 + 12;
  const W = cx * 2, H = cy * 2;
  let setas = '', corpo = '';
  const nCentro = pdfQuebra(mm.conceito || '', 18);
  caixas.forEach((c, i) => {
    const ang = (2 * Math.PI * i) / caixas.length;
    const bx = cx + (topicos.length === 1 ? 0 : rx * Math.sin(ang)), by = cy - (topicos.length === 1 ? -ry - maxH : ry * Math.cos(ang));
    const seta = cores[i % cores.length];
    setas += `<line x1="${cx}" y1="${cy}" x2="${bx}" y2="${by}" stroke="${seta}" stroke-width="2.2"/>`;
    corpo += pdfSvgCaixa(bx - BW / 2, by - c.h / 2, BW, c.h, { linhas: c.linhas, negritoAte: c.negritoAte, fundo: c.t.cor || '#DFF3FC', borda: seta, cor: '#1a1a2e' });
  });
  const centro = pdfSvgCaixa(cx - 80, cy - Math.max(26, nCentro.length * 9 + 12), 160, Math.max(52, nCentro.length * 18 + 24), { linhas: nCentro, negritoAte: 99, fundo: '#5B2BCB', borda: '#4a22a8', cor: '#fff', fonte: 13 });
  const altFinal = topicos.length === 1 ? H + ry + maxH : H;
  return `<svg class="pdf-mapa-svg" viewBox="0 0 ${W} ${altFinal}" style="max-width:${Math.round(Math.min(W, 720))}px" font-family="Segoe UI, Helvetica, Arial, sans-serif">${setas}${corpo}${centro}</svg>`;
}

/** Seção de uma tela da aula — gerada na MESMA ordem em que as telas aparecem na aula (conteudo.ordem). */
function pdfSecaoDoPasso(passo, c) {
  const titulo = (campo, o) => o[campo] ? `<p class="pdf-destaque">${renderFraseComDestaque(o[campo], o[campo + 'Destaque'], o[campo + 'DestaqueNegrito'])}</p>` : '';
  const frase = (campo, o) => o[campo] ? `<p>${renderFraseComDestaque(o[campo], o[campo + 'Destaque'], o[campo + 'DestaqueNegrito'])}</p>` : '';
  const rotulo = passo.titulo;

  if (passo.tipo === 'antesComecar') {
    const ac = c.antesComecar || {};
    let corpo = titulo('titulo', ac) + frase('descricao', ac);
    if (ac.aprender) corpo += `<p><em>O que você vai aprender:</em> ${renderFraseComDestaque(ac.aprender, ac.aprenderDestaque, ac.aprenderDestaqueNegrito)}</p>`;
    if (ac.importancia) corpo += `<p><em>Por que isso é importante:</em> ${renderFraseComDestaque(ac.importancia, ac.importanciaDestaque, ac.importanciaDestaqueNegrito)}</p>`;
    return pdfSecao(rotulo, '#7B3FF2', corpo);
  }
  if (passo.tipo === 'exemplo') return pdfSecao(rotulo, '#4A80F0', pdfRenderExemplo((c.exemplo || [])[passo.idx] || {}));
  if (passo.tipo === 'checagem') return pdfSecao(rotulo, '#0D9488', pdfRenderChecagem((c.checagem || [])[passo.idx] || {}));

  if (passo.tipo === 'lista') {
    const li = (c.lista || [])[passo.idx];
    if (!li || !(li.titulo || li.textoAntes || (li.itens || []).length || li.descricao)) return '';
    let corpo = '';
    if (li.icone) corpo += `<div class="pdf-linha-icone">${pdfIcone(li.icone.tipo, li.icone.cor, li.icone.iconeUrl, li.icone.corFundo)}${titulo('titulo', li)}</div>`;
    else corpo += titulo('titulo', li);
    corpo += frase('textoAntes', li);
    if ((li.itens || []).length) corpo += '<div class="pdf-itens">' + li.itens.map(it =>
      `<div class="pdf-item-icone">${pdfIcone(it.tipo, it.cor, it.iconeUrl, it.corFundo)}<span>${renderFraseComDestaque(it.texto || '', it.textoDestaque, it.textoDestaqueNegrito)}</span></div>`).join('') + '</div>';
    corpo += frase('descricao', li);
    return pdfSecao(rotulo, '#DB2777', corpo);
  }

  if (passo.tipo === 'timeline') {
    const tl = (c.timeline || [])[passo.idx];
    if (!tl || !(tl.titulo || tl.instrucao || (tl.eventos || []).length)) return '';
    let corpo = titulo('titulo', tl) + frase('instrucao', tl);
    corpo += '<div class="pdf-timeline">' + (tl.eventos || []).map(ev => `
      <div class="pdf-ev"><span class="pdf-ev-ponto" style="background:${ev.cor || '#5B2BCB'}"></span>
        <div class="pdf-ev-corpo">
          <p class="pdf-ev-topo">${ev.ano ? `<span class="pdf-ev-ano" style="background:${ev.cor || '#5B2BCB'}">${escaparHtml(ev.ano)}</span>` : ''}<strong>${escaparHtml(ev.titulo || '')}</strong></p>
          ${ev.descricao ? `<p>${escaparHtml(ev.descricao)}</p>` : ''}
          ${ev.caracteristicas ? `<p class="pdf-sub">${escaparHtml(ev.caracteristicas)}</p>` : ''}
        </div></div>`).join('') + '</div>';
    return pdfSecao(rotulo, '#DB2777', corpo);
  }

  if (passo.tipo === 'jogoSinais' || passo.tipo === 'agrupamento' || passo.tipo === 'distribuicao') {
    const o = (c[passo.tipo] || [])[passo.idx];
    if (!o || !(o.titulo || o.instrucao)) return '';
    const cores = { jogoSinais: '#2563EB', agrupamento: '#EA580C', distribuicao: '#0891B2' };
    // Os números/grupos desses jogos são digitados pela aluna no player — o PDF mostra título e instrução.
    return pdfSecao(rotulo, cores[passo.tipo], titulo('titulo', o) + frase('instrucao', o));
  }

  if (passo.tipo === 'mapaMental') {
    const mm = (c.mapaMental || [])[passo.idx];
    if (!mm || !(mm.conceito || (mm.topicos || []).length)) return '';
    let corpo = titulo('titulo', mm);
    corpo += `<div class="pdf-mapa">${pdfSvgMapaMental(mm)}</div>`;
    return pdfSecao(rotulo, '#5724D6', corpo);
  }

  if (passo.tipo === 'tabelaAnimada') {
    const ta = (c.tabelaAnimada || [])[passo.idx];
    if (!ta || !((ta.itens || []).length || ((ta.tabela || {}).linhas || []).length)) return '';
    let corpo = titulo('titulo', ta);
    const tabela = ta.tabela || { colunas: [], linhas: [] };
    if ((tabela.colunas || []).length) {
      corpo += '<table class="pdf-tabela"><thead><tr>' + tabela.colunas.map(col => `<th>${escaparHtml(col || '')}</th>`).join('') + '</tr></thead><tbody>'
        + (tabela.linhas || []).map(linha => '<tr>' + (linha.celulas || []).map(cel => `<td>${escaparHtml(cel || '')}</td>`).join('') + '</tr>').join('')
        + '</tbody></table>';
    }
    if ((ta.itens || []).length) corpo += '<div class="pdf-itens">' + ta.itens.map(it =>
      `<div class="pdf-item-icone">${pdfIcone(it.tipo, '#0D6EFD', it.iconeUrl, '#e8f0ff')}<span><strong>${renderFraseComDestaque(it.titulo || '', it.tituloDestaque, it.tituloDestaqueNegrito)}</strong>${it.texto ? ' — ' + renderFraseComDestaque(it.texto, it.textoDestaque, it.textoDestaqueNegrito) : ''}</span></div>`).join('') + '</div>';
    return pdfSecao(rotulo, '#0D6EFD', corpo);
  }

  if (passo.tipo === 'mapaConceitual') {
    const mc = (c.mapaConceitual || [])[passo.idx];
    const nos = (mc && mc.nos) || [];
    if (!nos.length) return '';
    let corpo = titulo('titulo', mc);
    corpo += `<div class="pdf-mapa">${pdfSvgArvore(nos, (no, i) => ({
      linhas: pdfQuebra(no.texto || (i === 0 ? 'Conceito central' : '(sem texto)'), 21),
      fundo: i === 0 ? '#5B2BCB' : (no.cor || '#F1EBFF'), borda: i === 0 ? '#4a22a8' : '#5724D6',
      cor: i === 0 ? '#fff' : (no.corTexto || '#1a1a2e'), negritoAte: 99,
    }))}</div>`;
    const detalhes = nos.filter(no => no.cartaoTexto);
    if (detalhes.length) corpo += '<div class="pdf-itens">' + detalhes.map(no =>
      `<div class="pdf-item-icone">${pdfIcone(no.tipo, '#5724D6', no.iconeUrl, no.cor || '#F1EBFF')}<span><strong>${escaparHtml(no.texto || '')}</strong> — ${renderFraseComDestaque(no.cartaoTexto, no.cartaoTextoDestaque, no.cartaoTextoDestaqueNegrito)}</span></div>`).join('') + '</div>';
    return pdfSecao(rotulo, '#7C3AED', corpo);
  }

  if (passo.tipo === 'mapaInterativo') {
    const mi = (c.mapaInterativo || [])[passo.idx];
    const nos = (mi && mi.nos) || [];
    if (!nos.length) return '';
    let corpo = titulo('titulo', mi) + (mi.instrucao ? `<p>${escaparHtml(mi.instrucao)}</p>` : '');
    const texto = no => (no.lacuna ? ((no.alternativas || [])[no.correta] || '(lacuna)') : (no.texto || ''));
    corpo += `<div class="pdf-mapa">${pdfSvgArvore(nos, (no, i) => ({
      linhas: pdfQuebra(texto(no), 21),
      fundo: i === 0 ? '#5B2BCB' : (no.lacuna ? '#EAFAF0' : '#F1EBFF'),
      borda: i === 0 ? '#4a22a8' : (no.lacuna ? '#16A34A' : '#5724D6'),
      cor: i === 0 ? '#fff' : '#1a1a2e', negritoAte: 99, tracejado: false,
    }))}</div>`;
    const lacunas = nos.filter(no => no.lacuna);
    if (lacunas.length) corpo += '<div class="pdf-itens">' + lacunas.map(no => {
      const alts = (no.alternativas || []).filter(a => a);
      return `<div class="pdf-item-icone"><span class="pdf-ico" style="background:#EAFAF0;color:#16A34A">✓</span><span><strong>${escaparHtml(texto(no))}</strong>`
        + (alts.length ? `<br><span class="pdf-sub">Alternativas: ${alts.map((a, k) => k === no.correta ? `<b class="pdf-certo">${escaparHtml(a)}</b>` : escaparHtml(a)).join(' · ')}</span>` : '')
        + (no.dica ? `<br><span class="pdf-sub">Dica: ${escaparHtml(no.dica)}</span>` : '') + '</span></div>';
    }).join('') + '</div>';
    return pdfSecao(rotulo, '#6D28D9', corpo);
  }

  if (passo.tipo === 'resumo') {
    const res = c.resumo || {};
    if (!(res.titulo || (res.itens || []).length)) return '';
    let corpo = titulo('titulo', res);
    if ((res.itens || []).length) corpo += '<div class="pdf-itens">' + res.itens.map(it =>
      `<div class="pdf-item-icone">${pdfIcone(it.tipo, it.cor, it.iconeUrl, it.corFundo)}<span><strong>${renderFraseComDestaque(it.titulo || '', it.tituloDestaque, it.tituloDestaqueNegrito)}</strong>${it.exemplos ? ' — ' + renderFraseComDestaque(it.exemplos, it.exemplosDestaque, it.exemplosDestaqueNegrito) : ''}</span></div>`).join('') + '</div>';
    return pdfSecao(rotulo, '#F59E0B', corpo);
  }

  if (passo.tipo === 'licao') {
    const lic = c.licao || {};
    if (!(lic.titulo || lic.html)) return '';
    return pdfSecao(rotulo, '#16A34A', titulo('titulo', lic) + (lic.html ? `<div class="pdf-licao-corpo">${lic.html}</div>` : ''));
  }
  return '';
}

function pdfRenderAula(aula) {
  const c = aula.conteudo || {};
  let passos = [];
  try { passos = montarPassos(c); } catch (e) { passos = []; }
  const secoes = passos.map(p => pdfSecaoDoPasso(p, c)).join('');
  return `<div class="pdf-aula">
    <h4 class="pdf-aula-titulo">${escaparHtml(aula.titulo)}</h4>
    ${secoes || '<p class="pdf-vazio">Esta aula ainda não tem conteúdo.</p>'}
  </div>`;
}

function gerarHtmlEstudoPdf() {
  let corpo = '';
  let primeiroCiclo = true;
  GRUPOS.forEach(grupo => {
    const ciclosDoGrupo = CICLOS.filter(c => c.grupoId === grupo.id);
    if (!ciclosDoGrupo.some(c => c.materias.some(m => m.aulas.length))) return;
    corpo += `<h1 class="pdf-ciclo${primeiroCiclo ? ' primeiro' : ''}">${escaparHtml(grupo.titulo)}</h1>`;
    primeiroCiclo = false;
    ciclosDoGrupo.forEach(ciclo => {
      if (!ciclo.materias.some(m => m.aulas.length)) return;
      corpo += `<h2 class="pdf-etapa">${escaparHtml(ciclo.titulo)}</h2>`;
      ciclo.materias.forEach(materia => {
        if (!materia.aulas.length) return;
        corpo += `<h3 class="pdf-materia">${escaparHtml(materia.titulo)}</h3>`;
        materia.aulas.forEach(aula => { corpo += pdfRenderAula(aula); });
      });
    });
  });

  const tituloCurso = escaparHtml((CONFIG_APP && CONFIG_APP.titulo) || 'Minhas Aulas');
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>${tituloCurso}</title>
<style>
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body {
    font-family: -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif;
    background: #fff; color: #1a1a2e; max-width: 760px; margin: 0 auto; padding: 56px 32px 80px;
    line-height: 1.65; font-size: 15px;
  }

  .pdf-capa { text-align: center; padding: 40px 0 56px; margin-bottom: 8px; border-bottom: 4px solid #5B2BCB; }
  .pdf-capa-titulo { font-size: 34px; font-weight: 800; color: #1a1a2e; }
  .pdf-capa-sub { font-size: 14px; color: #6b7280; margin-top: 10px; }

  h1.pdf-ciclo {
    font-size: 25px; font-weight: 800; color: #fff; background: #5B2BCB;
    margin: 0 -32px 32px; padding: 22px 32px; page-break-before: always;
  }
  h1.pdf-ciclo.primeiro { page-break-before: avoid; margin-top: 44px; }

  h2.pdf-etapa {
    font-size: 20px; font-weight: 700; color: #5B2BCB;
    margin: 44px 0 4px; padding-bottom: 10px; border-bottom: 2px solid #ece3fd;
  }

  h3.pdf-materia {
    font-size: 15px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em;
    color: #6b7280; margin: 30px 0 4px;
  }

  .pdf-aula {
    margin: 22px 0; padding: 22px 24px; border: 1px solid #e7e5ef; border-radius: 14px;
    background: #fff; box-shadow: 0 1px 3px rgba(30,27,46,0.06);
  }
  h4.pdf-aula-titulo { font-size: 17px; font-weight: 700; color: #1a1a2e; margin: 0 0 18px; }

  .pdf-secao {
    border-left: 4px solid #ccc; background: #fafafa; border-radius: 0 10px 10px 0;
    padding: 14px 18px; margin: 16px 0; page-break-inside: avoid;
  }
  .pdf-secao:first-of-type { margin-top: 0; }
  .pdf-secao:last-child { margin-bottom: 0; }

  .pdf-rotulo {
    font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em;
    margin: 0 0 10px;
  }
  .pdf-secao p { margin: 8px 0; }
  .pdf-secao p:first-of-type { margin-top: 0; }
  .pdf-secao p:last-child { margin-bottom: 0; }
  .pdf-destaque { font-size: 16px; font-weight: 700; }

  .pdf-sub { color: #6b7280; font-size: 13px; }
  .pdf-obs { background: #eef2ff; padding: 10px 14px; border-radius: 8px; }
  .pdf-vazio { color: #9ca3af; font-style: italic; margin: 0; }
  .pdf-certo { color: #16A34A; }

  .pdf-secao ul { margin: 10px 0; padding: 0 0 0 20px; }
  .pdf-secao li { margin: 6px 0; }
  .pdf-opcoes { list-style: none; margin: 10px 0; padding: 0; }
  .pdf-opcoes li { padding: 6px 10px; border-radius: 6px; }
  .pdf-opcoes li.pdf-certo { background: #eafaf0; font-weight: 700; }

  .pdf-licao-corpo p { text-align: justify; margin: 8px 0; }

  .pdf-ico { display: inline-grid; place-items: center; width: 34px; height: 34px; border-radius: 10px; flex-shrink: 0; vertical-align: middle; overflow: hidden; }
  .pdf-ico svg { width: 22px; height: 22px; }
  .pdf-ico img { width: 60%; height: 60%; object-fit: contain; }
  .pdf-linha-icone { display: flex; align-items: center; gap: 10px; margin: 0 0 8px; }
  .pdf-linha-icone p { margin: 0 !important; }
  .pdf-itens { margin: 10px 0; }
  .pdf-item-icone { display: flex; align-items: center; gap: 10px; margin: 8px 0; }
  .pdf-item-icone > span:not(.pdf-ico) { flex: 1; min-width: 0; }
  .pdf-img { display: block; max-width: 100%; max-height: 420px; border-radius: 10px; margin: 8px 0; }
  .pdf-fb { margin: 6px 0; padding: 8px 12px; border-radius: 8px; font-size: 13px; }
  .pdf-fb-ok { background: #eafaf0; color: #15803d; }
  .pdf-fb-erro { background: #fef2f2; color: #b91c1c; }
  .pdf-mapa { margin: 10px 0; text-align: center; page-break-inside: avoid; }
  .pdf-mapa-svg { width: 100%; height: auto; }
  .pdf-timeline { margin: 10px 0; border-left: 3px solid #ece3fd; padding-left: 4px; }
  .pdf-ev { position: relative; padding: 4px 0 10px 18px; page-break-inside: avoid; }
  .pdf-ev-ponto { position: absolute; left: -11px; top: 9px; width: 16px; height: 16px; border-radius: 50%; border: 3px solid #fff; }
  .pdf-ev p { margin: 3px 0 !important; }
  .pdf-ev-ano { display: inline-block; color: #fff; font-size: 12px; font-weight: 700; padding: 2px 9px; border-radius: 999px; margin-right: 8px; }

  .pdf-tabela { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 13px; }
  .pdf-tabela th, .pdf-tabela td { border: 1px solid #e7e5ef; padding: 6px 8px; text-align: left; }
  .pdf-tabela th { background: #f5f3fb; font-weight: 700; }

  @media print {
    body { padding: 24px 28px 40px; }
    .pdf-aula { box-shadow: none; }
    h1.pdf-ciclo { margin: 0 -28px 32px; }
  }
</style>
</head>
<body>
<div class="pdf-capa">
  <div class="pdf-capa-titulo">${tituloCurso}</div>
  <div class="pdf-capa-sub">Conteúdo completo do curso</div>
</div>
${corpo}
</body>
</html>`;
}

/** Abre o documento de estudo (todo o conteúdo do curso) numa aba nova e chama a
 * caixa de impressão do navegador — a usuária escolhe "Salvar como PDF" ali,
 * sem precisar de nenhuma biblioteca extra de geração de PDF. */
function exportarPdf() {
  const html = gerarHtmlEstudoPdf();
  const janela = window.open('', '_blank');
  if (!janela) {
    window.alert('Não foi possível abrir a janela de impressão — verifique se o navegador está bloqueando pop-ups.');
    return;
  }
  janela.document.write(html);
  janela.document.close();
  janela.focus();
  janela.onload = () => janela.print();
}
