'use strict';
// Catálogos candidatos e páginas iniciais conhecidas; retorno, preço e campanha dependem da loja.
module.exports = [
  {id:'constance',name:'Constance',host:'www.constance.com.br',category:'Calçados',terms:['tenis','black friday','cyber monday','sandalia','bolsa']},
  {id:'epoca',name:'Época Cosméticos',host:'www.epocacosmeticos.com.br',category:'Beleza',terms:['hidratante','black friday','cyber monday','perfume']},
  {id:'pacheco',name:'Drogaria Pacheco',host:'www.drogariapacheco.com.br',category:'Drogaria',terms:['protetor solar','black friday','cyber monday']},
  {id:'raia',name:'Droga Raia',host:'www.drogaraia.com.br',category:'Drogaria',terms:['protetor solar','black friday','cyber monday']},
  {id:'araujo',name:'Drogaria Araújo',host:'www.araujo.com.br',category:'Drogaria',terms:['protetor solar','black friday','cyber monday']},
  {id:'wepink',name:'WePink',host:'www.wepink.com.br',category:'Beleza',terms:['perfume','black friday','cyber monday']},
  {id:'drogariasp',name:'Drogaria São Paulo',host:'www.drogariasaopaulo.com.br',category:'Drogaria',terms:['protetor solar','black friday','cyber monday']},
  {id:'paguemenos',name:'Pague Menos',host:'www.paguemenos.com.br',category:'Drogaria',terms:['protetor solar','black friday','cyber monday']},
  {id:'lojasrede',name:'Lojas Rede',host:'www.lojasrede.com.br',category:'Beleza',terms:['hidratante','black friday','cyber monday']},
  {id:'mercadolivre',name:'Mercado Livre',host:'www.mercadolivre.com.br',category:'Games',type:'structured',pages:['/nintendo-switch-console-oled-64gb-super-mario-bros-wonder/p/MLB58623212']},
  {id:'amazon',name:'Amazon',host:'www.amazon.com.br',category:'Tecnologia',type:'structured',pages:['/kindle-16gb-preto/dp/B0CP31L73X']},
  {id:'kabum',name:'KaBuM!',host:'www.kabum.com.br',category:'Tecnologia',type:'structured',pages:['/produto/181876/headset-gamer-logitech-g335-3-5mm-para-pc-playstation-xbox-switch-mobile-driver-40mm-arco-ajustavel-preto-981-000977']},
  {id:'magalu',name:'Magalu',host:'www.magazineluiza.com.br',category:'Tecnologia',type:'structured',pages:['/smartphone-samsung-galaxy-a27-5g-128gb-6gb-ram-preto-tela-de-6-7-pol-camera-tripla-principal-50-mp/p/je735aage6/te/ga27/?seller_id=negociunoficial']},
  {id:'netshoes',name:'Netshoes',host:'www.netshoes.com.br',category:'Calçados',type:'structured',pages:['/p/tenis-nike-run-defy-feminino-preto-SGL-0027-006']},
  {id:'kalunga',name:'Kalunga',host:'www.kalunga.com.br',category:'Papelaria',type:'structured',pages:['/prod/caderno-universitario-capa-dura-1x1-80-folhas-azul-spiral-brief-pt-1-un/139099']},
  {id:'renner',name:'Renner',host:'www.lojasrenner.com.br',category:'Roupas',type:'structured',pages:['/p/camiseta-regular-basica-em-algodao-preto/-/A-932430561-br.lr']},
  {id:'playstation',name:'PlayStation Store',host:'store.playstation.com',category:'Games',type:'structured',pages:['/pt-br/concept/10002684']},
  {id:'xbox',name:'Xbox',host:'www.xbox.com',category:'Games',type:'structured',pages:['/pt-BR/games/store/forza-horizon-5/9NKX70BBCDRN']}
];
