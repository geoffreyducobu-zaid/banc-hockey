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
let mode = "home", coachOK = false, preview = null, seedN = 1;
const SID = Math.random().toString(36).slice(2);
let inc = null, incBusy = false, incMsg = "";
// Réglages de l'app, propres à cet appareil (pas dans la sauvegarde).
let prefs = {sound:true, vibrate:true, theme:"auto"}; try { prefs = {...prefs, ...JSON.parse(localStorage.getItem("banc-prefs") || "{}")}; } catch(e){}
function savePrefs(){ try { localStorage.setItem("banc-prefs", JSON.stringify(prefs)); } catch(e){} }
function applyTheme(){ if (prefs.theme === "auto") document.documentElement.removeAttribute("data-theme"); else document.documentElement.setAttribute("data-theme", prefs.theme); }
/* ---------- couleur principale (couleur du club) ----------
   Le coach choisit une couleur (S.color, suit son compte). On en tire une teinte plus foncée pour la barre du haut,
   la couleur du texte posé dessus (blanc ou presque noir, le plus lisible des deux), et une version de la couleur
   assez foncée (thème clair) ou assez claire (thème sombre) pour être lue comme du texte sur les cartes. */
const DEFAULT_COLOR = "#0d5fa8";
const CLUB_COLORS = [["#0d5fa8","Bleu"],["#13294b","Bleu marine"],["#4fa3e0","Bleu ciel"],["#c8102e","Rouge"],["#7a1f3d","Bordeaux"],["#e8730c","Orange"],["#f2c200","Jaune"],["#0b7a43","Vert"],["#5b2d8e","Violet"],["#1d1d1f","Noir"]];
const hexOk = h => /^#[0-9a-f]{6}$/i.test(h || "");
const hexRgb = h => [1,3,5].map(i => parseInt(h.substr(i,2), 16));
const rgbHex = c => "#" + c.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");
function lum(h){ const [r,g,b] = hexRgb(h).map(v => { v /= 255; return v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4); }); return 0.2126*r + 0.7152*g + 0.0722*b; }
function contrast(a, b){ const x = lum(a), y = lum(b); return (Math.max(x,y) + 0.05) / (Math.min(x,y) + 0.05); }
const mix = (h, to, t) => { const a = hexRgb(h), b = hexRgb(to); return rgbHex(a.map((v,i) => v + (b[i]-v)*t)); };
const INK = "#0f1d2b";
const onColor = h => contrast(h, "#ffffff") >= contrast(h, INK) ? "#ffffff" : INK;
// Pousse la couleur vers « to » jusqu'à atteindre le contraste voulu avec « bg ».
function readableOn(h, bg, to, min){ for (let t = 0; t <= 1; t += 0.05) { const c = mix(h, to, t); if (contrast(c, bg) >= min) return c; } return to; }
function clubPalette(h){
  if (!hexOk(h)) h = DEFAULT_COLOR;
  const club2 = lum(h) > 0.4 ? h : mix(h, "#000000", 0.15);
  return {club:h, club2, onclub:onColor(h), onclub2:onColor(club2),
    "clubink-l":readableOn(h, "#ffffff", "#000000", 4.5), "clubink-d":readableOn(h, "#132130", "#ffffff", 4.5)};
}
let appliedColor = "";
function applyColor(){
  const h = hexOk(S.color) ? S.color.toLowerCase() : DEFAULT_COLOR;
  if (h === appliedColor) return;
  appliedColor = h;
  const p = clubPalette(h), st = document.documentElement.style;
  Object.entries(p).forEach(([k,v]) => st.setProperty("--" + k, v));
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", p.club2);
}
const canVibrate = typeof navigator !== "undefined" && "vibrate" in navigator;
let far = false; try { far = localStorage.getItem("banc-far") === "1"; } catch(e){}
let season = null, seasonMsg = "";
let saveState = "";
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
// L'adjoint ne touche jamais aux données du téléphone : il ne fait qu'afficher le match du coach.
function saveLocal(){ if (ADJ) return; try { localStorage.setItem("banc-state", JSON.stringify(S)); } catch(e){} }
function loadClock(){ try { return JSON.parse(localStorage.getItem("banc-clock") || "null") || {q:1,elapsed:0,running:false,startedAt:0,done:[]}; } catch(e){ return {q:1,elapsed:0,running:false,startedAt:0,done:[]}; } }
function saveClock(){ if (ADJ) return; try { localStorage.setItem("banc-clock", JSON.stringify(C)); } catch(e){} }
function pushClock(){ saveClock(); liveSendClock(); }
// Toujours enregistré sur le téléphone d'abord ; cloud.js l'envoie en ligne si le coach a un compte.
function persist(){ if (ADJ) return; saveLocal(); markChanged(); liveChanged(); }
function teamTitle(){ return [S.profile?.club, S.teamName].filter(Boolean).join(" · ") || "StickMate"; }
const slug = s => String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "equipe";
function paintSub(){ const bn = $("#brandName"); if (bn) bn.textContent = teamTitle(); document.title = S.teamName ? `StickMate · ${S.teamName}` : "StickMate";
 const el = $("#sub"); if (el && ADJ) { el.innerHTML = `Adjoint<br>` + (matchTitle() ? `<b style="font-weight:600">${esc(matchTitle())}</b><br>` : "") + `<span style="opacity:.7">${esc(adjointSub())}</span>`; return; }
 if (el) el.innerHTML = (S.profile?.first ? `Coach ${esc(S.profile.first)}<br>` : "") + (matchTitle() ? `<b style="font-weight:600">${esc(matchTitle())}</b><br>` : "") + `<span style="opacity:.7">${esc(saveState)}</span>`; paintSave(); }
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
  const tm = timeMode(), byNotes = R.targetsFromNotes(P, ids.length - 1, END).targets;
  if (tm === "notes") return byNotes;
  // Égal pour tous : un seul groupe. Égal par ligne : la ligne du premier poste du joueur.
  const groupOf = id => tm === "all" ? "all" : lineGroup(posMeta(id).line);
  const slots = {}; ids.slice(1).forEach(id => slots[groupOf(id)] = (slots[groupOf(id)] || 0) + 1);
  P.forEach(x => { const pl = present().find(p => p.name === x.name); x.group = groupOf(pl.pos.find(q => q !== gk) || ""); });
  const eq = R.targetsEqual(P, slots, END).targets;
  P.forEach(x => { if (!x.field) eq[x.name] = byNotes[x.name]; }); // le gardien garde son calcul habituel
  return eq;
}
// Temps de jeu du match : "notes" (étoiles et minutes fixées), "all" (égal pour tous), "line" (égal par ligne).
const timeMode = () => S.timeMode || "notes";
const lineGroup = l => l === "def" ? "def" : l === "att" ? "att" : "mid";
const TIME_MODES = [["notes","Selon mes choix"],["all","Égal pour tous"],["line","Égal par ligne"]];
// En temps égal, les étoiles des joueurs de champ ne comptent pas (pas de joueur bloqué tout le match).
const star = p => timeMode() === "notes" || !p.pos.some(q => q !== "G") ? +p.note : 0;
function syncMinStint(){ S.rules.minStint = Math.min(+S.rules.minDef, +S.rules.minMid, +S.rules.minAtt); }
function generate(seed){
  syncMinStint();
  const positions = PRESETS[S.preset].map(p => ({id:p[0], gk:p[2]==="gk"}));
  const T = computeTargets();
  const players = present().map(p => ({name:p.name, pos:p.pos, target:T[p.name], locked: (star(p) >= 5 && !p.minutes), oneBlock: star(p) >= 5, maxStint: p.maxStint ? +p.maxStint : 0, roles: p.roles || [], minFirst: p.minFirst || 0, minStint: minStintOf(p)}));
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
      if (timedCard(e.type) && (Math.abs(c.t-e.t)<1e-6 || Math.abs(c.t-(e.t+e.d))<1e-6)) skip.add(e.player);
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
/* ---------- plusieurs matchs ---------- */
// Le match ouvert vit dans S (plan, compo, feuille, présents) et le chrono dans C.
// Les autres matchs sont rangés dans S.matches ; on échange en changeant de match.
const MATCH_KEYS = ["matchLabel","matchDate","preset","timeMode","lineup","plan","prevPlan","basePlan","sheet"];
const freshClock = () => ({q:1,elapsed:0,running:false,startedAt:0,done:[]});
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2,5);
let matchesOpen = false, newMatchForm = false;
function curMatchRec(){
  const r = {id:S.curMatch}; MATCH_KEYS.forEach(k => r[k] = S[k] ?? null);
  r.present = S.squad.filter(p => p.present).map(p => p.name);
  r.clock = {...C, running:false, elapsed: clockElapsed()};
  return JSON.parse(JSON.stringify(r));
}
function ensureMatches(){
  if (!Array.isArray(S.matches)) S.matches = [];
  // Réparer les matchs restés sans identifiant (ils ne pouvaient plus être ouverts ni supprimés).
  S.matches.forEach(m => { if (!m.id) m.id = newId(); });
  if (!S.curMatch) S.curMatch = newId();
  if (!S.matches.some(m => m.id === S.curMatch)) S.matches.push(curMatchRec());
}
function storeCur(){ const i = S.matches.findIndex(m => m.id === S.curMatch); if (i >= 0) S.matches[i] = curMatchRec(); else S.matches.push(curMatchRec()); }
function openMatch(id, store = true){
  if (store) storeCur();
  const r = S.matches.find(m => m.id === id); if (!r) return;
  S.curMatch = id;
  S.matchLabel = r.matchLabel || ""; S.matchDate = r.matchDate || "";
  S.preset = r.preset || S.preset; S.timeMode = r.timeMode || "notes"; S.lineup = r.lineup || {}; S.plan = r.plan || null; S.prevPlan = r.prevPlan || null; S.basePlan = r.basePlan || null;
  S.sheet = r.sheet || {us:[], them:[], pc:0, log:[]};
  if (Array.isArray(r.present)) S.squad.forEach(p => p.present = r.present.includes(p.name));
  C = r.clock || freshClock(); C.running = false;
  preview = null; inc = null; lastAlertKey = ""; persist(); pushClock();
}
function createMatch(opp, date, home){
  if (S.curMatch) storeCur();
  const us = S.profile?.club || S.teamName || "Nous";
  const r = {id:newId(), matchLabel: opp ? (home ? `${us} – ${opp}` : `${opp} – ${us}`) : "", matchDate: date || "", preset:S.preset, timeMode:timeMode(), lineup:{...S.lineup}, plan:null, prevPlan:null, basePlan:null, sheet:{us:[], them:[], pc:0, log:[]}, present: S.squad.map(p => p.name), clock: freshClock()};
  S.matches.push(r); openMatch(r.id, false);
}
function removeMatch(id){
  S.matches = S.matches.filter(m => m.id !== id);
  if (id === S.curMatch) { if (S.matches.length) openMatch(sortedMatches()[0].id, false); else { S.curMatch = null; createMatch("", "", true); } }
  persist();
}
function matchStatus(r){
  if (r.plan?.savedAt) return `Terminé · ${r.sheet?.us?.length || 0}–${r.sheet?.them?.length || 0}`;
  if (r.plan && r.clock && (r.clock.q > 1 || r.clock.elapsed > 0)) return `En cours · Q${r.clock.q}`;
  return r.plan ? "Plan prêt" : "À préparer";
}
function sortedMatches(){
  const L = S.matches.map(m => m.id === S.curMatch ? curMatchRec() : m);
  return L.sort((a,b) => (a.matchDate || "9999").localeCompare(b.matchDate || "9999"));
}
const fmtDate = d => { if (!d) return "Sans date"; try { return new Date(d + "T12:00:00").toLocaleDateString("fr-BE", {weekday:"short", day:"numeric", month:"short"}); } catch(e){ return d; } };
function matchBar(){
  return `<div class="card mbar"><div style="min-width:0"><div class="muted" style="font-size:.8rem;text-transform:uppercase;letter-spacing:.06em">Match ouvert</div><b>${esc(S.matchLabel || "Match sans nom")}</b> <span class="muted">· ${esc(fmtDate(S.matchDate))}</span></div><button class="btn small" id="mList">Mes matchs (${S.matches.length})</button></div>`;
}
function matchesView(){
  const rows = sortedMatches().map(r => `<div class="mrow${r.id === S.curMatch ? " cur" : ""}">
      <button class="mopen" data-mopen="${esc(r.id)}"><b>${esc(r.matchLabel || "Match sans nom")}</b><span class="muted">${esc(fmtDate(r.matchDate))} · ${esc(matchStatus(r))}</span></button>
      ${r.id === S.curMatch ? `<span class="live">Ouvert</span>` : ""}
      <button class="x" data-mdel="${esc(r.id)}" aria-label="Supprimer ce match">✕</button></div>`).join("");
  return `<div class="card"><div class="row" style="justify-content:space-between"><h2 style="margin:0">Mes matchs</h2><button class="btn small" id="mClose">Fermer</button></div>
    <div class="mlist2" style="margin-top:12px">${rows}</div>
    ${newMatchForm ? `<div class="form" style="margin-top:14px">
        <label class="fld"><span>Adversaire</span><input type="text" id="nmOpp" placeholder="ex. Daring" autocomplete="off"></label>
        <label class="fld"><span>Date</span><input type="date" id="nmDate"></label></div>
      <div class="row" style="margin-top:10px">${segBtnsLocal()}</div>
      <div class="row" style="margin-top:12px"><button class="btn go" id="nmGo">Créer le match</button><button class="btn" id="nmCancel">Annuler</button></div>`
      : `<button class="btn primary" id="nmOpen" style="margin-top:14px">+ Nouveau match</button>`}
    <p class="muted" style="margin:12px 0 0;font-size:.88rem">Chaque match garde ses présents, sa compo, son plan, son chrono et son score. À la fin du dernier quart, le match va tout seul dans le suivi de saison.</p>
  </div>`;
}
let nmHome = true;
function segBtnsLocal(){ return `<div class="seg" role="group"><button data-nmhome="1" aria-pressed="${nmHome}">Domicile</button><button data-nmhome="0" aria-pressed="${!nmHome}">Extérieur</button></div>`; }
function bindMatches(){
  $("#mList")?.addEventListener("click", () => { matchesOpen = true; render(); });
  $("#mClose")?.addEventListener("click", () => { matchesOpen = false; newMatchForm = false; render(); });
  $("#nmOpen")?.addEventListener("click", () => { newMatchForm = true; render(); $("#nmOpp")?.focus(); });
  $("#nmCancel")?.addEventListener("click", () => { newMatchForm = false; render(); });
  document.querySelectorAll("[data-nmhome]").forEach(b => b.addEventListener("click", () => { const o = $("#nmOpp").value, d = $("#nmDate").value; nmHome = b.dataset.nmhome === "1"; render(); $("#nmOpp").value = o; $("#nmDate").value = d; }));
  $("#nmGo")?.addEventListener("click", () => { createMatch($("#nmOpp").value.trim(), $("#nmDate").value, nmHome); newMatchForm = false; matchesOpen = false; render(); });
  document.querySelectorAll("[data-mopen]").forEach(b => b.addEventListener("click", () => { if (b.dataset.mopen !== S.curMatch) openMatch(b.dataset.mopen); matchesOpen = false; render(); }));
  document.querySelectorAll("[data-mdel]").forEach(b => b.addEventListener("click", function(){ if (this.dataset.armed) { removeMatch(this.dataset.mdel); render(); } else { this.dataset.armed = 1; this.textContent = "Sûr ?"; } }));
}
// Match à 0 : on oublie aussi les imprévus et on revient au plan d'avant le premier imprévu.
function resetMatch(){ C = {q:1,elapsed:0,running:false,startedAt:0,done:[]}; S.sheet = {us:[], them:[], pc:0, log:[]}; if (S.basePlan) S.plan = S.basePlan; S.basePlan = null; S.prevPlan = null; inc = null; incBusy = false; incMsg = ""; lastAlertKey = ""; persist(); pushClock(); render(); }
let actx = null;
function unlockAudio(){ try { actx = actx || new (window.AudioContext||window.webkitAudioContext)(); actx.resume?.(); } catch(e){} }
function beep(n){ if (prefs.vibrate && canVibrate) { try { navigator.vibrate(Array.from({length:n}, () => [200,100]).flat()); } catch(e){} } if (!actx || !prefs.sound) return; try { for (let i=0;i<n;i++){ const o = actx.createOscillator(), g = actx.createGain(); o.frequency.value = 880; o.connect(g); g.connect(actx.destination); const t0 = actx.currentTime + i*0.25; g.gain.setValueAtTime(0.0001,t0); g.gain.exponentialRampToValueAtTime(0.4,t0+0.02); g.gain.exponentialRampToValueAtTime(0.0001,t0+0.18); o.start(t0); o.stop(t0+0.2);} } catch(e){} try{navigator.vibrate?.(200)}catch(e){} }

/* ---------- incidents ---------- */
const INC = {bless:{label:"Blessure",icon:"🩹",d:0}, vert:{label:"Carton vert",icon:"🟩",d:2}, jaune:{label:"Carton jaune",icon:"🟨",d:5}, jaune10:{label:"Carton jaune",icon:"🟨",d:10}, rouge:{label:"Carton rouge",icon:"🟥",d:0}};
const timedCard = t => t==="vert" || t==="jaune" || t==="jaune10";
function eventsOf(){ return (S.plan && S.plan.events) || []; }
function outForGood(){ return eventsOf().filter(e => (e.type==="bless" && e.back === undefined) || e.type==="rouge").map(e => e.player); }
// Minutes jouées par un joueur jusqu'à t dans le plan.
function playedUntil(plan, n, t){ return plan.segs.reduce((a, s) => a + (n in s.on ? Math.max(0, Math.min(s.b, t) - s.a) : 0), 0); }
// Remplaçants possibles pour un blessé : ceux qui connaissent son poste d'abord, puis ceux qui ont le plus de temps à rattraper.
function injuryBench(seg, p, T){
  const q = seg.on[p], tg = S.plan.targets || {};
  return present().filter(x => !(x.name in seg.on) && !outForGood().includes(x.name))
    .map(x => ({name:x.name, knows: x.pos.includes(q) || extraPos(x.name).includes(q), left: (tg[x.name] || 0) - playedUntil(S.plan, x.name, T)}))
    .sort((a,b) => (b.knows - a.knows) || (ADJ ? a.name.localeCompare(b.name) : b.left - a.left));
}
// Postes ajoutés en cours de match (joueur mis hors de son poste pour remplacer un blessé).
function extraPos(n){ return eventsOf().filter(e => e.inP === n && e.extraPos).map(e => e.extraPos); }
function replanBase(T){
  const positions = PRESETS[S.preset].map(x => ({id:x[0], gk:x[2]==="gk"}));
  const Tg = computeTargets();
  const players = present().map(x => ({name:x.name, pos:[...x.pos, ...extraPos(x.name).filter(q => !x.pos.includes(q))], target: S.plan.targets?.[x.name] ?? Tg[x.name], locked:(star(x)>=5 && !x.minutes), oneBlock: star(x)>=5, maxStint: x.maxStint ? +x.maxStint : 0, roles: x.roles || [], minFirst: x.minFirst || 0, minStint: minStintOf(x)}));
  const o = {T, positions, players, rules:S.rules, out: outForGood(), vacate: eventsOf().filter(e => e.type==="rouge").map(e => e.pos), seed: Date.now()%100000, adjust: {}};
  // (le temps retiré par les cartons précédents est déjà compté dans S.plan.targets)
  return o;
}
function applyPlan(res){ if (!S.basePlan) S.basePlan = S.plan; S.prevPlan = S.plan; S.plan = res; inc = null; incBusy = false; incMsg = ""; syncDone(); pushClock(); persist(); render(); }
function endInjury(n){
  const T = Math.floor(matchT()*10)/10;
  const o = replanBase(T); o.out = o.out.filter(x => x !== n);
  const res = R.replan(S.plan, o);
  if (res.error) { incMsg = res.warnings.join(" "); render(); return; }
  res.events = [...eventsOf().map(e => e.type==="bless" && e.player===n && e.back === undefined ? {...e, back:T} : e), {t:T, type:"retour", player:n}];
  applyPlan(res);
}
function doIncident(){
  if (inc.pending) { applyPlan(inc.pending); return; }
  const T = Math.floor(matchT()*10)/10;
  const type = inc.type, p = inc.player, info = INC[type] || {d:0};
  const seg = segAt(S.plan, T);
  const o = replanBase(T);
  let extra = null, res0 = null;
  if (type === "libre") o.swap = {out: p, in: inc.inP, pos: inc.pos || null};
  if (type === "bless") {
    o.out.push(p);
    const q = seg.on[p];
    if (inc.inP && q) {
      o.enter = {name: inc.inP, pos: q};
      const pl = o.players.find(x => x.name === inc.inP);
      if (!pl.pos.includes(q)) {
        // Hors poste : on essaie d'abord de réorganiser le terrain (il prend un poste qu'il connaît,
        // un joueur déjà sur le terrain glisse au poste du blessé). Sinon il joue hors poste.
        const re = R.replan(S.plan, {...o, enter: {name: inc.inP, pos: null}});
        if (!re.error) res0 = re;
        else { pl.pos = [...pl.pos, q]; extra = q; }
      }
    }
  }
  if (type === "rouge") { o.out.push(p); o.vacate.push(seg.on[p]); }
  if (timedCard(type)) { o.freezeUntil = Math.min(S.rules.quarters*S.rules.qlen, T + info.d); o.freezeOut = [p]; if (!inc.catchUp) o.adjust[p] = -info.d; }
  const res = res0 || R.replan(S.plan, o);
  if (res.error) { incMsg = res.warnings.join(" "); incBusy = false; render(); return; }
  res.events = [...eventsOf(), {t:T, type, player:p, inP: inc.inP || null, extraPos: extra, d:info.d, pos: seg.on[p] || null, catchUp: !!inc.catchUp}];
  // Une règle ne peut pas être tenue : on montre pourquoi avant d'appliquer.
  if (res.warnings.length) { inc.pending = res; incBusy = false; render(); return; }
  applyPlan(res);
}
function activeBanners(t){
  const out = [];
  eventsOf().forEach(e => {
    const i = INC[e.type];
    if (timedCard(e.type) && t >= e.t - 1e-6 && t < e.t + e.d) out.push(`<div class="banner ${e.type}"><b>${i.icon} ${esc(i.label)} : ${esc(e.player)}</b> exclu, on joue à 10. Retour dans <span data-until="${e.t+e.d}">${fmtClock((e.t+e.d-t)*60)}</span></div>`);
    if (e.type==="rouge" && t >= e.t - 1e-6) out.push(`<div class="banner rouge"><b>🟥 Carton rouge : ${esc(e.player)}</b> exclu jusqu'à la fin, on joue à 10.</div>`);
    if (e.type==="bless" && e.back === undefined && t >= e.t - 1e-6) out.push(`<div class="banner bless row" style="justify-content:space-between"><span><b>🩹 ${esc(e.player)} blessé</b> : le plan est recalculé sans lui.</span><button class="btn small" data-heal="${esc(e.player)}">Fin de blessure</button></div>`);
    if (e.type==="retour" && t >= e.t - 1e-6 && t < e.t + 2) out.push(`<div class="banner vert"><b>✚ ${esc(e.player)} de retour</b> : il est sur le banc, le plan lui redonne du temps.</div>`);
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
  const card = timedCard(inc.type);
  if (inc.pending) return `<div class="card incp"><h2>À vérifier</h2>
    <p style="margin:0 0 8px">Le nouveau plan ne peut pas respecter toutes les règles :</p>
    <div class="warn">${inc.pending.warnings.map(w => esc(nicePos(w))).join("<br>")}</div>
    <p class="muted" style="margin:8px 0 0;font-size:.92rem">Souvent, c'est parce que peu de joueurs connaissent ce poste. Tu peux valider quand même, ou revenir en arrière et choisir un autre remplaçant (même hors de son poste).</p>
    <div class="row" style="margin-top:12px"><button class="btn go big" id="incGo">Valider quand même</button><button class="btn" id="incBack">Revenir</button></div>
  </div>`;
  const q = inc.type === "bless" && inc.player ? seg.on[inc.player] : null;
  const subs = q ? injuryBench(seg, inc.player, matchT()) : [];
  if (q && inc.inP === undefined) inc.inP = subs[0]?.name || null;
  const subHtml = q ? `<div class="muted" style="margin:10px 0 6px;font-size:.9rem">Qui le remplace au poste ${pill(q)} ${esc(posName(q))} ?</div>
    <div class="inc-players">${subs.map((x,k) => `<button class="btn${x.knows ? "" : " dim"}" data-incin="${esc(x.name)}" aria-pressed="${inc.inP===x.name}">${esc(x.name)}${k===0 && x.knows ? " <small>conseillé</small>" : x.knows ? "" : " <small>hors poste</small>"}</button>`).join("") || '<span class="muted">Personne sur le banc : on joue à 10.</span>'}</div>
    ${inc.inP && !subs.find(x => x.name === inc.inP)?.knows ? `<div class="muted" style="margin-top:8px;font-size:.92rem">${esc(inc.inP)} ne joue pas ${esc(posName(q).toLowerCase())} : l'app réorganise le terrain pour qu'il prenne un poste qu'il connaît. Si c'est impossible, il jouera ${esc(posName(q).toLowerCase())} jusqu'à la fin du match.</div>` : ""}` : "";
  return `<div class="card incp"><h2>Imprévu</h2>
    <div class="inc-types">${Object.entries(INC).map(([k,v]) => `<button class="btn inc-t ${k}" data-inct="${k}" aria-pressed="${inc.type===k}">${v.icon} ${esc(v.label)}${v.d?` ${v.d}'`:""}</button>`).join("")}</div>
    <div class="muted" style="margin:10px 0 6px;font-size:.9rem">Quel joueur ?</div>
    <div class="inc-players">${onField.map(n => `<button class="btn" data-incp="${esc(n)}" aria-pressed="${inc.player===n}">${esc(n)}</button>`).join("")}</div>
    ${subHtml}
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
  a.download = `stickmate-${slug(S.teamName || "equipe")}-${data.savedAt}.json`;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  backupMsg = "Sauvegarde téléchargée. Garde ce fichier en lieu sûr (mail, Drive...)."; render();
}
function importBackup(file){
  const rd = new FileReader();
  rd.onload = () => {
    try {
      const d = JSON.parse(rd.result);
      if (d.app !== "banc-hockey" || !d.state || !Array.isArray(d.state.squad)) throw new Error("format");
      const pin = S.pin; applyData(d.state); S.pin = pin; S.matches = d.state.matches; S.curMatch = d.state.curMatch; ensureMatches();
      if (Array.isArray(d.season)) localStorage.setItem("banc-season", JSON.stringify(d.season));
      season = null; preview = null; persist();
      backupMsg = `Sauvegarde du ${d.savedAt || "?"} rechargée : ${d.state.squad.length} joueurs.`;
    } catch(e){ backupMsg = "Ce fichier n'est pas une sauvegarde StickMate."; }
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
    season = JSON.parse(localStorage.getItem("banc-season") || "[]");
  } catch(e){ season = []; }
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
    const L = JSON.parse(localStorage.getItem("banc-season") || "[]"); L.push({id:String(Date.now()), ...rec}); localStorage.setItem("banc-season", JSON.stringify(L));
    S.plan.savedAt = Date.now(); persist(); seasonMsg = "Match enregistré dans la saison ✓";
  } catch(e){ seasonMsg = "L'enregistrement a échoué, réessaie."; }
  season = null; render();
}
async function deleteMatch(id){
  try {
    const L = JSON.parse(localStorage.getItem("banc-season") || "[]").filter(x => x.id !== id); localStorage.setItem("banc-season", JSON.stringify(L));
    markChanged();
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
const VIEWS = {home:[homeView, bindHome], match:[() => matchesOpen ? matchesView() : (far ? "" : matchBar()) + matchView(), () => { bindMatches(); if (!matchesOpen) bindMatch(); }], coach:[coachView, bindCoach], settings:[settingsView, bindSettings]};
function render(){
  applyColor();
  paintSub();
  document.querySelectorAll("[data-tab]").forEach(b => b.setAttribute("aria-current", b.dataset.tab === mode ? "page" : "false"));
  const v = $("#view");
  if (ADJ) { document.body.classList.add("adjoint"); mode = "match"; const v2 = $("#view"); if (!S.plan) { v2.innerHTML = adjointWait(); return; } v2.innerHTML = matchView(); bindMatch(); return; }
  const acc = accountScreen(), onboard = !!acc || !S.profile;
  document.body.classList.toggle("onboard", onboard);
  if (acc) { v.innerHTML = acc; bindAccount(); return; }
  if (onboard) { v.innerHTML = onboardView(); bindOnboard(); return; }
  if (mode === "coach" && S.pin && !coachOK) { v.innerHTML = pinView(); bindPin(); return; }
  const [view, bind] = VIEWS[mode] || VIEWS.home;
  v.innerHTML = view(); bind();
}
function goTo(m){ if (m === mode) return; mode = m; inc = null; render(); window.scrollTo(0, 0); }
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
  if (!plan) return `<div class="card empty"><h2>Pas encore de plan</h2><p class="muted">Va dans la page Coach : coche les présents, choisis la compo, puis génère le plan de rotation.</p><button class="btn primary" id="goCoach">Aller à la page Coach</button></div>`;
  const ql = S.rules.qlen, el = clockElapsed(), t = matchT();
  const atEnd = el >= ql*60 - 0.5;
  const next = visChanges(plan).find(c => !C.done.includes(c.t) && c.t >= t - 0.01 - 0.35);
  const qEndT = C.q*ql;
  let alertHtml;
  const matchOver = atEnd && C.q >= S.rules.quarters;
  if (!next) alertHtml = `<div class="alert"><div class="alert-title">${matchOver ? "Fin du match" : "Plus de changement prévu"}</div>${matchOver ? (plan.savedAt ? `<div class="ok">Match enregistré dans la saison ✓</div>` : ADJ ? "" : `<button class="btn big primary" id="saveMatch">Enregistrer le match dans la saison</button>`) : `<div class="muted">Plus aucun changement jusqu'à la fin.</div>`}${seasonMsg && matchOver ? `<div class="muted">${esc(seasonMsg)}</div>` : ""}</div>`;
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
  const hurt = outForGood();
  const benchNames = present().map(p=>p.name).filter(n => !(n in seg.on)).map(n => hurt.includes(n) ? n + " 🩹" : n);
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
      ${shareCard()}
      ${ADJ && !inc && incMsg ? `<div class="warn">${esc(incMsg)}</div>` : ""}
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
          ${S.prevPlan || (ADJ && S.hasPrev) ? `<button class="btn" id="incUndo">↶ Annuler le dernier imprévu</button>` : ""}
          <button class="btn" id="farOn">⤢ Vue de loin</button>
          ${liveButton()}
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
      ${ADJ ? "" : sheetCard(seg)}
    </div>
    <div style="display:flex;flex-direction:column;gap:18px;min-width:0">
      <div class="card"><h2>Sur le terrain</h2>${pitch}<div style="margin-top:12px"><div class="muted" style="font-size:.85rem;margin-bottom:6px">Sur le banc</div><div class="bench">${benchNames.map(n=>`<span>${esc(n)}</span>`).join("") || '<span>Personne</span>'}</div></div></div>
      <div class="card"><h2>Changements du Q${C.q}</h2><div class="up">${upList}</div></div>
    </div></div>`;
}
function pitchLines(){ return `<div class="l" style="inset:3% 4%;border-radius:4px"></div><div class="l" style="left:4%;right:4%;top:50%;height:0;border-width:2px 0 0"></div><div class="l" style="left:28%;right:28%;top:3%;height:15%;border-radius:0 0 50% 50%/0 0 100% 100%;border-top:0"></div><div class="l" style="left:28%;right:28%;bottom:3%;height:15%;border-radius:50% 50% 0 0/100% 100% 0 0;border-bottom:0"></div>`; }

let tickTimer = null, lastAlertKey = "";
function bindMatch(){
  bindShare();
  $("#goCoach")?.addEventListener("click", () => goTo("coach"));
  $("#start")?.addEventListener("click", startClock);
  $("#pause")?.addEventListener("click", pauseClock);
  $("#nextQ")?.addEventListener("click", () => { markBreakDone(); nextQuarter(); });
  $("#m10")?.addEventListener("click", () => adjust(-10));
  $("#p10")?.addEventListener("click", () => adjust(10));
  $("#doneBtn")?.addEventListener("click", () => { const t = matchT(); const nx = visChanges(S.plan).find(c => !C.done.includes(c.t) && c.t >= t - 0.36); if (nx) C.done.push(nx.t); pushClock(); render(); });
  $("#reset")?.addEventListener("click", function(){ if (this.dataset.armed) { if (ADJ) adjAsk("reset"); else resetMatch(); } else { this.dataset.armed = 1; this.textContent = "Sûr ? Touche encore"; } });
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
  $("#incUndo")?.addEventListener("click", function(){ if (this.dataset.armed && ADJ) adjAsk("undo"); else if (this.dataset.armed) { S.plan = S.prevPlan; S.prevPlan = null; syncDone(); pushClock(); persist(); render(); } else { this.dataset.armed = 1; this.textContent = "Sûr ? Touche encore"; } });
  $("#swapOpen")?.addEventListener("click", () => { inc = {type:"libre", player:null, inP:null}; incMsg = ""; render(); });
  document.querySelectorAll("[data-swo]").forEach(b => b.addEventListener("click", () => { inc.player = b.dataset.swo; render(); }));
  document.querySelectorAll("[data-swi]").forEach(b => b.addEventListener("click", () => { inc.inP = b.dataset.swi; render(); }));
  bindSheet();
  document.querySelectorAll("[data-inct]").forEach(b => b.addEventListener("click", () => { inc.type = b.dataset.inct; inc.inP = undefined; render(); }));
  document.querySelectorAll("[data-incp]").forEach(b => b.addEventListener("click", () => { inc.player = b.dataset.incp; inc.inP = undefined; render(); }));
  document.querySelectorAll("[data-incin]").forEach(b => b.addEventListener("click", () => { inc.inP = b.dataset.incin; render(); }));
  document.querySelectorAll("[data-heal]").forEach(b => b.addEventListener("click", function(){ if (this.dataset.armed) { if (ADJ) adjAsk("heal", {player:this.dataset.heal}); else endInjury(this.dataset.heal); } else { this.dataset.armed = 1; this.textContent = "Sûr ? Touche encore"; } }));
  $("#incBack")?.addEventListener("click", () => { inc.pending = null; render(); });
  $("#catchUp")?.addEventListener("change", e => { inc.catchUp = e.target.checked; });
  $("#incGo")?.addEventListener("click", () => { if (ADJ) { adjAsk("incident", {inc:adjInc(), force:!!inc.pending}); return; } incBusy = true; render(); setTimeout(doIncident, 40); });
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
  if (!S.plan) return;
  const el = clockElapsed();
  if (C.running && el >= S.rules.qlen*60) { C.elapsed = S.rules.qlen*60; C.running = false; saveClock(); beep(3);
    if (C.q >= S.rules.quarters && !S.plan.savedAt && !ADJ) saveMatch(); // fin du match : direction le suivi de saison
    else if (mode === "match") render();
    return; }
  // auto mark change done 25 s after its time
  const t = matchT();
  visChanges(S.plan).forEach(c => { if (!C.done.includes(c.t) && (t - c.t)*60 > 25) C.done.push(c.t); });
  const next = visChanges(S.plan).find(c => !C.done.includes(c.t) && c.t >= t - 0.36);
  const secs = next ? (next.t - t)*60 : 1e9;
  const nb = eventsOf().filter(e => timedCard(e.type) && t >= e.t && t < e.t + e.d).length;
  const state = (next ? (secs <= 0.5 ? "now" : secs <= S.rules.alertSec ? "soon" : "far") + next.t : "none") + "|" + nb;
  if (state !== lastAlertKey) { if (state.startsWith("soon") && !lastAlertKey.startsWith("soon")) beep(2); if (state.startsWith("now") && !lastAlertKey.startsWith("now")) beep(1); lastAlertKey = state; if (!inc && mode === "match") render(); return; }
  const te = $("#time"); if (te) te.textContent = fmtClock(el);
  const re = $("#remain"); if (re) re.textContent = "Reste " + fmtClock(S.rules.qlen*60 - el);
  const pb = $("#progBar"); if (pb) pb.style.width = (el/(S.rules.qlen*60)*100).toFixed(2) + "%";
  document.querySelectorAll("[data-until]").forEach(sp => { const left = (+sp.dataset.until - t)*60; if (left <= 0) { lastAlertKey = ""; } sp.textContent = fmtClock(left); });
  const ce = $("#count"); if (ce && next && secs > 0.5 && !(Math.abs(next.t - C.q*S.rules.qlen)<1e-6 && secs > S.rules.alertSec)) ce.textContent = fmtClock(secs);
}

/* ---------- inscription (première ouverture) ---------- */
let onboardMsg = "";
const PROFILE_FIELDS = [["first","Prénom","ex. Geoffrey",true],["last","Nom","",false],["club","Club","ex. Wellington",false],["team","Équipe","ex. Messieurs 1",true]];
function profileFields(){
  const val = k => k === "team" ? (S.teamName || "") : (S.profile?.[k] || "");
  return PROFILE_FIELDS.map(([k,l,ph,req]) => `<label class="fld"><span>${esc(l)}${req ? "" : ' <small class="muted">(facultatif)</small>'}</span><input type="text" data-prof="${k}" value="${esc(val(k))}" placeholder="${esc(ph)}" autocomplete="off"></label>`).join("");
}
function readProfile(){
  const v = {}; document.querySelectorAll("[data-prof]").forEach(el => v[el.dataset.prof] = el.value.trim());
  if (!v.first || !v.team) return null;
  S.profile = {first:v.first, last:v.last, club:v.club}; S.teamName = v.team;
  return v;
}
// Champ de code : clavier de chiffres, chiffres masqués.
const pinField = (id, label, extra = "") => `<input type="text" class="pinf" id="${id}" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="off" aria-label="${esc(label)}" placeholder="••••" ${extra}>`;
const digitsOnly = () => document.querySelectorAll(".pinf").forEach(el => el.addEventListener("input", () => { el.value = el.value.replace(/\D/g, "").slice(0, 6); }));
const pinOk = c => /^(\d{4}|\d{6})$/.test(c);
function onboardView(){
  return `<div class="card onb"><h2>${user ? "Ton profil" : "Bienvenue sur StickMate"}</h2>
    <p style="margin:0">${user ? "Ton compte est prêt." : "L'app qui prépare tes changements et te prévient pendant le match."} Pour commencer, présente-toi :</p>
    <div class="form">${profileFields()}
      <label class="fld"><span>Code de verrouillage (4 ou 6 chiffres)</span>${pinField("pinNew", "Code de verrouillage")}</label>
      <label class="fld"><span>Confirme le code</span>${pinField("pinNew2", "Confirme le code")}</label></div>
    <p class="muted" style="margin:0;font-size:.88rem">À quoi il sert : il ferme la partie coach (effectif, notes, temps de jeu visés, réglages). Tu peux donc prêter le téléphone à un joueur ou à ton assistant : ils voient l'Accueil et le Match, mais pas les notes.</p>
    ${onboardMsg ? `<div class="warn">${esc(onboardMsg)}</div>` : ""}
    <button class="btn go big" id="onbGo">Je commence</button>
  </div>
  <div class="card"><h2>J'ai déjà mes données</h2>
    <p class="muted" style="margin:0 0 10px;font-size:.92rem">${CLOUD_ON && !user ? "Connecte-toi à ton compte, ou charge" : "Charge"} le fichier de sauvegarde téléchargé depuis l'app sur ton autre téléphone.</p>
    <div class="row">${CLOUD_ON && !user ? `<button class="btn primary" id="onbLogin">Me connecter</button>` : ""}<label class="btn" style="display:inline-block">⬆ Charger une sauvegarde<input type="file" id="bkIn" accept=".json,application/json" hidden></label></div>
    ${backupMsg ? `<div class="ok" style="margin-top:10px">${esc(backupMsg)}</div>` : ""}
  </div>`;
}
// Réafficher le formulaire avec un message sans perdre ce qui est déjà tapé (sauf les codes).
function keepForm(){ const v = {}; document.querySelectorAll("[data-prof]").forEach(el => v[el.dataset.prof] = el.value); render(); document.querySelectorAll("[data-prof]").forEach(el => el.value = v[el.dataset.prof] ?? el.value); }
function bindOnboard(){
  digitsOnly();
  $("#onbLogin")?.addEventListener("click", () => openAuth("login"));
  $("#onbGo")?.addEventListener("click", () => {
    const pin = $("#pinNew").value.trim();
    if (!pinOk(pin)) { onboardMsg = "Choisis un code de verrouillage de 4 ou 6 chiffres."; keepForm(); return; }
    if ($("#pinNew2").value.trim() !== pin) { onboardMsg = "Les deux codes ne sont pas pareils. Retape-les."; keepForm(); return; }
    if (!readProfile()) { onboardMsg = "Indique au moins ton prénom et ton équipe."; keepForm(); return; }
    onboardMsg = ""; S.pin = pin;
    coachOK = true; mode = "home"; persist(); render(); window.scrollTo(0, 0);
  });
  $("#bkIn")?.addEventListener("change", e => { const f = e.target.files[0]; if (f) importBackup(f); });
}

/* ---------- accueil ---------- */
function homeView(){
  const ready = !!S.plan, title = matchTitle();
  return `<div class="card"><h2>Salut${S.profile?.first ? ` ${esc(S.profile.first)}` : ""} !</h2>
    <p style="margin:0">Cette app prépare tes changements pour que chaque joueur ait son temps de jeu, puis te prévient pendant le match : qui entre, qui sort et à quel poste.</p>
  </div>
  <div class="card"><h2>Prochain match</h2>
    ${!S.squad.length ? `<p class="muted" style="margin:0 0 12px">Ton équipe est encore vide. Commence par créer ton équipe et tes joueurs.</p><button class="btn primary" id="hCoach">Créer mon équipe</button>`
      : `<p style="margin:0 0 12px">${title ? `<b>${esc(title)}</b><br>` : ""}<span class="muted">${ready ? "Le plan de rotation est prêt." : "Pas encore de plan de rotation pour ce match."}</span></p>
      ${ready ? `<button class="btn go big" id="hMatch">Ouvrir le match ▸</button>` : `<button class="btn primary" id="hCoach">Préparer le match</button>`}`}
  </div>
  ${accountNudge()}
  <div class="card"><h2>Comment ça marche</h2>
    <ol class="steps">
      <li><b>Coach</b> : crée ton équipe et tes joueurs, avec leurs postes.</li>
      <li><b>Coach</b>, avant le match : coche les présents, choisis la compo de départ et génère le plan de rotation.</li>
      <li><b>Match</b> : lance le chrono. ${+S.rules.alertSec} secondes avant chaque changement, l'app te prévient (son et écran).</li>
      <li>Un blessé, un carton ? Touche « Imprévu » : le plan se recalcule tout seul.</li>
      <li><b>Réglages</b> : son des alertes, thème, ton profil, règles de rotation, codes et sauvegarde.</li>
    </ol>
  </div>`;
}
function bindHome(){
  $("#hCoach")?.addEventListener("click", () => goTo("coach"));
  $("#hMatch")?.addEventListener("click", () => goTo("match"));
  bindAccountNudge();
}

/* ---------- réglages ---------- */
function segBtns(key, opts){ return `<div class="seg" role="group">${opts.map(([v,l]) => `<button data-pref="${key}" data-val="${v}" aria-pressed="${String(prefs[key]) === String(v)}">${esc(l)}</button>`).join("")}</div>`; }
function colorSetting(){
  const cur = hexOk(S.color) ? S.color.toLowerCase() : DEFAULT_COLOR, known = CLUB_COLORS.some(([h]) => h === cur);
  return `<div class="set" style="display:block"><b>Couleur principale</b><div class="muted">La couleur de ton club. Elle colore la barre du haut et les boutons. Le texte reste toujours lisible : l'app choisit blanc ou noir toute seule.</div>
    <div class="swatches" role="group" aria-label="Couleur principale">${CLUB_COLORS.map(([h,l]) => `<button class="sw" data-color="${h}" style="background:${h}" aria-pressed="${h === cur}" aria-label="${esc(l)}" title="${esc(l)}"></button>`).join("")}
      <label class="sw other" title="Autre couleur" aria-label="Autre couleur" data-on="${!known}" style="${known ? "" : `background:${cur}`}"><input type="color" id="colorPick" value="${cur}"></label></div>
    <div class="clubprev"><button class="btn primary" type="button" tabindex="-1">Aperçu bouton</button>${cur !== DEFAULT_COLOR ? `<button class="btn small" id="colorReset">Remettre le bleu StickMate</button>` : ""}</div></div>`;
}
function setColor(h){ if (!hexOk(h)) return; S.color = h.toLowerCase(); persist(); render(); }
function settingsView(){
  const locked = S.pin && !coachOK;
  const rulesHtml = RULE_LABELS.map(([k,l,st]) => `<label>${esc(l)}<input type="number" step="${st}" data-rule="${k}" value="${S.rules[k]}"></label>`).join("");
  return `<div class="card"><h2>L'app</h2>
    <div class="set"><div><b>Son des alertes</b><div class="muted">Bip avant chaque changement. Sur iPhone, le bouton silencieux coupe le son.</div></div>
      <div class="row" style="flex-shrink:0">${segBtns("sound", [[true,"Oui"],[false,"Non"]])}<button class="btn small" id="testSound">Tester</button></div></div>
    <div class="set"><div><b>Vibreur</b><div class="muted">${canVibrate ? "Le téléphone vibre avant chaque changement." : "Pas disponible sur iPhone : Apple ne laisse pas les apps web faire vibrer le téléphone."}</div></div>
      ${canVibrate ? segBtns("vibrate", [[true,"Oui"],[false,"Non"]]) : ""}</div>
    ${colorSetting()}
    <div class="set"><div><b>Thème</b><div class="muted">Auto suit le réglage du téléphone.</div></div>
      ${segBtns("theme", [["auto","Auto"],["light","Clair"],["dark","Sombre"]])}</div>
  </div>
  ${locked ? pinView("Réglages coach", "Entre ton code de verrouillage pour modifier ton profil, ton compte, les règles et la sauvegarde.") : `
  ${accountCard()}
  <div class="card"><h2>Règles de rotation</h2>
    <p class="muted" style="margin:0 0 10px;font-size:.92rem">Elles servent au prochain plan généré dans la page Coach.</p>
    <div class="rules">${rulesHtml}</div>
  </div>
  <div class="card"><h2>Mon profil</h2>
    <div class="form">${profileFields()}</div>
    <div class="row" style="margin-top:12px"><button class="btn primary" id="profSave">Enregistrer</button><span id="profMsg" class="muted" style="font-size:.9rem"></span></div>
  </div>
    <div class="card"><h2>Code de verrouillage</h2>
    <p class="muted" style="margin:0 0 10px;font-size:.92rem">${S.pin ? "Ce code protège la page Coach et ces réglages. Les joueurs peuvent ouvrir Accueil et Match." : "Aucun code pour l'instant : n'importe qui peut ouvrir la page Coach et voir les notes et les minutes."}</p>
    <div class="form" style="max-width:480px"><label class="fld"><span>Nouveau code (4 ou 6 chiffres)</span>${pinField("pinSet", "Nouveau code")}</label><label class="fld"><span>Confirme le code</span>${pinField("pinSet2", "Confirme le code")}</label></div>
    <div class="row" style="margin-top:10px">
      <button class="btn primary" id="pinSave">Changer le code</button>
      ${S.pin ? `<button class="btn" id="lockNow">🔒 Verrouiller maintenant</button>` : ""}
      <span id="pinMsg" class="muted" style="font-size:.9rem"></span></div>
  </div>
    <div class="card"><h2>Sauvegarde</h2>
    <p class="muted" style="margin:0 0 10px;font-size:.92rem">${CLOUD_ON && user ? "Ton compte sauvegarde déjà tout en ligne. Tu peux en plus garder un fichier de sauvegarde (effectif, plan, saison) chez toi." : "Tout est gardé sur ce téléphone. Télécharge une sauvegarde de temps en temps (effectif, plan, saison) : elle te permet de tout retrouver sur un autre appareil."} Le code de verrouillage n'est pas dans le fichier.</p>
    <div class="row"><button class="btn primary" id="bkOut">⬇ Télécharger une sauvegarde</button><label class="btn" style="display:inline-block">⬆ Charger une sauvegarde<input type="file" id="bkIn" accept=".json,application/json" hidden></label></div>
    ${backupMsg ? `<div class="ok" style="margin-top:10px">${esc(backupMsg)}</div>` : ""}
  </div>
  ${dataCard()}`}`;
}
function bindSettings(){
  const v = $("#view");
  v.querySelectorAll("[data-pref]").forEach(b => b.addEventListener("click", () => {
    const k = b.dataset.pref, val = b.dataset.val;
    prefs[k] = val === "true" ? true : val === "false" ? false : val;
    savePrefs(); applyTheme(); render();
  }));
  $("#testSound")?.addEventListener("click", () => { unlockAudio(); beep(2); });
  v.querySelectorAll("[data-color]").forEach(b => b.addEventListener("click", () => setColor(b.dataset.color)));
  // « input » pendant qu'on glisse dans le sélecteur : on prévisualise sans enregistrer ; « change » à la fin : on garde.
  $("#colorPick")?.addEventListener("input", e => { if (hexOk(e.target.value)) { const p = clubPalette(e.target.value), st = document.documentElement.style; Object.entries(p).forEach(([k,c]) => st.setProperty("--" + k, c)); appliedColor = ""; } });
  $("#colorPick")?.addEventListener("change", e => setColor(e.target.value));
  $("#colorReset")?.addEventListener("click", () => setColor(DEFAULT_COLOR));
  if (S.pin && !coachOK) { bindPin(); return; }
  v.querySelectorAll("[data-rule]").forEach(el => el.addEventListener("change", () => { S.rules[el.dataset.rule] = +el.value; preview=null; persist(); render(); }));
  digitsOnly();
  $("#pinSave").addEventListener("click", () => { const c = $("#pinSet").value.trim(); if (!pinOk(c)) { $("#pinMsg").textContent = "Le code doit faire 4 ou 6 chiffres."; return; } if ($("#pinSet2").value.trim() !== c) { $("#pinMsg").textContent = "Les deux codes ne sont pas pareils."; return; } S.pin = c; persist(); coachOK = true; render(); $("#pinMsg").textContent = "Code enregistré."; });
  $("#profSave").addEventListener("click", () => { const r = readProfile(); if (!r) { $("#profMsg").textContent = "Le prénom et l'équipe sont obligatoires."; return; } persist(); render(); $("#profMsg").textContent = "Profil enregistré."; });
  $("#lockNow")?.addEventListener("click", () => { coachOK = false; goTo("home"); });
  bindAccountCard();
  $("#bkOut")?.addEventListener("click", exportBackup);
  $("#bkIn")?.addEventListener("change", e => { const f = e.target.files[0]; if (f) importBackup(f); });
}

/* ---------- coach ---------- */
function pinView(title = "Page coach", text = "Entre ton code de verrouillage pour voir l'effectif et les temps de jeu."){ return `<div class="card pin"><h2>${esc(title)}</h2><p class="muted">${esc(text)}</p>${pinField("pinIn", "Code de verrouillage")}<div id="pinErr" class="muted" style="min-height:1.4em"></div><button class="btn primary" id="pinGo">Entrer</button></div>`; }
function bindPin(){ const go = () => { if ($("#pinIn").value === S.pin) { coachOK = true; render(); } else { $("#pinErr").textContent = "Code incorrect, réessaie."; } }; $("#pinGo").addEventListener("click", go); $("#pinIn").addEventListener("keydown", e => { if (e.key==="Enter") go(); }); digitsOnly(); $("#pinIn").addEventListener("input", e => { if (e.target.value === S.pin) go(); }); if (mode === "coach") $("#pinIn").focus(); }

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
  return `
  ${!S.squad.length ? `<div class="card"><h2>Bienvenue</h2><p class="muted" style="margin:0">Ajoute tes joueurs dans « Effectif », avec leurs postes. Tu as déjà une sauvegarde ? Charge-la dans la page Réglages.</p></div>` : ""}
  <div class="card"><div class="row" style="justify-content:space-between"><h2 style="margin:0">Match en préparation</h2><button class="btn small" id="cList">Mes matchs (${S.matches.length})</button></div>
    <div class="row" style="margin-top:10px"><input type="text" id="mLabel" value="${esc(S.matchLabel||"")}" placeholder="Nom du match, ex. Wellington – Daring" aria-label="Nom du match" style="flex:1;min-width:200px;border:1px solid var(--rule);border-radius:8px;padding:8px 10px;background:var(--bg);font-weight:600">
      <input type="date" id="mDate" value="${esc(S.matchDate||"")}" aria-label="Date du match" style="border:1px solid var(--rule);border-radius:8px;padding:7px 10px;background:var(--bg)"></div>
    <div class="set" style="margin-top:12px"><span>Temps de jeu</span><div class="seg" role="group">${TIME_MODES.map(([v,l]) => `<button data-tmode="${v}" aria-pressed="${timeMode()===v}">${esc(l)}</button>`).join("")}</div></div>
    <p class="muted" style="margin:6px 0 0;font-size:.9rem">${({notes:"Calculé à partir des notes et des minutes fixées.", all:"Tous les joueurs de champ ont le même temps. Les notes ne comptent pas, les minutes fixées oui.", line:"Chaque ligne (défense, milieu, attaque) partage son temps à égalité. La ligne d'un joueur = celle de son 1er poste. Les notes ne comptent pas, les minutes fixées oui."})[timeMode()]}</p>
  </div>
  <div class="card"><div class="row" style="justify-content:space-between"><h2 style="margin:0">Effectif</h2><span class="save" id="saveState">${esc(saveState)}</span></div>
    <p class="muted" style="margin:6px 0 12px;font-size:.9rem">Coche les présents. Postes dans l'ordre de préférence (le 1. est son meilleur poste ; touche un poste pour le retirer). Note 5 = tout le match. Laisse « Minutes » vide pour un calcul automatique à partir des notes. Corners : D donneur, B bloqueur.</p>
    <div class="tbl-wrap"><table><thead><tr><th>Là</th><th>Nom</th><th>Postes</th><th>Note</th><th>Minutes</th><th>Passage max</th><th title="Rôles sur corner">Corners</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
    <div class="row" style="margin-top:10px"><button class="btn" id="addP">+ Ajouter un joueur</button><button class="btn" id="clearMin">Effacer les minutes fixées</button><span class="muted" style="font-size:.9rem">${pres.length} présents</span></div>
  </div>
  <div class="card"><h2>Système et compo de départ</h2>
      <div class="row" style="margin-bottom:12px"><label for="preset" class="muted">Système</label><select id="preset" style="border:1px solid var(--rule);border-radius:8px;padding:6px 10px;background:var(--bg)">${Object.keys(PRESETS).map(k=>`<option ${k===S.preset?"selected":""}>${k}</option>`).join("")}</select></div>
      <div class="pitch" style="max-width:440px;margin:0 auto">${pitchLines()}${lineupSel}</div>
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
  $("#pdfB")?.addEventListener("click", makePdf);
  $("#matchLabel")?.addEventListener("change", e => { S.matchLabel = e.target.value; persist(); render(); });
  $("#mLabel")?.addEventListener("change", e => { S.matchLabel = e.target.value.trim(); persist(); render(); });
  $("#mDate")?.addEventListener("change", e => { S.matchDate = e.target.value; persist(); render(); });
  $("#saveMatchC")?.addEventListener("click", saveMatch);
  document.querySelectorAll("[data-tmode]").forEach(b => b.addEventListener("click", () => { S.timeMode = b.dataset.tmode; preview = null; persist(); render(); }));
  $("#cList")?.addEventListener("click", () => { matchesOpen = true; goTo("match"); });
  document.querySelectorAll("[data-delm]").forEach(b => b.addEventListener("click", () => { if (b.dataset.armed) deleteMatch(b.dataset.delm); else { b.dataset.armed = 1; b.textContent = "Sûr ?"; } }));
  $("#gen").addEventListener("click", () => { const b = $("#gen"); b.disabled = true; b.textContent = "Calcul…"; setTimeout(() => { preview = generate(Date.now() % 100000 + (seedN++)); render(); }, 30); });
  $("#use")?.addEventListener("click", () => { S.plan = preview; preview = null; S.prevPlan = null; S.basePlan = null; S.sheet = {us:[], them:[], pc:0, log:[]}; C = {q:1,elapsed:0,running:false,startedAt:0,done:[]}; pushClock(); persist(); render(); });
}

/* ---------- boot ---------- */
document.querySelectorAll("[data-tab]").forEach(b => b.addEventListener("click", () => goTo(b.dataset.tab)));
applyTheme();
if (ADJ) C = freshClock();
else { loadLocal(); ensureMatches(); delete S.coachId; }
saveState = "Données de cet appareil";
if (!ADJ) { cloudInit(); paintCloud(); }
liveInit();
render(); paintSub();
setInterval(tick, 250);

// Copie hors ligne de l'app (seulement quand elle est servie en ligne, pas en fichier local).
try { navigator.storage?.persist?.(); } catch(e){}
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) navigator.serviceWorker.register("sw.js").catch(() => {});
