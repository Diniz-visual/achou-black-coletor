'use strict';
function canonicalProductLink(raw,spec){
 let u;try{u=new URL(raw);}catch{return null;}
 if(u.protocol!=='https:'||u.hostname!==spec.host||u.port||u.username||u.password)return null;
 const path=u.pathname;let m;
 switch(spec.id){
  case 'amazon':
   m=path.match(/(?:^|\/)dp\/([A-Z0-9]{10})(?:\/|$)/i);return m?`https://${spec.host}/dp/${m[1].toUpperCase()}`:null;
  case 'mercadolivre':
   m=path.match(/\/p\/(MLB\d+)(?:\/|$)/i);return m?`https://${spec.host}/p/${m[1].toUpperCase()}`:null;
  case 'kabum':
   m=path.match(/^\/produto\/(\d+)(?:\/|$)/i);return m?`https://${spec.host}/produto/${m[1]}`:null;
  case 'magalu':
   if(!/\/p\/[a-z0-9]{5,20}(?:\/|$)/i.test(path))return null;
   return u.origin+path+(u.searchParams.has('seller_id')?'?seller_id='+encodeURIComponent(u.searchParams.get('seller_id')):'');
  case 'netshoes':
   return /^\/p\/[a-z0-9][a-z0-9-]{8,}$/i.test(path)?u.origin+path:null;
  case 'renner':
   return /^\/p\/[^/]+\/-\/A-\d{6,}(?:-br\.lr)?\/?$/i.test(path)?u.origin+path:null;
  default:return null;
 }
}
function discoverProductLinks(anchors,spec,limit){
 const seen=new Set();for(const raw of anchors){const link=canonicalProductLink(raw,spec);if(link)seen.add(link);if(seen.size>=limit)break;}return [...seen];
}
module.exports={canonicalProductLink,discoverProductLinks};
