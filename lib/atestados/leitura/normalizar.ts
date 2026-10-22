import type { AvisosPreenchimento, LeituraAtestado, Preenchimento } from './tipos'

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/

export function dataValida(s: string | null | undefined): s is string {
  if (!s) return false
  const m = ISO.exec(s)
  if (!m) return false
  const [ano, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const d = new Date(Date.UTC(ano, mes - 1, dia))
  return d.getUTCFullYear() === ano && d.getUTCMonth() === mes - 1 && d.getUTCDate() === dia
}

function utc(iso: string): number {
  const [a, m, d] = iso.split('-').map(Number)
  return Date.UTC(a, m - 1, d)
}

export function somarDias(iso: string, dias: number): string {
  return new Date(utc(iso) + dias * 86_400_000).toISOString().slice(0, 10)
}

/** B − A, em dias. */
export function diferencaDias(a: string, b: string): number {
  return Math.round((utc(b) - utc(a)) / 86_400_000)
}

export interface ResultadoCid {
  /** Código que existe em `cid_referencia`, ou null. */
  codigo: string | null
  /** Código como entendido (com ponto), para mostrar ao supervisor. */
  lido: string | null
  /** true quando caiu na categoria porque a subcategoria não está na referência. */
  aproximado: boolean
}

/** "J399" → "J39.9"; procura exato e, se não houver, a categoria ("J39"). */
export function normalizarCid(lido: string | null, referencia: ReadonlySet<string>): ResultadoCid {
  if (!lido) return { codigo: null, lido: null, aproximado: false }
  const limpo = lido.replace(/\s+/g, '').replace(',', '.').toUpperCase()
  const m = /^([A-Z])(\d{2})\.?(\d{1,2})?$/.exec(limpo)
  if (!m) return { codigo: null, lido: limpo, aproximado: false }
  const categoria = `${m[1]}${m[2]}`
  const completo = m[3] ? `${categoria}.${m[3]}` : categoria
  if (referencia.has(completo)) return { codigo: completo, lido: completo, aproximado: false }
  if (m[3] && referencia.has(categoria)) return { codigo: categoria, lido: completo, aproximado: true }
  return { codigo: null, lido: completo, aproximado: false }
}

/** Valores iniciais do modal e avisos amarelos. Só regras determinísticas, nada de nota da IA. */
export function prepararPreenchimento(leitura: LeituraAtestado, hoje: string, codigosCid: ReadonlySet<string>): Preenchimento {
  const avisos: AvisosPreenchimento = { dataInicio: null, dias: null, cid: null }

  let dataInicio = ''
  if (dataValida(leitura.dataInicio)) {
    dataInicio = leitura.dataInicio
    const passado = diferencaDias(dataInicio, hoje)
    if (leitura.origemDataInicio === 'emissao') {
      avisos.dataInicio = 'O papel não traz a data de início; usei a data de emissão. Confira.'
    } else if (passado > 60) {
      avisos.dataInicio = 'O início é de mais de 60 dias atrás. Confira a data.'
    } else if (passado < -30) {
      avisos.dataInicio = 'O início é daqui a mais de 30 dias. Confira a data.'
    }
  } else {
    avisos.dataInicio = 'Não consegui ler a data de início.'
  }

  let dias = ''
  if (leitura.dias !== null && Number.isInteger(leitura.dias) && leitura.dias >= 1 && leitura.dias <= 365) {
    dias = String(leitura.dias)
  } else {
    avisos.dias = 'Não consegui ler o número de dias.'
  }

  const dataFim = dataInicio && dias ? somarDias(dataInicio, Number(dias) - 1) : ''

  let cidCodigo = ''
  if (!leitura.cid?.trim()) {
    avisos.cid = 'Não achei CID no papel. Confira; se não houver, marque "Atestado sem CID".'
  } else {
    const r = normalizarCid(leitura.cid, codigosCid)
    if (r.codigo) {
      cidCodigo = r.codigo
      if (r.aproximado) avisos.cid = `CID lido: ${r.lido?.slice(0, 12)}. Usei a categoria ${r.codigo}. Confira.`
    } else {
      avisos.cid = `CID lido: ${(r.lido ?? leitura.cid).slice(0, 12)}. Não está na referência; escolha na lista.`
    }
  }

  return { dataInicio, dias, dataFim, cidCodigo, avisos }
}
