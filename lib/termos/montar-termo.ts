import type { HorarioTermo, TermoLinhaDiff, TermoTipo } from './tipos'

const hm = (v: string | null) => (v ? v.slice(0, 5) : null)

export function formatarHorario(t: HorarioTermo | null): string[] {
  if (!t || !t.entrada) return ['—']
  const linhas: string[] = []
  linhas.push([t.nome, t.escala].filter(Boolean).join(' · ') || 'Horário')
  linhas.push(`Seg–Qui: ${hm(t.entrada)} às ${hm(t.saidaSegQui)}`)
  if (t.saidaSex && t.saidaSex !== t.saidaSegQui) linhas.push(`Sexta: ${hm(t.entradaSex ?? t.entrada)} às ${hm(t.saidaSex)}`)
  if (t.entradaSab && t.saidaSab) linhas.push(`Sábado: ${hm(t.entradaSab)} às ${hm(t.saidaSab)}`)
  if (t.almocoInicio && t.almocoFim) linhas.push(`Almoço: ${hm(t.almocoInicio)} às ${hm(t.almocoFim)}`)
  return linhas
}

type Par = { antes: string | null; depois: string | null }

export function montarDiffs(d: {
  posto?: Par; secretaria?: Par; supervisor?: Par; funcao?: Par
  horario?: { antes: HorarioTermo | null; depois: HorarioTermo | null }
}): TermoLinhaDiff[] {
  const out: TermoLinhaDiff[] = []
  const add = (rotulo: string, p: Par | undefined) => {
    if (!p) return
    const antes = p.antes ?? '—'
    const depois = p.depois ?? '—'
    out.push({ rotulo, antes, depois, mudou: antes !== depois })
  }
  add('Posto de Trabalho', d.posto)
  add('Secretaria', d.secretaria)
  add('Supervisor', d.supervisor)
  add('Função', d.funcao)
  if (d.horario) {
    const antes = formatarHorario(d.horario.antes).join('\n')
    const depois = formatarHorario(d.horario.depois).join('\n')
    out.push({ rotulo: 'Horário', antes, depois, mudou: antes !== depois })
  }
  return out
}

export function tipoDoTermo(tipos: string[]): TermoTipo {
  if (tipos.includes('transferencia')) return 'transferencia'
  if (tipos.includes('promocao')) return 'promocao'
  if (tipos.includes('mudanca_funcao')) return 'mudanca_funcao'
  if (tipos.includes('mudanca_horario')) return 'mudanca_horario'
  if (tipos.includes('desligamento')) return 'desligamento'
  if (tipos.includes('retorno_afastamento')) return 'retorno_afastamento'
  if (tipos.includes('afastamento')) return 'afastamento'
  if (tipos.includes('alteracao_salario')) return 'alteracao_salario'
  return 'outro'
}

const TITULOS: Record<TermoTipo, string> = {
  transferencia: 'TERMO DE TRANSFERÊNCIA DE COLABORADOR',
  mudanca_funcao: 'TERMO DE MUDANÇA DE FUNÇÃO',
  promocao: 'TERMO DE PROMOÇÃO',
  mudanca_horario: 'TERMO DE ALTERAÇÃO DE HORÁRIO',
  desligamento: 'TERMO DE DESLIGAMENTO',
  afastamento: 'TERMO DE AFASTAMENTO',
  retorno_afastamento: 'TERMO DE RETORNO DE AFASTAMENTO',
  alteracao_salario: 'TERMO DE ALTERAÇÃO SALARIAL',
  outro: 'TERMO DE MOVIMENTAÇÃO DE PESSOAL',
}

export function tituloDoTermo(tipos: string[]): string {
  return TITULOS[tipoDoTermo(tipos)]
}

/** Cor de destaque por tipo — usada no PDF e na página /movimentacoes. */
export const COR_TIPO: Record<TermoTipo, { hex: string; fundo: string }> = {
  transferencia:       { hex: '#1d4ed8', fundo: '#eff6ff' },
  mudanca_funcao:      { hex: '#7c3aed', fundo: '#f5f3ff' },
  promocao:            { hex: '#059669', fundo: '#ecfdf5' },
  mudanca_horario:     { hex: '#d97706', fundo: '#fffbeb' },
  desligamento:        { hex: '#dc2626', fundo: '#fef2f2' },
  afastamento:         { hex: '#ea580c', fundo: '#fff7ed' },
  retorno_afastamento: { hex: '#0891b2', fundo: '#ecfeff' },
  alteracao_salario:   { hex: '#4f46e5', fundo: '#eef2ff' },
  outro:               { hex: '#475569', fundo: '#f8fafc' },
}
