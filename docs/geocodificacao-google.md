# Geocodificação dos postos (Google) — Fase 1

## Como funciona
- O **ponto oficial** do posto (`postos.latitude/longitude`) continua vindo do GPS do supervisor ou da marcação da coordenação em **Agenda → Locais**. É ele que valida o check-in.
- O **Google Geocoding** valida o endereço (`postos.endereco_busca`) e devolve uma **sugestão** guardada em `geo_google_*` por **30 dias** (termos do Google, itens 6.2/6.3). A sugestão **nunca** vira o ponto oficial sozinha e **não é desenhada** nos mapas OpenStreetMap: aparece como texto, distância ao pino e link "Ver no Google Maps".
- O `place_id` e o hash do endereço ficam sem prazo. Mesmo endereço = nenhuma chamada nova (exceto "Revalidar").
- Chamadas ao Google só acontecem: posto novo com endereço, endereço alterado, botão **Consultar**/**Revalidar** em Agenda → Locais.
- Cron diário `/api/cron/limpar-geo-google` apaga sugestões vencidas.
- Todo evento do ponto (GPS, confirmação no mapa, proposta aprovada, remoção, consulta ao Google) grava em `postos_geo_historico`.

## Ações fora do código
1. **Supabase Studio** → SQL Editor: aplicar `supabase/migrations/20261118_postos_geocodificacao.sql` (aditiva, pode rodar mais de uma vez).
2. **Vercel** → Project → Settings → Environment Variables: criar `GOOGLE_GEOCODING_API_KEY` (Sensitive; Production e Preview) e fazer redeploy. Sem prefixo `NEXT_PUBLIC_`.
3. **`.env.local`**: colar a mesma chave para uso local.
4. **Google Cloud**: quota diária da Geocoding API (sugestão: 300/dia) e alerta de orçamento.

Sem a chave, a tela mostra "Geocodificação não configurada no servidor" e o fluxo manual (mapa/GPS) continua funcionando. Sem a migração, o sistema segue como antes (as telas novas ficam vazias).
