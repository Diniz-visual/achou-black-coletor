import { chromium } from 'playwright';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
const require = createRequire(import.meta.url);
const { parseStructured } = require('./structured.cjs');
const sources = require('./sources.cjs');
const sourceMap = new Map(sources.map(x => [x.name, x]));
const sites = JSON.parse(await readFile(new URL('../sites.json', import.meta.url), 'utf8'));
const targets = sites.filter(s => {
  if (s.enabled !== true || !sourceMap.has(s.name)) return false;
  try { const u = new URL(s.url); return u.protocol === 'https:' && u.hostname === sourceMap.get(s.name).host && !u.port && !u.username && !u.password; }
  catch { return false; }
});
const output = {version:'1.3.0',collected_at:new Date().toISOString(),pages:[],products:[],errors:[]};
const challengeRE = /captcha|robot check|digite os caracteres|verifique se voc[eê] [eé] humano|enter the characters/i;
console.log('ACHOU BLACK — COLETOR DE OFERTAS — VERSÃO 1.3.0');
console.log(`Fontes habilitadas: ${targets.length}`);
let browser;
try {
  if (!targets.length) throw new Error('Nenhuma URL válida em sites.json');
  browser = await chromium.launch({headless:true,timeout:45000});
  for (const site of targets) {
    const spec = sourceMap.get(site.name);
    const context = await browser.newContext({locale:'pt-BR',timezoneId:'America/Sao_Paulo',userAgent:'AchouBlackBot/1.3 (+https://achoublack.shop)'});
    try {
      const page = await context.newPage();
      const response = await page.goto(site.url,{waitUntil:'domcontentloaded',timeout:45000});
      if (!response) throw new Error('Sem resposta HTTP');
      if (!response.ok()) throw new Error(`HTTP ${response.status()}`);
      const actual = new URL(page.url());
      if (actual.protocol !== 'https:' || actual.hostname !== spec.host) throw new Error('Redirecionamento não autorizado');
      await page.locator('script[type="application/ld+json"]').first().waitFor({state:'attached',timeout:7000}).catch(()=>{});
      const diagnostic = await page.evaluate(() => ({
        title:document.title,
        jsonLdCount:document.querySelectorAll('script[type="application/ld+json"]').length,
        priceElements:document.querySelectorAll('[itemprop="price"],.a-price,[data-a-color="price"]').length,
        productElements:document.querySelectorAll('[data-asin],[itemtype*="Product"]').length,
        htmlLength:document.documentElement.outerHTML.length,
        possibleChallenge:/captcha|robot check|digite os caracteres|verifique se voc[eê] [eé] humano|enter the characters/i.test(`${document.title} ${(document.body?.innerText||'').slice(0,3000)}`)
      }));
      console.log(`DIAGNÓSTICO ${site.name}: ${JSON.stringify({http:response.status(),url:page.url(),...diagnostic})}`);
      if (diagnostic.possibleChallenge || challengeRE.test(diagnostic.title)) throw new Error('Verificação de acesso; coleta interrompida');
      const found = parseStructured(await page.content(),spec,page.url());
      if (!Array.isArray(found)) throw new Error('Parser retornou formato inválido');
      const valid = found.filter(p => p && typeof p.id==='string' && Number.isFinite(p.price) && p.price>0);
      output.products.push(...valid);
      output.pages.push({source:site.name,url:page.url(),collected_at:new Date().toISOString(),product_count:valid.length,diagnostic});
      console.log(`${site.name}: ${valid.length} produto(s) válido(s)`);
      if (!valid.length) console.warn(`${site.name}: HTML acessível, mas sem dados estruturados de preço aceitos; nenhuma oferta inventada`);
    } catch(e) { output.errors.push({source:site.name,message:e.message});console.error(`ERRO ${site.name}: ${e.message}`); }
    finally { await context.close(); }
  }
} catch(e) { output.errors.push({source:'collector',message:e.message});console.error('ERRO GERAL:',e.message); }
finally { if(browser) await browser.close(); }
output.products = [...new Map(output.products.map(p=>[p.id,p])).values()];
output.summary = {pages:output.pages.length,products:output.products.length,errors:output.errors.length};
await mkdir('output',{recursive:true});
await writeFile('output/ofertas.json',JSON.stringify(output,null,2));
console.log('RESULTADO FINAL:',JSON.stringify(output.summary));
if (output.pages.length===0) process.exitCode=1;
if(output.products.length && process.env.ACHOU_ENDPOINT && process.env.ACHOU_TOKEN) {
  try {
    const endpoint = new URL(process.env.ACHOU_ENDPOINT);
    if(endpoint.origin!=='https://achoublack.shop'||endpoint.pathname!=='/api/ofertas/importar'||endpoint.search||endpoint.hash)throw new Error('Endpoint não autorizado');
    const result=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${process.env.ACHOU_TOKEN}`},body:JSON.stringify({products:output.products}),signal:AbortSignal.timeout(30000)});
    if(!result.ok)throw new Error(`HTTP ${result.status}: ${(await result.text()).slice(0,200)}`);
    console.log('HOSTINGER: importação confirmada', (await result.text()).slice(0,250));
  } catch(e) { console.error('HOSTINGER:',e.message);process.exitCode=1; }
} else console.log(output.products.length?'Hostinger: ACHOU_ENDPOINT/ACHOU_TOKEN ausentes':'Hostinger: envio ignorado porque não há produtos válidos');
