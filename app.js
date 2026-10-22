const R = window.Rotation;
const SEED = {"dataVersion":6,"teamName":"","squad":[],"lineup":{},"preset":"3-2-3-2","plan":null,"pin":"","sheet":{"us":[],"them":[],"pc":0,"log":[]}};
const PRESETS = {
  "3-2-3-2": [["G","Gardien","gk",50,95,"G"],["1","Back gauche","def",20,76,"BG"],["2","Back central","def",50,80,"BC"],["3","Back droit","def",80,76,"BD"],["4","Milieu déf. gauche","dm",34,63,"MDG"],["5","Milieu déf. droit","dm",66,63,"MDD"],["6","Milieu gauche","mid",17,44,"MG"],["7","Milieu off.","mid",50,46,"MO"],["8","Milieu droit","mid",83,44,"MD"],["9","Avant gauche","att",34,20,"AG"],["10","Avant droit","att",66,20,"AD"]],
  "4-3-3": [["G","Gardien","gk",50,95,"G"],["1","Back gauche","def",14,74,"BG"],["2","Back central gauche","def",38,80,"BCG"],["3","Back central droit","def",62,80,"BCD"],["4","Back droit","def",86,74,"BD"],["5","Milieu déf.","dm",50,60,"MDF"],["6","Milieu gauche","mid",26,46,"MG"],["7","Milieu droit","mid",74,46,"MD"],["8","Avant gauche","att",18,22,"AG"],["9","Avant centre","att",50,16,"AC"],["10","Avant droit","att",82,22,"AD"]],
  "4-4-2": [["G","Gardien","gk",50,95,"G"],["1","Back gauche","def",14,74,"BG"],["2","Back central gauche","def",38,80,"BCG"],["3","Back central droit","def",62,80,"BCD"],["4","Back droit","def",86,74,"BD"],["5","Milieu gauche","mid",14,48,"MG"],["6","Milieu axial gauche","dm",38,54,"MAG"],["7","Milieu axial droit","dm",62,54,"MAD"],["8","Milieu droit","mid",86,48,"MD"],["9","Avant gauche","att",36,20,"AG"],["10","Avant droit","att",64,20,"AD"]],
  "3-3-3-1": [["G","Gardien","gk",50,95,"G"],["1","Back gauche","def",20,76,"BG"],["2","Back central","def",50,80,"BC"],["3","Back droit","def",80,76,"BD"],["4","Milieu déf. gauche","dm",22,62,"MDG"],["5","Milieu déf. axe","dm",50,64,"MDA"],["6","Milieu déf. droit","dm",78,62,"MDD"],["7","Milieu off. gauche","mid",22,40,"MOG"],["8","Milieu off. axe","mid",50,42,"MOA"],["9","Milieu off. droit","mid",78,40,"MOD"],["10","Avant centre","att",50,17,"AC"]]
};
const DEFAULT_RULES = {quarters:4,qlen:17.5,firstChange:6,startBlock:4,endBlock:3,minStint:6,maxStint:22,maxBench:10,minBench:3,maxEntries:3,breakChanges:true,gkOnlyAtBreaks:true,minPlay:35,alertSec:30,minDef:10,minMid:8,minAtt:6};
const RULE_LABELS = [["qlen","Durée d'un quart (min)",0.5],["firstChange","Q1 : premier changement après (min)",1],["startBlock","Rien dans les premières (min) d'un quart",1],["endBlock","Rien dans les dernières (min) d'un quart",1],["minDef","Passage minimum défenseurs (min)",1],["minMid","Passage minimum milieux (min)",1],["minAtt","Passage minimum attaquants (min)",1],["maxStint","Passage maximum (min)",1],["maxBench","Banc maximum par quart (min)",1],["maxEntries","Entrées max en même temps",1],["minPlay","Temps de jeu minimum (min)",1],["alertSec","Alerte avant changement (s)",5]];

let S = {squad:[],preset:"3-2-3-2",lineup:{},rules:{...DEFAULT_RULES},plan:null,pin:""};
let mode = "match", coachOK = false, preview = null, seedN = 1;
const SID = Math.random().toString(36).slice(2);
let liveRef = null, liveOK = false, liveBusy = false, liveAgain = false;
let inc = null, incBusy = false, incMsg = "";
let far = false; try { far = localStorage.getItem("banc-far") === "1"; } catch(e){}
let season = null, seasonMsg = "";
let db = null, docRef = null, saveTimer = null, saving = false, saveAgain = false, saveState = "";
let C = loadClock();

const $ = (s, el=document) => el.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const posMeta = id => { const p = PRESETS[S.preset].find(x => x[0] === id); return p ? {id:p[0],label:p[1],line:p[2],x:p[3],y:p[4],short:p[5]||p[0]} : {id,label:id,line:"mid",x:50,y:50,short:id}; };
const posName = id => posMeta(id).label;
const posShort = id => posMeta(id).short;
const fmtClock = sec => { sec = Math.max(0, Math.round(sec)); return `${Math.floor(sec/60)}:${String(sec%60).padStart(2,"0")}`; };
const fmtQ = t => { const ql = S.rules.qlen; const q = Math.min(S.rules.quarters, Math.floor(t/ql + 1e-6) + 1); const m = t - (q-1)*ql; return {q, m, label: R.fmtMin(m)}; };

/* ---------- storage ---------- */
function applyData(v){ v = JSON.parse(JSON.stringify(v)); (v.squad||[]).forEach(p => { if (p.roles) p.roles = [...new Set(p.roles.map(r => ({I:"D",S:"B"})[r] || r).filter(r => r==="D"||r==="B"))]; }); S = {...S, ...v, rules:{...DEFAULT_RULES, ...(v.rules||{})}}; }
function loadLocal(){ let v = null; try { v = JSON.parse(localStorage.getItem("banc-state") || "null"); } catch(e){} applyData(v || SEED); }
function saveLocal(){ try { localStorage.setItem("banc-state", JSON.stringify(S)); } catch(e){} }
function loadClock(){ try { return JSON.parse(localStorage.getItem("banc-clock") || "null") || {q:1,elapsed:0,running:false,startedAt:0,done:[]}; } catch(e){ return {q:1,elapsed:0,running:false,startedAt:0,done:[]}; } }
function saveClock(){ try { localStorage.setItem("banc-clock", JSON.stringify(C)); } catch(e){} }
function pushClock(){
  saveClock();
  if (!liveRef) return;
  (async function go(){
    if (liveBusy) { liveAgain = true; return; }
    liveBusy = true;
    try { await liveRef.set({...JSON.parse(JSON.stringify(C)), by: SID, at: Date.now()}); } catch(e){}
    liveBusy = false; if (liveAgain) { liveAgain = false; go(); }
  })();
}
function persist(){
  saveLocal();
  if (!docRef) return;
  clearTimeout(saveTimer); saveState = "Enregistrement…"; paintSave();
  saveTimer = setTimeout(async function go(){
    if (saving) { saveAgain = true; return; }
    saving = true;
    try { S._by = SID; await docRef.set(JSON.parse(JSON.stringify(S))); saveState = "Enregistré"; }
    catch(e){ saveState = "Enregistré sur cet appareil seulement"; }
    saving = false; paintSave();
    if (saveAgain) { saveAgain = false; go(); }
  }, 800);
}
function teamTitle(){ return S.teamName ? `Banc ${S.teamName}` : "Banc"; }
const slug = s => String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "equipe";
function paintSub(){ const bn = $("#brandName"); if (bn) bn.textContent = teamTitle(); document.title = teamTitle();
 const el = $("#sub"); if (el) el.innerHTML = (matchTitle() ? `<b style="font-weight:600">${esc(matchTitle())}</b><br>` : "") + `<span style="opacity:.7">${esc(saveState)}</span>`; paintSave(); }
function paintSave(){ const el = $("#saveState"); if (el) el.textContent = saveState; }

/* ---------- plan helpers ---------- */
function minStintOf(p){ const l = posMeta(p.pos[0]).line; return l === "def" ? +S.rules.minDef : (l === "dm" || l === "mid") ? +S.rules.minMid : l === "att" ? +S.rules.minAtt : 0; }
function matchTitle(){
  const parts = [];
  if (S.matchLabel) parts.push(S.matchLabel);
  if (S.matchDate) { try { const d = new Date(S.matchDate + "T12:00:00"); parts.push(d.toLocaleDateString("fr-BE", {weekday:"long", day:"numeric", month:"long"})); } catch(e){ parts.push(S.matchDate); } }
  return parts.join(" · ");
}
function present(){ return S.squad.filter(p => p.present && p.name.trim()); }
function computeTargets(){
  const END = S.rules.quarters * S.rules.qlen;
  const ids = PRESETS[S.preset].map(p => p[0]);
  const gk = ids[0];
  const P = present().map(p => ({name:p.name, note:+p.note, override: p.minutes ? +p.minutes : 0, field: p.pos.some(q => q !== gk)}));
  return R.targetsFromNotes(P, ids.length - 1, END).targets;
}
function syncMinStint(){ S.rules.minStint = Math.min(+S.rules.minDef, +S.rules.minMid, +S.rules.minAtt); }
function generate(seed){
  syncMinStint();
  const positions = PRESETS[S.preset].map(p => ({id:p[0], gk:p[2]==="gk"}));
  const T = computeTargets();
  const players = present().map(p => ({name:p.name, pos:p.pos, target:T[p.name], locked: (+p.note >= 5 && !p.minutes), oneBlock: +p.note >= 5, maxStint: p.maxStint ? +p.maxStint : 0, roles: p.roles || [], minFirst: p.minFirst || 0, minStint: minStintOf(p)}));
  let best = null;
  for (let k = 0; k < 3; k++) {
    const p = R.buildPlan({positions, players, lineup:S.lineup, rules:S.rules, seed: seed + k*7919, iters:300, saIters:40000, chains:4});
    if (p.error) return p;
    if (!best || p.warnings.length < best.warnings.length || (p.warnings.length === best.warnings.length && p.score < best.score)) best = p;
    if (!best.warnings.length) break;
  }
  return best;
}
let _vcPlan = null, _vc = [];
function visChanges(plan){
  if (!plan) return [];
  if (plan === _vcPlan) return _vc;
  const ev = (plan.events||[]);
  _vc = plan.changes.map(c => {
    const skip = new Set();
    ev.forEach(e => {
      if ((e.type==="vert"||e.type==="jaune") && (Math.abs(c.t-e.t)<1e-6 || Math.abs(c.t-(e.t+e.d))<1e-6)) skip.add(e.player);
      if (e.type==="rouge" && Math.abs(c.t-e.t)<1e-6) skip.add(e.player);
    });
    if (!skip.size) return c;
    const c2 = {...c, ins:c.ins.filter(x=>!skip.has(x[0])), outs:c.outs.filter(x=>!skip.has(x[0]))};
    return (c2.ins.length||c2.outs.length||c2.moves.length) ? c2 : null;
  }).filter(Boolean);
  _vcPlan = plan; return _vc;
}
function segAt(plan, t){ return plan.segs.find(s => s.a <= t + 1e-6 && t < s.b - 1e-6) || plan.segs[plan.segs.length-1]; }

/* ---------- clock ---------- */
function clockElapsed(){ return C.running ? Math.min(S.rules.qlen*60, C.elapsed + (Date.now() - C.startedAt)/1000) : C.elapsed; }
function matchT(){ return (C.q-1)*S.rules.qlen + clockElapsed()/60; }
let wake = null;
async function wakeOn(){ try { wake = await navigator.wakeLock?.request("screen"); } catch(e){} }
function startClock(){ if (C.running) return; C.running = true; C.startedAt = Date.now(); pushClock(); wakeOn(); unlockAudio(); render(); }
function pauseClock(){ if (!C.running) return; C.elapsed = clockElapsed(); C.running = false; pushClock(); render(); }
function syncDone(){
  const ql = S.rules.qlen, T = (C.q-1)*ql + C.elapsed/60;
  C.done = visChanges(S.plan).filter(c => c.t < T - 0.001 || (C.q > 1 && Math.abs(c.t - (C.q-1)*ql) < 1e-6)).map(c => c.t);
  lastAlertKey = "";
}
function setClock(q, sec){ C.q = Math.max(1, Math.min(S.rules.quarters, q)); C.elapsed = Math.max(0, Math.min(S.rules.qlen*60, sec)); if (C.running) C.startedAt = Date.now(); syncDone(); pushClock(); render(); }
function adjust(sec){ setClock(C.q, clockElapsed() + sec); }
function nextQuarter(){ if (C.q >= S.rules.quarters) return; C.running = false; setClock(C.q + 1, 0); }
function resetMatch(){ C = {q:1,elapsed:0,running:false,startedAt:0,done:[]}; S.sheet = {us:[], them:[], pc:0, log:[]}; persist(); pushClock(); render(); }
let actx = null;
function unlockAudio(){ try { actx = actx || new (window.AudioContext||window.webkitAudioContext)(); actx.resume?.(); } catch(e){} }
function beep(n){ if (!actx) return; try { for (let i=0;i<n;i++){ const o = actx.createOscillator(), g = actx.createGain(); o.frequency.value = 880; o.connect(g); g.connect(actx.destination); const t0 = actx.currentTime + i*0.25; g.gain.setValueAtTime(0.0001,t0); g.gain.exponentialRampToValueAtTime(0.4,t0+0.02); g.gain.exponentialRampToValueAtTime(0.0001,t0+0.18); o.start(t0); o.stop(t0+0.2);} } catch(e){} try{navigator.vibrate?.(200)}catch(e){} }

/* ---------- incidents ---------- */
const INC = {bless:{label:"Blessure",icon:"🩹",d:0}, vert:{label:"Carton vert",icon:"🟩",d:2}, jaune:{label:"Carton jaune",icon:"🟨",d:5}, rouge:{label:"Carton rouge",icon:"🟥",d:0}};
function eventsOf(){ return (S.plan && S.plan.events) || []; }
function outForGood(){ return eventsOf().filter(e => e.type==="bless" || e.type==="rouge").map(e => e.player); }
function doIncident(){
  const T = Math.floor(matchT()*10)/10;
  const type = inc.type, p = inc.player, info = INC[type] || {d:0};
  const positions = PRESETS[S.preset].map(x => ({id:x[0], gk:x[2]==="gk"}));
  const Tg = computeTargets();
  const players = present().map(x => ({name:x.name, pos:x.pos, target: S.plan.targets?.[x.name] ?? Tg[x.name], locked:(+x.note>=5 && !x.minutes), oneBlock: +x.note>=5, maxStint: x.maxStint ? +x.maxStint : 0, roles: x.roles || [], minFirst: x.minFirst || 0, minStint: minStintOf(x)}));
  const seg = segAt(S.plan, T);
  const prevVac = eventsOf().filter(e => e.type==="rouge").map(e => e.pos);
  const o = {T, positions, players, rules:S.rules, out: outForGood(), vacate: prevVac.slice(), seed: Date.now()%100000, adjust: {}};
  if (type === "libre") o.swap = {out: p, in: inc.inP, pos: inc.pos || null};
  if (type === "bless") o.out.push(p);
  if (type === "rouge") { o.out.push(p); o.vacate.push(seg.on[p]); }
  if (type === "vert" || type === "jaune") { o.freezeUntil = Math.min(S.rules.quarters*S.rules.qlen, T + info.d); o.freezeOut = [p]; if (!inc.catchUp) o.adjust[p] = -info.d; }
  // keep earlier adjustments
  eventsOf().forEach(e => { if ((e.type==="vert"||e.type==="jaune") && !e.catchUp) o.adjust[e.player] = (o.adjust[e.player]||0); });
  const res = R.replan(S.plan, o);
  if (res.error) { incMsg = res.warnings.join(" "); incBusy = false; render(); return; }
  res.events = [...eventsOf(), {t:T, type, player:p, inP: inc.inP || null, d:info.d, pos: seg.on[p] || null, catchUp: !!inc.catchUp}];
  S.prevPlan = S.plan; S.plan = res; inc = null; incBusy = false; incMsg = "";
  syncDone(); pushClock(); persist(); render();
}
function activeBanners(t){
  const out = [];
  eventsOf().forEach(e => {
    const i = INC[e.type];
    if ((e.type==="vert"||e.type==="jaune") && t >= e.t - 1e-6 && t < e.t + e.d) out.push(`<div class="banner ${e.type}"><b>${i.icon} ${esc(i.label)} : ${esc(e.player)}</b> exclu, on joue à 10. Retour dans <span data-until="${e.t+e.d}">${fmtClock((e.t+e.d-t)*60)}</span></div>`);
    if (e.type==="rouge" && t >= e.t - 1e-6) out.push(`<div class="banner rouge"><b>🟥 Carton rouge : ${esc(e.player)}</b> exclu jusqu'à la fin, on joue à 10.</div>`);
    if (e.type==="bless" && t >= e.t - 1e-6 && t < e.t + 2) out.push(`<div class="banner bless"><b>🩹 ${esc(e.player)} blessé</b> : le plan a été recalculé sans lui.</div>`);
  });
  return out.join("");
}
function swapPanel(seg){
  if (!inc || inc.type !== "libre") return "";
  const onField = Object.keys(seg.on).filter(n => !/G/.test(seg.on[n]) || n === inc.player);
  const outQ = inc.player ? seg.on[inc.player] : null;
  const canQ = n => outQ && (S.squad.find(p => p.name === n)?.pos || []).includes(outQ);
  const bench = present().map(p=>p.name).filter(n => !(n in seg.on) && !outForGood().includes(n)).sort((a,b) => canQ(b) - canQ(a));
  return `<div class="card incp"><h2>Changement hors plan</h2>
    <div class="muted" style="margin:0 0 6px;font-size:.9rem">Qui sort ?</div>
    <div class="inc-players">${onField.map(n => `<button class="btn" data-swo="${esc(n)}" aria-pressed="${inc.player===n}">${esc(n)} <small>${esc(posShort(seg.on[n]))}</small></button>`).join("")}</div>
    <div class="muted" style="margin:10px 0 6px;font-size:.9rem">Qui entre ?</div>
    <div class="inc-players">${bench.map(n => `<button class="btn${outQ && !canQ(n) ? " dim" : ""}" data-swi="${esc(n)}" aria-pressed="${inc.inP===n}">${esc(n)}${outQ && !canQ(n) ? " <small>autre poste</small>" : ""}</button>`).join("") || '<span class="muted">Personne sur le banc</span>'}</div>
    ${outQ && inc.inP ? `<div class="muted" style="margin-top:10px;font-size:.92rem">${canQ(inc.inP) ? `${esc(inc.inP)} prend le poste ${pill(outQ)} de ${esc(inc.player)}.` : `${esc(inc.inP)} ne joue pas en ${pill(outQ)} : les joueurs seront réorganisés.`} Le reste du plan est recalculé.</div>` : ""}
    ${incMsg ? `<div class="warn" style="margin-top:10px">${esc(incMsg)}</div>` : ""}
    <div class="row" style="margin-top:12px"><button class="btn go big" id="incGo" ${inc.player && inc.inP && !incBusy ? "" : "disabled"}>${incBusy ? "Recalcul…" : "Valider"}</button><button class="btn" id="incCancel">Annuler</button></div>
  </div>`;
}
function incidentPanel(seg){
  if (inc && inc.type === "libre") return swapPanel(seg);
  if (!inc) return "";
  const onField = Object.keys(seg.on);
  const card = inc.type==="vert" || inc.type==="jaune";
  return `<div class="card incp"><h2>Imprévu</h2>
    <div class="inc-types">${Object.entries(INC).map(([k,v]) => `<button class="btn inc-t ${k}" data-inct="${k}" aria-pressed="${inc.type===k}">${v.icon} ${esc(v.label)}${v.d?` ${v.d}'`:""}</button>`).join("")}</div>
    <div class="muted" style="margin:10px 0 6px;font-size:.9rem">Quel joueur ?</div>
    <div class="inc-players">${onField.map(n => `<button class="btn" data-incp="${esc(n)}" aria-pressed="${inc.player===n}">${esc(n)}</button>`).join("")}</div>
    ${card ? `<label class="row" style="margin-top:10px;font-size:.95rem"><input type="checkbox" id="catchUp" ${inc.catchUp?"checked":""}> Rattraper le temps de la carte plus tard</label>` : ""}
    ${incMsg ? `<div class="warn" style="margin-top:10px">${esc(incMsg)}</div>` : ""}
    <div class="row" style="margin-top:12px"><button class="btn go big" id="incGo" ${inc.type && inc.player && !incBusy ? "" : "disabled"}>${incBusy ? "Recalcul…" : "Valider et recalculer"}</button><button class="btn" id="incCancel">Annuler</button></div>
  </div>`;
}
/* ---------- match sheet ---------- */
function sheet(){ S.sheet ||= {us:[], them:[], pc:0, log:[]}; return S.sheet; }
let scorerPick = false;
function sheetCard(seg){
  const sh = sheet();
  return `<div class="card sheet"><div class="sheet-row">
      <div class="score"><span>${sh.us.length}</span><small>nous</small></div><div class="dash">–</div><div class="score"><span>${sh.them.length}</span><small>eux</small></div>
      <div class="sheet-btns"><button class="btn small" id="gUs">+ But nous</button><button class="btn small" id="gThem">+ But eux</button><button class="btn small" id="pcPlus">+ Corner (${sh.pc})</button>${sh.log.length ? `<button class="btn small" id="shUndo" aria-label="Annuler la dernière saisie">↶</button>` : ""}</div>
    </div>
    ${scorerPick ? `<div class="inc-players" style="margin-top:10px"><span class="muted" style="align-self:center;font-size:.9rem">Buteur :</span>${Object.keys(seg.on).filter(n => seg.on[n] !== "G").map(n => `<button class="btn small" data-scorer="${esc(n)}">${esc(n)}</button>`).join("")}<button class="btn small" data-scorer="">Je ne sais pas</button></div>` : ""}
  </div>`;
}
function bindSheet(){
  const sh = sheet(), t = Math.round(matchT()*10)/10;
  const commit = () => { persist(); render(); };
  $("#gUs")?.addEventListener("click", () => { scorerPick = !scorerPick; render(); });
  $("#gThem")?.addEventListener("click", () => { sh.them.push({t}); sh.log.push("them"); commit(); });
  $("#pcPlus")?.addEventListener("click", () => { sh.pc++; sh.log.push("pc"); commit(); });
  $("#shUndo")?.addEventListener("click", () => { const k = sh.log.pop(); if (k==="us") sh.us.pop(); else if (k==="them") sh.them.pop(); else if (k==="pc") sh.pc = Math.max(0, sh.pc-1); commit(); });
  document.querySelectorAll("[data-scorer]").forEach(b => b.addEventListener("click", () => { sh.us.push({t, player: b.dataset.scorer || null}); sh.log.push("us"); scorerPick = false; commit(); }));
}
/* ---------- PDF plan B ---------- */
function loadJsPdf(){ return new Promise((ok, ko) => { if (window.jspdf) return ok(); const s = document.createElement("script"); s.src = "vendor/jspdf.umd.min.js"; s.onload = ok; s.onerror = ko; document.head.appendChild(s); }); }
async function makePdf(){
  const btn = $("#pdfB"); if (btn) { btn.disabled = true; btn.textContent = "Préparation…"; }
  const done = msg => { if (btn) { btn.disabled = false; btn.textContent = "📄 Plan B (PDF)"; } const m = $("#pinMsg"); seasonMsg = msg; render(); };
  try {
    await loadJsPdf();
    const { jsPDF } = window.jspdf; const doc = new jsPDF({unit:"mm", format:"a4"});
    const plan = S.plan, ql = S.rules.qlen; let y = 16;
    const line = (txt, size=10, bold=false, x=14) => { if (y > 284) { doc.addPage(); y = 16; } doc.setFont("helvetica", bold?"bold":"normal"); doc.setFontSize(size); doc.text(txt, x, y); y += size*0.45 + 1.6; };
    line(`${teamTitle()} - plan de rotation`, 16, true);
    line(`${matchTitle() || new Date().toLocaleDateString("fr-BE")} - ${S.preset}`, 11, true);
    y += 2; line("Compo de départ", 12, true);
    PRESETS[S.preset].forEach(([id,label]) => line(`${label} : ${Object.entries(plan.segs[0].on).find(([p,q]) => q===id)?.[0] || "-"}`, 10, false, 18));
    for (let q = 1; q <= S.rules.quarters; q++) {
      y += 3; line(`Quart ${q}`, 13, true);
      const list = visChanges(plan).filter(c => (q > 1 && Math.abs(c.t-(q-1)*ql) < 1e-6) || (c.t > (q-1)*ql + 1e-6 && c.t < q*ql - 1e-6));
      if (!list.length) line("Aucun changement", 10, false, 18);
      list.forEach(c => {
        const lab = Math.abs(c.t-(q-1)*ql) < 1e-6 ? "Pause" : fmtQ(c.t).label;
        line(lab, 11, true, 16);
        pairChanges(c).forEach(pr => line(`${pr.inP || "-"} remplace ${pr.outP || "-"}${pr.inQ ? "  (" + posName(pr.inQ) + ")" : ""}`, 10, false, 30));
        c.moves.forEach(([p,a,b]) => line(`Réorganisation : ${p} passe de ${posName(a)} à ${posName(b)}`, 9, false, 30));
      });
    }
    doc.save(`plan-b-${slug(S.teamName || "equipe")}.pdf`);
    done("Plan B téléchargé.");
  } catch(e) { done("Impossible de créer le PDF. Réessaie."); }
}
/* ---------- backup file ---------- */
function exportBackup(){
  let seasonL = []; try { seasonL = JSON.parse(localStorage.getItem("banc-season") || "[]"); } catch(e){}
  const st = JSON.parse(JSON.stringify(S)); delete st.pin; delete st._by;
  const data = {app:"banc-hockey", kind:"sauvegarde", version:1, savedAt:new Date().toISOString().slice(0,10), state:st, season:seasonL};
  const blob = new Blob([JSON.stringify(data, null, 1)], {type:"application/json"});
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
  a.download = `banc-${slug(S.teamName || "equipe")}-${data.savedAt}.json`;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  backupMsg = "Sauvegarde téléchargée. Garde ce fichier en lieu sûr (mail, Drive...)."; render();
}
function importBackup(file){
  const rd = new FileReader();
  rd.onload = () => {
    try {
      const d = JSON.parse(rd.result);
      if (d.app !== "banc-hockey" || !d.state || !Array.isArray(d.state.squad)) throw new Error("format");
      const pin = S.pin; applyData(d.state); S.pin = pin;
      if (Array.isArray(d.season)) localStorage.setItem("banc-season", JSON.stringify(d.season));
      season = null; preview = null; persist();
      backupMsg = `Sauvegarde du ${d.savedAt || "?"} rechargée : ${d.state.squad.length} joueurs.`;
    } catch(e){ backupMsg = "Ce fichier n'est pas une sauvegarde du banc."; }
    render();
  };
  rd.readAsText(file);
}
let backupMsg = "";
/* ---------- season ---------- */
let seasonLoading = false;
async function loadSeason(){
  if (seasonLoading) return; seasonLoading = true;
  await new Promise(r => setTimeout(r, 0));
  try {
    if (db) { const qs = await db.collection("matches").get(); season = qs.docs.map(d => ({id:d.id, ...JSON.parse(JSON.stringify(d.data()))})); }
    else { season = JSON.parse(localStorage.getItem("banc-season") || "[]"); }
  } catch(e){ try { season = JSON.parse(localStorage.getItem("banc-season") || "[]"); } catch(_) { season = []; } }
  seasonLoading = false;
  season.sort((a,b) => (a.date||"").localeCompare(b.date||""));
  if (mode==="coach") render();
}
async function saveMatch(){
  const sh = sheet();
  const rec = {date: S.matchDate || new Date().toISOString().slice(0,10), label: S.matchLabel || "", minutes: {}, targets: {}, us: sh.us.length, them: sh.them.length, pc: sh.pc, scorers: sh.us.map(g => g.player).filter(Boolean), cards: eventsOf().filter(e => e.type!=="bless" && e.type!=="libre").map(e => ({type:e.type, player:e.player}))};
  for (const [n,m] of Object.entries(S.plan.played)) rec.minutes[n] = Math.round(m*10)/10;
  for (const [n,m] of Object.entries(S.plan.targets||{})) rec.targets[n] = Math.round(m*10)/10;
  try {
    if (db) await db.collection("matches").add(rec);
    else { const L = JSON.parse(localStorage.getItem("banc-season") || "[]"); L.push({id:String(Date.now()), ...rec}); localStorage.setItem("banc-season", JSON.stringify(L)); }
    S.plan.savedAt = Date.now(); persist(); seasonMsg = "Match enregistré dans la saison ✓";
  } catch(e){ seasonMsg = "L'enregistrement a échoué, réessaie."; }
  season = null; render();
}
async function deleteMatch(id){
  try {
    if (db) await db.collection("matches").doc(id).delete();
    else { const L = JSON.parse(localStorage.getItem("banc-season") || "[]").filter(x => x.id !== id); localStorage.setItem("banc-season", JSON.stringify(L)); }
  } catch(e){}
  season = null; loadSeason();
}
function seasonHtml(){
  if (season === null) { loadSeason(); return `<p class="muted">Chargement…</p>`; }
  if (!season.length) return `<p class="muted">Aucun match enregistré. À la fin d'un match, touche « Enregistrer le match dans la saison » (onglet Match ou ci-dessus).</p>`;
  const stat = {};
  season.forEach(m => { Object.entries(m.minutes||{}).forEach(([n,v]) => { const s = stat[n] ||= {n:0,tot:0,dev:0,g:0}; s.n++; s.tot += v; s.dev += v - (m.targets?.[n] ?? v); }); (m.scorers||[]).forEach(n => { (stat[n] ||= {n:0,tot:0,dev:0,g:0}).g++; }); });
  const rows = Object.entries(stat).sort((a,b)=>b[1].tot-a[1].tot).map(([n,s]) => {
    const sug = s.dev <= -8 ? `<span class="i">+0,5 conseillé</span>` : s.dev >= 8 ? `<span class="o">−0,5 conseillé</span>` : `<span class="muted">—</span>`;
    return `<tr><td>${esc(n)}</td><td>${s.n}</td><td>${s.g||""}</td><td>${R.fmtMin(s.tot)}</td><td>${R.fmtMin(s.tot/s.n)}</td><td class="dev" style="color:${Math.abs(s.dev)<8?"var(--in)":"var(--out)"}">${s.dev>=0?"+":"−"}${R.fmtMin(Math.abs(s.dev))}</td><td>${sug}</td></tr>`; }).join("");
  const list = season.map(m => `<span class="mchip">${esc(m.date)}${m.label?` · ${esc(m.label)}`:""}${m.us!==undefined?` · <b>${m.us}–${m.them}</b>`:""} <button class="x" data-delm="${esc(m.id)}" aria-label="Supprimer ce match">✕</button></span>`).join("");
  return `<div class="tbl-wrap"><table class="recap"><thead><tr><th>Joueur</th><th>Matchs</th><th>Buts</th><th>Total</th><th>Moyenne</th><th>Écart cumulé</th><th>Note</th></tr></thead><tbody>${rows}</tbody></table></div>
    <p class="muted" style="font-size:.85rem;margin:10px 0 6px">Écart cumulé = minutes jouées moins minutes visées, sur tous les matchs. Les cartes comptent comme du temps hors du terrain.</p><div class="mlist">${list}</div>`;
}

/* ---------- rendering ---------- */
function render(){
  paintSub();
  $("#tabMatch").setAttribute("aria-pressed", mode==="match");
  $("#tabCoach").setAttribute("aria-pressed", mode==="coach");
  const v = $("#view");
  if (mode === "coach" && S.pin && !coachOK) { v.innerHTML = pinView(); bindPin(); return; }
  v.innerHTML = mode === "match" ? matchView() : coachView();
  mode === "match" ? bindMatch() : bindCoach();
}
function pill(id){ const m = posMeta(id); return `<span class="pos ${m.line}" title="${esc(m.label)}">${esc(m.short)}</span>`; }

function pairChanges(ch){
  const outs = ch.outs.map(([p,q]) => ({p,q})), ins = ch.ins.map(([p,q]) => ({p,q}));
  const pairs = [], usedO = new Set(), usedI = new Set();
  const tryPair = test => ins.forEach((i,ii) => { if (usedI.has(ii)) return; const oi = outs.findIndex((o,k) => !usedO.has(k) && test(i,o)); if (oi >= 0) { usedI.add(ii); usedO.add(oi); pairs.push({inP:i.p, inQ:i.q, outP:outs[oi].p, outQ:outs[oi].q}); } });
  tryPair((i,o) => i.q === o.q);
  // chain through a mover: someone left post o.q free and moved, the newcomer takes the mover's old post
  tryPair((i,o) => ch.moves.some(([m,a,b]) => b === o.q && a === i.q));
  tryPair((i,o) => posMeta(i.q).line === posMeta(o.q).line);
  tryPair(() => true);
  outs.forEach((o,k) => { if (!usedO.has(k)) pairs.push({inP:null, outP:o.p, outQ:o.q}); });
  ins.forEach((i,k) => { if (!usedI.has(k)) pairs.push({inP:i.p, inQ:i.q, outP:null}); });
  return pairs;
}
function changeLines(ch){
  let html = pairChanges(ch).map(pr => `<div class="swap">
      <div class="side in"><span class="arrow">▲ Entre</span><span class="big">${esc(pr.inP || "—")}</span></div>
      <div class="swapmid">remplace</div>
      <div class="side out"><span class="arrow">▼ Sort</span><span class="big">${esc(pr.outP || "—")}</span></div>
      ${pr.inP ? `<div class="where">${esc(pr.inP)} va au poste ${pill(pr.inQ)} <b>${esc(posMeta(pr.inQ).label)}</b>${pr.outP && pr.outQ !== pr.inQ ? ` <span class="note">(${esc(pr.outP)} jouait ${esc(posName(pr.outQ).toLowerCase())})</span>` : ""}</div>` : ""}
    </div>`).join("");
  if (ch.moves.length) html += `<div class="reorg"><div class="reorg-t">Réorganisation sur le terrain</div>${ch.moves.map(([p,a,b]) => `<div class="reorg-l"><b>${esc(p)}</b> passe de ${pill(a)} à ${pill(b)} <span class="note">${esc(posMeta(b).label)}</span></div>`).join("")}</div>`;
  return html;
}
function matchView(){
  const plan = S.plan;
  if (!plan) return `<div class="card empty"><h2>Pas encore de plan</h2><p class="muted">Va dans l'onglet Coach : coche les présents, choisis la compo, puis génère le plan de rotation.</p><button class="btn primary" id="goCoach">Aller au mode Coach</button></div>`;
  const ql = S.rules.qlen, el = clockElapsed(), t = matchT();
  const atEnd = el >= ql*60 - 0.5;
  const next = visChanges(plan).find(c => !C.done.includes(c.t) && c.t >= t - 0.01 - 0.35);
  const qEndT = C.q*ql;
  let alertHtml;
  const matchOver = atEnd && C.q >= S.rules.quarters;
  if (!next) alertHtml = `<div class="alert"><div class="alert-title">${matchOver ? "Fin du match" : "Plus de changement prévu"}</div>${matchOver ? (plan.savedAt ? `<div class="ok">Match enregistré dans la saison ✓</div>` : `<button class="btn big primary" id="saveMatch">Enregistrer le match dans la saison</button>`) : `<div class="muted">Plus aucun changement jusqu'à la fin.</div>`}${seasonMsg && matchOver ? `<div class="muted">${esc(seasonMsg)}</div>` : ""}</div>`;
  else {
    const isBreakChange = Math.abs(next.t - qEndT) < 1e-6 && C.q < S.rules.quarters;
    const secs = (next.t - t) * 60;
    const when = isBreakChange ? `Pause avant le Q${C.q+1}` : `Q${fmtQ(next.t).q} · ${fmtQ(next.t).label}`;
    let cls = "", title = "Prochain changement", count = fmtClock(secs);
    if (isBreakChange && atEnd) { cls = "now"; title = "Changement à la pause"; count = "Pause"; }
    else if (secs <= 0.5) { cls = "now"; title = "Changement maintenant"; count = "GO"; }
    else if (secs <= S.rules.alertSec) { cls = "soon"; title = "Préparez-vous"; }
    if (isBreakChange && !atEnd && secs > S.rules.alertSec) count = "À la pause";
    alertHtml = `<div class="alert ${cls}" id="alertCard"><div class="alert-head"><div><div class="alert-title">${title}</div><div style="font-weight:600">${esc(when)}</div></div><div class="count" id="count">${esc(count)}</div></div>
      <div class="moves">${changeLines(next)}</div>
      ${cls==="now" ? `<button class="btn big" id="doneBtn" style="background:#fff;color:#0b5a32">Changement fait ✓</button>` : ""}</div>`;
  }
  const seg = segAt(plan, Math.min(t, plan.segs[plan.segs.length-1].b - 0.01));
  const upcomingIds = next ? new Set(next.outs.map(o=>o[0]).concat(next.moves.map(m=>m[0]))) : new Set();
  const onIds = Object.entries(seg.on);
  const pitch = `<div class="pitch" aria-label="Joueurs sur le terrain">${pitchLines()}${PRESETS[S.preset].map(([id,label,line,x,y]) => {
      const who = onIds.find(([p,q]) => q === id)?.[0] || "Vide";
      const rl = (S.squad.find(p => p.name === who)?.roles || []).join("");
      return `<div class="pp${upcomingIds.has(who)?" chg":""}" style="left:${x}%;top:${y}%"><span class="dot ${line}">${esc(posShort(id))}</span><span class="nm">${esc(who)}${rl?` <i class="rl">${esc(rl)}</i>`:""}</span></div>`;}).join("")}</div>`;
  const benchNames = present().map(p=>p.name).filter(n => !(n in seg.on));
  const qChanges = visChanges(plan).filter(c => fmtQ(c.t).q === C.q || (Math.abs(c.t - (C.q-1)*ql) < 1e-6 && C.q>1) || (Math.abs(c.t - C.q*ql)<1e-6));
  const upList = qChanges.map(c => {
    const isBrk = Math.abs(c.t/ql - Math.round(c.t/ql)) < 1e-6;
    const lab = isBrk ? "Pause" : fmtQ(c.t).label;
    return `<div class="up-item${(C.done.includes(c.t) || c.t < t - 0.4) ? " done":""}"><div class="up-t">${lab}</div><div class="up-l">${pairChanges(c).map(pr=>`<div><span class="i">${esc(pr.inP||"—")}</span> remplace <span class="o">${esc(pr.outP||"—")}</span> ${pr.inQ?pill(pr.inQ):""}</div>`).join("")}${c.moves.map(([p,a,b])=>`<div class="m">↔ ${esc(p)} passe en ${esc(posName(b).toLowerCase())}</div>`).join("")}</div></div>`;}).join("") || `<p class="muted">Aucun changement dans ce quart.</p>`;
  const banners = activeBanners(t);
  const startBtn = C.running ? `<button class="btn big" id="pause">❚❚ Pause</button>` : (atEnd ? (C.q < S.rules.quarters ? `<button class="btn big primary" id="nextQ">Lancer le Q${C.q+1} ▸</button>` : `<span class="alert-title">Fin du match</span>`) : `<button class="btn big go" id="start">▶ ${el>0?"Reprendre":"Démarrer le Q"+C.q}</button>`);
  if (far) return `<div class="far">
      ${matchTitle() ? `<div class="alert-title" style="color:var(--muted)">${esc(matchTitle())}</div>` : ""}<div class="far-top"><span class="qbadge">Q${C.q}</span><div class="time${C.running?"":" paused"}" id="time">${fmtClock(el)}</div><span class="remain" id="remain">Reste ${fmtClock(ql*60-el)}</span></div>
      ${banners}
      ${alertHtml}
      <div class="row">${startBtn}<button class="btn" id="farOff">Vue normale</button><span class="muted" style="font-size:.85rem">Clavier : espace = démarrer/pause · ← → = 10 s</span></div>
    </div>`;
  return `<div class="match">
    <div style="display:flex;flex-direction:column;gap:18px;min-width:0">
      ${banners}
      ${incidentPanel(seg)}
      <div class="card clock">
        <div class="clock-top"><span class="qbadge">Q${C.q}</span><span class="remain" id="remain">Reste ${fmtClock(ql*60-el)}</span></div>
        <div class="time${C.running?"":" paused"}" id="time">${fmtClock(el)}</div>
        <div class="prog"><i id="progBar" style="width:${(el/(ql*60)*100).toFixed(2)}%"></i>${visChanges(plan).filter(c=>fmtQ(c.t).q===C.q && Math.abs(c.t-(C.q-1)*ql)>1e-6).map(c=>`<b style="left:${((c.t-(C.q-1)*ql)/ql*100).toFixed(2)}%"></b>`).join("")}</div>
        <div class="row">
          ${startBtn}
          <button class="btn" id="m10">−10 s</button><button class="btn" id="p10">+10 s</button>
        </div>
        <div class="row">
          <button class="btn warnb" id="incOpen">⚠ Imprévu</button>
          <button class="btn small" id="swapOpen">↔ Changement</button>
          ${S.prevPlan ? `<button class="btn" id="incUndo">↶ Annuler le dernier imprévu</button>` : ""}
          <button class="btn" id="farOn">⤢ Vue de loin</button>
          <span class="live ${liveOK?"on":""}">${liveOK ? "● En direct" : ""}</span>
        </div>
        <div class="nav" aria-label="Navigation dans le match">
          <button class="btn" id="m60">−1 min</button><button class="btn" id="p60">+1 min</button>
          <button class="btn" id="qReset">↺ Quart à 0</button>
          <button class="btn" id="qPrev" ${C.q<=1?"disabled":""}>◂ Quart préc.</button>
          <button class="btn" id="qNext" ${C.q>=S.rules.quarters?"disabled":""}>Quart suiv. ▸</button>
          <button class="btn" id="reset">Match à 0</button>
        </div>
      </div>
      ${alertHtml}
      ${sheetCard(seg)}
    </div>
    <div style="display:flex;flex-direction:column;gap:18px;min-width:0">
      <div class="card"><h2>Sur le terrain</h2>${pitch}<div style="margin-top:12px"><div class="muted" style="font-size:.85rem;margin-bottom:6px">Sur le banc</div><div class="bench">${benchNames.map(n=>`<span>${esc(n)}</span>`).join("") || '<span>Personne</span>'}</div></div></div>
      <div class="card"><h2>Changements du Q${C.q}</h2><div class="up">${upList}</div></div>
    </div></div>`;
}
function pitchLines(){ return `<div class="l" style="inset:3% 4%;border-radius:4px"></div><div class="l" style="left:4%;right:4%;top:50%;height:0;border-width:2px 0 0"></div><div class="l" style="left:28%;right:28%;top:3%;height:15%;border-radius:0 0 50% 50%/0 0 100% 100%;border-top:0"></div><div class="l" style="left:28%;right:28%;bottom:3%;height:15%;border-radius:50% 50% 0 0/100% 100% 0 0;border-bottom:0"></div>`; }

let tickTimer = null, lastAlertKey = "";
function bindMatch(){
  $("#goCoach")?.addEventListener("click", () => { mode="coach"; render(); });
  $("#start")?.addEventListener("click", startClock);
  $("#pause")?.addEventListener("click", pauseClock);
  $("#nextQ")?.addEventListener("click", () => { markBreakDone(); nextQuarter(); });
  $("#m10")?.addEventListener("click", () => adjust(-10));
  $("#p10")?.addEventListener("click", () => adjust(10));
  $("#doneBtn")?.addEventListener("click", () => { const t = matchT(); const nx = visChanges(S.plan).find(c => !C.done.includes(c.t) && c.t >= t - 0.36); if (nx) C.done.push(nx.t); pushClock(); render(); });
  $("#reset")?.addEventListener("click", function(){ if (this.dataset.armed) { resetMatch(); } else { this.dataset.armed = 1; this.textContent = "Sûr ? Touche encore"; } });
  $("#m60")?.addEventListener("click", () => adjust(-60));
  $("#p60")?.addEventListener("click", () => adjust(60));
  $("#qReset")?.addEventListener("click", () => setClock(C.q, 0));
  $("#qPrev")?.addEventListener("click", () => setClock(C.q - 1, 0));
  $("#qNext")?.addEventListener("click", () => setClock(C.q + 1, 0));
  $("#farOn")?.addEventListener("click", () => setFar(true));
  $("#farOff")?.addEventListener("click", () => setFar(false));
  $("#saveMatch")?.addEventListener("click", saveMatch);
  $("#incOpen")?.addEventListener("click", () => { inc = {type:null, player:null, catchUp:false}; incMsg = ""; render(); });
  $("#incCancel")?.addEventListener("click", () => { inc = null; render(); });
  $("#incUndo")?.addEventListener("click", function(){ if (this.dataset.armed) { S.plan = S.prevPlan; S.prevPlan = null; syncDone(); pushClock(); persist(); render(); } else { this.dataset.armed = 1; this.textContent = "Sûr ? Touche encore"; } });
  $("#swapOpen")?.addEventListener("click", () => { inc = {type:"libre", player:null, inP:null}; incMsg = ""; render(); });
  document.querySelectorAll("[data-swo]").forEach(b => b.addEventListener("click", () => { inc.player = b.dataset.swo; render(); }));
  document.querySelectorAll("[data-swi]").forEach(b => b.addEventListener("click", () => { inc.inP = b.dataset.swi; render(); }));
  bindSheet();
  document.querySelectorAll("[data-inct]").forEach(b => b.addEventListener("click", () => { inc.type = b.dataset.inct; render(); }));
  document.querySelectorAll("[data-incp]").forEach(b => b.addEventListener("click", () => { inc.player = b.dataset.incp; render(); }));
  $("#catchUp")?.addEventListener("change", e => { inc.catchUp = e.target.checked; });
  $("#incGo")?.addEventListener("click", () => { incBusy = true; render(); setTimeout(doIncident, 40); });
}
function setFar(v){ far = v; try { localStorage.setItem("banc-far", v ? "1" : "0"); } catch(e){} render(); }
document.addEventListener("keydown", e => {
  if (mode !== "match" || !S.plan || /INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName || "")) return;
  if (e.code === "Space") { e.preventDefault(); C.running ? pauseClock() : (clockElapsed() >= S.rules.qlen*60 - 0.5 ? (markBreakDone(), nextQuarter()) : startClock()); }
  else if (e.key === "ArrowRight") adjust(10);
  else if (e.key === "ArrowLeft") adjust(-10);
  else if (e.key === "f" || e.key === "F") setFar(!far);
});
function markBreakDone(){ const qEndT = C.q*S.rules.qlen; visChanges(S.plan).forEach(c => { if (Math.abs(c.t-qEndT)<1e-6 && !C.done.includes(c.t)) C.done.push(c.t); }); pushClock(); }
function tick(){
  if (mode !== "match" || !S.plan) return;
  const el = clockElapsed();
  if (C.running && el >= S.rules.qlen*60) { C.elapsed = S.rules.qlen*60; C.running = false; saveClock(); beep(3); render(); return; }
  // auto mark change done 25 s after its time
  const t = matchT();
  visChanges(S.plan).forEach(c => { if (!C.done.includes(c.t) && (t - c.t)*60 > 25) C.done.push(c.t); });
  const next = visChanges(S.plan).find(c => !C.done.includes(c.t) && c.t >= t - 0.36);
  const secs = next ? (next.t - t)*60 : 1e9;
  const nb = eventsOf().filter(e => (e.type==="vert"||e.type==="jaune") && t >= e.t && t < e.t + e.d).length;
  const state = (next ? (secs <= 0.5 ? "now" : secs <= S.rules.alertSec ? "soon" : "far") + next.t : "none") + "|" + nb;
  if (state !== lastAlertKey) { if (state.startsWith("soon") && !lastAlertKey.startsWith("soon")) beep(2); if (state.startsWith("now") && !lastAlertKey.startsWith("now")) beep(1); lastAlertKey = state; if (!inc) render(); return; }
  const te = $("#time"); if (te) te.textContent = fmtClock(el);
  const re = $("#remain"); if (re) re.textContent = "Reste " + fmtClock(S.rules.qlen*60 - el);
  const pb = $("#progBar"); if (pb) pb.style.width = (el/(S.rules.qlen*60)*100).toFixed(2) + "%";
  document.querySelectorAll("[data-until]").forEach(sp => { const left = (+sp.dataset.until - t)*60; if (left <= 0) { lastAlertKey = ""; } sp.textContent = fmtClock(left); });
  const ce = $("#count"); if (ce && next && secs > 0.5 && !(Math.abs(next.t - C.q*S.rules.qlen)<1e-6 && secs > S.rules.alertSec)) ce.textContent = fmtClock(secs);
}

/* ---------- coach ---------- */
function pinView(){ return `<div class="card pin"><h2>Mode coach</h2><p class="muted">Entre le code coach pour voir l'effectif et les temps de jeu.</p><input id="pinIn" inputmode="numeric" maxlength="6" autocomplete="off" aria-label="Code coach"><div id="pinErr" class="muted" style="min-height:1.4em"></div><button class="btn primary" id="pinGo">Entrer</button></div>`; }
function bindPin(){ const go = () => { if ($("#pinIn").value === S.pin) { coachOK = true; render(); } else { $("#pinErr").textContent = "Code incorrect, réessaie."; } }; $("#pinGo").addEventListener("click", go); $("#pinIn").addEventListener("keydown", e => { if (e.key==="Enter") go(); }); $("#pinIn").focus(); }

function coachView(){
  const T = computeTargets();
  const ids = PRESETS[S.preset].map(p=>p[0]);
  const rows = S.squad.map((p,i) => `<tr class="${p.present?"":"absent"}">
    <td><input type="checkbox" data-i="${i}" data-k="present" ${p.present?"checked":""} aria-label="Présent"></td>
    <td><input class="name" type="text" data-i="${i}" data-k="name" value="${esc(p.name)}" aria-label="Nom"></td>
    <td><div class="posed">${p.pos.map((q,k) => `<button class="pchip ${posMeta(q).line}" data-rmpos="${i}" data-q="${esc(q)}" title="Retirer ${esc(posName(q))}">${k+1}. ${esc(posShort(q))} ✕</button>`).join("")}<select data-addpos="${i}" aria-label="Ajouter un poste à ${esc(p.name)}"><option value="">+ poste</option>${PRESETS[S.preset].filter(x => !p.pos.includes(x[0])).map(x => `<option value="${x[0]}">${esc(x[1])}</option>`).join("")}</select></div></td>
    <td><select data-i="${i}" data-k="note" aria-label="Note">${[2,2.5,3,3.5,4,4.5,5].map(n=>`<option ${+p.note===n?"selected":""}>${n}</option>`).join("")}</select></td>
    <td><input type="number" step="0.5" min="0" data-i="${i}" data-k="minutes" value="${p.minutes||""}" placeholder="${p.present && T[p.name]!==undefined ? R.fmtMin(T[p.name]).replace("'",",").replace(/,$/,"") : ""}" aria-label="Minutes fixées"></td>
    <td><input type="number" step="1" min="0" data-i="${i}" data-k="maxStint" value="${p.maxStint||""}" placeholder="—" aria-label="Passage max"></td>
    <td><div class="roles">${["D","B"].map(r => `<button class="role${(p.roles||[]).includes(r)?" on":""}" data-role="${r}" data-ri="${i}" title="${({D:"Donneur",B:"Bloqueur"})[r]}" aria-pressed="${(p.roles||[]).includes(r)}">${r}</button>`).join("")}</div></td>
    <td><button class="x" data-del="${i}" aria-label="Supprimer ${esc(p.name)}">✕</button></td></tr>`).join("");
  const pres = present();
  const lineupSel = PRESETS[S.preset].map(([id,label,line,x,y]) => `<div class="pp" style="left:${x}%;top:${y}%"><span class="dot ${line}">${esc(posShort(id))}</span><select data-lu="${id}" aria-label="${esc(label)}"><option value="">—</option>${pres.filter(p=>p.pos.includes(id)).concat(pres.filter(p=>!p.pos.includes(id))).map(p=>`<option ${S.lineup[id]===p.name?"selected":""}>${esc(p.name)}</option>`).join("")}</select></div>`).join("");
  const rulesHtml = RULE_LABELS.map(([k,l,st]) => `<label>${esc(l)}<input type="number" step="${st}" data-rule="${k}" value="${S.rules[k]}"></label>`).join("");
  return `
  ${!S.squad.length ? `<div class="card"><h2>Bienvenue</h2><p class="muted" style="margin:0">Donne un nom à ton équipe, puis ajoute tes joueurs dans « Effectif ». Tu as déjà une sauvegarde ? Charge-la dans « Sauvegarde » plus bas.</p></div>` : ""}
  <div class="card"><h2>Équipe</h2>
    <div class="row"><input type="text" id="tName" value="${esc(S.teamName||"")}" placeholder="Nom de l'équipe, ex. Messieurs 1" aria-label="Nom de l'équipe" style="flex:1;min-width:200px;border:1px solid var(--rule);border-radius:8px;padding:8px 10px;background:var(--bg);font-weight:600"></div>
  </div>
  <div class="card"><h2>Match</h2>
    <div class="row"><input type="text" id="mLabel" value="${esc(S.matchLabel||"")}" placeholder="Nom du match, ex. Wellington – Daring" aria-label="Nom du match" style="flex:1;min-width:200px;border:1px solid var(--rule);border-radius:8px;padding:8px 10px;background:var(--bg);font-weight:600">
      <input type="date" id="mDate" value="${esc(S.matchDate||"")}" aria-label="Date du match" style="border:1px solid var(--rule);border-radius:8px;padding:7px 10px;background:var(--bg)"></div>
  </div>
  <div class="card"><h2>Code coach</h2>
    <p class="muted" style="margin:0 0 10px;font-size:.92rem">${S.pin ? "Un code protège cet onglet. Les joueurs ne voient que l'onglet Match." : "Aucun code pour l'instant : n'importe qui peut ouvrir cet onglet et voir les notes et les minutes."}</p>
    <div class="row"><input type="text" inputmode="numeric" maxlength="6" id="pinSet" value="${esc(S.pin)}" placeholder="ex. 1234" aria-label="Code coach" style="font:800 1.4rem var(--display);width:130px;text-align:center;letter-spacing:.2em;border:2px solid var(--rule);border-radius:10px;padding:6px;background:var(--bg)">
      <button class="btn primary" id="pinSave">Enregistrer le code</button>
      ${S.pin ? `<button class="btn" id="lockNow">🔒 Verrouiller maintenant</button>` : ""}
      <span id="pinMsg" class="muted" style="font-size:.9rem"></span></div>
  </div>
  <div class="card"><div class="row" style="justify-content:space-between"><h2 style="margin:0">Effectif</h2><span class="save" id="saveState">${esc(saveState)}</span></div>
    <p class="muted" style="margin:6px 0 12px;font-size:.9rem">Coche les présents. Postes dans l'ordre de préférence (le 1. est son meilleur poste ; touche un poste pour le retirer). Note 5 = tout le match. Laisse « Minutes » vide pour un calcul automatique à partir des notes. Corners : D donneur, B bloqueur.</p>
    <div class="tbl-wrap"><table><thead><tr><th>Là</th><th>Nom</th><th>Postes</th><th>Note</th><th>Minutes</th><th>Passage max</th><th title="Rôles sur corner">Corners</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
    <div class="row" style="margin-top:10px"><button class="btn" id="addP">+ Ajouter un joueur</button><button class="btn" id="clearMin">Effacer les minutes fixées</button><span class="muted" style="font-size:.9rem">${pres.length} présents</span></div>
  </div>
  <div class="grid2">
    <div class="card"><h2>Système et compo de départ</h2>
      <div class="row" style="margin-bottom:12px"><label for="preset" class="muted">Système</label><select id="preset" style="border:1px solid var(--rule);border-radius:8px;padding:6px 10px;background:var(--bg)">${Object.keys(PRESETS).map(k=>`<option ${k===S.preset?"selected":""}>${k}</option>`).join("")}</select></div>
      <div class="pitch">${pitchLines()}${lineupSel}</div>
    </div>
    <div class="card"><h2>Règles</h2><div class="rules">${rulesHtml}</div>
    </div>
  </div>
  <div class="card"><h2>Sauvegarde</h2>
    <p class="muted" style="margin:0 0 10px;font-size:.92rem">Tout est gardé sur ce téléphone. Télécharge une sauvegarde de temps en temps (effectif, plan, saison) : elle te permet de tout retrouver sur un autre appareil. Le code coach n'est pas dans le fichier.</p>
    <div class="row"><button class="btn primary" id="bkOut">⬇ Télécharger une sauvegarde</button><label class="btn" style="display:inline-block">⬆ Charger une sauvegarde<input type="file" id="bkIn" accept=".json,application/json" hidden></label></div>
    ${backupMsg ? `<div class="ok" style="margin-top:10px">${esc(backupMsg)}</div>` : ""}
  </div>
  <div class="card"><div class="row" style="justify-content:space-between"><h2 style="margin:0">Saison</h2>
    <div class="row">${S.plan && !S.plan.savedAt ? `<button class="btn primary" id="saveMatchC">Enregistrer le match en cours</button>` : ""}</div></div>
    ${seasonMsg ? `<div class="ok" style="margin-top:8px">${esc(seasonMsg)}</div>` : ""}
    <div style="margin-top:12px">${seasonHtml()}</div>
  </div>
  <div class="card"><div class="row" style="justify-content:space-between"><h2 style="margin:0">Plan de rotation</h2>
    <div class="row">${S.plan ? `<button class="btn" id="pdfB">📄 Plan B (PDF)</button>` : ""}<button class="btn primary" id="gen">${preview ? "Autre version" : "Générer le plan"}</button>${preview && !preview.error ? `<button class="btn go" id="use">Utiliser pour le match</button>` : ""}</div></div>
    <div id="genOut" style="margin-top:12px">${previewHtml()}</div>
  </div>`;
}
const nicePos = w => String(w).replace(/le poste (\w+)/g, (m, q) => "le poste « " + posName(q) + " »");
function previewHtml(){
  const plan = preview || S.plan;
  if (!plan) return `<p class="muted">Clique sur « Générer le plan » une fois l'effectif et la compo prêts.</p>`;
  if (plan.error) return `<div class="warn">${plan.warnings.map(w => esc(nicePos(w))).join("<br>")}</div>`;
  const tag = preview ? `<div class="warn" style="background:var(--chip);color:var(--ink)">Nouvelle version, pas encore utilisée pour le match.</div>` : `<div class="ok">Plan actif pour le match.</div>`;
  const warn = plan.warnings.length ? `<div class="warn" style="margin-top:8px">${plan.warnings.map(w => esc(nicePos(w))).join("<br>")}</div>` : `<div class="ok" style="margin-top:8px">Toutes les règles sont respectées. ${plan.changes.length} fenêtres de changement.</div>`;
  const names = Object.keys(plan.played).sort((a,b)=>plan.played[b]-plan.played[a]);
  const END = S.rules.quarters*S.rules.qlen;
  const rec = names.map(n => { const d = plan.played[n]-plan.targets[n]; return `<tr><td>${esc(n)}</td><td>${R.fmtMin(plan.played[n])}</td><td class="muted">${R.fmtMin(plan.targets[n])}</td><td class="dev" style="color:${Math.abs(d)<=1.5?"var(--in)":"var(--out)"}">${d>=0?"+":"−"}${R.fmtMin(Math.abs(d))}</td></tr>`; }).join("");
  const tl = names.map(n => `<div class="tlr"><div>${esc(n)}</div><div class="trk">${plan.segs.map(s => s.on[n] ? `<i style="left:${s.a/END*100}%;width:${(s.b-s.a)/END*100}%;background:var(--${posMeta(s.on[n]).line})">${(s.b-s.a)>=2.5?esc(posShort(s.on[n])):""}</i>` : "").join("")}${[1,2,3].map(k=>`<span class="q" style="left:${k*25}%"></span>`).join("")}</div></div>`).join("");
  return `${tag}${warn}<div class="grid2" style="margin-top:12px"><div class="tbl-wrap"><table class="recap"><thead><tr><th>Joueur</th><th>Prévu</th><th>Visé</th><th>Écart</th></tr></thead><tbody>${rec}</tbody></table></div><div class="tl"><div class="tl-in">${tl}</div></div></div>`;
}
function bindCoach(){
  const v = $("#view");
  v.querySelectorAll("[data-i]").forEach(el => el.addEventListener("change", () => {
    const p = S.squad[+el.dataset.i], k = el.dataset.k;
    if (k === "present") p.present = el.checked;
    else if (k === "pos") p.pos = el.value.split(/[ ,;/]+/).map(x => x.trim().toUpperCase()).filter(Boolean);
    else if (k === "note") p.note = +el.value;
    else if (k === "minutes" || k === "maxStint") p[k] = el.value ? +el.value : 0;
    else p[k] = el.value;
    preview = null; persist(); render();
  }));
  v.querySelectorAll("[data-del]").forEach(el => el.addEventListener("click", () => { if (el.dataset.armed) { S.squad.splice(+el.dataset.del,1); preview=null; persist(); render(); } else { el.dataset.armed=1; el.textContent="Sûr ?"; } }));
  v.querySelectorAll("[data-rmpos]").forEach(b => b.addEventListener("click", () => { const p = S.squad[+b.dataset.rmpos]; p.pos = p.pos.filter(q => q !== b.dataset.q); preview = null; persist(); render(); }));
  v.querySelectorAll("[data-addpos]").forEach(sel => sel.addEventListener("change", () => { if (!sel.value) return; const p = S.squad[+sel.dataset.addpos]; p.pos = [...p.pos, sel.value]; preview = null; persist(); render(); }));
  v.querySelectorAll("[data-role]").forEach(b => b.addEventListener("click", () => { const p = S.squad[+b.dataset.ri]; p.roles ||= []; const r = b.dataset.role; p.roles = p.roles.includes(r) ? p.roles.filter(x => x !== r) : [...p.roles, r]; preview = null; persist(); render(); }));
  $("#addP").addEventListener("click", () => { S.squad.push({name:"Nouveau joueur",pos:[],note:3,present:true,minutes:0,maxStint:0}); persist(); render(); });
  $("#clearMin").addEventListener("click", () => { S.squad.forEach(p => p.minutes = 0); preview=null; persist(); render(); });
  $("#preset").addEventListener("change", e => { S.preset = e.target.value; S.lineup = {}; preview=null; persist(); render(); });
  v.querySelectorAll("[data-lu]").forEach(el => el.addEventListener("change", () => { const id = el.dataset.lu; for (const k in S.lineup) if (S.lineup[k] === el.value && k !== id) delete S.lineup[k]; if (el.value) S.lineup[id] = el.value; else delete S.lineup[id]; preview=null; persist(); render(); }));
  v.querySelectorAll("[data-rule]").forEach(el => el.addEventListener("change", () => { S.rules[el.dataset.rule] = +el.value; preview=null; persist(); render(); }));
  $("#pinSave").addEventListener("click", () => { S.pin = $("#pinSet").value.trim(); persist(); coachOK = true; render(); const m = $("#pinMsg"); if (m) m.textContent = S.pin ? "Code enregistré." : "Code supprimé."; });
  $("#lockNow")?.addEventListener("click", () => { coachOK = false; mode = "match"; render(); });
  $("#pdfB")?.addEventListener("click", makePdf);
  $("#matchLabel")?.addEventListener("change", e => { S.matchLabel = e.target.value; persist(); render(); });
  $("#tName")?.addEventListener("change", e => { S.teamName = e.target.value.trim(); persist(); render(); });
  $("#bkOut")?.addEventListener("click", exportBackup);
  $("#bkIn")?.addEventListener("change", e => { const f = e.target.files[0]; if (f) importBackup(f); });
  $("#mLabel")?.addEventListener("change", e => { S.matchLabel = e.target.value.trim(); persist(); render(); });
  $("#mDate")?.addEventListener("change", e => { S.matchDate = e.target.value; persist(); render(); });
  $("#saveMatchC")?.addEventListener("click", saveMatch);
  document.querySelectorAll("[data-delm]").forEach(b => b.addEventListener("click", () => { if (b.dataset.armed) deleteMatch(b.dataset.delm); else { b.dataset.armed = 1; b.textContent = "Sûr ?"; } }));
  $("#gen").addEventListener("click", () => { const b = $("#gen"); b.disabled = true; b.textContent = "Calcul…"; setTimeout(() => { preview = generate(Date.now() % 100000 + (seedN++)); render(); }, 30); });
  $("#use")?.addEventListener("click", () => { S.plan = preview; preview = null; S.prevPlan = null; S.sheet = {us:[], them:[], pc:0, log:[]}; C = {q:1,elapsed:0,running:false,startedAt:0,done:[]}; pushClock(); persist(); render(); });
}

/* ---------- boot ---------- */
$("#tabMatch").addEventListener("click", () => { mode = "match"; render(); });
$("#tabCoach").addEventListener("click", () => { mode = "coach"; render(); });
loadLocal();
saveState = "Données de cet appareil";
render(); paintSub();
setInterval(tick, 250);
// La synchro en ligne (code d'équipe, chrono partagé) arrive à l'étape suivante.

