const ÉQUIPES = {
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
  const u = new URL("/api", location.origin); u.searchParams.set("path", path);
  Objet.entrées(params).forEach(([k,v])=>u.searchParams.set(k,v));
  const key=u.toString(); if(cache.has(key))return cache.get(key);
  const r=await fetch(u); if(!r.ok)throw new Error(await r.text());
  const j = await r.json(); cache.set(key, j); return j;
};
const poisson=(l,k)=>{if(l<=0)return k===0?1:0;let ​​f=1;for(let i=2;i<=k;i++)f*=i;return Math.exp(-l)*Math.pow(l,k)/f};
const cdf=(l,k)=>{let s=0;for(let i=0;i<=k;i++)s+=poisson(l,i);return clamp(s,0,1)};
const over=(l,line)=>clamp(1-cdf(l,Math.floor(line)),0,1);

fonction peuplerÉquipes(){
  pour chaque id de ["homeTeam","awayTeam"]){
    const s=$(id); s.innerHTML=Object.keys(TEAMS).sort().map(c=>`<option value="${c}">${c} — ${TEAMS[c][0]}</option>`).join("");
  }
  $("homeTeam").value="EDM"; $("awayTeam").value="CHI"; updateTeamMeta();
}
fonction updateTeamMeta(){
  pour chaque constante [id,meta] de [["homeTeam","homeMeta"],["awayTeam","awayMeta"]]){
    const c=$(id).value; $(meta).textContent=`${TEAMS[c][1]} • ${TEAMS[c][2]}`;
  }
}
fonction asynchrone teamReport(rapport){
  const expr=`seasonId=${BASE} et gameTypeId=2`;
  const j=await api(`stats/rest/en/team/${report}`,{isAggregate:"false",isGame:"false",start:0,limit:-1,cayenneExp:expr});
  retourner j.data||[];
}
fonction teamCodeRow(r){
  const c=String(r.teamAbbrev||r.teamAbbreviation||r.teamCode||r.triCode||"").toUpperCase();
  si(ÉQUIPES[c])retourner c;
  const name=String(r.teamFullName||r.teamName||"").toLowerCase();
  return Object.keys(TEAMS).find(k=>TEAMS[k][0].toLowerCase()===name)||"";
}
fonction champ(r, noms){pour(const x de noms){si(r[x]!==undefined&&r[x]!==null&&r[x]!=="")return n(r[x])}return NaN}
fonction taux(r,per,total,gp){const p=field(r,per);if(Number.isFinite(p)&&p>0)return p;const t=field(r,total);return Number.isFinite(t)&&gp>0?t/gp:0}
fonction fusionParÉquipe(lignes){
  const out={};
  pour (const r de lignes){
    const c=teamCodeRow(r); if(!c)continue;
    out[c]=Object.assign(out[c]||{},r);
  }
  retour;
}
fonction parseTeamRows(summary,pcts,rt,pp,pk){
  const out={};
  const byS=mergeByTeam(summary),byP=mergeByTeam(pcts),byR=mergeByTeam(rt),byPP=mergeByTeam(pp),byPK=mergeByTeam(pk);
  pour(const c de Object.keys(TEAMS)){
    const r=byS[c]; if(!r)continue;
    const p=byP[c]||{},rt0=byR[c]||{},pp0=byPP[c]||{},pk0=byPK[c]||{};
    const gp=field(r,["gamesPlayed","gp","games"]);
    const gf=rate(r,["goalsForPerGame"],["goalsFor","gf"],gp);
    const ga=rate(r,["goalsAgainstPerGame"],["goalsAgainst","ga"],gp);
    const tirs=taux(r,["tirsPourParPartie","sogPourParPartie"],["tirsPour","tirs","sogPour"],gp);
    const sa=rate(r,["shotsAgainstPerGame","sogAgainstPerGame"],["shotsAgainst","sogAgainst"],gp);
    si(!(gp>0&&gf>0&&ga>0&&shots>0&&sa>0))continuer;
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
      équipe : c, gp, gf, ga, tirs, tirsContre : sa,
      sat:Number.isFinite(sat)?sat:.5,usat:Number.isFinite(usat)?usat:.5,
      pp:Number.isFinite(ppPct)?ppPct:.2,pk:Number.isFinite(pkPct)?pkPct:.8,
      fo:Number.isFinite(fo)?fo:.5,sh5:Number.isFinite(sh5)?sh5:.09,sv5:Number.isFinite(sv5)?sv5:.91,
      pdo:Number.isFinite(pdo)?pdo:1,zs:Number.isFinite(zs)?zs:.5,gfPct:Number.isFinite(gfPct)?gfPct:.5,
      hits:Number.isFinite(hits)?hits:15,blocks:Number.isFinite(blocks)?blocks:14,
      à emporter : Nombre.estFinition(à emporter) ? à emporter : 5, cadeaux : Nombre.estFinition(à donner) ? donner : 10,
      source : « Statistiques de la LNH 2025-26 + adv »
    };
  }
  retour;
}
soit TEAMS_CACHE=null, TEAMS_CACHE_TS=0;
const TEAMS_TTL=5*60*1000; // 5 min
fonction asynchrone getTeams(force=false){
  if(!force&&TEAMS_CACHE&&Date.now()-TEAMS_CACHE_TS<TEAMS_TTL)return TEAMS_CACHE;
  const [summary,pcts,rt,pp,pk]=await Promise.all([
    teamReport("summary"),teamReport("percentages"),teamReport("realtime"),
    teamReport("powerplay"),teamReport("penaltykill")
  ]);
  CACHE_ÉQUIPES=analyserTeamRows(résumé,pcts,rt,pp,pk);
  TEAMS_CACHE_TS=Date.now();
  renvoyer TEAMS_CACHE ;
}
fonction ligueDe(t){
  const vals=Object.values(t||{});
  si (vals.length<28) retourner {valide:false, équipes:vals.length};
  retour {
    valide:true, équipes:vals.length,
    gf:avg(vals.map(x=>x.gf)),ga:avg(vals.map(x=>x.ga)),
    tirs : moyenne(vals.map(x=>x.shots)), tirsContre : moyenne(vals.map(x=>x.shotsContre)),
    sat:avg(vals.map(x=>x.sat)),usat:avg(vals.map(x=>x.usat)),
    pp:avg(vals.map(x=>x.pp)),pk:avg(vals.map(x=>x.pk)),
    fo:avg(vals.map(x=>x.fo)),sh5:avg(vals.map(x=>x.sh5)),sv5:avg(vals.map(x=>x.sv5)),
    pdo:avg(vals.map(x=>x.pdo)),zs:avg(vals.map(x=>x.zs))
  };
}
fonction asynchrone ligue(){return ligueFrom(await getTeams());}
fonction asynchrone getForm(équipe){
  pour(const saison de [CURRENT,BASE]){
    essayer{
      const j=await api(`api-web.nhle.com/v1/club-schedule-season/${team}/${season}`);
      let games=(j.games||[]).filter(g=>g.gameType===2&&g.startTimeUTC&&new Date(g.startTimeUTC)<new Date());
      jeux.sort((a,b)=>new Date(b.startTimeUTC)-new Date(a.startTimeUTC));
      const out=[];
      for(const g of games.slice(0,5)){
        const x=await api(`api-web.nhle.com/v1/gamecenter/${g.id}/landing`);
        const h=x.homeTeam||{},a=x.awayTeam||{},home=h.abbrev===team,t=home?h:a,o=home?a:h;
        out.push({win:n(t.score)>n(o.score),gf:n(t.score),ga:n(o.score),shots:n(t.sog),shotsAgainst:n(o.sog),date:g.startTimeUTC});
      }
      si (out.length) retourner out ;
    }catch(e){}
  }
  retour [];
}
fonction asynchrone getB2B(équipe){
  essayer{
    const j=await api(`api-web.nhle.com/v1/club-schedule-season/${team}/${CURRENT}`);
    const gs=(j.games||[]).filter(g=>g.gameType===2&&g.startTimeUTC).sort((a,b)=>new Date(a.startTimeUTC)-new Date(b.startTimeUTC));
    const now = Date.now(); const idx = gs.findIndex(g => new Date(g.startTimeUTC) >= now);
    si (idx<1) retourner {b2b:false,restDays:null};
    const d=(new Date(gs[idx].startTimeUTC)-new Date(gs[idx-1].startTimeUTC))/86400000;
    renvoie {b2b:d<1.35,restDays:d};
  }catch(e){return {b2b:false,restDays:null}}
}
fonction asynchrone getGoalieFactors(){
  const expr=`seasonId=${BASE} et gameTypeId=2`;
  const j=await api("stats/rest/en/goalie/summary",{limit:-1,sort:"wins",cayenneExp:expr});
  const map={},all=[];
  pour(const x de j.data||[]){
    const tm=String(x.teamAbbrev||x.teamAbbreviation||x.teamCode||"").toUpperCase(),gp=n(x.gamesPlayed),sv=n(x.savePct);
    si(!TEAMS[tm]||gp<=0||!sv)continuer;
    map[tm]??={s:0,w:0};map[tm].s+=sv*Math.max(1,gp);map[tm].w+=Math.max(1,gp);
  }
  const f={};for(const [k,v] of Object.entries(map))f[k]={sv:clamp(vs/vw,.87,.94)};
  for(const v of Object.values(f))all.push(v.sv);
  f.leagueSV=avg(all)||.905;retourner f;
}
fonction asynchrone getSkaters(){
  const expr=`seasonId=${BASE} et gameTypeId=2`;
  const j=await api("stats/rest/en/skater/summary",{limit:-1,sort:"points",cayenneExp:expr});
  const rows=[],byId={},byName={};
  pour(const x de j.data||[]){
    const id=String(x.playerId||x.id||""),gp=n(x.gamesPlayed);
    const name=pname(x.skaterFullName||x.playerName||x.fullName||`${x.firstName||""} ${x.lastName||""}`).trim();
    si (!nom||gp<=0)continuer ;
    const tm=String(x.teamAbbrev||x.teamAbbreviation||x.teamCode||"").toUpperCase();
    const r={id,name,team:TEAMS[tm]?tm:"",gp,goals:n(x.goals),assistics:n(x.assistics),points:n(x.points),shots:n(x.shots||x.shotsOnGoal),toi:n(x.timeOnIcePerGame||x.avgTimeOnIcePerGame||x.toiPerGame),position:String(x.positionCode||x.position||"")};
    lignes.push(r);if(id)byId[id]=r;byName[norm(name)]=r;
  }
  renvoie {lignes, par ID, par nom};
}
fonction asynchrone getRoster(team){
  essayer{
    const j=await api(`api-web.nhle.com/v1/roster/${team}/current`),players=[],goalies=[];
    pour(const [arr,pos] de [[j.forwards,"F"],[j.defensemen,"D"]]){
      pour(const x de arr||[]){
        const name=pname(x.fullName||`${pname(x.firstName)} ${pname(x.lastName)}`).trim();if(name)players.push({id:String(x.id||x.playerId||""),name,position:pos,team});
      }
    }
    pour(const x de j.goalies||[]){
      const name=pname(x.fullName||`${pname(x.firstName)} ${pname(x.lastName)}`).trim();if(name)goalies.push({id:String(x.id||x.playerId||""),name,position:"G",team});
    }
    renvoyer {joueurs, gardiens de but};
  }catch(e){return {joueurs:[],buteurs:[]}}
}
fonction asynchrone getGoalies(){
  const expr=`seasonId=${BASE} et gameTypeId=2`;
  const j=await api("stats/rest/en/goalie/summary",{limit:-1,sort:"wins",cayenneExp:expr});
  const byId={},rows=[];
  pour(const x de j.data||[]){
    const id=String(x.playerId||x.id||""),tm=String(x.teamAbbrev||x.teamAbbreviation||x.teamCode||"").toUpperCase();
    si(!id)continuer;
    const r={id,team:tm,gp:n(x.gamesPlayed),wins:n(x.wins),sv:n(x.savePct,.9),gaa:n(x.goalsAgainstAverage,3),name:pname(x.goalieFullName||x.playerName||x.fullName)};
    parId[id]=r;rows.push(r);
  }
  renvoie {byId, lignes};
}
fonction expectedFrom(h,a,l,fh,fa,bh,ba,gf){
  const hgf=fh.length?avg(fh.map(x=>x.gf)):h.gf,agf=fa.length?avg(fa.map(x=>x.gf)):a.gf;
  const hga=fh.length?avg(fh.map(x=>x.ga)):h.ga,aga=fa.length?avg(fa.map(x=>x.ga)):a.ga;
  // Attaque / défense classiques (saison + forme récente)
  const ha=clamp((h.gf*.72+hgf*.28)/l.gf,.7,1.35),aa=clamp((a.gf*.72+agf*.28)/l.gf,.7,1.35);
  const hd=clamp((h.ga*.72+hga*.28)/l.ga,.7,1.35),ad=clamp((a.ga*.72+aga*.28)/l.ga,.7,1.35);
  soit xh=l.gf*Math.sqrt(ha*ad)*1.035,xa=l.gf*Math.sqrt(aa*hd)*.985;
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
  si(bh.b2b)xh*=.94;si(ba.b2b)xa*=.94;
  // Facteur gardien adverse
  si(gf[a.team])xh*=clamp(1+(gf.leagueSV-gf[a.team].sv)*.65,.93,1.07);
  si(gf[h.team])xa*=clamp(1+(gf.leagueSV-gf[h.team].sv)*.65,.93,1.07);
  xh=pince(xh,1.25,6);xa=pince(xa,1.1,5.75);
  // Tirs : SAT influence légère
  const shBase=clamp((h.shots*.65+a.shotsAgainst*.35)*(xh/l.gf)*.98,20,40);
  const saBase=clamp((a.shots*.65+h.shotsAgainst*.35)*(xa/l.gf)*.98,20,40);
  retour {
    domicile : xh, absence : xa, total : xh + xa,
    shotsHome:clamp(shBase*Math.sqrt(satH),.98*20,40),
    shotsAway:clamp(saBase*Math.sqrt(satA),.98*20,40),
    facteurs : {satH, satA, ppEdgeH, ppEdgeA}
  };
}
fonction marchés(xh,xa){
  soit h60=0,a60=0,t60=0;
  pour (soit h=0;h<=10;h++)pour (soit a=0;a<=10;a++){const p=poisson(xh,h)*poisson(xa,a);if(h>a)h60+=p;else if(a>h)a60+=p;else t60+=p}
  const total=xh+xa;
  return {home:h60+t60/2,away:a60+t60/2,home60:h60,away60:a60,tie60:t60,o45:over(total,4.5),o55:over(total,5.5),u55:1-over(total,5.5),o65:over(total,6.5),u65:1-over(total,6.5),btts:(1-Math.exp(-xh))*(1-Math.exp(-xa))};
}
fonction scoreprojeté(xh,xa){
  const a=[];for(let h=0;h<=8;h++)for(let x=0;x<=8;x++)a.push([h,x,poisson(xh,h)*poisson(xa,x)]);
  a.sort((x,y)=>y[2]-x[2]);return a[0];
}
fonction asynchrone construirePlayers(home,away,xh,xa,sh,sa){
  const [st,rh,ra]=await Promise.all([getSkaters(),getRoster(home),getRoster(away)]);
  const out=[];
  fonction construire(r,tm,xg,shots){
    soit brut=[];
    pour(const p de r.players){
      const s=st.byId[p.id]||st.byName[norm(p.name)];if(!s)continue;
      let role=s.toi?clamp(s.toi/17,.55,1.45):1;if(p.position==="D")role*=.78;
      raw.push({id:p.id,name:p.name,team:tm,position:p.position,gp:s.gp,goals:s.goals,assistics:s.assistics,points:s.points,shots:s.shots,toi:s.toi,
        g:Math.max(.005,s.goals/s.gp*role),a:Math.max(.008,s.assists/s.gp*role),sht:Math.max(.15,s.shots/s.gp*role)});
    }
    si (raw.length<6){
      st.rows.filter(s=>s.team===tm).sort((a,b)=>b.points-a.points).slice(0,18).forEach(s=>{
        let role=s.toi?clamp(s.toi/17,.55,1.45):1;if(s.position==="D")role*=.78;
        raw.push({id:s.id,name:s.name,team:tm,position:s.position,gp:s.gp,goals:s.goals,assistics:s.assistics,points:s.points,shots:s.shots,toi:s.toi,
          g:Math.max(.005,s.goals/s.gp*role),a:Math.max(.008,s.assists/s.gp*role),sht:Math.max(.15,s.shots/s.gp*role)});
      });
    }
    raw.sort((a,b)=>(b.g+b.a+b.sht*.08)-(a.g+a.a+a.sht*.08));
    const act=raw.slice(0,18),sg=act.reduce((s,x)=>s+xg,0)||1,sa0=act.reduce((s,x)=>s+xa,0)||1,ss0=act.reduce((s,x)=>s+x.sht,0)||1;
    agir.pourChaque(p=>{
      p.lg=clamp(pg/sg*xg*.82,.008,.95);p.la=clamp(pa/sa0*xg*.95,.01,1.1);p.ls=clamp(p.sht/ss0*shots*.92,.2,8);p.lp=clamp(p.lg+p.la,.02,1.8);
      p.pg=1-Math.exp(-p.lg);p.pa=1-Math.exp(-p.la);p.pp=1-Math.exp(-p.lp);p.ps=1-Math.exp(-p.ls);out.push(p);
    });
    retourner {matched:raw.length};
  }
  const mh=build(rh,home,xh,sh),ma=build(ra,away,xa,sa);
  out.sort((a,b)=>b.pp-a.pp);
  return {players:out,goaliesHome:rh.goalies,goaliesAway:ra.goalies,dataCount:out.length,totalCount:out.length,matchedHome:mh.matched,matchedAway:ma.matched};
}
fonction asynchrone projetGoalie(effectif,équipe){
  const st=await getGoalies();let best=null;
  pour chaque élément g de la liste || []) {const s = st.byId[g.id], score = s ? s.gp * 2 + s.wins : 0 ; si (!best ||score > best.score) best = {g, s, score}}
  Si (!best) pour (const s de st.rows.filter(x=>x.team===team)){const score=s.gp*2+s.wins; si (!best||score>best.score)best={g:{name:s.name},s,score}}
  return best&&best.s?{name:best.g.name||"Gardien 2025-26",sv:best.s.sv,gaa:best.s.gaa,conf:"baseline 2025-26"}:{name:best?.g?.name||"Non disponible",sv:.9,gaa:3,conf:"titulaire à confirmer"};
}
fonction setLoadMsg(msg){
  const el=$("loading"); if(!el)return;
  const s=el.querySelector("small"); if(s)s.textContent=msg;
}
fonction asynchrone analyser(domicile,absent){
  if(home===away)throw new Error("Sélectionne deux équipes différentes.");
  setLoadMsg("Équipes, forme et gardiens…");
  // Une seule passe équipes → ligue dérivée (éviter double fetch)
  const [teams,fh,fa,bh,ba,gf,rh,ra]=await Promise.all([
    getTeams(),getForm(domicile),getForm(extérieur),getB2B(domicile),getB2B(extérieur),getGoalieFactors(),
    getRoster (à domicile), getRoster (à l'extérieur)
  ]);
  const l=leagueFrom(équipes);
  const h=équipes[domicile],a=équipes[extérieur];
  if(!h||!a||!l.valid)throw new Error("Données équipes insuffisantes (saison 2025-26).");
  const x=expectedFrom(h,a,l,fh,fa,bh,ba,gf),m=markets(x.home,x.away);
  setLoadMsg("Accessoires et projections du joueur…");
  const [players,gh,ga]=await Promise.all([
    construireJoueurs(domicile,extérieur,x.domicile,x.extérieur,x.tirsDomicile,x.tirsExtérieur),
    projetGoalie(rh.goalies,home),
    projetGoalie(ra.goalies,out)
  ]);
  soit c=50;si(h&&a)c+=20;si(fh.length>=5)c+=5;si(fa.length>=5)c+=5;si(players.dataCount>=12)c+=8;sinon si(players.dataCount>=8)c+=5;
  si (Number.isFinite(h.sat)&&Number.isFinite(a.sat))c+=6;si (Number.isFinite(h.pp)&&Number.isFinite(a.pk))c+=4;
  si(bh.b2b||ba.b2b)c-=4;c=Math.round(clamp(c,0,95));
  const status=c<60||players.dataCount<6?"NO BET":"SURVEILLER";
  retourner {domicile,extérieur,h,a,l,fh,fa,bh,ba,gf,x,m,joueurs,gh,ga,c,statut,meilleur:projectedScore(x.domicile,x.extérieur)};
}
let CURRENT_ANALYSIS=null, CURRENT_PROP="pg", LAST_HISTORY_KEY="";

fonction applyPaywall(fullAccess){
  const lock=$("premiumLock"), body=$("premiumBody");
  si (!verrouillage||!corps)retourner;
  si(accès complet){
    verrou.classList.add("caché");
    corps.classList.remove("hidden");
    body.style.filter=""; body.style.pointerEvents=""; body.style.userSelect="";
  }autre{
    verrou.classList.supprimer("caché");
    corps.classList.remove("hidden");
    body.style.filter="blur(6px)"; body.style.pointerEvents="none"; body.style.userSelect="none";
  }
}
fonction refreshPlanUI(){
  const A=window.RDB_AUTH, badge=$("planBadge"), chip=$("authChip");
  si(A?.estPremium()){
    if(badge){badge.innerHTML=`<strong>PREMIUM</strong><span>Accès à vie</span>`;badge.classList.add("prem")}
    if(chip)chip.textContent=A.user?.name?`⭐ ${A.user.name}`:"⭐ Premium";
  }sinon si (A?.isLoggedIn()){
    if(badge){badge.innerHTML=`<strong>GRATUIT</strong><span>1 analyse / jour</span>`;badge.classList.remove("prem")}
    if(chip)chip.textContent=A.user?.name||A.user?.email||"Compte";
  }autre{
    if(badge){badge.innerHTML=`<strong>GRATUIT</strong><span>1 analyse / jour</span>`;badge.classList.remove("prem")}
    if(chip)chip.textContent="Compte";
  }
}
fonction renderAnalysis(d){
  ANALYSE_ACTUELLE=d;
  const access=window.RDB_AUTH?.canAnalyzeFull?.()||{ok:true};
  const full=!!access.ok;
  if(full) window.RDB_AUTH?.consumeAnalysis?.();
  enregistrerHistorique(d);
  $("emptyState").classList.add("hidden");$("analysis").classList.remove("hidden");
  $("aHomeCode").textContent=d.home;$("aHomeName").textContent=TEAMS[d.home][0];$("aAwayCode").textContent=d.away;$("aAwayName").textContent=TEAMS[d.away][0];
  $("xgHome").textContent=fmt(dxhome);$("xgAway").textContent=fmt(dxaway);$("scoreProb").textContent=`${d.best[0]}–${d.best[1]}`;
  $("confidence").textContent=pct(dc/100);$("confidenceBar").style.width=`${dc}%`;
  const k=full
    ?[["TOTAL BUTS",fmt(dxtotal)],["TOTAL TIRS",fmt(dxshotsHome+dxshotsAway)],["HOME OT",pct(dmhome)],["AWAY OT",pct(dmaway)],["OVER 5.5",pct(dmo55)],["BTTS",pct(dmbtts)]]
    :[["TOTAL BUTS",fmt(dxtotal)],["SCORE",`${d.best[0]}–${d.best[1]}`],["CONFIANCE",pct(dc/100)],["STATUT",d.status],["🔒 PREMIUM","requis"],["PRIX","20 € à vie"]];
  $("kpis").innerHTML=k.map(x=>`<div class="kpi"><small>${x[0]}</small><b>${x[1]}</b></div>`).join("");
  appliquerPaywall(complet);
  const mk=[["Victoire domicile OT",dmhome],["Victoire extérieure OT",dmaway],["Domicile 60 min",dmhome60],["Extérieur 60 min",dmaway60],["Nul 60 min",dmtie60],["Over 4.5",dmo45],["Over 5.5",dmo55],["Under 5,5",dmu55],["Plus de 6,5",dmo65],["Moins de 6,5",dmu65],["BTTS",dmbtts]];
  $("markets").innerHTML=mk.map(x=>`<div class="market"><div class="label">${x[0]}</div><div class="value"><b>${pct(x[1])}</b><span class="fair">${fair(x[1])}</span></div></div>`).join("");
  const notes=[
    {t:"Projection",x:`${d.home} ${fmt(dxhome)} xG contre ${d.away} ${fmt(dxaway)} xG. Modèle total : ${fmt(dxtotal)} buts.`},
    {t:"Possession",x:`SAT% ${d.home} ${pct(dhsat)} contre ${d.away} ${pct(dasat)} • USAT% ${pct(dhusat)} / ${pct(dausat)}. Impact Corsi intégré aux xG.`},
    {t:"Spécialités",x:`PP ${d.home} ${pct(dhpp)} contre PK ${d.away} ${pct(dapk)} • PP ${d.away} ${pct(dapp)} contre PK ${d.home} ${pct(dhpk)}.`},
    {t:"Forme",x:`5 derniers matchs : ${d.home} ${d.fh.length}/5, ${d.away} ${d.fa.length}/5.`},
    {t:"Fatigue",x:`B2B : ${d.home} ${d.bh.b2b?"OUI":"non"}${d.bh.restDays?` (${d.bh.restDays.toFixed(1)} j)`:``} • ${d.away} ${d.ba.b2b?"OUI":"non"}${d.ba.restDays?` (${d.ba.restDays.toFixed(1)} j)`:``}.`},
    {t:"Statut",x:`${d.status} — modèle de confiance ${pct(dc/100)}.`}
  ];
  $("modelNotes").innerHTML=notes.map((x,i)=>`<div class="note ${i===5&&d.status==="NO BET"?"warn":"good"}"><b>${xt} :</b> ${xx}</div>`).join("");
  $("goalies").innerHTML=[["home",d.home,d.gh],["away",d.away,d.ga]].map(x=>`<div class="goalie"><h3>${x[1]} <span style="color:#8ea4b8">• ${x[2].name}</span></h3><div class="stat-row"><span>SV%</span><b>${pct(x[2].sv)}</b></div><div class="stat-row"><span>GAA</span><b>${fmt(x[2].gaa)}</b></div><div class="stat-row"><span>Contexte</span><b>${x[2].conf}</b></div></div>`).join("");
  $("form").innerHTML=[["home",d.home,d.fh,d.bh],["away",d.away,d.fa,d.ba]].map(x=>{
    const wins=x[2].filter(g=>g.win).length,gf=avg(x[2].map(g=>g.gf)),ga=avg(x[2].map(g=>g.ga));
    return `<div class="form-team"><h3>${x[1]}</h3><div class="stat-row"><span>5 ​​derniers</span><b>${wins}V / ${x[2].length-wins}D</b></div><div class="stat-row"><span>Buts</span><b>${fmt(gf)} pour • ${fmt(ga)} contre</b></div><div class="stat-row"><span>B2B</span><b>${x[3].b2b?"OUI":"NON"}</b></div></div>`;
  }).rejoindre("");
  renderAdvanced(d);
  renderPlayers(CURRENT_PROP);renderAllProps();renderAudit();
}
fonction renderAdvanced(d){
  const el=$("advancedStats"); if(!el)return;
  const lignes=[
    ["SAT% (Corsi)",pct(dhsat),pct(dasat)],
    ["USAT% (Fenwick)",pct(dhusat),pct(dausat)],
    ["Power Play %",pct(dhpp),pct(dapp)],
    ["Penalty Kill %",pct(dhpk),pct(dapk)],
    ["Mises en jeu %",pct(dhfo),pct(dafo)],
    ["Zone Start % 5v5",pct(dhzs),pct(dazs)],
    ["Sh% 5v5",pct(dhsh5),pct(dash5)],
    ["Sv% 5v5",pct(dhsv5),pct(dasv5)],
    ["PDO 5v5",fmt(dhpdo),fmt(dapdo)],
    ["GF%",pct(dhgfPct),pct(dagfPct)],
    ["Hits /60",fmt(dhhits),fmt(dahits)],
    ["Blocs /60",fmt(dhblocks),fmt(dablocks)],
    ["Plats à emporter /60",fmt(dhtakeaways),fmt(datakeaways)],
    ["Cadeaux /60",fmt(dhgiveaways),fmt(dagiveaways)]
  ];
  el.innerHTML=`<div class="adv-grid"><div class="adv-head"><span>Métrique</span><b>${d.home}</b><b>${d.away}</b></div>${rows.map(r=>`<div class="adv-row"><span>${r[0]}</span><b>${r[1]}</b><b>${r[2]}</b></div>`).join("")}</div>`;
}
fonction renderPlayers(clé){
  PROPRIÉTÉ_ACTUELLE=clé;const p=ANALYSE_ACTUELLE?.joueurs.joueurs||[];
  const h=p.filter(x=>x.team===CURRENT_ANALYSIS.home).sort((a,b)=>b[key]-a[key]).slice(0,3),a=p.filter(x=>x.team===CURRENT_ANALYSIS.away).sort((a,b)=>b[key]-a[key]).slice(0,3);
  const labels={pg:["Buts","lg","but"],pa:["Passes","la","passe"],pp:["Points","lp","point"],ps:["Tirs","ls","tir"]};
  const [title,proj,unit]=labels[key];
  function box(team,arr){return `<div class="player-box"><h3>${team} — TOP 3 ${title.toUpperCase()}</h3>${arr.map((p,i)=>`<div class="player"><span class="rank">#${i+1}</span><span class="name">${p.name}<small>${p.position||"—"} • ${p.gp} matchs</small></span><span class="proj">${fmt(p[proj])} ${unit}</span><span class="prob">${pct(p[key])}</span></div>`).join("")||`<div class="player"><span></span><span class="name">Données insuffisantes</span></div>`}</div>`}
  $("playerTables").innerHTML=box(CURRENT_ANALYSIS.home,h)+box(CURRENT_ANALYSIS.away,a);
}

fonction saveHistory(d){
  const key="rdb_nhl_history_v1";
  const fingerprint=`${d.home}-${d.away}-${dxhome.toFixed(4)}-${dxaway.toFixed(4)}`;
  si (empreinte digitale===LAST_HISTORY_KEY) retourner ;
  DERNIÈRE_CLÉ_HISTORIQUE=empreinte digitale ;
  let h=[];try{h=JSON.parse(localStorage.getItem(key)||"[]")}catch(e){}
  h.décaler({
    ts:new Date().toISOString(),home:d.home,away:d.away,
    xh:dxhome,xa:dxaway,total:dxtotal,
    homeOT:dmhome,awayOT:dmaway,o55:dmo55,btts:dmbtts,
    score:`${d.best[0]}–${d.best[1]}`,confidence:dc,status:d.status
  });
  h=h.slice(0,100);localStorage.setItem(key,JSON.stringify(h));renderHistory();
}
fonction getHistory(){
  try{return JSON.parse(localStorage.getItem("rdb_nhl_history_v1")||"[]")}catch(e){return []}
}
fonction renderHistory(){
  const h=getHistory(),el=$("historyTable");if(!el)return;
  if(!h.length){el.innerHTML=`<div class="empty-inline">Aucune analyse enregistrée.</div>`;return}
  el.innerHTML=`<table class="props-table"><thead><tr><th>Date</th><th>Match</th><th>xG</th><th>Score probable</th><th>Domicile Prolongations</th><th>Extérieur Prolongations</th><th>Plus de 5,5</th><th>Confiance</th><th>Statut</th></tr></thead><tbody>${h.map(x=>`<tr>
    <td>${new Date(x.ts).toLocaleString("fr-FR")}</td><td class="pname">${x.home} – ${x.away}</td>
    <td>${fmt(x.xh)} – ${fmt(x.xa)}</td><td>${x.score}</td><td class="prob">${pct(x.homeOT)}</td>
    <td class="prob">${pct(x.awayOT)}</td><td class="prob">${pct(x.o55)}</td><td>${x.confidence}%</td>
    <td>${x.status}</td></tr>`).join("")}</tbody></table>`;
}
fonction clearHistory(){
  localStorage.removeItem("rdb_nhl_history_v1");renderHistory();
}

fonction renderAllProps(){
  const p=CURRENT_ANALYSIS?.players.players||[];
  $("allProps").innerHTML=`<table class="props-table"><thead><tr><th>Joueur</th><th>Équipe</th><th>Buts proj.</th><th>P 1+ but</th><th>Passes proj.</th><th>P 1+ passe</th><th>Points proj.</th><th>P 1+ point</th><th>Tirs proj.</th><th>P 1+ tir</th></tr></thead><tbody>${p.map(x=>`<tr><td class="pname">${x.name}</td><td>${x.team}</td><td>${fmt(x.lg)}</td><td class="prob">${pct(x.pg)}</td><td>${fmt(x.la)}</td><td class="prob">${pct(x.pa)}</td><td>${fmt(x.lp)}</td><td class="prob">${pct(x.pp)}</td><td>${fmt(x.ls)}</td><td class="prob">${pct(x.ps)}</td></tr>`).join("")}</tbody></table>`;
}
fonction renderAudit(){
  const d=ANALYSE_ACTUELLE;
  $("audit").innerHTML=`<table><thead><tr><th>Équipe</th><th>GP</th><th>GF</th><th>GA</th><th>Tirs</th><th>SAT%</th><th>PP%</th><th>PK%</th><th>FO%</th><th>AOP</th><th>Source</th></tr></thead><tbody>
  <tr><td><b>${d.home}</b></td><td>${dhgp}</td><td>${fmt(dhgf)}</td><td>${fmt(dhga)}</td><td>${fmt(dhshots)}</td><td>${pct(dhsat)}</td><td>${pct(dhpp)}</td><td>${pct(dhpk)}</td><td>${pct(dhfo)}</td><td>${fmt(dhpdo)}</td><td>${dhsource}</td></tr>
  <tr><td><b>${d.away}</b></td><td>${dagp}</td><td>${fmt(dagf)}</td><td>${fmt(daga)}</td><td>${fmt(dashots)}</td><td>${pct(dasat)}</td><td>${pct(dapp)}</td><td>${pct(dapk)}</td><td>${pct(dafo)}</td><td>${fmt(dapdo)}</td><td>${dasource}</td></tr></tbody></table>`;
}

fonction asynchrone chargerNews(){
  const el=$("newsFeed"); if(!el)return;
  el.innerHTML=`<div class="empty-inline">Chargement des actus NHL…</div>`;
  essayer{
    const r=await fetch("/api?news=1",{cache:"no-store"});
    const j=await r.json();
    const arts=j.articles||[];
    si (!arts.length){
      el.innerHTML=`<div class="empty-inline">Aucune actu pour le moment. Réessayez avec ↻ Actualiser.<br><small>${j.error||""}</small></div>`;
      retour;
    }
    el.innerHTML=arts.map(a=>{
      soit d="";
      try { if (a.published) d = new Date(a.published).toLocaleString("fr-FR", {day: "2-digit",month: "short",hour: "2-digit",minute: "2-digit"}); } catch (_) {}
      const img=a.image?`<img src="${a.image}" alt="" loading="lazy" referrerpolicy="no-referrer">`:"";
      const desc=(a.description||"").slice(0,180);
      return `<a class="news-card" href="${a.url||"https://www.nhl.com/news"}" target="_blank" rel="noopener">
        <div class="news-img">${img||`<div class="news-ph">🏒</div>`}</div>
        <div class="news-body">
          <div class="news-meta">${d||"Récent"} · ${a.source||"NHL"}</div>
          <h3>${a.title||"Sans titre"></h3>
          <p>${desc}${desc.length>=180?"…":""}</p>
        </div>
      </a>`;
    }).rejoindre("");
  }catch(e){
    el.innerHTML=`<div class="empty-inline">Impossible de charger l'actu (${e.message||e}).<br>Vérifie que <code>functions/api.js</code> est bien déployé.</div>`;
  }
}

fonction asynchrone runAnalysis(){
  const home=$("homeTeam").value,away=$("awayTeam").value,btn=$("analyzeBtn");
  if(btn){btn.disabled=true;btn.style.opacity=".6"}
  $("loading").classList.remove("hidden");$("analysis").classList.add("hidden");$("emptyState").classList.add("hidden");
  setLoadMsg("Connexion LNH…");
  essayer{
    renderAnalysis(attendre analyze(home,away));
    $("lastUpdate").textContent="Dernière analyse : "+new Date().toLocaleTimeString("fr-FR");
  }catch(e){
    $("emptyState").classList.remove("hidden");
    $("emptyState").innerHTML=`<div class="empty-icon">⚠️</div><h2>Analyse indisponible</h2><p>${e.message||e}</p><p class="muted" style="margin-top:8px">Réessayez dans quelques secondes ou change d'équipe.</p>`;
  }enfin{
    $("loading").classList.add("hidden");
    if(btn){btn.disabled=false;btn.style.opacity="1"}
  }
}
fonction asynchrone schedule(days=0){
  const d=new Date();d.setDate(d.getDate()+days);const iso=d.toISOString().slice(0,10);
  $("schedule").innerHTML=`<div class="empty-inline">Chargement…</div>`;
  essayer{
    const j=await api(`api-web.nhle.com/v1/schedule/${iso}`);const games=j.gameWeek?.flatMap(x=>x.games||[])||[];
    const lignes=jeux.filter(g=>g.gameType===2);
    $("schedule").innerHTML=rows.length?rows.map(g=>{
      const h=g.homeTeam?.abbrev||"",a=g.awayTeam?.abbrev||"",dt=new Date(g.startTimeUTC);
      return `<div class="game-row"><div class="game-time">${dt.toLocaleDateString("fr-FR",{weekday:"short",day:"2-digit",month:"2-digit"})}<br>${dt.toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"})}</div><div class="game-teams"><span>${a}</span> <b> @ </b> <span>${h}</span></div><div class="game-score">${g.gameState==="OFF"||g.gameState==="FINAL"?`${g.awayTeam.score} – ${g.homeTeam.score}`:"À venir"}</div><button class="analyze-small" data-h="${h}" data-a="${a}">ANALYSER</button></div>`;
    }).join(""):`<div class="empty-inline">Aucun match de saison régulière trouvé ce jour-là.</div>`;
    document.querySelectorAll(".analyze-small").forEach(b=>b.onclick=()=>{ $("homeTeam").value=b.dataset.h;$("awayTeam").value=b.dataset.a;updateTeamMeta();document.querySelector('[data-view="analyse"]').click();runAnalysis();});
  }catch(e){$("schedule").innerHTML=`<div class="empty-inline">Impossible de charger le calendrier.</div>`}
}
fonction asynchrone renderTeamTable(){
  $("teamTable").innerHTML=`<div class="empty-inline">Chargement des 32 équipes…</div>`;
  essayer{
    const t=await getTeams(),l=await league();
    const lignes=Object.keys(TEAMS).sort().map(c=>{
      const x=t[c];
      retourner x?`<tr>
        <td><span class="code">${c}</span> ${TEAMS[c][0]}</td>
        <td>${x.gp}</td><td>${fmt(x.gf)}</td><td>${fmt(x.ga)}</td>
        <td>${pct(x.sat)}</td><td>${pct(x.usat)}</td>
        <td>${pct(x.pp)}</td><td>${pct(x.pk)}</td>
        <td>${pct(x.fo)}</td><td>${fmt(x.pdo)}</td>
        <td>${fmt(x.gf/l.gf)}</td><td>${fmt(x.ga/l.ga)}</td>
      </tr>`:`<tr><td><span class="code">${c}</span> ${TEAMS[c][0]}</td><td colspan="11">Données insuffisantes</td></tr>`;
    }).rejoindre("");
    $("teamTable").innerHTML=`<table><thead><tr>
      <th>Équipe</th><th>GP</th><th>GF</th><th>GA</th>
      <th>SAT%</th><th>USAT%</th><th>PP%</th><th>PK%</th><th>FO%</th><th>PDO</th>
      <th>Attaque</th><th>Défense</th>
    </tr></thead><tbody>${rows}</tbody></table>`;
  }catch(e){$("teamTable").innerHTML=`<div class="empty-inline">${e.message}</div>`}
}
fonction openAuth(mode){
  const m=$("authModal"); if(!m)return;
  m.classList.remove("hidden");
  const isReg=mode==="registre";
  document.querySelectorAll(".auth-tab").forEach(t=>t.classList.toggle("active",t.dataset.auth===(isReg?"register":"login")));
  $("authNameWrap")?.classList.toggle("hidden",!isReg);
  $("authSubmit").textContent=isReg?"Créer mon compte":"Se connecter";
  $("authError")?.classList.add("hidden");
  const A=window.RDB_AUTH;
  const lo=$("authLogout");
  if(lo)lo.style.display=A?.isLoggedIn()?"block":"none";
}
function closeAuth(){ $("authModal")?.classList.add("hidden"); }
fonction setupAuthUI(){
  const A=window.RDB_AUTH; if(!A)return;
  A.checkUnlockParam?.();
  rafraîchirPlanUI();
  $("authChip")?.addEventListener("click",()=>openAuth(A.isLoggedIn()?"login":"register"));
  $("unlockBtn")?.addEventListener("click",()=>A.openCheckout());
  $("buyPremiumBtn")?.addEventListener("click",()=>A.openCheckout());
  $("lockLoginBtn")?.addEventListener("click",()=>openAuth("register"));
  $("freeAccountBtn")?.addEventListener("click",()=>openAuth("register"));
  document.querySelectorAll("[data-close=auth]").forEach(el=>el.addEventListener("click",closeAuth));
  document.querySelectorAll(".auth-tab").forEach(t=>t.addEventListener("click",()=>openAuth(t.dataset.auth)));
  $("authForm")?.addEventListener("submit",async e=>{
    e.prévenirDefault();
    const email=$("authEmail").value, pass=$("authPassword").value, name=$("authName")?.value;
    const isReg=$("authNameWrap")&&!$("authNameWrap").classList.contains("hidden");
    const err=$("authError");
    essayer{
      si(isReg) attendre A.register(email,pass,name);
      sinon attendre A.login(email,pass);
      err?.classList.add("caché");
      fermerAuth(); rafraîchirPlanUI();
      si(ANALYSE_COURANTE) afficherAnalyse(ANALYSE_COURANTE);
    }catch(ex){
      if(err){err.textContent=ex.message||String(ex);err.classList.remove("hidden")}
    }
  });
  $("authLogout")?.addEventListener("click",()=>{A.logout();refreshPlanUI();closeAuth()});
  window.addEventListener("rdb:premium",()=>{refreshPlanUI();if(CURRENT_ANALYSIS)renderAnalysis(CURRENT_ANALYSIS)});
  fenêtre.addEventListener("rdb:auth",refreshPlanUI);
}
fonction setup(){
  populateTeams();$("homeTeam").onchange=updateTeamMeta;$("awayTeam").onchange=updateTeamMeta;$("analyzeBtn").onclick=runAnalysis;
  document.querySelectorAll(".nav-btn").forEach(b=>b.onclick=()=>{document.querySelectorAll(".nav-btn").forEach(x=>x.classList.remove("active"));b.classList.add("active");document.querySelectorAll(".view").forEach(x=>x.classList.remove("active"));const v=$(`view-${b.dataset.view}`); if(v)v.classList.add("active");if(b.dataset.view==="matchs")schedule(0);if(b.dataset.view==="equipes")renderTeamTable();if(b.dataset.view==="actu")loadNews()});
  document.querySelectorAll(".tab").forEach(b=>b.onclick=()=>{document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));b.classList.add("active");renderPlayers(b.dataset.prop)});
  document.querySelectorAll(".day-btn").forEach(b=>b.onclick=()=>{document.querySelectorAll(".day-btn").forEach(x=>x.classList.remove("active"));b.classList.add("active");schedule(Number(b.dataset.days))});
  $("refreshSchedule").onclick=()=>schedule(0);$("refreshNews")&&($("refreshNews").onclick=()=>loadNews());$("refreshTeams").onclick=()=>{TEAMS_CACHE=null;renderTeamTable()};
  $("clearHistory").onclick=clearHistory;
  afficherHistorique();
  setupAuthUI();
  $("apiStatus").textContent="NHL • prêt";
  getTeams().then(t=>{$("apiStatus").textContent=`NHL • ${Object.keys(t).length} équipes`}).catch(()=>{});
}
document.addEventListener("DOMContentLoaded",setup);
