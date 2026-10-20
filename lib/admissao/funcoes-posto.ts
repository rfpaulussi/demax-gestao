export type FiltroPostoDaFuncao = 'apenas_sms' | 'todos' | 'sem_sms'

const normalizar = (nome: string) => nome.trim().normalize('NFC').toUpperCase()

/** Supervisor não é admitido por solicitação (ver página de Postos). */
export function funcaoAdmissivel(nome: string): boolean {
  return !normalizar(nome).startsWith('SUPERVISOR')
}

/** Em quais postos a função pode ser admitida: Agente A só na SMS, Encarregado em qualquer um, as demais fora da SMS. */
export function filtroPostoDaFuncao(nome: string): FiltroPostoDaFuncao {
  const n = normalizar(nome)
  if (n.startsWith('AGENTE') && n.endsWith(' A')) return 'apenas_sms'
  if (n.startsWith('ENCARREGADO')) return 'todos'
  return 'sem_sms'
}

export function postoAceitaFuncao(filtro: FiltroPostoDaFuncao, secretaria: string | null): boolean {
  if (filtro === 'todos') return true
  return filtro === 'apenas_sms' ? secretaria === 'SMS' : secretaria !== 'SMS'
}
