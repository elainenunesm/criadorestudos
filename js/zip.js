'use strict';

/**
 * ZIP.JS — Gerador de arquivo .zip (método "stored", sem compressão).
 * Sem dependências externas — só o necessário pra empacotar o export do
 * Construtor de Aulas num único download.
 */
const CRC_TABLE = (() => {
  const tabela = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    tabela[n] = c >>> 0;
  }
  return tabela;
})();

function crc32(bytes) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function dosDataHora() {
  const d = new Date();
  const hora = ((d.getHours() & 0x1F) << 11) | ((d.getMinutes() & 0x3F) << 5) | ((d.getSeconds() >> 1) & 0x1F);
  const data = (((d.getFullYear() - 1980) & 0x7F) << 9) | (((d.getMonth() + 1) & 0xF) << 5) | (d.getDate() & 0x1F);
  return { hora, data };
}

/**
 * @param {Object<string,string|Uint8Array>} arquivos - caminho (com "/") -> conteúdo
 *   (texto, ou Uint8Array pra arquivos binários como os ícones .png gerados)
 * @returns {Blob}
 */
function criarZip(arquivos) {
  const encoder = new TextEncoder();
  const { hora, data } = dosDataHora();
  const partes = [];
  const centrais = [];
  let offset = 0;

  for (const caminho of Object.keys(arquivos)) {
    const nomeBytes = encoder.encode(caminho);
    const valor = arquivos[caminho];
    const dadoBytes = valor instanceof Uint8Array ? valor : encoder.encode(valor);
    const crc = crc32(dadoBytes);
    const tamanho = dadoBytes.length;

    const local = new Uint8Array(30 + nomeBytes.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0, true);
    lv.setUint16(8, 0, true);
    lv.setUint16(10, hora, true);
    lv.setUint16(12, data, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, tamanho, true);
    lv.setUint32(22, tamanho, true);
    lv.setUint16(26, nomeBytes.length, true);
    lv.setUint16(28, 0, true);
    local.set(nomeBytes, 30);

    partes.push(local, dadoBytes);

    const central = new Uint8Array(46 + nomeBytes.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, hora, true);
    cv.setUint16(14, data, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, tamanho, true);
    cv.setUint32(24, tamanho, true);
    cv.setUint16(28, nomeBytes.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, offset, true);
    central.set(nomeBytes, 46);

    centrais.push(central);

    offset += local.length + dadoBytes.length;
  }

  const tamanhoCentral = centrais.reduce((soma, p) => soma + p.length, 0);
  const fim = new Uint8Array(22);
  const fv = new DataView(fim.buffer);
  fv.setUint32(0, 0x06054b50, true);
  fv.setUint16(4, 0, true);
  fv.setUint16(6, 0, true);
  fv.setUint16(8, centrais.length, true);
  fv.setUint16(10, centrais.length, true);
  fv.setUint32(12, tamanhoCentral, true);
  fv.setUint32(16, offset, true);
  fv.setUint16(20, 0, true);

  return new Blob([...partes, ...centrais, fim], { type: 'application/zip' });
}
