'use client'

import { useState } from 'react'
import { Pencil } from 'lucide-react'
import { atualizarSalarioFuncao } from './actions'

type Funcao = {
  id: string
  nome: string
  salario_base: number | null
  insalubridade_perc: number | null
  insalubridade_valor: number | null
  periculosidade_perc: number | null
  periculosidade_valor: number | null
}

const SALARIO_MINIMO = 1621.00

function fmt(v: number | null) {
  if (v == null) return '—'
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtPerc(v: number | null) {
  if (v == null || v === 0) return '—'
  return `${v}%`
}

export function FuncoesClient({ funcoes }: { funcoes: Funcao[] }) {
  const [editando, setEditando] = useState<Funcao | null>(null)
  const [form, setForm] = useState({
    salario_base: '',
    insalubridade_perc: '',
    periculosidade_perc: '',
  })
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  function abrirModal(f: Funcao) {
    setEditando(f)
    setForm({
      salario_base:       String(f.salario_base ?? ''),
      insalubridade_perc: String(f.insalubridade_perc ?? '0'),
      periculosidade_perc: String(f.periculosidade_perc ?? '0'),
    })
    setErro(null)
  }

  function fecharModal() {
    setEditando(null)
    setErro(null)
  }

  const insalValor = (() => {
    const perc = parseFloat(form.insalubridade_perc)
    if (!perc) return 0
    return Math.round(perc / 100 * SALARIO_MINIMO * 100) / 100
  })()

  const periculosValor = (() => {
    const perc = parseFloat(form.periculosidade_perc)
    const sal = parseFloat(form.salario_base)
    if (!perc || !sal) return 0
    return Math.round(perc / 100 * sal * 100) / 100
  })()

  async function salvar() {
    if (!editando) return
    const sal = parseFloat(form.salario_base)
    if (!sal || sal <= 0) { setErro('Salário base inválido'); return }

    setSalvando(true)
    setErro(null)
    const res = await atualizarSalarioFuncao(editando.id, {
      salario_base:         sal,
      insalubridade_perc:   parseFloat(form.insalubridade_perc) || 0,
      insalubridade_valor:  insalValor,
      periculosidade_perc:  parseFloat(form.periculosidade_perc) || 0,
      periculosidade_valor: periculosValor,
    })
    setSalvando(false)
    if (!res.success) { setErro(res.error); return }
    fecharModal()
  }

  return (
    <>
      <div className="rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-slate-50">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-slate-500">Função</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-widest text-slate-500">Salário Base</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-widest text-slate-500">Insalubridade</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-widest text-slate-500">Periculosidade</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-widest text-slate-500">Total Bruto</th>
              <th className="w-12" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {funcoes.map(f => {
              const totalBruto = (f.salario_base ?? 0) + (f.insalubridade_valor ?? 0) + (f.periculosidade_valor ?? 0)
              return (
                <tr key={f.id} className="hover:bg-slate-50/50">
                  <td className="px-4 py-3 font-medium text-gray-900">{f.nome}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-700">{fmt(f.salario_base)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-700">
                    {f.insalubridade_perc ? (
                      <span className="text-purple-700">
                        {fmtPerc(f.insalubridade_perc)} · {fmt(f.insalubridade_valor)}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-700">
                    {f.periculosidade_perc ? (
                      <span className="text-orange-700">
                        {fmtPerc(f.periculosidade_perc)} · {fmt(f.periculosidade_valor)}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold text-gray-900">
                    {f.salario_base ? fmt(totalBruto) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => abrirModal(f)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Modal de edição */}
      {editando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
            <div className="border-b border-gray-100 px-6 py-4">
              <h2 className="font-semibold text-gray-900">{editando.nome}</h2>
              <p className="text-xs text-gray-500 mt-0.5">Editar salário e adicionais</p>
            </div>

            <div className="space-y-4 px-6 py-5">
              {/* Salário base */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500 mb-1">
                  Salário Base
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">R$</span>
                  <input
                    type="number"
                    step="0.01"
                    value={form.salario_base}
                    onChange={e => setForm(f => ({ ...f, salario_base: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm focus:border-slate-400 focus:outline-none"
                  />
                </div>
              </div>

              {/* Insalubridade */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500 mb-1">
                  Insalubridade
                </label>
                <div className="flex gap-2">
                  <div className="relative w-28">
                    <input
                      type="number"
                      step="1"
                      min="0"
                      max="100"
                      value={form.insalubridade_perc}
                      onChange={e => setForm(f => ({ ...f, insalubridade_perc: e.target.value }))}
                      className="w-full rounded-lg border border-gray-200 py-2 pl-3 pr-7 text-sm focus:border-slate-400 focus:outline-none"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">%</span>
                  </div>
                  <div className="flex-1 rounded-lg border border-gray-100 bg-slate-50 px-3 py-2 text-sm text-gray-500">
                    = {fmt(insalValor)}
                    <span className="ml-1 text-xs text-gray-400">(sobre sal. mín. R${SALARIO_MINIMO.toLocaleString('pt-BR')})</span>
                  </div>
                </div>
              </div>

              {/* Periculosidade */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500 mb-1">
                  Periculosidade
                </label>
                <div className="flex gap-2">
                  <div className="relative w-28">
                    <input
                      type="number"
                      step="1"
                      min="0"
                      max="100"
                      value={form.periculosidade_perc}
                      onChange={e => setForm(f => ({ ...f, periculosidade_perc: e.target.value }))}
                      className="w-full rounded-lg border border-gray-200 py-2 pl-3 pr-7 text-sm focus:border-slate-400 focus:outline-none"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">%</span>
                  </div>
                  <div className="flex-1 rounded-lg border border-gray-100 bg-slate-50 px-3 py-2 text-sm text-gray-500">
                    = {fmt(periculosValor)}
                    <span className="ml-1 text-xs text-gray-400">(sobre sal. base)</span>
                  </div>
                </div>
              </div>

              {erro && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t border-gray-100 px-6 py-4">
              <button
                onClick={fecharModal}
                className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
              >
                Cancelar
              </button>
              <button
                onClick={salvar}
                disabled={salvando}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
              >
                {salvando ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
