
import { chromium } from 'playwright';
import { createRequire } from 'node:module';
import { readFile, mkdir, writeFile } from 'node:fs/promises';

const require = createRequire(import.meta.url);

const { parseStructured } = require('./structured.cjs');
const sources = require('./sources.cjs');

const CONFIG = {
  timeout: 45000,
  navigationTimeout: 30000,
  output: 'output/ofertas.json',
  endpoint: process.env.ACHOU_ENDPOINT,
  token: process.env.ACHOU_TOKEN,
  userAgent: 'AchouBlackBot/1.0 (+https://achoublack.shop)'
};

const sleep = ms =>
  new Promise(resolve => setTimeout(resolve, ms));

const sites = JSON.parse(
  await readFile(
    new URL('../sites.json', import.meta.url),
    'utf8'
  )
);

const recognized = new Map(
  sources.map(source => [source.name, source])
);

const targets = sites.filter(site => {
  if (
    site.enabled !== true ||
    typeof site.url !== 'string'
  ) return false;

  const spec = recognized.get(site.name);

  if (!spec) {
    console.warn(`Fonte desconhecida: ${site.name}`);
    return false;
  }

  try {
    const url = new URL(site.url);

    return (
      url.protocol === 'https:' &&
      url.hostname === spec.host &&
      !url.username &&
      !url.password &&
      !url.port
    );
  } catch {
    return false;
  }
});

if (!targets.length) {
  console.log('Nenhuma URL válida ativada em sites.json.');
  process.exit(0);
}

console.log('=================================');
console.log('ACHOU BLACK — COLETOR DE OFERTAS');
console.log('=================================');
console.log(`Fontes ativadas: ${targets.length}`);
console.log(`Início: ${new Date().toISOString()}`);

const pages = [];
const products = [];
const errors = [];

const browser = await chromium.launch({
  headless: true,
  timeout: CONFIG.timeout
});

try {
  for (const site of targets) {
    console.log(`\nColetando: ${site.name}`);

    const spec = recognized.get(site.name);

    const context = await browser.newContext({
      locale: 'pt-BR',
      timezoneId: 'America/Sao_Paulo',
      userAgent: CONFIG.userAgent,
      viewport: {
        width: 1366,
        height: 768
      }
    });

    try {
      const page = await context.newPage();

      const response = await page.goto(site.url, {
        waitUntil: 'domcontentloaded',
        timeout: CONFIG.navigationTimeout
      });

      if (!response) {
        throw new Error('Página sem resposta HTTP');
      }

      const status = response.status();

      if (!response.ok()) {
        throw new Error(`HTTP ${status}`);
      }

      // Aguarda os dados estruturados iniciais, se surgirem.
      await page
        .locator('script[type="application/ld+json"]')
        .first()
        .waitFor({
          state: 'attached',
          timeout: 5000
        })
        .catch(() => {});

      const finalUrl = new URL(page.url());

      if (
        finalUrl.protocol !== 'https:' ||
        finalUrl.hostname !== spec.host
      ) {
        throw new Error(
          'Redirecionamento para domínio não autorizado'
        );
      }

      // Diagnóstico da página
      const diagnostic = await page.evaluate(() => {
        const title = document.title || '';

        const jsonLd = document.querySelectorAll(
          'script[type="application/ld+json"]'
        );

        const productElements = document.querySelectorAll(
          '[data-asin], [itemtype*="Product"]'
        );

        const priceElements = document.querySelectorAll(
          '.a-price, [itemprop="price"], [data-a-color="price"]'
        );

        const bodyText = (
          document.body?.innerText || ''
        ).slice(0, 1500);

        const possibleChallenge =
          /captcha|robot check|digite os caracteres|verifique se você é humano|enter the characters/i
            .test(`${title} ${bodyText}`);

        return {
          title,
          jsonLdCount: jsonLd.length,
          productElements: productElements.length,
          priceElements: priceElements.length,
          pageLength:
            document.documentElement.outerHTML.length,
          possibleChallenge
        };
      });

      console.log('Diagnóstico:', JSON.stringify({
        source: site.name,
        status,
        url: page.url(),
        ...diagnostic
      }, null, 2));

      if (diagnostic.possibleChallenge) {
        throw new Error(
          'Possível CAPTCHA ou página de verificação'
        );
      }

      const html = await page.content();

      // Extrator estruturado existente do projeto
      const found = parseStructured(
        html,
        spec,
        page.url()
      );

      if (!Array.isArray(found)) {
        throw new Error(
          'O parser não retornou uma lista de produtos'
        );
      }

      const valid = found.filter(product => {
        return (
          product &&
          typeof product.id === 'string' &&
          product.id.length > 0 &&
          Number.isFinite(Number(product.price)) &&
          Number(product.price) > 0
        );
      });

      products.push(...valid);

      pages.push({
        source: site.name,
        url: page.url(),
        status,
        title: diagnostic.title,
        collected_at: new Date().toISOString(),
        product_count: valid.length,
        diagnostic
      });

      console.log(
        `${site.name}: ${valid.length} produto(s) válido(s)`
      );

      if (valid.length === 0) {
        console.warn(
          `ATENÇÃO: Nenhum produto válido encontrado em ${site.name}`
        );
      }

    } catch (error) {
      console.error(
        `ERRO ${site.name}: ${error.message}`
      );

      errors.push({
        source: site.name,
        url: site.url,
        message: error.message,
        collected_at: new Date().toISOString()
      });

    } finally {
      await context.close();
    }

    await sleep(1000);
  }

} finally {
  await browser.close();
}

// Remover duplicações
const unique = [
  ...new Map(
    products.map(product => [product.id, product])
  ).values()
];

// Preparar resultado
const result = {
  service: 'Achou Black',
  version: '1.1.0',
  collected_at: new Date().toISOString(),
  summary: {
    sources: targets.length,
    pages: pages.length,
    products: unique.length,
    errors: errors.length
  },
  pages,
  products: unique,
  errors
};

// Salvar arquivo local no GitHub Actions
await mkdir('output', {
  recursive: true
});

await writeFile(
  CONFIG.output,
  JSON.stringify(result, null, 2),
  'utf8'
);

console.log('\n=================================');
console.log('RESULTADO DA COLETA');
console.log('=================================');
console.log(`Páginas acessadas: ${pages.length}`);
console.log(`Produtos válidos: ${unique.length}`);
console.log(`Erros: ${errors.length}`);
console.log(`Arquivo: ${CONFIG.output}`);

// Integração Hostinger
async function enviarHostinger(items) {
  if (!CONFIG.endpoint || !CONFIG.token) {
    console.warn(
      'Integração desativada: ACHOU_ENDPOINT ou ACHOU_TOKEN ausente.'
    );
    return;
  }

  if (!items.length) {
    console.log(
      'Nenhum produto válido para enviar à Hostinger.'
    );
    return;
  }

  const endpoint = new URL(CONFIG.endpoint);

  if (
    endpoint.protocol !== 'https:' ||
    endpoint.hostname !== 'achoublack.shop' ||
    endpoint.pathname !== '/api/ofertas/importar' ||
    endpoint.search ||
    endpoint.hash
  ) {
    throw new Error(
      'ACHOU_ENDPOINT inválido ou inesperado'
    );
  }

  console.log('\nEnviando produtos à Hostinger...');

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${CONFIG.token}`
    },
    body: JSON.stringify({
      products: items
    }),
    signal: AbortSignal.timeout(30000)
  });

  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(
      `Falha na importação HTTP ${response.status}: ` +
      responseText.slice(0, 300)
    );
  }

  console.log(
    'Importação confirmada:',
    responseText.slice(0, 500)
  );
}

await enviarHostinger(unique);

console.log('\nColeta finalizada.');
