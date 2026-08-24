'use client'

import { useState } from 'react'
import { Loader2, FileDown } from 'lucide-react'
import { gerarAnaliseGeral, type AnaliseGeralSecoes } from '@/app/(admin)/relatorios/analise-geral/actions'

const sel = 'h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-400'

const SECOES_LABELS: { key: keyof AnaliseGeralSecoes; label: string }[] = [
  { key: 'atestados', label: 'Atestados' },
  { key: 'faltas', label: 'Faltas' },
  { key: 'mudancasFuncao', label: 'Mudanças de Função' },
  { key: 'coberturasInsalubres', label: 'Coberturas Insalubres' },
  { key: 'efetivoPostos', label: 'Efetivo x Postos' },
  { key: 'advertencias', label: 'Advertências' },
]

const SECOES_PADRAO: AnaliseGeralSecoes = {
  atestados: true,
  faltas: true,
  mudancasFuncao: true,
  coberturasInsalubres: true,
  efetivoPostos: true,
  advertencias: true,
}

export function AnaliseGeralClient() {
  const [periodoDias, setPeriodoDias] = useState(90)
  const [secoes, setSecoes] = useState<AnaliseGeralSecoes>(SECOES_PADRAO)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function toggleSecao(key: keyof AnaliseGeralSecoes) {
    setSecoes(prev => ({ ...prev, [key]: !prev[key] }))
  }

  async function handleGerar() {
    setLoading(true)
    setError(null)
    try {
      const resultado = await gerarAnaliseGeral({ periodoDias, secoes })
      if ('error' in resultado) {
        setError(resultado.error)
        return
      }
      const blob = new Blob([resultado.markdown], { type: 'text/markdown;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const hoje = new Date().toISOString().slice(0, 10)
      const a = document.createElement('a')
      a.href = url
      a.download = `analise-geral-${periodoDias}dias-${hoje}.md`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao gerar relatório.')
    } finally {
      setLoading(false)
    }
  }

  const nenhumaSecaoMarcada = Object.values(secoes).every(v => !v)

  return (
    <div className="space-y-5 rounded-xl border border-gray-100 border-t-4 border-t-emerald-500 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <label className="text-xs font-semibold uppercase tracking-widest text-gray-500">Período</label>
        <select
          className={sel}
          value={periodoDias}
          onChange={e => setPeriodoDias(Number(e.target.value))}
        >
          <option value={30}>Últimos 30 dias</option>
          <option value={60}>Últimos 60 dias</option>
          <option value={90}>Últimos 90 dias</option>
        </select>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-gray-500">Seções</p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {SECOES_LABELS.map(({ key, label }) => (
            <label key={key} className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={secoes[key]}
                onChange={() => toggleSecao(key)}
                className="h-4 w-4 rounded border-gray-300"
              />
              {label}
            </label>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="button"
        onClick={handleGerar}
        disabled={loading || nenhumaSecaoMarcada}
        className="flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
        {loading ? 'Gerando...' : 'Gerar relatório MD'}
      </button>
    </div>
  )
}
