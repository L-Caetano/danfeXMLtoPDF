const handlebars = require('handlebars')
const NFe = require('djf-nfe')
const fs = require('fs')
const path = require('path')
const QRCode = require('qrcode')

const TEMPLATE_DANFE = path.join(__dirname, 'template-danfe.hbs')

function mascaraCPF(valor) {
  if (!valor) return ''
  const limpo = valor.toString().replace(/\D/g, '')
  return limpo.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")
}

function mascaraCNPJ(valor) {
  if (!valor) return ''
  const limpo = valor.toString().replace(/\D/g, '')
  return limpo.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5")
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

function dadosEntidade(entidade) {
  if (!entidade) return {}
  return {
    nome: entidade.nome(),
    fantasia: entidade.fantasia ? entidade.fantasia() : '',
    ie: entidade.inscricaoEstadual(),
    inscricao_nacional: formataInscricaoNacional(entidade.inscricaoNacional()),
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

async function getTemplateNfceData(nfe) {
  if (!nfe) return null

  const itensMapeados = extrairItens(nfe)
  const emit = nfe.emitente()
  const end = emit.endereco()

  const formasPagamento = {
    '01': 'Dinheiro',
    '02': 'Cheque',
    '03': 'Cartão de Crédito',
    '04': 'Cartão de Débito',
    '15': 'Boleto Bancário',
    '90': 'Sem pagamento',
    '99': 'Outros'
  }

  let qrCodeBase64 = ''
  if (nfe.qrCode && nfe.qrCode()) {
    try {
      qrCodeBase64 = await QRCode.toDataURL(nfe.qrCode())
    } catch (err) {
      qrCodeBase64 = ''
    }
  }

  return {
    emitente: {
      ...dadosEntidade(emit),
      logradouro: end.logradouro(),
      numero: end.numero(),
      bairro: end.bairro(),
      cep: end.cep().replace(/^(\d{5})(\d{3})$/, "$1-$2"),
      municipio: end.municipio(),
      uf: end.uf(),
      telefone: end.telefone() ? `(${end.telefone().substring(0, 2)}) ${end.telefone().substring(2)}` : '',
      endereco_completo: `${end.logradouro()}, ${end.numero()}, ${end.bairro()}. CEP:${end.cep().replace(/^(\d{5})(\d{3})$/, "$1-$2")}. ${end.municipio()}-${end.uf()}`
    },

    itens: itensMapeados,
    qtd_total_itens: itensMapeados.length,
    valor_total_produtos: formataMoeda(nfe.total().valorProdutos()),
    valor_total_nota: formataMoeda(nfe.total().valorNota()),
    total_desconto: formataMoeda(nfe.total().valorDesconto ? nfe.total().valorDesconto() : 0),
    total_frete: formataMoeda(nfe.total().valorFrete ? nfe.total().valorFrete() : 0),

    pagamentos: nfe.pagamentos ? nfe.pagamentos().map(p => ({
      forma: formasPagamento[p.tPag()] || p.descricao() || 'Outros',
      valor: formataMoeda(p.vPag ? p.vPag() : p.valor())
    })) : [],

    destinatario: nfe.destinatario() && nfe.destinatario().inscricaoNacional()
      ? {
        nome: nfe.destinatario().nome(),
        identificacao: formataInscricaoNacional(nfe.destinatario().inscricaoNacional())
      }
      : { nome: 'Consumidor não identificado' },

    chave: nfe.chave().replace(/\s/g, ''),
    numero: nfe.nrNota(),
    serie: nfe.serie().toString().padStart(3, '0'),
    protocolo: nfe.protocolo(),
    data_emissao: formataData(nfe.dataEmissao()) + ' ' + formataHora(nfe.dataEmissao()),
    data_protocolo: formataData(nfe.dataHoraRecebimento()) + ' ' + formataHora(nfe.dataHoraRecebimento()),
    informacoes_complementares: nfe.informacoesComplementares(),
    qrCode: qrCodeBase64
  }
}

async function renderHtml(data, logo = "", customTemplate) {
  if (!data) return ''
  const pathToTemplate = (customTemplate && fs.existsSync(customTemplate))
    ? customTemplate
    : TEMPLATE_DANFE

  const template = fs.readFileSync(pathToTemplate, 'utf8')
  return handlebars.compile(template)({ ...data, emitente: { ...data.emitente, logo } })
}

module.exports.NfcefromXML = function (xml, logo = "") {
  if (!xml) return { toHtml: async () => '' }
  const nfe = NFe(xml)
  return {
    toHtml: async (customTemplate = null) => {
      const data = await getTemplateNfceData(nfe)
      return renderHtml(data, logo, customTemplate)
    }
  }
}

module.exports.fromFile = function (filePath, logo = "") {
  if (!filePath || !fs.existsSync(filePath)) throw new Error('Arquivo não encontrado')
  const content = fs.readFileSync(filePath, 'utf8')
  return module.exports.NfcefromXML(content, logo)
}
