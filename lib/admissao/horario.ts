import { temAlmocoSextaProprio, temSabadoDistinto, temSextaDistinta, type TurnoHorarios } from '@/lib/turnos/escala'

export interface PeriodoHorario { entrada: string; saida: string }

/** Sexta/sábado no formulário têm um período só; a pausa, se houver, vai como observação. */
export interface DiaEspecial extends PeriodoHorario { pausa: string | null }

export interface HorarioCadastro {
  /** Qual dos dois quadrinhos da linha de dias marcar. null = escala sem noção de dia da semana (12x36). */
  dias: 'seg_sex' | 'seg_qui' | null
  periodo1: PeriodoHorario
  periodo2: PeriodoHorario | null
  sexta: DiaEspecial | null
  sabado: DiaEspecial | null
  /** Quadrinho "5x1 ou 6x1" do formulário. */
  escala5x1: boolean
  /** Escalas que o formulário não lista (5x2, 12x36, jovem aprendiz) saem escritas ao lado de "Outro". */
  escalaOutra: string | null
}

const hhmm = (h: string | null | undefined) => (h ? h.slice(0, 5) : '')

function pausa(inicio: string | null | undefined, fim: string | null | undefined): string | null {
  return inicio && fim ? `${hhmm(inicio)}–${hhmm(fim)}` : null
}

/** Traduz um turno do catálogo para o bloco "HORÁRIO DE TRABALHO / TURNO" do Cadastro de Funcionários. */
export function horarioParaCadastro(t: TurnoHorarios): HorarioCadastro {
  const escala5x1 = t.tipo_escala === '5x1'
  const escalaOutra =
    t.tipo_escala === '5x2' ? '5x2'
      : t.tipo_escala === '12x36' ? '12x36'
        : t.tipo_escala === 'jovem_aprendiz' ? 'Jovem Aprendiz'
          : null

  const temAlmoco = !!(t.hora_inicio_almoco && t.hora_fim_almoco)
  const periodo1 = {
    entrada: hhmm(t.hora_entrada),
    saida: temAlmoco ? hhmm(t.hora_inicio_almoco) : hhmm(t.hora_saida_seg_qui),
  }
  const periodo2 = temAlmoco
    ? { entrada: hhmm(t.hora_fim_almoco), saida: hhmm(t.hora_saida_seg_qui) }
    : null

  if (t.tipo_escala === '12x36') {
    return { dias: null, periodo1, periodo2, sexta: null, sabado: null, escala5x1, escalaOutra }
  }
  if (t.tipo_escala === 'jovem_aprendiz') {
    return { dias: 'seg_sex', periodo1: { entrada: hhmm(t.hora_entrada), saida: hhmm(t.hora_saida_seg_qui) }, periodo2: null, sexta: null, sabado: null, escala5x1, escalaOutra }
  }

  // Mesma regra de formatarResumoTurno: no 5x2 a sexta é distinta quando há saída própria;
  // nos demais, quando qualquer campo da sexta difere (ver temSextaDistinta).
  const sextaDistinta = t.tipo_escala === '5x2' ? t.hora_saida_sex !== null : temSextaDistinta(t)
  const sexta: DiaEspecial | null = sextaDistinta
    ? {
        entrada: hhmm(t.hora_entrada_sex ?? t.hora_entrada),
        saida: hhmm(t.hora_saida_sex ?? t.hora_saida_seg_qui),
        pausa: temAlmocoSextaProprio(t) ? pausa(t.hora_inicio_almoco_sex, t.hora_fim_almoco_sex) : null,
      }
    : null
  const sabado: DiaEspecial | null = temSabadoDistinto(t)
    ? {
        entrada: hhmm(t.hora_entrada_sabado),
        saida: hhmm(t.hora_saida_sabado),
        pausa: pausa(t.hora_inicio_almoco_sabado, t.hora_fim_almoco_sabado),
      }
    : null

  return { dias: sexta ? 'seg_qui' : 'seg_sex', periodo1, periodo2, sexta, sabado, escala5x1, escalaOutra }
}
