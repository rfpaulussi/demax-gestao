'use client'

import { useState } from 'react'
import { Pencil, AlertCircle } from 'lucide-react'
import { atualizarSalarioFuncao } from './actions'

// ─── tipos ────────────────────────────────────────────────────────────────────

type Custos = {
  va: number | null; vr: number | null; vt: number | null
  enc_inss: number | null; fgts: number | null
  assid_asseio: number | null; bss: number | null; aux_saude: number | null
  plr: number | null
  um_doze_decimo_terceiro: number | null; um_terceiro_ferias: number | null
  enc_provisorio: number | null; um_doze_lei_12506: number | null
  multa_40_pct: number | null; total_por_func: number | null
} | null

type Funcao = {
  id: string
  nome: string
  salario_base: number | null
  insalubridade_perc: number | null
  insalubridade_valor: number | null
  periculosidade_perc: number | null
  periculosidade_valor: number | null
  custos: Custos
}

// ─── helpers ──────────────────────────────────────────────────────────────────

const SALARIO_MINIMO = 1621.00

function brl(v: number | null | undefined) {
  if (v == null) return '—'
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtPerc(v: number | null) {
  if (v == null || v === 0) return '—'
  return `${v}%`
}

function n(s: string): number | null {
  const v = parseFloat(s.replace(',', '.'))
  return isNaN(v) ? null : v
}

function somaTotal(form: Record<string, string>, insalValor: number, periculosValor: number): number {
  const sal = parseFloat(form.salario_base) || 0
  const campos = ['va','vr','vt','enc_inss','fgts','assid_asseio','bss','aux_saude','plr',
    'um_doze_decimo_terceiro','um_terceiro_ferias','enc_provisorio','um_doze_lei_12506','multa_40_pct']
  const encargos = campos.reduce((acc, k) => acc + (parseFloat(form[k]) || 0), 0)
  return Math.round((sal + insalValor + periculosValor + encargos) * 100) / 100
}

// ─── input monetário ──────────────────────────────────────────────────────────

function InputR$({
  label, value, onChange,
}: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-slate-500">
        {label}
      </label>
      <div className="relative">
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">R$</span>
        <input
          type="number"
          step="0.01"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full rounded-lg border border-gray-200 py-1.5 pl-8 pr-2 text-sm focus:border-slate-400 focus:outline-none"
        />
      </div>
    </div>
  )
}

// ─── componente principal ─────────────────────────────────────────────────────

export function FuncoesClient({ funcoes }: { funcoes: Funcao[] }) {
  const [editando, setEditando] = useState<Funcao | null>(null)
  const [form, setForm]         = useState<Record<string, string>>({})
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro]         = useState<string | null>(null)

  function set(campo: string, valor: string) {
    setForm(prev => ({ ...prev, [campo]: valor }))
  }

  function abrirModal(f: Funcao) {
    const c = f.custos
    setEditando(f)
    setForm({
      salario_base:            String(f.salario_base ?? ''),
      insalubridade_perc:      String(f.insalubridade_perc ?? '0'),
      periculosidade_perc:     String(f.periculosidade_perc ?? '0'),
      va:                      String(c?.va ?? ''),
      vr:                      String(c?.vr ?? ''),
      vt:                      String(c?.vt ?? ''),
      enc_inss:                String(c?.enc_inss ?? ''),
      fgts:                    String(c?.fgts ?? ''),
      assid_asseio:            String(c?.assid_asseio ?? ''),
      bss:                     String(c?.bss ?? ''),
      aux_saude:               String(c?.aux_saude ?? ''),
      plr:                     String(c?.plr ?? ''),
      um_doze_decimo_terceiro: String(c?.um_doze_decimo_terceiro ?? ''),
      um_terceiro_ferias:      String(c?.um_terceiro_ferias ?? ''),
      enc_provisorio:          String(c?.enc_provisorio ?? ''),
      um_doze_lei_12506:       String(c?.um_doze_lei_12506 ?? ''),
      multa_40_pct:            String(c?.multa_40_pct ?? ''),
    })
    setErro(null)
  }

  function fecharModal() { setEditando(null); setErro(null) }

  const insalValor = (() => {
    const perc = parseFloat(form.insalubridade_perc)
    if (!perc) return 0
    return Math.round(perc / 100 * SALARIO_MINIMO * 100) / 100
  })()

  const periculosValor = (() => {
    const perc = parseFloat(form.periculosidade_perc)
    const sal  = parseFloat(form.salario_base)
    if (!perc || !sal) return 0
    return Math.round(perc / 100 * sal * 100) / 100
  })()

  const totalBrutoModal = (parseFloat(form.salario_base) || 0) + insalValor + periculosValor
  const totalPorFunc    = somaTotal(form, insalValor, periculosValor)

  async function salvar() {
    if (!editando) return
    const sal = parseFloat(form.salario_base)
    if (!sal || sal <= 0) { setErro('Salário base inválido'); return }
    setSalvando(true); setErro(null)
    const res = await atualizarSalarioFuncao(editando.id, {
      salario_base:            sal,
      insalubridade_perc:      parseFloat(form.insalubridade_perc) || 0,
      insalubridade_valor:     insalValor,
      periculosidade_perc:     parseFloat(form.periculosidade_perc) || 0,
      periculosidade_valor:    periculosValor,
      va:                      n(form.va),
      vr:                      n(form.vr),
      vt:                      n(form.vt),
      enc_inss:                n(form.enc_inss),
      fgts:                    n(form.fgts),
      assid_asseio:            n(form.assid_asseio),
      bss:                     n(form.bss),
      aux_saude:               n(form.aux_saude),
      plr:                     n(form.plr),
      um_doze_decimo_terceiro: n(form.um_doze_decimo_terceiro),
      um_terceiro_ferias:      n(form.um_terceiro_ferias),
      enc_provisorio:          n(form.enc_provisorio),
      um_doze_lei_12506:       n(form.um_doze_lei_12506),
      multa_40_pct:            n(form.multa_40_pct),
      total_por_func:          totalPorFunc || null,
    })
    setSalvando(false)
    if (!res.success) { setErro(res.error); return }
    fecharModal()
  }

  return (
    <>
      {/* ── Tabela ──────────────────────────────────────────────────────── */}
      <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-slate-50">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-slate-500">Função</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-widest text-slate-500">Salário Base</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-widest text-slate-500">Insalubridade</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-widest text-slate-500">Periculosidade</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-widest text-slate-500">Total Bruto</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-widest text-slate-500">Custo Total/mês</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {funcoes.map(f => {
              const totalBruto = (f.salario_base ?? 0) + (f.insalubridade_valor ?? 0) + (f.periculosidade_valor ?? 0)
              return (
                <tr key={f.id} className="hover:bg-slate-50/50">
                  <td className="px-4 py-3 font-medium text-gray-900">{f.nome}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-700">{brl(f.salario_base)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {f.insalubridade_perc ? (
                      <span className="text-purple-700">{fmtPerc(f.insalubridade_perc)} · {brl(f.insalubridade_valor)}</span>
                    ) : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {f.periculosidade_perc ? (
                      <span className="text-orange-700">{fmtPerc(f.periculosidade_perc)} · {brl(f.periculosidade_valor)}</span>
                    ) : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold text-gray-900">
                    {f.salario_base ? brl(totalBruto) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {f.custos?.total_por_func != null ? (
                      <span className="font-semibold text-indigo-700">{brl(f.custos.total_por_func)}</span>
                    ) : (
                      <span className="text-xs text-amber-500">sem encargos</span>
                    )}
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

      {/* ── Modal ────────────────────────────────────────────────────────── */}
      {editando && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-10">
          <div className="w-full max-w-2xl rounded-xl bg-white shadow-xl">

            <div className="border-b border-gray-100 px-6 py-4">
              <h2 className="font-bold text-gray-900">{editando.nome}</h2>
              <p className="text-xs text-gray-400 mt-0.5">Salário, adicionais e encargos mensais</p>
            </div>

            <div className="space-y-5 px-6 py-5">

              {/* Remuneração */}
              <section>
                <p className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-400">Remuneração</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-slate-500">
                      Salário Base
                    </label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">R$</span>
                      <input
                        type="number" step="0.01"
                        value={form.salario_base}
                        onChange={e => set('salario_base', e.target.value)}
                        className="w-full rounded-lg border border-gray-200 py-1.5 pl-8 pr-2 text-sm focus:border-slate-400 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-slate-500">
                      Insalubridade %
                    </label>
                    <div className="flex gap-2">
                      <div className="relative w-20 shrink-0">
                        <input
                          type="number" step="1" min="0" max="100"
                          value={form.insalubridade_perc}
                          onChange={e => set('insalubridade_perc', e.target.value)}
                          className="w-full rounded-lg border border-gray-200 py-1.5 pl-2 pr-6 text-sm focus:border-slate-400 focus:outline-none"
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">%</span>
                      </div>
                      <div className="flex-1 rounded-lg border border-gray-100 bg-purple-50 px-2 py-1.5 text-xs text-purple-700">
                        = {brl(insalValor)}<span className="ml-1 text-purple-400">sal. mín.</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-slate-500">
                      Periculosidade %
                    </label>
                    <div className="flex gap-2">
                      <div className="relative w-20 shrink-0">
                        <input
                          type="number" step="1" min="0" max="100"
                          value={form.periculosidade_perc}
                          onChange={e => set('periculosidade_perc', e.target.value)}
                          className="w-full rounded-lg border border-gray-200 py-1.5 pl-2 pr-6 text-sm focus:border-slate-400 focus:outline-none"
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">%</span>
                      </div>
                      <div className="flex-1 rounded-lg border border-gray-100 bg-orange-50 px-2 py-1.5 text-xs text-orange-700">
                        = {brl(periculosValor)}<span className="ml-1 text-orange-400">sal. base</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  Total bruto recebido pelo funcionário:&nbsp;
                  <strong className="text-slate-900">{brl(totalBrutoModal)}</strong>
                </div>
              </section>

              {/* Benefícios */}
              <section>
                <p className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-400">Benefícios</p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <InputR$ label="VA" value={form.va} onChange={v => set('va', v)} />
                  <InputR$ label="VR" value={form.vr} onChange={v => set('vr', v)} />
                  <InputR$ label="VT" value={form.vt} onChange={v => set('vt', v)} />
                  <InputR$ label="Assid/Asseio" value={form.assid_asseio} onChange={v => set('assid_asseio', v)} />
                  <InputR$ label="BSS" value={form.bss} onChange={v => set('bss', v)} />
                  <InputR$ label="Aux. Saúde" value={form.aux_saude} onChange={v => set('aux_saude', v)} />
                  <InputR$ label="PLR" value={form.plr} onChange={v => set('plr', v)} />
                </div>
              </section>

              {/* Provisões */}
              <section>
                <p className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-400">Provisões</p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <InputR$ label="1/12 13º" value={form.um_doze_decimo_terceiro} onChange={v => set('um_doze_decimo_terceiro', v)} />
                  <InputR$ label="1/3 Férias" value={form.um_terceiro_ferias} onChange={v => set('um_terceiro_ferias', v)} />
                  <InputR$ label="Enc. Provisório" value={form.enc_provisorio} onChange={v => set('enc_provisorio', v)} />
                  <InputR$ label="1/12 Lei 12506" value={form.um_doze_lei_12506} onChange={v => set('um_doze_lei_12506', v)} />
                  <InputR$ label="Multa 40%" value={form.multa_40_pct} onChange={v => set('multa_40_pct', v)} />
                </div>
              </section>

              {/* Encargos Sociais */}
              <section>
                <p className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-400">Encargos Sociais</p>
                <div className="grid grid-cols-2 gap-3">
                  <InputR$ label="INSS Patronal" value={form.enc_inss} onChange={v => set('enc_inss', v)} />
                  <InputR$ label="FGTS" value={form.fgts} onChange={v => set('fgts', v)} />
                </div>
              </section>

              {/* Total calculado */}
              <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-indigo-500">Custo Total / Funcionário / Mês</p>
                    <p className="mt-0.5 text-xs text-indigo-400">Custo real para a empresa (auto-calculado)</p>
                  </div>
                  <p className="text-2xl font-bold text-indigo-900">{brl(totalPorFunc)}</p>
                </div>
              </div>

              {erro && (
                <p className="flex items-center gap-1.5 text-sm text-red-600">
                  <AlertCircle className="h-4 w-4 shrink-0" />{erro}
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t border-gray-100 px-6 py-4">
              <button onClick={fecharModal} className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100">
                Cancelar
              </button>
              <button onClick={salvar} disabled={salvando}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50">
                {salvando ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
