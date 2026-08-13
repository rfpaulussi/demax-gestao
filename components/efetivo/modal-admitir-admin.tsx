'use client'

import { useState, useTransition, useMemo, useRef } from 'react'
import { admitirFuncionarioAdmin } from '@/app/(admin)/efetivo/actions'

type PostoOpt  = { id: string; nome: string; secretaria: string | null }
type FuncaoOpt = { id: string; nome: string }

interface Props {
  open: boolean
  onClose: () => void
  postos: PostoOpt[]
  funcoes: FuncaoOpt[]
}

const labelClass = 'mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-500'
const inputClass = 'w-full rounded border border-gray-200 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-600'

export function ModalAdmitirAdmin({ open, onClose, postos, funcoes }: Props) {
  const [erro, setErro]   = useState<string | null>(null)
  const [ok, setOk]       = useState(false)
  const [pending, start]  = useTransition()
  const [postoSearch, setPostoSearch] = useState('')
  const [periodoExp, setPeriodoExp] = useState<'30+30' | '45+45' | ''>('45+45')
  const [pcd,         setPcd]         = useState(false)
  const [pcdTipo,      setPcdTipo]     = useState('')
  const [pcdTipoOutro, setPcdTipoOutro] = useState('')
  const formRef = useRef<HTMLFormElement>(null)

  const postosFiltrados = useMemo(() =>
    postoSearch.trim()
      ? postos.filter(p =>
          p.nome.toLowerCase().includes(postoSearch.toLowerCase()) ||
          (p.secretaria ?? '').toLowerCase().includes(postoSearch.toLowerCase())
        )
      : postos,
    [postos, postoSearch]
  )

  function handleClose() {
    if (pending) return
    setErro(null); setOk(false); setPostoSearch(''); setPeriodoExp('45+45')
    setPcd(false); setPcdTipo(''); setPcdTipoOutro('')
    formRef.current?.reset()
    onClose()
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErro(null)
    const fd = new FormData(e.currentTarget)
    start(async () => {
      const res = await admitirFuncionarioAdmin(fd)
      if (res.error) { setErro(res.error); return }
      setOk(true)
    })
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-xl rounded-xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <h2 className="mb-1 text-base font-bold text-gray-900">Admitir Funcionário</h2>
        <p className="mb-4 text-sm text-gray-400">Cadastro direto — funcionário entra como ativo imediatamente.</p>

        {ok ? (
          <div className="py-8 text-center">
            <p className="text-3xl">✓</p>
            <p className="mt-2 text-sm font-medium text-gray-700">Funcionário admitido com sucesso!</p>
            <div className="mt-4 flex justify-center gap-2">
              <button type="button" onClick={() => { setOk(false); setErro(null); setPeriodoExp('45+45'); setPcd(false); setPcdTipo(''); setPcdTipoOutro(''); formRef.current?.reset() }}
                className="rounded border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
                Admitir outro
              </button>
              <button type="button" onClick={handleClose}
                className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700">
                Fechar
              </button>
            </div>
          </div>
        ) : (
          <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
            <div className="rounded-lg border border-slate-100 border-t-4 border-t-blue-400 bg-white p-4 shadow-sm">
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">Dados pessoais</p>
              <div>
                <label className={labelClass}>Nome completo *</label>
                <input name="nome" required placeholder="Nome do funcionário..." className={inputClass} />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Registro</label>
                  <input name="registro" placeholder="Nº registro..." className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>CPF</label>
                  <input name="cpf" placeholder="000.000.000-00" className={inputClass} />
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-slate-100 border-t-4 border-t-indigo-400 bg-white p-4 shadow-sm">
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">Função &amp; posto</p>
              <div>
                <label className={labelClass}>Função *</label>
                <select name="funcao_id" required className={inputClass}>
                  <option value="">Selecione...</option>
                  {funcoes.map(f => (
                    <option key={f.id} value={f.id}>{f.nome}</option>
                  ))}
                </select>
              </div>
              <div className="mt-3">
                <label className={labelClass}>Posto *</label>
                <input
                  placeholder="Buscar posto..."
                  value={postoSearch}
                  onChange={e => setPostoSearch(e.target.value)}
                  className={inputClass + ' mb-1'}
                />
                <select name="posto_id" required className={inputClass} size={4} style={{ height: 'auto' }}>
                  <option value="">Selecione...</option>
                  {postosFiltrados.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.nome}{p.secretaria ? ` — ${p.secretaria}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="rounded-lg border border-slate-100 border-t-4 border-t-orange-400 bg-white p-4 shadow-sm">
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">Admissão</p>
              <div>
                <label className={labelClass}>Data de admissão *</label>
                <input name="data_admissao" type="date" required className={inputClass} />
              </div>
              <div className="mt-3">
                <label className={labelClass}>Período de Experiência</label>
                <select
                  name="periodo_experiencia"
                  value={periodoExp}
                  onChange={e => setPeriodoExp(e.target.value as '30+30' | '45+45' | '')}
                  className={inputClass}
                >
                  <option value="">Nenhum</option>
                  <option value="30+30">30 + 30 dias</option>
                  <option value="45+45">45 + 45 dias</option>
                </select>
              </div>
            </div>

            <div className="rounded-lg border border-slate-100 border-t-4 border-t-amber-400 bg-white p-4 shadow-sm">
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">PCD</p>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <input
                  type="checkbox"
                  name="pcd"
                  checked={pcd}
                  onChange={e => { setPcd(e.target.checked); if (!e.target.checked) { setPcdTipo(''); setPcdTipoOutro('') } }}
                  className="h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                />
                Pessoa com deficiência
              </label>
              {pcd && (
                <div className="mt-3 space-y-2">
                  <select
                    name="pcd_tipo"
                    value={pcdTipo}
                    onChange={e => setPcdTipo(e.target.value)}
                    className={inputClass}
                  >
                    <option value="">Selecione o tipo...</option>
                    <option value="Visual">Visual</option>
                    <option value="Física">Física</option>
                    <option value="Auditiva">Auditiva</option>
                    <option value="Intelectual">Intelectual</option>
                    <option value="Outra">Outra</option>
                  </select>
                  {pcdTipo === 'Outra' && (
                    <input
                      name="pcd_tipo_outro"
                      value={pcdTipoOutro}
                      onChange={e => setPcdTipoOutro(e.target.value)}
                      placeholder="Descreva o tipo..."
                      className={inputClass}
                    />
                  )}
                </div>
              )}
            </div>

            {erro && (
              <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{erro}</p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={handleClose} disabled={pending}
                className="rounded px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50">
                Cancelar
              </button>
              <button type="submit" disabled={pending}
                className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50">
                {pending ? 'Admitindo...' : 'Admitir'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
