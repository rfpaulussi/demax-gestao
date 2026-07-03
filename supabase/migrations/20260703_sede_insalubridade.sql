-- ANTES de executar: verificar qual funcao os agentes de higienização usam na SEDE:
-- SELECT fu.nome AS funcao, COUNT(*) AS qtd
-- FROM funcionarios f
-- JOIN funcoes fu ON f.funcao_id = fu.id
-- JOIN postos p ON f.posto_id = p.id
-- WHERE p.nome = 'SEDE' AND fu.nome ILIKE '%higieniza%'
-- GROUP BY fu.nome;

-- Ajustar cota_insalubridade com o valor correto do contrato para SEDE
-- (substituir 2 pelo número real de cotas previstas)
UPDATE postos
SET cota_insalubridade = 2
WHERE nome = 'SEDE';
