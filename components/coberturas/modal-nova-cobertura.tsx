'use client'

import { useState, useEffect, useRef } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { createClient } from '@/lib/supabase/client'
import { registrarCobertura } from '@/app/(admin)/coberturas/actions'

interface Funcionario {
  id: string
  nome: string
}

interface Supervisor {
  id: string
  nome: string | null
}

interface Posto {
  id: string
  nome: string
  secretaria: string | null
}

interface Props {
  open: boolean
  onClose: () => void
}

export function ModalNovaCobertura({ open, onClose }: Props) {
  const [busca, setBusca] = useState('')
  const [resultadosBusca, setResultadosBusca] = useState<Funcionario[]>([])
  const [substituto, setSubstituto] = useState<Funcionario | null>(null)

  const [supervisores, setSupervisores] = useState<Supervisor[]>([])
  const [supervisorId, setSupervisorId] = useState('')
  const [postos, setPostos] = useState<Posto[]>([])
  const [postoId, setPostoId] = useState('')
  const [secretaria, setSecretaria] = useState('')
  const [motivo, setMotivo] = useState('')

  const [apenasUmDia, setApenasUmDia] = useState(false)
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')

  const [tipoCobertura, setTipoCobertura] = useState<'reforco' | 'substituicao'>('reforco')
  const [funcionariosPostoDestino, setFuncionariosPostoDestino] = useState<Funcionario[]>([])
  const [funcionarioAusenteId, setFuncionarioAusenteId] = useState('')
  const [dataInicioAusencia, setDataInicioAusencia] = useState('')
  const [dataFimAusencia, setDataFimAusencia] = useState('')

  const [pending, setPending] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!open) return
    const supabase = createClient()
    supabase
      .from('perfis')
      .select('id, nome')
      .eq('role', 'supervisor')
      .order('nome')
      .then(({ data }) => setSupervisores(data ?? []))
  }, [open])

  useEffect(() => {
    if (!supervisorId) { setPostos([]); setPostoId(''); setSecretaria(''); return }
    const supabase = createClient()
    supabase
      .from('config_supervisores_postos')
      .select('posto_id, postos(id, nome, secretaria)')
      .eq('supervisor_id', supervisorId)
      .then(({ data }) => {
        type RawRow = { postos: { id: string; nome: string; secretaria: string | null } | null }
        const lista: Posto[] = ((data ?? []) as unknown as RawRow[])
          .filter(r => r.postos != null)
          .map(r => ({
            id: r.postos!.id,
            nome: r.postos!.nome,
            secretaria: r.postos!.secretaria,
          }))
        setPostos(lista)
        setPostoId('')
        setSecretaria('')
      })
  }, [supervisorId])

  useEffect(() => {
    if (!postoId) { setSecretaria(''); setFuncionariosPostoDestino([]); return }
    const posto = postos.find((p) => p.id === postoId)
    setSecretaria(posto?.secretaria ?? '')
    const supabase = createClient()
    supabase
      .from('funcionarios')
      .select('id, nome')
      .eq('posto_id', postoId)
      .eq('status', 'ativo')
      .order('nome')
      .then(({ data }) => setFuncionariosPostoDestino(data ?? []))
  }, [postoId, postos])

  useEffect(() => {
    if (!open) return
    if (busca.trim().length < 2) { setResultadosBusca([]); return }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('funcionarios')
        .select('id, nome')
        .eq('status', 'ativo')
        .ilike('nome', `%${busca.trim()}%`)
        .limit(8)
      setResultadosBusca(data ?? [])
    }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [busca, open])

  function handleClose() {
    setBusca(''); setResultadosBusca([]); setSubstituto(null)
    setSupervisores([]); setSupervisorId(''); setPostos([]); setPostoId(''); setSecretaria('')
    setMotivo(''); setApenasUmDia(false); setDataInicio(''); setDataFim('')
    setTipoCobertura('reforco'); setFuncionariosPostoDestino([])
    setFuncionarioAusenteId(''); setDataInicioAusencia(''); setDataFimAusencia('')
    onClose()
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!substituto || !postoId) return
    const data = new FormData()
    data.set('substituto_id', substituto.id)
    data.set('supervisor_id', supervisorId)
    data.set('posto_destino_id', postoId)
    data.set('motivo', motivo)
    data.set('data_inicio', dataInicio)
    data.set('data_fim', apenasUmDia ? dataInicio : dataFim)
    data.set('tipo_cobertura', tipoCobertura)
    if (tipoCobertura === 'substituicao') {
      data.set('funcionario_ausente_id', funcionarioAusenteId)
      data.set('data_inicio_ausencia', dataInicioAusencia)
      data.set('data_fim_ausencia', dataFimAusencia)
    }
    setPending(true)
    try {
      await registrarCobertura(data)
      handleClose()
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={(isOpen) => { if (!isOpen) handleClose() }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 bg-black/50 z-40" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 w-full max-w-3xl -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
          <Dialog.Title className="mb-4 text-lg font-semibold">Nova Cobertura</Dialog.Title>

          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-2 gap-6">
              {/* ESQUERDO: substituto */}
              <div className="space-y-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Substituto</p>

                {!substituto ? (
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-600">
                      Buscar Funcionário
                    </label>
                    <input
                      type="text"
                      value={busca}
                      onChange={(e) => setBusca(e.target.value)}
                      placeholder="Digite o nome..."
                      className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                    {resultadosBusca.length > 0 && (
                      <ul className="mt-1 max-h-40 overflow-y-auto rounded border border-gray-200 bg-white shadow">
                        {resultadosBusca.map((f) => (
                          <li key={f.id}>
                            <button
                              type="button"
                              onClick={() => { setSubstituto(f); setBusca(''); setResultadosBusca([]) }}
                              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                            >
                              <span className="font-medium">{f.nome}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ) : (
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-600">
                      Funcionário
                    </label>
                    <div className="flex items-start justify-between rounded border border-gray-200 bg-gray-50 px-3 py-2">
                      <div>
                        <p className="text-sm font-medium">{substituto.nome}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSubstituto(null)}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Trocar
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* DIREITO: destino e configurações */}
              <div className="space-y-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Destino</p>

                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-600">
                    Supervisor Destino
                  </label>
                  <select
                    value={supervisorId}
                    onChange={(e) => setSupervisorId(e.target.value)}
                    required
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                  >
                    <option value="">Selecione...</option>
                    {supervisores.map((s) => (
                      <option key={s.id} value={s.id}>{s.nome}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-600">
                    Posto Destino
                  </label>
                  <select
                    value={postoId}
                    onChange={(e) => setPostoId(e.target.value)}
                    required
                    disabled={!supervisorId}
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:bg-gray-50 disabled:text-gray-400"
                  >
                    <option value="">Selecione...</option>
                    {postos.map((p) => (
                      <option key={p.id} value={p.id}>{p.nome}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-600">
                    Secretaria Destino
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={secretaria || '—'}
                    className="w-full rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-600">
                    Motivo
                  </label>
                  <textarea
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    rows={2}
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="apenas-um-dia"
                    checked={apenasUmDia}
                    onChange={(e) => setApenasUmDia(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600"
                  />
                  <label htmlFor="apenas-um-dia" className="text-sm text-gray-600">Apenas um dia</label>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-600">
                    Data Início
                  </label>
                  <input
                    type="date"
                    required
                    value={dataInicio}
                    onChange={(e) => setDataInicio(e.target.value)}
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                {!apenasUmDia && (
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-600">
                      Data Fim
                    </label>
                    <input
                      type="date"
                      required
                      value={dataFim}
                      onChange={(e) => setDataFim(e.target.value)}
                      className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Seção: Funcionário ausente */}
            <div className="mt-6 rounded border border-gray-200 p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-500">
                Funcionário Ausente
              </p>
              <div className="flex gap-6">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="tipo_cobertura"
                    value="reforco"
                    checked={tipoCobertura === 'reforco'}
                    onChange={() => setTipoCobertura('reforco')}
                    className="h-4 w-4"
                  />
                  Reforço de posto
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="tipo_cobertura"
                    value="substituicao"
                    checked={tipoCobertura === 'substituicao'}
                    onChange={() => setTipoCobertura('substituicao')}
                    className="h-4 w-4"
                  />
                  Substituindo funcionário ausente
                </label>
              </div>

              {tipoCobertura === 'substituicao' && (
                <div className="mt-4 grid grid-cols-3 gap-4">
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-600">
                      Funcionário Ausente
                    </label>
                    <select
                      value={funcionarioAusenteId}
                      onChange={(e) => setFuncionarioAusenteId(e.target.value)}
                      required
                      className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                    >
                      <option value="">Selecione...</option>
                      {funcionariosPostoDestino.map((f) => (
                        <option key={f.id} value={f.id}>{f.nome}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-600">
                      Início Ausência
                    </label>
                    <input
                      type="date"
                      required
                      value={dataInicioAusencia}
                      onChange={(e) => setDataInicioAusencia(e.target.value)}
                      className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-600">
                      Fim Ausência
                    </label>
                    <input
                      type="date"
                      value={dataFimAusencia}
                      onChange={(e) => setDataFimAusencia(e.target.value)}
                      className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={handleClose}
                className="rounded px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={pending || !substituto || !postoId}
                className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {pending ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
