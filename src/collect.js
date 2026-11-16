import { chromium } from 'playwright';
import { createRequire } from 'node:module';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
const require=createRequire(import.meta.url);
const {parseStructured}=require('./structured.cjs');
const sources=require('./sources.cjs');
const sites=JSON.parse(await readFile(new URL('../sites.json',import.meta.url),'utf8'));
const candidates=sites.filter(s=>s.enabled===true&&typeof s.url==='string'&&s.url.startsWith('https://'));
const recognized=new Map(sources.map(s=>[s.name,s]));
const targets=candidates.filter(s=>{
 const spec=recognized.get(s.name);if(!spec)return false;
 try{const url=new URL(s.url);return url.hostname===spec.host&&!url.username&&!url.password&&!url.port;}catch{return false;}
});
if(!targets.length){console.log('Nenhuma URL de produto reconhecida em sites.json');process.exit(0);}
const browser=await chromium.launch({headless:true});
const pages=[],products=[];
try{
 for(const site of targets){
  const context=await browser.newContext({locale:'pt-BR',userAgent:'AchouBlackBot/1.0 (+https://achoublack.shop)'});
  try{
   const page=await context.newPage();
   const response=await page.goto(site.url,{waitUntil:'domcontentloaded',timeout:30000});
   if(!response||!response.ok())throw Error(`HTTP ${response?.status()||'sem resposta'}`);
   const final=new URL(page.url());const spec=recognized.get(site.name);
   if(final.protocol!=='https:'||final.hostname!==spec.host)throw Error('Redirecionamento para outro domínio');
   const html=await page.content();
   const found=parseStructured(html,spec,page.url());
   products.push(...found);
   pages.push({source:site.name,url:page.url(),collected_at:new Date().toISOString(),product_count:found.length});
   console.log(`${site.name}: ${found.length} produto(s) estruturado(s) válidos`);
  }catch(err){console.error(`ERRO ${site.name}: ${err.message}`);}finally{await context.close();}
 }
}finally{await browser.close();}
const unique=[...new Map(products.map(p=>[p.id,p])).values()];
await mkdir('output',{recursive:true});
await writeFile('output/ofertas.json',JSON.stringify({collected_at:new Date().toISOString(),pages,products:unique},null,2));
console.log(`Páginas: ${pages.length}; produtos válidos: ${unique.length}`);
if(process.env.ACHOU_ENDPOINT&&process.env.ACHOU_TOKEN&&unique.length){
 const endpoint=new URL(process.env.ACHOU_ENDPOINT);
 if(endpoint.protocol!=='https:'||endpoint.hostname!=='achoublack.shop'||endpoint.pathname!=='/api/ofertas/importar')throw Error('ACHOU_ENDPOINT inesperado');
 const res=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json','authorization':`Bearer ${process.env.ACHOU_TOKEN}`},body:JSON.stringify({products:unique}),signal:AbortSignal.timeout(30000)});
 if(!res.ok)throw Error(`Hostinger HTTP ${res.status}: ${(await res.text()).slice(0,300)}`);
 console.log('Importação confirmada:',await res.text());
}else console.log('Importação não enviada: nenhum produto válido ou Secrets ausentes.');
