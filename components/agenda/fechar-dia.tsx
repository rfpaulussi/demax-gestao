'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ClipboardCheck } from 'lucide-react'
import { listarPendenciasDia, registrarJustificativas, type PendenciaDia } from '@/app/(admin)/agenda/fechar-dia-actions'
import { diaMes } from '@/lib/agenda/datas'
import { exigeTextoJustificativa, TIPOS_JUSTIFICATIVA } from '@/lib/agenda/justificativas'

/**
 * "Fechar o dia": visitas planejadas sem check-in. O supervisor diz, em um toque por visita, se foi e não registrou
 * ou por que não foi. Dias anteriores aparecem sempre; as de hoje só no fim da tarde.
 */
export function FecharDia({ hoje, fimDeTarde }: { hoje: string; fimDeTarde: boolean }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [todas, setTodas] = useState<PendenciaDia[]>([])
  const [aberto, setAberto] = useState(false)
  const [escolha, setEscolha] = useState<Record<string, { tipo: string; texto: string }>>({})
  const [erro, setErro] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  async function carregar() {
    setTodas(await listarPendenciasDia())
  }
  useEffect(() => { void carregar() }, [])

  const visiveis = useMemo(() => todas.filter(p => p.data < hoje || fimDeTarde), [todas, hoje, fimDeTarde])
  const porDia = useMemo(() => {
    const m = new Map<string, PendenciaDia[]>()
    for (const p of visiveis) m.set(p.data, [...(m.get(p.data) ?? []), p])
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  }, [visiveis])

  const chave = (p: PendenciaDia) => `${p.data}|${p.postoId}`
  const preenchidas = visiveis.filter(p => {
    const e = escolha[chave(p)]
    return e?.tipo && (!exigeTextoJustificativa(e.tipo) || e.texto.trim().length >= 5)
  })

  function definir(p: PendenciaDia, parcial: Partial<{ tipo: string; texto: string }>) {
    setEscolha(prev => {
      const atual = prev[chave(p)] ?? { tipo: '', texto: '' }
      return { ...prev, [chave(p)]: { ...atual, ...parcial } }
    })
  }

  function aplicarATodas(tipo: string) {
    if (!tipo || exigeTextoJustificativa(tipo)) return
    setEscolha(prev => {
      const novo = { ...prev }
      for (const p of visiveis) if (!novo[chave(p)]?.tipo) novo[chave(p)] = { tipo, texto: '' }
      return novo
    })
  }

  function enviar() {
    setErro(null)
    setAviso(null)
    start(async () => {
      const r = await registrarJustificativas(preenchidas.map(p => ({ data: p.data, postoId: p.postoId, tipo: escolha[chave(p)].tipo, texto: escolha[chave(p)].texto })))
      if (!r.ok) return setErro(r.erro)
      setAviso(`✅ ${r.gravadas} ${r.gravadas === 1 ? 'visita justificada' : 'visitas justificadas'}. Obrigado!`)
      setEscolha({})
      await carregar()
      router.refresh()
    })
  }

  if (visiveis.length === 0) {
    return aviso ? <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">{aviso}</p> : null
  }

  return (
    <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-3">
      <button type="button" onClick={() => setAberto(a => !a)} className="flex w-full items-center gap-2 text-left">
        <ClipboardCheck className="h-5 w-5 shrink-0 text-indigo-600" />
        <span className="flex-1 text-sm font-bold text-indigo-900">
          Fechar o dia: {visiveis.length} {visiveis.length === 1 ? 'visita planejada sem check-in' : 'visitas planejadas sem check-in'}
        </span>
        <span className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white">{aberto ? 'Fechar' : 'Justificar'}</span>
      </button>

      {aberto && (
        <div className="mt-3 space-y-3">
          <p className="text-xs text-indigo-900">
            Para cada visita, diga o que aconteceu. Isso <b>não apaga a falta</b>, mas a coordenação passa a saber o motivo.
          </p>

          <select defaultValue="" onChange={e => { aplicarATodas(e.target.value); e.target.value = '' }}
            className="w-full rounded-lg border border-indigo-200 bg-white p-2 text-sm">
            <option value="">Aplicar o mesmo motivo a todas…</option>
            {TIPOS_JUSTIFICATIVA.filter(t => !t.exigeTexto).map(t => <option key={t.id} value={t.id}>{t.rotulo}</option>)}
          </select>

          {porDia.map(([data, lista]) => (
            <div key={data}>
              <p className="mb-1.5 text-[11px] font-bold uppercase tracking-widest text-indigo-700">{data === hoje ? `Hoje · ${diaMes(data)}` : diaMes(data)}</p>
              <ul className="space-y-2">
                {lista.map(p => {
                  const e = escolha[chave(p)]
                  return (
                    <li key={chave(p)} className="rounded-lg bg-white p-2.5 ring-1 ring-indigo-100">
                      <p className="break-words text-sm font-bold leading-tight text-slate-800">{p.postoNome}</p>
                      {p.foco && <p className="text-[11px] text-slate-500">{p.foco}</p>}
                      <select value={e?.tipo ?? ''} onChange={ev => definir(p, { tipo: ev.target.value })}
                        className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white p-2 text-sm">
                        <option value="">O que aconteceu?</option>
                        {TIPOS_JUSTIFICATIVA.map(t => <option key={t.id} value={t.id}>{t.rotulo}</option>)}
                      </select>
                      {e?.tipo && exigeTextoJustificativa(e.tipo) && (
                        <textarea value={e.texto} onChange={ev => definir(p, { texto: ev.target.value })} rows={2} maxLength={300}
                          placeholder={e.tipo === 'fui_sem_registro' ? 'Conte rapidamente: por que não registrou? (obrigatório)' : 'Descreva o motivo (obrigatório)'}
                          className="mt-1.5 w-full resize-none rounded-lg border border-slate-200 p-2 text-sm outline-none focus:border-slate-400" />
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}

          {erro && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{erro}</p>}
          <button type="button" onClick={enviar} disabled={pending || preenchidas.length === 0}
            className="w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white hover:bg-indigo-500 disabled:opacity-40">
            {pending ? 'Enviando…' : preenchidas.length === 0 ? 'Escolha o motivo de ao menos uma visita' : `Enviar ${preenchidas.length} ${preenchidas.length === 1 ? 'justificativa' : 'justificativas'}`}
          </button>
          <p className="text-[11px] text-indigo-800/70">Precisa de internet para enviar. As que você não preencher continuam pendentes.</p>
        </div>
      )}
      {aviso && <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">{aviso}</p>}
    </div>
  )
}
