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
  ehGestao,
  funcionarioInicial,
}: {
  funcionarios: FuncionarioPainel[]
  supervisores: SupervisorSimples[]
  alertasIniciais: AlertaRow[]
  currentUserId: string | null
  canWrite: boolean
  ehGestao: boolean
  funcionarioInicial: string | null
}) {
  const [selecionado, setSelecionado] = useState<string | null>(funcionarioInicial)

  return (
    <div className="space-y-6">
      <AlertasSection alertasIniciais={alertasIniciais} canWrite={canWrite} />

      <BuscaFuncionario funcionarios={funcionarios} onSelect={setSelecionado} />

      {selecionado && (
        <ModalDossie
          funcionarioId={selecionado}
          supervisores={supervisores}
          canWrite={canWrite}
          ehGestao={ehGestao}
          onClose={() => setSelecionado(null)}
        />
      )}
    </div>
  )
}
