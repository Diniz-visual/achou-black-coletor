# Achou Black — Chromium no GitHub Actions

Coletor inicial com Playwright/Chromium. Funciona sem Chromium instalado na Hostinger.

## 1. Subir ao GitHub
Crie um repositorio PUBLICO. Envie o CONTEUDO desta pasta, incluindo `.github/workflows/coletar-ofertas.yml`.

## 2. Configurar paginas
Edite `sites.json`: troque o endereco de exemplo por uma URL HTTPS de produto ou categoria cujo acesso automatizado seja permitido, e altere `enabled` para `true`. O codigo inicial coleta titulo, descricao, imagem e JSON-LD da pagina. **Ainda nao converte esses dados em ofertas estruturadas nem implementa seletores especificos por loja.** Use fontes que autorizem a coleta e respeite seus limites de acesso.

## 3. Rodar teste
No repositorio: Actions > Achou Black - Coletar ofertas > Run workflow. Veja o log e, apos a execucao, o artefato `coleta-...` com o JSON bruto.

## 4. Envio opcional para a Hostinger
O arquivo `hostinger/receber-coleta.php` e um EXEMPLO, nao deve ser enviado ao GitHub com credenciais. Publique como `public_html/api/receber-coleta.php` depois de preparar a variavel ACHOU_TOKEN fora da pasta publica. Configure os GitHub Actions secrets em Settings > Secrets and variables > Actions:
- ACHOU_ENDPOINT = https://achoublack.shop/api/receber-coleta.php
- ACHOU_TOKEN = mesmo token longo e aleatorio configurado no PHP.
Sem os dois secrets, o coletor apenas gera o JSON de teste. O receptor grava em `achou-black-data/ultima-coleta.json` fora de public_html. Integrar os dados ao banco/painel do site exige adaptar o formato ao backend existente.

## Observacoes
GitHub Actions com runner padrao em repositorio publico pode ser gratis dentro das politicas da plataforma. Agendamentos podem atrasar ou nao executar em alguns momentos; workflow agendado pode ser desativado apos inatividade prolongada do repositorio publico. Nao executa Chromium 24h nem hospeda API de navegador permanente. Nunca coloque senhas/tokens no codigo ou logs. Repositorios publicos expoem todo codigo enviado.
