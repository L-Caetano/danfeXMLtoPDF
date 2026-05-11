const handlebars = require('handlebars')
const NFe = require('djf-nfe')
const fs = require('fs')
const path = require('path')

const TEMPLATE_DANFE = path.join(__dirname, 'danfe.hbs')
const cssPath = path.join(__dirname, 'danfe.css')

/**
 * ============================================================================
 * HELPERS
 * ============================================================================
 */

function onlyNumbers(value) {
  return (value || '').toString().replace(/\D/g, '')
}

function safe(value, fallback = '') {
  return value !== undefined && value !== null ? value : fallback
}

function call(method, fallback = '') {
  try {
    if (typeof method === 'function') {
      return method()
    }
    return fallback
  } catch (e) {
    return fallback
  }
}

/**
 * ============================================================================
 * FORMATADORES
 * ============================================================================
 */

function mascaraCPF(valor) {
  valor = onlyNumbers(valor)

  return valor.replace(
    /(\d{3})(\d{3})(\d{3})(\d{2})/,
    '$1.$2.$3-$4'
  )
}

function mascaraCNPJ(valor) {
  valor = onlyNumbers(valor)

  return valor.replace(
    /(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,
    '$1.$2.$3/$4-$5'
  )
}

function formataInscricaoNacional(numero) {
  numero = onlyNumbers(numero)

  if (numero.length === 11) {
    return mascaraCPF(numero)
  }

  if (numero.length === 14) {
    return mascaraCNPJ(numero)
  }

  return numero
}

function formataCEP(cep) {
  cep = onlyNumbers(cep)

  if (cep.length !== 8) return cep

  return cep.replace(/(\d{5})(\d{3})/, '$1-$2')
}

function formataData(dt) {
  dt = dt ? dt.toString() : ''

  if (!dt) return ''

  if (dt.length === 10) {
    dt += 'T00:00:00-03:00'
  }

  const [data] = dt.split('T')

  if (!data) return ''

  const [ano, mes, dia] = data.split('-')

  return `${dia}/${mes}/${ano}`
}

function formataHora(dt) {
  if (!dt) return ''

  dt = dt.toString()

  const partes = dt.split('T')

  if (partes.length < 2) return ''

  return partes[1].substring(0, 8)
}

function formataMoeda(numero, decimais = 2) {
  numero = Number(numero || 0)

  return numero.toLocaleString('pt-BR', {
    minimumFractionDigits: decimais,
    maximumFractionDigits: decimais
  })
}

/**
 * ============================================================================
 * ENTIDADES
 * ============================================================================
 */

function endereco(end) {
  if (!end) return {}

  return {
    endereco: call(() => end.logradouro()),
    numero: call(() => end.numero()),
    complemento: call(() => end.complemento()),
    bairro: call(() => end.bairro()),
    municipio: call(() => end.municipio()),
    codigo_municipio: call(() => end.codigoMunicipio()),
    uf: call(() => end.uf()),
    pais: call(() => end.pais()),
    codigo_pais: call(() => end.codigoPais()),
    cep: formataCEP(call(() => end.cep())),
    telefone: call(() => end.telefone())
  }
}

function dadosEntidade(entidade) {
  if (!entidade) return {}

  return {
    nome: call(() => entidade.nome()),
    fantasia: call(() => entidade.fantasia()),
    ie: call(() => entidade.inscricaoEstadual()),
    ie_st: call(() => entidade.inscricaoEstadualST()),
    inscricao_municipal: call(() => entidade.inscricaoMunicipal()),
    inscricao_nacional: formataInscricaoNacional(
      call(() => entidade.inscricaoNacional())
    ),
    cnpj: formataInscricaoNacional(
      call(() => entidade.inscricaoNacional())
    ),
    telefone: call(() => entidade.telefone()),
    email: call(() => entidade.email()),
    crt: call(() => entidade.crt()),
    indicador_ie: call(() => entidade.indicadorIE())
  }
}

/**
 * ============================================================================
 * CHAVE
 * ============================================================================
 */

function formataChave(chave) {
  chave = onlyNumbers(chave)

  if (chave.length !== 44) return chave

  return chave.match(/.{1,4}/g).join(' ')
}

/**
 * ============================================================================
 * ITENS
 * ============================================================================
 */

function itens(nfe) {
  const itens = []

  const nrItens = call(() => nfe.nrItens(), 0)

  for (let i = 1; i <= nrItens; i++) {
    const row = nfe.item(i)

    itens.push({
      numero_item: i,

      codigo: call(() => row.codigo()),
      descricao: call(() => row.descricao()),

      ean: call(() => row.ean()),
      ean_tributado: call(() => row.eanTributado()),

      ncm: call(() => row.ncm()),
      cest: call(() => row.cest()),
      cfop: call(() => row.cfop()),

      unidade: call(() => row.unidadeComercial()),
      unidade_tributavel: call(() => row.unidadeTributavel()),

      quantidade: formataMoeda(
        call(() => row.quantidadeComercial()),
        4
      ),

      quantidade_tributavel: formataMoeda(
        call(() => row.quantidadeTributavel()),
        4
      ),

      valor_unitario: formataMoeda(
        call(() => row.valorUnitario()),
        4
      ),

      valor_unitario_tributavel: formataMoeda(
        call(() => row.valorUnitarioTributavel()),
        4
      ),

      desconto: formataMoeda(
        call(() => row.valorDesconto())
      ),

      frete: formataMoeda(
        call(() => row.valorFrete())
      ),

      seguro: formataMoeda(
        call(() => row.valorSeguro())
      ),

      outras_despesas: formataMoeda(
        call(() => row.valorOutrasDespesas())
      ),

      total: formataMoeda(
        call(() => row.valorProdutos())
      ),

      valor_total_tributos: formataMoeda(
        call(() => row.valorTributos())
      ),

      origem: call(() => row.origem()),
      cst: `${call(() => row.origem())}${call(() => row.cst())}`,

      base_calculo_icms: formataMoeda(
        call(() => row.baseCalculoIcms())
      ),

      percentual_icms: formataMoeda(
        call(() => row.porcentagemIcms()),
        2
      ),

      valor_icms: formataMoeda(
        call(() => row.valorIcms())
      ),

      base_calculo_icms_st: formataMoeda(
        call(() => row.baseCalculoIcmsST())
      ),

      valor_icms_st: formataMoeda(
        call(() => row.valorIcmsST())
      ),

      percentual_ipi: formataMoeda(
        call(() => row.porcentagemIPI()),
        2
      ),

      valor_ipi: formataMoeda(
        call(() => row.valorIPI())
      ),

      valor_pis: formataMoeda(
        call(() => row.valorPIS())
      ),

      valor_cofins: formataMoeda(
        call(() => row.valorCOFINS())
      ),

      numero_fci: call(() => row.numeroFCI()),

      pedido_compra: call(() => row.numeroPedidoCompra()),
      item_pedido_compra: call(() => row.itemPedidoCompra()),

      informacoes_adicionais: call(() => row.informacoesAdicionais())
    })
  }

  return itens
}

/**
 * ============================================================================
 * DUPLICATAS
 * ============================================================================
 */

function duplicatas(nfe) {
  const dups = []

  const cobranca = call(() => nfe.cobranca())

  if (!cobranca) return dups

  const quant = call(() => cobranca.nrDuplicatas(), 0)

  for (let i = 1; i <= quant; i++) {
    const dup = cobranca.duplicata(i)

    dups.push({
      numero: call(() => dup.numeroDuplicata()),
      vencimento: formataData(
        call(() => dup.vencimentoDuplicata())
      ),
      valor: formataMoeda(
        call(() => dup.valorDuplicata())
      )
    })
  }

  return dups
}

/**
 * ============================================================================
 * OBSERVAÇÕES
 * ============================================================================
 */

function observacoes(nfe) {
  const quant = call(() => nfe.nrObservacoes(), 0)

  let result = ''

  for (let i = 1; i <= quant; i++) {
    result += '\n' + call(() => nfe.observacao(i).texto())
  }

  return result.trim()
}

/**
 * ============================================================================
 * TEMPLATE
 * ============================================================================
 */

function renderHtml(data, logo = '', customTemplate = null) {
  if (!data) return ''

  const pathToTemplate =
    customTemplate &&
      customTemplate.includes('.hbs') &&
      fs.existsSync(customTemplate)
      ? customTemplate
      : TEMPLATE_DANFE

  const template = fs.readFileSync(pathToTemplate, 'utf8')
  const css = fs.readFileSync(cssPath, 'utf8')

  return handlebars.compile(template)({
    ...data,
    css,
    emitente: {
      ...data.emitente,
      logo
    }
  })
}

/**
 * ============================================================================
 * NORMALIZAÇÃO NF-E
 * ============================================================================
 */

function getTemplateData(nfe, xml = '') {
  if (!nfe) return null

  /**
   * ===========================================================================
   * HELPERS
   * ===========================================================================
   */

  function extrairTag(xml, tag) {
    const match = xml.match(new RegExp(`<${tag}>(.*?)</${tag}>`))
    return match ? match[1] : null
  }

  /**
   * Extrai valor SOMENTE do bloco <ICMSTot>
   * evitando pegar tags de itens individuais
   */
  function extrairTagICMSTot(xml, tag) {
    const icmsTotMatch = xml.match(
      /<ICMSTot>([\s\S]*?)<\/ICMSTot>/
    )

    if (!icmsTotMatch) return null

    const icmsTotXml = icmsTotMatch[1]

    const tagMatch = icmsTotXml.match(
      new RegExp(`<${tag}>(.*?)</${tag}>`)
    )

    return tagMatch ? tagMatch[1] : null
  }

  const emitente = call(() => nfe.emitente())
  const destinatario = call(() => nfe.destinatario())
  const transportador = call(() => nfe.transportador())
  const total = call(() => nfe.total())
  const transporte = call(() => nfe.transporte())

  const dataHoraProt = call(() => nfe.dataHoraRecebimento())
    ? `${formataData(call(() => nfe.dataHoraRecebimento()))} ${formataHora(call(() => nfe.dataHoraRecebimento()))}`
    : ''

  /**
   * ===========================================================================
   * EXTRAÇÃO CORRETA DOS TOTAIS
   * ===========================================================================
   */

  const valorImportacaoXML =
    extrairTagICMSTot(xml, 'vII') ||
    extrairTag(xml, 'vII') ||
    '0.00'

  const valorTotalTributosXML =
    extrairTagICMSTot(xml, 'vTotTrib') ||
    extrairTag(xml, 'vTotTrib') ||
    '0.00'

  const valorICMSUFRemetXML =
    extrairTagICMSTot(xml, 'vICMSUFRemet') ||
    extrairTag(xml, 'vICMSUFRemet') ||
    '0.00'

  const valorICMSUFDestXML =
    extrairTagICMSTot(xml, 'vICMSUFDest') ||
    extrairTag(xml, 'vICMSUFDest') ||
    '0.00'

  /**
   * ===========================================================================
   * DEBUG
   * ===========================================================================
   */

  console.log({
    valor_importacao_xml: valorImportacaoXML,
    valor_total_tributos_xml: valorTotalTributosXML,
    valor_icms_uf_remetente_xml: valorICMSUFRemetXML,
    valor_icms_uf_destino_xml: valorICMSUFDestXML,
  })

  const data = {
    /**
     * =========================================================================
     * IDE
     * =========================================================================
     */

    operacao: call(() => nfe.tipoOperacao()),
    natureza_operacao: call(() => nfe.naturezaOperacao()),

    numero: call(() => nfe.nrNota()),
    serie: call(() => nfe.serie()),

    chave: formataChave(call(() => nfe.chave())),

    protocolo: `${call(() => nfe.protocolo())}${dataHoraProt ? ' - ' + dataHoraProt : ''}`,

    data_emissao: formataData(
      call(() => nfe.dataEmissao())
    ),

    data_saida: formataData(
      call(() => nfe.dataEntradaSaida())
    ),

    hora_saida: formataHora(
      call(() => nfe.dataEntradaSaida())
    ),

    /**
     * =========================================================================
     * EMITENTE
     * =========================================================================
     */

    emitente: {
      ...dadosEntidade(emitente),
      ...endereco(call(() => emitente.endereco()))
    },

    /**
     * =========================================================================
     * DESTINATÁRIO
     * =========================================================================
     */

    destinatario: {
      ...dadosEntidade(destinatario),
      ...endereco(call(() => destinatario.endereco()))
    },

    /**
     * =========================================================================
     * TRANSPORTADOR
     * =========================================================================
     */

    transportador: {
      ...dadosEntidade(transportador),
      ...endereco(call(() => transportador.endereco()))
    },

    modalidade_frete: call(() => nfe.modalidadeFrete()),
    modalidade_frete_texto: call(() => nfe.modalidadeFreteTexto()),

    /**
     * =========================================================================
     * TOTAIS
     * =========================================================================
     */

    base_calculo_icms: formataMoeda(
      call(() => total.baseCalculoIcms(), 0)
    ),

    imposto_icms: formataMoeda(
      call(() => total.valorIcms(), 0)
    ),

    base_calculo_icms_st: formataMoeda(
      call(() => total.baseCalculoIcmsST(), 0)
    ),

    imposto_icms_st: formataMoeda(
      call(() => total.valorIcmsST(), 0)
    ),

    valor_fcp: formataMoeda(
      call(() => total.valorFCP(), 0)
    ),

    valor_fcp_st: formataMoeda(
      call(() => total.valorFCPST(), 0)
    ),

    valor_fcp_st_retido: formataMoeda(
      call(() => total.valorFCPSTRetido(), 0)
    ),

    total_produtos: formataMoeda(
      call(() => total.valorProdutos(), 0)
    ),

    total_frete: formataMoeda(
      call(() => total.valorFrete(), 0)
    ),

    total_seguro: formataMoeda(
      call(() => total.valorSeguro(), 0)
    ),

    total_desconto: formataMoeda(
      call(() => total.valorDesconto(), 0)
    ),

    total_despesas: formataMoeda(
      call(() => total.valorOutrasDespesas(), 0)
    ),

    /**
     * =========================================================================
     * CAMPOS FALTANTES
     * =========================================================================
     */

    valor_importacao: formataMoeda(
      call(() => total.valorII(), valorImportacaoXML || 0)
    ),

    valor_icms_uf_remetente: formataMoeda(
      valorICMSUFRemetXML || 0
    ),

    valor_icms_uf_destino: formataMoeda(
      valorICMSUFDestXML || 0
    ),

    valor_total_tributos: formataMoeda(
      call(() => total.valorTributos(), valorTotalTributosXML || 0)
    ),

    /**
     * =========================================================================
     * IPI / PIS / COFINS
     * =========================================================================
     */

    total_ipi: formataMoeda(
      call(() => total.valorIPI(), 0)
    ),

    total_pis: formataMoeda(
      call(() => total.valorPIS(), 0)
    ),

    total_cofins: formataMoeda(
      call(() => total.valorCOFINS(), 0)
    ),

    /**
     * =========================================================================
     * TOTAL NOTA
     * =========================================================================
     */

    valor_total_nota: formataMoeda(
      call(() => total.valorNota(), 0)
    ),

    /**
     * =========================================================================
     * COBRANÇA
     * =========================================================================
     */

    duplicatas: duplicatas(nfe),

    /**
     * =========================================================================
     * ADICIONAIS
     * =========================================================================
     */

    informacoes_complementares: call(() =>
      nfe.informacoesComplementares()
    ),

    observacao: observacoes(nfe),

    /**
     * =========================================================================
     * ITENS
     * =========================================================================
     */

    itens: itens(nfe)
  }

  /**
   * ===========================================================================
   * VOLUMES
   * ===========================================================================
   */

  const volume = call(() => transporte.volume())

  if (volume) {
    data.volume_quantidade = formataMoeda(
      call(() => volume.quantidadeVolumes()),
      0
    )

    data.volume_especie = call(() => volume.especie())

    data.volume_marca = call(() => volume.marca())

    data.volume_numeracao = call(() => volume.numeracao())

    data.volume_peso_bruto = formataMoeda(
      call(() => volume.pesoBruto()),
      3
    )

    data.volume_peso_liquido = formataMoeda(
      call(() => volume.pesoLiquido()),
      3
    )
  }

  /**
   * ===========================================================================
   * VEÍCULO
   * ===========================================================================
   */

  const veiculo = call(() => transporte.veiculo())

  if (veiculo) {
    data.veiculo_placa = call(() => veiculo.placa())
    data.veiculo_placa_uf = call(() => veiculo.uf())
    data.veiculo_antt = call(() => veiculo.antt())
  }

  return data
}

/**
 * ============================================================================
 * NFC-E
 * ============================================================================
 */

function getTemplateNfceData(nfe) {
  return {
    ...getTemplateData(nfe),

    qrCode: call(() => nfe.qrCode()),
    url_consulta_qrcode: call(() => nfe.urlConsultaQrCode()),

    pagamentos: call(() => nfe.pagamentos(), []).map(p => ({
      forma: call(() => p.descricao()),
      valor: formataMoeda(
        call(() => p.valor())
      )
    }))
  }
}

/**
 * ============================================================================
 * MODELS
 * ============================================================================
 */

function modelNfe(nfe, logo = '', xml = '') {
  return {
    toHtml: (customTemplate = null) =>
      renderHtml(
        getTemplateData(nfe, xml),
        logo,
        customTemplate
      )
  }
}

function modelNfce(nfe, logo = '') {
  return {
    toHtml: (customTemplate = null) =>
      renderHtml(
        getTemplateNfceData(nfe),
        logo,
        customTemplate
      )
  }
}

/**
 * ============================================================================
 * EXPORTS
 * ============================================================================
 */

module.exports.fromNFe = function (nfe, logo = '') {
  if (!nfe || typeof nfe.nrNota !== 'function') {
    return modelNfe(null)
  }

  return modelNfe(nfe, logo)
}

module.exports.NfefromXML = function (xml, logo = '') {
  if (!xml || typeof xml !== 'string') {
    return modelNfe(null)
  }

  return modelNfe(NFe(xml), logo, xml)
}

module.exports.NfcefromXML = function (xml, logo = '') {
  if (!xml || typeof xml !== 'string') {
    return modelNfce(null)
  }

  return modelNfce(NFe(xml), logo)
}

module.exports.fromFile = function (filePath, logo = '') {
  if (!filePath || typeof filePath !== 'string') {
    return modelNfe(null)
  }

  let content = ''

  try {
    content = fs.readFileSync(filePath, 'utf8')
  } catch (err) {
    throw new Error(
      'File not found: ' +
      filePath +
      ' => ' +
      err.message
    )
  }

  return module.exports.NfefromXML(content, logo)
}
