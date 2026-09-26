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
    for(const [arr,pos] of [[j.forwards,"F"],[j.defensemen,"D"]]){
      for(const x of arr||[]){
        const name=pname(x.fullName||`${pname(x.firstName)} ${pname(x.lastName)}`).trim();if(name)players.push({id:String(x.id||x.playerId||""),name,position:pos,team});
      }
    }
    for(const x of j.goalies||[]){
      const name=pname(x.fullName||`${pname(x.firstName)} ${pname(x.lastName)}`).trim();if(name)goalies.push({id:String(x.id||x.playerId||""),name,position:"G",team});
    }
    return {players,goalies};
  }catch(e){return {players:[],goalies:[]}}
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
  return {home,away,h,a,l,fh,fa,bh,ba,gf,x,m,players,gh,ga,c,status,best:projectedScore(x.home,x.away)};
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
  // VALUE si proba modèle assez nette (sans cotes book — edge interne)
  return {
    "Victoire domicile OT": m.home >= 0.58,
    "Victoire extérieur OT": m.away >= 0.58,
    "Domicile 60 min": m.home60 >= 0.55,
    "Extérieur 60 min": m.away60 >= 0.55,
    "Nul 60 min": m.tie60 >= 0.22,
    "Over 4.5": m.o45 >= 0.58,
    "Over 5.5": m.o55 >= 0.55,
    "Under 5.5": m.u55 >= 0.55,
    "Over 6.5": m.o65 >= 0.52,
    "Under 6.5": m.u65 >= 0.55,
    "BTTS": m.btts >= 0.55
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
  if(A?.isPremium()){
    if(badge){badge.innerHTML=`<strong>PREMIUM</strong><span>Accès à vie</span>`;badge.classList.add("prem")}
    if(chip)chip.textContent=A.user?.name?`⭐ ${A.user.name}`:"⭐ Premium";
  }else if(A?.isLoggedIn()){
    if(badge){badge.innerHTML=`<strong>FREE</strong><span>1 analyse / jour</span>`;badge.classList.remove("prem")}
    if(chip)chip.textContent=A.user?.name||A.user?.email||"Compte";
  }else{
    if(badge){badge.innerHTML=`<strong>FREE</strong><span>1 analyse / jour</span>`;badge.classList.remove("prem")}
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
  const mk=[["Victoire domicile OT",d.m.home],["Victoire extérieur OT",d.m.away],["Domicile 60 min",d.m.home60],["Extérieur 60 min",d.m.away60],["Nul 60 min",d.m.tie60],["Over 4.5",d.m.o45],["Over 5.5",d.m.o55],["Under 5.5",d.m.u55],["Over 6.5",d.m.o65],["Under 6.5",d.m.u65],["BTTS",d.m.btts]];
  const valFlags=marketValueFlags(d.m);
  $("markets").innerHTML=mk.map(x=>{
    const isVal=!!valFlags[x[0]];
    return `<div class="market${isVal?" value":""}" title="${isVal?"Edge modèle détecté":""}">
      <div class="label">${x[0]}${isVal?` <span class="value-tag">VALUE</span>`:""}</div>
      <div class="value"><b>${pct(x[1])}</b><span class="fair">${fair(x[1])}</span></div>
    </div>`;
  }).join("");
  const sumEl=$("analysisSummary"); if(sumEl) sumEl.textContent=buildSummary(d);
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
    return `<div class="form-team"><h3>${logoHTML(x[1],"team-logo-sm")} ${x[1]}</h3>
      <div class="form-dots-row"><span class="form-dots-label">Forme</span><div class="form-dots">${dots}</div><span class="form-dots-score">${wins}V-${x[2].length-wins}D</span></div>
      <div class="stat-row"><span>Buts (moy.)</span><b>${fmt(gf)} pour · ${fmt(ga)} contre</b></div>
      <div class="stat-row"><span>B2B</span><b>${x[3].b2b?"OUI":"NON"}</b></div></div>`;
  }).join("");
  renderAdvanced(d);
  renderPlayers(CURRENT_PROP);renderAllProps();renderAudit();
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
    const cls=s.pct==null?"":s.pct>=0.55?"hit-good":s.pct>=0.48?"hit-mid":"hit-bad";
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
        <button class="ghost-btn analyze-small" data-home="${h}" data-away="${a}">Analyser</button>
      </div>`;
    }).join("");
    document.querySelectorAll(".analyze-small").forEach(b=>b.onclick=()=>{
      if(!b.dataset.home||!b.dataset.away)return;
      $("homeTeam").value=b.dataset.home;$("awayTeam").value=b.dataset.away;updateTeamMeta();
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
    rows.sort((a,b)=>(a.leagueSequence||99)-(b.leagueSequence||99));
    const asOf=rows[0]?.date||rows[0]?.standingsDate||"";
    const seasonNote=asOf&&String(asOf).startsWith("2026-0")&&Number(String(asOf).slice(5,7))<=4
      ? "Fin de saison 2025-26 (en attente du classement 2026-27)"
      : "Saison en cours (mis à jour automatiquement)";
    el.innerHTML=`<p class="muted" style="margin-bottom:8px">${seasonNote}${asOf?` · au ${asOf}`:""}</p><table class="props-table standings-table"><thead><tr>
      <th>#</th><th>Équipe</th><th>MJ</th><th>V</th><th>D</th><th>DP</th><th>Pts</th><th>BP</th><th>BC</th><th>Diff</th><th>Conf</th><th>Div</th>
    </tr></thead><tbody>${rows.map(x=>{
      const abbr=(x.teamAbbrev?.default||x.teamAbbrev||"").toString().toUpperCase();
      const name=x.teamName?.default||x.teamCommonName?.default||abbr;
      return `<tr>
        <td>${x.leagueSequence||"—"}</td>
        <td class="pname">${logoHTML(abbr,"team-logo-sm")} <span class="code">${abbr}</span> ${name}</td>
        <td>${x.gamesPlayed??"—"}</td><td>${x.wins??"—"}</td><td>${x.losses??"—"}</td><td>${x.otLosses??"—"}</td>
        <td><b>${x.points??"—"}</b></td><td>${x.goalFor??"—"}</td><td>${x.goalAgainst??"—"}</td>
        <td>${x.goalDifferential??"—"}</td><td>${x.conferenceAbbrev||"—"}</td><td>${x.divisionAbbrev||"—"}</td>
      </tr>`;
    }).join("")}</tbody></table>`;
  }catch(e){el.innerHTML=`<div class="empty-inline">Classement indisponible : ${e.message||e}</div>`}
}

let LEADERS_CACHE=null;
async function renderLeaders(sortKey="points"){
  const el=$("leadersTable"); if(!el)return;
  el.innerHTML=`<div class="empty-inline">Chargement du classement joueurs…</div>`;
  try{
    const st = LEADERS_CACHE || await getSkaters();
    LEADERS_CACHE = st;
    const keyMap={points:"points",goals:"goals",assists:"assists",shots:"shots",toi:"toi"};
    const k=keyMap[sortKey]||"points";
    const rows=[...st.rows].filter(x=>x.gp>=1).sort((a,b)=> (k==="toi"?toiMinutes(b.toi)-toiMinutes(a.toi):b[k]-a[k])).slice(0,50);
    el.innerHTML=`<table class="props-table"><thead><tr>
      <th>#</th><th>Joueur</th><th>Équipe</th><th>Pos</th><th>MJ</th><th>B</th><th>A</th><th>Pts</th><th>Tirs</th><th>TOI/M</th>
    </tr></thead><tbody>${rows.map((x,i)=>`<tr>
      <td>${i+1}</td><td class="pname">${x.name}</td>
      <td>${logoHTML(x.team,"team-logo-xs")} ${x.team||"—"}</td>
      <td>${x.position||"—"}</td><td>${x.gp}</td>
      <td>${x.goals}</td><td>${x.assists}</td><td><b>${x.points}</b></td>
      <td>${x.shots}</td><td>${toiFmt(x.toi)}</td>
    </tr>`).join("")}</tbody></table>`;
  }catch(e){el.innerHTML=`<div class="empty-inline">Classement joueurs indisponible : ${e.message||e}</div>`}
}


let INJURY_CACHE=null, INJURY_FILTER="all";
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

function setup(){
  populateTeams();$("homeTeam").onchange=updateTeamMeta;$("awayTeam").onchange=updateTeamMeta;$("analyzeBtn").onclick=runAnalysis;
  document.querySelectorAll(".nav-btn").forEach(b=>b.onclick=()=>{document.querySelectorAll(".nav-btn").forEach(x=>x.classList.remove("active"));b.classList.add("active");document.querySelectorAll(".view").forEach(x=>x.classList.remove("active"));const v=$(`view-${b.dataset.view}`); if(v)v.classList.add("active");if(b.dataset.view==="matchs")schedule(0);if(b.dataset.view==="equipes")renderTeamTable();if(b.dataset.view==="actu")loadNews();if(b.dataset.view==="classement")renderStandings();if(b.dataset.view==="leaders")renderLeaders("points");if(b.dataset.view==="blessures")loadInjuries();if(b.dataset.view==="historique")renderHistory()});
  document.querySelectorAll(".tab").forEach(b=>b.onclick=()=>{document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));b.classList.add("active");renderPlayers(b.dataset.prop)});
  document.querySelectorAll(".day-btn").forEach(b=>b.onclick=()=>{document.querySelectorAll(".day-btn").forEach(x=>x.classList.remove("active"));b.classList.add("active");schedule(Number(b.dataset.days))});
  $("shareAnalysisBtn")&&($("shareAnalysisBtn").onclick=()=>shareAnalysis());$("copyAnalysisBtn")&&($("copyAnalysisBtn").onclick=()=>copyAnalysis());$("refreshSchedule").onclick=()=>schedule(0);$("refreshNews")&&($("refreshNews").onclick=()=>loadNews());$("refreshStandings")&&($("refreshStandings").onclick=()=>renderStandings());$("refreshInjuries")&&($("refreshInjuries").onclick=()=>loadInjuries(true));document.querySelectorAll(".injury-filter").forEach(b=>b.onclick=()=>{document.querySelectorAll(".injury-filter").forEach(x=>x.classList.remove("active"));b.classList.add("active");INJURY_FILTER=b.dataset.filter;renderInjuries()});$("refreshLeaders")&&($("refreshLeaders").onclick=()=>renderLeaders("points"));document.querySelectorAll(".leader-sort").forEach(b=>b.onclick=()=>{document.querySelectorAll(".leader-sort").forEach(x=>x.classList.remove("active"));b.classList.add("active");renderLeaders(b.dataset.sort)});$("refreshTeams").onclick=()=>{TEAMS_CACHE=null;renderTeamTable()};
  $("clearHistory").onclick=clearHistory;
  renderHistory();
  setupAuthUI();
  $("apiStatus").textContent="NHL • prêt";
  getTeams().then(t=>{$("apiStatus").textContent=`NHL • ${Object.keys(t).length} équipes`}).catch(()=>{});
}
document.addEventListener("DOMContentLoaded",setup);
