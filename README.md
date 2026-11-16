# Achou Black — coletor GitHub Actions 1.3.0

O Chromium roda no runner gratuito do GitHub, **não** na Hostinger. Execute `npm run collect` ou Actions > Run workflow. O arquivo gerado fica em `output/ofertas.json` (artifact).

## Configuração

- `sites.json`: URLs HTTPS de produtos que a loja permita consultar, com `enabled: true`.
- GitHub > Settings > Secrets and variables > Actions:
  - `ACHOU_ENDPOINT`: `https://achoublack.shop/api/ofertas/importar`
  - `ACHOU_TOKEN`: o mesmo token de pelo menos 32 bytes cadastrado na Hostinger.
- O workflow encaminha os dois Secrets ao comando `npm run collect`.
- Hostinger: publicar o ZIP do servidor Node.js em implantação própria, manter `server.js` como entrada e definir `DATA_DIR` para uma pasta persistente.

## Limitações

O parser aceita **somente JSON-LD Product/Offer com preço BRL verificável**. Se a página não fornecer esse formato, serão zero produtos. Não são criadas ofertas artificiais, não se contornam CAPTCHAs, e a extração automatizada deve respeitar os termos da loja. No Amazon.com.br, uma página HTML 200 não implica preço estruturado disponível.

## Diagnóstico

O log `DIAGNÓSTICO` informa status, título, total de scripts JSON-LD, contagem de elementos HTML e possibilidade de desafio. Se o log ainda mostrar `Amazon: 0 produto(s) estruturado(s) válidos` sem o cabeçalho `VERSÃO 1.3.0`, você executou outro commit. Faça **Run workflow** novo em `main`, não Re-run jobs antigo.

Se o GitHub retornar `Resource not accessible by integration (403)` para edições, autorize escrita do conector ou faça upload manual; nenhum commit terá sido publicado automaticamente.
