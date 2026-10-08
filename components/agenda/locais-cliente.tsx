'use client'

import dynamic from 'next/dynamic'
import type { PostoLocal } from '@/app/(admin)/agenda/geo-actions'

// Leaflet acessa `window` ao carregar — só no navegador.
const EditorLocal = dynamic(() => import('./editor-local'), {
  ssr: false,
  loading: () => <div className="h-96 animate-pulse rounded-2xl bg-slate-100" />,
})

export function LocaisCliente({ postos }: { postos: PostoLocal[] }) {
  return <EditorLocal postos={postos} />
}
