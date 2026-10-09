// Tailwind precisa de classes literais — por isso o mapa explícito por cor.

export type CorFoco =
  | 'emerald' | 'blue' | 'orange' | 'violet' | 'cyan'
  | 'rose' | 'amber' | 'slate' | 'indigo' | 'pink'

export type TemaCor = {
  card: string   // fundo gradiente + borda do bloco
  texto: string  // cor do texto principal
  chip: string   // chip de posto / pill
  dot: string    // bolinha / barra sólida
  ring: string   // anel de seleção
}

export const TEMAS: Record<CorFoco, TemaCor> = {
  emerald: { card: 'bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-300', texto: 'text-emerald-900', chip: 'bg-emerald-200/70 text-emerald-900', dot: 'bg-emerald-500', ring: 'ring-emerald-500' },
  blue:    { card: 'bg-gradient-to-br from-blue-50 to-blue-100 border-blue-300',          texto: 'text-blue-900',    chip: 'bg-blue-200/70 text-blue-900',       dot: 'bg-blue-500',    ring: 'ring-blue-500' },
  orange:  { card: 'bg-gradient-to-br from-orange-50 to-orange-100 border-orange-300',    texto: 'text-orange-900',  chip: 'bg-orange-200/70 text-orange-900',   dot: 'bg-orange-500',  ring: 'ring-orange-500' },
  violet:  { card: 'bg-gradient-to-br from-violet-50 to-violet-100 border-violet-300',    texto: 'text-violet-900',  chip: 'bg-violet-200/70 text-violet-900',   dot: 'bg-violet-500',  ring: 'ring-violet-500' },
  cyan:    { card: 'bg-gradient-to-br from-cyan-50 to-cyan-100 border-cyan-300',          texto: 'text-cyan-900',    chip: 'bg-cyan-200/70 text-cyan-900',       dot: 'bg-cyan-500',    ring: 'ring-cyan-500' },
  rose:    { card: 'bg-gradient-to-br from-rose-50 to-rose-100 border-rose-300',          texto: 'text-rose-900',    chip: 'bg-rose-200/70 text-rose-900',       dot: 'bg-rose-500',    ring: 'ring-rose-500' },
  amber:   { card: 'bg-gradient-to-br from-amber-50 to-amber-100 border-amber-300',       texto: 'text-amber-900',   chip: 'bg-amber-200/70 text-amber-900',     dot: 'bg-amber-500',   ring: 'ring-amber-500' },
  slate:   { card: 'bg-gradient-to-br from-slate-50 to-slate-200 border-slate-300',       texto: 'text-slate-800',   chip: 'bg-slate-300/70 text-slate-800',     dot: 'bg-slate-500',   ring: 'ring-slate-500' },
  indigo:  { card: 'bg-gradient-to-br from-indigo-50 to-indigo-100 border-indigo-300',    texto: 'text-indigo-900',  chip: 'bg-indigo-200/70 text-indigo-900',   dot: 'bg-indigo-500',  ring: 'ring-indigo-500' },
  pink:    { card: 'bg-gradient-to-br from-pink-50 to-pink-100 border-pink-300',          texto: 'text-pink-900',    chip: 'bg-pink-200/70 text-pink-900',       dot: 'bg-pink-500',    ring: 'ring-pink-500' },
}

export const CORES_FOCO = Object.keys(TEMAS) as CorFoco[]

export function temaDe(cor: string | null | undefined): TemaCor {
  return TEMAS[(cor as CorFoco) ?? 'slate'] ?? TEMAS.slate
}

export type Periodo = 'manha' | 'tarde'

export const PERIODOS: { id: Periodo; label: string; faixa: string }[] = [
  { id: 'manha', label: 'Manhã', faixa: 'bg-sky-400' },
  { id: 'tarde', label: 'Tarde', faixa: 'bg-orange-400' },
]

/** Visitas por período: sempre 3 espaços; um 4º/5º aparece conforme os anteriores são preenchidos. */
export const SLOTS_MIN = 3
export const SLOTS_MAX = 5

/** Quantos espaços exibir no período, dado o maior nº de ordem já usado. */
export function slotsVisiveis(maiorOrdemUsada: number): number {
  return Math.min(SLOTS_MAX, Math.max(SLOTS_MIN, maiorOrdemUsada + 1))
}

export const DIAS_CURTOS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

/** Dias úteis exibidos por semana (seg–sex). */
export const DIAS_UTEIS = 5

/** Feriado ou ponto facultativo de Mogi das Cruzes num dia da agenda. */
export type FeriadoDia = {
  nome: string
  tipo: 'nacional' | 'estadual' | 'municipal' | 'facultativo'
  ate_hora: string | null
}

/** Visitas mínimas por semana inteira (sem descontar feriados). */
export const TOTAL_SLOTS = DIAS_UTEIS * PERIODOS.length * SLOTS_MIN

/** Visitas mínimas da semana descontando os dias de feriado de lei. */
export function slotsDaSemana(feriadosDeLei: number): number {
  return Math.max(0, DIAS_UTEIS - feriadosDeLei) * PERIODOS.length * SLOTS_MIN
}
