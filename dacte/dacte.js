const handlebars = require('handlebars')
const fs = require('fs')
const path = require('path')
const { XMLParser } = require('fast-xml-parser')

const TEMPLATE_DACTE = path.join(__dirname, './dacte.hbs')
const cssPath = path.join(__dirname, './dacte.css')

/* =========================================================
 * HELPERS
 * ========================================================= */

function onlyNumbers(v) {
  return String(v || '').replace(/\D/g, '')
}

function maskCpfCnpj(valor) {
  const limpo = onlyNumbers(valor)
  if (limpo.length === 11) {
    return limpo.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
  }
  if (limpo.length === 14) {
    return limpo.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
  }
  return valor || ''
}

function formatMoney(v) {
  return Number(v || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

function formatDateTime(v) {
  if (!v) return ''
  const dt = new Date(v)
  if (isNaN(dt.getTime())) return v
  return dt.toLocaleString('pt-BR')
}

function formatDate(v) {
  if (!v) return ''
  const dt = new Date(v + 'T00:00:00')
  if (isNaN(dt.getTime())) return v
  return dt.toLocaleDateString('pt-BR')
}

function formatCep(v) {
  const cep = onlyNumbers(v)
  if (cep.length !== 8) return v || ''
  return cep.replace(/(\d{5})(\d{3})/, '$1-$2')
}

function safeArray(v) {
  if (!v) return []
  return Array.isArray(v) ? v : [v]
}

function endereco(end = {}) {
  return {
    logradouro: end.xLgr || '',
    numero: end.nro || '',
    complemento: end.xCpl || '',
    bairro: end.xBairro || '',
    municipio: end.xMun || '',
    uf: end.UF || '',
    cep: formatCep(end.CEP),
    pais: end.xPais || '',
    fone: end.fone || '',
    linha1: [end.xLgr, end.nro, end.xCpl].filter(Boolean).join(', '),
    linha2: [end.xBairro, end.xMun, end.UF].filter(Boolean).join(' - ')
  }
}

function pessoa(obj = {}, endTag) {
  if (!obj) return { endereco: {} }
  return {
    nome: obj.xNome || '',
    fantasia: obj.xFant || '',
    cnpj: maskCpfCnpj(obj.CNPJ),
    cpf: maskCpfCnpj(obj.CPF),
    documento: maskCpfCnpj(obj.CNPJ || obj.CPF),
    ie: obj.IE || '',
    iest: obj.IEST || '',
    suframa: obj.ISUF || '',
    email: obj.email || '',
    fone: obj.fone || '',
    endereco: endereco(obj[endTag] || {})
  }
}

/* =========================================================
 * TABELAS E TRADUÇÕES
 * ========================================================= */

const MODAIS = {
  '01': 'Rodoviário', '02': 'Aéreo', '03': 'Aquaviário',
  '04': 'Ferroviário', '05': 'Dutoviário', '06': 'Multimodal'
}
const TIPO_SERVICO = {
  '0': 'Normal', '1': 'Subcontratação', '2': 'Redespacho',
  '3': 'Redespacho Intermediário', '4': 'Serviço Vinculado a Multimodal'
}
const TOMADOR_LABELS = {
  '0': 'Remetente', '1': 'Expedidor', '2': 'Recebedor',
  '3': 'Destinatário', '4': 'Outros'
}
const TP_CTE = {
  '0': 'CT-e Normal', '1': 'CT-e de Complemento',
  '2': 'CT-e de Anulação', '3': 'CT-e Substituto'
}

/* =========================================================
 * EXTRATORES ESPECÍFICOS
 * ========================================================= */

function extractICMS(icms = {}) {
  const key = Object.keys(icms)[0]
  if (!key) return { cst: '', bc: '0,00', aliquota: '0,00', valor: '0,00', reducao: '0,00' }
  const data = icms[key]
  return {
    cst: data.CST || data.CSOSN || '',
    bc: formatMoney(data.vBC),
    aliquota: formatMoney(data.pICMS),
    valor: formatMoney(data.vICMS),
    reducao: formatMoney(data.pRedBC)
  }
}

function extractCarga(infCarga = {}) {
  const infQ = safeArray(infCarga.infQ)

  const findByMed = (...termos) => {
    const item = infQ.find(q => {
      const med = String(q.tpMed || '').toUpperCase().trim()
      return termos.some(t => med.includes(t.toUpperCase()))
    })
    return item ? String(item.qCarga) : ''
  }

  const findByUnid = (cUnid) => {
    const item = infQ.find(q => String(q.cUnid) === cUnid)
    return item ? String(item.qCarga) : ''
  }

  return {
    produtoPredominante: infCarga.proPred || '',
    outrasCaracteristicas: infCarga.xOutCat || '',
    valorCarga: formatMoney(infCarga.vCarga),
    valorCargaAverb: formatMoney(infCarga.vCargaAverb),
    pesoBruto: findByMed('BRUTO', 'REAL', 'DECLARADO') || findByUnid('01'),
    pesoBase: findByMed('BASE'),
    pesoAferido: findByMed('AFERIDO', 'AFORADO'),
    pesoCubado: findByMed('CUBADO'),
    cubagem: findByMed('CUBAGEM', 'M3') || findByUnid('00'),
    quantidadeVolumes: findByUnid('03') || findByMed('VOLUME', 'UNIDADE', 'CAIXAS')
  }
}

function extractDocs(infDoc = {}, docAnt = {}) {
  const mappedNfes = safeArray(infDoc.infNFe).map(n => {
    const ch = String(n.chave || '')
    return {
      tipo: 'NFE',
      chave: ch,
      serie: ch.length === 44 ? ch.substring(22, 25) : '',
      numero: ch.length === 44 ? ch.substring(25, 34) : '',
      dPrev: formatDate(n.dPrev)
    }
  })

  const mappedNfs = safeArray(infDoc.infNF).map(n => {
    return {
      tipo: 'NF',
      chave: '',
      serie: String(n.serie || ''),
      numero: String(n.nDoc || ''),
      dPrev: formatDate(n.dPrev)
    }
  })

  const mappedOutros = safeArray(infDoc.infOutros).map(n => {
    return {
      tipo: String(n.tpDoc || ''),
      chave: '',
      serie: '',
      numero: String(n.nDoc || ''),
      dPrev: formatDate(n.dPrev)
    }
  })

  const mappedCtes = safeArray(docAnt.emiDocAnt).flatMap(emi => {
    return safeArray(emi.idDocAnt).flatMap(idDoc => {
      return safeArray(idDoc.idDocAntEle).map(ele => {
        const ch = String(ele.chCTe || '')
        return {
          tipo: 'CTE',
          chave: ch,
          serie: ch.length === 44 ? ch.substring(22, 25) : '',
          numero: ch.length === 44 ? String(parseInt(ch.substring(25, 34), 10)) : '',
          dPrev: ''
        }
      })
    })
  })

  const todos = [...mappedNfes, ...mappedNfs, ...mappedOutros, ...mappedCtes]
  while (todos.length < 2) todos.push({ tipo: '', chave: '', serie: '', numero: '', dPrev: '' })
  return { nfes: todos }
}

function extractSeguro(seg) {
  // seg pode ser array ou objeto único
  const primeiro = safeArray(seg)[0] || {}
  return {
    responsavel: primeiro.respSeg || '',
    seguradora: primeiro.xSeg || '',
    apolice: primeiro.nApol || '',
    averbacao: primeiro.nAver || ''
  }
}

function extractObsCont(compl = {}) {
  // Monta um mapa xCampo -> xTexto das ObsCont
  const obs = {}
  safeArray(compl.ObsCont).forEach(o => {
    if (o['@_xCampo'] || o.xCampo) {
      const campo = String(o['@_xCampo'] || o.xCampo || '').toLowerCase()
      obs[campo] = o.xTexto || ''
    }
  })
  return obs
}

/* =========================================================
 * PARSER PRINCIPAL
 * ========================================================= */

async function parseDacteData(xmlContent) {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    parseTagValue: false,
    removeNSPrefix: true
  })
  const jsonObj = parser.parse(xmlContent)
  const cteProc = jsonObj.cteProc || jsonObj
  const infCte = cteProc.CTe?.infCte || {}
  const ide = infCte.ide || {}
  const compl = infCte.compl || {}
  const protCTe = cteProc.protCTe?.infProt || {}
  const infCTeNorm = infCte.infCTeNorm || {}

  // Participantes
  const remetente = pessoa(infCte.rem, 'enderReme')
  const destinatario = pessoa(infCte.dest, 'enderDest')
  const expedidor = pessoa(infCte.exped, 'enderExped')
  const recebedor = pessoa(infCte.receb, 'enderReceb')

  // Tomador
  const tomaCod = String(ide.toma3?.toma ?? ide.toma4?.toma ?? '4')
  let tomadorData = {}
  if (tomaCod === '0') tomadorData = remetente
  else if (tomaCod === '1') tomadorData = expedidor
  else if (tomaCod === '2') tomadorData = recebedor
  else if (tomaCod === '3') tomadorData = destinatario
  else tomadorData = pessoa(infCte.toma4, 'enderToma')

  const chave = (protCTe.chCTe || infCte['@_Id'] || infCte.Id || '').replace(/^CTe /, '')

  // ObsCont mapeadas
  const obsCont = extractObsCont(compl)

  // Previsão de entrega do compl
  let dataEntregaCompl = ''
  if (compl.Entrega) {
    const ent = compl.Entrega
    dataEntregaCompl = formatDate(
      ent.comData?.dProg ||
      ent.noPeriodo?.dFim ||
      ent.noPeriodo?.dIni ||
      ''
    )
  }

  return {
    chave,
    chave_formatada: chave.replace(/(\d{4})(?=\d)/g, '$1 '),
    protocolo_formatado: protCTe.nProt
      ? `${protCTe.nProt} - ${formatDateTime(protCTe.dhRecbto)}`
      : 'NÃO AUTORIZADO',
    numero: ide.nCT || '',
    serie: ide.serie || '',
    tipo_cte: TP_CTE[String(ide.tpCTe)] || '',
    modal: MODAIS[String(ide.modal).padStart(2, '0')] || 'Rodoviário',
    servico: TIPO_SERVICO[String(ide.tpServ)] || '',
    cfop: ide.CFOP || '',
    natureza_operacao: ide.natOp || '',
    municipio_inicio: ide.xMunIni || '',
    uf_inicio: ide.UFIni || '',
    municipio_fim: ide.xMunFim || '',
    uf_fim: ide.UFFim || '',
    data_emissao: formatDateTime(ide.dhEmi),

    // campo sem equivalente direto no leiaute — deixa vazio
    formaPagamento: '',

    tomador: tomadorData,
    tomador_tipo: TOMADOR_LABELS[tomaCod] || '',

    emitente: pessoa(infCte.emit, 'enderEmit'),
    remetente,
    destinatario,
    expedidor,
    recebedor,

    valores: {
      valor_total: formatMoney(infCte.vPrest?.vTPrest),
      valor_receber: formatMoney(infCte.vPrest?.vRec),
      componentes: safeArray(infCte.vPrest?.Comp).map(c => ({
        nome: c.xNome || '',
        valor: formatMoney(c.vComp)
      }))
    },

    imposto: extractICMS(infCte.imp?.ICMS || {}),

    carga: extractCarga(infCTeNorm.infCarga || {}),

    documentos: extractDocs(infCTeNorm.infDoc || {}, infCTeNorm.docAnt || {}),

    seguro: extractSeguro(infCte.seg),

    rodoviario: {
      rntrc: infCTeNorm.infModal?.rodo?.RNTRC || '',
      ciot: infCTeNorm.infModal?.rodo?.CIOT || '',
      lotacao: '',  // não existe no leiaute padrão
      dataEntrega: dataEntregaCompl || formatDateTime(compl.dPrev)
    },

    observacoes: {
      contribuinte: compl.xObs || '',
      caracAdicional: compl.xCaracAd || '',
      caracServico: compl.xCaracSer || '',
      obsCont  // mapa livre: obsCont.embarque, obsCont.pedido, etc
    }
  }
}

module.exports.generateDacteHtml = async function (xmlPath) {
  const xmlContent = fs.readFileSync(xmlPath, 'utf8')
  const data = await parseDacteData(xmlContent)
  const templateHtml = fs.readFileSync(TEMPLATE_DACTE, 'utf8')
  const css = fs.readFileSync(cssPath, 'utf8')
  return handlebars.compile(templateHtml)({ ...data, css })
}
