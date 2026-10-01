import type { Ausencia, CamposAcordo, FuncionarioCalc } from './tipos'
import { datasDoEvento, folgasDe } from './movimentos'
import { fmtDataBR } from './tempo'

export interface DataDoAcordo { data: string; papel: string }

const TIPO_TEXTO: Record<Ausencia['tipo'], string> = { atestado: 'atestado', afastamento: 'afastamento', ferias: 'férias' }

/** Todas as datas em que o funcionário precisa estar presente ou escalado, com o papel dela no acordo (vale para qualquer template). */
export function datasDoAcordoDe(c: CamposAcordo, f: { id: string }): DataDoAcordo[] {
  const out: DataDoAcordo[] = []
  for (const d of datasDoEvento(c)) out.push({ data: d, papel: c.template === 'T2' ? 'dia da dispensa' : 'dia trabalhado' })
  for (const d of folgasDe(c, f)) out.push({ data: d, papel: c.template === 'T3' ? 'dia sem trabalhar' : 'dia de folga' })
  for (const d of c.template === 'T5' ? [] : c.datasAjuste) {
    out.push({ data: d, papel: c.template === 'T1' ? 'dia de redução' : 'dia de acréscimo' })
  }
  return out
}

/** Todas as datas do acordo (de qualquer funcionário), ordenadas e sem repetição: serve para buscar as ausências no banco. */
export function todasAsDatasDoAcordo(c: CamposAcordo, funcs: { id: string }[]): string[] {
  const set = new Set<string>()
  for (const f of funcs) for (const x of datasDoAcordoDe(c, f)) set.add(x.data)
  return Array.from(set).sort()
}

/** Mensagem única por funcionário com cada data do acordo que cai numa ausência dele; vazio se não há conflito. */
export function conflitosDeAusencia(c: CamposAcordo, f: FuncionarioCalc, ausencias: Ausencia[]): string[] {
  const out: string[] = []
  for (const { data, papel } of datasDoAcordoDe(c, f)) {
    const a = ausencias.find(x => x.inicio <= data && data <= x.fim)
    if (a) out.push(`${fmtDataBR(data)} (${papel}) cai em ${TIPO_TEXTO[a.tipo]} de ${fmtDataBR(a.inicio)} a ${fmtDataBR(a.fim)}`)
  }
  return out
}
