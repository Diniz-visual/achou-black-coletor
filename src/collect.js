
import { chromium } from 'playwright';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const require = createRequire(import.meta.url);

const { parseStructured } = require('./structured.cjs');
const { buildAmazonProduct } = require('./amazon-visible.cjs');
const sources = require('./sources.cjs');

const byName = new Map(sources.map(s => [s.name, s]));

const sites = JSON.parse(
  await readFile(
    new URL('../sites.json', import.meta.url),
    'utf8'
  )
);

const targets = sites.filter(s => {
  const spec = byName.get(s.name);

  if (
    s.enabled !== true ||
    !spec ||
    !['campaign', 'product', undefined].includes(s.type)
  ) {
    return false;
  }

  try {
    const u = new URL(s.url);

    return (
      u.protocol === 'https:' &&
      u.hostname === spec.host &&
      !u.port &&
      !u.username &&
      !u.password
    );
  } catch {
    return false;
  }
});

const output = {
  version: '1.4.1',
  collected_at: new Date().toISOString(),
  pages: [],
  products: [],
  errors: []
};

const challenge =
  /captcha|robot check|digite os caracteres|verifique se voc[eê] [eé] humano|enter the characters/i;

console.log(
  `ACHOU BLACK — BLACK FRIDAY v${output.version}; fontes: ${targets.length}`
);

function valid(p) {
  return (
    p &&
    typeof p.id === 'string' &&
    Number.isFinite(p.price) &&
    p.price > 0
  );
}

function allowed(u, spec) {
  try {
    const x = new URL(u);

    return (
      x.protocol === 'https:' &&
      x.hostname === spec.host &&
      !x.port &&
      !x.username &&
      !x.password
    );
  } catch {
    return false;
  }
}

async function open(page, url, spec) {
  const r = await page.goto(url, {
    waitUntil: 'domcontentloaded',
    timeout: 40000
  });

  // Playwright: ok() é um método.
  if (!r || !r.ok()) {
    throw new Error(
      `HTTP ${r?.status() || 'sem resposta'}`
    );
  }

  if (!allowed(page.url(), spec)) {
    throw new Error(
      'Redirecionamento fora da fonte autorizada'
    );
  }

  const info = await page.evaluate(() => ({
    title: document.title,
    jsonLdCount: document.querySelectorAll(
      'script[type="application/ld+json"]'
    ).length,
    possibleChallenge:
      /captcha|robot check|digite os caracteres|verifique se voc[eê] [eé] humano|enter the characters/i.test(
        `${document.title} ${(document.body?.innerText || '').slice(0, 2000)}`
      )
  }));

  if (
    info.possibleChallenge ||
    challenge.test(info.title)
  ) {
    throw new Error(
      'Página de verificação; não contornar bloqueio'
    );
  }

  return {
    status: r.status(),
    ...info
  };
}

async function discover(page, spec, limit) {
  // Identifica links de produtos na vitrine.
  // Os preços são verificados nas páginas individuais.

  const links = await page.locator('a[href]').evaluateAll(
    (anchors, host) =>
      anchors
        .map(a => a.href)
        .filter(h => {
          try {
            const u = new URL(h);

            return (
              u.protocol === 'https:' &&
              u.hostname === host
            );
          } catch {
            return false;
          }
        }),
    spec.host
  );

  const canonical = links.map(h => {
    const u = new URL(h);

    if (spec.id === 'amazon') {
      const asin = u.pathname.match(
        /(?:^|\/)dp\/([A-Z0-9]{10})(?:\/|$)/i
      )?.[1];

      return asin
        ? `https://${spec.host}/dp/${asin.toUpperCase()}`
        : null;
    }

    if (spec.id === 'mercadolivre') {
      return /\/p\/MLB\d+|MLB-\d+/i.test(u.pathname)
        ? u.origin + u.pathname
        : null;
    }

    if (spec.id === 'kabum') {
      return /\/produto\/\d+\//.test(u.pathname)
        ? u.origin + u.pathname
        : null;
    }

    return null;
  }).filter(Boolean);

  return [
    ...new Set(canonical)
  ].slice(0, limit);
}

async function readAmazonDetail(page, spec) {
  const raw = await page.evaluate(() => {
    const name = document
      .querySelector('#productTitle')
      ?.textContent?.trim() || '';

    const asin =
      document.querySelector('#ASIN')?.value ||
      document.querySelector('input[name="ASIN"]')?.value ||
      '';

    const block =
      document.querySelector(
        '#corePriceDisplay_desktop_feature_div'
      ) ||
      document.querySelector('#corePrice_feature_div');

    const nodes = [
      ...(block?.querySelectorAll(
        '.a-price:not(.a-text-price) .a-offscreen'
      ) || [])
    ]
      .map(x => x.textContent.trim())
      .filter(Boolean);

    const prices = [...new Set(nodes)];

    const image =
      document.querySelector('#landingImage')
        ?.getAttribute('data-old-hires') ||
      document.querySelector('#landingImage')?.src ||
      '';

    return {
      name,
      asin,
      price: prices.length === 1 ? prices[0] : null,
      multiplePrices: prices.length !== 1,
      image,
      challenge: false
    };
  });

  return buildAmazonProduct(
    raw,
    spec,
    page.url()
  );
}

async function enviarHostinger(products) {
  if (!products.length) {
    console.log(
      'HOSTINGER: nenhum produto válido para importar.'
    );
    return;
  }

  const endpoint = process.env.ACHOU_ENDPOINT;
  const token = process.env.ACHOU_TOKEN;

  if (!endpoint || !token) {
    console.warn(
      'HOSTINGER: ACHOU_ENDPOINT ou ACHOU_TOKEN ausente.'
    );
    return;
  }

  const ep = new URL(endpoint);

  if (
    ep.origin !== 'https://achoublack.shop' ||
    ep.pathname !== '/api/ofertas/importar' ||
    ep.search ||
    ep.hash ||
    ep.username ||
    ep.password
  ) {
    throw new Error('ACHOU_ENDPOINT inesperado');
  }

  console.log(
    `HOSTINGER: enviando ${products.length} produtos...`
  );

  const response = await fetch(ep, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      products
    }),
    signal: AbortSignal.timeout(30000)
  });

  const body = await response.text();

  // CORREÇÃO: no fetch() do Node.js, ok é booleano.
  if (!response.ok) {
    throw new Error(
      `Hostinger HTTP ${response.status}: ${body.slice(0, 250)}`
    );
  }

  console.log(
    'HOSTINGER: importação confirmada:',
    body.slice(0, 500)
  );
}

async function run() {
  if (!targets.length) {
    throw new Error(
      'Ative ao menos uma fonte HTTPS reconhecida em sites.json'
    );
  }

  const browser = await chromium.launch({
    headless: true
  });

  try {
    for (const site of targets) {
      const spec = byName.get(site.name);

      const ctx = await browser.newContext({
        locale: 'pt-BR',
        timezoneId: 'America/Sao_Paulo',
        userAgent:
          'AchouBlackBot/1.4 (+https://achoublack.shop)'
      });

      try {
        const page = await ctx.newPage();

        const diag = await open(
          page,
          site.url,
          spec
        );

        const isCampaign = site.type === 'campaign';

        const limit = Math.min(
          Math.max(Number(site.maxProducts) || 8, 1),
          12
        );

        const links = isCampaign
          ? await discover(page, spec, limit)
          : [page.url()];

        console.log(
          `${site.name}: vitrine HTTP ${diag.status}; ` +
          `links de produtos: ${links.length}`
        );

        let accepted = 0;

        for (const url of links) {
          try {
            if (isCampaign) {
              await page.waitForTimeout(1000);
            }

            const d = await open(page, url, spec);

            await page
              .locator(
                'script[type="application/ld+json"]'
              )
              .first()
              .waitFor({
                state: 'attached',
                timeout: 2500
              })
              .catch(() => {});

            let items = parseStructured(
              await page.content(),
              spec,
              page.url()
            );

            if (
              !items.length &&
              spec.id === 'amazon'
            ) {
              items = await readAmazonDetail(
                page,
                spec
              );
            }

            items = items.filter(valid);

            output.products.push(...items);

            accepted += items.length;

            console.log(
              `DETALHE ${site.name}: ` +
              `HTTP ${d.status} ` +
              `JSON-LD ${d.jsonLdCount}, ` +
              `válidos ${items.length} ` +
              `(${new URL(url).pathname})`
            );

          } catch (e) {
            output.errors.push({
              source: site.name,
              stage: 'detail',
              url,
              message: e.message
            });

            console.warn(
              `${site.name} detalhe: ${e.message}`
            );

            if (/verificação/.test(e.message)) {
              break;
            }
          }
        }

        output.pages.push({
          source: site.name,
          url: site.url,
          type: isCampaign
            ? 'campaign'
            : 'product',
          discovered: links.length,
          product_count: accepted,
          checked_at: new Date().toISOString()
        });

      } catch (e) {
        output.errors.push({
          source: site.name,
          stage: 'campaign',
          message: e.message
        });

        console.error(
          `${site.name}: ${e.message}`
        );

      } finally {
        await ctx.close();
      }
    }

  } finally {
    await browser.close();
  }

  // Remove produtos duplicados.
  output.products = [
    ...new Map(
      output.products.map(p => [p.id, p])
    ).values()
  ];

  output.summary = {
    pages: output.pages.length,
    products: output.products.length,
    errors: output.errors.length
  };

  console.log(
    'RESULTADO FINAL',
    JSON.stringify(output.summary)
  );

  if (output.pages.length === 0) {
    process.exitCode = 1;
  }

  if (!output.products.length) {
    console.log(
      'Nenhum produto verificável; não importar.'
    );
    return;
  }

  // Envio autenticado à Hostinger.
  await enviarHostinger(output.products);
}

try {
  await run();

} catch (e) {
  output.errors.push({
    source: 'collector',
    message: e.message
  });

  process.exitCode = 1;

  console.error(
    'FALHA:',
    e.message
  );

} finally {
  await mkdir('output', {
    recursive: true
  });

  await writeFile(
    'output/ofertas.json',
    JSON.stringify(output, null, 2),
    'utf8'
  );

  console.log(
    'Arquivo salvo: output/ofertas.json'
  );
}
