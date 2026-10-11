const TL={coins:new Map()};
const N=x=>+x||0;
const jget=u=>fetch(u).then(r=>r.ok?r.json():null).catch(()=>null);
function risk(t){
  let s=50;const f=[],age=(Date.now()-t.created)/36e5;
  if(t.liq>=1e5){s+=20;f.push("Deep liquidity")}else if(t.liq>=3e4)s+=12;else if(t.liq>=1e4)s+=4;else if(t.liq<5e3){s-=25;f.push("Thin liquidity")}
  const r=t.mc?t.liq/t.mc:0;if(r>=.1)s+=10;else if(t.mc&&r<.02){s-=15;f.push("Low liq vs mcap")}
  if(age<.5){s-=10;f.push("Under 30m old")}else if(age>72)s+=12;else if(age>24)s+=8;
  const n=t.b1+t.s1;if(n>20){const br=t.b1/n;if(br>.85){s-=8;f.push("Botted buys?")}else if(br<.3){s-=15;f.push("Heavy selling")}else if(br>=.4&&br<=.7)s+=5}
  if(t.soc!=null){if(t.soc){s+=10;f.push("Has socials")}else f.push("No socials")}
  if(t.liq&&t.v24/t.liq>50){s-=5;f.push("Volume >> liquidity")}
  if(t.b1+t.s1<8&&age>1){s-=10;f.push("Few trades")}
  return Math.max(0,Math.min(100,Math.round(s)));
}
function fromDS(p){
  if(!p.baseToken||p.chainId!=="solana")return null;
  const x=p.txns||{},v=p.volume||{},c=p.priceChange||{};
  return{src:"ds",addr:p.baseToken.address,sym:p.baseToken.symbol,name:p.baseToken.name,img:p.info?.imageUrl,url:p.url,dex:(p.dexId||"").replace(/-/g,""),created:p.pairCreatedAt||Date.now(),liq:N(p.liquidity?.usd),mc:N(p.marketCap||p.fdv),v5:N(v.m5),v1:N(v.h1),v24:N(v.h24),b1:N(x.h1?.buys),s1:N(x.h1?.sells),b5:N(x.m5?.buys),s5:N(x.m5?.sells),c5:c.m5,c1:c.h1,c24:c.h24,soc:(p.info?.socials?.length||0)+(p.info?.websites?.length||0)};
}
function fromGT(p){
  const a=p.attributes,id=p.relationships?.base_token?.data?.id;if(!id)return null;
  const x=a.transactions||{},v=a.volume_usd||{},c=a.price_change_percentage||{};
  return{src:"gt",addr:id.replace("solana_",""),sym:a.name.split(" / ")[0],name:a.name.split(" / ")[0],url:"https://www.geckoterminal.com/solana/pools/"+a.address,dex:(p.relationships?.dex?.data?.id||"").replace(/-/g,""),created:Date.parse(a.pool_created_at)||Date.now(),liq:N(a.reserve_in_usd),mc:N(a.market_cap_usd)||N(a.fdv_usd),v5:N(v.m5),v1:N(v.h1),v24:N(v.h24),b1:N(x.h1?.buys),s1:N(x.h1?.sells),b5:N(x.m5?.buys),s5:N(x.m5?.sells),c5:N(c.m5),c1:N(c.h1),c24:N(c.h24),soc:null};
}
function ingest(list){
  list.forEach(t=>{if(!t||!t.addr)return;const o=TL.coins.get(t.addr);if(o&&o.src==="ds"&&t.src==="gt")return;t.r=risk(t);t.pump=t.addr.endsWith("pump");TL.coins.set(t.addr,t)});
}
function saveCache(){try{localStorage.setItem("tl.cache",JSON.stringify([...TL.coins.values()].sort((a,b)=>b.created-a.created).slice(0,250)))}catch{}}
function loadCache(){try{ingest(JSON.parse(localStorage.getItem("tl.cache")||"[]"));return TL.coins.size>0}catch{return false}}
async function loadAll(onBatch){
  const GT="https://api.geckoterminal.com/api/v2/networks/solana/",DS="https://api.dexscreener.com/";
  const gt=(p,n)=>jget(GT+p+"?page="+n).then(j=>(j?.data||[]).map(fromGT));
  const srch=q=>jget(DS+"latest/dex/search?q="+q).then(j=>(j?.pairs||[]).map(fromDS));
  const prof=async()=>{
    const L=(await Promise.all(["token-profiles/latest/v1","token-boosts/latest/v1","token-boosts/top/v1"].map(u=>jget(DS+u)))).flat().filter(x=>x&&x.chainId==="solana");
    const a=[...new Set(L.map(x=>x.tokenAddress))].slice(0,150),ch=[];for(let i=0;i<a.length;i+=30)ch.push(a.slice(i,i+30));
    await Promise.all(ch.map(c=>jget(DS+"tokens/v1/solana/"+c.join(",")).then(j=>{ingest((j||[]).map(fromDS));onBatch()})));
  };
  const jobs=[gt("new_pools",1),gt("new_pools",2),gt("new_pools",3),gt("new_pools",4),gt("trending_pools",1),gt("trending_pools",2),gt("pools",1),srch("pumpfun"),srch("pumpswap"),srch("SOL"),srch("bonk")].map(j=>j.then(a=>{ingest(a);onBatch()}));
  jobs.push(prof());
  await Promise.all(jobs);saveCache();onBatch();
}
