const Dacte = require('./dacte/dacte.js');
const fs = require('fs');
const html_to_pdf = require('html-pdf-node');

async function createDactePDF() {
  try {
    const xmlPath = './dacte/dacte.xml'; // Ajustado para o nome do arquivo enviado

    if (!fs.existsSync(xmlPath)) {
      console.error(`Erro: Arquivo ${xmlPath} não encontrado.`);
      return;
    }

    console.log('Gerando HTML do DACTE...');
    const html = await Dacte.generateDacteHtml(xmlPath);

    let options = {
      format: 'A4',
      printBackground: true,
      margin: { top: '5mm', right: '5mm', bottom: '5mm', left: '5mm' }
    };

    console.log('Convertendo para PDF...');
    const pdfBuffer = await html_to_pdf.generatePdf({ content: html }, options);

    fs.writeFileSync('dacte_resultado.pdf', pdfBuffer);
    console.log('Sucesso! dacte_resultado.pdf criado.');

  } catch (err) {
    console.error('Erro na geração:', err);
  }
}

createDactePDF();
