import { chromium } from 'playwright';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
const sites = JSON.parse(await readFile(new URL('../sites.json', import.meta.url), 'utf8'));
const targets = sites.filter(x => x.enabled === true && /^https:\/\//i.test(x.url));
if (!targets.length) {
  console.log('Nenhuma loja ativada em sites.json. Ative uma URL HTTPS valida para testar.');
  process.exit(0);
}
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const site of targets) {
    const context = await browser.newContext({ userAgent: 'AchouBlackPriceMonitor/1.0' });
    const page = await context.newPage();
    try {
      const response = await page.goto(site.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      if (!response || !response.ok()) throw new Error(`HTTP ${response?.status() ?? 'sem resposta'}`);
      const data = await page.evaluate(() => {
        const meta = key => document.querySelector(`meta[property="${key}"],meta[name="${key}"]`)?.content || null;
        const jsonLd = [];
        for (const el of document.querySelectorAll('script[type="application/ld+json"]')) {
          try { jsonLd.push(JSON.parse(el.textContent)); } catch { /* ignorar JSON-LD invalido */ }
        }
        return { title: document.title, description: meta('og:description') || meta('description'), image: meta('og:image'), jsonLd };
      });
      results.push({ source: site.name, url: page.url(), collected_at: new Date().toISOString(), ...data });
      console.log(`OK: ${site.name} (${results.length})`);
    } catch (e) { console.error(`ERRO ${site.name}: ${e.message}`); }
    finally { await context.close(); }
  }
} finally { await browser.close(); }
await mkdir('output', { recursive: true });
await writeFile('output/ofertas.json', JSON.stringify(results, null, 2));
console.log(`Paginas coletadas: ${results.length}. Dados brutos em output/ofertas.json`);
if (process.env.ACHOU_ENDPOINT && process.env.ACHOU_TOKEN && results.length) {
  const endpoint = new URL(process.env.ACHOU_ENDPOINT);
  if (endpoint.protocol !== 'https:') throw new Error('ACHOU_ENDPOINT deve usar HTTPS');
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'authorization': `Bearer ${process.env.ACHOU_TOKEN}` },
    body: JSON.stringify({ collected_at: new Date().toISOString(), pages: results }),
    signal: AbortSignal.timeout(30000)
  });
  if (!res.ok) throw new Error(`Endpoint Hostinger retornou HTTP ${res.status()}`);
  console.log('Envio para Hostinger concluido.');
} else console.log('Envio Hostinger desativado: configure ACHOU_ENDPOINT e ACHOU_TOKEN nos Secrets.');
