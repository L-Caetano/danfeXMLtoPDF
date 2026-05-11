const Danfe = require('./nfce/nfce.js');
const fs = require('fs');
const html_to_pdf = require('html-pdf-node');

async function createPDF() {
  try {
    const xmlPath = './nfce/arquivoNfce.xml';
    const xmlContent = fs.readFileSync(xmlPath, 'utf8');

    if (!xmlContent.includes('<protNFe')) {
      console.error("Error: Missing authorization protocol (<protNFe>).");
      return;
    }

    console.log('Generating HTML from XML...');
    const instance = Danfe.NfcefromXML(xmlContent);
    console.log(JSON.stringify(instance, null, 2));
    const html = await instance.toHtml('./nfce/nfce.hbs');

    console.log('Converting HTML to PDF...');

    let options = {
      format: 'A4',
      printBackground: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      margin: { top: 2, right: 3, bottom: 2, left: 3 },
      preferCSSPageSize: true
    };
    let file = { content: html };

    const pdfBuffer = await html_to_pdf.generatePdf(file, options);

    fs.writeFileSync('nfce.pdf', pdfBuffer);
    console.log('Success! danfe.pdf created.');

  } catch (err) {
    console.error('Error:', err.message);
  }
}

createPDF();
