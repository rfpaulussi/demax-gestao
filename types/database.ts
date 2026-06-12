// Tipos gerados manualmente espelhando o schema Supabase (001_schema.sql)
// Padrão: Database > Tables > Row | Insert | Update

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      // ----------------------------------------------------------
      // funcoes
      // ----------------------------------------------------------
      funcoes: {
        Row: {
          id: string
          nome: string
          insalubridade_perc: number | null
          periculosidade_perc: number | null
          salario_base: number | null
          insalubridade_valor: number | null
          periculosidade_valor: number | null
          ativo: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          nome: string
          insalubridade_perc?: number | null
          periculosidade_perc?: number | null
          salario_base?: number | null
          insalubridade_valor?: number | null
          periculosidade_valor?: number | null
          ativo?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          nome?: string
          insalubridade_perc?: number | null
          periculosidade_perc?: number | null
          salario_base?: number | null
          insalubridade_valor?: number | null
          periculosidade_valor?: number | null
          ativo?: boolean
          updated_at?: string
        }
        Relationships: []
      }

      // ----------------------------------------------------------
      // custos_funcoes
      // ----------------------------------------------------------
      custos_funcoes: {
        Row: {
          id: string
          funcao_id: string
          enc_inss: number | null
          fgts: number | null
          va: number | null
          assid_asseio: number | null
          vr: number | null
          vt: number | null
          bss: number | null
          aux_saude: number | null
          plr: number | null
          um_doze_decimo_terceiro: number | null
          um_terceiro_ferias: number | null
          enc_provisorio: number | null
          um_doze_lei_12506: number | null
          multa_40_pct: number | null
          total_por_func: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          funcao_id: string
          enc_inss?: number | null
          fgts?: number | null
          va?: number | null
          assid_asseio?: number | null
          vr?: number | null
          vt?: number | null
          bss?: number | null
          aux_saude?: number | null
          plr?: number | null
          um_doze_decimo_terceiro?: number | null
          um_terceiro_ferias?: number | null
          enc_provisorio?: number | null
          um_doze_lei_12506?: number | null
          multa_40_pct?: number | null
          total_por_func?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          funcao_id?: string
          enc_inss?: number | null
          fgts?: number | null
          va?: number | null
          assid_asseio?: number | null
          vr?: number | null
          vt?: number | null
          bss?: number | null
          aux_saude?: number | null
          plr?: number | null
          um_doze_decimo_terceiro?: number | null
          um_terceiro_ferias?: number | null
          enc_provisorio?: number | null
          um_doze_lei_12506?: number | null
          multa_40_pct?: number | null
          total_por_func?: number | null
          updated_at?: string
        }
        Relationships: []
      }

      // ----------------------------------------------------------
      // contratos
      // ----------------------------------------------------------
      contratos: {
        Row: {
          id: string
          numero: string | null
          secretaria: string | null
          objeto: string | null
          data_inicio: string | null
          data_fim: string | null
          valor_mensal: number | null
          ativo: boolean
          created_at: string
        }
        Insert: {
          id?: string
          numero?: string | null
          secretaria?: string | null
          objeto?: string | null
          data_inicio?: string | null
          data_fim?: string | null
          valor_mensal?: number | null
          ativo?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          numero?: string | null
          secretaria?: string | null
          objeto?: string | null
          data_inicio?: string | null
          data_fim?: string | null
          valor_mensal?: number | null
          ativo?: boolean
        }
        Relationships: []
      }

      // ----------------------------------------------------------
      // postos
      // ----------------------------------------------------------
      postos: {
        Row: {
          id: string
          contrato_id: string | null
          nome: string
          secretaria: string | null
          efetivo_previsto: number | null
          cota_insalubridade: number
          ativo: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          contrato_id?: string | null
          nome: string
          secretaria?: string | null
          efetivo_previsto?: number | null
          cota_insalubridade?: number
          ativo?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          contrato_id?: string | null
          nome?: string
          secretaria?: string | null
          efetivo_previsto?: number | null
          cota_insalubridade?: number
          ativo?: boolean
          updated_at?: string
        }
        Relationships: []
      }

      // ----------------------------------------------------------
      // composicao_postos
      // ----------------------------------------------------------
      composicao_postos: {
        Row: {
          id: string
          posto_id: string
          funcao_id: string
          quantidade: number
          created_at: string
        }
        Insert: {
          id?: string
          posto_id: string
          funcao_id: string
          quantidade?: number
          created_at?: string
        }
        Update: {
          id?: string
          posto_id?: string
          funcao_id?: string
          quantidade?: number
        }
        Relationships: []
      }

      // ----------------------------------------------------------
      // perfis
      // ----------------------------------------------------------
      perfis: {
        Row: {
          id: string
          nome: string | null
          email: string | null
          role: 'admin' | 'coordenador' | 'supervisor' | 'viewer' | null
          ativo: boolean
          created_at: string
        }
        Insert: {
          id: string                 // obrigatório: espelha auth.users.id
          nome?: string | null
          email?: string | null
          role?: 'admin' | 'coordenador' | 'supervisor' | 'viewer' | null
          ativo?: boolean
          created_at?: string
        }
        Update: {
          nome?: string | null
          email?: string | null
          role?: 'admin' | 'coordenador' | 'supervisor' | 'viewer' | null
          ativo?: boolean
        }
        Relationships: []
      }

      // ----------------------------------------------------------
      // config_supervisores_postos
      // ----------------------------------------------------------
      config_supervisores_postos: {
        Row: {
          id: string
          supervisor_id: string
          posto_id: string
          ativo: boolean
        }
        Insert: {
          id?: string
          supervisor_id: string
          posto_id: string
          ativo?: boolean
        }
        Update: {
          id?: string
          supervisor_id?: string
          posto_id?: string
          ativo?: boolean
        }
        Relationships: []
      }

      // ----------------------------------------------------------
      // historico_funcionarios
      // ----------------------------------------------------------
      historico_funcionarios: {
        Row: {
          id: string
          funcionario_id: string
          tipo: 'admissao' | 'desligamento' | 'mudanca_posto' | 'mudanca_funcao' | 'ferias' | 'atestado' | 'falta' | 'advertencia' | 'suspensao' | 'cobertura_insalubre' | 'transferencia' | 'reativacao'
          data_evento: string
          descricao: string | null
          dados_anteriores: Json | null
          dados_novos: Json | null
          registrado_por: string | null
          created_at: string
        }
        Insert: {
          id?: string
          funcionario_id: string
          tipo: 'admissao' | 'desligamento' | 'mudanca_posto' | 'mudanca_funcao' | 'ferias' | 'atestado' | 'falta' | 'advertencia' | 'suspensao' | 'cobertura_insalubre' | 'transferencia' | 'reativacao'
          data_evento: string
          descricao?: string | null
          dados_anteriores?: Json | null
          dados_novos?: Json | null
          registrado_por?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          funcionario_id?: string
          tipo?: 'admissao' | 'desligamento' | 'mudanca_posto' | 'mudanca_funcao' | 'ferias' | 'atestado' | 'falta' | 'advertencia' | 'suspensao' | 'cobertura_insalubre' | 'transferencia' | 'reativacao'
          data_evento?: string
          descricao?: string | null
          dados_anteriores?: Json | null
          dados_novos?: Json | null
          registrado_por?: string | null
        }
        Relationships: []
      }

      // ----------------------------------------------------------
      // config_escalas_postos
      // ----------------------------------------------------------
      config_escalas_postos: {
        Row: {
          posto_id: string
          regime: string
        }
        Insert: {
          posto_id: string
          regime: string
        }
        Update: {
          posto_id?: string
          regime?: string
        }
        Relationships: []
      }

      // ----------------------------------------------------------
      // funcionarios
      // ----------------------------------------------------------
      funcionarios: {
        Row: {
          id: string
          nome: string
          cpf: string | null
          funcao_id: string | null
          posto_id: string | null
          status: 'ativo' | 'afastado' | 'ferias' | 'desligado' | null
          data_admissao: string | null
          data_desligamento: string | null
          salario_base: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          nome: string
          cpf?: string | null
          funcao_id?: string | null
          posto_id?: string | null
          status?: 'ativo' | 'afastado' | 'ferias' | 'desligado' | null
          data_admissao?: string | null
          data_desligamento?: string | null
          salario_base?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          nome?: string
          cpf?: string | null
          funcao_id?: string | null
          posto_id?: string | null
          status?: 'ativo' | 'afastado' | 'ferias' | 'desligado' | null
          data_admissao?: string | null
          data_desligamento?: string | null
          salario_base?: number | null
          updated_at?: string
        }
        Relationships: []
      }

      // ----------------------------------------------------------
      // coberturas_temporarias
      // ----------------------------------------------------------
      coberturas_temporarias: {
        Row: {
          id: string
          funcionario_id: string
          posto_destino_id: string
          posto_origem_id: string | null
          motivo: string | null
          data_inicio: string | null
          data_prev_retorno: string | null
          data_retorno_real: string | null
          urgencia: 'baixa' | 'media' | 'alta' | null
          status: 'ativa' | 'encerrada' | null
          created_at: string
        }
        Insert: {
          id?: string
          funcionario_id: string
          posto_destino_id: string
          posto_origem_id?: string | null
          motivo?: string | null
          data_inicio?: string | null
          data_prev_retorno?: string | null
          data_retorno_real?: string | null
          urgencia?: 'baixa' | 'media' | 'alta' | null
          status?: 'ativa' | 'encerrada' | null
          created_at?: string
        }
        Update: {
          id?: string
          funcionario_id?: string
          posto_destino_id?: string
          posto_origem_id?: string | null
          motivo?: string | null
          data_inicio?: string | null
          data_prev_retorno?: string | null
          data_retorno_real?: string | null
          urgencia?: 'baixa' | 'media' | 'alta' | null
          status?: 'ativa' | 'encerrada' | null
        }
        Relationships: []
      }

      // ----------------------------------------------------------
      // ferias
      // ----------------------------------------------------------
      ferias: {
        Row: {
          id: string
          funcionario_id: string
          data_inicio: string | null
          data_fim: string | null
          observacao: string | null
          status: 'agendado' | 'aprovado' | 'em_curso' | 'concluido' | 'cancelado' | null
          created_at: string
          numero_periodo: number | null
          periodo_inicio: string | null
          periodo_fim: string | null
          limite_gozo: string | null
          dias_direito: number | null
          dias_utilizados: number | null
          aprovado_por: string | null
          aprovado_em: string | null
          pdf_url: string | null
          criado_por: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          funcionario_id: string
          data_inicio?: string | null
          data_fim?: string | null
          observacao?: string | null
          status?: 'agendado' | 'aprovado' | 'em_curso' | 'concluido' | 'cancelado' | null
          created_at?: string
          numero_periodo?: number | null
          periodo_inicio?: string | null
          periodo_fim?: string | null
          limite_gozo?: string | null
          dias_direito?: number | null
          dias_utilizados?: number | null
          aprovado_por?: string | null
          aprovado_em?: string | null
          pdf_url?: string | null
          criado_por?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          funcionario_id?: string
          data_inicio?: string | null
          data_fim?: string | null
          observacao?: string | null
          status?: 'agendado' | 'aprovado' | 'em_curso' | 'concluido' | 'cancelado' | null
          numero_periodo?: number | null
          periodo_inicio?: string | null
          periodo_fim?: string | null
          limite_gozo?: string | null
          dias_direito?: number | null
          dias_utilizados?: number | null
          aprovado_por?: string | null
          aprovado_em?: string | null
          pdf_url?: string | null
          criado_por?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }

      // ----------------------------------------------------------
      // atestados
      // ----------------------------------------------------------
      atestados: {
        Row: {
          id: string
          funcionario_id: string
          posto_id: string
          data_inicio: string
          data_fim: string
          motivo: string | null
          cid: string | null
          cid_codigo: string | null
          registrado_por: string
          created_at: string
        }
        Insert: {
          id?: string
          funcionario_id: string
          posto_id: string
          data_inicio: string
          data_fim: string
          motivo?: string | null
          cid?: string | null
          cid_codigo?: string | null
          registrado_por: string
          created_at?: string
        }
        Update: {
          id?: string
          funcionario_id?: string
          posto_id?: string
          data_inicio?: string
          data_fim?: string
          motivo?: string | null
          cid?: string | null
          cid_codigo?: string | null
          registrado_por?: string
        }
        Relationships: []
      }

      // ----------------------------------------------------------
      // cid_referencia
      // ----------------------------------------------------------
      cid_referencia: {
        Row: {
          codigo: string
          descricao: string
        }
        Insert: {
          codigo: string
          descricao: string
        }
        Update: {
          codigo?: string
          descricao?: string
        }
        Relationships: []
      }

      // ----------------------------------------------------------
      // advertencias
      // ----------------------------------------------------------
      advertencias: {
        Row: {
          id: string
          funcionario_id: string
          tipo: string | null
          grau: 'verbal' | 'escrita' | 'suspensao' | null
          descricao: string | null
          data_ocorrencia: string | null
          horario_fato: string | null
          natureza: string | null
          relato: string | null
          testemunha_1: string | null
          testemunha_2: string | null
          defesa_colaborador: string | null
          dias_suspensao: number | null
          data_aplicacao: string | null
          pdf_url: string | null
          status: 'pendente' | 'gerada' | 'entregue' | null
          criado_por: string | null
          registrado_por: string | null
          created_at: string
        }
        Insert: {
          id?: string
          funcionario_id: string
          tipo?: string | null
          grau?: 'verbal' | 'escrita' | 'suspensao' | null
          descricao?: string | null
          data_ocorrencia?: string | null
          horario_fato?: string | null
          natureza?: string | null
          relato?: string | null
          testemunha_1?: string | null
          testemunha_2?: string | null
          defesa_colaborador?: string | null
          dias_suspensao?: number | null
          data_aplicacao?: string | null
          pdf_url?: string | null
          status?: 'pendente' | 'gerada' | 'entregue' | null
          criado_por?: string | null
          registrado_por?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          funcionario_id?: string
          tipo?: string | null
          grau?: 'verbal' | 'escrita' | 'suspensao' | null
          descricao?: string | null
          data_ocorrencia?: string | null
          horario_fato?: string | null
          natureza?: string | null
          relato?: string | null
          testemunha_1?: string | null
          testemunha_2?: string | null
          defesa_colaborador?: string | null
          dias_suspensao?: number | null
          data_aplicacao?: string | null
          pdf_url?: string | null
          status?: 'pendente' | 'gerada' | 'entregue' | null
          criado_por?: string | null
          registrado_por?: string | null
        }
        Relationships: []
      }

      // ----------------------------------------------------------
      // coberturas_insalubres
      // ----------------------------------------------------------
      coberturas_insalubres: {
        Row: {
          id: string
          funcionario_id: string
          posto_id: string
          data_inicio: string | null
          data_fim: string | null
          grau: 'minimo' | 'medio' | 'maximo' | null
          percentual: number | null
          declaracao_url: string | null
          status: 'pendente' | 'enviada' | null
          created_at: string
        }
        Insert: {
          id?: string
          funcionario_id: string
          posto_id: string
          data_inicio?: string | null
          data_fim?: string | null
          grau?: 'minimo' | 'medio' | 'maximo' | null
          percentual?: number | null
          declaracao_url?: string | null
          status?: 'pendente' | 'enviada' | null
          created_at?: string
        }
        Update: {
          id?: string
          funcionario_id?: string
          posto_id?: string
          data_inicio?: string | null
          data_fim?: string | null
          grau?: 'minimo' | 'medio' | 'maximo' | null
          percentual?: number | null
          declaracao_url?: string | null
          status?: 'pendente' | 'enviada' | null
        }
        Relationships: []
      }

      // ----------------------------------------------------------
      // insalubridade_coberturas
      // ----------------------------------------------------------
      insalubridade_coberturas: {
        Row: {
          id: string
          funcionario_id: string
          mes: number
          ano: number
          data_cobertura: string
          agente_ausente_id: string | null
          agente_ausente_nome: string | null
          posto_id: string | null
          origem: 'manual' | 'cobertura'
          cobertura_id: string | null
          percentual: number
          observacao: string | null
          status: 'pendente' | 'enviado' | 'pago'
          criado_por: string | null
          created_at: string
        }
        Insert: {
          id?: string
          funcionario_id: string
          mes: number
          ano: number
          data_cobertura: string
          agente_ausente_id?: string | null
          agente_ausente_nome?: string | null
          posto_id?: string | null
          origem?: 'manual' | 'cobertura'
          cobertura_id?: string | null
          percentual?: number
          observacao?: string | null
          status?: 'pendente' | 'enviado' | 'pago'
          criado_por?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          funcionario_id?: string
          mes?: number
          ano?: number
          data_cobertura?: string
          agente_ausente_id?: string | null
          agente_ausente_nome?: string | null
          posto_id?: string | null
          origem?: 'manual' | 'cobertura'
          cobertura_id?: string | null
          percentual?: number
          observacao?: string | null
          status?: 'pendente' | 'enviado' | 'pago'
          criado_por?: string | null
        }
        Relationships: []
      }

      // ----------------------------------------------------------
      // logs_alocacoes_mensais
      // ----------------------------------------------------------
      logs_alocacoes_mensais: {
        Row: {
          id: string
          posto_id: string
          mes_referencia: string | null
          efetivo_previsto: number | null
          efetivo_real: number | null
          nomes_funcionarios: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          posto_id: string
          mes_referencia?: string | null
          efetivo_previsto?: number | null
          efetivo_real?: number | null
          nomes_funcionarios?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          posto_id?: string
          mes_referencia?: string | null
          efetivo_previsto?: number | null
          efetivo_real?: number | null
          nomes_funcionarios?: Json | null
        }
        Relationships: []
      }

      // ----------------------------------------------------------
      // ocorrencias
      // ----------------------------------------------------------
      ocorrencias: {
        Row: {
          id: string
          posto_id: string
          supervisor_id: string
          descricao: string | null
          data_ocorrencia: string | null
          gravidade: 'baixa' | 'media' | 'alta' | null
          status: 'aberta' | 'em_analise' | 'encerrada' | null
          created_at: string
        }
        Insert: {
          id?: string
          posto_id: string
          supervisor_id: string
          descricao?: string | null
          data_ocorrencia?: string | null
          gravidade?: 'baixa' | 'media' | 'alta' | null
          status?: 'aberta' | 'em_analise' | 'encerrada' | null
          created_at?: string
        }
        Update: {
          id?: string
          posto_id?: string
          supervisor_id?: string
          descricao?: string | null
          data_ocorrencia?: string | null
          gravidade?: 'baixa' | 'media' | 'alta' | null
          status?: 'aberta' | 'em_analise' | 'encerrada' | null
        }
        Relationships: []
      }

      // ----------------------------------------------------------
      // transferencias
      // ----------------------------------------------------------
      transferencias: {
        Row: {
          id: string
          funcionario_id: string
          posto_origem_id: string
          posto_destino_id: string
          data_transferencia: string | null
          motivo: string | null
          status: 'aguardando' | 'aprovada' | 'rejeitada'
          observacao_coordenador: string | null
          criado_por: string | null
          created_at: string
        }
        Insert: {
          id?: string
          funcionario_id: string
          posto_origem_id: string
          posto_destino_id: string
          data_transferencia?: string | null
          motivo?: string | null
          status?: 'aguardando' | 'aprovada' | 'rejeitada'
          observacao_coordenador?: string | null
          criado_por?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          funcionario_id?: string
          posto_origem_id?: string
          posto_destino_id?: string
          data_transferencia?: string | null
          motivo?: string | null
          status?: 'aguardando' | 'aprovada' | 'rejeitada'
          observacao_coordenador?: string | null
          criado_por?: string | null
        }
        Relationships: []
      }

      // ----------------------------------------------------------
      // solicitacoes
      // ----------------------------------------------------------
      solicitacoes: {
        Row: {
          id: string
          tipo: 'desligamento' | 'transferencia' | 'mudanca_funcao' | 'promocao' | 'mudanca_supervisor' | 'alteracao_salario'
          status: 'pendente' | 'aprovada' | 'rejeitada'
          funcionario_id: string
          supervisor_id: string | null
          dados_antes: Json | null
          dados_depois: Json | null
          motivo: string | null
          observacao_admin: string | null
          aprovado_por: string | null
          aprovado_em: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          tipo: 'desligamento' | 'transferencia' | 'mudanca_funcao' | 'promocao' | 'mudanca_supervisor' | 'alteracao_salario'
          status?: 'pendente' | 'aprovada' | 'rejeitada'
          funcionario_id: string
          supervisor_id?: string | null
          dados_antes?: Json | null
          dados_depois?: Json | null
          motivo?: string | null
          observacao_admin?: string | null
          aprovado_por?: string | null
          aprovado_em?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          tipo?: 'desligamento' | 'transferencia' | 'mudanca_funcao' | 'promocao' | 'mudanca_supervisor' | 'alteracao_salario'
          status?: 'pendente' | 'aprovada' | 'rejeitada'
          funcionario_id?: string
          supervisor_id?: string | null
          dados_antes?: Json | null
          dados_depois?: Json | null
          motivo?: string | null
          observacao_admin?: string | null
          aprovado_por?: string | null
          aprovado_em?: string | null
        }
        Relationships: []
      }

      // ----------------------------------------------------------
      // movimentacoes
      // ----------------------------------------------------------
      // faltas
      // ----------------------------------------------------------
      faltas: {
        Row: {
          id: string
          funcionario_id: string
          data_falta: string
          tipo: string
          dias: number
          observacao: string | null
          tem_documento: boolean
          justificativa: string | null
          registrado_por: string
          created_at: string
        }
        Insert: {
          id?: string
          funcionario_id: string
          data_falta: string
          tipo: string
          dias?: number
          observacao?: string | null
          tem_documento?: boolean
          justificativa?: string | null
          registrado_por: string
          created_at?: string
        }
        Update: {
          id?: string
          funcionario_id?: string
          data_falta?: string
          tipo?: string
          dias?: number
          observacao?: string | null
          tem_documento?: boolean
          justificativa?: string | null
          registrado_por?: string
        }
        Relationships: [
          { foreignKeyName: 'faltas_funcionario_id_fkey'; columns: ['funcionario_id']; referencedRelation: 'funcionarios'; referencedColumns: ['id'] },
          { foreignKeyName: 'faltas_registrado_por_fkey'; columns: ['registrado_por']; referencedRelation: 'perfis'; referencedColumns: ['id'] },
        ]
      }

      // movimentacoes
      // ----------------------------------------------------------
      movimentacoes: {
        Row: {
          id: string
          funcionario_id: string
          tipo: string
          campo_alterado: string | null
          valor_antes: string | null
          valor_depois: string | null
          executado_por: string | null
          solicitacao_id: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          funcionario_id: string
          tipo: string
          campo_alterado?: string | null
          valor_antes?: string | null
          valor_depois?: string | null
          executado_por?: string | null
          solicitacao_id?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          funcionario_id?: string
          tipo?: string
          campo_alterado?: string | null
          valor_antes?: string | null
          valor_depois?: string | null
          executado_por?: string | null
          solicitacao_id?: string | null
        }
        Relationships: []
      }
    }

    Views: { [_ in never]: never }
    Functions: { [_ in never]: never }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}

// ----------------------------------------------------------
// Helpers convenientes (padrão Supabase)
// ----------------------------------------------------------
type PublicTables = Database['public']['Tables']

export type Tables<T extends keyof PublicTables> = PublicTables[T]['Row']
export type TablesInsert<T extends keyof PublicTables> = PublicTables[T]['Insert']
export type TablesUpdate<T extends keyof PublicTables> = PublicTables[T]['Update']
