import { normalizarNome, normalizarRE } from './normalizar'
import type {
  LinhaRH,
  FuncionarioSistema,
  Divergencia,
  TipoDivergencia,
  CelulaResumo,
  LinhaResumo,
  ResultadoComparacao,
} from './tipos'

function novaCelula(): CelulaResumo {
  return { rh: 0, sistema: 0 }
}

function novaLinhaResumo(funcao: string, supervisores: string[]): LinhaResumo {
  const porSupervisor: Record<string, CelulaResumo> = {}
  for (const s of supervisores) porSupervisor[s] = novaCelula()
  return { funcao, porSupervisor, afastados: novaCelula(), total: novaCelula() }
}

function somaCelula(a: CelulaResumo, lado: 'rh' | 'sistema') {
  a[lado] += 1
}

/** Um sinônimo resolvido: forma normalizada (pra comparação) e bruta (pra exibição)
 * da função do sistema equivalente à função do RH usada como chave do map. */
export type SinonimoFuncaoResolvido = { normalizado: string; bruto: string }

export function compararListagem(
  linhasRH: LinhaRH[],
  funcionariosSistema: FuncionarioSistema[],
  codigoParaApelido: Map<number, string>,
  sinonimosFuncao: Map<string, SinonimoFuncaoResolvido> = new Map(),
): ResultadoComparacao {
  const supervisoresApelidos = Array.from(new Set(codigoParaApelido.values())).sort()

  /** Resolve a chave (bruta, pra exibição) usada em resumoPorFuncao, aplicando
   * sinônimo quando existir: funcao bruta do RH -> normaliza -> busca sinônimo ->
   * se achou, usa a função bruta do sistema equivalente (do próprio cadastro de
   * sinônimos); senão usa a função bruta original do RH. */
  function chaveResumoFuncaoRH(funcaoRH: string): string {
    const sinonimo = sinonimosFuncao.get(normalizarNome(funcaoRH))
    return sinonimo ? sinonimo.bruto : funcaoRH
  }

  // Idem, pro lado sistema: se a função do sistema é o alvo de algum sinônimo
  // cadastrado, agrupa na mesma chave bruta pra bater com o lado RH.
  const brutoPorFuncaoSistemaNormalizada = new Map<string, string>()
  for (const sinonimo of Array.from(sinonimosFuncao.values())) {
    brutoPorFuncaoSistemaNormalizada.set(sinonimo.normalizado, sinonimo.bruto)
  }
  function chaveResumoFuncaoSistema(funcaoSistema: string): string {
    return brutoPorFuncaoSistemaNormalizada.get(normalizarNome(funcaoSistema)) ?? funcaoSistema
  }

  // ── índices pro lado sistema ──
  // Nota: se dois funcionários do sistema tiverem o mesmo RE ou nome normalizado,
  // o último "ganha" no map (o anterior fica inacessível via fallback por RE/nome).
  // Limitação conhecida — corrigir isso (ex: rastrear colisões) está fora do escopo aqui.
  const porRegistro = new Map<string, FuncionarioSistema>()
  const porNomeSistema = new Map<string, FuncionarioSistema>()
  for (const f of funcionariosSistema) {
    if (f.registro) porRegistro.set(normalizarRE(f.registro), f)
    porNomeSistema.set(normalizarNome(f.nome), f)
  }

  const sistemaCasados = new Set<string>() // ids já usados num match
  const divergencias: Divergencia[] = []
  const resumoPorFuncao = new Map<string, LinhaResumo>()
  const codigosSemSupervisor = new Set<number>()
  let linhasIgnoradas = 0

  function linhaResumoDe(funcao: string): LinhaResumo {
    let linha = resumoPorFuncao.get(funcao)
    if (!linha) {
      linha = novaLinhaResumo(funcao, supervisoresApelidos)
      resumoPorFuncao.set(funcao, linha)
    }
    return linha
  }

  // ── Passe 1: matching exato por RE, pra ficar independente da ordem das linhas ──
  // Reivindica sistemaCasados aqui pra que nenhuma linha do passe 2 (fallback por
  // nome) consiga "roubar" um registro que já tem match direto por RE — não importa
  // se a linha com match direto vem antes ou depois na planilha.
  const matchPorIndice = new Map<number, FuncionarioSistema>()
  for (const [indice, linha] of Array.from(linhasRH.entries())) {
    if (!linha.re || !linha.nome) continue
    const matchDireto = porRegistro.get(normalizarRE(linha.re))
    if (matchDireto) {
      matchPorIndice.set(indice, matchDireto)
      sistemaCasados.add(matchDireto.id)
    }
  }

  // ── Passe 2: resumo agregado, fallback por nome e construção das divergências ──
  for (const [indice, linha] of Array.from(linhasRH.entries())) {
    if (!linha.re || !linha.nome) { linhasIgnoradas++; continue }

    const apelidoSupervisor = codigoParaApelido.get(linha.codigoSupervisor)
    if (!apelidoSupervisor) codigosSemSupervisor.add(linha.codigoSupervisor)

    // resumo agregado (lado RH)
    const linhaResumo = linhaResumoDe(chaveResumoFuncaoRH(linha.funcao))
    if (apelidoSupervisor) somaCelula(linhaResumo.porSupervisor[apelidoSupervisor], 'rh')
    if (linha.afastadoEm) somaCelula(linhaResumo.afastados, 'rh')
    somaCelula(linhaResumo.total, 'rh')

    // matching
    const reNorm = normalizarRE(linha.re)
    let matchSistema = matchPorIndice.get(indice)
    let tipos: TipoDivergencia[] = []

    if (!matchSistema) {
      const porNome = porNomeSistema.get(normalizarNome(linha.nome))
      if (porNome && !sistemaCasados.has(porNome.id)) {
        matchSistema = porNome
        sistemaCasados.add(porNome.id)
        tipos.push('re_divergente')
      }
    }

    if (!matchSistema) {
      tipos = ['so_no_rh']
      divergencias.push({
        chave: `rh-${reNorm}-${indice}`,
        tipos,
        rh: { re: linha.re, nome: linha.nome, funcao: linha.funcao, afastado: !!linha.afastadoEm, supervisor: apelidoSupervisor ?? null },
        sistema: { id: null, re: null, nome: null, funcao: null, afastado: null, supervisor: null },
      })
      continue
    }

    if (normalizarNome(matchSistema.nome) !== normalizarNome(linha.nome)) tipos.push('nome_diferente')
    const funcaoSistemaNorm = normalizarNome(matchSistema.funcao ?? '')
    const funcaoRHNorm = normalizarNome(linha.funcao)
    const equivalentePorSinonimo = sinonimosFuncao.get(funcaoRHNorm)?.normalizado === funcaoSistemaNorm
    if (funcaoSistemaNorm !== funcaoRHNorm && !equivalentePorSinonimo) tipos.push('funcao_diferente')
    if (matchSistema.afastado !== !!linha.afastadoEm) tipos.push('afastado_diferente')
    if (apelidoSupervisor && matchSistema.supervisorNome !== apelidoSupervisor) tipos.push('supervisor_diferente')

    if (tipos.length > 0) {
      divergencias.push({
        chave: `par-${reNorm}-${indice}`,
        tipos,
        rh: { re: linha.re, nome: linha.nome, funcao: linha.funcao, afastado: !!linha.afastadoEm, supervisor: apelidoSupervisor ?? null },
        sistema: { id: matchSistema.id, re: matchSistema.registro, nome: matchSistema.nome, funcao: matchSistema.funcao, afastado: matchSistema.afastado, supervisor: matchSistema.supervisorNome },
      })
    }
  }

  // resumo agregado (lado Sistema) + "só no sistema"
  for (const f of funcionariosSistema) {
    const funcaoNome = f.funcao ? chaveResumoFuncaoSistema(f.funcao) : '(sem função)'
    const linhaResumo = linhaResumoDe(funcaoNome)
    if (f.supervisorNome) {
      if (!linhaResumo.porSupervisor[f.supervisorNome]) linhaResumo.porSupervisor[f.supervisorNome] = novaCelula()
      somaCelula(linhaResumo.porSupervisor[f.supervisorNome], 'sistema')
    }
    if (f.afastado) somaCelula(linhaResumo.afastados, 'sistema')
    somaCelula(linhaResumo.total, 'sistema')

    if (!sistemaCasados.has(f.id)) {
      divergencias.push({
        chave: `sistema-${f.id}`,
        tipos: ['so_no_sistema'],
        rh: { re: null, nome: null, funcao: null, afastado: null, supervisor: null },
        sistema: { id: f.id, re: f.registro, nome: f.nome, funcao: f.funcao, afastado: f.afastado, supervisor: f.supervisorNome },
      })
    }
  }

  const totalGeral = novaLinhaResumo('TOTAL', supervisoresApelidos)
  for (const linha of Array.from(resumoPorFuncao.values())) {
    for (const sup of supervisoresApelidos) {
      totalGeral.porSupervisor[sup].rh += linha.porSupervisor[sup]?.rh ?? 0
      totalGeral.porSupervisor[sup].sistema += linha.porSupervisor[sup]?.sistema ?? 0
    }
    totalGeral.afastados.rh += linha.afastados.rh
    totalGeral.afastados.sistema += linha.afastados.sistema
    totalGeral.total.rh += linha.total.rh
    totalGeral.total.sistema += linha.total.sistema
  }

  return {
    resumo: Array.from(resumoPorFuncao.values()).sort((a, b) => a.funcao.localeCompare(b.funcao)),
    totalGeral,
    divergencias,
    codigosSemSupervisorVinculado: Array.from(codigosSemSupervisor).sort((a, b) => a - b),
    linhasIgnoradas,
  }
}
