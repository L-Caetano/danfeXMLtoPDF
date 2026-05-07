const handlebars = require('handlebars')
const NFe = require('djf-nfe')
const TEMPLATE_DANFE = __dirname + '/template-danfe.hbs'
const fs = require('fs')
const path = require('path')

/**
 * Retorna <valor> especificado com máscara do CPF.
 *
 * @param      {string}  valor
 * @return     {string}
 */
function mascaraCPF(valor) {
  var retorno
  var grupo01 = valor.substring(0, 3)
  retorno = grupo01
  var grupo02 = valor.substring(3, 6)
  if (grupo02 !== '') {
    retorno += '.' + grupo02
  }
  var grupo03 = valor.substring(6, 9)
  if (grupo03 !== '') {
    retorno += '.' + grupo03
  }
  var grupo04 = valor.substring(9)
  if (grupo04 !== '') {
    retorno += '-' + grupo04
  }
  return retorno
}

/**
 * Retorna <valor> especificado com máscara do CNPJ.
 *
 * @param      {string}  valor
 * @return     {string}
 */
function mascaraCNPJ(valor) {
  var retorno
  var grupo01 = valor.substring(0, 2)
  retorno = grupo01
  var grupo02 = valor.substring(2, 5)
  if (grupo02 !== '') {
    retorno += '.' + grupo02
  }
  var grupo03 = valor.substring(5, 8)
  if (grupo03 !== '') {
    retorno += '.' + grupo03
  }
  var grupo04 = valor.substring(8, 12)
  if (grupo04 !== '') {
    retorno += '/' + grupo04
  }
  var grupo05 = valor.substring(12)
  if (grupo05 !== '') {
    retorno += '-' + grupo05
  }
  return retorno
}

/**
 * Retorna <numero> especificado formatado de acordo com seu tipo (cpf ou cnpj).
 *
 * @param      {string}  numero
 * @return     {string}
 */
function formataInscricaoNacional(numero) {
  if (numero) {
    if (numero.length === 11) {
      return mascaraCPF(numero)
    }
    if (numero.length === 14) {
      return mascaraCNPJ(numero)
    }
  }
  return numero
}

/**
 * Formata data de acordo com <dt> esoecificado.
 * <dt> é no formato UTC, YYYY-MM-DDThh:mm:ssTZD (https://www.w3.org/TR/NOTE-datetime)
 *
 * @param      {string}  dt
 * @return     {string}
 */
function formataData(dt) {
  dt = dt ? dt.toString() : ''
  if (!dt) { return '' }

  if (dt && dt.length === 10) {
    dt += 'T00:00:00+00:00'
  }

  var [data, hora] = dt.split('T')
  var [hora, utc] = hora.split(/[-+]/)
  var [ano, mes, dia] = data.split('-')
  var [hora, min, seg] = hora.split(':')
  var [utchora, utcmin] = utc ? utc.split(':') : ['', '']
  return dia.padStart(2, '0') + '/' + mes.toString().padStart(2, '0') + '/' + ano
}

function formataHora(dt) {
  if (dt) {
    var data = new Date(dt)
    return data.getHours().toString().padStart(2, '0') + ':' + (data.getMinutes().toString().padStart(2, '0')) + ':' + data.getSeconds().toString().padStart(2, '0')
  }
  return ''
}

/**
 * Retorna o valor formatado em moeda de acordo com  <numero>  e <decimais> especificados.
 *
 * @param      {number}   numero
 * @param      {number}  decimais
 * @return     {string}
 */
function formataMoeda(numero, decimais) {
  decimais = decimais || 4
  var symbol = ''
  var decimal = ','
  var thousand = '.'
  var negative = numero < 0 ? '-' : ''
  var i = parseInt(numero = Math.abs(+numero || 0).toFixed(decimais), 10) + ''
  var j = 0

  decimais = !isNaN(decimais = Math.abs(decimais)) ? decimais : 2
  symbol = symbol !== undefined ? symbol : '$'
  thousand = thousand || ','
  decimal = decimal || '.'
  j = (j = i.length) > 3 ? j % 3 : 0
  return symbol + negative + (j ? i.substr(0, j) + thousand : '') + i.substr(j).replace(/(\d{3})(?=\d)/g, '$1' + thousand) + (decimais ? decimal + Math.abs(numero - i).toFixed(decimais).slice(2) : '')
};

/**
 * Retorna objeto representando os dados da <entidade> especificada.
 *
 * @param      {Object}  entidade  djf-nfe
 * @return     {Object}
 */
function dadosEntidade(entidade) {
  if (entidade) {
    return {
      nome: entidade.nome(),
      fantasia: entidade.fantasia(),
      ie: entidade.inscricaoEstadual(),
      ie_st: entidade.inscricaoEstadualST(),
      inscricao_municipal: entidade.inscricaoMunicipal(),
      inscricao_nacional: formataInscricaoNacional(entidade.inscricaoNacional()),
      telefone: entidade.telefone()
    }
  }
  return {}
}

/**
 * Retorna objeto representando os dados do <endereco> especificado.
 *
 * @param      {Object}  endereco   djf-nfe
 * @return     {Object}
 */
function endereco(endereco) {
  if (endereco) {
    return {
      endereco: endereco.logradouro(),
      numero: endereco.numero(),
      complemento: endereco.complemento(),
      bairro: endereco.bairro(),
      municipio: endereco.municipio(),
      cep: endereco.cep(),
      uf: endereco.uf()
    }
  }
  return {}
}

/**
 * Retorna a <cahve> da NFE formata.
 * Formatação: grupos de 4 números separados por espaço.
 * @param      {string}  chave
 * @return     {string}
 */
function formataChave(chave) {
  var out = ''
  if (chave && chave.length === 44) {
    for (var i = 0; i < chave.split('').length; i++) {
      if (i % 4 === 0) {
        out += ' ' + chave.charAt(i)
      } else {
        out += chave.charAt(i)
      }
    }
    return out
  }
  return chave
}

/**
 * Retorna array de objetos com os dados dos itens de acordo com <nfe> especificado.
 *
 * @param      {<object>}  nfe     djf-nfe
 * @return     {array}
 */
function itens(nfe) {
  var itens = []
  var nrItens = nfe.nrItens()
  for (var i = 1; i <= nrItens; i++) {
    var row = nfe.item(i)
    var item = {
      codigo: row.codigo(),
      descricao: row.descricao(),
      ncm: row.ncm(),
      cst: row.origem() + '' + row.cst(),
      cfop: row.cfop(),
      unidade: row.unidadeComercial(),
      quantidade: formataMoeda(row.quantidadeComercial()),
      valor: formataMoeda(row.valorUnitario()),
      desconto: formataMoeda(row.valorDesconto()),
      total: formataMoeda(row.valorProdutos()),
      base_calculo: formataMoeda(row.baseCalculoIcms()),
      icms: formataMoeda(row.valorIcms()),
      ipi: formataMoeda(row.valorIPI()),
      porcentagem_icms: formataMoeda(row.porcetagemIcms(), 2),
      porcentagem_ipi: formataMoeda(row.porcentagemIPI(), 2)
    }
    itens.push(item)
  }

  return itens
}

/**
 * Retorna array de objetos com os dados das duplicatas de acordo com <nfe> especificado
 *
 * @param      {object}  nfe     djf-nfe
 * @return     {array}
 */
function duplicatas(nfe) {
  var dups = []
  if (nfe.cobranca() && nfe.cobranca().nrDuplicatas() > 0) {
    var quant = nfe.cobranca().nrDuplicatas()
    for (var i = 1; i <= quant; i++) {
      var dup = nfe.cobranca().duplicata(i)
      dups.push({
        numero: dup.numeroDuplicata(),
        vencimento: formataData(dup.vencimentoDuplicata()),
        valor: formataMoeda(dup.valorDuplicata(), 2)
      })
    }
  }

  return dups
}

/**
 * Retorna os dados da observação de acordo com <nfe> especificado.
 *
 * @param      {object}  nfe     djf-nfe
 * @return     {string}
 */
function observacoes(nfe) {
  var quant = nfe.nrObservacoes()
  var result = ''
  for (var i = 1; i <= quant; i++) {
    result += '\n' + nfe.observacao(i).texto()
  }

  return result
}

/**
 * Retorna o template html do Danfe preenchido com os dados em <data> especificado.
 * Retorna vazio se não gerado.
 * @param      {object}  data
 * @param      {string}  logo
 * @return     {string}
 */
function renderHtml(data, logo = "", customTemplate) {
  if (!data) {
    return ''
  }

  var pathToTemplate =
    customTemplate &&
      customTemplate.includes('.hbs') &&
      fs.existsSync(customTemplate)
      ? customTemplate
      : TEMPLATE_DANFE

  var template = fs.readFileSync(pathToTemplate, 'utf8')

  return handlebars.compile(template)({ ...data, emitente: { ...data.emitente, logo } })
}

/**
 * Retorna objeto com os dados do template de acordo com <nfe> especificado.
 *
 * @param      {object}  nfe     djf-nfe
 * @return     {object}
 */
function getTemplateData(nfe) {
  if (!nfe) return null;

  // Formatação de data e hora combinada para o protocolo
  const dataHoraProt = nfe.dataHoraRecebimento()
    ? formataData(nfe.dataHoraRecebimento()) + ' ' + formataHora(nfe.dataHoraRecebimento())
    : '';
  const getIE = (entidade) => {
    if (entidade && typeof entidade.inscricaoEstadual === 'function') {
      return entidade.inscricaoEstadual();
    }
    return '';
  };
  var data = {
    operacao: nfe.tipoOperacao(),
    natureza_operacao: nfe.naturezaOperacao(),
    numero: nfe.nrNota(),
    serie: nfe.serie(),
    chave: formataChave(nfe.chave()),
    protocolo: nfe.protocolo() + (dataHoraProt ? ' - ' + dataHoraProt : ''),

    // Emitente
    emitente: Object.assign(dadosEntidade(nfe.emitente()), endereco(nfe.emitente())),

    // Destinatário (Garante Município, UF e IE)[cite: 11, 12]
    destinatario: Object.assign(
      dadosEntidade(nfe.destinatario()),
      endereco(nfe.destinatario()),
      { ie: nfe.destinatario().inscricaoEstadual() }
    ),

    data_emissao: formataData(nfe.dataEmissao()),
    data_saida: formataData(nfe.dataEntradaSaida()),
    hora_saida: formataHora(nfe.dataEntradaSaida()),

    // Impostos
    base_calculo_icms: formataMoeda(nfe.total().baseCalculoIcms(), 2),
    imposto_icms: formataMoeda(nfe.total().valorIcms(), 2),
    base_calculo_icms_st: formataMoeda(nfe.total().baseCalculoIcmsST(), 2),
    imposto_icms_st: formataMoeda(nfe.total().valorIcmsST(), 2),
    total_produtos: formataMoeda(nfe.total().valorProdutos(), 2),
    total_frete: formataMoeda(nfe.total().valorFrete(), 2),
    total_seguro: formataMoeda(nfe.total().valorSeguro(), 2),
    total_desconto: formataMoeda(nfe.total().valorDesconto(), 2),
    total_despesas: formataMoeda(nfe.total().valorOutrasDespesas(), 2),
    total_ipi: formataMoeda(nfe.total().valorIPI(), 2),
    valor_total_nota: formataMoeda(nfe.total().valorNota(), 2),

    // Transportador completo[cite: 11, 12]
    transportador: Object.assign(
      dadosEntidade(nfe.transportador()),
      endereco(nfe.transportador()),
      { ie: getIE(nfe.transportador()) }
    ),
    modalidade_frete: nfe.modalidadeFrete(),
    modalidade_frete_texto: nfe.modalidadeFreteTexto(),

    informacoes_complementares: nfe.informacoesComplementares(),
    observacao: observacoes(nfe),
    itens: itens(nfe)
  };

  if (nfe.transporte() && nfe.transporte().volume()) {
    var vol = nfe.transporte().volume();
    data.volume_quantidade = formataMoeda(vol.quantidadeVolumes(), 0);
    data.volume_especie = vol.especie();
    data.volume_marca = vol.marca();
    data.volume_pesoBruto = formataMoeda(vol.pesoBruto(), 3);
    data.volume_pesoLiquido = formataMoeda(vol.pesoLiquido(), 3);
  }

  if (nfe.transporte() && nfe.transporte().veiculo()) {
    data.veiculo_placa = nfe.transporte().veiculo().placa();
    data.veiculo_placa_uf = nfe.transporte().veiculo().uf();
    data.veiculo_antt = nfe.transporte().veiculo().antt();
  }

  return data;
}

// Dentro da sua função createPDF ou getTemplateNfceData
function getTemplateNfceData(nfe) {
  // Extração manual dos itens para garantir que o array não esteja vazio
  const itensBrutos = nfe.itens ? nfe.itens() : [];

  // Mapeamento para garantir que as variáveis correspondam ao template
  const itensMapeados = itensBrutos.map(item => ({
    codigo: item.codigo(),
    descricao: item.descricao(),
    qtd: item.quantidade().toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
    un: item.unidade(),
    valor_unit: item.valorUnitario().toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
    valor_total: item.valorTotal().toLocaleString('pt-BR', { minimumFractionDigits: 2 })
  }));

  return {
    // Dados do Emitente [cite: 1, 17, 18, 19, 20]
    emitente: {
      nome: nfe.emitente().nome(),
      cnpj: nfe.emitente().inscricaoNacional(),
      ie: nfe.emitente().inscricaoEstadual(),
      endereco: nfe.emitente().endereco().logradouro() + ", " + nfe.emitente().endereco().numero(),
      bairro: nfe.emitente().endereco().bairro(),
      cep: nfe.emitente().endereco().cep(),
      municipio: nfe.emitente().endereco().municipio(),
      uf: nfe.emitente().endereco().uf(),
      fone: nfe.emitente().endereco().telefone()
    },
    // Itens e Totais 
    itens: itensMapeados,
    qtd_total_itens: itensMapeados.length,
    valor_total_produtos: nfe.total().valorProdutos().toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
    valor_total_nota: nfe.total().valorNota().toLocaleString('pt-BR', { minimumFractionDigits: 2 }),

    // Pagamentos [cite: 25]
    pagamentos: nfe.pagamentos ? nfe.pagamentos().map(p => ({
      forma: p.descricao(),
      valor: p.valor().toLocaleString('pt-BR', { minimumFractionDigits: 2 })
    })) : [],

    // Dados Fiscais [cite: 8, 11, 13, 31]
    chave: nfe.chave().replace(/\s/g, ''),
    numero: nfe.nrNota(),
    serie: nfe.serie(),
    protocolo: nfe.protocolo(),
    data_emissao: new Date(nfe.dataEmissao()).toLocaleString('pt-BR'),
    data_protocolo: new Date(nfe.dataHoraRecebimento()).toLocaleString('pt-BR'),
    informacoes_complementares: nfe.informacoesComplementares(),
    qrCode: nfe.qrCode ? nfe.qrCode() : ''
  };
}
/**
 * Retorna modelNfeo Danfe de acordo com objeto <nfe> especificado.
 *
 * @param      {<type>}  nfe     djf-nfe
 * @param      {string}  logo
 * @return     {Object}  { description_of_the_return_value }
 */
function modelNfe(nfe, logo = "") {
  return {
    /**
     * @param   {string}  customTemplate   Caminho para um template de NF customizado em .hbs (handlebars)
     * @returns {string}                   Retorna um html em string
     */
    toHtml: (customTemplate = null) =>
      renderHtml(getTemplateData(nfe), logo, customTemplate)
  }
}
function modelNfce(nfe, logo = "") {
  return {
    toHtml: (customTemplate = null) =>
      renderHtml(getTemplateNfceData(nfe), logo, customTemplate)
  }
}
/**
 * Retorna modelNfeo Danfe de acordo com objeto  <nfe> especificado.
 *
 * @param      {object}  nfe    djf-nfe
 * @return     {<object>}
 */
module.exports.fromNFe = function (nfe, logo = "") {
  if (!nfe || typeof nfe.nrNota !== 'function') {
    return modelNfe(null)
  }
  return modelNfe(nfe, logo)
}

/**
 * Retorna modelNfeo Danfe de acordo com <xml> especificado.
 *
 * @param      {string}  xml
 * @param      {string}  logo
 * @return     {<object>}
 */
module.exports.NfefromXML = function (xml, logo = "") {
  if (!xml || typeof xml !== 'string') {
    return modelNfe(null)
  }
  return modelNfe(NFe(xml), logo)
}

module.exports.NfcefromXML = function (xml, logo = "") {
  if (!xml || typeof xml !== 'string') {
    return modelNfce(null)
  }
  return modelNfce(NFe(xml), logo)
}
/**
 * Retorna modelNfeo Danfe de acordo com <filePath> especificado.
 *
 * @param      {string}  filePath
 * @param      {string}  logo
 * @return     {<object>}
 */
module.exports.fromFile = function (filePath, logo = "") {
  var content = ''

  if (!filePath || typeof filePath !== 'string') {
    return modelNfe(null)
  }

  try {
    content = fs.readFileSync(filePath, 'utf8')
  } catch (err) {
    throw new Error('File not found: ' + filePath + ' => ' + err.message)
  }

  return module.exports.fromXML(content, logo)
}
