const Nfce = require('./nfce/nfce.js')
const fs = require('fs')
const path = require('path')
const html_to_pdf = require('html-pdf-node')
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib')

async function createPDF() {
  try {
    const xmlPath = './nfce/arquivoNfce.xml' // ALTERADO AQUI
    const xmlContent = fs.readFileSync(xmlPath, 'utf8')

    console.log('Gerando dados da NFC-e e HTML (sem QR Code)...')
    const instance = Nfce.NfcefromXML(xmlContent)
    const data = await instance.getData()
    const html = await instance.toHtml(path.join(__dirname, './nfce/nfce.hbs'))

    if (!html) {
      throw new Error("O HTML da NFC-e não foi gerado. Verifique o XML ou o template.");
    }

    console.log('Convertendo HTML para PDF com html-pdf-node...')
    let file = { content: html };
    let options = {
      format: 'A5',
      printBackground: true,
      margin: {
        top: '1mm',
        right: '10mm',
        bottom: '1mm',
        left: '10mm'
      },
      base: `file://${path.resolve(__dirname, './nfce/')}/`
    };
    const pdfBufferBase = await html_to_pdf.generatePdf(file, options);

    console.log('Adicionando QR Code ao PDF...')
    const pdfDoc = await PDFDocument.load(pdfBufferBase)
    const pages = pdfDoc.getPages()
    const targetPage = pages[pages.length - 2] // ALTERADO AQUI: Sempre a primeira página

    if (data && data._qrCodeBase64) {
      const qrCodeImageBytes = Buffer.from(data._qrCodeBase64.split(',')[1], 'base64');
      const qrCodeImage = await pdfDoc.embedPng(qrCodeImageBytes);

      const qrCodeSize = 90;
      const pageHeight = targetPage.getHeight();
      const pageWidth = targetPage.getWidth();

      const margin_bottom_points = 20 * 72 / 25.4; // 20mm da base

      const x = (pageWidth / 2) - (qrCodeSize / 2);
      const y = margin_bottom_points;

      targetPage.drawImage(qrCodeImage, {
        x: x,
        y: y,
        width: qrCodeSize,
        height: qrCodeSize,
      });
    } else {
      console.warn('QR Code Base64 não encontrado nos dados. O QR Code não será adicionado ao PDF.');
    }

    const pdfBytesFinal = await pdfDoc.save()
    fs.writeFileSync('nfce.pdf', pdfBytesFinal)
    console.log('Sucesso! nfce.pdf criado com QR Code inserido.')

  } catch (err) {
    console.error('Erro:', err.message)
    console.error(err.stack)
  }
}

createPDF()
