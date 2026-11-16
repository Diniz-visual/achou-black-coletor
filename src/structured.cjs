'use strict';
// Somente dados JSON-LD de uma página de produto conhecida e permitida.
const crypto=require('node:crypto');
function typeIs(value,type){return (Array.isArray(value)?value:[value]).some(x=>typeof x==='string'&&(x===type||x.endsWith('/'+type)||x.endsWith('#'+type)));}
function nodes(value,out,depth=0){if(depth>20||out.length>=3000||!value||typeof value!=='object')return;out.push(value);for(const child of Array.isArray(value)?value:Object.values(value))if(child&&typeof child==='object')nodes(child,out,depth+1)}
function parseStructured(html,source,page,now=Date.now()){
 if(typeof html!=='string'||Buffer.byteLength(html)>8_000_000)return [];
 let scripts=[],match;const re=/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;while((match=re.exec(html))&&scripts.length<100){if(!/\btype\s*=\s*(['"])application\/ld\+json\1/i.test(match[1]))continue;try{const data=JSON.parse(match[2]);nodes(data,scripts)}catch{}}
 const products=scripts.filter(n=>typeIs(n['@type'],'Product'));if(products.length!==1)return [];const p=products[0];let offer=p.offers;if(Array.isArray(offer)){if(offer.length!==1)return [];offer=offer[0]}if(!offer||typeof offer!=='object'||!typeIs(offer['@type'],'Offer'))return [];
 if(offer.priceCurrency!=='BRL'||!/(^|[/#])InStock$/.test(String(offer.availability||'')))return [];
 const raw=String(offer.price??'');if(!/^\d{1,8}(?:\.\d{1,2})?$/.test(raw))return [];const price=Number(raw);if(!Number.isFinite(price)||price<=0||price>10000000)return [];
 let pageUrl;try{pageUrl=new URL(page,`https://${source.host}`);if(pageUrl.protocol!=='https:'||pageUrl.hostname!==source.host||pageUrl.username||pageUrl.password||pageUrl.port)return [];}catch{return []}
 // Não aceitar um preço quando o dado estruturado aponta para outro produto.
 for(const candidate of [p.url,offer.url])if(typeof candidate==='string'&&candidate){try{const u=new URL(candidate,pageUrl);if(u.hostname!==source.host||u.protocol!=='https:'||u.username||u.password||u.port||u.pathname.replace(/\/$/,'')!==pageUrl.pathname.replace(/\/$/,''))return [];for(const key of ['seller','seller_id','sku','skuId'])if(pageUrl.searchParams.has(key)&&u.searchParams.get(key)!==pageUrl.searchParams.get(key))return [];}catch{return []}}
 let expires=now+3600000;if(offer.priceValidUntil){const t=Date.parse(offer.priceValidUntil);if(!Number.isFinite(t)||t<=now)return [];expires=Math.min(expires,t)}
 const name=String(p.name||'').trim();if(!name||name.length>230)return [];let image=Array.isArray(p.image)?p.image[0]:p.image;if(typeof image==='object'&&image)image=image.url;if(typeof image!=='string'||!/^https:\/\//.test(image))image='';
 const gtin=String(p.gtin13||p.gtin||p.gtin12||p.gtin14||'');const campaigns=[];for(const val of [p.name,p.category,p.campaign,offer.name,offer.promotionName]){if(typeof val!=='string')continue;const years=val.match(/(?<!\d)20\d{2}(?!\d)/g)||[];if(years.length&&!years.includes(String(new Date(now).getUTCFullYear())))continue;const t=val.toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');if(t.includes('blackfriday')&&!campaigns.includes('black_friday'))campaigns.push('black_friday');if(t.includes('cybermonday')&&!campaigns.includes('cyber_monday'))campaigns.push('cyber_monday')}
 let old=null;const specs=Array.isArray(offer.priceSpecification)?offer.priceSpecification:[offer.priceSpecification];const previous=specs.filter(x=>x&&typeof x==='object'&&/(^|[/#])(ListPrice|StrikethroughPrice)$/.test(String(x.priceType||''))&&x.priceCurrency==='BRL'&&Number(x.price)>price&&!x.validForMemberTier).map(x=>Number(x.price));if(previous.length===1&&previous[0]<=10000000)old=previous[0];
 const id='produto-'+crypto.createHash('sha256').update(source.id+'|'+pageUrl.href).digest('hex').slice(0,20);return [{id,name,store:source.name,category:source.category,url:pageUrl.href,image,kind:'collected',campaigns,price,old_price:old,gtin:/^\d{8,14}$/.test(gtin)?gtin:null,checked_at:Math.floor(now/1000),valid_until:Math.floor(expires/1000)}];
}
module.exports={parseStructured};
