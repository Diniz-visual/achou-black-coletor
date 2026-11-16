# Achou Black — coletor GitHub Actions

- Execute `npm install` e `npx playwright install chromium`, depois `npm run collect`.
- `sites.json` aceita **páginas de produto** em lojas reconhecidas no `src/sources.cjs`; a homepage não contém preço de produto confiável.
- Apenas JSON-LD de `Product` com uma `Offer` em BRL, em estoque, passa na validação. Dados indisponíveis **não são inventados**.
- Execute o workflow manualmente em Actions ou aguarde o agendamento.
- Secrets: `ACHOU_ENDPOINT=https://achoublack.shop/api/ofertas/importar` e `ACHOU_TOKEN` igual ao configurado como variável de ambiente na Hostinger.
- Publique o ZIP da Hostinger **primeiro**, antes de cadastrar `ACHOU_ENDPOINT`.
- O resultado do teste é salvo em `output/ofertas.json` e nos artifacts do Actions.
- `0 produtos` não é erro de execução: pode significar que a página não disponibiliza dados estruturados válidos; não há atualização da Hostinger nesse caso.
- Verifique permissões, robots.txt e termos das fontes; use APIs oficiais quando disponíveis.
