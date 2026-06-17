export type StatusExperiencia = {
  emExperiencia: boolean
  fase: '1' | '2' | null
  diasRestantes: number | null
  venceEm: string | null
  atencao: boolean
}

export function calcularStatusExperiencia(
  periodo_experiencia: '30+30' | '45+45' | null | undefined,
  fase_experiencia: '1' | '2' | 'concluido' | null | undefined,
  data_fim_fase1: string | null | undefined,
  data_fim_fase2: string | null | undefined,
): StatusExperiencia {
  const EMPTY: StatusExperiencia = { emExperiencia: false, fase: null, diasRestantes: null, venceEm: null, atencao: false }
  if (!periodo_experiencia || !fase_experiencia || fase_experiencia === 'concluido') return EMPTY

  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const dataFimStr = fase_experiencia === '1' ? data_fim_fase1 : data_fim_fase2
  if (!dataFimStr) {
    return { emExperiencia: true, fase: fase_experiencia, diasRestantes: null, venceEm: null, atencao: false }
  }
  const fim = new Date(dataFimStr + 'T00:00:00')
  const diasRestantes = Math.round((fim.getTime() - hoje.getTime()) / 86400000)
  return {
    emExperiencia: true,
    fase: fase_experiencia,
    diasRestantes,
    venceEm: dataFimStr,
    atencao: diasRestantes <= 7,
  }
}
