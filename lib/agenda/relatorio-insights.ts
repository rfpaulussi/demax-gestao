import { MIN_PERMANENCIA_MIN } from '@/lib/agenda/visitas'
import type { RelatorioMensal } from '@/app/(admin)/agenda/relatorio-actions'

export type Insight = { nivel: 'alto' | 'medio' | 'info'; supervisor: string | null; texto: string }

/** Cumprimento mínimo aceitável por supervisor; abaixo disso (com amostra mínima) vira ponto de atenção. */
export const CUMPRIMENTO_MINIMO = 50
const AMOSTRA_MINIMA = 5
const REPLAN_ALTO = 10

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`

/** Pontos de atenção do mês, gerados dos próprios números do relatório (mais graves primeiro). */
export function gerarInsights(d: RelatorioMensal, anterior: RelatorioMensal | null): Insight[] {
  const r: Insight[] = []

  for (const s of d.supervisores) {
    if (s.planejadas === 0 && s.semanasSemAgenda > 0) {
      r.push({ nivel: 'alto', supervisor: s.nome, texto: `não montou agenda em ${plural(s.semanasSemAgenda, 'semana', 'semanas')} e não tem visita planejada no mês` })
    } else if (s.semanasSemAgenda > 0) {
      r.push({ nivel: 'medio', supervisor: s.nome, texto: `${plural(s.semanasSemAgenda, 'semana', 'semanas')} sem agenda` })
    }
    if (s.pct !== null && s.planejadas >= AMOSTRA_MINIMA && s.pct < CUMPRIMENTO_MINIMO) {
      r.push({
        nivel: 'alto',
        supervisor: s.nome,
        texto: s.cumpridas === 0
          ? `nenhum check-in nas ${plural(s.planejadas, 'visita planejada', 'visitas planejadas')} (0%)`
          : `cumprimento de ${s.pct}% (${plural(s.faltas, 'falta', 'faltas')} em ${s.planejadas} planejadas)`,
      })
    }
    if (s.faltas >= 3 && s.faltasSemMotivo / s.faltas >= 0.6) {
      r.push({ nivel: 'medio', supervisor: s.nome, texto: `${plural(s.faltasSemMotivo, 'falta', 'faltas')} de ${s.faltas} sem justificativa no "Fechar o dia"` })
    }
    if (s.fuiSemRegistro >= 2) {
      r.push({ nivel: 'medio', supervisor: s.nome, texto: `diz ter ido ao posto sem registrar o check-in em ${plural(s.fuiSemRegistro, 'visita', 'visitas')} (problema de uso do sistema, não de presença)` })
    }
    if (s.semFoto > 0) r.push({ nivel: 'medio', supervisor: s.nome, texto: `${plural(s.semFoto, 'visita', 'visitas')} sem a foto obrigatória` })
    if (s.tempoMedioMin !== null && s.tempoMedioMin < MIN_PERMANENCIA_MIN) {
      r.push({ nivel: 'medio', supervisor: s.nome, texto: `tempo médio de ${s.tempoMedioMin} min nos postos, abaixo do mínimo de ${MIN_PERMANENCIA_MIN} min` })
    }
    if (s.replanejamentos >= REPLAN_ALTO) r.push({ nivel: 'medio', supervisor: s.nome, texto: `${s.replanejamentos} replanejamentos no mês` })
    if (s.foraRaio > 0) r.push({ nivel: 'info', supervisor: s.nome, texto: `${plural(s.foraRaio, 'check-in', 'check-ins')} fora do raio do posto` })
  }

  if (anterior && d.totais.pct !== null && anterior.totais.pct !== null) {
    const delta = d.totais.pct - anterior.totais.pct
    if (delta <= -10) r.push({ nivel: 'alto', supervisor: null, texto: `cumprimento geral caiu ${Math.abs(delta)} pontos em relação ao mês anterior (${anterior.totais.pct}% → ${d.totais.pct}%)` })
    else if (delta >= 10) r.push({ nivel: 'info', supervisor: null, texto: `cumprimento geral subiu ${delta} pontos em relação ao mês anterior (${anterior.totais.pct}% → ${d.totais.pct}%)` })
  }
  if (d.postosNaoVisitados.length > 0) {
    r.push({ nivel: 'info', supervisor: null, texto: `${plural(d.postosNaoVisitados.length, 'posto', 'postos')} sem nenhuma visita no mês` })
  }

  const ordem = { alto: 0, medio: 1, info: 2 } as const
  return r.sort((a, b) => ordem[a.nivel] - ordem[b.nivel] || (a.supervisor ?? '~').localeCompare(b.supervisor ?? '~'))
}
