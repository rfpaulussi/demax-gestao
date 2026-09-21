import type { Achado, CamposAcordo, FuncionarioCalc } from '../tipos'
import { FORM_VAZIO, montarCampos, type FormState } from '../formulario'
import { sugerirDiasAjuste } from '../dias'
import { agruparPorJornada, resumoCalculo } from '../movimentos'
import { validarAcordo, type MapaFeriados } from '../validar'
import type { ResultadoIA } from './normalizar'

export interface SimulacaoPedido {
  form: FormState
  campos: CamposAcordo
  /** Erros e avisos com as MESMAS regras do modal (limites da CLT, divisão, turnos, feriados). */
  achados: Achado[]
  funcionarios: number
  grupos: number
  /** Do primeiro grupo de compensação. */
  horasTotalMin: number
  minutosPorDia: number
}

/**
 * O que aconteceria se o pedido fosse aplicado ao formulário: escolhe os dias (se o pedido não os deu),
 * monta os campos e roda a validação. Usado no laboratório (servidor) e no modal (navegador).
 */
export function simularPedido(r: ResultadoIA, funcs: FuncionarioCalc[], feriados: MapaFeriados, hoje: string): SimulacaoPedido | null {
  if (!r.template) return null
  const ids = new Set(funcs.map(f => f.id))
  const form: FormState = { ...FORM_VAZIO, ...r.form }
  if (r.template !== 'T5' && form.datasAjuste.length === 0) {
    const base = montarCampos(r.template, form, ids)
    form.datasAjuste = sugerirDiasAjuste({ ...base, datasAjuste: [] }, funcs, feriados, hoje, r.quantidadeDias ?? undefined)
  }
  const campos = montarCampos(r.template, form, ids)
  const grupos = agruparPorJornada(campos, funcs)

  const vistos = new Set<string>()
  const achados: Achado[] = []
  for (const g of grupos.length ? grupos : [[]]) {
    for (const a of validarAcordo(campos, g, feriados)) {
      const chave = `${a.codigo}|${a.funcionarioId ?? ''}|${a.mensagem}`
      if (!vistos.has(chave)) { vistos.add(chave); achados.push(a) }
    }
  }
  const resumo = grupos.length ? resumoCalculo(campos, grupos[0]) : null
  return {
    form,
    campos,
    achados,
    funcionarios: funcs.length,
    grupos: grupos.length,
    horasTotalMin: resumo?.horasTotalMin ?? 0,
    minutosPorDia: resumo?.minutosPorDia ?? 0,
  }
}
