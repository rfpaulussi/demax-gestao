-- Vincula o admin Rodolfo como supervisor do posto SEDE
INSERT INTO config_supervisores_postos (supervisor_id, posto_id, ativo)
SELECT
  p.id AS supervisor_id,
  po.id AS posto_id,
  true AS ativo
FROM perfis p
CROSS JOIN postos po
WHERE p.email = 'rfpaulussi@hotmail.com'
  AND po.nome = 'SEDE'
ON CONFLICT DO NOTHING;

-- Verificação:
-- SELECT p.nome, p.email, p.role, po.nome AS posto
-- FROM config_supervisores_postos csp
-- JOIN perfis p ON csp.supervisor_id = p.id
-- JOIN postos po ON csp.posto_id = po.id
-- WHERE po.nome = 'SEDE' AND csp.ativo = true;
