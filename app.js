const TEAMS = {
ANA:["Anaheim Ducks","Ouest","Pacifique"],BOS:["Boston Bruins","Est","Atlantique"],BUF:["Buffalo Sabres","Est","Atlantique"],
CAR:["Carolina Hurricanes","Est","Métropolitaine"],CBJ:["Columbus Blue Jackets","Est","Métropolitaine"],CGY:["Calgary Flames","Ouest","Pacifique"],
CHI:["Chicago Blackhawks","Ouest","Central"],COL:["Colorado Avalanche","Ouest","Central"],DAL:["Dallas Stars","Ouest","Central"],
DET:["Detroit Red Wings","Est","Atlantique"],EDM:["Edmonton Oilers","Ouest","Pacifique"],FLA:["Florida Panthers","Est","Atlantique"],
LAK:["Los Angeles Kings","Ouest","Pacifique"],MIN:["Minnesota Wild","Ouest","Central"],MTL:["Montréal Canadiens","Est","Atlantique"],
NJD:["New Jersey Devils","Est","Métropolitaine"],NSH:["Nashville Predators","Ouest","Central"],NYI:["New York Islanders","Est","Métropolitaine"],
NYR:["New York Rangers","Est","Métropolitaine"],OTT:["Ottawa Senators","Est","Atlantique"],PHI:["Philadelphia Flyers","Est","Métropolitaine"],
PIT:["Pittsburgh Penguins","Est","Métropolitaine"],SJS:["San Jose Sharks","Ouest","Pacifique"],SEA:["Seattle Kraken","Ouest","Pacifique"],
STL:["St. Louis Blues","Ouest","Central"],TBL:["Tampa Bay Lightning","Est","Atlantique"],TOR:["Toronto Maple Leafs","Est","Atlantique"],
UTA:["Utah Mammoth","Ouest","Central"],VAN:["Vancouver Canucks","Ouest","Pacifique"],VGK:["Vegas Golden Knights","Ouest","Pacifique"],
WPG:["Winnipeg Jets","Ouest","Central"],WSH:["Washington Capitals","Est","Métropolitaine"]
};
const BASE="20252026", CURRENT="20262027";

const logoURL = (code, dark=false) => `https://assets.nhle.com/logos/nhl/svg/${code}_${dark?'dark':'light'}.svg`;
const logoHTML = (code, cls='team-logo') => code ? `<img class="${cls}" src="${logoURL(code)}" alt="${code}" width="28" height="28" loading="lazy" onerror="this.style.display='none'">` : '';
const toiFmt = (sec) => {
  const val = Math.round(n(sec));
  if(!val) return "—";
  const totalSec = val > 40 ? val : Math.round(val*60);
  const m = Math.floor(totalSec/60), r = totalSec%60;
  return `${m}:${String(r).padStart(2,'0')}`;
};
const toiMinutes = (sec) => {
  const val = n(sec);
  if(!val) return 0;
  return val > 40 ? val/60 : val;
};

const $=id=>document.getElementById(id);
const cache=new Map();
const n=v=>Number.isFinite(Number(v))?Number(v):0;
const avg=a=>a.length?a.reduce((s,x)=>s+n(x),0)/a.length:0;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const pct=x=>(n(x)*100).toFixed(1)+"%";
const fmt=x=>n(x).toFixed(2);
const fair=p=>p>0?(1/p).toFixed(2):"99.00";
const pname=x=>typeof x==="object"?(x?.default||x?.name||""):String(x||"");
const norm=s=>pname(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]/g,"");
const api=async(path,params={})=>{
  const u=new URL("/api",location.origin); u.searchParams.set("path",path);
  Object.entries(params).forEach(([k,v])=>u.searchParams.set(k,v));
  const key=u.toString(); if(cache.has(key))return cache.get(key);
  const r=await fetch(u); if(!r.ok)throw new Error(await r.text());
  const j=await r.json(); cache.set(key,j); return j;
};
const poisson=(l,k)=>{if(l<=0)return k===0?1:0;let f=1;for(let i=2;i<=k;i++)f*=i;return Math.exp(-l)*Math.pow(l,k)/f};
const cdf=(l,k)=>{let s=0;for(let i=0;i<=k;i++)s+=poisson(l,i);return clamp(s,0,1)};
const over=(l,line)=>clamp(1-cdf(l,Math.floor(line)),0,1);

function populateTeams(){
  for(const id of ["homeTeam","awayTeam"]){
    const s=$(id); s.innerHTML=Object.keys(TEAMS).sort().map(c=>`<option value="${c}">${c} — ${TEAMS[c][0]}</option>`).join("");
  }
  $("homeTeam").value="EDM"; $("awayTeam").value="CHI"; updateTeamMeta();
}
function updateTeamMeta(){
  for(const [id,meta] of [["homeTeam","homeMeta"],["awayTeam","awayMeta"]]){
    const c=$(id).value;
    $(meta).innerHTML=`${logoHTML(c,'team-logo-sm')} <span>${TEAMS[c][1]} • ${TEAMS[c][2]}</span>`;
  }
}
async function teamReport(report){
  const expr=`seasonId=${BASE} and gameTypeId=2`;
  const j=await api(`stats/rest/en/team/${report}`,{isAggregate:"false",isGame:"false",start:0,limit:-1,cayenneExp:expr});
  return j.data||[];
}
function teamCodeRow(r){
  const c=String(r.teamAbbrev||r.teamAbbreviation||r.teamCode||r.triCode||"").toUpperCase();
  if(TEAMS[c])return c;
  const name=String(r.teamFullName||r.teamName||"").toLowerCase();
  return Object.keys(TEAMS).find(k=>TEAMS[k][0].toLowerCase()===name)||"";
}
function field(r,names){for(const x of names){if(r[x]!==undefined&&r[x]!==null&&r[x]!=="")return n(r[x])}return NaN}
function rate(r,per,total,gp){const p=field(r,per);if(Number.isFinite(p)&&p>0)return p;const t=field(r,total);return Number.isFinite(t)&&gp>0?t/gp:0}
function mergeByTeam(rows){
  const out={};
  for(const r of rows){
    const c=teamCodeRow(r); if(!c)continue;
    out[c]=Object.assign(out[c]||{},r);
  }
  return out;
}
function parseTeamRows(summary,pcts,rt,pp,pk){
  const out={};
  const byS=mergeByTeam(summary),byP=mergeByTeam(pcts),byR=mergeByTeam(rt),byPP=mergeByTeam(pp),byPK=mergeByTeam(pk);
  for(const c of Object.keys(TEAMS)){
    const r=byS[c]; if(!r)continue;
    const p=byP[c]||{},rt0=byR[c]||{},pp0=byPP[c]||{},pk0=byPK[c]||{};
    const gp=field(r,["gamesPlayed","gp","games"]);
    const gf=rate(r,["goalsForPerGame"],["goalsFor","gf"],gp);
    const ga=rate(r,["goalsAgainstPerGame"],["goalsAgainst","ga"],gp);
    const shots=rate(r,["shotsForPerGame","sogForPerGame"],["shotsFor","shots","sogFor"],gp);
    const sa=rate(r,["shotsAgainstPerGame","sogAgainstPerGame"],["shotsAgainst","sogAgainst"],gp);
    if(!(gp>0&&gf>0&&ga>0&&shots>0&&sa>0))continue;
    const sat=field(p,["satPct"])||field(rt0,["satPct"]);
    const usat=field(p,["usatPct"]);
    const ppPct=field(r,["powerPlayPct"])||field(pp0,["powerPlayPct"]);
    const pkPct=field(r,["penaltyKillPct"])||field(pk0,["penaltyKillPct"]);
    const fo=field(r,["faceoffWinPct"]);
    const sh5=field(p,["shootingPct5v5"]);
    const sv5=field(p,["savePct5v5"]);
    const pdo=field(p,["shootingPlusSavePct5v5"]);
    const zs=field(p,["zoneStartPct5v5"]);
    const gfPct=field(p,["goalsForPct"]);
    const hits=field(rt0,["hitsPer60"]);
    const blocks=field(rt0,["blockedShotsPer60"]);
    const take=field(rt0,["takeawaysPer60"]);
    const give=field(rt0,["giveawaysPer60"]);
    out[c]={
      team:c,gp,gf,ga,shots,shotsAgainst:sa,
      sat:Number.isFinite(sat)?sat:.5,usat:Number.isFinite(usat)?usat:.5,
      pp:Number.isFinite(ppPct)?ppPct:.2,pk:Number.isFinite(pkPct)?pkPct:.8,
      fo:Number.isFinite(fo)?fo:.5,sh5:Number.isFinite(sh5)?sh5:.09,sv5:Number.isFinite(sv5)?sv5:.91,
      pdo:Number.isFinite(pdo)?pdo:1,zs:Number.isFinite(zs)?zs:.5,gfPct:Number.isFinite(gfPct)?gfPct:.5,
      hits:Number.isFinite(hits)?hits:15,blocks:Number.isFinite(blocks)?blocks:14,
      takeaways:Number.isFinite(take)?take:5,giveaways:Number.isFinite(give)?give:10,
      source:"NHL Stats 2025-26 + adv"
    };
  }
  return out;
}
let TEAMS_CACHE=null, TEAMS_CACHE_TS=0;
const TEAMS_TTL=5*60*1000; // 5 min
async function getTeams(force=false){
  if(!force&&TEAMS_CACHE&&Date.now()-TEAMS_CACHE_TS<TEAMS_TTL)return TEAMS_CACHE;
  const [summary,pcts,rt,pp,pk]=await Promise.all([
    teamReport("summary"),teamReport("percentages"),teamReport("realtime"),
    teamReport("powerplay"),teamReport("penaltykill")
  ]);
  TEAMS_CACHE=parseTeamRows(summary,pcts,rt,pp,pk);
  TEAMS_CACHE_TS=Date.now();
  return TEAMS_CACHE;
}
function leagueFrom(t){
  const vals=Object.values(t||{});
  if(vals.length<28)return {valid:false,teams:vals.length};
  return {
    valid:true,teams:vals.length,
    gf:avg(vals.map(x=>x.gf)),ga:avg(vals.map(x=>x.ga)),
    shots:avg(vals.map(x=>x.shots)),shotsAgainst:avg(vals.map(x=>x.shotsAgainst)),
    sat:avg(vals.map(x=>x.sat)),usat:avg(vals.map(x=>x.usat)),
    pp:avg(vals.map(x=>x.pp)),pk:avg(vals.map(x=>x.pk)),
    fo:avg(vals.map(x=>x.fo)),sh5:avg(vals.map(x=>x.sh5)),sv5:avg(vals.map(x=>x.sv5)),
    pdo:avg(vals.map(x=>x.pdo)),zs:avg(vals.map(x=>x.zs))
  };
}
async function league(){return leagueFrom(await getTeams());}
async function getForm(team){
  for(const season of [CURRENT,BASE]){
    try{
      const j=await api(`api-web.nhle.com/v1/club-schedule-season/${team}/${season}`);
      let games=(j.games||[]).filter(g=>g.gameType===2&&g.startTimeUTC&&new Date(g.startTimeUTC)<new Date());
      games.sort((a,b)=>new Date(b.startTimeUTC)-new Date(a.startTimeUTC));
      const out=[];
      for(const g of games.slice(0,5)){
        const x=await api(`api-web.nhle.com/v1/gamecenter/${g.id}/landing`);
        const h=x.homeTeam||{},a=x.awayTeam||{},home=h.abbrev===team,t=home?h:a,o=home?a:h;
        out.push({win:n(t.score)>n(o.score),gf:n(t.score),ga:n(o.score),shots:n(t.sog),shotsAgainst:n(o.sog),date:g.startTimeUTC});
      }
      if(out.length)return out;
    }catch(e){}
  }
  return [];
}
async function getB2B(team){
  try{
    const j=await api(`api-web.nhle.com/v1/club-schedule-season/${team}/${CURRENT}`);
    const gs=(j.games||[]).filter(g=>g.gameType===2&&g.startTimeUTC).sort((a,b)=>new Date(a.startTimeUTC)-new Date(b.startTimeUTC));
    const now=Date.now(); const idx=gs.findIndex(g=>new Date(g.startTimeUTC)>=now);
    if(idx<1)return {b2b:false,restDays:null};
    const d=(new Date(gs[idx].startTimeUTC)-new Date(gs[idx-1].startTimeUTC))/86400000;
    return {b2b:d<1.35,restDays:d};
  }catch(e){return {b2b:false,restDays:null}}
}
async function getGoalieFactors(){
  const expr=`seasonId=${BASE} and gameTypeId=2`;
  const j=await api("stats/rest/en/goalie/summary",{limit:-1,sort:"wins",cayenneExp:expr});
  const map={},all=[];
  for(const x of j.data||[]){
    const tm=String(x.teamAbbrev||x.teamAbbreviation||x.teamCode||"").toUpperCase(),gp=n(x.gamesPlayed),sv=n(x.savePct);
    if(!TEAMS[tm]||gp<=0||!sv)continue;
    map[tm]??={s:0,w:0};map[tm].s+=sv*Math.max(1,gp);map[tm].w+=Math.max(1,gp);
  }
  const f={};for(const [k,v] of Object.entries(map))f[k]={sv:clamp(v.s/v.w,.87,.94)};
  for(const v of Object.values(f))all.push(v.sv);
  f.leagueSV=avg(all)||.905;return f;
}
async function getSkaters(){
  // Préfère la saison courante dès qu'il y a assez de matchs, sinon base 2025-26
  let expr=`seasonId=${CURRENT} and gameTypeId=2`;
  let j=await api("stats/rest/en/skater/summary",{limit:-1,sort:"points",cayenneExp:expr});
  const curRows=(j.data||[]).filter(x=>n(x.gamesPlayed)>0);
  if(curRows.length<50){
    expr=`seasonId=${BASE} and gameTypeId=2`;
    j=await api("stats/rest/en/skater/summary",{limit:-1,sort:"points",cayenneExp:expr});
  }
  const rows=[],byId={},byName={};
  for(const x of j.data||[]){
    const id=String(x.playerId||x.id||""),gp=n(x.gamesPlayed);
    const name=pname(x.skaterFullName||x.playerName||x.fullName||`${x.firstName||""} ${x.lastName||""}`).trim();
    if(!name||gp<=0)continue;
    const tm=String(x.teamAbbrev||x.teamAbbreviation||x.teamCode||"").toUpperCase();
    const r={id,name,team:TEAMS[tm]?tm:"",gp,goals:n(x.goals),assists:n(x.assists),points:n(x.points),shots:n(x.shots||x.shotsOnGoal),toi:n(x.timeOnIcePerGame||x.avgTimeOnIcePerGame||x.toiPerGame),position:String(x.positionCode||x.position||"")};
    rows.push(r);if(id)byId[id]=r;byName[norm(name)]=r;
  }
  return {rows,byId,byName};
}
async function getRoster(team){
  try{
    const j=await api(`api-web.nhle.com/v1/roster/${team}/current`),players=[],goalies=[];
    const forwards=[], defense=[];
    for(const x of j.forwards||[]){
      const name=pname(x.fullName||`${pname(x.firstName)} ${pname(x.lastName)}`).trim();
      if(!name)continue;
      const p={id:String(x.id||x.playerId||""),name,position:"F",team,sweater:x.sweaterNumber||x.sweater||""};
      players.push(p); forwards.push(p);
    }
    for(const x of j.defensemen||[]){
      const name=pname(x.fullName||`${pname(x.firstName)} ${pname(x.lastName)}`).trim();
      if(!name)continue;
      const p={id:String(x.id||x.playerId||""),name,position:"D",team,sweater:x.sweaterNumber||x.sweater||""};
      players.push(p); defense.push(p);
    }
    for(const x of j.goalies||[]){
      const name=pname(x.fullName||`${pname(x.firstName)} ${pname(x.lastName)}`).trim();
      if(!name)continue;
      goalies.push({id:String(x.id||x.playerId||""),name,position:"G",team,sweater:x.sweaterNumber||x.sweater||""});
    }
    return {players,goalies,forwards,defense,raw:true};
  }catch(e){return {players:[],goalies:[],forwards:[],defense:[]}}
}

async function getGameLineup(gameId){
  if(!gameId) return null;
  try{
    const j=await api(`api-web.nhle.com/v1/gamecenter/${gameId}/boxscore`);
    const ps=j.playerByGameStats; if(!ps) return null;
    function side(key){
      const t=ps[key]||{};
      const map=(arr,pos)=>(arr||[]).map(x=>({
        id:String(x.playerId||""),
        name:pname(x.name||`${pname(x.firstName)} ${pname(x.lastName)}`),
        position:pos,
        sweater:x.sweaterNumber||""
      })).filter(x=>x.name);
      return {
        forwards: map(t.forwards,"F"),
        defense: map(t.defense||t.defensemen,"D"),
        goalies: map(t.goalies,"G")
      };
    }
    return {
      home: side("homeTeam"),
      away: side("awayTeam"),
      source: "boxscore",
      state: j.gameState
    };
  }catch(e){return null}
}


function shortName(name){
  const n=String(name||"").trim();
  if(!n) return "?";
  const parts=n.split(/\s+/);
  if(parts.length===1) return parts[0].slice(0,10);
  return parts[parts.length-1].slice(0,12);
}
function chunk(arr,size){
  const out=[]; for(let i=0;i<(arr||[]).length;i+=size) out.push(arr.slice(i,i+size));
  return out;
}
function buildLines(data){
  const F=data?.forwards||[], D=data?.defense||[], G=data?.goalies||[];
  const fLines=chunk(F,3), dPairs=chunk(D,2);
  const max=Math.max(fLines.length, dPairs.length, 1);
  const lines=[];
  for(let i=0;i<max;i++){
    lines.push({
      forwards: fLines[i]||[],
      defense: dPairs[i]||[],
      goalie: i===0 ? (G[0]||null) : (G[i]||null)
    });
  }
  if(!lines.length) lines.push({forwards:[],defense:[],goalie:G[0]||null});
  return lines;
}
function playerToken(p, role){
  if(!p) return `<div class="rink-slot empty"></div>`;
  const num=p.sweater?`#${p.sweater}`:"";
  return `<div class="rink-player ${role||""}" title="${p.name||""}">
    <div class="rink-avatar">${num||"•"}</div>
    <div class="rink-name">${shortName(p.name)}</div>
  </div>`;
}
function renderRinkFormation(awayData, homeData, awayCode, homeCode, lineIdx){
  const aLines=buildLines(awayData), hLines=buildLines(homeData);
  const max=Math.max(aLines.length, hLines.length, 1);
  const idx=Math.min(Math.max(0,lineIdx||0), max-1);
  const a=aLines[idx]||{forwards:[],defense:[],goalie:null};
  const h=hLines[idx]||{forwards:[],defense:[],goalie:null};
  // forwards: LW C RW — pad to 3
  const af=[a.forwards[0],a.forwards[1],a.forwards[2]];
  const hf=[h.forwards[0],h.forwards[1],h.forwards[2]];
  const ad=[a.defense[0],a.defense[1]];
  const hd=[h.defense[0],h.defense[1]];
  const tabs=Array.from({length:max},(_,i)=>`<button type="button" class="formation-tab ${i===idx?"active":""}" data-line="${i}">Formation ${i+1}</button>`).join("");
  return `<div class="formation-wrap" data-home="${homeCode}" data-away="${awayCode}">
    <div class="formation-tabs">${tabs}</div>
    <div class="rink">
      <div class="rink-ice">
        <div class="rink-zone away-zone">
          <div class="rink-row goalie">${playerToken(a.goalie,"g")}</div>
          <div class="rink-row defense">${playerToken(ad[0],"d")}${playerToken(ad[1],"d")}</div>
          <div class="rink-row forwards">${playerToken(af[0],"f")}${playerToken(af[1],"f")}${playerToken(af[2],"f")}</div>
          <div class="rink-team-tag">${logoHTML(awayCode,"team-logo-sm")} ${awayCode}</div>
        </div>
        <div class="rink-center-line"></div>
        <div class="rink-zone home-zone">
          <div class="rink-row forwards">${playerToken(hf[0],"f")}${playerToken(hf[1],"f")}${playerToken(hf[2],"f")}</div>
          <div class="rink-row defense">${playerToken(hd[0],"d")}${playerToken(hd[1],"d")}</div>
          <div class="rink-row goalie">${playerToken(h.goalie,"g")}</div>
          <div class="rink-team-tag">${logoHTML(homeCode,"team-logo-sm")} ${homeCode}</div>
        </div>
      </div>
    </div>
    <p class="muted formation-note">Lignes estimées par groupes de 3 attaquants / 2 défenseurs (ordre boxscore ou roster). Les lines officielles NHL peuvent différer.</p>
  </div>`;
}
function renderLineupBlock(title, code, data){
  if(!data) return `<div class="lineup-card"><div class="lineup-head">${logoHTML(code,"team-logo-sm")}<div><b>${code}</b><span>${title||""}</span></div></div><p class="muted">Composition non disponible</p></div>`;
  const chip=(p,pos)=>`<span class="line-chip pos-${pos||"F"}">${p.sweater?`<em>#${p.sweater}</em>`:""}${p.name}</span>`;
  const sec=(label,arr,pos)=>arr&&arr.length?`<div class="line-sec"><div class="line-sec-title"><span>${label}</span><b>${arr.length}</b></div><div class="line-chips">${arr.map(p=>chip(p,pos)).join("")}</div></div>`:"";
  const nf=(data.forwards||[]).length, nd=(data.defense||[]).length, ng=(data.goalies||[]).length;
  return `<div class="lineup-card">
    <div class="lineup-head">
      ${logoHTML(code,"team-logo-lg")}
      <div><b>${code}</b><span>${title||TEAMS[code]?.[0]||""}</span></div>
      <div class="lineup-count">${nf+nd+ng} joueurs</div>
    </div>
    ${sec("Attaque", data.forwards, "F")}
    ${sec("Défense", data.defense, "D")}
    ${sec("Gardiens", data.goalies, "G")}
  </div>`;
}
async function renderMatchLineups(home, away, gameId){
  const el=$("lineupsBox"); if(!el) return;
  el.innerHTML=`<div class="empty-inline">Chargement des compositions…</div>`;
  try{
    let lineup = gameId ? await getGameLineup(gameId) : null;
    let awayData, homeData, banner;
    if(lineup && (lineup.home?.forwards?.length || lineup.away?.forwards?.length)){
      awayData=lineup.away; homeData=lineup.home;
      banner=`<div class="lineup-banner official">Composition officielle · ${lineup.state||"boxscore"}</div>`;
    }else{
      const [rh,ra]=await Promise.all([getRoster(home),getRoster(away)]);
      awayData={forwards:ra.forwards,defense:ra.defense,goalies:ra.goalies};
      homeData={forwards:rh.forwards,defense:rh.defense,goalies:rh.goalies};
      banner=`<div class="lineup-banner roster">Roster actuel · formations estimées · transferts 2026-27 inclus</div>`;
    }
    const hasPlayers=(awayData.forwards?.length||0)+(homeData.forwards?.length||0)>0;
    if(!hasPlayers){
      el.innerHTML=`<div class="empty-inline">Composition non disponible pour ce match.</div>`;
      return;
    }
    function paint(lineIdx){
      el.innerHTML=banner+renderRinkFormation(awayData,homeData,away,home,lineIdx)+
        `<details class="lineup-details"><summary>Voir listes complètes</summary><div class="lineup-grid">${renderLineupBlock(TEAMS[away]?.[0]||away,away,awayData)}${renderLineupBlock(TEAMS[home]?.[0]||home,home,homeData)}</div></details>`;
      el.querySelectorAll(".formation-tab").forEach(btn=>{
        btn.onclick=()=>paint(Number(btn.dataset.line||0));
      });
    }
    paint(0);
  }catch(e){
    el.innerHTML=`<div class="empty-inline">Compositions indisponibles (${e.message||e}).</div>`;
  }
}

async function getGoalies(){
  const expr=`seasonId=${BASE} and gameTypeId=2`;
  const j=await api("stats/rest/en/goalie/summary",{limit:-1,sort:"wins",cayenneExp:expr});
  const byId={},rows=[];
  for(const x of j.data||[]){
    const id=String(x.playerId||x.id||""),tm=String(x.teamAbbrev||x.teamAbbreviation||x.teamCode||"").toUpperCase();
    if(!id)continue;
    const r={id,team:tm,gp:n(x.gamesPlayed),wins:n(x.wins),sv:n(x.savePct,.9),gaa:n(x.goalsAgainstAverage,3),name:pname(x.goalieFullName||x.playerName||x.fullName)};
    byId[id]=r;rows.push(r);
  }
  return {byId,rows};
}
function expectedFrom(h,a,l,fh,fa,bh,ba,gf){
  const hgf=fh.length?avg(fh.map(x=>x.gf)):h.gf,agf=fa.length?avg(fa.map(x=>x.gf)):a.gf;
  const hga=fh.length?avg(fh.map(x=>x.ga)):h.ga,aga=fa.length?avg(fa.map(x=>x.ga)):a.ga;
  // Attaque / défense classiques (saison + forme récente)
  const ha=clamp((h.gf*.72+hgf*.28)/l.gf,.7,1.35),aa=clamp((a.gf*.72+agf*.28)/l.gf,.7,1.35);
  const hd=clamp((h.ga*.72+hga*.28)/l.ga,.7,1.35),ad=clamp((a.ga*.72+aga*.28)/l.ga,.7,1.35);
  let xh=l.gf*Math.sqrt(ha*ad)*1.035,xa=l.gf*Math.sqrt(aa*hd)*.985;
  // Possession (SAT% ≈ Corsi) — impact modéré sur les xG
  const satH=clamp(h.sat/(l.sat||.5),.85,1.18),satA=clamp(a.sat/(l.sat||.5),.85,1.18);
  xh*=Math.sqrt(satH*(2-satA)); xa*=Math.sqrt(satA*(2-satH));
  // Spécialités : PP offensif vs PK adverse
  const ppEdgeH=clamp(1+(h.pp-(l.pp||.2))*.35+( (l.pk||.8)-a.pk)*.25,.92,1.1);
  const ppEdgeA=clamp(1+(a.pp-(l.pp||.2))*.35+( (l.pk||.8)-h.pk)*.25,.92,1.1);
  xh*=ppEdgeH; xa*=ppEdgeA;
  // PDO (shooting+save 5v5) — régression vers la moyenne si extrême
  if(h.pdo&&l.pdo){const pdoR=clamp(1-(h.pdo-l.pdo)*.4,.94,1.06);xh*=pdoR;}
  if(a.pdo&&l.pdo){const pdoR=clamp(1-(a.pdo-l.pdo)*.4,.94,1.06);xa*=pdoR;}
  // Fatigue B2B
  if(bh.b2b)xh*=.94;if(ba.b2b)xa*=.94;
  // Facteur gardien adverse
  if(gf[a.team])xh*=clamp(1+(gf.leagueSV-gf[a.team].sv)*.65,.93,1.07);
  if(gf[h.team])xa*=clamp(1+(gf.leagueSV-gf[h.team].sv)*.65,.93,1.07);
  xh=clamp(xh,1.25,6);xa=clamp(xa,1.1,5.75);
  // Tirs : SAT influence légère
  const shBase=clamp((h.shots*.65+a.shotsAgainst*.35)*(xh/l.gf)*.98,20,40);
  const saBase=clamp((a.shots*.65+h.shotsAgainst*.35)*(xa/l.gf)*.98,20,40);
  return {
    home:xh,away:xa,total:xh+xa,
    shotsHome:clamp(shBase*Math.sqrt(satH),.98*20,40),
    shotsAway:clamp(saBase*Math.sqrt(satA),.98*20,40),
    factors:{satH,satA,ppEdgeH,ppEdgeA}
  };
}
function markets(xh,xa){
  let h60=0,a60=0,t60=0;
  for(let h=0;h<=10;h++)for(let a=0;a<=10;a++){const p=poisson(xh,h)*poisson(xa,a);if(h>a)h60+=p;else if(a>h)a60+=p;else t60+=p}
  const total=xh+xa;
  return {home:h60+t60/2,away:a60+t60/2,home60:h60,away60:a60,tie60:t60,o45:over(total,4.5),o55:over(total,5.5),u55:1-over(total,5.5),o65:over(total,6.5),u65:1-over(total,6.5),btts:(1-Math.exp(-xh))*(1-Math.exp(-xa))};
}
function projectedScore(xh,xa){
  const a=[];for(let h=0;h<=8;h++)for(let x=0;x<=8;x++)a.push([h,x,poisson(xh,h)*poisson(xa,x)]);
  a.sort((x,y)=>y[2]-x[2]);return a[0];
}
async function buildPlayers(home,away,xh,xa,sh,sa){
  const [st,rh,ra]=await Promise.all([getSkaters(),getRoster(home),getRoster(away)]);
  const out=[];
  function build(r,tm,xg,shots){
    let raw=[];
    for(const p of r.players){
      const s=st.byId[p.id]||st.byName[norm(p.name)];if(!s)continue;
      let role=s.toi?clamp(toiMinutes(s.toi)/17,.55,1.45):1;if(p.position==="D")role*=.78;
      raw.push({id:p.id,name:p.name,team:tm,position:p.position,gp:s.gp,goals:s.goals,assists:s.assists,points:s.points,shots:s.shots,toi:s.toi,
        g:Math.max(.005,s.goals/s.gp*role),a:Math.max(.008,s.assists/s.gp*role),sht:Math.max(.15,s.shots/s.gp*role)});
    }
    if(raw.length<6){
      st.rows.filter(s=>s.team===tm).sort((a,b)=>b.points-a.points).slice(0,18).forEach(s=>{
        let role=s.toi?clamp(toiMinutes(s.toi)/17,.55,1.45):1;if(s.position==="D")role*=.78;
        raw.push({id:s.id,name:s.name,team:tm,position:s.position,gp:s.gp,goals:s.goals,assists:s.assists,points:s.points,shots:s.shots,toi:s.toi,
          g:Math.max(.005,s.goals/s.gp*role),a:Math.max(.008,s.assists/s.gp*role),sht:Math.max(.15,s.shots/s.gp*role)});
      });
    }
    raw.sort((a,b)=>(b.g+b.a+b.sht*.08)-(a.g+a.a+a.sht*.08));
    const act=raw.slice(0,18),sg=act.reduce((s,x)=>s+x.g,0)||1,sa0=act.reduce((s,x)=>s+x.a,0)||1,ss0=act.reduce((s,x)=>s+x.sht,0)||1;
    act.forEach(p=>{
      p.lg=clamp(p.g/sg*xg*.82,.008,.95);p.la=clamp(p.a/sa0*xg*.95,.01,1.1);p.ls=clamp(p.sht/ss0*shots*.92,.2,8);p.lp=clamp(p.lg+p.la,.02,1.8);
      p.pg=1-Math.exp(-p.lg);p.pa=1-Math.exp(-p.la);p.pp=1-Math.exp(-p.lp);p.ps=1-Math.exp(-p.ls);out.push(p);
    });
    return {matched:raw.length};
  }
  const mh=build(rh,home,xh,sh),ma=build(ra,away,xa,sa);
  out.sort((a,b)=>b.pp-a.pp);
  return {players:out,goaliesHome:rh.goalies,goaliesAway:ra.goalies,dataCount:out.length,totalCount:out.length,matchedHome:mh.matched,matchedAway:ma.matched};
}
async function projectGoalie(roster,team){
  const st=await getGoalies();let best=null;
  for(const g of roster||[]){const s=st.byId[g.id],score=s?s.gp*2+s.wins:0;if(!best||score>best.score)best={g,s,score}}
  if(!best)for(const s of st.rows.filter(x=>x.team===team)){const score=s.gp*2+s.wins;if(!best||score>best.score)best={g:{name:s.name},s,score}}
  return best&&best.s?{name:best.g.name||"Gardien 2025-26",sv:best.s.sv,gaa:best.s.gaa,conf:"baseline 2025-26"}:{name:best?.g?.name||"Non disponible",sv:.9,gaa:3,conf:"titulaire à confirmer"};
}
function setLoadMsg(msg){
  const el=$("loading"); if(!el)return;
  const s=el.querySelector("small"); if(s)s.textContent=msg;
}
async function analyze(home,away){
  if(home===away)throw new Error("Sélectionne deux équipes différentes.");
  setLoadMsg("Équipes, forme et gardiens…");
  // Une seule passe équipes → ligue dérivée (évite double fetch)
  const [teams,fh,fa,bh,ba,gf,rh,ra]=await Promise.all([
    getTeams(),getForm(home),getForm(away),getB2B(home),getB2B(away),getGoalieFactors(),
    getRoster(home),getRoster(away)
  ]);
  const l=leagueFrom(teams);
  const h=teams[home],a=teams[away];
  if(!h||!a||!l.valid)throw new Error("Données équipes insuffisantes (saison 2025-26).");
  const x=expectedFrom(h,a,l,fh,fa,bh,ba,gf),m=markets(x.home,x.away);
  setLoadMsg("Player props et projections…");
  const [players,gh,ga]=await Promise.all([
    buildPlayers(home,away,x.home,x.away,x.shotsHome,x.shotsAway),
    projectGoalie(rh.goalies,home),
    projectGoalie(ra.goalies,away)
  ]);
  let c=50;if(h&&a)c+=20;if(fh.length>=5)c+=5;if(fa.length>=5)c+=5;if(players.dataCount>=12)c+=8;else if(players.dataCount>=8)c+=5;
  if(Number.isFinite(h.sat)&&Number.isFinite(a.sat))c+=6;if(Number.isFinite(h.pp)&&Number.isFinite(a.pk))c+=4;
  if(bh.b2b||ba.b2b)c-=4;c=Math.round(clamp(c,0,95));
  const status=c<60||players.dataCount<6?"NO BET":"SURVEILLER";
  const gameId=window.__RDB_GAME_ID||null; window.__RDB_GAME_ID=null;
  return {home,away,h,a,l,fh,fa,bh,ba,gf,x,m,players,gh,ga,c,status,best:projectedScore(x.home,x.away),gameId};
}
let CURRENT_ANALYSIS=null, CURRENT_PROP="pg", LAST_HISTORY_KEY="";

function buildSummary(d){
  const fav = d.m.home >= d.m.away ? d.home : d.away;
  const favP = Math.max(d.m.home, d.m.away);
  const dog = fav === d.home ? d.away : d.home;
  const total = d.x.total;
  let totalTxt;
  if(total >= 6.3) totalTxt = "total très haut";
  else if(total >= 5.8) totalTxt = "total haut";
  else if(total <= 5.0) totalTxt = "total bas";
  else if(total <= 5.4) totalTxt = "total plutôt bas";
  else totalTxt = "total moyen";
  const btts = d.m.btts >= 0.55 ? "BTTS probable" : d.m.btts <= 0.42 ? "BTTS peu probable" : null;
  const conf = d.c >= 75 ? "confiance élevée" : d.c >= 60 ? "confiance correcte" : "confiance limitée";
  const edge = [];
  if(favP >= 0.58) edge.push(`${fav} favori clair (${pct(favP)} OT)`);
  else edge.push(`${fav} légèrement devant (${pct(favP)} OT)`);
  edge.push(totalTxt);
  if(btts) edge.push(btts);
  if(d.status === "NO BET") edge.push("prudence — statut NO BET");
  else edge.push(conf);
  return `${d.home} vs ${d.away} : ${edge.join(" · ")}. Score le plus probable ${d.best[0]}–${d.best[1]} (xG ${fmt(d.x.home)}–${fmt(d.x.away)}).`;
}

function marketValueFlags(m){
  // VALUE uniquement si proba modèle >= 65 %
  const T = 0.65;
  return {
    "Victoire domicile OT": m.home >= T,
    "Victoire extérieur OT": m.away >= T,
    "Domicile 60 min": m.home60 >= T,
    "Extérieur 60 min": m.away60 >= T,
    "Nul 60 min": m.tie60 >= T,
    "Over 4.5": m.o45 >= T,
    "Over 5.5": m.o55 >= T,
    "Under 5.5": m.u55 >= T,
    "Over 6.5": m.o65 >= T,
    "Under 6.5": m.u65 >= T,
    "BTTS": m.btts >= T
  };
}

function shareTextFrom(d){
  const sum = buildSummary(d);
  const lines = [
    `🏒 BETZONE by Ratsdubet`,
    `${d.home} vs ${d.away}`,
    sum,
    ``,
    `Home OT ${pct(d.m.home)} (cote juste ${fair(d.m.home)})`,
    `Away OT ${pct(d.m.away)} (cote juste ${fair(d.m.away)})`,
    `Over 5.5 ${pct(d.m.o55)} · BTTS ${pct(d.m.btts)}`,
    `Confiance ${d.c}% · ${d.status}`,
    ``,
    `→ https://ratsdubet-nhl.pages.dev`
  ];
  return lines.join("\n");
}

async function copyAnalysis(){
  const d = CURRENT_ANALYSIS; if(!d) return;
  const text = shareTextFrom(d);
  try{
    await navigator.clipboard.writeText(text);
    flashShare("Copié ✓");
  }catch(e){
    // fallback
    const ta=document.createElement("textarea");ta.value=text;document.body.appendChild(ta);ta.select();
    try{document.execCommand("copy");flashShare("Copié ✓")}catch(_){flashShare("Échec copie")}
    ta.remove();
  }
}

async function shareAnalysis(){
  const d = CURRENT_ANALYSIS; if(!d) return;
  const text = shareTextFrom(d);
  if(navigator.share){
    try{
      await navigator.share({title:`BETZONE · ${d.home} vs ${d.away}`, text, url:"https://ratsdubet-nhl.pages.dev"});
      return;
    }catch(e){ if(e.name==="AbortError") return; }
  }
  await copyAnalysis();
}

function flashShare(msg){
  const b=$("shareAnalysisBtn"); if(!b) return;
  const old=b.textContent; b.textContent=msg; b.classList.add("flash-ok");
  setTimeout(()=>{b.textContent=old;b.classList.remove("flash-ok")},1600);
  const c=$("copyAnalysisBtn");
  if(c && msg.includes("Copié")){const o=c.textContent;c.textContent=msg;setTimeout(()=>c.textContent=o,1600)}
}



function applyPaywall(fullAccess){
  const lock=$("premiumLock"), body=$("premiumBody");
  if(!lock||!body)return;
  if(fullAccess){
    lock.classList.add("hidden");
    body.classList.remove("hidden");
    body.style.filter=""; body.style.pointerEvents=""; body.style.userSelect="";
  }else{
    lock.classList.remove("hidden");
    body.classList.remove("hidden");
    body.style.filter="blur(6px)"; body.style.pointerEvents="none"; body.style.userSelect="none";
  }
}
function refreshPlanUI(){
  const A=window.RDB_AUTH, badge=$("planBadge"), chip=$("authChip");
  const banner=$("trialBanner");
  const trialMs=A?.trialRemainingMs?.()||0;
  const trialEnded=A?.hasTrialEnded?.()||false;

  if(banner){
    if(A?.isPremium() && trialMs>0){
      const h=Math.floor(trialMs/3600000);
      const m=Math.floor((trialMs%3600000)/60000);
      banner.className="trial-banner trial-active";
      banner.innerHTML=`<div><b>Essai Premium actif</b> — il te reste <strong>${h}h ${m}min</strong> d’accès complet (analyses illimitées, props, kombos…).</div>
        <button type="button" class="ghost-btn trial-cta" id="trialBannerPremium">Garder Premium à vie →</button>`;
      banner.classList.remove("hidden");
      $("trialBannerPremium")&&($("trialBannerPremium").onclick=()=>{
        document.querySelectorAll(".nav-btn").forEach(x=>x.classList.remove("active"));
        document.querySelectorAll(".view").forEach(x=>x.classList.remove("active"));
        const b=document.getElementById("navPremium"); if(b) b.classList.add("active");
        $("view-premium")?.classList.add("active");
      });
    }else if(trialEnded && A?.isLoggedIn() && !A?.isPremium()){
      banner.className="trial-banner trial-ended";
      banner.innerHTML=`<div><b>Essai 48 h terminé</b> — tu es repassé en Free (1 analyse / jour). Passe Premium pour tout débloquer à vie.</div>
        <button type="button" class="primary-btn trial-cta" id="trialBannerBuy">Passer Premium 20 € →</button>`;
      banner.classList.remove("hidden");
      $("trialBannerBuy")&&($("trialBannerBuy").onclick=()=>{
        document.querySelectorAll(".nav-btn").forEach(x=>x.classList.remove("active"));
        document.querySelectorAll(".view").forEach(x=>x.classList.remove("active"));
        document.getElementById("navPremium")?.classList.add("active");
        $("view-premium")?.classList.add("active");
        window.RDB_AUTH?.openCheckout?.();
      });
    }else{
      banner.classList.add("hidden");
      banner.innerHTML="";
    }
  }

  if(A?.isPremium() && trialMs>0){
    const h=Math.ceil(trialMs/3600000);
    if(badge){badge.innerHTML=`<strong>ESSAI 48H</strong><span>${h}h restantes</span>`;badge.classList.add("prem")}
    if(chip)chip.textContent=A.user?.name?`⭐ ${A.user.name}`:"⭐ Essai";
  }else if(A?.isPremium()){
    if(badge){badge.innerHTML=`<strong>PREMIUM</strong><span>Accès à vie</span>`;badge.classList.add("prem")}
    if(chip)chip.textContent=A.user?.name?`⭐ ${A.user.name}`:"⭐ Premium";
  }else if(A?.isLoggedIn()){
    if(badge){badge.innerHTML=`<strong>FREE</strong><span>${trialEnded?"Essai terminé":"1 analyse / jour"}</span>`;badge.classList.remove("prem")}
    if(chip)chip.textContent=A.user?.name||A.user?.email||"Compte";
  }else{
    if(badge){badge.innerHTML=`<strong>FREE</strong><span>Essai 48h à l’inscription</span>`;badge.classList.remove("prem")}
    if(chip)chip.textContent="Compte";
  }
}

function renderAnalysis(d){
  CURRENT_ANALYSIS=d;
  const access=window.RDB_AUTH?.canAnalyzeFull?.()||{ok:true};
  const full=!!access.ok;
  if(full) window.RDB_AUTH?.consumeAnalysis?.();
  saveHistory(d);
  $("emptyState").classList.add("hidden");$("analysis").classList.remove("hidden");
  $("aHomeCode").innerHTML=logoHTML(d.home,"team-logo-lg")+` <span>${d.home}</span>`;$("aHomeName").textContent=TEAMS[d.home][0];$("aAwayCode").innerHTML=logoHTML(d.away,"team-logo-lg")+` <span>${d.away}</span>`;$("aAwayName").textContent=TEAMS[d.away][0];
  $("xgHome").textContent=fmt(d.x.home);$("xgAway").textContent=fmt(d.x.away);$("scoreProb").textContent=`${d.best[0]}–${d.best[1]}`;
  $("confidence").textContent=pct(d.c/100);$("confidenceBar").style.width=`${d.c}%`;
  const k=full
    ?[["TOTAL BUTS",fmt(d.x.total)],["TOTAL TIRS",fmt(d.x.shotsHome+d.x.shotsAway)],["HOME OT",pct(d.m.home)],["AWAY OT",pct(d.m.away)],["OVER 5.5",pct(d.m.o55)],["BTTS",pct(d.m.btts)]]
    :[["TOTAL BUTS",fmt(d.x.total)],["SCORE",`${d.best[0]}–${d.best[1]}`],["CONFIANCE",pct(d.c/100)],["STATUT",d.status],["🔒 PREMIUM","requis"],["PRIX","20 € à vie"]];
  $("kpis").innerHTML=k.map(x=>`<div class="kpi"><small>${x[0]}</small><b>${x[1]}</b></div>`).join("");
  applyPaywall(full);
  // Blessures des 2 équipes sur la dashboard analyse
  ensureInjuryCache().then(()=>renderMatchInjuries(d.home,d.away)).catch(()=>{});
  const mk=[["Victoire domicile OT",d.m.home],["Victoire extérieur OT",d.m.away],["Domicile 60 min",d.m.home60],["Extérieur 60 min",d.m.away60],["Nul 60 min",d.m.tie60],["Over 4.5",d.m.o45],["Over 5.5",d.m.o55],["Under 5.5",d.m.u55],["Over 6.5",d.m.o65],["Under 6.5",d.m.u65],["BTTS",d.m.btts]];
  const valFlags=marketValueFlags(d.m);
  $("markets").innerHTML=mk.map(x=>{
    const isVal=!!valFlags[x[0]];
    return `<div class="market${isVal?" value":""}" title="${isVal?"Edge modèle détecté":""}">
      <div class="label">${x[0]}${isVal?` <span class="value-tag">VALUE</span>`:""}</div>
      <div class="value"><b>${pct(x[1])}</b><span class="fair">${fair(x[1])}</span></div>
    </div>`;
  }).join("");
  const sumEl=$("analysisSummary");
  if(sumEl){
    const fav = d.m.home >= d.m.away ? d.home : d.away;
    const favP = Math.max(d.m.home, d.m.away);
    const total = d.x.total;
    const totalLbl = total>=6.2?"Total haut":total<=5.2?"Total bas":"Total moyen";
    const conf = d.c>=75?"Élevée":d.c>=60?"Correcte":"Limitée";
    sumEl.innerHTML=`<div class="summary-rich">
      <p class="summary-text">${buildSummary(d)}</p>
      <div class="summary-kpis">
        <div><span>Favori OT</span><b>${fav} ${pct(favP)}</b></div>
        <div><span>xG</span><b>${fmt(d.x.home)} – ${fmt(d.x.away)}</b></div>
        <div><span>${totalLbl}</span><b>${fmt(total)}</b></div>
        <div><span>Confiance</span><b class="${d.c>=60?"ok":"warn"}">${conf} (${d.c}%)</b></div>
        <div><span>Statut</span><b class="${d.status==="NO BET"?"warn":"ok"}">${d.status}</b></div>
      </div>
    </div>`;
  }
  const notes=[
    {t:"Projection",x:`${d.home} ${fmt(d.x.home)} xG contre ${d.away} ${fmt(d.x.away)} xG. Total modèle : ${fmt(d.x.total)} buts.`},
    {t:"Possession",x:`SAT% ${d.home} ${pct(d.h.sat)} vs ${d.away} ${pct(d.a.sat)} • USAT% ${pct(d.h.usat)} / ${pct(d.a.usat)}. Impact Corsi intégré aux xG.`},
    {t:"Spécialités",x:`PP ${d.home} ${pct(d.h.pp)} vs PK ${d.away} ${pct(d.a.pk)} • PP ${d.away} ${pct(d.a.pp)} vs PK ${d.home} ${pct(d.h.pk)}.`},
    {t:"Forme",x:`5 derniers matchs : ${d.home} ${d.fh.length}/5, ${d.away} ${d.fa.length}/5.`},
    {t:"Fatigue",x:`B2B : ${d.home} ${d.bh.b2b?"OUI":"non"}${d.bh.restDays?` (${d.bh.restDays.toFixed(1)} j)`:``} • ${d.away} ${d.ba.b2b?"OUI":"non"}${d.ba.restDays?` (${d.ba.restDays.toFixed(1)} j)`:``}.`},
    {t:"Statut",x:`${d.status} — confiance modèle ${pct(d.c/100)}.`}
  ];
  $("modelNotes").innerHTML=notes.map((x,i)=>`<div class="note ${i===5&&d.status==="NO BET"?"warn":"good"}"><b>${x.t} :</b> ${x.x}</div>`).join("");
  $("goalies").innerHTML=[["home",d.home,d.gh],["away",d.away,d.ga]].map(x=>`<div class="goalie"><h3>${logoHTML(x[1],"team-logo-sm")} ${x[1]} <span style="color:#8ea4b8">• ${x[2].name}</span></h3><div class="stat-row"><span>SV%</span><b>${pct(x[2].sv)}</b></div><div class="stat-row"><span>GAA</span><b>${fmt(x[2].gaa)}</b></div><div class="stat-row"><span>Contexte</span><b>${x[2].conf}</b></div></div>`).join("");
  $("form").innerHTML=[["home",d.home,d.fh,d.bh],["away",d.away,d.fa,d.ba]].map(x=>{
    const wins=x[2].filter(g=>g.win).length,gf=avg(x[2].map(g=>g.gf)),ga=avg(x[2].map(g=>g.ga));
    // ronds : plus ancien à gauche → plus récent à droite
    const ordered=[...x[2]].reverse();
    const dots=ordered.map(g=>`<span class="form-dot ${g.win?"win":"loss"}" title="${g.win?"Victoire":"Défaite"} ${g.gf}-${g.ga}"></span>`).join("")
      || `<span class="muted">Pas de matchs récents</span>`;
    const detail=ordered.map(g=>`<span class="form-chip ${g.win?"win":"loss"}">${g.win?"V":"D"} ${g.gf}-${g.ga}</span>`).join("")||"";
    return `<div class="form-team"><h3>${logoHTML(x[1],"team-logo-sm")} ${x[1]}</h3>
      <div class="form-dots-row"><span class="form-dots-label">5 derniers</span><div class="form-dots">${dots}</div><span class="form-dots-score">${wins}V-${x[2].length-wins}D</span></div>
      <div class="form-chips">${detail}</div>
      <div class="stat-row"><span>Buts (moy.)</span><b>${fmt(gf)} pour · ${fmt(ga)} contre</b></div>
      <div class="stat-row"><span>B2B</span><b>${x[3].b2b?"OUI ⚠️":"NON"}</b></div></div>`;
  }).join("");
  renderAdvanced(d);
  renderPlayers(CURRENT_PROP);renderAllProps();renderAudit();
  renderMatchLineups(d.home,d.away,d.gameId||null);
}
function renderAdvanced(d){
  const el=$("advancedStats"); if(!el)return;
  const rows=[
    ["SAT% (Corsi)",pct(d.h.sat),pct(d.a.sat)],
    ["USAT% (Fenwick)",pct(d.h.usat),pct(d.a.usat)],
    ["Power Play %",pct(d.h.pp),pct(d.a.pp)],
    ["Penalty Kill %",pct(d.h.pk),pct(d.a.pk)],
    ["Faceoffs %",pct(d.h.fo),pct(d.a.fo)],
    ["Zone Start % 5v5",pct(d.h.zs),pct(d.a.zs)],
    ["Sh% 5v5",pct(d.h.sh5),pct(d.a.sh5)],
    ["Sv% 5v5",pct(d.h.sv5),pct(d.a.sv5)],
    ["PDO 5v5",fmt(d.h.pdo),fmt(d.a.pdo)],
    ["GF%",pct(d.h.gfPct),pct(d.a.gfPct)],
    ["Hits /60",fmt(d.h.hits),fmt(d.a.hits)],
    ["Blocks /60",fmt(d.h.blocks),fmt(d.a.blocks)],
    ["Takeaways /60",fmt(d.h.takeaways),fmt(d.a.takeaways)],
    ["Giveaways /60",fmt(d.h.giveaways),fmt(d.a.giveaways)]
  ];
  el.innerHTML=`<div class="adv-grid"><div class="adv-head"><span>Métrique</span><b>${d.home}</b><b>${d.away}</b></div>${rows.map(r=>`<div class="adv-row"><span>${r[0]}</span><b>${r[1]}</b><b>${r[2]}</b></div>`).join("")}</div>`;
}
function renderPlayers(key){
  CURRENT_PROP=key;const p=CURRENT_ANALYSIS?.players.players||[];
  const h=p.filter(x=>x.team===CURRENT_ANALYSIS.home).sort((a,b)=>b[key]-a[key]).slice(0,3),a=p.filter(x=>x.team===CURRENT_ANALYSIS.away).sort((a,b)=>b[key]-a[key]).slice(0,3);
  const labels={pg:["Buts","lg","but"],pa:["Passes","la","passe"],pp:["Points","lp","point"],ps:["Tirs","ls","tir"]};
  const [title,proj,unit]=labels[key];
  function box(team,arr){return `<div class="player-box"><h3>${logoHTML(team,"team-logo-sm")} ${team} — TOP 3 ${title.toUpperCase()}</h3>${arr.map((p,i)=>`<div class="player"><span class="rank">#${i+1}</span><span class="name">${p.name}<small>${p.position||"—"} • ${p.gp} MJ • TOI ${toiFmt(p.toi)}</small></span><span class="proj">${fmt(p[proj])} ${unit}</span><span class="prob">${pct(p[key])}</span></div>`).join("")||`<div class="player"><span></span><span class="name">Données insuffisantes</span></div>`}</div>`}
  $("playerTables").innerHTML=box(CURRENT_ANALYSIS.home,h)+box(CURRENT_ANALYSIS.away,a);
}

function saveHistory(d){
  const key="rdb_nhl_history_v1";
  const fingerprint=`${d.home}-${d.away}-${d.x.home.toFixed(4)}-${d.x.away.toFixed(4)}`;
  if(fingerprint===LAST_HISTORY_KEY)return;
  LAST_HISTORY_KEY=fingerprint;
  let h=[];try{h=JSON.parse(localStorage.getItem(key)||"[]")}catch(e){}
  h.unshift({
    ts:new Date().toISOString(),home:d.home,away:d.away,
    xh:d.x.home,xa:d.x.away,total:d.x.total,
    homeOT:d.m.home,awayOT:d.m.away,o55:d.m.o55,u55:d.m.u55,btts:d.m.btts,
    score:`${d.best[0]}–${d.best[1]}`,confidence:d.c,status:d.status,
    pickFav: d.m.home>=d.m.away ? "home" : "away",
    pickOver55: d.m.o55>=0.5
  });
  h=h.slice(0,100);localStorage.setItem(key,JSON.stringify(h));renderHistory();
}
function getHistory(){
  try{return JSON.parse(localStorage.getItem("rdb_nhl_history_v1")||"[]")}catch(e){return []}
}


async function resolveHistoryResults(){
  const hist=getHistory();
  if(!hist.length) return {items:[],stats:null};
  const items=[];
  let favHit=0,favN=0,o55Hit=0,o55N=0,bttsHit=0,bttsN=0;
  for(const h of hist.slice(0,40)){
    let result=null;
    try{
      // cherche un match FINAL home/away autour de la date d'analyse (±3j)
      const base=new Date(h.ts);
      for(let delta=-1; delta<=3; delta++){
        const d=new Date(base); d.setDate(d.getDate()+delta);
        const iso=d.toISOString().slice(0,10);
        const j=await api(`api-web.nhle.com/v1/schedule/${iso}`);
        const games=(j.gameWeek||[]).flatMap(x=>x.games||[]);
        const g=games.find(x=>{
          const ha=x.homeTeam?.abbrev, aa=x.awayTeam?.abbrev;
          return ha===h.home && aa===h.away && (x.gameState==="OFF"||x.gameState==="FINAL"||x.gameScheduleState==="OK"&&Number.isFinite(x.homeTeam?.score));
        });
        if(g && Number.isFinite(g.homeTeam?.score) && Number.isFinite(g.awayTeam?.score)){
          const hs=n(g.homeTeam.score), as_=n(g.awayTeam.score);
          result={hs,as_,total:hs+as_,homeWin:hs>as_,awayWin:as_>hs,btts:hs>0&&as_>0,date:iso};
          break;
        }
      }
    }catch(_){}
    let hits={};
    if(result){
      const favHome = (h.pickFav|| (h.homeOT>=h.awayOT?"home":"away"))==="home";
      const favOk = favHome ? result.homeWin : result.awayWin;
      favN++; if(favOk) favHit++;
      hits.fav=favOk;
      const overOk = result.total > 5.5;
      const pickedOver = h.pickOver55!=null ? h.pickOver55 : h.o55>=0.5;
      o55N++; if(pickedOver===overOk) o55Hit++;
      hits.o55 = pickedOver===overOk;
      bttsN++; const bttsPick=h.btts>=0.5; if(bttsPick===result.btts) bttsHit++;
      hits.btts = bttsPick===result.btts;
    }
    items.push({...h, result, hits});
  }
  const stats={
    fav:{hit:favHit,n:favN,pct:favN?favHit/favN:null},
    o55:{hit:o55Hit,n:o55N,pct:o55N?o55Hit/o55N:null},
    btts:{hit:bttsHit,n:bttsN,pct:bttsN?bttsHit/bttsN:null}
  };
  return {items,stats};
}

function renderHitRate(stats){
  const el=$("hitRateBox"); if(!el)return;
  if(!stats || (!stats.fav.n && !stats.o55.n)){
    el.innerHTML=`<div class="empty-inline">Pas encore assez de matchs joués pour calculer le hit rate.<br><small>Analyse des matchs, puis reviens après les résultats.</small></div>`;
    return;
  }
  function card(label,s,hint){
    const pctTxt=s.pct!=null?`${(s.pct*100).toFixed(0)}%`:"—";
    const cls=s.pct==null?"":s.pct>=0.70?"hit-good":s.pct>=0.50?"hit-mid":"hit-bad";
    return `<div class="hit-card ${cls}"><small>${label}</small><b>${pctTxt}</b><span>${s.hit||0}/${s.n||0} · ${hint}</span></div>`;
  }
  el.innerHTML=`<div class="hit-grid">
    ${card("Favori OT",stats.fav,"côté favori modèle")}
    ${card("Total 5.5",stats.o55,"over/under selon modèle")}
    ${card("BTTS",stats.btts,"les deux équipes marquent")}
  </div>
  <p class="muted" style="margin-top:10px">Basé sur tes analyses locales dont le match est terminé. Plus tu analyses, plus la preuve est solide — argument Premium.</p>`;
}

async function renderHistory(){
  const el=$("historyTable");if(!el)return;
  el.innerHTML=`<div class="empty-inline">Calcul du hit rate…</div>`;
  try{
    const {items,stats}=await resolveHistoryResults();
    renderHitRate(stats);
    if(!items.length){el.innerHTML=`<div class="empty-inline">Aucune analyse enregistrée.</div>`;return}
    el.innerHTML=`<table class="props-table"><thead><tr>
      <th>Date</th><th>Match</th><th>xG</th><th>Pick</th><th>Résultat</th><th>Fav</th><th>O/U 5.5</th><th>Conf.</th>
    </tr></thead><tbody>${items.map(x=>{
      const pick=x.pickFav==="away"?x.away:x.home;
      const res=x.result?`${x.result.as_}–${x.result.hs}`:"en attente";
      const favI=x.hits?.fav==null?"—":(x.hits.fav?"✓":"✗");
      const ouI=x.hits?.o55==null?"—":(x.hits.o55?"✓":"✗");
      return `<tr>
        <td>${new Date(x.ts).toLocaleString("fr-FR")}</td>
        <td class="pname">${x.home} – ${x.away}</td>
        <td>${fmt(x.xh)} – ${fmt(x.xa)}</td>
        <td>${pick}</td>
        <td>${res}</td>
        <td class="${x.hits?.fav===true?"hit-yes":x.hits?.fav===false?"hit-no":""}">${favI}</td>
        <td class="${x.hits?.o55===true?"hit-yes":x.hits?.o55===false?"hit-no":""}">${ouI}</td>
        <td>${x.confidence}%</td>
      </tr>`;
    }).join("")}</tbody></table>`;
  }catch(e){
    el.innerHTML=`<div class="empty-inline">Historique indisponible (${e.message||e}).</div>`;
  }
}

function clearHistory(){
  localStorage.removeItem("rdb_nhl_history_v1");renderHistory();const hr=$("hitRateBox");if(hr)hr.innerHTML="";
}

function renderAllProps(){
  const p=CURRENT_ANALYSIS?.players.players||[];
  $("allProps").innerHTML=`<table class="props-table"><thead><tr><th>Joueur</th><th>Équipe</th><th>TOI</th><th>Buts proj.</th><th>P 1+ but</th><th>Passes proj.</th><th>P 1+ passe</th><th>Points proj.</th><th>P 1+ point</th><th>Tirs proj.</th><th>P 1+ tir</th></tr></thead><tbody>${p.map(x=>`<tr><td class="pname">${x.name}</td><td>${logoHTML(x.team,"team-logo-xs")} ${x.team}</td><td>${toiFmt(x.toi)}</td><td>${fmt(x.lg)}</td><td class="prob">${pct(x.pg)}</td><td>${fmt(x.la)}</td><td class="prob">${pct(x.pa)}</td><td>${fmt(x.lp)}</td><td class="prob">${pct(x.pp)}</td><td>${fmt(x.ls)}</td><td class="prob">${pct(x.ps)}</td></tr>`).join("")}</tbody></table>`;
}
function renderAudit(){
  const d=CURRENT_ANALYSIS;
  $("audit").innerHTML=`<p class="muted" style="margin-bottom:8px">Rosters : API <b>/roster/{team}/current</b> (effectifs 2026-27, transferts inclus). Stats joueurs : saison régulière 2025-26.</p><table><thead><tr><th>Équipe</th><th>GP</th><th>GF</th><th>GA</th><th>Tirs</th><th>SAT%</th><th>PP%</th><th>PK%</th><th>FO%</th><th>PDO</th><th>Source</th></tr></thead><tbody>
  <tr><td><b>${d.home}</b></td><td>${d.h.gp}</td><td>${fmt(d.h.gf)}</td><td>${fmt(d.h.ga)}</td><td>${fmt(d.h.shots)}</td><td>${pct(d.h.sat)}</td><td>${pct(d.h.pp)}</td><td>${pct(d.h.pk)}</td><td>${pct(d.h.fo)}</td><td>${fmt(d.h.pdo)}</td><td>${d.h.source}</td></tr>
  <tr><td><b>${d.away}</b></td><td>${d.a.gp}</td><td>${fmt(d.a.gf)}</td><td>${fmt(d.a.ga)}</td><td>${fmt(d.a.shots)}</td><td>${pct(d.a.sat)}</td><td>${pct(d.a.pp)}</td><td>${pct(d.a.pk)}</td><td>${pct(d.a.fo)}</td><td>${fmt(d.a.pdo)}</td><td>${d.a.source}</td></tr></tbody></table>`;
}

async function loadNews(){
  const el=$("newsFeed"); if(!el)return;
  el.innerHTML=`<div class="empty-inline">Chargement des actus NHL…</div>`;
  try{
    const r=await fetch("/api?news=1",{cache:"no-store"});
    const j=await r.json();
    const arts=j.articles||[];
    if(!arts.length){
      el.innerHTML=`<div class="empty-inline">Aucune actu pour le moment. Réessaie avec ↻ Actualiser.<br><small>${j.error||""}</small></div>`;
      return;
    }
    el.innerHTML=arts.map(a=>{
      let d="";
      try{ if(a.published) d=new Date(a.published).toLocaleString("fr-FR",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}); }catch(_){}
      const img=a.image?`<img src="${a.image}" alt="" loading="lazy" referrerpolicy="no-referrer">`:"";
      const desc=(a.description||"").slice(0,180);
      return `<a class="news-card" href="${a.url||"https://www.nhl.com/news"}" target="_blank" rel="noopener">
        <div class="news-img">${img||`<div class="news-ph">🏒</div>`}</div>
        <div class="news-body">
          <div class="news-meta">${d||"Récent"} · ${a.source||"NHL"}</div>
          <h3>${a.title||"Sans titre"}</h3>
          <p>${desc}${desc.length>=180?"…":""}</p>
        </div>
      </a>`;
    }).join("");
  }catch(e){
    el.innerHTML=`<div class="empty-inline">Impossible de charger l'actu (${e.message||e}).<br>Vérifie que <code>functions/api.js</code> est bien déployé.</div>`;
  }
}

async function runAnalysis(){
  const home=$("homeTeam").value,away=$("awayTeam").value,btn=$("analyzeBtn");
  if(btn){btn.disabled=true;btn.style.opacity=".6"}
  $("loading").classList.remove("hidden");$("analysis").classList.add("hidden");$("emptyState").classList.add("hidden");
  setLoadMsg("Connexion NHL…");
  try{
    renderAnalysis(await analyze(home,away));
    $("lastUpdate").textContent="Dernière analyse : "+new Date().toLocaleTimeString("fr-FR");
  }catch(e){
    $("emptyState").classList.remove("hidden");
    $("emptyState").innerHTML=`<div class="empty-icon">⚠️</div><h2>Analyse indisponible</h2><p>${e.message||e}</p><p class="muted" style="margin-top:8px">Réessaie dans quelques secondes ou change d'équipes.</p>`;
  }finally{
    $("loading").classList.add("hidden");
    if(btn){btn.disabled=false;btn.style.opacity="1"}
  }
}
async function schedule(days=0){
  const d=new Date();d.setDate(d.getDate()+days);
  const iso=d.toISOString().slice(0,10);
  $("schedule").innerHTML=`<div class="empty-inline">Chargement…</div>`;
  try{
    const j=await api(`api-web.nhle.com/v1/schedule/${iso}`);
    const week=j.gameWeek||[];
    // uniquement le jour demandé (pas toute la semaine)
    const day=week.find(x=>(x.date||"").slice(0,10)===iso) || week.find(x=>x.numberOfGames>0) || week[0];
    const games=(day?.games)||[];
    const label=day?.date||iso;
    if(!games.length){
      $("schedule").innerHTML=`<div class="empty-inline">Aucun match le ${label}.<br><small>Pré-saison / début de saison : essaie Demain ou J+2.</small></div>`;
      return;
    }
    $("schedule").innerHTML=`<div class="muted" style="margin-bottom:10px">📅 ${label} · ${games.length} match(s)</div>`+games.map(g=>{
      const h=g.homeTeam?.abbrev||"", a=g.awayTeam?.abbrev||"";
      const dt=new Date(g.startTimeUTC||g.gameDate||label);
      const time=isNaN(dt)? "—" : dt.toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"});
      const hs=g.homeTeam?.score, as_=g.awayTeam?.score;
      const hasScore=Number.isFinite(hs)&&Number.isFinite(as_);
      const score=hasScore?`${as_} – ${hs}`:time;
      const type=g.gameType===1?"PRÉ":g.gameType===2?"Saison":g.gameType===3?"Séries":"";
      const state=g.gameState||"";
      return `<div class="sched-row">
        <div class="sched-teams">
          ${logoHTML(a,"team-logo-sm")}<span class="code">${a}</span>
          <span class="sched-score">${score}</span>
          ${logoHTML(h,"team-logo-sm")}<span class="code">${h}</span>
          <small class="sched-tag">${type}${state?` · ${state}`:""}</small>
        </div>
        <button class="ghost-btn analyze-small" data-home="${h}" data-away="${a}" data-game-id="${g.id||""}">Analyser</button>
      </div>`;
    }).join("");
    document.querySelectorAll(".analyze-small").forEach(b=>b.onclick=()=>{
      if(!b.dataset.home||!b.dataset.away)return;
      $("homeTeam").value=b.dataset.home;$("awayTeam").value=b.dataset.away;updateTeamMeta();
      window.__RDB_GAME_ID=b.dataset.gameId||null;
      document.querySelectorAll(".nav-btn").forEach(x=>x.classList.remove("active"));
      document.querySelector('.nav-btn[data-view="analyse"]')?.classList.add("active");
      document.querySelectorAll(".view").forEach(x=>x.classList.remove("active"));$("view-analyse").classList.add("active");
      runAnalysis();
    });
  }catch(e){$("schedule").innerHTML=`<div class="empty-inline">Impossible de charger le calendrier (${e.message||e}).</div>`}
}
async function renderTeamTable(){
  $("teamTable").innerHTML=`<div class="empty-inline">Chargement des 32 équipes…</div>`;
  try{
    const t=await getTeams(),l=leagueFrom(t);
    const rows=Object.keys(TEAMS).sort().map(c=>{
      const x=t[c];
      return x?`<tr>
        <td>${logoHTML(c,"team-logo-sm")} <span class="code">${c}</span> ${TEAMS[c][0]}</td>
        <td>${x.gp}</td><td>${fmt(x.gf)}</td><td>${fmt(x.ga)}</td>
        <td>${pct(x.sat)}</td><td>${pct(x.usat)}</td>
        <td>${pct(x.pp)}</td><td>${pct(x.pk)}</td>
        <td>${pct(x.fo)}</td><td>${fmt(x.pdo)}</td>
        <td>${fmt(x.gf/l.gf)}</td><td>${fmt(x.ga/l.ga)}</td>
      </tr>`:`<tr><td>${logoHTML(c,"team-logo-sm")} <span class="code">${c}</span> ${TEAMS[c][0]}</td><td colspan="11">Données insuffisantes</td></tr>`;
    }).join("");
    $("teamTable").innerHTML=`<table><thead><tr>
      <th>Équipe</th><th>GP</th><th>GF</th><th>GA</th>
      <th>SAT%</th><th>USAT%</th><th>PP%</th><th>PK%</th><th>FO%</th><th>PDO</th>
      <th>Attaque</th><th>Défense</th>
    </tr></thead><tbody>${rows}</tbody></table>`;
  }catch(e){$("teamTable").innerHTML=`<div class="empty-inline">${e.message}</div>`}
}
function openAuth(mode){
  const m=$("authModal"); if(!m)return;
  m.classList.remove("hidden");
  const isReg=mode==="register";
  document.querySelectorAll(".auth-tab").forEach(t=>t.classList.toggle("active",t.dataset.auth===(isReg?"register":"login")));
  $("authNameWrap")?.classList.toggle("hidden",!isReg);
  $("authSubmit").textContent=isReg?"Créer mon compte":"Se connecter";
  $("authError")?.classList.add("hidden");
  const A=window.RDB_AUTH;
  const lo=$("authLogout");
  if(lo)lo.style.display=A?.isLoggedIn()?"block":"none";
}
function closeAuth(){ $("authModal")?.classList.add("hidden"); }
function setupAuthUI(){
  const A=window.RDB_AUTH; if(!A)return;
  A.checkUnlockParam?.();
  refreshPlanUI();
  $("authChip")?.addEventListener("click",()=>openAuth(A.isLoggedIn()?"login":"register"));
  $("unlockBtn")?.addEventListener("click",()=>A.openCheckout());
  $("buyPremiumBtn")?.addEventListener("click",()=>A.openCheckout());
  $("lockLoginBtn")?.addEventListener("click",()=>openAuth("register"));
  $("freeAccountBtn")?.addEventListener("click",()=>openAuth("register"));
  document.querySelectorAll("[data-close=auth]").forEach(el=>el.addEventListener("click",closeAuth));
  document.querySelectorAll(".auth-tab").forEach(t=>t.addEventListener("click",()=>openAuth(t.dataset.auth)));
  $("authForm")?.addEventListener("submit",async e=>{
    e.preventDefault();
    const email=$("authEmail").value, pass=$("authPassword").value, name=$("authName")?.value;
    const isReg=$("authNameWrap")&&!$("authNameWrap").classList.contains("hidden");
    const err=$("authError");
    try{
      if(isReg) await A.register(email,pass,name);
      else await A.login(email,pass);
      err?.classList.add("hidden");
      closeAuth(); refreshPlanUI();
      if(CURRENT_ANALYSIS) renderAnalysis(CURRENT_ANALYSIS);
    }catch(ex){
      if(err){err.textContent=ex.message||String(ex);err.classList.remove("hidden")}
    }
  });
  $("authLogout")?.addEventListener("click",()=>{A.logout();refreshPlanUI();closeAuth()});
  window.addEventListener("rdb:premium",()=>{refreshPlanUI();if(CURRENT_ANALYSIS)renderAnalysis(CURRENT_ANALYSIS)});
  window.addEventListener("rdb:auth",refreshPlanUI);
}

async function getStandings(){
  const j=await api("api-web.nhle.com/v1/standings/now");
  return j.standings||[];
}
async function renderStandings(){
  const el=$("standingsTable"); if(!el)return;
  el.innerHTML=`<div class="empty-inline">Chargement du classement…</div>`;
  try{
    const rows=await getStandings();
    if(!rows.length){el.innerHTML=`<div class="empty-inline">Classement indisponible (hors saison ou API).</div>`;return;}
    const asOf=rows[0]?.date||rows[0]?.standingsDate||"";
    const seasonNote=asOf&&String(asOf).startsWith("2026-0")&&Number(String(asOf).slice(5,7))<=4
      ? "Fin de saison 2025-26 (en attente du classement 2026-27)"
      : "Saison en cours (mis à jour automatiquement)";

    const DIV_ORDER = [
      {key:"Atlantic", label:"Atlantique", conf:"Est"},
      {key:"Metropolitan", label:"Métropolitaine", conf:"Est"},
      {key:"Central", label:"Centrale", conf:"Ouest"},
      {key:"Pacific", label:"Pacifique", conf:"Ouest"},
    ];
    const byDiv = {};
    for(const x of rows){
      const d = x.divisionName || x.divisionAbbrev || "Autre";
      (byDiv[d] = byDiv[d] || []).push(x);
    }
    for(const k of Object.keys(byDiv)){
      byDiv[k].sort((a,b)=>(a.divisionSequence||99)-(b.divisionSequence||99) || (b.points||0)-(a.points||0));
    }

    function teamRow(x, rank){
      const abbr=(x.teamAbbrev?.default||x.teamAbbrev||"").toString().toUpperCase();
      const name=x.teamName?.default||x.teamCommonName?.default||abbr;
      return `<tr>
        <td>${rank}</td>
        <td class="pname">${logoHTML(abbr,"team-logo-sm")} <span class="code">${abbr}</span> ${name}</td>
        <td>${x.gamesPlayed??"—"}</td><td>${x.wins??"—"}</td><td>${x.losses??"—"}</td><td>${x.otLosses??"—"}</td>
        <td><b>${x.points??"—"}</b></td><td>${x.goalFor??"—"}</td><td>${x.goalAgainst??"—"}</td>
        <td>${x.goalDifferential??"—"}</td>
      </tr>`;
    }
    function divTable(title, badge, list){
      if(!list||!list.length) return "";
      return `<div class="standings-div-card">
        <div class="standings-div-head"><span class="standings-div-badge">${badge}</span><h3>${title}</h3></div>
        <table class="props-table standings-table"><thead><tr>
          <th>#</th><th>Équipe</th><th>MJ</th><th>V</th><th>D</th><th>DP</th><th>Pts</th><th>BP</th><th>BC</th><th>Diff</th>
        </tr></thead><tbody>${list.map((x,i)=>teamRow(x,i+1)).join("")}</tbody></table>
      </div>`;
    }

    // League overall
    const league=[...rows].sort((a,b)=>(a.leagueSequence||99)-(b.leagueSequence||99));
    let html=`<p class="muted" style="margin-bottom:12px">${seasonNote}${asOf?` · au ${asOf}`:""}</p>`;
    html+=`<div class="standings-tabs">
      <button type="button" class="day-btn standings-mode active" data-mode="div">Par division</button>
      <button type="button" class="day-btn standings-mode" data-mode="league">Ligue entière</button>
    </div>`;
    html+=`<div id="standingsDivView" class="standings-div-grid">`;
    for(const d of DIV_ORDER){
      const list = byDiv[d.key] || byDiv[d.label] || [];
      // also match by abbrev heuristics
      if(!list.length){
        for(const [k,v] of Object.entries(byDiv)){
          if(k.toLowerCase().includes(d.key.toLowerCase().slice(0,4))) { list.push(...v); }
        }
      }
      html+=divTable(d.label, d.conf, list.length?list:(byDiv[d.key]||[]));
    }
    // leftover divisions
    const used=new Set(DIV_ORDER.map(d=>d.key));
    for(const [k,v] of Object.entries(byDiv)){
      if([...used].some(u=>k.toLowerCase().includes(u.toLowerCase().slice(0,4)))) continue;
      html+=divTable(k, "—", v);
    }
    html+=`</div>`;
    html+=`<div id="standingsLeagueView" class="hidden">
      <table class="props-table standings-table"><thead><tr>
        <th>#</th><th>Équipe</th><th>MJ</th><th>V</th><th>D</th><th>DP</th><th>Pts</th><th>BP</th><th>BC</th><th>Diff</th><th>Conf</th><th>Div</th>
      </tr></thead><tbody>${league.map((x,i)=>{
        const abbr=(x.teamAbbrev?.default||x.teamAbbrev||"").toString().toUpperCase();
        const name=x.teamName?.default||x.teamCommonName?.default||abbr;
        return `<tr>
          <td>${x.leagueSequence||(i+1)}</td>
          <td class="pname">${logoHTML(abbr,"team-logo-sm")} <span class="code">${abbr}</span> ${name}</td>
          <td>${x.gamesPlayed??"—"}</td><td>${x.wins??"—"}</td><td>${x.losses??"—"}</td><td>${x.otLosses??"—"}</td>
          <td><b>${x.points??"—"}</b></td><td>${x.goalFor??"—"}</td><td>${x.goalAgainst??"—"}</td>
          <td>${x.goalDifferential??"—"}</td><td>${x.conferenceAbbrev||"—"}</td><td>${x.divisionAbbrev||"—"}</td>
        </tr>`;
      }).join("")}</tbody></table>
    </div>`;
    el.innerHTML=html;
    el.querySelectorAll(".standings-mode").forEach(btn=>{
      btn.onclick=()=>{
        el.querySelectorAll(".standings-mode").forEach(b=>b.classList.remove("active"));
        btn.classList.add("active");
        const mode=btn.dataset.mode;
        const divV=$("standingsDivView"), legV=$("standingsLeagueView");
        if(mode==="div"){divV?.classList.remove("hidden");legV?.classList.add("hidden");}
        else{divV?.classList.add("hidden");legV?.classList.remove("hidden");}
      };
    });
  }catch(e){el.innerHTML=`<div class="empty-inline">Classement indisponible : ${e.message||e}</div>`}
}

let LEADERS_CACHE=null;
let LEADERS_STREAK={}; // id -> {goals:[0/1], assists, points} last 5 (oldest->newest or newest first)

async function enrichTeamsFromLeadersAPI(rows){
  try{
    const cats=["points","goals","assists"];
    for(const cat of cats){
      const j=await api(`api-web.nhle.com/v1/skater-stats-leaders/current?categories=${cat}&limit=100`);
      const list=j[cat]||[];
      for(const p of list){
        const id=String(p.id||p.playerId||"");
        const tm=String(p.teamAbbrev||"").toUpperCase();
        if(!id||!tm) continue;
        const row=rows.find(r=>r.id===id) || rows.find(r=>norm(r.name)===norm(`${p.firstName?.default||p.firstName||""} ${p.lastName?.default||p.lastName||""}`));
        if(row && !row.team) row.team=tm;
        else if(row) row.team=row.team||tm;
      }
    }
  }catch(e){ console.warn("enrich teams", e); }
  return rows;
}

const STREAK_LS_KEY="rdb_streaks_v1";
function loadStreakCache(){
  try{
    const o=JSON.parse(localStorage.getItem(STREAK_LS_KEY)||"{}");
    if(o && o.at && Date.now()-o.at < 6*3600*1000 && o.map) return o.map;
  }catch(_){}
  return {};
}
function saveStreakCache(){
  try{ localStorage.setItem(STREAK_LS_KEY, JSON.stringify({at:Date.now(), map:LEADERS_STREAK})); }catch(_){}
}
// hydrate memory from LS once
try{ Object.assign(LEADERS_STREAK, loadStreakCache()); }catch(_){}

async function fetchPlayerStreak(playerId){
  if(!playerId) return null;
  if(LEADERS_STREAK[playerId] && LEADERS_STREAK[playerId].points) return LEADERS_STREAK[playerId];
  try{
    let j=await api(`api-web.nhle.com/v1/player/${playerId}/game-log/${CURRENT}/2`);
    let gl=j.gameLog||[];
    if(gl.length<3){
      j=await api(`api-web.nhle.com/v1/player/${playerId}/game-log/${BASE}/2`);
      gl=j.gameLog||[];
    }
    const last5=gl.slice(0,5);
    const streak={
      goals: last5.map(g=>n(g.goals)>0?1:0),
      assists: last5.map(g=>n(g.assists)>0?1:0),
      points: last5.map(g=>n(g.points)>0?1:0),
      team: last5[0]?String(last5[0].teamAbbrev||"").toUpperCase():""
    };
    LEADERS_STREAK[playerId]=streak;
    saveStreakCache();
    return streak;
  }catch(_){
    return {goals:[],assists:[],points:[],team:""};
  }
}

function streakDots(arr){
  if(!arr||!arr.length) return `<span class="streak-dots muted">—</span>`;
  // show chronological left=oldest of the 5, right=most recent
  const ordered=[...arr].reverse();
  return `<span class="streak-dots" title="5 derniers matchs (gauche→droite = plus récent à droite)">${ordered.map(v=>
    `<i class="streak-dot ${v? "hit":"miss"}"></i>`
  ).join("")}</span>`;
}

async function renderLeaders(sortKey="points"){
  const el=$("leadersTable"); if(!el)return;
  el.innerHTML=`<div class="empty-inline">Chargement du classement joueurs…</div>`;
  try{
    const st = LEADERS_CACHE || await getSkaters();
    LEADERS_CACHE = st;
    if(st.rows.some(r=>!r.team)) await enrichTeamsFromLeadersAPI(st.rows);

    const keyMap={points:"points",goals:"goals",assists:"assists",shots:"shots",toi:"toi"};
    const k=keyMap[sortKey]||"points";
    const rows=[...st.rows].filter(x=>x.gp>=1).sort((a,b)=> (k==="toi"?toiMinutes(b.toi)-toiMinutes(a.toi):b[k]-a[k])).slice(0,50);

    const needStreak = ["points","goals","assists"].includes(k);
    const streakKey = k==="goals"?"goals":k==="assists"?"assists":"points";
    const streakHeader = needStreak ? `<th>Série 5</th>` : "";
    // Affiche d'abord le tableau (rapide), séries en lazy-load
    el.innerHTML=`<table class="props-table leaders-table"><thead><tr>
      <th>#</th><th>Joueur</th><th>Équipe</th><th>Pos</th><th>MJ</th><th>B</th><th>A</th><th>Pts</th><th>Tirs</th><th>TOI/M</th>${streakHeader}
    </tr></thead><tbody>${rows.map((x,i)=>{
      const tm=x.team||"";
      const cached = needStreak ? LEADERS_STREAK[x.id]?.[streakKey] : null;
      const dots = needStreak ? `<td class="streak-cell" data-pid="${x.id}">${cached?streakDots(cached):`<span class="streak-dots muted">…</span>`}</td>` : "";
      return `<tr>
      <td>${i+1}</td>
      <td class="pname">${x.name}</td>
      <td class="team-cell">${tm?logoHTML(tm,"team-logo-sm"):""} <span class="code">${tm||"—"}</span></td>
      <td>${x.position||"—"}</td><td>${x.gp}</td>
      <td>${x.goals}</td><td>${x.assists}</td><td><b>${x.points}</b></td>
      <td>${x.shots}</td><td>${toiFmt(x.toi)}</td>${dots}
    </tr>`;
    }).join("")}</tbody></table>
    ${needStreak?`<p class="muted" style="margin-top:10px;font-size:11px">Série 5 : <span style="color:#00e676">vert</span> = ≥1 ${k==="goals"?"but":k==="assists"?"passe":"point"} · <span style="color:#ff5263">rouge</span> = 0 (droite = plus récent).</p>`:""}`;

    if(needStreak){
      // Lazy : par paquets de 8 pour ne pas bloquer l'UI
      const ids=rows.slice(0,40).map(r=>r.id).filter(Boolean);
      (async()=>{
        for(let i=0;i<ids.length;i+=8){
          const chunk=ids.slice(i,i+8);
          await Promise.all(chunk.map(async id=>{
            const s=await fetchPlayerStreak(id);
            const cell=el.querySelector(`.streak-cell[data-pid="${id}"]`);
            if(cell) cell.innerHTML=streakDots(s?.[streakKey]);
            const row=rows.find(r=>r.id===id);
            if(row && s?.team && !row.team){
              row.team=s.team;
              const tc=cell?.parentElement?.querySelector(".team-cell");
              if(tc) tc.innerHTML=`${logoHTML(s.team,"team-logo-sm")} <span class="code">${s.team}</span>`;
            }
          }));
        }
      })();
    }
  }catch(e){el.innerHTML=`<div class="empty-inline">Classement joueurs indisponible : ${e.message||e}</div>`}
}


let INJURY_CACHE=null, INJURY_FILTER="all";

async function ensureInjuryCache(){
  if(INJURY_CACHE) return INJURY_CACHE;
  try{
    const r=await fetch("/api?injuries=1",{cache:"no-store"});
    INJURY_CACHE=await r.json();
  }catch(e){ INJURY_CACHE={teams:[],error:String(e)}; }
  return INJURY_CACHE;
}
function injuriesForTeams(home, away){
  const teams=INJURY_CACHE?.teams||[];
  function matchTeam(abbr){
    const a=String(abbr||"").toUpperCase();
    const full=(TEAMS[a]?.[0]||"").toLowerCase();
    return teams.filter(t=>{
      const n=(t.name||"").toLowerCase();
      const ab=(t.abbrev||t.abbreviation||"").toUpperCase();
      if(ab===a) return true;
      if(full && n.includes(full.split(" ").pop())) return true;
      // ESPN often uses full name
      if(a==="ANA" && n.includes("ducks")) return true;
      if(a==="VGK" && (n.includes("golden")||n.includes("vegas"))) return true;
      if(a==="UTA" && (n.includes("utah")||n.includes("mammoth"))) return true;
      return false;
    });
  }
  const out=[];
  for(const side of [home, away]){
    for(const t of matchTeam(side)){
      for(const x of (t.injuries||[])){
        out.push({team:side, teamName:t.name, ...x});
      }
    }
  }
  return out;
}
function renderMatchInjuries(home, away){
  const el=$("matchInjuriesBox");
  if(!el) return;
  const list=injuriesForTeams(home, away);
  if(!list.length){
    el.innerHTML=`<div class="match-injuries empty-inline">Aucune blessure signalée pour ${home} / ${away} (source ESPN).</div>`;
    return;
  }
  const by={};
  for(const x of list){ (by[x.team]=by[x.team]||[]).push(x); }
  let html=`<div class="section-title" style="border:0;padding:0 0 10px"><span>🏥</span> Blessures du match <small class="muted">${list.length}</small></div>`;
  html+=`<div class="match-injuries-grid">`;
  for(const side of [away, home]){
    const rows=by[side]||[];
    html+=`<div class="match-injury-side"><div class="match-injury-label">${logoHTML(side,"team-logo-sm")} ${side}</div>`;
    if(!rows.length) html+=`<p class="muted" style="font-size:12px;margin:6px 0">—</p>`;
    else html+=rows.map(x=>`<div class="match-injury-row">
      <div><b>${x.name}</b><small>${x.position||""}${x.type?` · ${x.type}`:""}</small></div>
      <span class="injury-status status-${(x.status||"").toLowerCase().replace(/\s+/g,"-")}">${x.status||"—"}</span>
    </div>`).join("");
    html+=`</div>`;
  }
  html+=`</div>`;
  el.innerHTML=html;
}

async function loadInjuries(force=false){
  const el=$("injuriesFeed"); if(!el)return;
  el.innerHTML=`<div class="empty-inline">Chargement des blessures…</div>`;
  try{
    if(!INJURY_CACHE || force){
      const r=await fetch("/api?injuries=1",{cache:"no-store"});
      INJURY_CACHE=await r.json();
    }
    renderInjuries();
  }catch(e){
    el.innerHTML=`<div class="empty-inline">Impossible de charger les blessures (${e.message||e}).</div>`;
  }
}
function renderInjuries(){
  const el=$("injuriesFeed"); if(!el||!INJURY_CACHE)return;
  const teams=INJURY_CACHE.teams||[];
  const f=INJURY_FILTER;
  let html="";
  let total=0;
  for(const t of teams){
    const list=(t.injuries||[]).filter(x=>{
      if(f==="all")return true;
      const st=(x.status||"").toLowerCase();
      if(f==="Out")return st.includes("out");
      if(f==="Day-To-Day")return st.includes("day");
      if(f==="IR")return st.includes("ir")||st.includes("injured reserve");
      return true;
    });
    if(!list.length)continue;
    total+=list.length;
    html+=`<div class="injury-team"><h3>${t.name} <small>${list.length}</small></h3>
      <div class="injury-list">${list.map(x=>`
        <div class="injury-row">
          <div class="injury-player">
            <b>${x.name}</b>
            <small>${x.position||"—"}${x.type?` · ${x.type}`:""}</small>
          </div>
          <span class="injury-status status-${(x.status||"").toLowerCase().replace(/\s+/g,"-")}">${x.status||"—"}</span>
          <div class="injury-meta">
            ${x.returnDate?`<span>Retour estimé : ${x.returnDate}</span>`:""}
            ${x.comment?`<p>${x.comment}</p>`:""}
          </div>
        </div>`).join("")}</div></div>`;
  }
  if(!html){
    el.innerHTML=`<div class="empty-inline">Aucune blessure pour ce filtre.${INJURY_CACHE.error?`<br><small>${INJURY_CACHE.error}</small>`:""}</div>`;
    return;
  }
  const head=`<div class="muted" style="margin-bottom:12px">${total} joueur(s) · maj ${INJURY_CACHE.updated?new Date(INJURY_CACHE.updated).toLocaleString("fr-FR"):"—"} · ${INJURY_CACHE.source||"ESPN"}</div>`;
  el.innerHTML=head+html;
}

function syncAnalyzeSticky(){
  const active = document.querySelector(".nav-btn.active");
  const view = active?.dataset?.view || "analyse";
  document.body.classList.toggle("show-analyze-sticky", view === "analyse");
}
function setup(){
  $("heroAnalyzeBtn")&&($("heroAnalyzeBtn").onclick=()=>$("analyzeBtn")?.scrollIntoView({behavior:"smooth",block:"center"}));
  $("heroAccountBtn")&&($("heroAccountBtn").onclick=()=>$("authChip")?.click());
  populateTeams();$("homeTeam").onchange=updateTeamMeta;$("awayTeam").onchange=updateTeamMeta;$("analyzeBtn").onclick=runAnalysis;
  $("analyzeBtnSticky")&&($("analyzeBtnSticky").onclick=()=>$("analyzeBtn")?.click());
  // Premium button also in topbar-right
  document.getElementById("navPremium")?.addEventListener("click", ()=>setTimeout(syncAnalyzeSticky,0));
  syncAnalyzeSticky();
  

/* ═══ Kombos du jour — proba modèle + cotes bookmakers ═══ */
function fairOdds(p){ p=clamp(p,.02,.95); return (1/p); }
function fmtOdds(o){ if(!Number.isFinite(o)) return "—"; return o>=10?o.toFixed(2):o.toFixed(2); }
function normPlayer(s){
  return String(s||"").toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .replace(/[^a-z0-9 ]/g," ").replace(/\s+/g," ").trim();
}
function lastName(s){
  const p=normPlayer(s).split(" ");
  return p[p.length-1]||"";
}
/** Meilleure cote décimale (Yes / Over 0.5) pour un joueur dans bookmakers Odds API */
function bestBookOddsForPlayer(bookmakers, marketKeys, playerName){
  if(!bookmakers||!playerName) return null;
  const target=normPlayer(playerName);
  const ln=lastName(playerName);
  let best=null, book=null, market=null;
  for(const b of bookmakers){
    for(const m of (b.markets||[])){
      if(marketKeys && !marketKeys.includes(m.key)) continue;
      for(const o of (m.outcomes||[])){
        const desc=normPlayer(o.description||"");
        const name=normPlayer(o.name||"");
        const price=Number(o.price);
        if(!Number.isFinite(price)||price<1.01) continue;
        // Anytime goalscorer: name=Yes, description=Player
        // Points O/U: name=Over, description=Player, point=0.5
        const isPlayer = desc===target || name===target || (desc.includes(ln)&&ln.length>3) || (name.includes(ln)&&ln.length>3);
        if(!isPlayer) continue;
        const isYes = /^(yes|over)$/i.test(o.name||"") || m.key==="player_goal_scorer_anytime";
        const point = o.point!=null ? Number(o.point) : null;
        if(m.key.includes("player_") && point!=null && point>0.5 && !/goal_scorer/.test(m.key)) continue; // only 0.5 lines
        if(m.key==="player_goal_scorer_anytime" && !/^yes$/i.test(o.name||"") && o.name!==o.description){
          // some books: name is player
        }
        if(!best || price>best){ best=price; book=b.title||b.key; market=m.key; }
      }
    }
  }
  return best?{odds:best, book, market}:null;
}
function bestTeamMarketOdds(bookmakers, marketKey, outcomeName){
  if(!bookmakers) return null;
  const t=normPlayer(outcomeName);
  let best=null, book=null;
  for(const b of bookmakers){
    for(const m of (b.markets||[])){
      if(m.key!==marketKey) continue;
      for(const o of (m.outcomes||[])){
        if(normPlayer(o.name)!==t && !(marketKey==="totals" && normPlayer(o.name)===normPlayer(outcomeName))) continue;
        const price=Number(o.price);
        if(Number.isFinite(price)&&price>1.01 && (!best||price>best)){ best=price; book=b.title||b.key; }
      }
    }
  }
  // totals: outcomeName like "Over 5.5"
  if(marketKey==="totals" && !best){
    const m2=String(outcomeName||"").match(/(over|under)\s*([\d.]+)/i);
    if(m2){
      const side=m2[1].toLowerCase(), line=Number(m2[2]);
      for(const b of bookmakers){
        for(const m of (b.markets||[])){
          if(m.key!=="totals") continue;
          for(const o of (m.outcomes||[])){
            if(normPlayer(o.name)!==side) continue;
            if(o.point!=null && Math.abs(Number(o.point)-line)>0.01) continue;
            const price=Number(o.price);
            if(Number.isFinite(price)&&price>1.01&&(!best||price>best)){best=price;book=b.title||b.key;}
          }
        }
      }
    }
  }
  return best?{odds:best,book}:null;
}

async function fetchOddsEvents(){
  try{
    const r=await fetch("/odds?mode=events&regions=eu,uk,us");
    if(!r.ok) return {events:[], error: (await r.json().catch(()=>({}))).error || r.status};
    return await r.json();
  }catch(e){ return {events:[], error:String(e)}; }
}
async function fetchEventProps(eventId){
  try{
    const markets="h2h,totals,player_goal_scorer_anytime,player_points,player_assists,player_goals";
    const r=await fetch(`/odds?mode=event&id=${encodeURIComponent(eventId)}&markets=${markets}&regions=eu,uk,us`);
    if(!r.ok) return null;
    const j=await r.json();
    return j.event||null;
  }catch(_){ return null; }
}

function matchEvent(events, home, away){
  const hn=normPlayer(TEAMS[home]?.[0]||home), an=normPlayer(TEAMS[away]?.[0]||away);
  for(const e of events||[]){
    const eh=normPlayer(e.home_team), ea=normPlayer(e.away_team);
    if((eh.includes(hn.split(" ").pop())||hn.includes(eh.split(" ").pop())) &&
       (ea.includes(an.split(" ").pop())||an.includes(ea.split(" ").pop()))) return e;
  }
  return null;
}

/** Construit un combiné : legs triés par proba modèle, cotes = bookmaker, cible ~targetOdds */
function buildValueCombo(pool, targetOdds, maxLegs){
  // pool items: {name,p,bookOdds,book,match,kind}
  const usable=pool.filter(x=>x.bookOdds>=1.4 && x.p>=0.08).sort((a,b)=>b.p-a.p);
  if(!usable.length){
    // fallback fair odds
    const fb=pool.filter(x=>x.p>=0.1).sort((a,b)=>b.p-a.p);
    if(!fb.length) return null;
    const withFair=fb.map(x=>({...x, bookOdds:x.bookOdds||fairOdds(x.p), book:x.book||"modèle"}));
    return buildValueCombo(withFair, targetOdds, maxLegs);
  }
  // Prefer single near target
  let bestSingle=null;
  for(const x of usable){
    const dist=Math.abs(x.bookOdds-targetOdds)/targetOdds;
    if(dist<=0.22 && (!bestSingle || x.p>bestSingle.p)) bestSingle={legs:[x], odds:x.bookOdds, score:x.p};
  }
  if(bestSingle && targetOdds<=3) return bestSingle;

  let best=null;
  const n=Math.min(usable.length, 24);
  // pairs
  for(let i=0;i<n;i++){
    for(let j=i+1;j<n;j++){
      const a=usable[i], b=usable[j];
      if(a.name===b.name) continue;
      // avoid same player different markets
      if(lastName(a.name)===lastName(b.name) && a.match===b.match) continue;
      const odds=a.bookOdds*b.bookOdds;
      const dist=Math.abs(odds-targetOdds)/targetOdds;
      const score=a.p+b.p - dist*0.15;
      if(dist>0.55) continue;
      if(!best || score>best.score) best={legs:[a,b], odds, score};
    }
  }
  // triples for higher targets
  if(maxLegs>=3){
    for(let i=0;i<Math.min(14,n);i++)
      for(let j=i+1;j<Math.min(14,n);j++)
        for(let k=j+1;k<Math.min(16,n);k++){
          const a=usable[i],b=usable[j],c=usable[k];
          if(new Set([lastName(a.name)+a.match,lastName(b.name)+b.match,lastName(c.name)+c.match]).size<3) continue;
          const odds=a.bookOdds*b.bookOdds*c.bookOdds;
          const dist=Math.abs(odds-targetOdds)/targetOdds;
          if(dist>0.5) continue;
          const score=a.p+b.p+c.p - dist*0.12;
          if(!best || score>best.score) best={legs:[a,b,c], odds, score};
        }
  }
  if(best) return best;
  if(bestSingle) return bestSingle;
  // closest product of top probs
  if(usable.length>=2){
    const a=usable[0],b=usable[1];
    return {legs:[a,b], odds:a.bookOdds*b.bookOdds, score:a.p+b.p};
  }
  return {legs:[usable[0]], odds:usable[0].bookOdds, score:usable[0].p};
}

function renderKombosPayload(el, dayKey, payload, oddsNote){
  if(!el||!payload) return;
  const {safe, kombo, mortal} = payload;
  function card(title, subtitle, color, pick){
    if(!pick||!pick.legs?.length){
      return `<div class="kombo-card ${color}"><div class="kombo-head"><h3>${title}</h3><span>${subtitle}</span></div>
        <p class="muted">Pas assez de données aujourd'hui pour cette suggestion.</p></div>`;
    }
    const legs=pick.legs.map(l=>{
      const why = l.why || (l.kind==="but"
        ? `Parmi les meilleures proba but du jour (${pct(l.p)})`
        : l.kind==="passe" || l.kind==="point"
          ? `Forte projection ${l.kind} (${pct(l.p)})`
          : l.kind==="team"
            ? `Edge modèle match (${pct(l.p)})`
            : `Proba modèle ${pct(l.p)}`);
      return `<li>
      <b>${l.name}</b>
      <small>${l.match||""} · cote book <b>${fmtOdds(l.bookOdds)}</b>${l.book?` (${l.book})`:""}${l.isBook?"":" · estimée"}</small>
      <em class="kombo-why">Pourquoi : ${why}</em>
    </li>`;
    }).join("");
    const mode=pick.legs.length===1?"Simple":`Combiné ${pick.legs.length} sélections`;
    const allBook=pick.legs.every(l=>l.isBook);
    return `<div class="kombo-card ${color}">
      <div class="kombo-head"><h3>${title}</h3><span>${subtitle}</span></div>
      <div class="kombo-odds">Cote combinée ${allBook?"bookmakers":"indicative"} <b>~${fmtOdds(pick.odds)}</b> <em>${mode}</em></div>
      <ul class="kombo-legs">${legs}</ul>
      <p class="kombo-disc">Sélections = meilleures probas modèle BETZONE · cotes = bookmakers quand disponibles. Suggestions uniquement, pas un conseil de pari.</p>
    </div>`;
  }
  const html=`<p class="muted" style="margin-bottom:12px">${oddsNote||"Cotes bookmakers actives"}<br>Suggestions du <b>${dayKey}</b> · <span class="kombo-once">1 calcul / jour pour tous les membres</span></p>
    <div class="kombo-grid">
      ${card("🟢 Safe","Cote book ~2", "k-safe", safe)}
      ${card("🔵 Kombo","Points / passes · cote book ~5", "k-kombo", kombo)}
      ${card("🔴 Mortal Kombo","Meilleurs buteurs · cote book ~10", "k-mortal", mortal)}
    </div>`;
  el.innerHTML=html;
}

async function loadKombos(force){
  const el=$("kombosBox"); if(!el) return;
  const dayKey = new Date().toISOString().slice(0,10);

  // 1) Résultat partagé du jour (tous les membres)
  if(!force){
    try{
      const r=await fetch("/kombos-daily");
      if(r.ok){
        const j=await r.json();
        if(j.ok && j.payload){
          renderKombosPayload(el, j.date||dayKey, j.payload, "Cotes bookmakers actives");
          return;
        }
      }
    }catch(_){}
  } else {
    // force ignoré : toujours 1 calcul / jour
    try{
      const r=await fetch("/kombos-daily");
      if(r.ok){
        const j=await r.json();
        if(j.ok && j.payload){
          renderKombosPayload(el, j.date||dayKey, j.payload, "Cotes bookmakers actives · déjà calculé aujourd'hui");
          return;
        }
      }
    }catch(_){}
  }

  el.innerHTML=`<div class="empty-inline">Calcul du jour en cours (1× pour tous les membres)…</div>`;
  try{
    const oddsPack=await fetchOddsEvents();
    const oddsEvents=oddsPack.events||[];
    const oddsNote=oddsPack.error
      ? `Cotes bookmakers temporairement en secours (modèle).`
      : `Cotes bookmakers actives`;
    if(oddsPack.remaining!=null) console.info("[odds] remaining", oddsPack.remaining);

    const j=await api(`api-web.nhle.com/v1/schedule/${dayKey}`);
    let games=[];
    for(const d of (j.gameWeek||[])){
      if(d.date===dayKey || !games.length) games=games.concat(d.games||[]);
    }
    games=(games||[]).filter(g=>{
      const st=g.gameState||"";
      return ["FUT","PRE","LIVE","OFF","CRIT"].includes(st) || !st;
    }).slice(0,10);
    if(!games.length){
      el.innerHTML=`<div class="empty-inline">Aucun match planifié aujourd'hui pour générer des Kombos.</div>`;
      return;
    }

    const candidates={safe:[],kombo:[],mortal:[]};
    const propsCache={};

    for(const g of games.slice(0,8)){
      const home=(g.homeTeam?.abbrev||"").toUpperCase();
      const away=(g.awayTeam?.abbrev||"").toUpperCase();
      if(!home||!away||!TEAMS[home]||!TEAMS[away]) continue;
      try{
        const d=await analyze(home,away);
        const match=`${away} @ ${home}`;
        const ev=matchEvent(oddsEvents, home, away);
        let books=ev?.bookmakers||[];
        // fetch player props per event (limited)
        if(ev?.id && !propsCache[ev.id]){
          const full=await fetchEventProps(ev.id);
          propsCache[ev.id]=full;
          if(full?.bookmakers) books=full.bookmakers;
        } else if(ev?.id && propsCache[ev.id]?.bookmakers){
          books=propsCache[ev.id].bookmakers;
        }

        // SAFE — team markets with book odds
        const safeMk=[
          {name:`${home} vainqueur`, p:d.m.home, market:"h2h", outcome:TEAMS[home][0]},
          {name:`${away} vainqueur`, p:d.m.away, market:"h2h", outcome:TEAMS[away][0]},
          {name:`Over 5.5 buts`, p:d.m.o55, market:"totals", outcome:"Over 5.5"},
          {name:`Under 5.5 buts`, p:d.m.u55, market:"totals", outcome:"Under 5.5"},
          {name:`Over 4.5 buts`, p:d.m.o45, market:"totals", outcome:"Over 4.5"},
        ];
        for(const x of safeMk){
          const bk=bestTeamMarketOdds(books, x.market, x.outcome);
          candidates.safe.push({
            name:x.name, p:x.p, match, kind:"team",
            bookOdds: bk?.odds || fairOdds(x.p),
            book: bk?.book || "modèle",
            isBook: !!bk,
            why:`Probabilité modèle ${pct(x.p)} sur ${match}`
          });
        }

        // Players — rank by model prob, attach book odds
        const pls=d.players?.players||[];
        for(const p of pls.slice(0,14)){
          const gBk=bestBookOddsForPlayer(books, ["player_goal_scorer_anytime","player_goals"], p.name);
          const ptBk=bestBookOddsForPlayer(books, ["player_points"], p.name);
          const aBk=bestBookOddsForPlayer(books, ["player_assists"], p.name);

          candidates.mortal.push({
            name:`${p.name} (${p.team}) · 1+ but`,
            p:p.pg, match, kind:"but",
            bookOdds: gBk?.odds || fairOdds(p.pg),
            book: gBk?.book || "modèle",
            isBook: !!gBk,
            why:`Top proba but sur ${match} (${pct(p.pg)})`
          });
          candidates.kombo.push({
            name:`${p.name} (${p.team}) · 1+ point`,
            p:p.pp, match, kind:"point",
            bookOdds: ptBk?.odds || fairOdds(p.pp),
            book: ptBk?.book || "modèle",
            isBook: !!ptBk,
            why:`Projection points élevée (${pct(p.pp)})`
          });
          candidates.kombo.push({
            name:`${p.name} (${p.team}) · 1+ passe`,
            p:p.pa, match, kind:"passe",
            bookOdds: aBk?.odds || fairOdds(p.pa),
            book: aBk?.book || "modèle",
            isBook: !!aBk,
            why:`Projection passes (${pct(p.pa)})`
          });
        }
      }catch(e){ console.warn("kombo analyze",home,away,e); }
    }

    // Mortal: prioritize highest goal probs with real book odds
    candidates.mortal.sort((a,b)=>(b.isBook-a.isBook)|| (b.p-a.p));
    candidates.kombo.sort((a,b)=>(b.isBook-a.isBook)|| (b.p-a.p));
    candidates.safe.sort((a,b)=>(b.isBook-a.isBook)|| (b.p-a.p));

    const safe = buildValueCombo(candidates.safe, 2.0, 2);
    const kombo = buildValueCombo(candidates.kombo, 5.0, 3);
    const mortal = buildValueCombo(candidates.mortal, 10.0, 3);

    function card(title, subtitle, color, pick){
      if(!pick||!pick.legs?.length){
        return `<div class="kombo-card ${color}"><div class="kombo-head"><h3>${title}</h3><span>${subtitle}</span></div>
          <p class="muted">Pas assez de données aujourd'hui pour cette suggestion.</p></div>`;
      }
      const legs=pick.legs.map(l=>`<li>
        <b>${l.name}</b>
        <small>${l.match||""} · proba modèle ${pct(l.p)} · cote book <b>${fmtOdds(l.bookOdds)}</b>${l.book?` (${l.book})`:""}${l.isBook?"":" · estimée"}</small>
      </li>`).join("");
      const mode=pick.legs.length===1?"Simple":`Combiné ${pick.legs.length} sélections`;
      const allBook=pick.legs.every(l=>l.isBook);
      return `<div class="kombo-card ${color}">
        <div class="kombo-head"><h3>${title}</h3><span>${subtitle}</span></div>
        <div class="kombo-odds">Cote combinée ${allBook?"bookmakers":"indicative"} <b>~${fmtOdds(pick.odds)}</b> <em>${mode}</em></div>
        <ul class="kombo-legs">${legs}</ul>
        <p class="kombo-disc">Sélections = meilleures probas modèle BETZONE · cotes = bookmakers quand disponibles. Suggestions uniquement, pas un conseil de pari.</p>
      </div>`;
    }

    const payload = { safe, kombo, mortal };
    // Publier pour tous les membres (1er calcul du jour gagne)
    try{
      await fetch("/kombos-daily", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload }),
      });
    }catch(_){}
    // Re-fetch au cas où un autre membre a publié en premier
    try{
      const r2=await fetch("/kombos-daily");
      if(r2.ok){
        const j2=await r2.json();
        if(j2.ok && j2.payload){
          renderKombosPayload(el, j2.date||dayKey, j2.payload, oddsNote);
          return;
        }
      }
    }catch(_){}
    renderKombosPayload(el, dayKey, payload, oddsNote);
  }catch(e){
    el.innerHTML=`<div class="empty-inline">Kombos indisponibles (${e.message||e}).</div>`;
  }
}


document.querySelectorAll(".nav-btn").forEach(b=>b.onclick=()=>{document.querySelectorAll(".nav-btn").forEach(x=>x.classList.remove("active"));b.classList.add("active");document.querySelectorAll(".view").forEach(x=>x.classList.remove("active"));const v=$(`view-${b.dataset.view}`); if(v)v.classList.add("active");
    syncAnalyzeSticky();if(b.dataset.view==="matchs")schedule(0);if(b.dataset.view==="equipes")renderTeamTable();if(b.dataset.view==="actu")loadNews();if(b.dataset.view==="classement")renderStandings();if(b.dataset.view==="leaders")renderLeaders("points");if(b.dataset.view==="blessures")loadInjuries();if(b.dataset.view==="historique")renderHistory();if(b.dataset.view==="forum"){window.RDB_FORUM?.setup?.();window.RDB_FORUM?.refresh?.()}if(b.dataset.view==="kombos")loadKombos()});
  document.querySelectorAll(".tab").forEach(b=>b.onclick=()=>{document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));b.classList.add("active");renderPlayers(b.dataset.prop)});
  document.querySelectorAll(".day-btn").forEach(b=>b.onclick=()=>{document.querySelectorAll(".day-btn").forEach(x=>x.classList.remove("active"));b.classList.add("active");schedule(Number(b.dataset.days))});
  $("applyPromoHint")&&($("applyPromoHint").onclick=()=>alert("Code parrainage BETZONE\n\n• Le filleul saisit le code (ex. MEUTE5) avant de payer.\n• Réduction : −5 € (15 € au lieu de 20 €).\n• Les codes se créent dans Stripe → Produits → Coupons / Codes promo.\n• Tu peux aussi saisir le code directement sur la page de paiement Stripe."));$("shareAnalysisBtn")&&($("shareAnalysisBtn").onclick=()=>shareAnalysis());$("copyAnalysisBtn")&&($("copyAnalysisBtn").onclick=()=>copyAnalysis());$("refreshSchedule").onclick=()=>schedule(0);$("refreshNews")&&($("refreshNews").onclick=()=>loadNews());$("refreshStandings")&&($("refreshStandings").onclick=()=>renderStandings());$("refreshInjuries")&&($("refreshInjuries").onclick=()=>loadInjuries(true));document.querySelectorAll(".injury-filter").forEach(b=>b.onclick=()=>{document.querySelectorAll(".injury-filter").forEach(x=>x.classList.remove("active"));b.classList.add("active");INJURY_FILTER=b.dataset.filter;renderInjuries()});$("refreshLeaders")&&($("refreshLeaders").onclick=()=>renderLeaders("points"));document.querySelectorAll(".leader-sort").forEach(b=>b.onclick=()=>{document.querySelectorAll(".leader-sort").forEach(x=>x.classList.remove("active"));b.classList.add("active");renderLeaders(b.dataset.sort)});$("refreshTeams").onclick=()=>{TEAMS_CACHE=null;renderTeamTable()};
  $("clearHistory").onclick=clearHistory;
  renderHistory();
  setupAuthUI();
  $("apiStatus").textContent="NHL • prêt";
  getTeams().then(t=>{$("apiStatus").textContent=`NHL • ${Object.keys(t).length} équipes`}).catch(()=>{});
}
document.addEventListener("DOMContentLoaded",setup);
