"""
Planejador da carga da listagem de limite de férias do RH (somente leitura).

Gera plano.json (operações) + dry-run.xlsx (conferência). Nada é gravado no banco aqui;
quem grava é aplicar.mjs, depois da aprovação do dry-run.

Uso:
  node scripts/ferias-rh/dump-db.mjs db.json
  python scripts/ferias-rh/planejar.py --xlsx "LIMITE DE FÉRIAS.xlsx" --db db.json --out saida/

Regras (decididas com o usuário em 21/10/2026):
  - PA do RH é a verdade; limite de gozo = fim do PA + 10 meses (mantém a data do RH quando ela já é +10m).
  - Dias de direito continuam calculados pelo sistema (não grava a projeção do RH).
  - PA aberto (disponível) mais antigo que o do RH: baixa (concluído) e cria o subsequente.
  - PA com datas deslocadas < 300 dias, PA inválido (< 300 dias de duração) e Tamara: sobrescreve com o PA do RH.
  - Funcionário que o RH não listou: PA derivado da admissão / último PA (inclui afastado, atestado, rescisão).
  - Um 'disponivel' por funcionário; nunca (funcionário, início) nem (funcionário, número) repetidos.
"""
import argparse, json, os
import numpy as np
import pandas as pd
from pandas.tseries.offsets import DateOffset

ap = argparse.ArgumentParser()
ap.add_argument('--xlsx', required=True)
ap.add_argument('--db', required=True)
ap.add_argument('--out', required=True)
ap.add_argument('--hoje', default=str(pd.Timestamp.today().date()))
args = ap.parse_args()
os.makedirs(args.out, exist_ok=True)
HOJE = pd.Timestamp(args.hoje)
HOJE_S = str(HOJE.date())

# Casos conferidos à mão com o usuário (registro RH)
GRUPO_A = {98978, 107462, 106716, 90653, 90709, 92495}   # gozo lançado no PA mais novo
IARA, BRUNA_B, ROCHELLE, TAMARA = 103260, 107118, 106252, 82234

db = json.load(open(args.db, encoding='utf-8'))
F = pd.DataFrame(db['func']); V = pd.DataFrame(db['ferias']); P = pd.DataFrame(db['postos'])
SUP = pd.DataFrame(db.get('sup', []))
for c in ['periodo_inicio', 'periodo_fim', 'limite_gozo', 'data_inicio', 'data_fim']:
    V[c] = pd.to_datetime(V[c])
F['adm'] = pd.to_datetime(F.data_admissao)
F['reg'] = pd.to_numeric(F.registro.astype(str).str.extract(r'(\d+)')[0], errors='coerce')
F = F.merge(P[['id', 'nome']].rename(columns={'id': 'posto_id', 'nome': 'posto'}), on='posto_id', how='left')
if len(SUP):
    F = F.merge(SUP.groupby('posto_id').sup.apply(lambda s: ' / '.join(sorted(set(s.dropna())))).reset_index(), on='posto_id', how='left')
else:
    F['sup'] = None

x = pd.read_excel(args.xlsx, header=2, usecols='B:O')
x.columns = ['cod', 'nome_rh', 'adm_rh', 'funcao_rh', 'ini', 'fim', 'limite', 'direito_rh', 'falta', 'afast', 'gozado', 'saldo_rh', 'cc', 'obs']
for c in ['ini', 'fim', 'limite', 'adm_rh']:
    x[c] = pd.to_datetime(x[c])
xi = x.set_index('cod')

NOTA = f'Baixado conforme listagem RH de {HOJE.strftime("%d/%m/%Y")} (gozo nao informado ao sistema)'


def s(v):
    return None if v is None or (not isinstance(v, str) and pd.isna(v)) else str(pd.Timestamp(v).date())


def num(v):
    return None if v is None or pd.isna(v) else float(v)


def lim10(fim):
    return fim + DateOffset(months=10)


def limite_regra(fim, limite_rh=None):
    """RH quando ele já usa ~10 meses; senão fim + 10 meses."""
    if limite_rh is not None and pd.notna(limite_rh) and (limite_rh - fim).days <= 310:
        return limite_rh
    return lim10(fim)


def meses(ini, ref):
    k = (ref.year - ini.year) * 12 + ref.month - ini.month
    if ref.day < ini.day:
        k -= 1
    return max(0, k)


def dir_hoje(ini, fim):
    return 30 if HOJE > fim else min(30, int(meses(ini, HOJE) * 2.5))


def num_deriv(adm, ini):
    return int(round((ini - adm).days / 365.25)) + 1


ops, rev, semrh, info = [], [], [], []   # info: linhas do relatório humano
cc_ops = []


def prox_num(nums, adm, ini, ultimo_ini=None):
    """Sequencial ao maior número existente quando o PA vem depois dos já cadastrados; senão pela admissão."""
    if nums and ultimo_ini is not None and ini > ultimo_ini:
        return max(nums) + 1
    n = num_deriv(adm, ini) if pd.notna(adm) else (max(nums) + 1 if nums else 1)
    if n in nums:
        n = max(nums) + 1
    return n


for f in F[F.status != 'desligado'].itertuples():
    rows = V[V.funcionario_id == f.id].sort_values('periodo_inicio')
    nums = set(rows.numero_periodo.dropna().astype(int))
    base = dict(registro=f.registro, nome=f.nome, situacao=f.status, posto=f.posto, supervisor=f.sup)
    reg = None if pd.isna(f.reg) else int(f.reg)
    com_rh = reg in xi.index

    def add(op, categoria, motivo, **kw):
        ops.append(dict(op=op, categoria=categoria, motivo=motivo, **base, **kw))

    if com_rh:
        r = xi.loc[reg]
        ini, fim = r.ini, r.fim
        lim = limite_regra(fim, r.limite)
        rh = dict(dias_falta=0.0 if pd.isna(r.falta) else float(r.falta), dias_afastado=0.0 if pd.isna(r.afast) else float(r.afast),
                  obs_rh=None if pd.isna(r.obs) else str(r.obs), rh_atualizado_em=HOJE_S)
        if pd.notna(r.cc):
            cc_ops.append(dict(op='update', table='funcionarios', id=f.id, set=dict(centro_custo=str(int(r.cc))), registro=f.registro, nome=f.nome, categoria='CC', motivo='centro de custo do RH', situacao=f.status, posto=f.posto, supervisor=f.sup))
        fonte = 'RH'
    else:
        rh = dict(dias_falta=None, dias_afastado=None, obs_rh=None, rh_atualizado_em=None)
        # sem RH: se já tem PA aberto, só alinha o limite (+10m); senão deriva o próximo PA
        if rows.status.isin(['disponivel', 'agendado', 'aprovado']).any():
            for o in rows[rows.status == 'disponivel'].itertuples():
                nl = lim10(o.periodo_fim)
                if o.limite_gozo != nl:
                    add('update', 'ATUALIZAR limite (sem RH)', 'limite recalculado fim+10m; funcionario fora da listagem do RH',
                        table='ferias', id=o.id, set=dict(limite_gozo=s(nl)), periodo=f'{s(o.periodo_inicio)} a {s(o.periodo_fim)}')
            continue
        ini = rows.iloc[-1].periodo_fim + pd.Timedelta(days=1) if len(rows) else f.adm
        if pd.isna(ini) or ini < HOJE - pd.Timedelta(days=730) or ini > HOJE:
            semrh.append({**base, 'motivo': 'fora da listagem do RH e PA seguinte nao derivavel (muito antigo, futuro ou sem admissao)',
                          'ultimo_pa_fim': s(rows.periodo_fim.max()) if len(rows) else None, 'admissao': s(f.adm)})
            continue
        fim = ini + DateOffset(years=1) - pd.Timedelta(days=1)
        lim = lim10(fim)
        fonte = 'derivado'

    T = dict(periodo_inicio=s(ini), periodo_fim=s(fim), limite_gozo=s(lim), **rh)
    same = rows[rows.periodo_inicio == ini]
    if len(same) == 0:
        near = rows[(rows.periodo_inicio - ini).abs().dt.days <= 35]
        if len(near):
            same = near
    disp = rows[rows.status == 'disponivel']
    novo_num = prox_num(nums, f.adm, ini, rows.periodo_inicio.max() if len(rows) else None)

    def insere_T(categoria, motivo, numero):
        add('insert', categoria, motivo, table='ferias', row=dict(
            funcionario_id=f.id, numero_periodo=int(numero), status='disponivel', dias_direito=dir_hoje(ini, fim), **T), fonte=fonte)

    # ---- casos explícitos (conferidos com o usuário) ----
    pre = len(same) > 0 and same.iloc[0].status == 'concluido'   # casos pontuais valem so enquanto o erro ainda existe
    if reg in GRUPO_A and pre and ((rows.status == 'disponivel') & (rows.periodo_inicio < same.iloc[0].periodo_inicio)).any():
        N = same.iloc[0]
        O = rows[(rows.status == 'disponivel') & (rows.periodo_inicio < N.periodo_inicio)].iloc[-1]
        add('update', 'GRUPO A - mover gozo ao PA antigo', f'gozo {s(N.data_inicio)} a {s(N.data_fim)} estava no PA {s(N.periodo_inicio)}; vai para o PA {s(O.periodo_inicio)}',
            table='ferias', id=O.id, set=dict(status='concluido', data_inicio=s(N.data_inicio), data_fim=s(N.data_fim), dias_utilizados=num(N.dias_utilizados),
                                              dias_abono=int(N.dias_abono or 0), aprovado_por=N.aprovado_por if pd.notna(N.aprovado_por) else None,
                                              aprovado_em=N.aprovado_em if pd.notna(N.aprovado_em) else None, pdf_url=N.pdf_url if pd.notna(N.pdf_url) else None,
                                              observacao=N.observacao if pd.notna(N.observacao) else None))
        add('update', 'GRUPO A - PA novo volta a disponivel', 'conforme RH, o PA pendente e o mais novo',
            table='ferias', id=N.id, set=dict(status='disponivel', data_inicio=None, data_fim=None, dias_utilizados=None, dias_abono=0,
                                              aprovado_por=None, aprovado_em=None, pdf_url=None, observacao=None, periodo_fim=T['periodo_fim'],
                                              limite_gozo=T['limite_gozo'], dias_falta=rh['dias_falta'], dias_afastado=rh['dias_afastado'],
                                              obs_rh=rh['obs_rh'], rh_atualizado_em=HOJE_S))
        continue
    if reg == IARA and pre:
        N = same.iloc[0]; O = rows[rows.periodo_inicio < N.periodo_inicio].iloc[-1]
        add('update', 'GRUPO B - Iara: PA 2024 recebe o complemento', 'RH considera PA 2024 consumido (22 + 6 dias); 6 dias registrados em observacao',
            table='ferias', id=O.id, set=dict(dias_utilizados=num(O.dias_utilizados) + num(N.dias_utilizados),
                                              observacao=f'Fracionado: {int(O.dias_utilizados)} dias em {s(O.data_inicio)} a {s(O.data_fim)} + {int(N.dias_utilizados)} dias em {s(N.data_inicio)} a {s(N.data_fim)} (complemento lancado antes no PA {s(N.periodo_inicio)}; ajustado conforme listagem RH {HOJE.strftime("%d/%m/%Y")})'))
        add('update', 'GRUPO B - Iara: PA 2025 volta a disponivel', 'conforme RH o PA 2025 esta inteiro',
            table='ferias', id=N.id, set=dict(status='disponivel', data_inicio=None, data_fim=None, dias_utilizados=None, dias_abono=0, aprovado_por=None,
                                              aprovado_em=None, pdf_url=None, observacao=None, periodo_fim=T['periodo_fim'], limite_gozo=T['limite_gozo'],
                                              dias_falta=rh['dias_falta'], dias_afastado=rh['dias_afastado'], obs_rh=rh['obs_rh'], rh_atualizado_em=HOJE_S))
        continue
    if reg == BRUNA_B and pre:
        N = same.iloc[0]
        add('update', 'GRUPO B - Bruna Barbosa: PA volta a disponivel', 'conforme RH; gozo informado no sistema fica em observacao - CONFIRMAR com supervisor',
            table='ferias', id=N.id, set=dict(status='disponivel', data_inicio=None, data_fim=None, dias_utilizados=None, dias_abono=0, aprovado_por=None,
                                              aprovado_em=None, pdf_url=None, periodo_fim=T['periodo_fim'], limite_gozo=T['limite_gozo'],
                                              observacao=f'Gozo informado no sistema: {s(N.data_inicio)} a {s(N.data_fim)} ({int(N.dias_utilizados or 0)} dias), nao consta na listagem do RH de {HOJE.strftime("%d/%m/%Y")}. Confirmar com o supervisor.',
                                              dias_falta=rh['dias_falta'], dias_afastado=rh['dias_afastado'], obs_rh=rh['obs_rh'], rh_atualizado_em=HOJE_S))
        continue
    if reg == ROCHELLE and pre and len(rows) == 1:
        N = same.iloc[0]
        add('update', 'GRUPO B - Rochelle: PA 2025 vira nº 2 e volta a disponivel', 'RH: PA 2025 pendente; gozo de 12 dias pertence ao PA 2024 (inexistente)',
            table='ferias', id=N.id, set=dict(numero_periodo=2, status='disponivel', data_inicio=None, data_fim=None, dias_utilizados=None, dias_abono=0,
                                              aprovado_por=None, aprovado_em=None, pdf_url=None, observacao=None, periodo_fim=T['periodo_fim'],
                                              limite_gozo=T['limite_gozo'], dias_falta=rh['dias_falta'], dias_afastado=rh['dias_afastado'],
                                              obs_rh=rh['obs_rh'], rh_atualizado_em=HOJE_S), ordem=0)
        pini = f.adm; pfim = pini + DateOffset(years=1) - pd.Timedelta(days=1)
        add('insert', 'GRUPO B - Rochelle: cria PA 2024 concluido', 'recebe o gozo de 12 dias',
            table='ferias', row=dict(funcionario_id=f.id, numero_periodo=1, status='concluido', dias_direito=30, periodo_inicio=s(pini), periodo_fim=s(pfim),
                                     limite_gozo=s(lim10(pfim)), data_inicio=s(N.data_inicio), data_fim=s(N.data_fim), dias_utilizados=num(N.dias_utilizados),
                                     observacao='PA criado conforme listagem RH; gozo movido do PA seguinte', rh_atualizado_em=HOJE_S), ordem=1)
        continue

    # ---- regra geral ----
    if len(same):
        sm = same.iloc[0]
        if sm.status == 'concluido':
            rev.append({**base, 'periodo_inicio': T['periodo_inicio'], 'motivo': 'RH mostra PA pendente mas o sistema ja esta CONCLUIDO'})
            continue
        add('update', 'ATUALIZAR PA existente', 'mesmo PA do RH: alinha datas, limite e faltas/afastamento', table='ferias', id=sm.id,
            set=dict(periodo_inicio=T['periodo_inicio'], periodo_fim=T['periodo_fim'], limite_gozo=T['limite_gozo'], dias_falta=rh['dias_falta'],
                     dias_afastado=rh['dias_afastado'], obs_rh=rh['obs_rh'], rh_atualizado_em=HOJE_S), status_ferias=sm.status)
        continue
    if len(disp) > 1:
        rev.append({**base, 'periodo_inicio': T['periodo_inicio'], 'motivo': f'{len(disp)} PAs disponiveis no sistema; resolver manualmente'})
        continue
    if len(disp) == 1:
        o = disp.iloc[0]
        dur = (o.periodo_fim - o.periodo_inicio).days
        dif = (ini - o.periodo_inicio).days
        if o.periodo_inicio > ini + pd.Timedelta(days=300) and dur > 300:
            insere_T('INSERIR PA do RH (mantem PA futuro)', 'PA do RH e anterior ao PA disponivel do sistema; ficam os dois', novo_num)
            continue
        if dur < 300 or abs(dif) < 300 or reg == TAMARA:
            tipo = 'PA invalido (30d)' if dur < 300 else 'datas deslocadas (<300d)'
            add('update', f'SOBRESCREVER PA ({tipo})', 'usa o PA do RH no mesmo registro', table='ferias', id=o.id,
                set=dict(periodo_inicio=T['periodo_inicio'], periodo_fim=T['periodo_fim'], limite_gozo=T['limite_gozo'], dias_falta=rh['dias_falta'],
                         dias_afastado=rh['dias_afastado'], obs_rh=rh['obs_rh'], rh_atualizado_em=HOJE_S),
                antes=f'{s(o.periodo_inicio)} a {s(o.periodo_fim)}')
            continue
        # PA aberto ~1 ano mais antigo: baixa o antigo e cria o(s) subsequente(s)
        add('update', 'BAIXAR PA antigo', NOTA, table='ferias', id=o.id,
            set=dict(status='concluido', observacao=(o.observacao + ' | ' if isinstance(o.observacao, str) and o.observacao else '') + NOTA),
            periodo=f'{s(o.periodo_inicio)} a {s(o.periodo_fim)}', numero=int(o.numero_periodo) if pd.notna(o.numero_periodo) else None)
        nn = set(nums)
        cur = o.periodo_fim + pd.Timedelta(days=1)
        while cur < ini - pd.Timedelta(days=35):
            if not ((rows.periodo_inicio - cur).abs().dt.days <= 35).any():
                cfim = cur + DateOffset(years=1) - pd.Timedelta(days=1)
                n2 = max(nn) + 1; nn.add(n2)
                add('insert', 'INSERIR PA intermediario concluido', 'PA entre o antigo e o do RH que nao existia no sistema', table='ferias',
                    row=dict(funcionario_id=f.id, numero_periodo=int(n2), status='concluido', dias_direito=30, periodo_inicio=s(cur), periodo_fim=s(cfim),
                             limite_gozo=s(lim10(cfim)), observacao=NOTA, rh_atualizado_em=HOJE_S))
            cur = cur + DateOffset(years=1)
        insere_T('INSERIR PA subsequente', 'subsequente ao PA baixado', max(nn) + 1)
        continue
    # sem PA disponível
    extra = rows.status.isin(['agendado', 'aprovado', 'em_curso']).any()
    insere_T('INSERIR PA' + (' (ja existe agendado/aprovado/em curso)' if extra else ''), 'sem PA disponivel no sistema', novo_num)

# ---------- simulação do estado final e invariantes ----------
estado = {}
for r in V.itertuples():
    estado.setdefault(r.funcionario_id, {})[r.id] = dict(status=r.status, ini=s(r.periodo_inicio), num=None if pd.isna(r.numero_periodo) else int(r.numero_periodo))
for o in sorted([o for o in ops if o['table'] == 'ferias'], key=lambda o: o.get('ordem', 5)):
    if o['op'] == 'update':
        fid = next(k for k, v in estado.items() if o['id'] in v)
        e = estado[fid][o['id']]
        if 'status' in o['set']: e['status'] = o['set']['status']
        if 'periodo_inicio' in o['set']: e['ini'] = o['set']['periodo_inicio']
        if 'numero_periodo' in o['set']: e['num'] = o['set']['numero_periodo']
    else:
        rw = o['row']
        estado.setdefault(rw['funcionario_id'], {})[f"novo-{len(estado)}-{rw['numero_periodo']}-{rw['periodo_inicio']}"] = dict(status=rw['status'], ini=rw['periodo_inicio'], num=rw['numero_periodo'])
viol = []
for fid, rs in estado.items():
    st = [v['status'] for v in rs.values()]
    inis = [v['ini'] for v in rs.values()]
    ns = [v['num'] for v in rs.values() if v['num'] is not None]
    if st.count('disponivel') > 1: viol.append((fid, 'mais de 1 disponivel'))
    if len(set(inis)) != len(inis): viol.append((fid, 'inicio de PA repetido'))
    if len(set(ns)) != len(ns): viol.append((fid, 'numero de PA repetido'))
print('VIOLACOES DE INVARIANTE:', len(viol), viol[:10])

# ---------- saída ----------
todas = ops + cc_ops
def limpa(v):
    """JSON estrito: NaN/NaT viram null."""
    if isinstance(v, dict):
        return {k: limpa(x) for k, x in v.items()}
    if isinstance(v, (list, tuple)):
        return [limpa(x) for x in v]
    if isinstance(v, float) and v != v:
        return None
    return v


json.dump(limpa(dict(gerado_em=HOJE_S, ops=todas, revisar=rev, sem_dado=semrh)), open(os.path.join(args.out, 'plano.json'), 'w', encoding='utf-8'), ensure_ascii=False, default=str, allow_nan=False)
df = pd.DataFrame([{k: v for k, v in o.items() if k not in ('row', 'set')} | {'valores': json.dumps(o.get('row') or o.get('set'), ensure_ascii=False, default=str)} for o in todas])
resumo = df.groupby(['op', 'categoria']).size().reset_index(name='qtd') if len(df) else pd.DataFrame()
print(resumo.to_string())
print('REVISAR', len(rev), '| SEM DADO', len(semrh))
with pd.ExcelWriter(os.path.join(args.out, 'dry-run-ferias.xlsx')) as w:
    resumo.to_excel(w, sheet_name='Resumo', index=False)
    cols = ['registro', 'nome', 'situacao', 'posto', 'supervisor', 'op', 'categoria', 'motivo', 'valores']
    df[df.categoria != 'CC'][cols].to_excel(w, sheet_name='Operacoes', index=False)
    pd.DataFrame(rev).to_excel(w, sheet_name='Revisar', index=False)
    pd.DataFrame(semrh).to_excel(w, sheet_name='Sem dado RH', index=False)
