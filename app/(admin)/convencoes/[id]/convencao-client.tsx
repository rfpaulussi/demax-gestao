'use client'

import { useState, useTransition } from 'react'
import { Calculator, Save, Send, RotateCcw, Zap, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react'
import { salvarValoresFuncoes, publicarConvencao, voltarParaRascunho, aplicarConvencao } from '../actions'
import type { ValorFuncaoInput } from '../actions'

// ─── tipos ────────────────────────────────────────────────────────────────────

type FuncaoAtual = {
  id: string
  nome: string
  salario_base: number | null
  insalubridade_perc: number | null
  insalubridade_valor: number | null
  periculosidade_perc: number | null
  periculosidade_valor: number | null
  custos: {
    va: number | null; vr: number | null; vt: number | null
    enc_inss: number | null; fgts: number | null
    assid_asseio: number | null; bss: number | null; aux_saude: number | null
    plr: number | null; um_doze_decimo_terceiro: number | null
    um_terceiro_ferias: number | null; enc_provisorio: number | null
    um_doze_lei_12506: number | null; multa_40_pct: number | null
    total_por_func: number | null
  } | null
}

type ValorExistente = {
  funcao_id: string
  salario_base: number
  total_por_func: number | null
  va: number | null; vr: number | null; vt: number | null
  enc_inss: number | null; fgts: number | null
  assid_asseio: number | null; bss: number | null; aux_saude: number | null
  plr: number | null; insalubridade_perc: number | null; insalubridade_valor: number | null
  periculosidade_perc: number | null; periculosidade_valor: number | null
  um_doze_decimo_terceiro: number | null; um_terceiro_ferias: number | null
  enc_provisorio: number | null; um_doze_lei_12506: number | null; multa_40_pct: number | null
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function brl(v: number | null | undefined) {
  if (v == null) return '—'
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function reajustar(v: number | null | undefined, pct: number): number | null {
  if (v == null) return null
  return Math.round(v * (1 + pct / 100) * 100) / 100
}

function strToNum(s: string): number | null {
  const n = parseFloat(s.replace(',', '.'))
  return isNaN(n) ? null : n
}

// ─── tabela de valores por função ─────────────────────────────────────────────

function TabelaValores({
  convencaoId,
  funcoes,
  valoresExistentes,
  percentual,
  isRascunho,
}: {
  convencaoId: string
  funcoes: FuncaoAtual[]
  valoresExistentes: ValorExistente[]
  percentual: number | null
  isRascunho: boolean
}) {
  const inicial: Record<string, Record<string, string>> = {}
  for (const f of funcoes) {
    const ex = valoresExistentes.find(v => v.funcao_id === f.id)
    const c = f.custos
    inicial[f.id] = {
      salario_base:             String(ex?.salario_base       ?? f.salario_base       ?? ''),
      total_por_func:           String(ex?.total_por_func     ?? c?.total_por_func    ?? ''),
      va:                       String(ex?.va                 ?? c?.va                ?? ''),
      vr:                       String(ex?.vr                 ?? c?.vr                ?? ''),
      vt:                       String(ex?.vt                 ?? c?.vt                ?? ''),
      enc_inss:                 String(ex?.enc_inss           ?? c?.enc_inss          ?? ''),
      fgts:                     String(ex?.fgts               ?? c?.fgts              ?? ''),
      assid_asseio:             String(ex?.assid_asseio       ?? c?.assid_asseio      ?? ''),
      bss:                      String(ex?.bss                ?? c?.bss               ?? ''),
      aux_saude:                String(ex?.aux_saude          ?? c?.aux_saude         ?? ''),
      plr:                      String(ex?.plr                ?? c?.plr               ?? ''),
      insalubridade_perc:       String(ex?.insalubridade_perc     ?? f.insalubridade_perc      ?? ''),
      insalubridade_valor:      String(ex?.insalubridade_valor    ?? f.insalubridade_valor     ?? ''),
      periculosidade_perc:      String(ex?.periculosidade_perc    ?? f.periculosidade_perc     ?? ''),
      periculosidade_valor:     String(ex?.periculosidade_valor   ?? f.periculosidade_valor    ?? ''),
      um_doze_decimo_terceiro:  String(ex?.um_doze_decimo_terceiro ?? c?.um_doze_decimo_terceiro ?? ''),
      um_terceiro_ferias:       String(ex?.um_terceiro_ferias      ?? c?.um_terceiro_ferias      ?? ''),
      enc_provisorio:           String(ex?.enc_provisorio          ?? c?.enc_provisorio          ?? ''),
      um_doze_lei_12506:        String(ex?.um_doze_lei_12506       ?? c?.um_doze_lei_12506       ?? ''),
      multa_40_pct:             String(ex?.multa_40_pct            ?? c?.multa_40_pct            ?? ''),
    }
  }

  const [vals, setVals]           = useState(inicial)
  const [expandido, setExpandido] = useState<string | null>(null)
  const [saving, startSave]       = useTransition()
  const [erro, setErro]           = useState<string | null>(null)
  const [ok, setOk]               = useState(false)

  const CAMPOS_CUSTO = [
    { key: 'va',                      label: 'VA'             },
    { key: 'vr',                      label: 'VR'             },
    { key: 'vt',                      label: 'VT'             },
    { key: 'enc_inss',                label: 'INSS'           },
    { key: 'fgts',                    label: 'FGTS'           },
    { key: 'assid_asseio',            label: 'Assid/Asseio'   },
    { key: 'bss',                     label: 'BSS'            },
    { key: 'aux_saude',               label: 'Aux. Saúde'     },
    { key: 'plr',                     label: 'PLR'            },
    { key: 'insalubridade_perc',      label: 'Insalub. %'     },
    { key: 'insalubridade_valor',     label: 'Insalub. R$'    },
    { key: 'periculosidade_perc',     label: 'Periculosid. %' },
    { key: 'periculosidade_valor',    label: 'Periculosid. R$'},
    { key: 'um_doze_decimo_terceiro', label: '1/12 13º'       },
    { key: 'um_terceiro_ferias',      label: '1/3 Férias'     },
    { key: 'enc_provisorio',          label: 'Enc. Prov.'     },
    { key: 'um_doze_lei_12506',       label: '1/12 Lei 12506' },
    { key: 'multa_40_pct',            label: 'Multa 40%'      },
    { key: 'total_por_func',          label: 'Total/Func'     },
  ]

  function calcularAutomatico() {
    if (!percentual) return
    const novo = { ...vals }
    for (const f of funcoes) {
      const c = f.custos
      novo[f.id] = {
        salario_base:             String(reajustar(f.salario_base,              percentual) ?? ''),
        total_por_func:           String(reajustar(c?.total_por_func,           percentual) ?? ''),
        va:                       String(reajustar(c?.va,                       percentual) ?? ''),
        vr:                       String(reajustar(c?.vr,                       percentual) ?? ''),
        vt:                       String(reajustar(c?.vt,                       percentual) ?? ''),
        enc_inss:                 String(reajustar(c?.enc_inss,                 percentual) ?? ''),
        fgts:                     String(reajustar(c?.fgts,                     percentual) ?? ''),
        assid_asseio:             String(reajustar(c?.assid_asseio,             percentual) ?? ''),
        bss:                      String(reajustar(c?.bss,                      percentual) ?? ''),
        aux_saude:                String(reajustar(c?.aux_saude,                percentual) ?? ''),
        plr:                      String(reajustar(c?.plr,                      percentual) ?? ''),
        insalubridade_perc:       String(reajustar(f.insalubridade_perc,        percentual) ?? ''),
        insalubridade_valor:      String(reajustar(f.insalubridade_valor,       percentual) ?? ''),
        periculosidade_perc:      String(reajustar(f.periculosidade_perc,       percentual) ?? ''),
        periculosidade_valor:     String(reajustar(f.periculosidade_valor,      percentual) ?? ''),
        um_doze_decimo_terceiro:  String(reajustar(c?.um_doze_decimo_terceiro,  percentual) ?? ''),
        um_terceiro_ferias:       String(reajustar(c?.um_terceiro_ferias,       percentual) ?? ''),
        enc_provisorio:           String(reajustar(c?.enc_provisorio,           percentual) ?? ''),
        um_doze_lei_12506:        String(reajustar(c?.um_doze_lei_12506,        percentual) ?? ''),
        multa_40_pct:             String(reajustar(c?.multa_40_pct,             percentual) ?? ''),
      }
    }
    setVals(novo)
  }

  function setField(funcaoId: string, campo: string, value: string) {
    setVals(prev => ({ ...prev, [funcaoId]: { ...prev[funcaoId], [campo]: value } }))
  }

  function handleSalvar() {
    setErro(null)
    setOk(false)
    const payload: ValorFuncaoInput[] = funcoes.map(f => {
      const v = vals[f.id]
      const salario_base = strToNum(v.salario_base)
      if (!salario_base) return null
      return {
        funcao_id:                f.id,
        salario_base,
        total_por_func:           strToNum(v.total_por_func),
        va:                       strToNum(v.va),
        vr:                       strToNum(v.vr),
        vt:                       strToNum(v.vt),
        enc_inss:                 strToNum(v.enc_inss),
        fgts:                     strToNum(v.fgts),
        assid_asseio:             strToNum(v.assid_asseio),
        bss:                      strToNum(v.bss),
        aux_saude:                strToNum(v.aux_saude),
        plr:                      strToNum(v.plr),
        insalubridade_perc:       strToNum(v.insalubridade_perc),
        insalubridade_valor:      strToNum(v.insalubridade_valor),
        periculosidade_perc:      strToNum(v.periculosidade_perc),
        periculosidade_valor:     strToNum(v.periculosidade_valor),
        um_doze_decimo_terceiro:  strToNum(v.um_doze_decimo_terceiro),
        um_terceiro_ferias:       strToNum(v.um_terceiro_ferias),
        enc_provisorio:           strToNum(v.enc_provisorio),
        um_doze_lei_12506:        strToNum(v.um_doze_lei_12506),
        multa_40_pct:             strToNum(v.multa_40_pct),
      }
    }).filter(Boolean) as ValorFuncaoInput[]

    if (payload.length === 0) { setErro('Preencha o salário base de pelo menos uma função'); return }
    startSave(async () => {
      const res = await salvarValoresFuncoes(convencaoId, payload)
      if (!res.success) { setErro(res.error ?? 'Erro ao salvar'); return }
      setOk(true)
    })
  }

  return (
    <div className="space-y-4">
      {/* Barra de ações */}
      {isRascunho && (
        <div className="flex flex-wrap items-center gap-3">
          {percentual != null && (
            <button
              type="button"
              onClick={calcularAutomatico}
              className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-sm font-semibold text-green-700 hover:bg-green-100"
            >
              <Calculator className="h-4 w-4" />
              Calcular pelo reajuste de {percentual}%
            </button>
          )}
          <button
            type="button"
            onClick={handleSalvar}
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Salvando…' : 'Salvar Valores'}
          </button>
          {ok  && <span className="flex items-center gap-1.5 text-sm text-green-600"><CheckCircle2 className="h-4 w-4" /> Salvo!</span>}
          {erro && <span className="text-sm text-red-600">{erro}</span>}
        </div>
      )}

      {/* Tabela */}
      <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-gray-400 w-48">Função</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-widest text-gray-400">Salário Atual</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-widest text-green-600">Salário Novo ★</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-widest text-gray-400">Total Atual</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-widest text-green-600">Total Novo</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-widest text-gray-400">Detalhes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {funcoes.map(f => {
                const v = vals[f.id]
                const salNovo = strToNum(v?.salario_base)
                const totNovo = strToNum(v?.total_por_func)
                const delta = salNovo != null && f.salario_base != null
                  ? salNovo - f.salario_base : null

                return (
                  <>
                    <tr key={f.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{f.nome}</td>
                      <td className="px-4 py-3 text-right text-gray-500">{brl(f.salario_base)}</td>
                      <td className="px-4 py-3 text-right">
                        {isRascunho ? (
                          <input
                            type="number"
                            step="0.01"
                            value={v?.salario_base ?? ''}
                            onChange={e => setField(f.id, 'salario_base', e.target.value)}
                            className="w-28 rounded border border-green-200 bg-green-50 px-2 py-1 text-right text-sm font-semibold text-green-800 focus:outline-none focus:ring-1 focus:ring-green-400"
                          />
                        ) : (
                          <span className="font-semibold text-green-700">{brl(salNovo)}</span>
                        )}
                        {delta != null && delta !== 0 && (
                          <div className="text-xs text-green-600 mt-0.5">
                            +{brl(delta)}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-500">{brl(f.custos?.total_por_func)}</td>
                      <td className="px-4 py-3 text-right">
                        {isRascunho ? (
                          <input
                            type="number"
                            step="0.01"
                            value={v?.total_por_func ?? ''}
                            onChange={e => setField(f.id, 'total_por_func', e.target.value)}
                            className="w-28 rounded border border-green-200 bg-green-50 px-2 py-1 text-right text-sm text-green-800 focus:outline-none focus:ring-1 focus:ring-green-400"
                          />
                        ) : (
                          <span className="font-semibold text-green-700">{brl(totNovo)}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => setExpandido(p => p === f.id ? null : f.id)}
                          className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                        >
                          {expandido === f.id ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                          Custos
                        </button>
                      </td>
                    </tr>
                    {expandido === f.id && (
                      <tr key={`${f.id}-exp`} className="bg-slate-50">
                        <td colSpan={6} className="px-6 py-4">
                          <div className="grid grid-cols-2 gap-x-8 gap-y-2 sm:grid-cols-3 lg:grid-cols-4">
                            {CAMPOS_CUSTO.map(({ key, label }) => {
                              const isPerc = key.endsWith('_perc')
                              const atualKey = key as keyof typeof f.custos
                              const atual = key.startsWith('insalubridade') || key.startsWith('periculosidade')
                                ? (f as Record<string, unknown>)[key]
                                : f.custos?.[atualKey as keyof NonNullable<typeof f.custos>]
                              return (
                                <div key={key} className="flex flex-col gap-0.5">
                                  <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">{label}</span>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-gray-500">{isPerc ? `${atual ?? '—'}%` : brl(atual as number | null)}</span>
                                    <span className="text-gray-300">→</span>
                                    {isRascunho ? (
                                      <input
                                        type="number"
                                        step="0.01"
                                        value={v?.[key] ?? ''}
                                        onChange={e => setField(f.id, key, e.target.value)}
                                        className="w-24 rounded border border-green-200 bg-white px-1.5 py-0.5 text-xs text-green-700 focus:outline-none focus:ring-1 focus:ring-green-300"
                                      />
                                    ) : (
                                      <span className="text-xs font-semibold text-green-700">
                                        {isPerc ? `${v?.[key] || '—'}%` : brl(strToNum(v?.[key]))}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {isRascunho && (
        <p className="text-xs text-gray-400">★ Campos obrigatórios. Os demais são opcionais.</p>
      )}
    </div>
  )
}

// ─── botões de status ─────────────────────────────────────────────────────────

function BotoesStatus({
  convencaoId,
  status,
  isAdmin,
}: {
  convencaoId: string
  status: 'rascunho' | 'publicada' | 'aplicada'
  isAdmin: boolean
}) {
  const [pending, start]         = useTransition()
  const [erro, setErro]          = useState<string | null>(null)
  const [confirmAplic, setConfirmAplic] = useState(false)

  async function handlePublicar() {
    setErro(null)
    start(async () => {
      const res = await publicarConvencao(convencaoId)
      if (!res.success) setErro(res.error ?? 'Erro')
    })
  }

  async function handleVoltar() {
    setErro(null)
    start(async () => {
      const res = await voltarParaRascunho(convencaoId)
      if (!res.success) setErro(res.error ?? 'Erro')
    })
  }

  async function handleAplicar() {
    setErro(null)
    start(async () => {
      const res = await aplicarConvencao(convencaoId)
      if (!res.success) { setErro(res.error ?? 'Erro'); setConfirmAplic(false) }
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {status === 'rascunho' && (
        <button
          type="button"
          onClick={handlePublicar}
          disabled={pending}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
          {pending ? 'Publicando…' : 'Publicar Convenção'}
        </button>
      )}

      {status === 'publicada' && (
        <>
          <button
            type="button"
            onClick={handleVoltar}
            disabled={pending}
            className="flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          >
            <RotateCcw className="h-4 w-4" />
            Voltar a Rascunho
          </button>
          {isAdmin && !confirmAplic && (
            <button
              type="button"
              onClick={() => setConfirmAplic(true)}
              disabled={pending}
              className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
            >
              <Zap className="h-4 w-4" />
              Aplicar Convenção
            </button>
          )}
          {isAdmin && confirmAplic && (
            <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />
              <span className="text-sm text-red-700 font-medium">Esta ação atualizará os salários de todas as funções. Confirmar?</span>
              <button
                type="button"
                onClick={handleAplicar}
                disabled={pending}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {pending ? 'Aplicando…' : 'Sim, aplicar'}
              </button>
              <button type="button" onClick={() => setConfirmAplic(false)} className="text-xs text-red-500 hover:underline">
                Cancelar
              </button>
            </div>
          )}
        </>
      )}

      {erro && <p className="text-sm text-red-600">{erro}</p>}
    </div>
  )
}

// ─── componente principal exportado ───────────────────────────────────────────

export function ConvencaoClient({
  convencaoId,
  status,
  percentual,
  funcoes,
  valoresExistentes,
  isAdmin,
}: {
  convencaoId: string
  status: 'rascunho' | 'publicada' | 'aplicada'
  percentual: number | null
  funcoes: FuncaoAtual[]
  valoresExistentes: ValorExistente[]
  isAdmin: boolean
}) {
  const isRascunho = status === 'rascunho'

  return (
    <div className="space-y-6">
      {/* Banner de status */}
      {status === 'publicada' && (
        <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 px-5 py-4">
          <Send className="h-5 w-5 shrink-0 text-blue-500 mt-0.5" />
          <div>
            <p className="font-semibold text-blue-800">Convenção publicada</p>
            <p className="mt-0.5 text-sm text-blue-600">
              Os valores estão fixados. Clique em <strong>Aplicar Convenção</strong> para atualizar os salários e custos de todas as funções.
            </p>
          </div>
        </div>
      )}
      {status === 'rascunho' && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-800">Rascunho</p>
            <p className="mt-0.5 text-sm text-amber-600">
              Preencha e salve os valores das funções. Depois clique em <strong>Publicar</strong> para revisar antes de aplicar.
            </p>
          </div>
        </div>
      )}

      {/* Botões de status */}
      {status !== 'aplicada' && (
        <BotoesStatus convencaoId={convencaoId} status={status} isAdmin={isAdmin} />
      )}

      {/* Tabela de valores */}
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400">
          Valores por Função ({funcoes.length})
        </p>
        <TabelaValores
          convencaoId={convencaoId}
          funcoes={funcoes}
          valoresExistentes={valoresExistentes}
          percentual={percentual}
          isRascunho={isRascunho}
        />
      </div>
    </div>
  )
}
