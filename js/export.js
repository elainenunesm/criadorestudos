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

/** Ordem final de exibição das telas, como tokens simples ('antesComecar', 'exemplo0', 'checagem1', 'lista0', 'timeline0', 'resumo', 'licao')
 * — reaproveita montarPassos() (js/conteudo.js) pra garantir que os índices batem exatamente com os arrays exportados abaixo. */
function serializarOrdem(conteudo) {
  return montarPassos(conteudo).map(p => (p.tipo === 'exemplo' || p.tipo === 'checagem' || p.tipo === 'lista' || p.tipo === 'timeline') ? `${p.tipo}${p.idx}` : p.tipo);
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
  if (item.texto) html += `<p>${renderFraseComDestaque(item.texto, item.textoDestaque, item.textoDestaqueNegrito)}</p>`;
  if (item.conclusao) html += `<p>${renderFraseComDestaque(item.conclusao, item.conclusaoDestaque, item.conclusaoDestaqueNegrito)}</p>`;
  if (item.obs) html += `<p class="pdf-obs">${renderFraseComDestaque(item.obs, item.obsDestaque, item.obsDestaqueNegrito)}</p>`;
  (item.pontos || []).forEach(p => { if (p.texto) html += `<p>• ${renderFraseComDestaque(p.texto, p.textoDestaque, p.textoDestaqueNegrito)}</p>`; });
  if (item.cardImagem) {
    const ci = item.cardImagem;
    if (ci.titulo) html += `<p><strong>${escaparHtml(ci.titulo)}</strong></p>`;
    if (ci.subtitulo) html += `<p>${escaparHtml(ci.subtitulo)}</p>`;
    if (ci.texto) html += `<p>${escaparHtml(ci.texto)}</p>`;
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
    if (ps.instrucao) html += `<p>${escaparHtml(ps.instrucao)}</p>`;
    if ((ps.sentenca || []).length) html += `<p>${pdfRenderSentencaComCorreta(ps.sentenca, ps.correta)}</p>`;
  }
  if (item.palavraSelecionavelMultipla) {
    const psm = item.palavraSelecionavelMultipla;
    if (psm.instrucao) html += `<p>${escaparHtml(psm.instrucao)}</p>`;
    if ((psm.sentenca || []).length) html += `<p>${pdfRenderSentencaComCorreta(psm.sentenca, psm.corretas || [])}</p>`;
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

function pdfRenderAula(aula) {
  const c = aula.conteudo || {};
  let secoes = '';

  const ac = c.antesComecar || {};
  if (ac.titulo || ac.descricao || ac.aprender || ac.importancia) {
    let corpo = '';
    if (ac.titulo) corpo += `<p class="pdf-destaque">${renderFraseComDestaque(ac.titulo, ac.tituloDestaque, ac.tituloDestaqueNegrito)}</p>`;
    if (ac.descricao) corpo += `<p>${renderFraseComDestaque(ac.descricao, ac.descricaoDestaque, ac.descricaoDestaqueNegrito)}</p>`;
    if (ac.aprender) corpo += `<p><em>O que você vai aprender:</em> ${renderFraseComDestaque(ac.aprender, ac.aprenderDestaque, ac.aprenderDestaqueNegrito)}</p>`;
    if (ac.importancia) corpo += `<p><em>Por que isso é importante:</em> ${renderFraseComDestaque(ac.importancia, ac.importanciaDestaque, ac.importanciaDestaqueNegrito)}</p>`;
    secoes += pdfSecao('Antes de começar', '#7B3FF2', corpo);
  }

  (c.exemplo || []).forEach((item, i) => {
    secoes += pdfSecao(`Exemplo ${i + 1}`, '#4A80F0', pdfRenderExemplo(item));
  });

  (c.checagem || []).forEach((item, i) => {
    secoes += pdfSecao(`Checagem ${i + 1}`, '#0D9488', pdfRenderChecagem(item));
  });

  const listas = (c.lista || []).filter(li => li.titulo || li.textoAntes || (li.itens || []).length || li.descricao);
  listas.forEach((li, i) => {
    let corpo = '';
    if (li.titulo) corpo += `<p class="pdf-destaque">${renderFraseComDestaque(li.titulo, li.tituloDestaque, li.tituloDestaqueNegrito)}</p>`;
    if (li.textoAntes) corpo += `<p>${renderFraseComDestaque(li.textoAntes, li.textoAntesDestaque, li.textoAntesDestaqueNegrito)}</p>`;
    if ((li.itens || []).length) corpo += '<ul>' + li.itens.map(it => `<li>${renderFraseComDestaque(it.texto || '', it.textoDestaque, it.textoDestaqueNegrito)}</li>`).join('') + '</ul>';
    if (li.descricao) corpo += `<p>${renderFraseComDestaque(li.descricao, li.descricaoDestaque, li.descricaoDestaqueNegrito)}</p>`;
    secoes += pdfSecao(`Lista${listas.length > 1 ? ` ${i + 1}` : ''}`, '#DB2777', corpo);
  });

  const res = c.resumo || {};
  if (res.titulo || (res.itens || []).length) {
    let corpo = '';
    if (res.titulo) corpo += `<p class="pdf-destaque">${renderFraseComDestaque(res.titulo, res.tituloDestaque, res.tituloDestaqueNegrito)}</p>`;
    if ((res.itens || []).length) corpo += '<ul>' + res.itens.map(it =>
      `<li><strong>${renderFraseComDestaque(it.titulo || '', it.tituloDestaque, it.tituloDestaqueNegrito)}</strong>${it.exemplos ? ' — ' + renderFraseComDestaque(it.exemplos, it.exemplosDestaque, it.exemplosDestaqueNegrito) : ''}</li>`
    ).join('') + '</ul>';
    secoes += pdfSecao('Resumo', '#F59E0B', corpo);
  }

  const lic = c.licao || {};
  if (lic.titulo || lic.html) {
    let corpo = '';
    if (lic.titulo) corpo += `<p class="pdf-destaque">${renderFraseComDestaque(lic.titulo, lic.tituloDestaque, lic.tituloDestaqueNegrito)}</p>`;
    if (lic.html) corpo += `<div class="pdf-licao-corpo">${lic.html}</div>`;
    secoes += pdfSecao('Lição', '#16A34A', corpo);
  }

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
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif;
    color: #1a1a2e; max-width: 760px; margin: 0 auto; padding: 56px 32px 80px;
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
    page-break-inside: avoid;
  }
  h4.pdf-aula-titulo { font-size: 17px; font-weight: 700; color: #1a1a2e; margin: 0 0 18px; }

  .pdf-secao {
    border-left: 4px solid #ccc; background: #fafafa; border-radius: 0 10px 10px 0;
    padding: 14px 18px; margin: 16px 0;
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

  @media print {
    body { padding: 24px 28px 40px; }
    .pdf-aula { page-break-inside: avoid; box-shadow: none; }
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
