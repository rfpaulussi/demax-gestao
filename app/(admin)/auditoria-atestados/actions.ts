'use server'

import { createClient } from '@/lib/supabase/server'
import { fetchAllRows } from '@/lib/supabase/fetch-all'
import { getUser } from '@/lib/auth/get-user'
import { isAdminOrCoord, type Role } from '@/types'
import { extrairRegistroDeMatricula } from '@/lib/auditoria-atestados/parse'
import { compararAuditoria } from '@/lib/auditoria-atestados/comparar'
import type { LinhaSesmt, AtestadoSistema, ResultadoAuditoria } from '@/lib/auditoria-atestados/tipos'

type FuncionarioRaw = { id: string; registro: string | null; nome: string }
type AtestadoRaw = {
  id: string
  funcionario_id: string
  data_inicio: string
  data_fim: string
  cid_codigo: string | null
  origem_ocupacional: string | null
}
type CidRaw = { codigo: string; descricao: string }

export async function auditarSesmt(linhasSesmt: LinhaSesmt[]): Promise<ResultadoAuditoria | { erro: string }> {
  const auth = await getUser()
  if (!auth) return { erro: 'Não autenticado' }
  if (!isAdminOrCoord(auth.perfil.role as Role)) return { erro: 'Sem permissão' }

  if (linhasSesmt.length === 0) return { erro: 'Nenhuma linha para auditar' }

  const supabase = createClient()

  const registrosNoArquivo = new Set<string>()
  const linhasComRegistro: Array<{ linha: LinhaSesmt; registro: string | null }> = linhasSesmt.map(linha => {
    const registro = extrairRegistroDeMatricula(linha.matriculaRaw)
    if (registro) registrosNoArquivo.add(registro)
    return { linha, registro }
  })

  const [{ data: funcRaw, error: errFunc }, { data: cidRaw, error: errCid }] = await Promise.all([
    supabase.from('funcionarios').select('id, registro, nome').not('registro', 'is', null),
    supabase.from('cid_referencia').select('codigo, descricao'),
  ])

  if (errFunc) return { erro: `Erro ao buscar funcionários: ${errFunc.message}` }
  if (errCid) return { erro: `Erro ao buscar CIDs: ${errCid.message}` }

  const funcionarios = (funcRaw ?? []) as FuncionarioRaw[]

  const funcionarioIdsRelevantes = funcionarios
    .filter(f => f.registro && registrosNoArquivo.has(f.registro))
    .map(f => f.id)

  const cidMap = new Map(((cidRaw ?? []) as CidRaw[]).map(c => [c.codigo, c.descricao] as [string, string]))

  let atestadosRaw: AtestadoRaw[] = []
  if (funcionarioIdsRelevantes.length > 0) {
    atestadosRaw = await fetchAllRows((from, to) =>
      supabase
        .from('atestados')
        .select('id, funcionario_id, data_inicio, data_fim, cid_codigo, origem_ocupacional')
        .in('funcionario_id', funcionarioIdsRelevantes)
        .range(from, to) as unknown as PromiseLike<{ data: AtestadoRaw[] | null; error: { message: string } | null }>,
    )
  }

  const atestadosPorRegistro = new Map<string, AtestadoSistema[]>()
  for (const a of atestadosRaw) {
    const func = funcionarios.find(f => f.id === a.funcionario_id)
    if (!func?.registro) continue
    const sistema: AtestadoSistema = {
      id: a.id,
      funcionarioId: a.funcionario_id,
      funcionarioNome: func.nome,
      registro: func.registro,
      dataInicio: a.data_inicio,
      dataFim: a.data_fim,
      cidCodigo: a.cid_codigo,
      cidDescricao: a.cid_codigo ? (cidMap.get(a.cid_codigo) ?? null) : null,
      origemOcupacional: a.origem_ocupacional,
    }
    const lista = atestadosPorRegistro.get(func.registro) ?? []
    lista.push(sistema)
    atestadosPorRegistro.set(func.registro, lista)
  }

  return compararAuditoria(linhasComRegistro, atestadosPorRegistro)
}
