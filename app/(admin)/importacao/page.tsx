import { ImportacaoClient } from '@/components/importacao/importacao-client'

export default function ImportacaoPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-gray-900">Importação</h1>
        <p className="text-sm text-gray-400">Importação em lote de dados históricos via CSV</p>
      </div>
      <ImportacaoClient />
    </div>
  )
}
