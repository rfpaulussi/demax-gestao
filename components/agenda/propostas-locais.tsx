'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, MapPinned, X } from 'lucide-react'
import { decidirLocalProposto, type PropostaLocal } from '@/app/(admin)/agenda/geo-actions'
import { formatarDistancia } from '@/lib/agenda/geo'

function data(iso: string) {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }).format(new Date(iso))
}

/** Propostas de local enviadas pelos supervisores (longe do endereço cadastrado), aguardando a coordenação. */
export function PropostasLocais({ propostas }: { propostas: PropostaLocal[] }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [erro, setErro] = useState<string | null>(null)

  if (propostas.length === 0) return null

  function decidir(id: string, aprovar: boolean) {
    setErro(null)
    start(async () => {
      const r = await decidirLocalProposto({ id, aprovar })
      if (!r.ok) return setErro(r.erro)
      router.refresh()
    })
  }

  return (
    <section className="space-y-3 rounded-2xl border border-amber-300 bg-amber-50 p-4">
      <div className="flex items-center gap-2">
        <MapPinned className="h-4 w-4 text-amber-800" />
        <h2 className="text-sm font-bold text-amber-900">Locais propostos pelos supervisores ({propostas.length})</h2>
      </div>
      <p className="text-xs text-amber-900/80">
        O supervisor estava longe do endereço cadastrado. Confira no mapa antes de aprovar: aprovar troca o ponto oficial do posto.
      </p>

      {erro && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{erro}</p>}

      <ul className="space-y-2">
        {propostas.map(p => (
          <li key={p.id} className="space-y-2 rounded-xl bg-white p-3 ring-1 ring-amber-200">
            <div className="flex flex-wrap items-start gap-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-slate-900">{p.postoNome}</p>
                <p className="text-[11px] text-slate-500">
                  Enviado por {p.supervisorNome ?? 'supervisor'} em {data(p.criadoEm)} · {formatarDistancia(p.distanciaM)} do endereço cadastrado
                </p>
                {p.enderecoRef && <p className="text-[11px] text-slate-500">Endereço: {p.enderecoRef}</p>}
              </div>
            </div>
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700">
              <b>Justificativa:</b> {p.justificativa}
            </p>
            <p className="text-[11px] text-slate-500">
              Ponto proposto:{' '}
              <a
                href={`https://www.google.com/maps?q=${p.proposto.latitude},${p.proposto.longitude}`}
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-sky-700 underline"
              >
                abrir no mapa
              </a>
              {p.atual.latitude != null && p.atual.longitude != null && (
                <>
                  {' · '}ponto atual:{' '}
                  <a
                    href={`https://www.google.com/maps?q=${p.atual.latitude},${p.atual.longitude}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-slate-600 underline"
                  >
                    abrir no mapa
                  </a>
                </>
              )}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => decidir(p.id, true)}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                <Check className="h-3.5 w-3.5" /> Aprovar e trocar o ponto
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => decidir(p.id, false)}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                <X className="h-3.5 w-3.5" /> Rejeitar
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
