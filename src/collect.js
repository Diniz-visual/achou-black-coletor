
import { chromium } from 'playwright';
import { createRequire } from 'node:module';
import { readFile, mkdir, writeFile } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const { parseStructured } = require('./structured.cjs');
const sources = require('./sources.cjs');

const CONFIG = {
  version: '1.2.0',
  navigationTimeout: 45000,
  browserTimeout: 45000,
  structuredTimeout: 8000,
  output: 'output/ofertas.json',
  endpoint: process.env.ACHOU_ENDPOINT,
  token: process.env.ACHOU_TOKEN,
  userAgent: 'AchouBlackBot/1.2 (+https://achoublack.shop)'
};

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const sites = JSON.parse(
  await readFile(
    new URL('../sites.json', import.meta.url),
    'utf8'
  )
);

const recognized = new Map(
  sources.map(source => [source.name, source])
);

function validarUrl(site) {
  const spec = recognized.get(site.name);
  if (!spec || site.enabled !== true) return false;

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
}

const targets = sites.filter(validarUrl);

console.log('\n====================================');
console.log('ACHOU BLACK — COLETOR DE OFERTAS');
console.log(`VERSÃO ${CONFIG.version}`);
console.log('====================================');
console.log(`Fontes configuradas: ${targets.length}`);
console.log(`Início: ${new Date().toISOString()}`);

const pages = [];
const products = [];
const errors = [];

function validarProduto(product) {
  if (!product || typeof product !== 'object') {
    return false;
  }

  const price = Number(product.price);

  return (
    typeof product.id === 'string' &&
    product.id.trim().length > 0 &&
    Number.isFinite(price) &&
    price > 0
  );
}

function detectarDesafio(title, body) {
  const text = `${title} ${body}`;

  return /captcha|robot check|verifique se você é humano|digite os caracteres|enter the characters|automated access/i.test(
    text
  );
}

async function diagnosticarPagina(page, response) {
  return page.evaluate(status => {
    const title = document.title || '';
    const body = document.body?.innerText || '';

    const jsonLd = document.querySelectorAll(
      'script[type="application/ld+json"]'
    );

    const products = document.querySelectorAll(
      '[data-asin], [itemtype*="Product"]'
    );

    const prices = document.querySelectorAll(
      '.a-price, [itemprop="price"], [data-a-color="price"]'
    );

    const canonical = document.querySelector(
      'link[rel="canonical"]'
    );

    return {
      status,
      title,
      url: location.href,
      canonical: canonical?.href || null,
      jsonLdCount: jsonLd.length,
      productElements: products.length,
      priceElements: prices.length,
      htmlLength: document.documentElement.outerHTML.length,
      bodyLength: body.length,
      possibleChallenge: /captcha|robot check|verifique se você é humano|digite os caracteres|enter the characters|automated access/i.test(
        `${title} ${body.slice(0, 3000)}`
      )
    };
  }, response.status());
}

async function coletarPagina(browser, site) {
  console.log(`\n-------------------------------`);
  console.log(`Coletando: ${site.name}`);
  console.log(`URL: ${site.url}`);

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
      throw new Error('Sem resposta HTTP');
    }

    console.log(`HTTP: ${response.status()}`);

    if (!response.ok()) {
      throw new Error(`HTTP ${response.status()}`);
    }

    const finalUrl = new URL(page.url());
    const spec = recognized.get(site.name);

    if (
      finalUrl.protocol !== 'https:' ||
      finalUrl.hostname !== spec.host
    ) {
      throw new Error(
        'Redirecionamento para domínio não autorizado'
      );
    }

    // Aguarda dados estruturados quando disponíveis.
    await page
      .locator('script[type="application/ld+json"]')
      .first()
      .waitFor({
        state: 'attached',
        timeout: CONFIG.structuredTimeout
      })
      .catch(() => {});

    const diagnostic = await diagnosticarPagina(
      page,
      response
    );

    console.log(
      'DIAGNÓSTICO:',
      JSON.stringify(diagnostic, null, 2)
    );

    if (diagnostic.possibleChallenge) {
      throw new Error(
        'Possível CAPTCHA ou verificação de acesso'
      );
    }

    const html = await page.content();

    // Usa o parser do próprio projeto.
    const extracted = parseStructured(
      html,
      spec,
      page.url()
    );

    if (!Array.isArray(extracted)) {
      throw new Error(
        'structured.cjs não retornou um array'
      );
    }

    const valid = extracted.filter(validarProduto);

    const rejected = extracted.length - valid.length;

    console.log(`Candidatos extraídos: ${extracted.length}`);
    console.log(`Produtos válidos: ${valid.length}`);
    console.log(`Produtos rejeitados: ${rejected}`);

    if (valid.length === 0) {
      console.warn(
        `AVISO: ${site.name} não apresentou produtos compatíveis com structured.cjs`
      );
    }

    pages.push({
      source: site.name,
      url: page.url(),
      status: response.status(),
      collected_at: new Date().toISOString(),
      product_count: valid.length,
      diagnostic
    });

    products.push(...valid);

  } catch (error) {
    console.error(`ERRO ${site.name}: ${error.message}`);

    errors.push({
      source: site.name,
      url: site.url,
      error: error.message,
      collected_at: new Date().toISOString()
    });

  } finally {
    await context.close();
  }
}

async function enviarHostinger(items) {
  if (!items.length) {
    console.log(
      'Hostinger: nenhum produto válido para importar.'
    );
    return;
  }

  if (!CONFIG.endpoint || !CONFIG.token) {
    console.warn(
      'Hostinger: configure ACHOU_ENDPOINT e ACHOU_TOKEN.'
    );
    return;
  }

  const endpoint = new URL(CONFIG.endpoint);

  if (
    endpoint.protocol !== 'https:' ||
    endpoint.hostname !== 'achoublack.shop' ||
    endpoint.pathname !== '/api/ofertas/importar' ||
    endpoint.username ||
    endpoint.password ||
    endpoint.port ||
    endpoint.search ||
    endpoint.hash
  ) {
    throw new Error('ACHOU_ENDPOINT inválido');
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

  const body = await response.text();

  if (!response.ok) {
    throw new Error(
      `Hostinger HTTP ${response.status}: ${body.slice(0, 300)}`
    );
  }

  console.log('Hostinger: importação confirmada.');
  console.log(body.slice(0, 500));
}

async function main() {
  if (!targets.length) {
    throw new Error(
      'Nenhuma URL HTTPS válida ativada em sites.json'
    );
  }

  const browser = await chromium.launch({
    headless: true,
    timeout: CONFIG.browserTimeout
  });

  try {
    for (const site of targets) {
      await coletarPagina(browser, site);
      await sleep(1000);
    }
  } finally {
    await browser.close();
  }

  const unique = [
    ...new Map(
      products.map(p => [p.id, p])
    ).values()
  ];

  const result = {
    service: 'Achou Black',
    version: CONFIG.version,
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

  await mkdir('output', {
    recursive: true
  });

  await writeFile(
    CONFIG.output,
    JSON.stringify(result, null, 2),
    'utf8'
  );

  console.log('\n====================================');
  console.log('RESULTADO FINAL');
  console.log('====================================');
  console.log(`Páginas acessadas: ${pages.length}`);
  console.log(`Produtos válidos: ${unique.length}`);
  console.log(`Erros: ${errors.length}`);
  console.log(`Arquivo: ${CONFIG.output}`);

  if (pages.length === 0) {
    throw new Error(
      'Todas as páginas falharam. Consulte os diagnósticos.'
    );
  }

  await enviarHostinger(unique);

  console.log('\nColeta finalizada.');
}

main().catch(error => {
  console.error('FALHA NA EXECUÇÃO:', error.message);
  process.exitCode = 1;
});
