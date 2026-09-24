import type { HorarioTermo } from './tipos'

const hm = (v: string | null | undefined) => (v ? v.slice(0, 5) : '')

/** Compara horários por CONTEÚDO (não por id nem nome). Antes vazio => não mudou (primeira atribuição). */
export function horarioMudou(antes: HorarioTermo | null, depois: HorarioTermo | null): boolean {
  if (!antes || !depois) return false
  const chave = (t: HorarioTermo) =>
    [
      hm(t.entrada), hm(t.saidaSegQui), hm(t.entradaSex), hm(t.saidaSex),
      hm(t.entradaSab), hm(t.saidaSab), hm(t.almocoInicio), hm(t.almocoFim),
      (t.escala ?? '').trim().toLowerCase(),
    ].join('|')
  return chave(antes) !== chave(depois)
}

const norm = (v: string | null | undefined) => (v ?? '').trim().toLowerCase()

/** Supervisor mudou só se ambos conhecidos e diferentes. Origem desconhecida (legado) => false. */
export function supervisorMudou(origem: string | null | undefined, destino: string | null | undefined): boolean {
  if (!norm(origem) || !norm(destino)) return false
  return norm(origem) !== norm(destino)
}

/** Consolida os movimentos de turno de um grupo (em ordem): primeiro valor_antes e último valor_depois. */
export function consolidarTurnos(
  movs: { valor_antes: string | null; valor_depois: string | null }[],
): { antesId: string | null; depoisId: string | null } | null {
  if (movs.length === 0) return null
  return { antesId: movs[0].valor_antes, depoisId: movs[movs.length - 1].valor_depois }
}

/**
 * Regra única de "exige termo para o RH": só alteração de horário, escala ou troca de supervisor.
 * - mudanca_horario: exige se o conteúdo do turno mudou de fato.
 * - transferencia: exige se supervisor origem != destino (ambos conhecidos) OU horário mudou.
 */
export function exigeTermo(i: {
  tipos: string[]
  horario?: { antes: HorarioTermo | null; depois: HorarioTermo | null } | null
  supervisorOrigem?: string | null
  supervisorDestino?: string | null
}): boolean {
  const mudouHorario = !!i.horario && horarioMudou(i.horario.antes, i.horario.depois)
  if (i.tipos.includes('transferencia')) {
    return supervisorMudou(i.supervisorOrigem, i.supervisorDestino) || mudouHorario
  }
  if (i.tipos.includes('mudanca_horario')) return mudouHorario
  return false
}
