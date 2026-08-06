'use strict';

/**
 * CONFIG.JS — Identidade visual do projeto exportado: título, subtítulo,
 * ícone e cor de marca que aparecem no cabeçalho (tela inicial) e no tema
 * (theme-color, botões, trilha) do app gerado. Editado na aba "Mais".
 */

const CONFIG_APP = {
  titulo: 'Minhas Aulas',
  subtitulo: 'Gerado pelo Construtor de Aulas',
  tipoLogo: 'icone', // 'icone' | 'imagem'
  icone: 'capelo',
  imagemUrl: '',
  cor: '#5B2BCB',
};

const ICONES_APP = {
  capelo:   '<path d="M22 10v6M2 10l10-5 10 5-10 5z"></path><path d="M6 12v5c3 3 9 3 12 0v-5"></path>',
  livro:    '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>',
  estrela:  '<polygon points="12 2 15 8.5 22 9.5 17 14.5 18.5 21 12 17.5 5.5 21 7 14.5 2 9.5 9 8.5"></polygon>',
  lampada:  '<path d="M9 18h6"></path><path d="M10 22h4"></path><path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z"></path>',
  foguete:  '<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"></path><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"></path><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"></path><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"></path>',
  alvo:     '<circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle>',
  balanca:  '<path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"></path><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"></path><path d="M7 21h10"></path><path d="M12 3v18"></path><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"></path>',
  coracao:  '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z"></path>',
};

/* ---------------------------------------------------------------------- */
/* Matemática de cor — deriva a paleta inteira a partir de UMA cor         */
/* ---------------------------------------------------------------------- */

function hexParaRgb(hex) {
  const h = hex.replace('#', '');
  const cheio = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const n = parseInt(cheio, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbParaHex([r, g, b]) {
  return '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
}

function misturar(hexA, hexB, t) {
  const a = hexParaRgb(hexA), b = hexParaRgb(hexB);
  return rgbParaHex(a.map((v, i) => v + (b[i] - v) * t));
}

const escurecer = (hex, t) => misturar(hex, '#000000', t);
const clarear   = (hex, t) => misturar(hex, '#ffffff', t);

function gerarPaletaCss(corBase) {
  return {
    '--cor-primaria':        corBase,
    '--cor-primaria-rgb':    hexParaRgb(corBase).join(','),
    '--cor-primaria-escura': escurecer(corBase, 0.18),
    '--cor-gradiente-1':     clarear(corBase, 0.12),
    '--cor-gradiente-2':     escurecer(corBase, 0.10),
    '--cor-clara':           clarear(corBase, 0.90),
    '--cor-borda-clara':     clarear(corBase, 0.83),
    '--cor-borda-media':     clarear(corBase, 0.72),
    '--cor-hover-fundo':     clarear(corBase, 0.95),
  };
}

/* ---------------------------------------------------------------------- */
/* UI                                                                       */
/* ---------------------------------------------------------------------- */

function escaparHtmlConfig(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** true = deve usar a imagem por link (modo escolhido E link preenchido). */
function logoUsaImagem() {
  return CONFIG_APP.tipoLogo === 'imagem' && !!CONFIG_APP.imagemUrl.trim();
}

function logoHtmlInterno() {
  if (logoUsaImagem()) {
    return `<img src="${escaparHtmlConfig(CONFIG_APP.imagemUrl.trim())}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:inherit">`;
  }
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" width="22" height="22">${ICONES_APP[CONFIG_APP.icone] || ICONES_APP.capelo}</svg>`;
}

/** SVG do ícone atual, pronto pra virar favicon (fundo colorido + ícone branco). */
function iconeComoFaviconSvg() {
  const cor = CONFIG_APP.cor;
  const caminho = ICONES_APP[CONFIG_APP.icone] || ICONES_APP.capelo;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" rx="6" fill="${cor}"/><g fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${caminho}</g></svg>`;
}

/** href pronto pra <link rel="icon" href="..."> — imagem externa ou SVG embutido como data URI. */
function gerarFaviconHref() {
  if (logoUsaImagem()) return CONFIG_APP.imagemUrl.trim();
  return 'data:image/svg+xml,' + encodeURIComponent(iconeComoFaviconSvg());
}

/* ---------------------------------------------------------------------- */
/* Ícones do PWA exportado (manifest.json) — mesma cor/ícone escolhidos    */
/* aqui na aba Layout, rasterizados em PNG de verdade (canvas), já que o   */
/* manifest não aceita SVG em todo navegador/Android de forma confiável.   */
/* ---------------------------------------------------------------------- */

/** SVG quadrado (fundo colorido arredondado + ícone branco centralizado) em qualquer tamanho, pro manifest do app exportado. */
function iconeAppExportadoSvg(tamanho) {
  const cor = CONFIG_APP.cor;
  const caminho = ICONES_APP[CONFIG_APP.icone] || ICONES_APP.capelo;
  const raio = Math.round(tamanho * 0.22);
  const escala = (tamanho * 0.5) / 24;
  const offset = tamanho * 0.25;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${tamanho} ${tamanho}">
    <rect width="${tamanho}" height="${tamanho}" rx="${raio}" fill="${cor}"/>
    <g transform="translate(${offset} ${offset}) scale(${escala})" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${caminho}</g>
  </svg>`;
}

/** Rasteriza uma string SVG em PNG (bytes) via <canvas> — só conteúdo gerado localmente, sem CORS envolvido. */
function svgParaPngBytes(svgString, tamanho) {
  return new Promise((resolve, reject) => {
    const blob = new Blob([svgString], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      canvas.width = tamanho;
      canvas.height = tamanho;
      canvas.getContext('2d').drawImage(img, 0, 0, tamanho, tamanho);
      canvas.toBlob(blobPng => {
        if (!blobPng) return reject(new Error('Falha ao gerar PNG do ícone'));
        blobPng.arrayBuffer().then(buf => resolve(new Uint8Array(buf)));
      }, 'image/png');
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Falha ao carregar SVG do ícone')); };
    img.src = url;
  });
}

/** Tenta baixar e recortar (quadrado, centralizado) a imagem externa escolhida, em PNG. Se o servidor não liberar
 * CORS o canvas fica "tainted" e isso falha — quem chama trata o erro caindo pra referenciar a URL direto. */
function imagemExternaParaPngBytes(urlImagem, tamanho) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const lado = Math.min(img.naturalWidth, img.naturalHeight);
        const sx = (img.naturalWidth - lado) / 2;
        const sy = (img.naturalHeight - lado) / 2;
        const canvas = document.createElement('canvas');
        canvas.width = tamanho;
        canvas.height = tamanho;
        canvas.getContext('2d').drawImage(img, sx, sy, lado, lado, 0, 0, tamanho, tamanho);
        canvas.toBlob(blobPng => {
          if (!blobPng) return reject(new Error('Falha ao gerar PNG da imagem'));
          blobPng.arrayBuffer().then(buf => resolve(new Uint8Array(buf)));
        }, 'image/png');
      } catch (e) { reject(e); }
    };
    img.onerror = () => reject(new Error('Falha ao carregar a imagem externa'));
    img.src = urlImagem;
  });
}

/**
 * Gera os ícones do manifest.json do app exportado, no mesmo ícone/cor
 * escolhidos na aba Layout. Retorna { icones, arquivosBinarios } — icones é
 * o array pronto pro campo "icons" do manifest, arquivosBinarios são os
 * .png (se algum) que precisam entrar no zip exportado.
 */
async function gerarIconesPwaExport() {
  const TAMANHOS = [192, 512];
  const arquivosBinarios = {};

  if (logoUsaImagem()) {
    const url = CONFIG_APP.imagemUrl.trim();
    try {
      for (const t of TAMANHOS) {
        arquivosBinarios[`icons/icon-${t}.png`] = await imagemExternaParaPngBytes(url, t);
      }
      return {
        icones: TAMANHOS.map(t => ({ src: `icons/icon-${t}.png`, sizes: `${t}x${t}`, type: 'image/png' })),
        arquivosBinarios,
      };
    } catch (e) {
      // CORS bloqueou o recorte via canvas — o manifest referencia a URL direto (o navegador busca por conta própria).
      return { icones: [{ src: url, sizes: 'any' }], arquivosBinarios: {} };
    }
  }

  for (const t of TAMANHOS) {
    arquivosBinarios[`icons/icon-${t}.png`] = await svgParaPngBytes(iconeAppExportadoSvg(t), t);
  }
  return {
    icones: [
      { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    arquivosBinarios,
  };
}

/** Ícone (ICONES_APP) ou ICONES_AULA/padrão — usado nos aula-node da prévia. */
function iconeAulaPreview(iconeAula) {
  const ICONES_AULA_PREVIEW = {
    busca: '<circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line>',
    pessoa: '<circle cx="12" cy="8" r="4"></circle><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"></path>',
    padrao: '<path d="M12 2l2.4 7.2H22l-6 4.6 2.3 7.2-6.3-4.5-6.3 4.5 2.3-7.2-6-4.6h7.6z"></path>',
  };
  return ICONES_AULA_PREVIEW[iconeAula] || ICONES_AULA_PREVIEW.padrao;
}

function renderPreviewConfig() {
  const preview = document.getElementById('previewPagina');
  if (!preview) return;
  const paleta = gerarPaletaCss(CONFIG_APP.cor);
  Object.entries(paleta).forEach(([k, v]) => preview.style.setProperty(k, v));

  preview.querySelector('.pv-logo').innerHTML = logoHtmlInterno();
  preview.querySelector('.pv-titulo').textContent = CONFIG_APP.titulo || 'Minhas Aulas';
  preview.querySelector('.pv-subtitulo').textContent = CONFIG_APP.subtitulo || '';

  // Puxa o primeiro ciclo/matéria de verdade (CICLOS, js/data.js) pra prévia
  // mostrar o app com o conteúdo real, não um mockup genérico.
  const listaAulasPv = preview.querySelector('.pg-aulas');
  const primeiraMateria = (CICLOS || []).flatMap(c => c.materias.map(m => ({ ciclo: c, materia: m }))).find(x => x.materia.aulas.length > 0);

  if (!primeiraMateria) {
    preview.querySelector('.pg-hero-materia').textContent = '';
    preview.querySelector('.pg-hero-titulo').textContent = 'Nenhuma aula criada ainda';
    preview.querySelector('.pg-hero-segmentos').innerHTML = '';
    listaAulasPv.innerHTML = '<p class="pp-vazio">Crie ciclos/matérias/aulas na aba Estrutura pra ver a prévia com conteúdo real.</p>';
    return;
  }

  const { ciclo, materia } = primeiraMateria;
  preview.querySelector('.pg-hero-materia').textContent = materia.titulo;
  preview.querySelector('.pg-hero-titulo').textContent = `${ciclo.titulo} — ${materia.titulo}`;
  preview.querySelector('.pg-hero-segmentos').innerHTML = materia.aulas.map(() => `<div class="pg-segmento"></div>`).join('');

  listaAulasPv.innerHTML = materia.aulas.slice(0, 2).map((aula, i) => `
    <div class="pg-aula-node ${i > 0 ? 'bloqueada' : ''}">
      <div class="pg-icone-circulo ${i === 0 ? 'ativo' : 'bloqueado'}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${i === 0 ? iconeAulaPreview() : '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path>'}</svg>
      </div>
      <div class="pg-aula-card ${i > 0 ? 'bloqueada' : ''}">
        <p class="pg-aula-titulo">${escaparHtmlConfig(aula.titulo)}</p>
        <p class="pg-aula-status">${i === 0 ? 'Não iniciada' : 'Bloqueada'}</p>
        <div class="pg-aula-botao ${i > 0 ? 'bloqueada' : ''}">${i === 0 ? 'Começar' : '🔒 Bloqueada'}</div>
      </div>
    </div>`).join('');
}

function renderIconesConfig() {
  const grid = document.getElementById('gradeIcones');
  grid.innerHTML = '';
  Object.keys(ICONES_APP).forEach(nome => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'icone-opcao' + (nome === CONFIG_APP.icone ? ' selecionado' : '');
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${ICONES_APP[nome]}</svg>`;
    btn.title = nome;
    btn.addEventListener('click', () => {
      CONFIG_APP.icone = nome;
      grid.querySelectorAll('.icone-opcao').forEach(b => b.classList.remove('selecionado'));
      btn.classList.add('selecionado');
      renderPreviewConfig();
    });
    grid.appendChild(btn);
  });
}

function atualizarVisibilidadeLogo() {
  document.getElementById('gradeIcones').style.display = CONFIG_APP.tipoLogo === 'icone' ? 'grid' : 'none';
  document.getElementById('campoImagemUrl').style.display = CONFIG_APP.tipoLogo === 'imagem' ? 'block' : 'none';
}

function inicializarConfig() {
  const campoTitulo = document.getElementById('configTitulo');
  const campoSubtitulo = document.getElementById('configSubtitulo');
  const campoCor = document.getElementById('configCor');
  const campoCorTexto = document.getElementById('configCorTexto');
  const campoImagemUrl = document.getElementById('configImagemUrl');
  const toggleTipoLogo = document.getElementById('tipoLogoToggle');

  campoTitulo.value = CONFIG_APP.titulo;
  campoSubtitulo.value = CONFIG_APP.subtitulo;
  campoCor.value = CONFIG_APP.cor;
  campoCorTexto.value = CONFIG_APP.cor;
  campoImagemUrl.value = CONFIG_APP.imagemUrl;

  toggleTipoLogo.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      CONFIG_APP.tipoLogo = btn.dataset.tipo;
      toggleTipoLogo.querySelectorAll('button').forEach(b => b.classList.toggle('ativo', b === btn));
      atualizarVisibilidadeLogo();
      renderPreviewConfig();
    });
  });
  campoImagemUrl.addEventListener('input', () => { CONFIG_APP.imagemUrl = campoImagemUrl.value; renderPreviewConfig(); });

  campoTitulo.addEventListener('input', () => { CONFIG_APP.titulo = campoTitulo.value; renderPreviewConfig(); });
  campoSubtitulo.addEventListener('input', () => { CONFIG_APP.subtitulo = campoSubtitulo.value; renderPreviewConfig(); });
  campoCor.addEventListener('input', () => {
    CONFIG_APP.cor = campoCor.value;
    campoCorTexto.value = campoCor.value;
    renderPreviewConfig();
  });
  campoCorTexto.addEventListener('input', () => {
    if (/^#[0-9a-fA-F]{6}$/.test(campoCorTexto.value)) {
      CONFIG_APP.cor = campoCorTexto.value;
      campoCor.value = campoCorTexto.value;
      renderPreviewConfig();
    }
  });

  renderIconesConfig();
  atualizarVisibilidadeLogo();
  renderPreviewConfig();
}
