"use strict";
const crypto=require('node:crypto');
// Only accepts a product's own detail page and a single buy-box price.
function parsePrice(v){
  if(typeof v!=='string')return null;
  const s=v.trim().replace(/\s/g,'').replace(/^R\$/,'');
  if(!/^\d{1,7}(?:\.\d{3})*,\d{2}$/.test(s))return null;
  const n=Number(s.replace(/\./g,'').replace(',','.'));
  return Number.isFinite(n)&&n>0&&n<=10000000?n:null;
}
function buildAmazonProduct(raw,source,url,now=Date.now()){
  let u;try{u=new URL(url)}catch{return []}
  if(u.protocol!=='https:'||u.hostname!==source.host||u.port||u.username||u.password)return [];
  const asin=u.pathname.match(/(?:^|\/)dp\/([A-Z0-9]{10})(?:\/|$)/i)?.[1]?.toUpperCase();
  if(!asin||raw?.asin?.toUpperCase()!==asin||raw?.multiplePrices||raw?.challenge)return [];
  const name=typeof raw?.name==='string'?raw.name.trim():'';
  const price=parsePrice(raw?.price);
  if(name.length<3||name.length>230||price===null)return [];
  const image=typeof raw.image==='string'&&raw.image.startsWith('https://')?raw.image:'';
  const canonical=`https://${source.host}/dp/${asin}`;
  const id='produto-'+crypto.createHash('sha256').update(source.id+'|'+canonical).digest('hex').slice(0,20);
  return [{id,name,store:source.name,category:source.category,url:canonical,image,kind:'collected',campaigns:[],price,old_price:null,gtin:null,checked_at:Math.floor(now/1000),valid_until:Math.floor((now+3600000)/1000)}];
}
module.exports={parsePrice,buildAmazonProduct};
