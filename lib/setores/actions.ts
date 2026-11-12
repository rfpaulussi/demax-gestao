'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { fetchAllRows } from '@/lib/supabase/fetch-all'
import { setorEstaAutenticado, autenticarSetor } from '@/lib/setores/auth'
import { getSetor } from '@/lib/setores/config'
import { normalizarNome } from '@/lib/setores/nomes'

export type VinculoFuncionario = {
  id: string
  funcao: string | null
  posto: string | null
  secretaria: string | null
  supervisor: string | null
  status: string | null
  dataAdmissao: string | null
  dataDesligamento: string | null
  motivoDesligamento: string | null
  motivoAfastamento: string | null
}

export type ResultadoBusca = {
  nomeBuscado: string
  encontrados: VinculoFuncionario[]
}

export async function entrarComPin(slug: string, pin: string): Promise<{ ok: boolean; erro?: string }> {
  const setor = getSetor(slug)
  if (!setor) return { ok: false, erro: 'Setor desconhecido.' }

  const pinConfigurado = process.env[setor.pinEnv]
  if (!pinConfigurado) {
    return { ok: false, erro: 'Acesso não configurado. Fale com o TI.' }
  }
  if (pin.trim() !== pinConfigurado) {
    return { ok: false, erro: 'Código incorreto.' }
  }
  autenticarSetor(slug)
  return { ok: true }
}

export async function buscarFuncionarios(slug: string, nomes: string[]): Promise<ResultadoBusca[]> {
  if (!setorEstaAutenticado(slug)) {
    throw new Error('Sessão expirada. Entre novamente com o código.')
  }
  if (nomes.length === 0) return []

  const admin = createAdminClient()

  const [funcionarios, configRaw] = await Promise.all([
    fetchAllRows((from, to) =>
      admin
        .from('funcionarios')
        .select(`
          id, nome, status, posto_id,
          data_admissao, data_desligamento, motivo_desligamento, motivo_afastamento,
          funcoes!funcao_id ( nome ),
          postos!posto_id ( nome, secretaria )
        `)
        .order('nome')
        .range(from, to)
    ),
    admin
      .from('config_supervisores_postos')
      .select('posto_id, perfis!supervisor_id(nome)')
      .eq('ativo', true),
  ])

  const supervisorPorPosto = new Map<string, string>()
  for (const row of (configRaw.data ?? []) as unknown as {
    posto_id: string
    perfis: { nome: string | null } | null
  }[]) {
    const nome = row.perfis?.nome
    if (nome && !supervisorPorPosto.has(row.posto_id)) {
      supervisorPorPosto.set(row.posto_id, nome)
    }
  }

  const porNomeNormalizado = new Map<string, VinculoFuncionario[]>()
  for (const f of funcionarios as unknown as {
    id: string
    nome: string
    status: string | null
    posto_id: string | null
    data_admissao: string | null
    data_desligamento: string | null
    motivo_desligamento: string | null
    motivo_afastamento: string | null
    funcoes: { nome: string | null } | null
    postos: { nome: string | null; secretaria: string | null } | null
  }[]) {
    const chave = normalizarNome(f.nome)
    const vinculo: VinculoFuncionario = {
      id: f.id,
      funcao: f.funcoes?.nome ?? null,
      posto: f.postos?.nome ?? null,
      secretaria: f.postos?.secretaria ?? null,
      supervisor: f.posto_id ? supervisorPorPosto.get(f.posto_id) ?? null : null,
      status: f.status,
      dataAdmissao: f.data_admissao,
      dataDesligamento: f.data_desligamento,
      motivoDesligamento: f.motivo_desligamento,
      motivoAfastamento: f.motivo_afastamento,
    }
    const lista = porNomeNormalizado.get(chave)
    if (lista) lista.push(vinculo)
    else porNomeNormalizado.set(chave, [vinculo])
  }

  return nomes.map((nomeBuscado) => ({
    nomeBuscado,
    encontrados: porNomeNormalizado.get(normalizarNome(nomeBuscado)) ?? [],
  }))
}
