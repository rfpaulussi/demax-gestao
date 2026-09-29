/**
 * Extrai o registro (RE) do funcionário a partir da matrícula do SESMT.
 * Formato SESMT: "001-000-107622" → registro no sistema: "107622" (sem zeros à esquerda,
 * espelhando o formato salvo em funcionarios.registro).
 * Retorna null se não conseguir extrair um número válido.
 */
export function extrairRegistroDeMatricula(matriculaRaw: string): string | null {
  const partes = matriculaRaw.trim().split('-')
  const ultima = partes[partes.length - 1]?.trim()
  if (!ultima) return null
  const n = parseInt(ultima, 10)
  if (Number.isNaN(n)) return null
  return String(n)
}

/**
 * Extrai o código CID do texto da coluna "CID Abonado".
 * "A09 - Diarréia e gastroenterite..." → "A09"
 * "Sem CID" → null
 */
export function extrairCodigoCid(cidTexto: string): string | null {
  const t = cidTexto.trim()
  if (t === '' || t.toLowerCase() === 'sem cid') return null
  const idx = t.indexOf(' - ')
  return idx === -1 ? t : t.slice(0, idx).trim()
}

/**
 * Interpreta o texto da coluna "Afastamento" (ex: "15 dias", "999 dias", "9999 dias").
 * 999 e 9999 dias são convenções do SESMT pra "benefício em aberto / sem previsão real
 * de retorno" — a Data Retorno associada é só um placeholder, não uma data confiável.
 */
export function ehAfastamentoIndeterminado(diasTexto: string): boolean {
  const n = parseInt(diasTexto.trim(), 10)
  return n === 999 || n === 9999
}

/**
 * Converte data no formato dd/mm/aaaa (como vem do Excel via célula formatada como texto
 * ou já normalizada pelo parser do client) para ISO yyyy-mm-dd.
 */
export function dataBrParaIso(dataBr: string): string | null {
  const m = dataBr.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!m) return null
  const [, d, mo, y] = m
  return `${y}-${mo}-${d}`
}

/**
 * Determina se o Motivo do SESMT indica origem ocupacional (acidente/doença do trabalho).
 */
export function motivoIndicaOcupacional(motivo: string): boolean {
  return motivo.trim().toLowerCase() === 'acidente/doença do trabalho'
}

/**
 * A "Data Retorno" do SESMT é o dia em que o funcionário volta ao trabalho — ou seja, o dia
 * seguinte ao último dia de afastamento. Já `atestados.data_fim` no sistema guarda o ÚLTIMO
 * dia afastado (inclusive). As duas datas são sempre 1 dia diferentes por definição — não é
 * divergência. Esta função converte a data de retorno do SESMT pro "último dia afastado"
 * equivalente, pra comparar com data_fim do sistema de forma correta.
 */
export function ultimoDiaAfastadoAntesDoRetorno(dataRetornoIso: string): string {
  const [y, m, d] = dataRetornoIso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() - 1)
  const yy = dt.getUTCFullYear()
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(dt.getUTCDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

export type CategoriaCid = 'igual' | 'sistema_sem_cid' | 'sesmt_sem_cid' | 'subcodigo' | 'cid_diferente'

const baseCid = (c: string) => c.slice(0, 3).toUpperCase()

/**
 * Classifica a diferença de CID entre SESMT e sistema. "subcodigo" = mesmo grupo de 3
 * caracteres (F41.9 vs F41.1, R52.0 vs R52) — costuma ser detalhe de cadastro, não um CID
 * de fato diferente.
 */
export function classificarCid(cidSesmt: string | null, cidSistema: string | null): CategoriaCid {
  if (cidSesmt === cidSistema) return 'igual'
  if (!cidSistema) return 'sistema_sem_cid'
  if (!cidSesmt) return 'sesmt_sem_cid'
  return baseCid(cidSesmt) === baseCid(cidSistema) ? 'subcodigo' : 'cid_diferente'
}

export const LABEL_CATEGORIA_CID: Record<Exclude<CategoriaCid, 'igual'>, string> = {
  sistema_sem_cid: 'Sistema sem CID',
  sesmt_sem_cid: 'SESMT sem CID',
  subcodigo: 'Subcódigo diferente',
  cid_diferente: 'CID diferente',
}

/**
 * Último dia afastado segundo o SESMT (retorno − 1), no mesmo critério de
 * `atestados.data_fim`. null quando o afastamento é indeterminado (999/9999 dias) — a data
 * de retorno nesse caso é só um placeholder.
 */
export function fimSesmt(diasTexto: string, dataRetornoIso: string): string | null {
  return ehAfastamentoIndeterminado(diasTexto) ? null : ultimoDiaAfastadoAntesDoRetorno(dataRetornoIso)
}

export function diferencaDias(aIso: string, bIso: string): number {
  const t = (s: string) => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d) / 86400000 }
  return Math.abs(t(aIso) - t(bIso))
}
