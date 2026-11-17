# Achou Black — campanhas Black Friday v1.4

O coletor abre vitrines habilitadas, descobre URLs de produtos suportadas, visita no máximo 12 páginas individuais por loja e aceita apenas preços verificados.

**Amazon:** descoberta de URLs `/dp/ASIN` na página da campanha, parser JSON-LD estrito com fallback controlado ao preço único do bloco de compra na página do produto. Não inventa desconto de Black Friday; `campaigns` permanece vazio sem evidência do próprio produto.

**Mercado Livre e KaBuM:** descoberta básica de URLs, mas a extração só funciona quando houver JSON-LD válido. Outras lojas ficam desativadas até existir adaptador verificado; não use URLs de home como substituto de campanhas.

Na pasta `.github/workflows/` mantenha `ubuntu-24.04` e cadastre `ACHOU_ENDPOINT` e `ACHOU_TOKEN` em GitHub Secrets. Na Hostinger, implemente a versão da API compatível, com o mesmo token e armazenamento persistente.

Para testes locais: `npm install`, `node --test test/*.test.cjs`, `npm run collect`. Coletas públicas podem retornar zero por indisponibilidade de preços ou restrições do site.
