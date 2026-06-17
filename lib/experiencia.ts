export type PeriodoExperiencia = '30+30' | '45+45'

export type StatusExperiencia = {
  emExperiencia: boolean
  fase: '1' | '2' | 'concluido' | null
  diasRestantes: number | null
  dataFimFase: string | null
  alertaCritico: boolean
  labelBadge: string
}

export function calcularStatusExperiencia(
  dataAdmissao: string | null | undefined,
  periodoExperiencia: PeriodoExperiencia | null | undefined,
): StatusExperiencia {
  const EMPTY: StatusExperiencia = {
    emExperiencia: false, fase: null, diasRestantes: null,
    dataFimFase: null, alertaCritico: false, labelBadge: '',
  }
  if (!periodoExperiencia || !dataAdmissao) return EMPTY

  const dias = periodoExperiencia === '30+30' ? 30 : 45
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const admissao = new Date(dataAdmissao + 'T00:00:00')

  const dataFimFase1 = new Date(admissao)
  dataFimFase1.setDate(dataFimFase1.getDate() + dias)

  const dataFimFase2 = new Date(dataFimFase1)
  dataFimFase2.setDate(dataFimFase2.getDate() + dias)

  if (hoje > dataFimFase2) {
    return { emExperiencia: false, fase: 'concluido', diasRestantes: 0, dataFimFase: null, alertaCritico: false, labelBadge: '' }
  }

  if (hoje > dataFimFase1) {
    const diasRestantes = Math.ceil((dataFimFase2.getTime() - hoje.getTime()) / 86400000)
    return {
      emExperiencia: true,
      fase: '2',
      diasRestantes,
      dataFimFase: dataFimFase2.toISOString().split('T')[0],
      alertaCritico: diasRestantes <= 7,
      labelBadge: `F2 · ${diasRestantes}d`,
    }
  }

  const diasRestantes = Math.ceil((dataFimFase1.getTime() - hoje.getTime()) / 86400000)
  return {
    emExperiencia: true,
    fase: '1',
    diasRestantes,
    dataFimFase: dataFimFase1.toISOString().split('T')[0],
    alertaCritico: diasRestantes <= 7,
    labelBadge: `F1 · ${diasRestantes}d`,
  }
}
