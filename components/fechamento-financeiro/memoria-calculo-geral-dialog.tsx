'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Layers } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { CustoFuncaoDetalhe, FechamentoFinanceiro } from '@/app/(admin)/fechamento-financeiro/actions'

function fmtBRL(v: number | null | undefined) {
  if (v == null) return '—'
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function GrupoEncargos({ titulo, itens }: { titulo: string; itens: [string, number | null][] }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-widest text-slate-400">{titulo}</p>
      <div className="mt-1 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        {itens.map(([label, value]) => (
          <div key={label} className="rounded-lg bg-slate-50 px-2 py-1.5 text-xs">
            <p className="text-slate-400">{label}</p>
            <p className="font-medium text-slate-700">{fmtBRL(value)}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

interface FuncaoResumo {
  funcao: string
  numFuncionarios: number
  salarioBase: number
  insalubridadeValor: number
  periculosidadeValor: number
  salarioBruto: number
  custoDetalhe: CustoFuncaoDetalhe | null
  custoTotal: number | null
  salarioPropSoma: number
  custoPropSoma: number
  custoMedioPorFunc: number
}

function computeResumoPorFuncao(dados: FechamentoFinanceiro[]): FuncaoResumo[] {
  const ativos = dados.filter(d => !d.is_afastado)

  const map = new Map<string, FechamentoFinanceiro[]>()
  for (const d of ativos) {
    const k = d.funcao ?? 'Sem Função'
    if (!map.has(k)) map.set(k, [])
    map.get(k)!.push(d)
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b, 'pt-BR'))
    .map(([funcao, items]) => {
      const ref = items[0]
      const custoPropSoma   = items.reduce((s, d) => s + (d.custo_prop ?? 0), 0)
      const salarioPropSoma = items.reduce((s, d) => s + d.salario_prop, 0)
      return {
        funcao,
        numFuncionarios:     items.length,
        salarioBase:         ref.salario_base,
        insalubridadeValor:  ref.insalubridade_valor,
        periculosidadeValor: ref.periculosidade_valor,
        salarioBruto:        ref.salario_bruto,
        custoDetalhe:        ref.custo_detalhe,
        custoTotal:          ref.custo_total,
        salarioPropSoma,
        custoPropSoma,
        custoMedioPorFunc:   items.length > 0 ? custoPropSoma / items.length : 0,
      }
    })
}

interface Props {
  dados: FechamentoFinanceiro[]
  mes: number
  ano: number
  MESES: string[]
}

export function MemoriaCalculoGeralDialog({ dados, mes, ano, MESES }: Props) {
  const [open, setOpen] = useState(false)
  const resumos = computeResumoPorFuncao(dados)

  const totalGeralCusto   = resumos.reduce((s, r) => s + r.custoPropSoma, 0)
  const totalGeralSalario = resumos.reduce((s, r) => s + r.salarioPropSoma, 0)
  const totalGeralFunc    = resumos.reduce((s, r) => s + r.numFuncionarios, 0)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={dados.length === 0}
        className="flex h-9 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 text-sm hover:bg-gray-50 disabled:opacity-50"
      >
        <Layers className="h-4 w-4 text-indigo-600" />
        Memória de Cálculo Geral
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Memória de Cálculo Geral</DialogTitle>
            <p className="text-sm text-slate-500">
              Custo por função — {MESES[mes]} {ano}. Cada bloco mostra a referência de{' '}
              <Link href="/funcoes" className="underline hover:text-slate-700">Funções e Salários</Link>{' '}
              (valor cheio, por funcionário) e o resultado proporcional real deste fechamento.
            </p>
          </DialogHeader>

          <div className="space-y-4 border-t border-slate-100 pt-4">
            {resumos.map(r => (
              <section key={r.funcao} className="rounded-xl border border-gray-100 bg-white shadow-sm">
                <div className="flex items-center justify-between rounded-t-xl bg-slate-800 px-4 py-2">
                  <span className="text-xs font-bold uppercase tracking-widest text-white">{r.funcao}</span>
                  <span className="text-xs text-slate-300">{r.numFuncionarios} func.</span>
                </div>

                <div className="space-y-3 p-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-slate-400">
                      Referência por funcionário (mês cheio) — Funções e Salários
                    </p>
                    <div className="mt-1 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
                      <div className="rounded-lg border border-gray-100 bg-white px-3 py-2">
                        <p className="text-[10px] uppercase tracking-widest text-slate-400">Salário Bruto</p>
                        <p className="font-medium text-slate-900">{fmtBRL(r.salarioBruto)}</p>
                      </div>
                      <div className="rounded-lg border border-gray-100 bg-white px-3 py-2">
                        <p className="text-[10px] uppercase tracking-widest text-slate-400">Custo Total</p>
                        <p className="font-medium text-slate-900">{fmtBRL(r.custoTotal)}</p>
                      </div>
                    </div>
                  </div>

                  {r.custoDetalhe == null ? (
                    <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                      Função sem custos cadastrados em{' '}
                      <Link href="/funcoes" className="underline">Funções e Salários</Link> — não entra no
                      total geral abaixo.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      <GrupoEncargos
                        titulo="Benefícios"
                        itens={[
                          ['VA', r.custoDetalhe.va], ['VR', r.custoDetalhe.vr], ['VT', r.custoDetalhe.vt],
                          ['Assid/Asseio', r.custoDetalhe.assid_asseio], ['BSS', r.custoDetalhe.bss],
                          ['Aux. Saúde', r.custoDetalhe.aux_saude], ['PLR', r.custoDetalhe.plr],
                        ]}
                      />
                      <GrupoEncargos
                        titulo="Provisões"
                        itens={[
                          ['1/12 13º', r.custoDetalhe.um_doze_decimo_terceiro],
                          ['1/3 Férias', r.custoDetalhe.um_terceiro_ferias],
                          ['Enc. Provisório', r.custoDetalhe.enc_provisorio],
                          ['1/12 Lei 12506', r.custoDetalhe.um_doze_lei_12506],
                          ['Multa 40%', r.custoDetalhe.multa_40_pct],
                        ]}
                      />
                      <GrupoEncargos
                        titulo="Encargos Sociais"
                        itens={[['INSS Patronal', r.custoDetalhe.enc_inss], ['FGTS', r.custoDetalhe.fgts]]}
                      />
                    </div>
                  )}

                  <div className="flex items-center justify-between rounded-lg bg-indigo-50 px-3 py-2 text-sm">
                    <span className="text-indigo-700">
                      Custo proporcional do mês — soma dos {r.numFuncionarios} funcionário(s)
                    </span>
                    <span className="font-semibold text-indigo-700">{fmtBRL(r.custoPropSoma)}</span>
                  </div>
                  <div className="flex items-center justify-between px-3 text-xs text-slate-400">
                    <span>Média por funcionário nesta função</span>
                    <span className="font-medium text-slate-600">{fmtBRL(r.custoMedioPorFunc)}</span>
                  </div>
                </div>
              </section>
            ))}

            <section className="rounded-xl border-2 border-slate-800 bg-slate-50 p-4">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Total Geral</p>
              <div className="mt-2 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-slate-400">Funcionários</p>
                  <p className="font-semibold text-slate-900">{totalGeralFunc}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-slate-400">Salário Prop. Total</p>
                  <p className="font-semibold text-slate-900">{fmtBRL(totalGeralSalario)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-slate-400">Custo Prop. Total</p>
                  <p className="font-semibold text-indigo-700">{fmtBRL(totalGeralCusto)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-slate-400">Custo Médio Geral</p>
                  <p className="font-semibold text-slate-900">
                    {fmtBRL(totalGeralFunc > 0 ? totalGeralCusto / totalGeralFunc : 0)}
                  </p>
                </div>
              </div>
              <p className="mt-2 text-xs text-slate-400">
                Não inclui funcionários afastados (sem custo contratual) nem funções sem custos cadastrados.
              </p>
            </section>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
