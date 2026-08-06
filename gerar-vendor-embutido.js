'use strict';

/**
 * GERAR-VENDOR-EMBUTIDO.JS — Regenera js/vendor-embutido.js a partir dos
 * arquivos reais em vendor/estudo/. Rode isto (node gerar-vendor-embutido.js)
 * sempre que editar algo dentro de vendor/estudo/ — o export usa o conteúdo
 * embutido, não os arquivos originais direto (ver comentário em js/export.js
 * sobre por que não é fetch()).
 */
const fs = require('fs');
const path = require('path');

const raiz = __dirname;

const arquivos = {
  'index.html':       'vendor/estudo/index.html',
  'css/inicio.css':   'vendor/estudo/css/inicio.css',
  'js/inicio.mjs':    'vendor/estudo/js/inicio.mjs',
  'js/cadernos.mjs':  'vendor/estudo/js/cadernos.mjs',
  'js/niveis.mjs':    'vendor/estudo/js/niveis.mjs',
  'js/progresso.mjs': 'vendor/estudo/js/progresso.mjs',
  'estudo.html':      'vendor/estudo/estudo.html',
  'css/estudo.css':   'vendor/estudo/css/estudo.css',
  'js/estudo.mjs':    'vendor/estudo/js/estudo.mjs',
};

let saida = `'use strict';

/**
 * VENDOR-EMBUTIDO.JS — Conteúdo dos arquivos "motor" (tela inicial + tela de
 * estudo) embutido como texto, pra o export funcionar mesmo com index.html
 * aberto direto (file://), onde fetch() de arquivos locais é bloqueado pelo
 * navegador. Gerado a partir de vendor/estudo/ por gerar-vendor-embutido.js —
 * não editar à mão; se mudar algo em vendor/estudo/, rode esse script de novo.
 */
const VENDOR_ARQUIVOS = {
`;

for (const [destino, origem] of Object.entries(arquivos)) {
  const conteudo = fs.readFileSync(path.join(raiz, origem), 'utf8');
  saida += `  ${JSON.stringify(destino)}: ${JSON.stringify(conteudo)},\n`;
}

saida += `};\n`;

fs.writeFileSync(path.join(raiz, 'js', 'vendor-embutido.js'), saida, 'utf8');
console.log('Gerado js/vendor-embutido.js —', saida.length, 'bytes');
