// lib/absenteismo/parametros.ts
import type { FiltrosAbsenteismo } from './filtros'

export interface ParametrosTela {
  ano: number
  mes: number
  filtros: Required<{ [K in keyof FiltrosAbsenteismo]: string | null }>
}

type SearchParams = { [chave: string]: string | string[] | undefined }

const primeiro = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v)
const limpar = (v: string | undefined): string | null => (v && v.trim() !== '' ? v.trim() : null)

const PRIMEIRO_ANO = 2026

/** Lê e valida mês, ano e filtros da URL. Valores inválidos caem no padrão (mês de hoje). */
export function lerParametros(sp: SearchParams, hoje: string): ParametrosTela {
  const anoHoje = Number(hoje.slice(0, 4))
  const mesHoje = Number(hoje.slice(5, 7))

  let ano = Number(primeiro(sp.ano))
  if (!Number.isInteger(ano) || ano < PRIMEIRO_ANO || ano > anoHoje) ano = anoHoje

  let mes = Number(primeiro(sp.mes))
  if (!Number.isInteger(mes) || mes < 1 || mes > 12) mes = ano === anoHoje ? mesHoje : 12
  if (ano === anoHoje && mes > mesHoje) mes = mesHoje

  return {
    ano,
    mes,
    filtros: {
      secretaria: limpar(primeiro(sp.secretaria)),
      posto_id: limpar(primeiro(sp.posto)),
      supervisor_id: limpar(primeiro(sp.supervisor)),
    },
  }
}

/** Query string da tela (para links). `sobrescrever` troca ou remove (null) filtros. */
export function montarQuery(
  p: ParametrosTela,
  sobrescrever: Partial<ParametrosTela['filtros']> = {},
): string {
  const f = { ...p.filtros, ...sobrescrever }
  const q = new URLSearchParams()
  q.set('mes', String(p.mes))
  q.set('ano', String(p.ano))
  if (f.secretaria) q.set('secretaria', f.secretaria)
  if (f.posto_id) q.set('posto', f.posto_id)
  if (f.supervisor_id) q.set('supervisor', f.supervisor_id)
  return q.toString()
}

export function anosDisponiveis(hoje: string): number[] {
  const anoHoje = Number(hoje.slice(0, 4))
  const out: number[] = []
  for (let a = PRIMEIRO_ANO; a <= anoHoje; a++) out.push(a)
  return out
}
