const Dacte = require('./dacte/dacte.js');
const fs = require('fs');
const html_to_pdf = require('html-pdf-node');

async function createDactePDF() {
  try {
    const xmlPath = './dacte/dacte.xml';

    if (!fs.existsSync(xmlPath)) {
      console.error(`Erro: Arquivo ${xmlPath} não encontrado.`);
      return;
    }

    console.log('Gerando HTML do DACTE a partir do XML...');

    // Chamando a função que criamos para processar o XML do CTe
    const html = await Dacte.generateDacteHtml(xmlPath);

    console.log('Convertendo HTML para PDF (Padrão DACTE)...');

    let options = {
      format: 'A4',
      printBackground: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      margin: {
        top: 2,
        right: 3,
        bottom: 2,
        left: 3
      },
      preferCSSPageSize: true
    };

    let file = { content: html };

    const pdfBuffer = await html_to_pdf.generatePdf(file, options);

    fs.writeFileSync('dacte.pdf', pdfBuffer);
    console.log('Sucesso! dacte.pdf criado com êxito.');

  } catch (err) {
    console.error('Erro na geração do DACTE:', err.message);
  }
}

createDactePDF();
