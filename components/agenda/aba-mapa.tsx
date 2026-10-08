'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import { carregarMapa } from '@/app/(admin)/agenda/geo-actions'
import type { MapaDados } from '@/app/(admin)/agenda/geo-actions'

// Leaflet acessa `window` ao carregar — só no navegador.
const MapaAgenda = dynamic(() => import('./mapa-agenda'), {
  ssr: false,
  loading: () => <div className="h-96 animate-pulse rounded-2xl bg-slate-100" />,
})

export function AbaMapa({ semanaInicio, supervisorId, dias }: { semanaInicio: string; supervisorId: string; dias: string[] }) {
  const [estado, setEstado] = useState<{ carregando: boolean; erro: string | null; dados: MapaDados | null }>({
    carregando: true, erro: null, dados: null,
  })

  useEffect(() => {
    let vivo = true
    setEstado({ carregando: true, erro: null, dados: null })
    carregarMapa(semanaInicio, supervisorId).then(r => {
      if (!vivo) return
      setEstado(r.ok ? { carregando: false, erro: null, dados: r.dados } : { carregando: false, erro: r.erro, dados: null })
    })
    return () => { vivo = false }
  }, [semanaInicio, supervisorId])

  if (estado.carregando) return <div className="h-96 animate-pulse rounded-2xl bg-slate-100" />
  if (estado.erro) return <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">{estado.erro}</p>
  return <MapaAgenda dados={estado.dados!} dias={dias} />
}
