import { AjudaClient } from '@/components/ajuda/ajuda-client'

export default function AjudaPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-gray-900">Guia do Supervisor</h1>
        <p className="text-sm text-gray-400">Se acontecer isso, faça isso — passo a passo das tarefas do dia a dia</p>
      </div>

      <AjudaClient />
    </div>
  )
}
