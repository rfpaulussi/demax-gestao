'use client'

import { useState } from 'react'
import type { FuncionarioPainel, SupervisorSimples, AlertaRow } from '@/app/(admin)/ocorrencias/actions'
import { BuscaFuncionario } from './busca-funcionario'
import { AlertasSection } from './alertas-section'
import { ModalDossie } from './modal-dossie'

export function OcorrenciasClient({
  funcionarios,
  supervisores,
  alertasIniciais,
  canWrite,
}: {
  funcionarios: FuncionarioPainel[]
  supervisores: SupervisorSimples[]
  alertasIniciais: AlertaRow[]
  currentUserId: string | null
  canWrite: boolean
}) {
  const [selecionado, setSelecionado] = useState<string | null>(null)

  return (
    <div className="space-y-6">
      <AlertasSection alertasIniciais={alertasIniciais} canWrite={canWrite} />

      <BuscaFuncionario funcionarios={funcionarios} onSelect={setSelecionado} />

      {selecionado && (
        <ModalDossie
          funcionarioId={selecionado}
          supervisores={supervisores}
          canWrite={canWrite}
          onClose={() => setSelecionado(null)}
        />
      )}
    </div>
  )
}
