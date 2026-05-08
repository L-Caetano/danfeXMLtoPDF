const handlebars = require('handlebars')
const fs = require('fs')
const path = require('path')
const { XMLParser } = require('fast-xml-parser')

const TEMPLATE_DACTE = path.join(__dirname, './dacte.hbs')
const cssPath = path.join(__dirname, './dacte.css');

function mascaraCNPJ(valor) {
  if (!valor) return ''
  const limpo = String(valor).replace(/\D/g, '')
  if (limpo.length === 11) return limpo.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")
  return limpo.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5")
}

function formataMoeda(numero) {
  return parseFloat(numero || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formataDataHora(dt) {
  if (!dt) return ''
  const data = new Date(dt)
  if (isNaN(data.getTime())) return dt
  return data.toLocaleDateString('pt-BR') + ' ' + data.toLocaleTimeString('pt-BR')
}

async function parseDacteData(xmlContent) {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "",
    parseTagValue: false,
    removeNSPrefix: true
  })

  const jsonObj = parser.parse(xmlContent)
  const cteProc = jsonObj.cteProc || jsonObj
  const cte = cteProc.CTe?.infCte || {}
  const prot = cteProc.protCTe?.infProt || {}

  const ide = cte.ide || {}
  const emit = cte.emit || {}
  const endEmit = emit.enderEmit || {}
  const rem = cte.rem || {}
  const dest = cte.dest || {}
  const exp = cte.exped || {}
  const vPrest = cte.vPrest || {}
  const imposto = cte.imp?.ICMS || {}
  const icmsData = imposto[Object.keys(imposto)[0]] || {}

  const tomadorCod = ide.toma3?.toma || ide.toma4?.toma
  const tomadores = { '0': 'Remetente', '1': 'Expedidor', '2': 'Recebedor', '3': 'Destinatário', '4': 'Outros' }

  return {
    chave: String(prot.chCTe || cte.Id || '').replace('CTe', '').replace(/(\d{4})/g, '$1 ').trim(),
    protocolo: prot.nProt ? `${prot.nProt} - ${formataDataHora(prot.dhRecbto)}` : 'NÃO AUTORIZADO',
    numero: ide.nCT || '',
    serie: ide.serie || '',
    data_emissao: formataDataHora(ide.dhEmi),
    natureza: ide.natOp || '',
    cfop: ide.CFOP || '',
    modal: ide.modal === '01' ? 'Rodoviário' : ide.modal,
    tipo_servico: ide.tpServ === '2' ? "Redespacho" : "Normal",
    tomador: tomadores[tomadorCod] || 'Outros',

    emitente: {
      nome: emit.xNome || '',
      cnpj: mascaraCNPJ(emit.CNPJ),
      ie: emit.IE || '',
      endereco: `${endEmit.xLgr || ''}, ${endEmit.nro || ''} ${endEmit.xCpl || ''}`,
      cidade_uf: `${endEmit.xMun || ''} - ${endEmit.UF || ''}`,
      cep: endEmit.CEP || '',
      fone: endEmit.fone || ''
    },

    remetente: {
      nome: rem.xNome || '',
      cnpj: mascaraCNPJ(rem.CNPJ || rem.CPF),
      ie: rem.IE || '',
      endereco: `${rem.enderRem?.xLgr || ''}, ${rem.enderRem?.nro || ''}`,
      cidade_uf: `${rem.enderRem?.xMun || ''} - ${rem.enderRem?.UF || ''}`
    },

    expedidor: exp.xNome ? {
      nome: exp.xNome,
      cnpj: mascaraCNPJ(exp.CNPJ || exp.CPF),
      ie: exp.IE || '',
      endereco: `${exp.enderExped?.xLgr || ''}, ${exp.enderExped?.nro || ''}`,
      cidade_uf: `${exp.enderExped?.xMun || ''} - ${exp.enderExped?.UF || ''}`
    } : null,

    destinatario: {
      nome: dest.xNome || '',
      cnpj: mascaraCNPJ(dest.CNPJ || dest.CPF),
      ie: dest.IE || '',
      endereco: `${dest.enderDest?.xLgr || ''}, ${dest.enderDest?.nro || ''}`,
      cidade_uf: `${dest.enderDest?.xMun || ''} - ${dest.enderDest?.UF || ''}`
    },

    valores: {
      total_servico: formataMoeda(vPrest.vTPrest),
      receber: formataMoeda(vPrest.vRec),
      componentes: (Array.isArray(vPrest.Comp) ? vPrest.Comp : (vPrest.Comp ? [vPrest.Comp] : [])).map(c => ({
        nome: c.xNome || '',
        valor: formataMoeda(c.vComp)
      }))
    },

    imposto: {
      bc: formataMoeda(icmsData.vBC),
      aliquota: formataMoeda(icmsData.pICMS),
      valor: formataMoeda(icmsData.vICMS),
      cst: icmsData.CST || ''
    },

    carga: {
      valor: formataMoeda(cte.infCarga?.vCarga),
      produto: cte.infCarga?.proPred || '',
      peso: Array.isArray(cte.infCarga?.infQ)
        ? (cte.infCarga.infQ.find(q => q.cUnid === "01")?.qTp || '0.00')
        : (cte.infCarga?.infQ?.qTp || '0.00')
    },

    obs: cte.compl?.xObs || ''
  }
}

module.exports.generateDacteHtml = async function (xmlPath) {
  const xmlContent = fs.readFileSync(xmlPath, 'utf8')
  const data = await parseDacteData(xmlContent)
  const templateHtml = fs.readFileSync(TEMPLATE_DACTE, 'utf8')
  const css = fs.readFileSync(cssPath, 'utf8');
  return handlebars.compile(templateHtml)({
    ...data,
    css
  })
}
