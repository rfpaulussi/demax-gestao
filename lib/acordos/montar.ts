import type { CamposAcordo, FuncionarioCalc } from './tipos'
import { agruparPorJornada, resumoCalculo } from './movimentos'
import { gerarObjeto } from './templates'
import { assinaturaSemana, juntarRotulos, semanaParaTexto } from './horario-do-turno'

export interface TurnoHorario {
  label: string
  horario: Record<string, string>   // dia -> "07:00 às 12:00 / 13:12 às 17:00"
  funcionario_ids: string[]
  /** Parágrafo de compensação deste turno (depois de "…com a finalidade de que os funcionários "). Ausente em acordos antigos. */
  objeto?: string
}

export type TextosAcordo =
  | { ok: true; horarios: TurnoHorario[]; descricao: string }
  | { ok: false; erro: string }

/**
 * Turnos (tabela de horários + parágrafo de compensação) e `descricao_acordo` de um acordo.
 * Usado para gravar (servidor) e para o rascunho em PDF (navegador): os dois têm que sair iguais.
 * Não valida: quem chama roda `validarAcordo` antes.
 */
export function montarTextosAcordo(campos: CamposAcordo, funcs: FuncionarioCalc[]): TextosAcordo {
  const grupos = agruparPorJornada(campos, funcs)
  if (grupos.length === 0) return { ok: false, erro: 'Selecione ao menos um funcionário.' }

  // Revezamento: cada grupo (mesma data de folga) abre o parágrafo com os nomes dele
  const revezamento = !!campos.folgasPorFuncionario || !!campos.participantes
  const textoDoGrupo: string[] = []
  const grupoDoFunc = new Map<string, number>()
  const objetosDosGrupos: string[] = []
  for (let gi = 0; gi < grupos.length; gi++) {
    const g = grupos[gi]
    const texto = gerarObjeto(campos, resumoCalculo(campos, g))
    if (!texto.ok) return { ok: false, erro: texto.erro }
    textoDoGrupo.push(texto.texto)
    objetosDosGrupos.push(revezamento ? `${juntarRotulos(g.map(f => f.nome))} ${texto.texto}` : texto.texto)
    for (const f of g) grupoDoFunc.set(f.id, gi)
  }

  /** Parágrafo de um turno: um trecho por grupo que tem gente nele, com só os nomes que são daquele turno. */
  const objetoDoTurno = (membros: FuncionarioCalc[]): string => {
    const porGrupo = new Map<number, FuncionarioCalc[]>()
    for (const f of membros) {
      const gi = grupoDoFunc.get(f.id)!
      porGrupo.set(gi, [...(porGrupo.get(gi) ?? []), f])
    }
    const trechos = Array.from(porGrupo.entries()).map(([gi, fs]) =>
      (revezamento ? `${juntarRotulos(fs.map(f => f.nome))} ${textoDoGrupo[gi]}` : textoDoGrupo[gi]).replace(/\.$/, ''))
    return `${Array.from(new Set(trechos)).join('; e os funcionários ')}.`
  }

  const porSemana = new Map<string, FuncionarioCalc[]>()
  for (const f of funcs) {
    const chave = assinaturaSemana(f.semana)
    porSemana.set(chave, [...(porSemana.get(chave) ?? []), f])
  }
  const gruposDeTurno = Array.from(porSemana.values())
  const horarios: TurnoHorario[] = gruposDeTurno.map((g, i) => ({
    label: gruposDeTurno.length === 1 ? 'Turno Único' : `Turno ${String.fromCharCode(65 + i)}`,
    horario: semanaParaTexto(g[0].semana),
    funcionario_ids: g.map(f => f.id),
    // um turno pode ter grupos de datas diferentes no revezamento: um trecho por grupo, só com os nomes do turno
    objeto: objetoDoTurno(g),
  }))

  // descricao_acordo: um texto só quando todos os grupos coincidem; senão, um trecho por grupo com os turnos dele
  const descricao = objetosDosGrupos.every(o => o === objetosDosGrupos[0])
    ? objetosDosGrupos[0]
    : grupos.map((g, gi) => {
        const ids = new Set(g.map(f => f.id))
        const labels = horarios.filter(h => h.funcionario_ids.some(id => ids.has(id))).map(h => h.label)
        return `${juntarRotulos(labels)}: ${objetosDosGrupos[gi]}`
      }).join(' ')

  return { ok: true, horarios, descricao }
}
