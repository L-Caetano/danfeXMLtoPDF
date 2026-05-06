// Substitua o require antigo por este:
const Danfe = require('./danfe-simplificada/index.js');
const fs = require('fs');
const html_to_pdf = require('html-pdf-node');

async function createPDF() {
  try {
    const xmlPath = 'arquivo2.xml';
    const xmlContent = fs.readFileSync(xmlPath, 'utf8');

    if (!xmlContent.includes('<protNFe')) {
      console.error("Error: Missing authorization protocol (<protNFe>).");
      return;
    }

    console.log('Generating HTML from XML...');
    const instance = Danfe.fromXML(xmlContent);
    // Isso vai imprimir no seu terminal toda a estrutura que o template pode usar
    console.log(JSON.stringify(instance, null, 2));
    const html = instance.toHtml('./danfe-custom.hbs');

    console.log('Converting HTML to PDF...');

    let options = {
      format: 'A4',
      printBackground: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'] // Recommended for Linux/Omarchy
    }; let file = { content: html };

    const pdfBuffer = await html_to_pdf.generatePdf(file, options);

    fs.writeFileSync('danfe.pdf', pdfBuffer);
    console.log('Success! danfe.pdf created.');

  } catch (err) {
    console.error('Error:', err.message);
  }
}

createPDF();
