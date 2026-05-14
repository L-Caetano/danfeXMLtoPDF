const handlebars = require('handlebars')
const NFe = require('djf-nfe')
const fs = require('fs')
const path = require('path')
const QRCode = require('qrcode')

const cssPath = path.join(__dirname, './nfce.css')
const TEMPLATE_DANFE = path.join(__dirname, 'nfce.hbs')

function mascaraCPF(valor) {
  if (!valor) return ''
  const limpo = valor.toString().replace(/\D/g, '')
  return limpo.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
}

function mascaraCNPJ(valor) {
  if (!valor) return ''
  const limpo = valor.toString().replace(/\D/g, '')
  return limpo.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
}

function formataInscricaoNacional(numero) {
  if (!numero) return ''
  const limpo = numero.toString().replace(/\D/g, '')
  if (limpo.length === 11) return mascaraCPF(limpo)
  if (limpo.length === 14) return mascaraCNPJ(limpo)
  return numero
}

function formataData(dt) {
  if (!dt) return ''
  const data = new Date(dt)
  if (isNaN(data.getTime())) return dt
  return data.toLocaleDateString('pt-BR')
}

function formataHora(dt) {
  if (!dt) return ''
  const data = new Date(dt)
  if (isNaN(data.getTime())) return ''
  return data.toLocaleTimeString('pt-BR')
}

function formataMoeda(numero, decimais = 2) {
  if (numero === undefined || numero === null) return '0,00'
  return parseFloat(numero).toLocaleString('pt-BR', {
    minimumFractionDigits: decimais,
    maximumFractionDigits: decimais
  })
}

function formataCEP(cep) {
  if (!cep) return ''
  const limpo = cep.toString().replace(/\D/g, '')
  if (limpo.length !== 8) return cep
  return `${limpo.substring(0, 5)}-${limpo.substring(5)}`
}

function formataTelefone(tel) {
  if (!tel) return ''
  const digits = tel.toString().replace(/\D/g, '')
  if (digits.length < 10) return tel
  const ddd = digits.substring(0, 2)
  const num = digits.substring(2)
  const formatado = num.length === 8
    ? `${num.substring(0, 4)}-${num.substring(4)}`
    : `${num.substring(0, 5)}-${num.substring(5)}`
  return `(${ddd}) ${formatado}`
}

function dadosEntidade(entidade) {
  if (!entidade) return {}
  return {
    nome: entidade.nome(),
    fantasia: entidade.fantasia ? entidade.fantasia() : '',
    ie: entidade.inscricaoEstadual(),
    inscricao_nacional: formataInscricaoNacional(entidade.inscricaoNacional()),
    cnpj: formataInscricaoNacional(entidade.inscricaoNacional()),
    telefone: entidade.telefone ? entidade.telefone() : ''
  }
}

function extrairItens(nfe) {
  const itensArray = []
  const nrItens = nfe.nrItens ? nfe.nrItens() : 0
  for (let i = 1; i <= nrItens; i++) {
    const row = nfe.item(i)
    itensArray.push({
      codigo: row.codigo(),
      descricao: row.descricao(),
      qtd: formataMoeda(row.quantidadeComercial(), 2),
      un: row.unidadeComercial(),
      valor_unit: formataMoeda(row.valorUnitario(), 2),
      valor_total: formataMoeda(row.valorProdutos(), 2)
    })
  }
  return itensArray
}

function extrairTributosDoCpl(infCpl) {
  if (!infCpl) return ''
  try {
    const federal = infCpl.match(/R\$\s*([\d.,]+)\s*Federal/i)
    const estadual = infCpl.match(/R\$\s*([\d.,]+)\s*Estadual/i)
    if (federal && estadual) {
      const vFed = parseFloat(federal[1].replace(/\./g, '').replace(',', '.'))
      const vEst = parseFloat(estadual[1].replace(/\./g, '').replace(',', '.'))
      if (!isNaN(vFed) && !isNaN(vEst)) return formataMoeda(vFed + vEst)
    }
    const unico = infCpl.match(/Trib\s+aprox\s+R\$\s*([\d.,]+)/i)
    if (unico) {
      const v = parseFloat(unico[1].replace(/\./g, '').replace(',', '.'))
      if (!isNaN(v)) return formataMoeda(v)
    }
  } catch (e) { }
  return ''
}

function extrairVTotTrib(nfe, xmlBruto, infCplBruto) {
  try {
    const vTrib = nfe.total().valorTributos
      ? nfe.total().valorTributos()
      : null
    if (vTrib !== null && parseFloat(vTrib) > 0) return formataMoeda(vTrib)
  } catch (e) { }

  try {
    const match = (xmlBruto || '').match(/<vTotTrib>([\d.]+)<\/vTotTrib>/)
    if (match) return formataMoeda(parseFloat(match[1]))
  } catch (e) { }

  return extrairTributosDoCpl(infCplBruto)
}

function extrairPagamentosDoXml(xmlBruto) {
  const formasPagamento = {
    '01': 'Dinheiro',
    '02': 'Cheque',
    '03': 'Cartão de Crédito',
    '04': 'Cartão de Débito',
    '05': 'Crédito Loja',
    '10': 'Vale Alimentação',
    '11': 'Vale Refeição',
    '12': 'Vale Presente',
    '13': 'Vale Combustível',
    '15': 'Boleto Bancário',
    '16': 'Depósito Bancário',
    '17': 'Pix',
    '18': 'Transferência Bancária',
    '19': 'Cashback',
    '90': 'Sem pagamento',
    '99': 'Outros'
  }

  const resultado = []
  try {
    const detPags = xmlBruto.match(/<detPag>([\s\S]*?)<\/detPag>/g) || []
    for (const bloco of detPags) {
      const tPagMatch = bloco.match(/<tPag>(\d+)<\/tPag>/)
      const vPagMatch = bloco.match(/<vPag>([\d.]+)<\/vPag>/)
      if (tPagMatch && vPagMatch) {
        const tPag = tPagMatch[1].padStart(2, '0')
        resultado.push({
          forma: formasPagamento[tPag] || 'Outros',
          valor: formataMoeda(parseFloat(vPagMatch[1]))
        })
      }
    }
  } catch (e) { }
  return resultado
}

function limpaInfoComplementares(texto) {
  if (!texto) return ''
  return texto
    .replace(/;?\s*AGRADECEMOS\s+A\s+PREFER[EÊ]NCIA\s*!?/gi, '')
    .replace(/;{2,}/g, ';')
    .replace(/;\s*$/, '')
    .replace(/^[\s,;]+/, '')
    .trim()
}


async function getTemplateNfceData(nfe, xmlBruto = '') {
  if (!nfe) return null

  const itensMapeados = extrairItens(nfe)
  const emit = nfe.emitente()

  // Extração segura dos dados do endereço do emitente
  let emitenteEndereco = {
    logradouro: '',
    numero: '',
    bairro: '',
    cep: '',
    municipio: '',
    uf: '',
    telefone: ''
  };

  if (emit && emit.endereco) {
    const end = emit.endereco();
    if (end) {
      emitenteEndereco.logradouro = end.logradouro ? end.logradouro() : '';
      emitenteEndereco.numero = end.numero ? end.numero() : '';
      emitenteEndereco.bairro = end.bairro ? end.bairro() : '';
      emitenteEndereco.cep = end.cep ? formataCEP(end.cep()) : '';
      emitenteEndereco.municipio = end.municipio ? end.municipio() : '';
      emitenteEndereco.uf = end.uf ? end.uf() : '';
      emitenteEndereco.telefone = formataTelefone(
        end.telefone ? end.telefone() : (emit.telefone ? emit.telefone() : '')
      );
    }
  }

  const formasPagamento = {
    '01': 'Dinheiro',
    '02': 'Cheque',
    '03': 'Cartão de Crédito',
    '04': 'Cartão de Débito',
    '05': 'Crédito Loja',
    '10': 'Vale Alimentação',
    '11': 'Vale Refeição',
    '12': 'Vale Presente',
    '13': 'Vale Combustível',
    '15': 'Boleto Bancário',
    '16': 'Depósito Bancário',
    '17': 'Pix',
    '18': 'Transferência Bancária',
    '19': 'Cashback',
    '90': 'Sem pagamento',
    '99': 'Outros'
  }

  // Gera QR Code em base64 (PNG)
  let qrCodeBase64 = ''
  let qrUrl = ''
  try {
    // Tenta obter a URL do QR Code da biblioteca djf-nfe
    qrUrl = nfe.qrCode ? nfe.qrCode() : '';

    // Se a URL ainda estiver vazia, tenta extrair do XML bruto
    if (!qrUrl && xmlBruto) {
      const qrCodeMatch = xmlBruto.match(/<qrCode>(.*?)<\/qrCode>/);
      if (qrCodeMatch && qrCodeMatch[1]) {
        qrUrl = qrCodeMatch[1];
      }
    }

    console.log('URL do QR Code:', qrUrl); // Adicione esta linha para depuração
    if (qrUrl) {
      qrCodeBase64 = await QRCode.toDataURL(qrUrl, {
        errorCorrectionLevel: 'M',
        margin: 1,
        width: 150 // Tamanho em pixels para o PNG
      });
      console.log('QR Code Base64 gerado (primeiros 50 caracteres):', qrCodeBase64.substring(0, 50)); // Adicione esta linha
    } else {
      console.warn('URL do QR Code está vazia, não será possível gerar o QR Code.'); // Adicione esta linha
    }
  } catch (err) {
    console.error('Erro ao gerar QR Code:', err.message);
  }

  const infCplBruto = nfe.informacoesComplementares
    ? nfe.informacoesComplementares()
    : ''

  let pagamentosMapeados = []
  try {
    const pags = nfe.pagamentos ? nfe.pagamentos() : []
    if (pags && pags.length > 0) {
      pagamentosMapeados = pags.map(p => {
        let tPag = '99'
        let valor = '0,00'
        try {
          const rawTpag = typeof p.tPag === 'function' ? p.tPag() : p.tPag
          tPag = (rawTpag || '99').toString().padStart(2, '0')
        } catch (e) { }
        try {
          const rawValor = typeof p.vPag === 'function'
            ? p.vPag()
            : (typeof p.valor === 'function' ? p.valor() : (p.vPag || p.valor || 0))
          valor = formataMoeda(rawValor)
        } catch (e) { }
        return {
          forma: formasPagamento[tPag] || 'Outros',
          valor
        }
      })
    }
  } catch (e) {
    console.error('Erro ao mapear pagamentos via lib:', e.message)
  }

  if (!pagamentosMapeados.length) {
    pagamentosMapeados = extrairPagamentosDoXml(xmlBruto)
  }

  return {
    emitente: {
      ...dadosEntidade(emit),
      ...emitenteEndereco // Adiciona os dados do endereço extraídos de forma segura
    },

    valor_total_tributos: extrairVTotTrib(nfe, xmlBruto, infCplBruto),
    url_consulta_qrcode: nfe.urlConsultaQrCode ? nfe.urlConsultaQrCode() : '',

    itens: itensMapeados,
    qtd_total_itens: itensMapeados.length,
    valor_total_produtos: formataMoeda(nfe.total().valorProdutos()),
    valor_total_nota: formataMoeda(nfe.total().valorNota()),
    total_desconto: formataMoeda(
      nfe.total().valorDesconto ? nfe.total().valorDesconto() : 0
    ),
    total_frete: formataMoeda(
      nfe.total().valorFrete ? nfe.total().valorFrete() : 0
    ),

    pagamentos: pagamentosMapeados,

    destinatario:
      nfe.destinatario() && nfe.destinatario().inscricaoNacional()
        ? {
          nome: nfe.destinatario().nome(),
          identificacao: formataInscricaoNacional(
            nfe.destinatario().inscricaoNacional()
          )
        }
        : { nome: 'Consumidor não identificado' },

    chave: nfe.chave().replace(/\s/g, '').match(/.{1,4}/g).join(' '),
    numero: nfe.nrNota(),
    serie: nfe.serie().toString().padStart(3, '0'),
    protocolo: nfe.protocolo(),
    data_emissao:
      formataData(nfe.dataEmissao()) + ' ' + formataHora(nfe.dataEmissao()),
    data_protocolo:
      formataData(nfe.dataHoraRecebimento()) +
      ' ' +
      formataHora(nfe.dataHoraRecebimento()),

    informacoes_complementares: limpaInfoComplementares(infCplBruto),

    _qrCodeBase64: qrCodeBase64 // Retorna o QR Code Base64 em uma propriedade específica
  }
}


async function renderHtml(data, logo = '', customTemplate) {
  if (!data) return ''
  const pathToTemplate =
    customTemplate && fs.existsSync(customTemplate)
      ? customTemplate
      : TEMPLATE_DANFE

  const template = fs.readFileSync(pathToTemplate, 'utf8')
  const css = fs.readFileSync(cssPath, 'utf8')
  // Passa 'data' sem a propriedade _qrCodeBase64 para o template HTML
  const dataForHtml = { ...data }
  delete dataForHtml._qrCodeBase64
  return handlebars.compile(template)({
    ...dataForHtml,
    css,
    emitente: { ...data.emitente, logo }
  })
}

module.exports.NfcefromXML = function (xml, logo = '') {
  if (!xml) return { toHtml: async () => '', getData: async () => null }
  const nfe = NFe(xml)
  return {
    toHtml: async (customTemplate = null) => {
      const data = await getTemplateNfceData(nfe, xml)
      return renderHtml(data, logo, customTemplate)
    },
    getData: async () => { // Este método é crucial para o nfceGenerator
      return getTemplateNfceData(nfe, xml)
    }
  }
}

module.exports.fromFile = function (filePath, logo = '') {
  if (!filePath || !fs.existsSync(filePath))
    throw new Error('Arquivo não encontrado')
  const content = fs.readFileSync(filePath, 'utf8')
  return module.exports.NfcefromXML(content, logo)
}
