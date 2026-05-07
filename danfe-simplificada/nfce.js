const handlebars = require('handlebars')
const NFe = require('djf-nfe')
const fs = require('fs')
const path = require('path')

const TEMPLATE_DANFE = path.join(__dirname, 'template-danfe.hbs')

/**
 * Funções de Máscara e Formatação
 */
function mascaraCPF(valor) {
  if (!valor) return ''
  return valor.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")
}

function mascaraCNPJ(valor) {
  if (!valor) return ''
  return valor.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5")
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

/**
 * Helpers para extração de dados do djf-nfe
 */
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

function dadosEndereco(end) {
  if (!end) return {}
  const enderecoObj = typeof end.logradouro === 'function' ? end : end.endereco()
  return {
    endereco: enderecoObj.logradouro() + ", " + enderecoObj.numero(),
    bairro: enderecoObj.bairro(),
    cep: enderecoObj.cep(),
    municipio: enderecoObj.municipio(),
    uf: enderecoObj.uf()
  }
}

/**
 * Processamento de Itens (Ajustado para evitar array vazio)
 */
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
      valor_total: formataMoeda(row.valorProdutos(), 2),
      // Campos adicionais para NFe (DANFE Clássico)
      ncm: row.ncm ? row.ncm() : '',
      cfop: row.cfop ? row.cfop() : '',
      icms: formataMoeda(row.valorIcms ? row.valorIcms() : 0)
    })
  }
  return itensArray
}

/**
 * Mapeamento de dados para NFC-e (Bobina Térmica)
 */
function getTemplateNfceData(nfe) {
  if (!nfe) return null

  const itensMapeados = extrairItens(nfe)

  return {
    emitente: Object.assign(dadosEntidade(nfe.emitente()), dadosEndereco(nfe.emitente())),

    itens: itensMapeados,
    qtd_total_itens: itensMapeados.length,
    valor_total_produtos: formataMoeda(nfe.total().valorProdutos()),
    valor_total_nota: formataMoeda(nfe.total().valorNota()),
    total_desconto: formataMoeda(nfe.total().valorDesconto ? nfe.total().valorDesconto() : 0),
    valor_frete: formataMoeda(nfe.total().valorFrete ? nfe.total().valorFrete() : 0),

    pagamentos: nfe.pagamentos ? nfe.pagamentos().map(p => ({
      forma: p.descricao(),
      valor: formataMoeda(p.valor())
    })) : [],

    destinatario: nfe.destinatario() && nfe.destinatario().nome()
      ? Object.assign(dadosEntidade(nfe.destinatario()), { identificacao: formataInscricaoNacional(nfe.destinatario().inscricaoNacional()) })
      : { nome: 'CONSUMIDOR NÃO IDENTIFICADO' },

    chave: nfe.chave().replace(/\s/g, ''),
    numero: nfe.nrNota(),
    serie: nfe.serie(),
    protocolo: nfe.protocolo(),
    data_emissao: formataData(nfe.dataEmissao()) + ' ' + formataHora(nfe.dataEmissao()),
    data_protocolo: formataData(nfe.dataHoraRecebimento()) + ' ' + formataHora(nfe.dataHoraRecebimento()),
    informacoes_complementares: nfe.informacoesComplementares(),
    qrCode: nfe.qrCode ? nfe.qrCode() : ''
  }
}

/**
 * Mapeamento de dados para NFe (Folha A4)
 */
function getTemplateData(nfe) {
  if (!nfe) return null

  return {
    numero: nfe.nrNota(),
    serie: nfe.serie(),
    chave: nfe.chave(),
    protocolo: nfe.protocolo() + ' - ' + formataData(nfe.dataHoraRecebimento()) + ' ' + formataHora(nfe.dataHoraRecebimento()),
    natureza_operacao: nfe.naturezaOperacao(),
    emitente: Object.assign(dadosEntidade(nfe.emitente()), dadosEndereco(nfe.emitente())),
    destinatario: Object.assign(dadosEntidade(nfe.destinatario()), dadosEndereco(nfe.destinatario())),

    data_emissao: formataData(nfe.dataEmissao()),
    valor_total_nota: formataMoeda(nfe.total().valorNota()),
    total_produtos: formataMoeda(nfe.total().valorProdutos()),
    itens: extrairItens(nfe),
    informacoes_complementares: nfe.informacoesComplementares()
  }
}

function renderHtml(data, logo = "", customTemplate) {
  if (!data) return ''

  const pathToTemplate = (customTemplate && fs.existsSync(customTemplate))
    ? customTemplate
    : TEMPLATE_DANFE

  const template = fs.readFileSync(pathToTemplate, 'utf8')
  return handlebars.compile(template)({ ...data, emitente: { ...data.emitente, logo } })
}

/**
 * Exportação dos Módulos
 */
module.exports.NfefromXML = function (xml, logo = "") {
  if (!xml) return { toHtml: () => '' }
  const nfe = NFe(xml)
  return {
    toHtml: (customTemplate = null) => renderHtml(getTemplateData(nfe), logo, customTemplate)
  }
}

module.exports.NfcefromXML = function (xml, logo = "") {
  if (!xml) return { toHtml: () => '' }
  const nfe = NFe(xml)
  return {
    toHtml: (customTemplate = null) => renderHtml(getTemplateNfceData(nfe), logo, customTemplate)
  }
}

module.exports.fromFile = function (filePath, logo = "") {
  if (!filePath || !fs.existsSync(filePath)) throw new Error('Arquivo não encontrado: ' + filePath)
  const content = fs.readFileSync(filePath, 'utf8')
  // Detecta se é NFCe (65) ou NFe (55) pela chave ou conteúdo
  return content.includes('<mod>65</mod>')
    ? module.exports.NfcefromXML(content, logo)
    : module.exports.NfefromXML(content, logo)
}
