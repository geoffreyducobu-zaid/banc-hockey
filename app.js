const R = window.Rotation;
const SEED = {"dataVersion":6,"teamName":"","squad":[],"lineup":{},"preset":"3-2-3-2","plan":null,"pin":"","sheet":{"us":[],"them":[],"pc":0,"log":[]}};
const PRESETS = {
  "3-2-3-2": [["G","Gardien","gk",50,95,"G"],["1","Back gauche","def",20,76,"BG"],["2","Back central","def",50,80,"BC"],["3","Back droit","def",80,76,"BD"],["4","Milieu déf. gauche","dm",34,63,"MDG"],["5","Milieu déf. droit","dm",66,63,"MDD"],["6","Milieu gauche","mid",17,44,"MG"],["7","Milieu off.","mid",50,46,"MO"],["8","Milieu droit","mid",83,44,"MD"],["9","Avant gauche","att",34,20,"AG"],["10","Avant droit","att",66,20,"AD"]],
  "4-3-3": [["G","Gardien","gk",50,95,"G"],["1","Back gauche","def",14,74,"BG"],["2","Back central gauche","def",38,80,"BCG"],["3","Back central droit","def",62,80,"BCD"],["4","Back droit","def",86,74,"BD"],["5","Milieu centre","dm",50,60,"MC"],["6","Milieu gauche","mid",26,46,"MG"],["7","Milieu droit","mid",74,46,"MD"],["8","Avant gauche","att",18,22,"AG"],["9","Avant centre","att",50,16,"AC"],["10","Avant droit","att",82,22,"AD"]],
  "4-4-2": [["G","Gardien","gk",50,95,"G"],["1","Back gauche","def",14,74,"BG"],["2","Back central gauche","def",38,80,"BCG"],["3","Back central droit","def",62,80,"BCD"],["4","Back droit","def",86,74,"BD"],["5","Milieu gauche","mid",14,48,"MG"],["6","Milieu axial gauche","dm",38,54,"MAG"],["7","Milieu axial droit","dm",62,54,"MAD"],["8","Milieu droit","mid",86,48,"MD"],["9","Avant gauche","att",36,20,"AG"],["10","Avant droit","att",64,20,"AD"]],
  "3-3-3-1": [["G","Gardien","gk",50,95,"G"],["1","Back gauche","def",20,76,"BG"],["2","Back central","def",50,80,"BC"],["3","Back droit","def",80,76,"BD"],["4","Milieu déf. gauche","dm",22,62,"MDG"],["5","Milieu déf. axe","dm",50,64,"MDA"],["6","Milieu déf. droit","dm",78,62,"MDD"],["7","Milieu off. gauche","mid",22,40,"MOG"],["8","Milieu off. axe","mid",50,42,"MOA"],["9","Milieu off. droit","mid",78,40,"MOD"],["10","Avant centre","att",50,17,"AC"]],
  "4-2-3-1": [["G","Gardien","gk",50,95,"G"],["1","Back gauche","def",14,74,"BG"],["2","Back central gauche","def",38,80,"BCG"],["3","Back central droit","def",62,80,"BCD"],["4","Back droit","def",86,74,"BD"],["5","Milieu déf. gauche","dm",36,61,"MDG"],["6","Milieu déf. droit","dm",64,61,"MDD"],["7","Milieu gauche","mid",17,42,"MG"],["8","Milieu off.","mid",50,40,"MO"],["9","Milieu droit","mid",83,42,"MD"],["10","Avant centre","att",50,17,"AC"]]
};
const DEFAULT_RULES = {quarters:4,qlen:17.5,firstChange:4,per:{},startBlock:4,endBlock:3,minStint:6,maxStint:22,maxBench:10,minBench:3,maxEntries:3,breakChanges:true,gkOnlyAtBreaks:true,minPlay:35,alertSec:30,minDef:10,minMid:8,minAtt:6,maxDef:22,maxMid:22,maxAtt:22};
// Règles copiées à neuf (per est un objet : jamais partagé avec DEFAULT_RULES).
const defaultRules = () => JSON.parse(JSON.stringify(DEFAULT_RULES));
// Quarts ou mi-temps : noms des périodes (q commence à 1).
const halves = () => +S.rules.quarters === 2;
const pShort = q => (halves() ? "MT" : "Q") + q;
const pThe = q => halves() ? `la ${q === 1 ? "1re" : q + "e"} mi-temps` : `le Q${q}`;
const pWord = () => halves() ? "mi-temps" : "quart";

let S = {squad:[],preset:"3-2-3-2",lineup:{},rules:defaultRules(),plan:null,pin:""};
let mode = "home", coachOK = false, preview = null, seedN = 1, sysAsk = null, posNote = "";
const SID = Math.random().toString(36).slice(2);
let inc = null, incBusy = false, incMsg = "", healAsk = null; // healAsk : joueur dont on confirme la fin de blessure
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
    "clubink-l":readableOn(h, "#ffffff", "#000000", 4.5), "clubink-d":readableOn(h, "#132130", "#ffffff", 4.5),
    // version de la couleur lisible sur la carte bleu nuit du prochain changement, et voile pour les pastilles posées sur la couleur
    "clubink-n":readableOn(h, "#1c2f48", "#ffffff", 4.5), clubchip: onColor(h) === "#ffffff" ? "rgba(255,255,255,.2)" : "rgba(11,20,38,.14)"};
}
let appliedColor = "";
function applyColor(){
  const h = hexOk(S.color) ? S.color.toLowerCase() : DEFAULT_COLOR;
  if (h === appliedColor) return;
  appliedColor = h;
  const p = clubPalette(h), st = document.documentElement.style;
  Object.entries(p).forEach(([k,v]) => st.setProperty("--" + k, v));
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", p.club);
}
const canVibrate = typeof navigator !== "undefined" && "vibrate" in navigator;
let far = false; try { far = localStorage.getItem("banc-far") === "1"; } catch(e){}
let season = null, seasonMsg = "", pdfMsg = "";
let saveState = "";
let C = loadClock();

const $ = (s, el=document) => el.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
// Système de l'équipe (S.system) : choisi dans l'effectif, les postes des joueurs (p.pos) sont ceux de ce système.
// Un match pas encore commencé suit le système de l'équipe ; un match commencé ou enregistré garde le sien.
const teamSys = () => PRESETS[S.system] ? S.system : S.preset;
function nearPos(q, from, to){ // places les plus proches dans l'autre système (plusieurs si égalité, ex. back central -> les deux backs centraux)
  const a = (PRESETS[from] || []).find(x => x[0] === q); if (!a || !PRESETS[to]) return [];
  if (a[2] === "gk") return [PRESETS[to][0][0]];
  const field = PRESETS[to].filter(x => x[2] !== "gk"), same = field.filter(x => lineGroup(x[2]) === lineGroup(a[2])), pool = same.length ? same : field;
  const d = x => Math.hypot(x[3] - a[3], x[4] - a[4]), m = Math.min(...pool.map(d));
  return pool.filter(x => d(x) <= m + 3).map(x => x[0]);
}
// keep = true : places adaptées au nouveau système ; false : on efface tout (sauf le gardien, le même partout).
function setSystem(to, keep){
  const from = teamSys(); if (!PRESETS[to] || to === from) return;
  S.squad.forEach(p => { p.pos = keep ? [...new Set((p.pos || []).flatMap(q => nearPos(q, from, to)))] : (p.pos || []).filter(q => q === "G"); });
  S.system = to;
  S.matches.forEach(m => { if (m.id !== S.curMatch && !matchUsed(m)) { m.preset = to; m.lineup = {}; m.plan = m.prevPlan = m.basePlan = null; } });
  followSystem();
  posNote = keep ? `Les postes ont été adaptés au ${to}. Vérifie-les joueur par joueur.` : `Postes effacés : donne à chaque joueur ses places en ${to}.`;
}
// match enregistré ou commencé : il garde son système
const matchUsed = m => !!(m.plan?.savedAt || (m.plan && m.clock && (m.clock.q > 1 || m.clock.elapsed > 0)));
function followSystem(){
  if (S.preset === teamSys() || S.plan?.savedAt || matchStarted()) return;
  S.preset = teamSys(); S.lineup = {}; S.plan = S.prevPlan = S.basePlan = null; preview = null;
}
const posMeta = (id, sys = S.preset) => { const p = (PRESETS[sys] || PRESETS[S.preset]).find(x => x[0] === id); return p ? {id:p[0],label:p[1],line:p[2],x:p[3],y:p[4],short:p[5]||p[0]} : {id,label:id,line:"mid",x:50,y:50,short:id}; };
const posName = (id, sys) => posMeta(id, sys).label;
const posShort = (id, sys) => posMeta(id, sys).short;
const fmtClock = sec => { sec = Math.max(0, Math.round(sec)); return `${Math.floor(sec/60)}:${String(sec%60).padStart(2,"0")}`; };
const fmtQ = t => { const ql = S.rules.qlen; const q = Math.min(S.rules.quarters, Math.floor(t/ql + 1e-6) + 1); const m = t - (q-1)*ql; return {q, m, label: R.fmtMin(m)}; };

/* ---------- storage ---------- */
// Les notes sur 5 ont disparu (2026-10-24) : un joueur de champ noté 5 sans minutes fixées jouait tout le match, il garde ce temps en minutes.
function dropStars(squad, r){ const END = (+r?.quarters || 4) * (+r?.qlen || 17.5); (squad || []).forEach(p => { if (p.note === undefined) return; if (+p.note >= 5 && !(+p.minutes > 0) && (p.pos || []).some(q => q !== "G")) p.minutes = END; delete p.note; }); }
function applyData(v){ v = JSON.parse(JSON.stringify(v)); dropStars(v.squad, v.rules); (v.teams || []).forEach(t => dropStars(t.squad, t.rules)); (v.squad||[]).forEach(p => { if (p.roles) p.roles = [...new Set(p.roles.map(r => ({I:"D",S:"B"})[r] || r).filter(r => r==="D"||r==="B"))]; }); S = {...S, ...v, rules: v.rules ? {...defaultRules(), ...R.migrateRules(v.rules)} : defaultRules()}; }
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
// Barre du haut sur une ligne : l'équipe à gauche ; à droite le match ouvert (page Match, adjoint) ou l'état de la sauvegarde.
// Logo StickMate : l'icône (flèches du changement autour de la balle) et le nom avec le i en crosse.
const LOGO_SVG = `<svg viewBox="0 0 100 100" aria-hidden="true"><path d="M21.8 39.7A30 30 0 0 1 76 35M77.6 23.7 76 35 65.4 30.7" fill="none" stroke="#4ee08f" stroke-width="7.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M78.2 60.3A30 30 0 0 1 24 65M34.6 69.3 24 65 22.4 76.3" fill="none" stroke="#ff7a6e" stroke-width="7.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="50" cy="50" r="11" fill="#f6b81c"/></svg>`;
const WORDMARK = `<span class="wm">St<svg class="wm-i" viewBox="0 0 30 100" aria-hidden="true"><path d="M16 30 15 78Q14 95 1 92" fill="none" stroke="currentColor" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/><circle cx="17" cy="9" r="9.5" fill="#f6b81c"/></svg>ck<span class="wm-mate">Mate</span></span>`;
const COPYRIGHT = "© 2026 Geoffrey Ducobu. StickMate, tous droits réservés.";
const logoLockup = () => `<div class="lockup" role="img" aria-label="StickMate"><span class="logo">${LOGO_SVG}</span>${WORDMARK}</div>`;
function paintSub(){ const bn = $("#brandName"); if (bn) { const t = S.teamName || S.profile?.club; if (t) bn.textContent = t; else bn.innerHTML = WORDMARK; } document.title = S.teamName ? `StickMate · ${S.teamName}` : "StickMate";
 const el = $("#sub"); if (!el) return;
 if (ADJ) { el.innerHTML = `${matchTitle() ? `<b>${esc(S.matchLabel || matchTitle())}</b>` : "Adjoint"}<span>${esc(adjointSub())}</span>`; return; }
 el.innerHTML = mode === "match" && S.matchLabel ? `<b>${esc(S.matchLabel)}</b><span>${esc(fmtDate(S.matchDate))}</span>` : `<span>${esc(saveState)}</span>`; paintSave(); }
function paintSave(){ const el = $("#saveState"); if (el) el.textContent = saveState; }

/* ---------- plan helpers ---------- */
function minStintOf(p){ const l = posMeta(p.pos[0]).line; return l === "def" ? +S.rules.minDef : (l === "dm" || l === "mid") ? +S.rules.minMid : l === "att" ? +S.rules.minAtt : 0; }
// 1er passage des titulaires : pas encore réglé = même chiffre que le minimum normal
const firstOf = k => +(S.rules["first" + k] ?? S.rules["min" + k]);
function minStartOf(p){ const l = posMeta(p.pos[0]).line; return l === "def" ? firstOf("Def") : (l === "dm" || l === "mid") ? firstOf("Mid") : l === "att" ? firstOf("Att") : 0; }
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
  const P = present().map(p => ({name:p.name, note: isMainGk(p) ? 5 : 3, override: p.minutes ? +p.minutes : 0, field: p.pos.some(q => q !== gk)}));
  const tm = timeMode(), byNotes = R.targetsFromNotes(P, ids.length - 1, END).targets;
  // Plan automatique : chaque joueur joue les minutes que le coach lui donne (0 si la case est vide), le gardien titulaire tout le match.
  if (tm === "notes") { const out = {}; P.forEach(x => out[x.name] = x.override ? x.override : x.note >= 5 ? END : 0); return out; }
  if (tm === "manual") return byNotes;
  // Égal pour tous : un seul groupe. Égal par ligne : la ligne du premier poste du joueur.
  const groupOf = id => tm === "all" ? "all" : lineGroup(posMeta(id).line);
  const slots = {}; ids.slice(1).forEach(id => slots[groupOf(id)] = (slots[groupOf(id)] || 0) + 1);
  P.forEach(x => { const pl = present().find(p => p.name === x.name); x.group = groupOf(pl.pos.find(q => q !== gk) || ""); });
  const eq = R.targetsEqual(P, slots, END).targets;
  P.forEach(x => { if (!x.field) eq[x.name] = byNotes[x.name]; }); // le gardien garde son calcul habituel
  return eq;
}
// Minutes de terrain à répartir (joueurs de champ) : total, déjà fixées, reste.
function minBudget(){
  const END = S.rules.quarters * S.rules.qlen, ids = PRESETS[S.preset].map(p => p[0]), gk = ids[0];
  const field = present().filter(p => p.pos.some(q => q !== gk));
  const fixedOf = p => +p.minutes > 0 ? Math.min(END, +p.minutes) : 0;
  const total = (ids.length - 1) * END, used = field.reduce((a, p) => a + fixedOf(p), 0);
  return {END, slots: ids.length - 1, total, left: total - used, auto: timeMode() === "notes" ? 0 : field.filter(p => !fixedOf(p)).length};
}
// En Plan automatique, le plan ne se génère que si toutes les minutes sont données.
function budgetBlock(){ if (timeMode() !== "notes") return null; const b = minBudget(); return Math.abs(b.left) > 0.01 ? b : null; }
// Plan automatique : un titulaire de la compo à 0 minute ne peut pas commencer le match.
function zeroStarters(){ if (timeMode() !== "notes") return []; const T = computeTargets(); return Object.values(S.lineup).filter(n => n && present().some(p => p.name === n) && !(T[n] > 0)); }
function budgetLine(){
  const b = minBudget(), used = b.total - b.left, x = R.fmtMin(Math.abs(b.left)), pct = Math.min(100, used / b.total * 100);
  const over = b.left < -0.01, done = !over && b.left < 0.01, cls = over || (done && b.auto) || (!done && !b.auto) ? " over" : done ? " ok" : "";
  // Égal pour tous / par ligne : l'app partage elle-même ce qui reste, il n'y a rien à distribuer à la main.
  if (!over && !done && b.auto && timeMode() !== "notes") {
    const T = computeTargets(), gk = PRESETS[S.preset][0][0], fixed = b.total - b.left > 0.01;
    const auto = present().filter(p => p.pos.some(q => q !== gk) && !(+p.minutes > 0)), avg = L => R.fmtMin(L.reduce((a, p) => a + (T[p.name] || 0), 0) / L.length);
    const LN = {def: "Défense", mid: "Milieu", att: "Attaque"}, grp = p => lineGroup(posMeta(p.pos.find(q => q !== gk) || "").line);
    const per = timeMode() === "all" ? `environ ${avg(auto)} par joueur` : ["def", "mid", "att"].map(g => auto.filter(p => grp(p) === g)).map((L, i) => L.length ? `${LN[["def", "mid", "att"][i]]} ${avg(L)}` : "").filter(Boolean).join(" · ") + " par joueur";
    return `<div class="budget ok"><div class="budget-big">0' à distribuer : tout est réparti</div>
    <div class="budget-bar"><i style="width:100%"></i></div>
    <div class="budget-sub">${R.fmtMin(b.total)} distribuées sur ${R.fmtMin(b.total)} (${b.slots} postes × ${R.fmtMin(b.END)}). ${fixed ? `${R.fmtMin(b.total - b.left)} fixées à la main, le reste partagé` : "Partagées"} à parts égales${timeMode() === "line" ? " dans chaque ligne" : ""} : ${per}. Tu peux fixer les minutes d'un joueur, le reste est repartagé.</div></div>`;
  }
  const big = over ? `Tu dépasses de ${x}` : done ? "Tout est distribué" : `Il te reste ${x} à distribuer`;
  const note = over ? "Enlève des minutes à certains joueurs."
    : done ? (b.auto ? `Plus rien pour les ${b.auto} joueur${b.auto > 1 ? "s" : ""} sans minutes : enlève des minutes ou remplis leur case.` : "")
    : b.auto ? `Elles iront automatiquement aux ${b.auto} joueur${b.auto > 1 ? "s" : ""} sans minutes (chiffres en gris).` : timeMode() === "notes" ? "Un joueur sans minutes ne joue pas." : "Ajoute des minutes ou vide une case pour le calcul automatique.";
  return `<div class="budget${cls}"><div class="budget-big">${big}</div>
    <div class="budget-bar"><i style="width:${pct}%"></i></div>
    <div class="budget-sub">${R.fmtMin(used)} distribuées sur ${R.fmtMin(b.total)} (${b.slots} postes × ${R.fmtMin(b.END)})${note ? `. ${note}` : ""}</div></div>`;
}
// Temps de jeu du match : "notes" (étoiles et minutes fixées), "all" (égal pour tous), "line" (égal par ligne),
// "manual" (le coach écrit lui-même ses changements, sans règles).
const timeMode = () => S.timeMode || "notes";
const lineGroup = l => l === "def" ? "def" : l === "att" ? "att" : "mid";
const TIME_MODES = [["notes","Plan automatique"],["all","Égal pour tous"],["line","Égal par ligne"],["manual","Plan manuel"]];
// Un joueur de champ fixé à la durée du match joue tout le match d'un bloc.
// Le gardien de la compo de départ (s'il ne joue que gardien) garde le but tout le match, sauf minutes fixées.
const isMainGk = p => S.lineup.G === p.name && !p.pos.some(q => q !== "G") && !(+p.minutes > 0);
const fullMatch = p => isMainGk(p) || (+p.minutes >= S.rules.quarters * S.rules.qlen - 1e-6 && p.pos.some(q => q !== "G"));
function syncMinStint(){ S.rules.minStint = Math.min(+S.rules.minDef, +S.rules.minMid, +S.rules.minAtt); S.rules.maxStint = Math.max(+S.rules.maxDef, +S.rules.maxMid, +S.rules.maxAtt); }
// Maximum d'affilée selon la ligne du 1er poste (le gardien garde le maximum général)
function maxStintOf(p){ const l = posMeta(p.pos[0]).line; return l === "def" ? +S.rules.maxDef : (l === "dm" || l === "mid") ? +S.rules.maxMid : l === "att" ? +S.rules.maxAtt : +S.rules.maxStint; }
function generate(seed){
  syncMinStint();
  const positions = PRESETS[S.preset].map(p => ({id:p[0], gk:p[2]==="gk"}));
  const T = computeTargets();
  // Plan automatique : un joueur à 0 minute reste sur le banc tout le match.
  const players = present().filter(p => timeMode() !== "notes" || T[p.name] > 0).map(p => ({name:p.name, pos:p.pos, target:T[p.name], locked: fullMatch(p), oneBlock: fullMatch(p), maxStint: maxStintOf(p), roles: p.roles || [], minFirst: p.minFirst || 0, minStint: minStintOf(p), minStart: minStartOf(p)}));
  let best = null;
  for (let k = 0; k < 3; k++) {
    const p = R.buildPlan({positions, players, lineup:S.lineup, rules:S.rules, seed: seed + k*7919, iters:300, saIters:40000, chains:4});
    if (p.error) return p;
    if (!best || p.warnings.length < best.warnings.length || (p.warnings.length === best.warnings.length && p.score < best.score)) best = p;
    if (!best.warnings.length) break;
  }
  if (best) { best.timeMode = timeMode(); best.rulesSig = rulesSig(); best.fmt = fmtSig(); }
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
const MATCH_KEYS = ["matchLabel","matchDate","preset","timeMode","lineup","plan","prevPlan","basePlan","sheet","manual"];
const freshClock = () => ({q:1,elapsed:0,running:false,startedAt:0,done:[]});
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2,5);
let matchesOpen = false, newMatchForm = false, delPin = null;
let toolsOpen = false, matchTab = "chg";
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
  ensureTeams();
}
/* ---------- plusieurs équipes ---------- */
// L'équipe ouverte vit dans S (nom, effectif, règles, matchs) et sa saison dans banc-season.
// Les autres équipes sont rangées complètes dans S.teams ; l'équipe ouverte n'y a qu'une fiche {id, teamName}.
let newTeamForm = false;
function ensureTeams(){
  if (!Array.isArray(S.teams)) S.teams = [];
  if (!S.curTeam) S.curTeam = newId();
  if (!S.teams.some(t => t.id === S.curTeam)) S.teams.unshift({id:S.curTeam, teamName:S.teamName || ""});
}
const localSeasonL = () => { try { return JSON.parse(localStorage.getItem("banc-season") || "[]"); } catch(e){ return []; } };
function curTeamRec(){
  storeCur();
  return JSON.parse(JSON.stringify({id:S.curTeam, teamName:S.teamName || "", system:teamSys(), squad:S.squad, rules:S.rules, matches:S.matches, curMatch:S.curMatch, season:localSeasonL()}));
}
const teamLabel = t => (t.id === S.curTeam ? S.teamName : t.teamName) || "Équipe sans nom";
function openTeam(id){
  if (id === S.curTeam) return;
  const r = S.teams.find(t => t.id === id); if (!r) return;
  if (C.running) { C.elapsed = clockElapsed(); C.running = false; }
  const cur = curTeamRec();
  S.teams = S.teams.map(t => t.id === cur.id ? cur : t.id === id ? {id, teamName:r.teamName || ""} : t);
  S.curTeam = id; S.teamName = r.teamName || ""; S.squad = r.squad || [];
  S.system = r.system || (r.matches || []).find(m => m.id === r.curMatch)?.preset || S.preset;
  S.rules = {...defaultRules(), ...R.migrateRules(r.rules)};
  S.matches = r.matches || []; S.curMatch = r.curMatch || null;
  try { localStorage.setItem("banc-season", JSON.stringify(r.season || [])); } catch(e){}
  season = null; preview = null; inc = null;
  if (S.matches.some(m => m.id === S.curMatch)) openMatch(S.curMatch, false);
  else if (S.matches.length) openMatch(sortedMatches()[0].id, false);
  else {
    // Équipe sans match : un match vide, prêt à préparer.
    S.curMatch = null; S.matchLabel = ""; S.matchDate = ""; S.lineup = {}; S.plan = S.prevPlan = S.basePlan = null; S.sheet = {us:[], them:[], pc:0, log:[]};
    C = freshClock(); ensureMatches(); persist(); pushClock();
  }
}
function createTeam(name){
  const id = newId();
  S.teams.push({id, teamName:name, system:teamSys(), squad:[], rules:JSON.parse(JSON.stringify(S.rules)), matches:[], curMatch:null, season:[]});
  openTeam(id);
}
function removeTeam(id){
  if (S.teams.length < 2) return;
  if (id === S.curTeam) openTeam(S.teams.find(t => t.id !== id).id);
  S.teams = S.teams.filter(t => t.id !== id); persist();
}
function teamBar(){
  if (newTeamForm) return `<div class="card"><h2 style="margin:0 0 8px">Nouvelle équipe</h2>
    <p class="muted" style="margin:0 0 10px;font-size:.9rem">Elle aura son effectif, ses matchs et sa saison. Elle reprend tes règles actuelles.</p>
    <div class="row"><input type="text" id="ntName" placeholder="Nom de l'équipe, ex. Dames 1" aria-label="Nom de l'équipe" style="flex:1;min-width:180px;border:1px solid var(--rule);border-radius:8px;padding:8px 10px;background:var(--bg)">
    <button class="btn primary" id="ntGo">Créer</button><button class="btn" id="ntCancel">Annuler</button></div></div>`;
  return `<div class="card"><div class="row" style="justify-content:space-between"><h2 style="margin:0">Mes équipes</h2><button class="btn small" id="ntOpen">+ Nouvelle équipe</button></div>
    <div class="seg" role="group" style="margin-top:10px;flex-wrap:wrap">${S.teams.map(t => `<button data-team="${esc(t.id)}" aria-pressed="${t.id === S.curTeam}">${esc(teamLabel(t))}</button>`).join("")}</div>
    ${S.teams.length > 1 ? `<div style="margin-top:8px"><button class="btn small" id="ntDel">Supprimer « ${esc(teamLabel({id:S.curTeam}))} »</button></div>` : ""}</div>`;
}
function bindTeams(){
  document.querySelectorAll("[data-team]").forEach(b => b.addEventListener("click", () => { openTeam(b.dataset.team); render(); }));
  $("#ntOpen")?.addEventListener("click", () => { newTeamForm = true; render(); $("#ntName")?.focus(); });
  $("#ntCancel")?.addEventListener("click", () => { newTeamForm = false; render(); });
  $("#ntGo")?.addEventListener("click", () => { const n = $("#ntName").value.trim(); if (!n) { $("#ntName").focus(); return; } newTeamForm = false; createTeam(n); coachTab = "squad"; render(); });
  $("#ntDel")?.addEventListener("click", function(){ if (this.dataset.armed) { removeTeam(S.curTeam); render(); } else { this.dataset.armed = 1; this.textContent = "Sûr ? Son effectif, ses matchs et sa saison seront effacés. Touche encore"; } });
}
function storeCur(){ const i = S.matches.findIndex(m => m.id === S.curMatch); if (i >= 0) S.matches[i] = curMatchRec(); else S.matches.push(curMatchRec()); }
function openMatch(id, store = true){
  if (store) storeCur();
  const r = S.matches.find(m => m.id === id); if (!r) return;
  S.curMatch = id;
  S.matchLabel = r.matchLabel || ""; S.matchDate = r.matchDate || "";
  S.preset = r.preset || S.preset; S.timeMode = r.timeMode || "notes"; S.lineup = r.lineup || {}; S.plan = r.plan || null; S.prevPlan = r.prevPlan || null; S.basePlan = r.basePlan || null; S.manual = r.manual || [];
  S.sheet = r.sheet || {us:[], them:[], pc:0, log:[]};
  if (Array.isArray(r.present)) S.squad.forEach(p => p.present = r.present.includes(p.name));
  C = r.clock || freshClock(); C.running = false;
  followSystem();
  preview = null; inc = null; lastAlertKey = ""; persist(); pushClock();
}
function createMatch(opp, date, home){
  if (S.curMatch) storeCur();
  const us = S.profile?.club || S.teamName || "Nous";
  const r = {id:newId(), matchLabel: opp ? (home ? `${us} – ${opp}` : `${opp} – ${us}`) : "", matchDate: date || "", preset:teamSys(), timeMode:timeMode(), lineup:{...S.lineup}, plan:null, prevPlan:null, basePlan:null, manual:[], sheet:{us:[], them:[], pc:0, log:[]}, present: S.squad.map(p => p.name), clock: freshClock()};
  S.matches.push(r); openMatch(r.id, false);
}
function removeMatch(id){
  S.matches = S.matches.filter(m => m.id !== id);
  if (id === S.curMatch) { if (S.matches.length) openMatch(sortedMatches()[0].id, false); else { S.curMatch = null; createMatch("", "", true); } }
  persist();
}
function matchStatus(r){
  if (r.plan?.savedAt) return `Terminé · ${r.sheet?.us?.length || 0}–${r.sheet?.them?.length || 0}`;
  if (r.plan && r.clock && (r.clock.q > 1 || r.clock.elapsed > 0)) return `En cours · ${pShort(r.clock.q)}`;
  return r.plan ? "Plan prêt" : "À préparer";
}
function sortedMatches(){
  const L = S.matches.map(m => m.id === S.curMatch ? curMatchRec() : m);
  return L.sort((a,b) => (a.matchDate || "9999").localeCompare(b.matchDate || "9999"));
}
const fmtDate = d => { if (!d) return "Sans date"; try { return new Date(d + "T12:00:00").toLocaleDateString("fr-BE", {weekday:"short", day:"numeric", month:"short"}); } catch(e){ return d; } };
function matchesView(){
  const rows = sortedMatches().map(r => `<div class="mrow${r.id === S.curMatch ? " cur" : ""}">
      <button class="mopen" data-mopen="${esc(r.id)}"><b>${esc(r.matchLabel || "Match sans nom")}</b><span class="muted">${esc(fmtDate(r.matchDate))} · ${esc(matchStatus(r))}</span></button>
      ${r.id === S.curMatch ? `<span class="live">Ouvert</span>` : ""}
      <button class="x" data-mdel="${esc(r.id)}" aria-label="Supprimer ce match">✕</button></div>`).join("");
  // Supprimer un match efface son plan et son score : on demande le code de verrouillage.
  const delName = delPin && (sortedMatches().find(r => r.id === delPin)?.matchLabel || "Match sans nom");
  if (delPin && S.pin && !coachOK) return pinView("Supprimer un match", `Entre ton code de verrouillage pour supprimer « ${delName} ».`) + `<button class="btn" id="delPinNo">Annuler</button>`;
  return `<div class="card"><div class="row" style="justify-content:space-between"><h2 style="margin:0">Mes matchs</h2><button class="btn small" id="mClose">Fermer</button></div>
    <div class="mlist2" style="margin-top:12px">${rows}</div>
    ${newMatchForm ? `<div class="form" style="margin-top:14px">
        <label class="fld"><span>Adversaire</span><input type="text" id="nmOpp" placeholder="ex. Daring" autocomplete="off"></label>
        <label class="fld"><span>Date</span><input type="date" id="nmDate"></label></div>
      <div class="row" style="margin-top:10px">${segBtnsLocal()}</div>
      <div class="row" style="margin-top:12px"><button class="btn go" id="nmGo">Créer le match</button><button class="btn" id="nmCancel">Annuler</button></div>`
      : `<button class="btn primary" id="nmOpen" style="margin-top:14px">+ Nouveau match</button>`}
    <p class="muted" style="margin:12px 0 0;font-size:.88rem">Chaque match garde ses présents, sa compo, son plan, son chrono et son score. À la fin du match, il va tout seul dans le suivi de saison.</p>
  </div>`;
}
let nmHome = true;
function segBtnsLocal(){ return `<div class="seg" role="group"><button data-nmhome="1" aria-pressed="${nmHome}">Domicile</button><button data-nmhome="0" aria-pressed="${!nmHome}">Extérieur</button></div>`; }
function bindMatches(){
  $("#mList")?.addEventListener("click", () => { matchesOpen = true; toolsOpen = false; render(); window.scrollTo(0, 0); });
  $("#mClose")?.addEventListener("click", () => { matchesOpen = false; newMatchForm = false; delPin = null; render(); });
  $("#nmOpen")?.addEventListener("click", () => { newMatchForm = true; render(); $("#nmOpp")?.focus(); });
  $("#nmCancel")?.addEventListener("click", () => { newMatchForm = false; render(); });
  document.querySelectorAll("[data-nmhome]").forEach(b => b.addEventListener("click", () => { const o = $("#nmOpp").value, d = $("#nmDate").value; nmHome = b.dataset.nmhome === "1"; render(); $("#nmOpp").value = o; $("#nmDate").value = d; }));
  $("#nmGo")?.addEventListener("click", () => { createMatch($("#nmOpp").value.trim(), $("#nmDate").value, nmHome); newMatchForm = false; matchesOpen = false; render(); });
  document.querySelectorAll("[data-mopen]").forEach(b => b.addEventListener("click", () => { if (b.dataset.mopen !== S.curMatch) openMatch(b.dataset.mopen); matchesOpen = false; render(); }));
  document.querySelectorAll("[data-mdel]").forEach(b => b.addEventListener("click", function(){ if (S.pin && !coachOK) { delPin = this.dataset.mdel; render(); return; } if (this.dataset.armed) { removeMatch(this.dataset.mdel); render(); } else { this.dataset.armed = 1; this.textContent = "Sûr ?"; } }));
  if ($("#pinGo") && delPin) { bindPin(() => { const id = delPin; delPin = null; removeMatch(id); }); $("#pinIn").focus(); }
  $("#delPinNo")?.addEventListener("click", () => { delPin = null; render(); });
}
// Match à 0 : on oublie aussi les imprévus et on revient au plan d'avant le premier imprévu.
// Un match déjà fini et enregistré repart aussi de zéro : il sort de la saison et sera réenregistré à la fin.
function resetMatch(){ const at = S.plan?.savedAt; C = {q:1,elapsed:0,running:false,startedAt:0,done:[]}; S.sheet = {us:[], them:[], pc:0, log:[]}; if (S.basePlan) S.plan = S.basePlan; S.basePlan = null; if (S.plan?.manual) S.plan = manualPlan([]);
  // (le plan d'avant les imprévus n'a pas la marque « enregistré » : on la lit avant de le remettre)
  if (S.plan) delete S.plan.savedAt; if (at) unsaveSeason(at); S.prevPlan = null; inc = null; incBusy = false; incMsg = ""; lastAlertKey = ""; persist(); pushClock(); render(); }
let actx = null;
function unlockAudio(){ try { actx = actx || new (window.AudioContext||window.webkitAudioContext)(); actx.resume?.(); } catch(e){} }
function beep(n){ if (prefs.vibrate && canVibrate) { try { navigator.vibrate(Array.from({length:n}, () => [200,100]).flat()); } catch(e){} } if (!actx || !prefs.sound) return; try { for (let i=0;i<n;i++){ const o = actx.createOscillator(), g = actx.createGain(); o.frequency.value = 880; o.connect(g); g.connect(actx.destination); const t0 = actx.currentTime + i*0.25; g.gain.setValueAtTime(0.0001,t0); g.gain.exponentialRampToValueAtTime(0.4,t0+0.02); g.gain.exponentialRampToValueAtTime(0.0001,t0+0.18); o.start(t0); o.stop(t0+0.2);} } catch(e){} try{navigator.vibrate?.(200)}catch(e){} }

/* ---------- incidents ---------- */
const INC = {bless:{label:"Blessure",icon:"🩹",d:0}, vert:{label:"Carton vert",icon:"🟩",d:2}, jaune:{label:"Carton jaune",icon:"🟨",d:5}, jaune10:{label:"Carton jaune",icon:"🟨",d:10}, rouge:{label:"Carton rouge",icon:"🟥",d:0}};
const timedCard = t => t==="vert" || t==="jaune" || t==="jaune10";
function eventsOf(){ return (S.plan && S.plan.events) || []; }
// Annuler le dernier imprévu. « Plan manuel » : on retire le dernier imprévu et la liste (même modifiée depuis) est rejouée.
function undoIncident(){
  if (S.plan?.manual && eventsOf().length) {
    const last = eventsOf().slice(-1)[0];
    const evs = eventsOf().slice(0, -1).map(e => last.type === "retour" && e.type === "bless" && e.player === last.player && e.back === last.t ? (({back, ...r}) => r)(e) : e);
    S.plan = manualPlan(evs); S.prevPlan = evs.length ? S.plan : null;
  } else if (S.prevPlan) { S.plan = S.prevPlan; S.prevPlan = null; }
  syncDone(); pushClock(); persist();
}
function outForGood(){ return eventsOf().filter(e => (e.type==="bless" && e.back === undefined) || e.type==="rouge").map(e => e.player); }
// Minutes jouées par un joueur jusqu'à t dans le plan.
function playedUntil(plan, n, t){ return plan.segs.reduce((a, s) => a + (n in s.on ? Math.max(0, Math.min(s.b, t) - s.a) : 0), 0); }
// Remplaçants possibles pour un blessé : ceux qui connaissent son poste d'abord, puis ceux qui ont le plus de temps à rattraper.
function injuryBench(seg, p, T){
  const q = seg.on[p], tg = S.plan.targets || {};
  return present().filter(x => !(x.name in seg.on) && !outForGood().includes(x.name))
    .map(x => ({name:x.name, knows: x.pos.includes(q) || extraPos(x.name).includes(q), line: x.pos.some(z => lineGroup(posMeta(z).line) === lineGroup(posMeta(q).line)), left: (tg[x.name] || 0) - playedUntil(S.plan, x.name, T)}))
    .sort((a,b) => (b.knows - a.knows) || (b.line - a.line) || (ADJ ? a.name.localeCompare(b.name) : b.left - a.left));
}
// Postes ajoutés en cours de match (joueur mis hors de son poste pour remplacer un blessé).
function extraPos(n){ return eventsOf().filter(e => e.inP === n && e.extraPos).map(e => e.extraPos); }
function replanBase(T){
  const positions = PRESETS[S.preset].map(x => ({id:x[0], gk:x[2]==="gk"}));
  const Tg = computeTargets();
  // Plan automatique : un joueur à 0 minute reste hors du plan, sauf s'il a joué ou si le coach le fait entrer.
  const sits = x => S.plan.timeMode === "notes" && !(S.plan.targets?.[x.name] > 0) && !(playedUntil(S.plan, x.name, T) > 0) && !eventsOf().some(e => e.inP === x.name) && inc?.inP !== x.name;
  const players = present().filter(x => !sits(x)).map(x => ({name:x.name, pos:[...x.pos, ...extraPos(x.name).filter(q => !x.pos.includes(q))], target: S.plan.targets?.[x.name] ?? Tg[x.name], locked: fullMatch(x), oneBlock: fullMatch(x), maxStint: maxStintOf(x), roles: x.roles || [], minFirst: x.minFirst || 0, minStint: minStintOf(x), minStart: minStartOf(x)}));
  const o = {T, positions, players, rules:S.rules, out: outForGood(), vacate: eventsOf().filter(e => e.type==="rouge").map(e => e.pos), seed: Date.now()%100000, adjust: {}};
  // (le temps retiré par les cartons précédents est déjà compté dans S.plan.targets)
  return o;
}
function applyPlan(res){ ["timeMode", "rulesSig", "fmt"].forEach(k => { if (S.plan?.[k]) res[k] = S.plan[k]; }); if (!S.basePlan) S.basePlan = S.plan; S.prevPlan = S.plan; S.plan = res; inc = null; incBusy = false; incMsg = ""; syncDone(); pushClock(); persist(); render(); }
// Fin de blessure. catchUp = true : le plan lui rend les minutes manquées (reprises un peu sur les autres).
// false : il ne rattrape rien, il garde seulement ce qui était prévu pour lui après ce moment avant sa blessure.
function endInjury(n, catchUp = true){
  healAsk = null;
  const T = Math.floor(matchT()*10)/10;
  if (S.plan?.manual) {
    const evs = [...eventsOf().map(e => e.type==="bless" && e.player===n && e.back === undefined ? {...e, back:T} : e), {t:T, type:"retour", player:n}];
    applyPlan(manualPlan(evs)); return;
  }
  const o = replanBase(T); o.out = o.out.filter(x => x !== n);
  const ev = eventsOf().find(e => e.type==="bless" && e.player===n && e.back === undefined);
  if (!catchUp) {
    const END = S.rules.quarters*S.rules.qlen, pl = o.players.find(x => x.name === n);
    const played = S.plan.segs.reduce((a, s) => a + (n in s.on ? Math.max(0, Math.min(s.b, T) - s.a) : 0), 0);
    const after = ev?.was ? ev.was.reduce((a, [x, y]) => a + Math.max(0, Math.min(y, END) - Math.max(x, T)), 0)
      : Math.max(0, pl.target - played - (T - (ev?.t ?? T)));
    o.adjust[n] = played + after - pl.target;
  }
  const res = R.replan(S.plan, o);
  if (res.error) { incMsg = res.warnings.join(" "); render(); return; }
  res.events = [...eventsOf().map(e => e === ev ? {...e, back:T} : e), {t:T, type:"retour", player:n, catchUp}];
  applyPlan(res);
}
function doIncident(){
  if (inc.pending) { applyPlan(inc.pending); return; }
  const T = Math.floor(matchT()*10)/10;
  const type = inc.type, p = inc.player, info = INC[type] || {d:0};
  const seg = segAt(S.plan, T);
  // « Plan manuel » : la liste du coach continue, rien n'est recalculé.
  if (S.plan.manual) {
    const evs = [...eventsOf(), {t:T, type, player:p, inP: inc.inP || null, d:info.d, pos: seg.on[p] || null}];
    const res = manualPlan(evs), fresh = res.warnings.filter(w => !S.plan.warnings.includes(w));
    if (fresh.length) { res.fresh = fresh; inc.pending = res; incBusy = false; render(); return; }
    applyPlan(res); return;
  }
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
  let res = res0 || R.replan(S.plan, o);
  // Hors plan : si personne ne peut être réorganisé, le joueur qui entre joue au poste du sortant jusqu'à la fin.
  if (res.error && type === "libre" && seg.on[p]) {
    const q = inc.pos || seg.on[p], pl = o.players.find(x => x.name === inc.inP);
    if (pl && !pl.pos.includes(q)) { pl.pos = [...pl.pos, q]; extra = q; res = R.replan(S.plan, o); }
  }
  if (res.error) { incMsg = res.warnings.join(" "); incBusy = false; render(); return; }
  res.events = [...eventsOf(), {t:T, type, player:p, inP: inc.inP || null, extraPos: extra, d:info.d, pos: seg.on[p] || null, catchUp: !!inc.catchUp, ...(type === "bless" ? {was: S.plan.intervals?.[p] || null} : {})}];
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
    if (e.type==="bless" && e.back === undefined && t >= e.t - 1e-6) out.push(healAsk === e.player
      ? `<div class="banner bless"><b>🩹 ${esc(e.player)} revient.</b> Doit-il rattraper son temps de jeu ?<div class="note" style="color:inherit;opacity:.85;margin-top:4px">Oui : le plan lui rend les minutes manquées en reprenant un peu sur les autres. Non : il garde seulement le temps qui était prévu pour lui à partir de maintenant.</div><div class="row" style="gap:8px;margin-top:10px;flex-wrap:wrap"><button class="btn small" data-heal="${esc(e.player)}" data-catch="1">Oui, rattraper</button><button class="btn small" data-heal="${esc(e.player)}" data-catch="0">Non</button><button class="btn small" id="healCancel">Annuler</button></div></div>`
      : `<div class="banner bless row" style="justify-content:space-between"><span><b>🩹 ${esc(e.player)} blessé</b> : ${S.plan?.manual ? "ta liste continue sans lui." : "le plan est recalculé sans lui."}</span><button class="btn small" data-heal="${esc(e.player)}">Fin de blessure</button></div>`);
    if (e.type==="retour" && t >= e.t - 1e-6 && t < e.t + 2) out.push(`<div class="banner vert"><b>✚ ${esc(e.player)} de retour</b> : il est sur le banc, ${S.plan?.manual ? "ta liste continue." : e.catchUp === false ? "il reprend le temps prévu sans rattraper." : "le plan lui redonne du temps."}</div>`);
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
    ${outQ && inc.inP && S.plan?.manual ? `<div class="muted" style="margin-top:10px;font-size:.92rem">${esc(inc.inP)} prend le poste ${pill(outQ)} de ${esc(inc.player)} et reprend ses changements prévus dans ta liste (et inversement).</div>` : outQ && inc.inP ? `<div class="muted" style="margin-top:10px;font-size:.92rem">${canQ(inc.inP) ? `${esc(inc.inP)} prend le poste ${pill(outQ)} de ${esc(inc.player)}.` : `${esc(inc.inP)} ne joue pas ${esc(posName(outQ).toLowerCase())} : l'app réorganise le terrain pour qu'il prenne un poste qu'il connaît. Si c'est impossible, il jouera ${esc(posName(outQ).toLowerCase())} jusqu'à la fin du match.`} Le reste du plan est recalculé.</div>` : ""}
    ${incMsg ? `<div class="warn" style="margin-top:10px">${esc(incMsg)}</div>` : ""}
    <div class="row" style="margin-top:12px"><button class="btn go big" id="incGo" ${inc.player && inc.inP && !incBusy ? "" : "disabled"}>${incBusy ? "Recalcul…" : "Valider"}</button><button class="btn" id="incCancel">Annuler</button></div>
  </div>`;
}
function incidentPanel(seg){
  if (!inc) return "";
  if (inc.type === "libre" && !inc.pending) return swapPanel(seg);
  const onField = Object.keys(seg.on);
  const card = timedCard(inc.type);
  if (inc.pending?.fresh) return `<div class="card incp"><h2>À savoir</h2>
    <p style="margin:0 0 8px">Avec cet imprévu, ces changements de ta liste ne sont plus possibles et seront sautés :</p>
    <div class="warn">${inc.pending.fresh.map(w => esc(w)).join("<br>")}</div>
    <p class="muted" style="margin:8px 0 0;font-size:.92rem">${ADJ ? "Le coach peut les remplacer ensuite sur son téléphone." : "Tu peux les remplacer ensuite dans la page Coach, partie « Plan de rotation »."}</p>
    <div class="row" style="margin-top:12px"><button class="btn go big" id="incGo">Valider</button><button class="btn" id="incBack">Revenir</button></div>
  </div>`;
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
    <div class="inc-players">${subs.map((x,k) => `<button class="btn${x.knows ? "" : " dim"}" data-incin="${esc(x.name)}" aria-pressed="${inc.inP===x.name}">${esc(x.name)}${k===0 && (x.knows || x.line) ? " <small>conseillé</small>" : ""}${x.knows ? "" : x.line ? " <small>même ligne</small>" : " <small>hors poste</small>"}</button>`).join("") || '<span class="muted">Personne sur le banc : on joue à 10.</span>'}</div>
    ${S.plan?.manual && inc.inP ? `<div class="muted" style="margin-top:8px;font-size:.92rem">${esc(inc.inP)} prend le poste ${esc(posName(q).toLowerCase())} et reprend les changements prévus de ${esc(inc.player)}.</div>` : inc.inP && !subs.find(x => x.name === inc.inP)?.knows ? `<div class="muted" style="margin-top:8px;font-size:.92rem">${esc(inc.inP)} ne joue pas ${esc(posName(q).toLowerCase())} : l'app réorganise le terrain pour qu'il prenne un poste qu'il connaît. Si c'est impossible, il jouera ${esc(posName(q).toLowerCase())} jusqu'à la fin du match.</div>` : ""}` : "";
  return `<div class="card incp"><h2>Imprévu</h2>
    <div class="inc-types">${Object.entries(INC).map(([k,v]) => `<button class="btn inc-t ${k}" data-inct="${k}" aria-pressed="${inc.type===k}">${v.icon} ${esc(v.label)}${v.d?` ${v.d}'`:""}</button>`).join("")}</div>
    <div class="muted" style="margin:10px 0 6px;font-size:.9rem">Quel joueur ?</div>
    <div class="inc-players">${onField.map(n => `<button class="btn" data-incp="${esc(n)}" aria-pressed="${inc.player===n}">${esc(n)}</button>`).join("")}</div>
    ${subHtml}
    ${card && !S.plan?.manual ? `<div class="muted" style="margin:10px 0 6px;font-size:.9rem">À son retour, doit-il rattraper les ${INC[inc.type].d} minutes de la carte ?</div>
    <div class="inc-players"><button class="btn" data-catch-card="1" aria-pressed="${inc.catchUp===true}">Oui, rattraper</button><button class="btn" data-catch-card="0" aria-pressed="${inc.catchUp===false}">Non</button></div>
    ${inc.catchUp !== undefined ? `<div class="muted" style="margin-top:6px;font-size:.88rem">${inc.catchUp ? "Le plan lui rendra ces minutes en reprenant un peu sur les autres." : "Il perd ces minutes, les autres jouent un peu plus."}</div>` : ""}` : ""}
    ${incMsg ? `<div class="warn" style="margin-top:10px">${esc(incMsg)}</div>` : ""}
    <div class="row" style="margin-top:12px"><button class="btn go big" id="incGo" ${inc.type && inc.player && !incBusy && !(card && !S.plan?.manual && inc.catchUp === undefined) ? "" : "disabled"}>${incBusy ? "Recalcul…" : S.plan?.manual ? "Valider" : "Valider et recalculer"}</button><button class="btn" id="incCancel">Annuler</button></div>
  </div>`;
}
/* ---------- match sheet ---------- */
function sheet(){ S.sheet ||= {us:[], them:[], pc:0, log:[]}; return S.sheet; }
let scorerPick = false;
function sheetCard(seg){
  const sh = sheet();
  return `<div class="sheet"><div class="sheet-row">
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
  const done = msg => { if (btn) { btn.disabled = false; btn.textContent = "📄 Plan B (PDF)"; } pdfMsg = msg; render(); };
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
      y += 3; line(halves() ? `${q === 1 ? "1re" : q + "e"} mi-temps` : `Quart ${q}`, 13, true);
      const list = visChanges(plan).filter(c => (q > 1 && Math.abs(c.t-(q-1)*ql) < 1e-6) || (c.t > (q-1)*ql + 1e-6 && c.t < q*ql - 1e-6));
      if (!list.length) line("Aucun changement", 10, false, 18);
      list.forEach(c => {
        const lab = Math.abs(c.t-(q-1)*ql) < 1e-6 ? "Pause" : fmtQ(c.t).label;
        line(lab, 11, true, 16);
        pairChanges(c).forEach(pr => line(`${pr.inP || "-"} remplace ${pr.outP || "-"}${pr.inQ ? "  (" + posName(pr.inQ) + ")" : ""}`, 10, false, 30));
        moveGroups(c).forEach(g => line(`Changement de poste : ${moveText(g)}`, 9, false, 30));
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
      const pin = S.pin; applyData(d.state); S.pin = pin; S.matches = d.state.matches; S.curMatch = d.state.curMatch; S.teams = d.state.teams; S.curTeam = d.state.curTeam; ensureMatches();
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
  const rec = {match: S.curMatch || null, date: S.matchDate || new Date().toISOString().slice(0,10), label: S.matchLabel || "", minutes: {}, targets: {}, us: sh.us.length, them: sh.them.length, pc: sh.pc, scorers: sh.us.map(g => g.player).filter(Boolean), cards: eventsOf().filter(e => e.type!=="bless" && e.type!=="libre").map(e => ({type:e.type, player:e.player}))};
  for (const [n,m] of Object.entries(S.plan.played)) rec.minutes[n] = Math.round(m*10)/10;
  for (const [n,m] of Object.entries(S.plan.targets||{})) rec.targets[n] = Math.round(m*10)/10;
  try {
    const at = Date.now(), L = JSON.parse(localStorage.getItem("banc-season") || "[]"); L.push({id:String(at), savedAt:at, ...rec}); localStorage.setItem("banc-season", JSON.stringify(L));
    S.plan.savedAt = at; persist(); seasonMsg = "Match enregistré dans la saison ✓";
  } catch(e){ seasonMsg = "L'enregistrement a échoué, réessaie."; }
  season = null; render();
}
// Retire de la saison le match enregistré à l'instant « at » (même match, même enregistrement).
function unsaveSeason(at){
  try { const L = JSON.parse(localStorage.getItem("banc-season") || "[]"), K = L.filter(x => !(x.savedAt === at || Math.abs(+x.id - at) < 5000)); if (K.length !== L.length) localStorage.setItem("banc-season", JSON.stringify(K)); } catch(e){}
  season = null; seasonMsg = "";
}
async function deleteMatch(id){
  try {
    const L = JSON.parse(localStorage.getItem("banc-season") || "[]").filter(x => x.id !== id); localStorage.setItem("banc-season", JSON.stringify(L));
    markChanged();
  } catch(e){}
  season = null; loadSeason();
}
// Notes sur 10 données après le match (match.ratings), visibles seulement dans la page Coach.
let rateId = null;
function setRating(id, name, val){
  try {
    const L = JSON.parse(localStorage.getItem("banc-season") || "[]"), rec = L.find(x => x.id === id); if (!rec) return;
    rec.ratings ||= {}; if (val) rec.ratings[name] = +val; else delete rec.ratings[name];
    localStorage.setItem("banc-season", JSON.stringify(L)); markChanged();
    const m = season?.find(x => x.id === id); if (m) m.ratings = {...rec.ratings};
  } catch(e){}
}
function ratingCard(){
  const m = season?.find(x => x.id === rateId); if (!m) return "";
  const names = Object.keys(m.minutes || {}).filter(n => m.minutes[n] > 0).sort((a, b) => a.localeCompare(b, "fr", {numeric:true}));
  const rows = names.map(n => `<label class="minrow"><span>${esc(n)}</span><select data-rate="${esc(n)}" aria-label="Note de ${esc(n)}"><option value="">—</option>${[1,2,3,4,5,6,7,8,9,10].map(v => `<option ${m.ratings?.[n] === v ? "selected" : ""}>${v}</option>`).join("")}</select></label>`).join("");
  return `<div class="card rate-card"><div class="row" style="justify-content:space-between"><h2 style="margin:0">Notes du match</h2><button class="btn small" id="rateClose">Fermer</button></div>
    <p class="muted" style="margin:4px 0 10px;font-size:.9rem">${esc([m.date, m.label].filter(Boolean).join(" · "))}${m.us !== undefined ? ` · ${m.us}–${m.them}` : ""}. Une note sur 10 pour chaque joueur qui a joué. Elle est gardée dans ta saison et n'apparaît que dans la page Coach.</p>
    ${rows ? `<div class="mins">${rows}</div>` : `<p class="muted">Personne n'a joué dans ce match.</p>`}</div>`;
}
function seasonHtml(){
  if (season === null) { loadSeason(); return `<p class="muted">Chargement…</p>`; }
  if (!season.length) return `<p class="muted">Aucun match enregistré. À la fin d'un match, touche « Enregistrer le match dans la saison » (onglet Match ou ci-dessus).</p>`;
  const stat = {};
  const blank = () => ({n:0,tot:0,dev:0,g:0,rn:0,rt:0,cv:0,cj:0,cr:0});
  season.forEach(m => { Object.entries(m.minutes||{}).forEach(([n,v]) => { const s = stat[n] ||= blank(); s.n++; s.tot += v; s.dev += v - (m.targets?.[n] ?? v); }); (m.scorers||[]).forEach(n => { (stat[n] ||= blank()).g++; }); Object.entries(m.ratings||{}).forEach(([n,v]) => { const s = stat[n] ||= blank(); s.rn++; s.rt += v; }); (m.cards||[]).forEach(c => { const k = c.type === "vert" ? "cv" : c.type === "rouge" ? "cr" : c.type === "jaune" || c.type === "jaune10" ? "cj" : ""; if (k && c.player) (stat[c.player] ||= blank())[k]++; }); });
  const rows = Object.entries(stat).sort((a,b)=>b[1].tot-a[1].tot).map(([n,s]) => {
    const sug = s.rn ? `<b>${String(Math.round(s.rt / s.rn * 10) / 10).replace(".", ",")}</b><span class="muted">/10</span>` : `<span class="muted">—</span>`;
    const cards = [["cv","g"],["cj","y"],["cr","r"]].filter(([k]) => s[k]).map(([k,c]) => `<span class="cardn ${c}">${s[k]}</span>`).join("");
    return `<tr><td>${esc(n)}</td><td>${s.n}</td><td>${s.g||""}</td><td>${cards}</td><td>${R.fmtMin(s.tot)}</td><td>${R.fmtMin(s.tot/s.n)}</td><td class="dev" style="color:${Math.abs(s.dev)<8?"var(--in)":"var(--out)"}">${s.dev>=0?"+":"−"}${R.fmtMin(Math.abs(s.dev))}</td><td>${sug}</td></tr>`; }).join("");
  const list = season.map(m => `<span class="mchip"><button class="rate-b" data-ratem="${esc(m.id)}" aria-pressed="${rateId === m.id}" title="Noter les joueurs">${Object.keys(m.ratings || {}).length ? "★" : "☆"} Noter</button>${esc(m.date)}${m.label?` · ${esc(m.label)}`:""}${m.us!==undefined?` · <b>${m.us}–${m.them}</b>`:""} <button class="x" data-delm="${esc(m.id)}" aria-label="Supprimer ce match">✕</button></span>`).join("");
  return `<div class="tbl-wrap"><table class="recap"><thead><tr><th>Joueur</th><th>Matchs</th><th>Buts</th><th>Cartes</th><th>Total</th><th>Moyenne</th><th>Écart cumulé</th><th>Note moy.</th></tr></thead><tbody>${rows}</tbody></table></div>
    <p class="muted" style="font-size:.85rem;margin:10px 0 6px">Écart cumulé = minutes jouées moins minutes visées, sur tous les matchs. Les cartes comptent comme du temps hors du terrain. Touche « Noter » sur un match pour noter tes joueurs sur 10.</p><div class="mlist">${list}</div>`;
}

/* ---------- rendering ---------- */
const VIEWS = {home:[homeView, bindHome], match:[() => matchesOpen ? matchesView() : matchView(), () => { bindMatches(); if (!matchesOpen) bindMatch(); }], coach:[coachView, bindCoach], settings:[settingsView, bindSettings]};
function render(){
  applyColor();
  paintSub();
  document.querySelectorAll("[data-tab]").forEach(b => b.setAttribute("aria-current", b.dataset.tab === mode ? "page" : "false"));
  const v = $("#view");
  if (ADJ) {
    document.body.classList.add("adjoint"); mode = "match"; const v2 = $("#view");
    if (!S.plan || adjEnded) { v2.innerHTML = adjointWait(); return; }
    // Sans le téléphone du coach, rien ne serait partagé : on affiche le match mais tout est bloqué.
    const off = !liveCoach; document.body.classList.toggle("adj-off", off);
    v2.innerHTML = (off ? `<div class="warn" style="font-weight:600">Le téléphone du coach n'est plus connecté : tu ne peux rien modifier en attendant. Tout redevient actif dès qu'il revient.</div>` : "") + matchView(); bindMatch(); return;
  }
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
// Changements de poste sur le terrain : deux joueurs qui inversent leur poste ne font qu'une ligne ;
// les glissements sont rangés dans l'ordre de la chaîne, en partant du poste laissé par celui qui sort.
function moveGroups(ch){
  const used = new Set(), out = [];
  ch.moves.forEach(([p,a,b], i) => {
    if (used.has(i)) return;
    const j = ch.moves.findIndex(([, a2, b2], k) => k !== i && !used.has(k) && a2 === b && b2 === a);
    if (j >= 0) { used.add(i); used.add(j); out.push({swap:true, p, a, b, p2: ch.moves[j][0]}); }
  });
  const chainFrom = q => { let m; while ((m = ch.moves.findIndex(([, , b], k) => !used.has(k) && b === q)) >= 0) { used.add(m); const [p, a, b] = ch.moves[m]; out.push({p, a, b}); q = a; } };
  ch.outs.forEach(([, q]) => chainFrom(q));
  ch.moves.forEach(([p, a, b], k) => { if (!used.has(k)) { used.add(k); out.push({p, a, b}); chainFrom(a); } });
  return out;
}
const lc = id => posName(id).toLowerCase();
function moveText(g){
  return g.swap ? `${g.p} et ${g.p2} échangent leur poste (${lc(g.a)} et ${lc(g.b)})` : `${g.p} : ${lc(g.a)} → ${lc(g.b)}`;
}
// Petit terrain avec des flèches : d'où part et où va chaque joueur qui change de poste.
function movePitch(groups, dot){
  const xy = q => { const p = (PRESETS[S.preset] || []).find(([id]) => id === q); return p ? [1 + p[3]*0.6, 1 + p[4]*0.86] : null; };
  const arrows = groups.map(g => {
    const A = xy(g.a), B = xy(g.b); if (!A || !B) return "";
    const dx = B[0]-A[0], dy = B[1]-A[1], L = Math.hypot(dx, dy) || 1, ux = dx/L, uy = dy/L, r = 6;
    const a = [A[0]+ux*r, A[1]+uy*r], b = [B[0]-ux*r, B[1]-uy*r];
    const head = (P, sx, sy) => `<path class="ah" d="M${(P[0]).toFixed(1)} ${(P[1]).toFixed(1)} L${(P[0]-sx*5-sy*3).toFixed(1)} ${(P[1]-sy*5+sx*3).toFixed(1)} L${(P[0]-sx*5+sy*3).toFixed(1)} ${(P[1]-sy*5-sx*3).toFixed(1)}Z"/>`;
    return `<line class="ar" x1="${a[0].toFixed(1)}" y1="${a[1].toFixed(1)}" x2="${b[0].toFixed(1)}" y2="${b[1].toFixed(1)}"/>${head(b, ux, uy)}${g.swap ? head(a, -ux, -uy) : ""}<circle cx="${A[0].toFixed(1)}" cy="${A[1].toFixed(1)}" r="4"/><circle cx="${B[0].toFixed(1)}" cy="${B[1].toFixed(1)}" r="4"/>`;
  }).join("");
  const D = dot ? xy(dot) : null; // poste où entre le remplaçant
  return `<svg class="mini mv" viewBox="0 0 62 88" aria-hidden="true"><g><rect x="1" y="1" width="60" height="86" rx="3"/><line x1="1" y1="44" x2="61" y2="44"/><path d="M17 1 A14 14 0 0 0 45 1"/><path d="M17 87 A14 14 0 0 1 45 87"/></g>${arrows}${D ? `<circle class="in" cx="${D[0].toFixed(1)}" cy="${D[1].toFixed(1)}" r="6"/>` : ""}</svg>`;
}
// Petit terrain avec un point sur le poste concerné.
function miniPitch(q){
  const p = (PRESETS[S.preset] || []).find(([id]) => id === q);
  if (!p) return "";
  return `<svg class="mini" viewBox="0 0 62 88" role="img" aria-label="Poste : ${esc(posName(q))}"><g><rect x="1" y="1" width="60" height="86" rx="3"/><line x1="1" y1="44" x2="61" y2="44"/><path d="M17 1 A14 14 0 0 0 45 1"/><path d="M17 87 A14 14 0 0 1 45 87"/></g><circle cx="${(1 + p[3]*0.6).toFixed(1)}" cy="${(1 + p[4]*0.86).toFixed(1)}" r="6"/></svg>`;
}
function changeLines(ch){
  // Les joueurs déjà sur le terrain qui bougent à cause d'un remplacement sont montrés avec ce remplacement :
  // le sortant libère un poste, un joueur du terrain y glisse, le remplaçant prend le poste laissé (chaîne).
  const usedM = new Set();
  const chainOf = pr => { const L = []; let q = pr.outQ, k;
    while (pr.inP && pr.outP && q !== pr.inQ && (k = ch.moves.findIndex(([, , b], i) => !usedM.has(i) && b === q)) >= 0) { usedM.add(k); const [p, a, b] = ch.moves[k]; L.push({p, a, b}); q = a; }
    return L; };
  let html = pairChanges(ch).map(pr => { const mv = chainOf(pr); return `<div class="swap">
      <div class="s-names">
        <div class="s-row s-in"><span class="mk in" aria-hidden="true">↑</span><span class="big"><span class="sr">Entre : </span>${esc(pr.inP || "—")}</span></div>
        <div class="s-row s-out"><span class="mk out" aria-hidden="true">↓</span><span class="big"><span class="sr">Sort : </span>${esc(pr.outP || "—")}</span></div>
        ${mv.map((g, i) => `<div class="s-row s-mv"><span class="mk mv" aria-hidden="true">⇄</span><span class="mvt"><span><b>${esc(i + 1 < mv.length ? mv[i + 1].p : pr.inP)}</b> prend la place de <b>${esc(g.p)}</b> (${esc(lc(g.a))}), ${esc(g.p)} passe ${esc(lc(g.b))}</span></span></div>`).join("")}
      </div>
      ${mv.length ? movePitch(mv, pr.inQ) : miniPitch(pr.inQ || pr.outQ)}
      ${pr.inP && !mv.length ? `<div class="where">${pill(pr.inQ)} ${esc(posMeta(pr.inQ).label)}${pr.outP && pr.outQ !== pr.inQ ? ` <span class="note">(${esc(pr.outP)} jouait ${esc(lc(pr.outQ))})</span>` : ""}</div>` : ""}
    </div>`; }).join("");
  const mg = moveGroups({...ch, moves: ch.moves.filter((m, i) => !usedM.has(i))});
  if (mg.length) html += `<div class="reorg"><div class="reorg-x"><div class="reorg-t">Changements de poste</div>${mg.map(g => g.swap
      ? `<div class="reorg-l"><div class="rl-h">⇄ <b>${esc(g.p)}</b> et <b>${esc(g.p2)}</b> échangent</div><div class="rl-d"><b>${esc(g.p)}</b> ${pill(g.a)} → ${pill(g.b)}</div><div class="rl-d"><b>${esc(g.p2)}</b> ${pill(g.b)} → ${pill(g.a)}</div></div>`
      : `<div class="reorg-l"><div class="rl-h"><b>${esc(g.p)}</b></div><div class="rl-d">${pill(g.a)} → ${pill(g.b)} ${esc(posName(g.b))}</div></div>`).join("")}</div>${movePitch(mg)}</div>`;
  return html;
}
function matchView(){
  mRefresh();
  const plan = S.plan;
  if (!plan) return `<div class="card empty"><h2>Pas encore de plan</h2><p class="muted">Va dans la page Coach : coche les présents, choisis la compo, puis génère le plan de rotation.</p><button class="btn primary" id="goCoach">Aller à la page Coach</button></div>`;
  const fEnd = plan.segs[plan.segs.length - 1].b, END = S.rules.quarters * S.rules.qlen;
  if (!plan.savedAt && (Math.abs(fEnd - END) > 1e-6 || (plan.fmt && plan.fmt !== fmtSig()))) { const [pq, pl] = (plan.fmt || "").split("x"); return `<div class="card empty"><h2>Plan à refaire</h2><p class="muted">Ce plan a été fait pour ${plan.fmt ? (+pq === 2 ? "2 mi-temps" : pq + " quarts") + " de " + R.fmtMin(+pl) : "un match de " + R.fmtMin(fEnd)}. Tes règles disent maintenant ${S.rules.quarters} ${pWord()}${halves() ? "" : "s"} de ${R.fmtMin(+S.rules.qlen)}. Génère un nouveau plan dans la page Coach.</p><button class="btn primary" id="goCoach">Aller à la page Coach</button></div>`; }
  const ql = S.rules.qlen, el = clockElapsed(), t = matchT();
  const atEnd = el >= ql*60 - 0.5;
  const next = visChanges(plan).find(c => !C.done.includes(c.t) && c.t >= t - 0.01 - 0.35);
  const qEndT = C.q*ql;
  let alertHtml;
  const matchOver = atEnd && C.q >= S.rules.quarters;
  if (!next) alertHtml = `<div class="alert calm"><div class="alert-title">${matchOver ? "Fin du match" : "Plus de changement prévu"}</div>${matchOver ? (plan.savedAt ? `<div class="ok">Match enregistré dans la saison ✓</div>${ADJ ? "" : `<button class="btn big primary" id="goRate" style="margin-top:8px">Noter les joueurs</button>`}` : ADJ ? "" : `<button class="btn big primary" id="saveMatch">Enregistrer le match dans la saison</button>`) : `<div class="muted">Plus aucun changement jusqu'à la fin.</div>`}${seasonMsg && matchOver && !plan.savedAt ? `<div class="muted">${esc(seasonMsg)}</div>` : ""}</div>`;
  else {
    const isBreakChange = Math.abs(next.t - qEndT) < 1e-6 && C.q < S.rules.quarters;
    const secs = (next.t - t) * 60;
    const when = isBreakChange ? `Pause avant ${pThe(C.q+1)}` : `${pShort(fmtQ(next.t).q)} · ${fmtQ(next.t).label}`;
    let cls = "", title = "Prochain changement", count = fmtClock(secs);
    if (isBreakChange && atEnd) { cls = "now"; title = "Changement à la pause"; count = "Pause"; }
    else if (secs <= 0.5) { cls = "now"; title = "Changement maintenant"; count = "GO"; }
    else if (secs <= S.rules.alertSec) { cls = "soon"; title = "Préparez-vous"; }
    if (isBreakChange && !atEnd && secs > S.rules.alertSec) count = "À la pause";
    alertHtml = `<div class="alert ${cls}" id="alertCard"><div class="alert-head"><div><div class="alert-title">${title}</div><div class="alert-when">${esc(when)}</div></div><div class="count" id="count">${esc(count)}</div></div>
      <div class="moves">${changeLines(next)}</div></div>`;
  }
  const seg = segAt(plan, Math.min(t, plan.segs[plan.segs.length-1].b - 0.01));
  const upcomingIds = next ? new Set(next.outs.map(o=>o[0]).concat(next.moves.map(m=>m[0]))) : new Set();
  const goesTo = next ? Object.fromEntries(next.moves.map(([p,, b]) => [p, b])) : {};
  const onIds = Object.entries(seg.on);
  const pitch = `<div class="pitch" aria-label="Joueurs sur le terrain">${pitchLines()}${PRESETS[S.preset].map(([id,label,line,x,y]) => {
      const who = onIds.find(([p,q]) => q === id)?.[0] || "Vide";
      const rl = (S.squad.find(p => p.name === who)?.roles || []).join("");
      return `<div class="pp${upcomingIds.has(who)?" chg":""}" style="left:${x}%;top:${y}%"><span class="dot ${line}">${esc(posShort(id))}</span><span class="nm">${esc(who)}${rl?` <i class="rl">${esc(rl)}</i>`:""}${goesTo[who] ? ` → ${esc(posShort(goesTo[who]))}` : ""}</span></div>`;}).join("")}</div>`;
  const hurt = outForGood();
  const benchNames = present().map(p=>p.name).filter(n => !(n in seg.on)).map(n => hurt.includes(n) ? n + " 🩹" : n);
  const qChanges = visChanges(plan).filter(c => fmtQ(c.t).q === C.q || (Math.abs(c.t - (C.q-1)*ql) < 1e-6 && C.q>1) || (Math.abs(c.t - C.q*ql)<1e-6));
  const upList = qChanges.map(c => {
    const isBrk = Math.abs(c.t/ql - Math.round(c.t/ql)) < 1e-6;
    const lab = isBrk ? "Pause" : fmtQ(c.t).label;
    return `<div class="up-item${(C.done.includes(c.t) || c.t < t - 0.4) ? " done":""}"><div class="up-t">${lab}</div><div class="up-l">${pairChanges(c).map(pr=>`<div><span class="i">${esc(pr.inP||"—")}</span> remplace <span class="o">${esc(pr.outP||"—")}</span> ${pr.inQ?pill(pr.inQ):""}</div>`).join("")}${moveGroups(c).map(g=>`<div class="m">${g.swap ? "⇄" : "→"} ${esc(moveText(g))}</div>`).join("")}</div></div>`;}).join("") || `<p class="muted">Aucun changement dans ${halves() ? "cette mi-temps" : "ce quart"}.</p>`;
  const banners = activeBanners(t);
  const startBtn = C.running ? `<button class="btn big" id="pause">❚❚ Pause</button>` : (atEnd ? (C.q < S.rules.quarters ? `<button class="btn big primary" id="nextQ">Lancer ${pThe(C.q+1)} ▸</button>` : `<span class="alert-title">Fin du match</span>`) : `<button class="btn big go" id="start">▶ ${el>0?"Reprendre":"Démarrer "+pThe(C.q)}</button>`);
  if (far) return `<div class="far">
      ${matchTitle() ? `<div class="alert-title" style="color:var(--muted)">${esc(matchTitle())}</div>` : ""}<div class="far-top"><span class="qbadge">${pShort(C.q)}</span><div class="time${C.running?"":" paused"}" id="time">${fmtClock(el)}</div><span class="remain" id="remain">Reste ${fmtClock(ql*60-el)}</span></div>
      ${banners}
      ${alertHtml}
      <div class="row">${startBtn}<button class="btn" id="farOff">Vue normale</button><span class="muted" style="font-size:.85rem">Clavier : espace = démarrer/pause · ← → = 10 s</span></div>
    </div>`;
  // Bas de page : un seul bloc à la fois (changements du quart, terrain ou score).
  const tabs = [["chg","Changements"],["field","Terrain"]].concat(ADJ ? [] : [["score","Score"]]);
  if (!tabs.some(([k]) => k === matchTab)) matchTab = "chg";
  const tabBody = matchTab === "field" ? `${pitch}<div style="margin-top:12px"><div class="muted" style="font-size:.85rem;margin-bottom:6px">Sur le banc</div><div class="bench">${benchNames.map(n=>`<span>${esc(n)}</span>`).join("") || '<span>Personne</span>'}</div></div>`
    : matchTab === "score" ? sheetCard(seg) : `<div class="muted" style="font-size:.85rem;margin-bottom:4px">${halves() ? (C.q === 1 ? "1re" : C.q + "e") + " mi-temps" : "Quart " + C.q}</div><div class="up">${upList}</div>`;
  return `<div class="match">
    <div class="mcol">
      ${shareCard()}
      ${ADJ && !inc && incMsg ? `<div class="warn">${esc(incMsg)}</div>` : ""}
      ${banners}
      <div class="card clock">
        <div class="score-head">
          <div class="clock-top"><span class="qbadge">${pShort(C.q)}</span><span class="remain" id="remain">Reste ${fmtClock(ql*60-el)}</span>${liveBadge()}<button class="tools-btn" id="toolsBtn" aria-expanded="${toolsOpen}">Outils ⋯</button></div>
          <div class="sh-row"><div class="time${C.running?"":" paused"}" id="time">${fmtClock(el)}</div>${S.sheet && (sheet().us.length || sheet().them.length) ? `<span class="sh-score" aria-label="Score">${sheet().us.length}–${sheet().them.length}</span>` : ""}</div>
          <div class="prog"><i id="progBar" style="width:${(el/(ql*60)*100).toFixed(2)}%"></i>${visChanges(plan).filter(c=>fmtQ(c.t).q===C.q && Math.abs(c.t-(C.q-1)*ql)>1e-6).map(c=>`<b style="left:${((c.t-(C.q-1)*ql)/ql*100).toFixed(2)}%"></b>`).join("")}</div>
          <div class="sh-ctrl"><button class="btn" id="m10" aria-label="Reculer de 10 secondes">−10 s</button>${startBtn}<button class="btn" id="p10" aria-label="Avancer de 10 secondes">+10 s</button></div>
        </div>
        ${toolsOpen ? `<div class="tools">
          <div class="tools-grid">
            <button class="btn" id="farOn">⤢ Vue de loin</button>
            ${ADJ ? "" : `<button class="btn" id="mList">📋 Mes matchs</button>`}
            ${liveButton()}
          </div>
          <div class="muted tools-t">Régler le chrono</div>
          <div class="nav" aria-label="Navigation dans le match">
            <button class="btn" id="m60">−1 min</button><button class="btn" id="p60">+1 min</button>
            <button class="btn" id="qReset">↺ ${halves() ? "Mi-temps" : "Quart"} à 0</button>
            <button class="btn" id="qPrev" ${C.q<=1?"disabled":""}>◂ ${halves() ? "Mi-temps" : "Quart"} préc.</button>
            <button class="btn" id="qNext" ${C.q>=S.rules.quarters?"disabled":""}>${halves() ? "Mi-temps suiv." : "Quart suiv."} ▸</button>
            <button class="btn" id="reset">Match à 0</button>
          </div>
        </div>` : ""}
      </div>
      ${alertHtml}
      ${matchOver ? "" : `<div class="actions">
        <button class="btn warnb big" id="incOpen">⚠ Imprévu</button>
        <button class="btn big" id="swapOpen">↔ Hors plan</button>
      </div>
      ${S.prevPlan || (ADJ && S.hasPrev) ? `<button class="btn" id="incUndo">↶ Annuler le dernier imprévu</button>` : ""}
      ${incidentPanel(seg)}`}
    </div>
    <div class="mcol">
      <div class="card">
        <div class="seg seg-full" role="tablist">${tabs.map(([k,l]) => `<button role="tab" data-mtab="${k}" aria-selected="${matchTab===k}" aria-pressed="${matchTab===k}">${l}</button>`).join("")}</div>
        <div style="margin-top:12px">${tabBody}</div>
      </div>
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
  $("#reset")?.addEventListener("click", function(){ if (this.dataset.armed) { if (ADJ) adjAsk("reset"); else resetMatch(); } else { this.dataset.armed = 1; this.textContent = "Sûr ? Touche encore"; } });
  $("#m60")?.addEventListener("click", () => adjust(-60));
  $("#p60")?.addEventListener("click", () => adjust(60));
  $("#qReset")?.addEventListener("click", () => setClock(C.q, 0));
  $("#qPrev")?.addEventListener("click", () => setClock(C.q - 1, 0));
  $("#qNext")?.addEventListener("click", () => setClock(C.q + 1, 0));
  $("#farOn")?.addEventListener("click", () => { toolsOpen = false; setFar(true); });
  $("#toolsBtn")?.addEventListener("click", () => { toolsOpen = !toolsOpen; render(); });
  document.querySelectorAll("[data-mtab]").forEach(b => b.addEventListener("click", () => { matchTab = b.dataset.mtab; render(); }));
  $("#farOff")?.addEventListener("click", () => setFar(false));
  $("#saveMatch")?.addEventListener("click", saveMatch);
  // Les notes se donnent dans la page Coach (protégée par le code), jamais sur l'écran du match.
  $("#goRate")?.addEventListener("click", () => { rateId = String(S.plan.savedAt); coachTab = "season"; goTo("coach"); setTimeout(() => $(".rate-card")?.scrollIntoView({block:"start"}), 50); });
  $("#incOpen")?.addEventListener("click", () => { inc = {type:null, player:null}; incMsg = ""; render(); });
  $("#incCancel")?.addEventListener("click", () => { inc = null; render(); });
  $("#incUndo")?.addEventListener("click", function(){ if (this.dataset.armed && ADJ) adjAsk("undo"); else if (this.dataset.armed) { undoIncident(); render(); } else { this.dataset.armed = 1; this.textContent = "Sûr ? Touche encore"; } });
  $("#swapOpen")?.addEventListener("click", () => { inc = {type:"libre", player:null, inP:null}; incMsg = ""; render(); });
  document.querySelectorAll("[data-swo]").forEach(b => b.addEventListener("click", () => { inc.player = b.dataset.swo; render(); }));
  document.querySelectorAll("[data-swi]").forEach(b => b.addEventListener("click", () => { inc.inP = b.dataset.swi; render(); }));
  bindSheet();
  document.querySelectorAll("[data-inct]").forEach(b => b.addEventListener("click", () => { inc.type = b.dataset.inct; inc.inP = undefined; render(); }));
  document.querySelectorAll("[data-incp]").forEach(b => b.addEventListener("click", () => { inc.player = b.dataset.incp; inc.inP = undefined; render(); }));
  document.querySelectorAll("[data-incin]").forEach(b => b.addEventListener("click", () => { inc.inP = b.dataset.incin; render(); }));
  document.querySelectorAll("[data-heal]").forEach(b => b.addEventListener("click", function(){
    const n = this.dataset.heal;
    if (this.dataset.catch === undefined && !S.plan?.manual) { healAsk = n; render(); return; }
    const catchUp = this.dataset.catch === "1";
    if (ADJ) { healAsk = null; adjAsk("heal", {player:n, catchUp}); } else endInjury(n, catchUp);
  }));
  $("#healCancel")?.addEventListener("click", () => { healAsk = null; render(); });
  $("#incBack")?.addEventListener("click", () => { inc.pending = null; render(); });
  document.querySelectorAll("[data-catch-card]").forEach(b => b.addEventListener("click", () => { inc.catchUp = b.dataset.catchCard === "1"; render(); }));
  $("#incGo")?.addEventListener("click", () => { if (ADJ) { adjAsk("incident", {inc:adjInc(), force:!!inc.pending}); return; } incBusy = true; render(); setTimeout(doIncident, 40); });
}
function setFar(v){ far = v; try { localStorage.setItem("banc-far", v ? "1" : "0"); } catch(e){} render(); }
document.addEventListener("keydown", e => {
  if (mode !== "match" || !S.plan || (ADJ && (adjEnded || !liveCoach)) || /INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName || "")) return;
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
  const ready = !!S.plan, title = matchTitle(), hi = `Salut${S.profile?.first ? ` ${esc(S.profile.first)}` : ""} !`;
  if (!S.squad.length) return pinNudge() + `<section class="hero"><span class="hero-k">${hi}</span><span class="hero-t">Bienvenue sur StickMate</span><span class="hero-s">Ton équipe est encore vide. Commence par créer ton équipe et tes joueurs.</span></section>
  <button class="btn dark big" id="hCoach">Créer mon équipe →</button>
  ${accountNudge()}${howTo()}`;
  return pinNudge() + `<section class="hero"><span class="hero-k">${hi} · Prochain match</span><span class="hero-t">${esc(S.matchLabel || "Ton prochain match")}</span>${S.matchDate && title !== S.matchLabel ? `<span class="hero-s">${esc(title.replace(S.matchLabel ? S.matchLabel + " · " : "", ""))}</span>` : ""}<span class="hero-s">${ready ? "Le plan de rotation est prêt." : "Pas encore de plan de rotation pour ce match."}</span></section>
  <div class="tiles"><div class="tile"><b>${present().length}</b><span>présents</span></div><div class="tile"><b>${ready ? visChanges(S.plan).length : "–"}</b><span>changements</span></div><div class="tile"><b>${esc(S.preset)}</b><span>système</span></div></div>
  ${ready ? `<button class="btn dark big" id="hMatch">Ouvrir le match →</button>` : `<button class="btn primary big" id="hCoach">Préparer le match →</button>`}
  ${accountNudge()}${S.plan ? "" : howTo()}`;
}
// Sans code, les notes et les temps visés sont visibles par tous : on le demande dès l'Accueil.
function pinNudge(){
  if (S.pin) return "";
  return `<div class="card incp"><h2>Choisis ton code de verrouillage</h2>
    <p class="muted" style="margin:0 0 10px;font-size:.92rem">Ce téléphone n'a pas encore de code : n'importe qui peut ouvrir la page Coach et voir les notes. Le code (4 ou 6 chiffres) la ferme. Il n'est pas dans les fichiers de sauvegarde, il faut donc le choisir sur chaque téléphone.</p>
    <div class="form" style="max-width:480px"><label class="fld"><span>Code (4 ou 6 chiffres)</span>${pinField("pinSet", "Nouveau code")}</label><label class="fld"><span>Confirme le code</span>${pinField("pinSet2", "Confirme le code")}</label></div>
    <div class="row" style="margin-top:10px"><button class="btn primary" id="pinSave">Enregistrer le code</button><span id="pinMsg" class="muted" style="font-size:.9rem"></span></div></div>`;
}
function bindPinSave(){
  digitsOnly();
  $("#pinSave")?.addEventListener("click", () => { const c = $("#pinSet").value.trim(); if (!pinOk(c)) { $("#pinMsg").textContent = "Le code doit faire 4 ou 6 chiffres."; return; } if ($("#pinSet2").value.trim() !== c) { $("#pinMsg").textContent = "Les deux codes ne sont pas pareils."; return; } S.pin = c; persist(); coachOK = true; render(); const m = $("#pinMsg"); if (m) m.textContent = "Code enregistré."; });
}
function howTo(){
  return `<div class="card"><h2>Comment ça marche</h2>
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
  bindPinSave();
  bindAccountNudge();
}

/* ---------- réglages ---------- */
function segBtns(key, opts){ return `<div class="seg" role="group">${opts.map(([v,l]) => `<button data-pref="${key}" data-val="${v}" aria-pressed="${String(prefs[key]) === String(v)}">${esc(l)}</button>`).join("")}</div>`; }
function colorSetting(){
  const cur = hexOk(S.color) ? S.color.toLowerCase() : DEFAULT_COLOR, known = CLUB_COLORS.some(([h]) => h === cur);
  return `<div><div class="muted">La couleur de ton club. Elle colore la barre du haut, le chrono et les boutons. Le texte reste toujours lisible : l'app choisit blanc ou noir toute seule.</div>
    <div class="swatches" role="group" aria-label="Couleur principale">${CLUB_COLORS.map(([h,l]) => `<button class="sw" data-color="${h}" style="background:${h}" aria-pressed="${h === cur}" aria-label="${esc(l)}" title="${esc(l)}"></button>`).join("")}
      <label class="sw other" title="Autre couleur" aria-label="Autre couleur" data-on="${!known}" style="${known ? "" : `background:${cur}`}"><input type="color" id="colorPick" value="${cur}"></label></div>
    <div class="clubprev"><button class="btn primary" type="button" tabindex="-1">Aperçu bouton</button>${cur !== DEFAULT_COLOR ? `<button class="btn small" id="colorReset">Remettre le bleu StickMate</button>` : ""}</div></div>`;
}
function setColor(h){ if (!hexOk(h)) return; S.color = h.toLowerCase(); persist(); render(); }
let setOpen = null;
// Une ligne de réglage qui s'ouvre au toucher pour montrer son détail.
function setRow(id, label, value, body){
  const open = setOpen === id;
  return `<button class="set-x" data-xp="${id}" aria-expanded="${open}"><span>${esc(label)}</span><span class="set-v">${value}<span aria-hidden="true">${open ? "⌃" : "›"}</span></span></button>${open ? `<div class="xp">${body}</div>` : ""}`;
}
function settingsView(){
  const locked = S.pin && !coachOK;
  const cur = hexOk(S.color) ? S.color.toLowerCase() : DEFAULT_COLOR;
  const themeName = {auto:"Auto", light:"Clair", dark:"Sombre"}[prefs.theme] || "Auto";
  return `<div class="grp-t">Pendant le match</div>
  <div class="card grp">
    <div class="set"><div><b>Son des alertes</b><div class="muted">Sur iPhone, le bouton silencieux coupe le son.</div></div>
      <div class="row" style="flex-shrink:0">${segBtns("sound", [[true,"Oui"],[false,"Non"]])}<button class="btn small" id="testSound">Tester</button></div></div>
    ${canVibrate ? `<div class="set"><div><b>Vibreur</b><div class="muted">Le téléphone vibre avant chaque changement.</div></div>
      ${segBtns("vibrate", [[true,"Oui"],[false,"Non"]])}</div>` : ""}
    <div class="set"><div><b>Alerte avant un changement</b><div class="muted">En secondes.</div></div><input class="set-num" type="number" step="5" min="5" data-rule="alertSec" value="${S.rules.alertSec}" aria-label="Alerte avant un changement, en secondes"></div>
  </div>
  <div class="grp-t">Apparence</div>
  <div class="card grp">
    ${setRow("color", "Couleur principale", `<span class="dotc" style="background:${cur}"></span>`, colorSetting())}
    <div class="set"><div><b>Thème</b><div class="muted">Auto suit le réglage du téléphone.</div></div>${segBtns("theme", [["auto","Auto"],["light","Clair"],["dark","Sombre"]])}</div>
  </div>
  <div class="grp-t">Moi et mes données</div>
  ${locked ? pinView("Réglages coach", "Entre ton code de verrouillage pour modifier ton profil, ton compte et la sauvegarde.") : `<div class="card grp">
    ${setRow("prof", "Mon profil", esc(S.profile?.first || ""), `<div class="form">${profileFields()}</div>
      <div class="row" style="margin-top:12px"><button class="btn primary" id="profSave">Enregistrer</button><span id="profMsg" class="muted" style="font-size:.9rem"></span></div>`)}
    ${CLOUD_ON ? setRow("acc", "Compte en ligne", user ? "Connecté" : "Pas de compte", accountCard() + dataCard()) : ""}
    ${setRow("pin", "Code de verrouillage", S.pin ? "Actif" : "Aucun", `<p class="muted" style="margin:0 0 10px;font-size:.92rem">${S.pin ? "Ce code protège la page Coach et tes réglages perso. Les joueurs peuvent ouvrir Accueil et Match." : "Aucun code pour l'instant : n'importe qui peut ouvrir la page Coach et voir les notes et les minutes."}</p>
      <div class="form" style="max-width:480px"><label class="fld"><span>Nouveau code (4 ou 6 chiffres)</span>${pinField("pinSet", "Nouveau code")}</label><label class="fld"><span>Confirme le code</span>${pinField("pinSet2", "Confirme le code")}</label></div>
      <div class="row" style="margin-top:10px"><button class="btn primary" id="pinSave">Changer le code</button>${S.pin ? `<button class="btn" id="lockNow">🔒 Verrouiller maintenant</button>` : ""}<span id="pinMsg" class="muted" style="font-size:.9rem"></span></div>`)}
    ${setRow("bk", "Sauvegarde", "", `<p class="muted" style="margin:0 0 10px;font-size:.92rem">${CLOUD_ON && user ? "Ton compte sauvegarde déjà tout en ligne. Tu peux en plus garder un fichier de sauvegarde (effectif, plan, saison) chez toi." : "Tout est gardé sur ce téléphone. Télécharge une sauvegarde de temps en temps (effectif, plan, saison) : elle te permet de tout retrouver sur un autre appareil."} Le code de verrouillage n'est pas dans le fichier.</p>
      <div class="row"><button class="btn primary" id="bkOut">⬇ Télécharger une sauvegarde</button><label class="btn" style="display:inline-block">⬆ Charger une sauvegarde<input type="file" id="bkIn" accept=".json,application/json" hidden></label></div>
      ${backupMsg ? `<div class="ok" style="margin-top:10px">${esc(backupMsg)}</div>` : ""}`)}
  </div>`}
  ${REPORT_ON ? `<div class="grp-t">Aide</div>
  <div class="card grp">
    <div class="set"><div><b>Signaler un souci</b><div class="muted">Un bug, quelque chose de pas clair, une idée : ça ouvre un mail déjà prêt.</div></div><a class="btn small" id="report" href="${esc(reportLink())}">Écrire</a></div>
  </div>` : ""}
  <p class="muted" style="font-size:.85rem;margin:0 4px">Les règles de rotation sont maintenant dans Coach, onglet « Match ».</p>
  ${CLOUD_ON ? privacyDetails("margin:0 4px") : ""}
  <p class="muted" style="font-size:.8rem;margin:0 4px">${COPYRIGHT}</p>`;
}
// « Signaler un souci » : mail prérempli avec la version de l'app et le téléphone (rien sur les joueurs).
const REPORT_TO = "contact@stickmate.be";
// Caché tant que la boîte contact@stickmate.be n'est pas active chez OVH : remettre à true ensuite.
const REPORT_ON = false;
function reportLink(){
  const v = (document.querySelector('script[src*="app.js"]')?.getAttribute("src") || "").match(/v=(\d+)/)?.[1] || "?";
  const body = `Ce que je faisais :\n\n\nCe qui s'est passé (ou ce qui n'est pas clair) :\n\n\n---\nStickMate version ${v}\n${navigator.userAgent}`;
  return `mailto:${REPORT_TO}?subject=${encodeURIComponent("StickMate : un souci")}&body=${encodeURIComponent(body)}`;
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
  v.querySelectorAll("[data-rule]").forEach(el => el.addEventListener("change", () => { S.rules[el.dataset.rule] = +el.value; preview=null; persist(); render(); }));
  v.querySelectorAll("[data-xp]").forEach(b => b.addEventListener("click", () => { setOpen = setOpen === b.dataset.xp ? null : b.dataset.xp; render(); }));
  if (S.pin && !coachOK) { bindPin(); return; }
  bindPinSave();
  $("#profSave")?.addEventListener("click", () => { const r = readProfile(); if (!r) { $("#profMsg").textContent = "Le prénom et l'équipe sont obligatoires."; return; } persist(); render(); $("#profMsg").textContent = "Profil enregistré."; });
  $("#lockNow")?.addEventListener("click", () => { coachOK = false; goTo("home"); });
  bindAccountCard();
  $("#bkOut")?.addEventListener("click", exportBackup);
  $("#bkIn")?.addEventListener("change", e => { const f = e.target.files[0]; if (f) importBackup(f); });
}

/* ---------- coach ---------- */
function pinView(title = "Page coach", text = "Entre ton code de verrouillage pour voir l'effectif et les temps de jeu."){ return `<div class="card pin"><h2>${esc(title)}</h2><p class="muted">${esc(text)}</p>${pinField("pinIn", "Code de verrouillage")}<div id="pinErr" class="muted" style="min-height:1.4em"></div><button class="btn primary" id="pinGo">Entrer</button></div>`; }
function bindPin(onOk){ const go = () => { if ($("#pinIn").value === S.pin) { coachOK = true; if (onOk) onOk(); render(); } else { $("#pinErr").textContent = "Code incorrect, réessaie."; } }; $("#pinGo").addEventListener("click", go); $("#pinIn").addEventListener("keydown", e => { if (e.key==="Enter") go(); }); digitsOnly(); $("#pinIn").addEventListener("input", e => { if (e.target.value === S.pin) go(); }); if (mode === "coach") $("#pinIn").focus(); }

let coachTab = "match", coachStep = null, squadMsg = "";
const TIME_HELP = {notes:"Tu donnes à chaque joueur ses minutes et l'app fait le plan. Un joueur à 0 reste sur le banc. Le gardien de la compo garde le but tout le match, sauf si tu lui mets d'autres minutes.", all:"Tous les joueurs de champ ont le même temps. Les notes ne comptent pas, les minutes fixées oui.", line:"Chaque ligne (défense, milieu, attaque) partage son temps à égalité. La ligne d'un joueur = celle de son 1er poste. Les notes ne comptent pas, les minutes fixées oui.", manual:"Tu écris toi-même tous les changements du match, quart par quart, dans « Plan de rotation » plus bas. L'app ne calcule rien et n'applique pas les règles."};
// Une étape de la préparation du match : une ligne avec son état, qui s'ouvre au toucher.
function step(id, n, done, title, summary, body){
  const open = coachStep === id;
  return `<div class="step${open ? " open" : ""}"><button class="step-h" data-step="${id}" aria-expanded="${open}"><span class="step-n${done ? " ok" : ""}">${done ? "✓" : n}</span><span class="step-t"><b>${esc(title)}</b><span>${esc(summary)}</span></span><span class="step-c" aria-hidden="true">${open ? "⌃" : "›"}</span></button>${open ? `<div class="step-b">${body}</div>` : ""}</div>`;
}
function coachView(){
  if (!S.squad.length && coachTab === "match") coachTab = "squad";
  const tabs = `<div class="seg seg-full seg-top" role="tablist">${[["match","Match"],["squad","Effectif"],["season","Saison"]].map(([k,l]) => `<button role="tab" data-ctab="${k}" aria-selected="${coachTab===k}" aria-pressed="${coachTab===k}">${l}</button>`).join("")}</div>`;
  return teamBar() + tabs + (coachTab === "squad" ? squadTab() : coachTab === "season" ? seasonTab() : matchPrepTab());
}
function squadTab(){
  const sys = teamSys(), others = Object.keys(PRESETS).filter(k => k !== sys);
  const rows = S.squad.map((p,i) => `<tr>
    <td><input class="name" type="text" data-i="${i}" data-k="name" value="${esc(p.name)}" aria-label="Nom"></td>
    <td><div class="posed">${p.pos.map((q,k) => `<button class="pchip ${posMeta(q, sys).line}" data-rmpos="${i}" data-q="${esc(q)}" title="Retirer ${esc(posName(q, sys))}">${k+1}. ${esc(posShort(q, sys))} ✕</button>`).join("")}<select data-addpos="${i}" aria-label="Ajouter un poste à ${esc(p.name)}"><option value="">+ poste</option>${PRESETS[sys].filter(x => !p.pos.includes(x[0])).map(x => `<option value="${x[0]}">${esc(x[1])}</option>`).join("")}</select></div></td>
    <td><div class="roles">${["D","B"].map(r => `<button class="role${(p.roles||[]).includes(r)?" on":""}" data-role="${r}" data-ri="${i}" title="${({D:"Donneur",B:"Bloqueur"})[r]}" aria-pressed="${(p.roles||[]).includes(r)}">${r}</button>`).join("")}</div></td>
    <td><button class="x" data-del="${i}" aria-label="Supprimer ${esc(p.name)}">✕</button></td></tr>`).join("");
  return `${!S.squad.length ? `<div class="card"><h2>Bienvenue</h2><p class="muted" style="margin:0">Ajoute tes joueurs ici, avec leurs postes. Tu as déjà une sauvegarde ? Charge-la dans la page Réglages.</p></div>` : ""}
  <div class="card"><div class="row" style="justify-content:space-between"><h2 style="margin:0">Mes joueurs (${S.squad.length})</h2><span class="save" id="saveState">${esc(saveState)}</span></div>
    <div class="set" style="border-top:0;padding-top:4px"><div><b>Système de jeu</b><div class="muted">Les postes de tes joueurs suivent ce système.</div></div>
      <select id="teamSys" aria-label="Système de jeu" style="border:1px solid var(--rule);border-radius:8px;padding:6px 10px;background:var(--bg)"${matchStarted() ? " disabled" : ""}>${Object.keys(PRESETS).map(k => `<option ${k === sys ? "selected" : ""}>${k}</option>`).join("")}</select></div>
    ${matchStarted() ? `<p class="muted" style="margin:0 0 8px;font-size:.85rem">Un match est en cours : tu pourras changer de système après la fin du match ou après « Match à 0 ».</p>` : ""}
    ${sysAsk ? `<div class="warn" style="margin-bottom:10px"><b>Passer en ${esc(sysAsk)} ?</b> Les noms des places changent. Que faire des postes déjà donnés à tes joueurs ?
      <div class="row" style="margin-top:8px;flex-wrap:wrap;gap:8px"><button class="btn primary" id="sysKeep">Garder les places adaptées</button><button class="btn" id="sysClear">Tout effacer et recommencer</button><button class="btn" id="sysCancel">Annuler</button></div>
      <div class="muted" style="margin-top:6px;font-size:.85rem">Garder : chaque poste passe à la place la plus proche du ${esc(sysAsk)}. Vérifie ensuite chaque joueur. Effacer : seuls les gardiens restent.</div></div>` : ""}
    ${posNote ? `<div class="warn" style="margin-bottom:10px">${esc(posNote)}</div>` : ""}
    <p class="muted" style="margin:6px 0 12px;font-size:.9rem">Postes dans l'ordre de préférence (le 1. est son meilleur poste ; touche un poste pour le retirer). Corners : D donneur, B bloqueur.</p>
    ${squadMsg ? `<div class="warn" style="margin-bottom:10px">${esc(squadMsg)}</div>` : ""}
    <div class="tbl-wrap"><table><thead><tr><th>Nom</th><th>Postes (${esc(sys)})</th><th title="Rôles sur corner">Corners</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
    <div class="row" style="margin-top:10px"><button class="btn" id="addP">+ Ajouter un joueur</button></div>
  </div>`;
}
function seasonTab(){
  return `<div class="card"><div class="row" style="justify-content:space-between"><h2 style="margin:0">Saison</h2>
    <div class="row">${S.plan && !S.plan.savedAt ? `<button class="btn primary" id="saveMatchC">Enregistrer le match en cours</button>` : ""}</div></div>
    ${seasonMsg ? `<div class="ok" style="margin-top:8px">${esc(seasonMsg)}</div>` : ""}
    <div style="margin-top:12px">${seasonHtml()}</div>
  </div>${ratingCard()}`;
}

/* ---------- règles de rotation ---------- */
// Règles du match + exceptions par période (S.rules.per[q], q = 0 pour le 1er quart ou la 1re mi-temps).
// Ces 6 règles peuvent changer d'une période à l'autre ; les autres valent pour tout le match
// (un passage peut commencer dans un quart et finir dans le suivant).
const PER_RULES = [
  ["startBlock", "num", "Pas de changement avant", "min", "Après le début du quart."],
  ["endBlock", "num", "Rien dans les dernières", "min", "Avant la fin du quart."],
  ["maxBench", "num", "Banc maximum dans le quart", "min", "Un joueur de champ ne reste jamais plus longtemps sur le banc dans un même quart."],
  ["maxEntries", "num", "Joueurs qui entrent en même temps", "max", "Au même moment."],
  ["breakChanges", "bool", "Changements à la pause", "", "Le plan peut faire entrer des joueurs pendant la pause."],
  ["gkOnlyAtBreaks", "bool", "Gardien changé seulement à la pause", "", "Jamais de changement de gardien pendant le jeu."],
];
const perTxt = t => halves() ? t.replace("du quart", "de la mi-temps").replace("le quart", "la mi-temps").replace("un même quart", "une même mi-temps") : t;
const fmtSig = () => `${+S.rules.quarters}x${+S.rules.qlen}`;
const rulesSig = () => { const r = {...S.rules}; delete r.alertSec; delete r.firstChange; delete r.minStint; return JSON.stringify(r); };
let rulesQ = null, rulesResetArmed = false;
const perOf = q => (S.rules.per || {})[q] || {};
const perDiff = q => Object.keys(perOf(q)).filter(k => PER_RULES.some(([x]) => x === k) && !(q === 0 && k === "breakChanges") && perOf(q)[k] !== S.rules[k]);
const matchStarted = () => !!S.plan && !S.plan.savedAt && (C.q > 1 || C.elapsed > 0);
function rulesChanged(){
  syncMinStint();
  S.rules.firstChange = R.rq(S.rules, 0, "startBlock"); // pour les anciennes versions de l'app
  preview = null; persist(); render();
}
function setPer(q, k, v){
  const per = {...(S.rules.per || {})}, o = {...(per[q] || {})};
  if (v === null || v === S.rules[k]) delete o[k]; else o[k] = v;
  if (Object.keys(o).length) per[q] = o; else delete per[q];
  S.rules.per = per; rulesChanged();
}
function setFormat(n){
  n = +n; if (n === +S.rules.quarters) return;
  const total = S.rules.quarters * S.rules.qlen;
  // Le banc maximum est « par période » : il suit la durée de la période (10' par quart = 20' par mi-temps).
  const ratio = S.rules.quarters / n, half = v => Math.round(v * ratio * 2) / 2;
  S.rules.quarters = n; S.rules.qlen = Math.round(total / n * 2) / 2; S.rules.maxBench = half(+S.rules.maxBench);
  const per = {}; Object.entries(S.rules.per || {}).forEach(([q, o]) => { if (+q < n) per[q] = o.maxBench != null ? {...o, maxBench: half(+o.maxBench)} : o; });
  S.rules.per = per; rulesQ = null; rulesChanged();
}
const minTxt = v => R.fmtMin(+v);
// Frise : une barre par période, la zone verte = quand le plan peut faire des changements.
function rulesTimeline(){
  const r = S.rules, ql = +r.qlen;
  return `<div class="frise">${Array.from({length:r.quarters}, (_, q) => {
    const a = Math.min(ql, +R.rq(r, q, "startBlock")), b = Math.max(a, ql - R.rq(r, q, "endBlock"));
    const brk = q > 0 ? `<div class="fz-brk${R.rq(r, q, "breakChanges") ? " on" : ""}">${R.rq(r, q, "breakChanges") ? "Changements à la pause" : "Pas de changement à la pause"}</div>` : "";
    return `${brk}<div class="fz${perDiff(q).length ? " diff" : ""}"><div class="fz-h"><b>${pShort(q+1)}</b><span>${b > a ? `changements de ${minTxt(a)} à ${minTxt(b)}` : "aucun changement"}</span></div>
      <div class="fz-t"><i style="left:${a/ql*100}%;width:${(b-a)/ql*100}%"></i></div>
      <div class="fz-tags"><span>banc max ${minTxt(R.rq(r, q, "maxBench"))}</span><span>${R.rq(r, q, "maxEntries")} entrées max</span>${R.rq(r, q, "gkOnlyAtBreaks") ? "" : "<span>gardien pendant le jeu</span>"}</div></div>`;
  }).join("")}</div>`;
}
function ruleRow(k, label, unit, help, val, attrs){
  const num = `<span class="rnum"><input class="set-num" type="number" inputmode="decimal" step="${unit === "max" ? 1 : 0.5}" min="0" ${attrs} value="${esc(val)}" aria-label="${esc(label)}">${unit === "min" ? "<small>min</small>" : ""}</span>`;
  return `<div class="set"><div><b>${esc(label)}</b>${help ? `<div class="muted">${esc(help)}</div>` : ""}</div>${num}</div>`;
}
function boolRow(label, help, on, k){
  return `<div class="set"><div><b>${esc(label)}</b>${help ? `<div class="muted">${esc(help)}</div>` : ""}</div><div class="seg" role="group">${[[true,"Oui"],[false,"Non"]].map(([v,l]) => `<button data-rb="${k}" data-v="${v}" aria-pressed="${on === v}">${l}</button>`).join("")}</div></div>`;
}
const PER_BASIC = ["startBlock", "endBlock", "maxBench", "maxEntries"];
function matchRule(k){
  const [, type, label, unit, help] = PER_RULES.find(([x]) => x === k);
  return type === "bool" ? boolRow(label === "Changements à la pause" ? "Changements aux pauses" : label, perTxt(help), !!S.rules[k], k)
    : ruleRow(k, perTxt(label), unit, perTxt(help), S.rules[k], `data-rule="${k}"`);
}
function perEditor(q){
  const rows = PER_RULES.filter(([k]) => !(q === 0 && k === "breakChanges")).map(([k, type, label, unit]) => {
    const own = perOf(q)[k] !== undefined && perOf(q)[k] !== S.rules[k], v = R.rq(S.rules, q, k);
    const lab = k === "breakChanges" ? `Changements à la pause avant ${pThe(q+1).replace(/^l[ea] /, "")}` : perTxt(label).replace("le quart", pThe(q+1)).replace("la mi-temps", pThe(q+1));
    const tag = own ? `<span class="pdiff">différent</span>` : `<span class="muted">comme ${baseName().toLowerCase()}</span>`;
    if (type === "bool") return `<div class="set${own ? " own" : ""}"><div><b>${esc(lab)}</b><div>${tag}</div></div><div class="seg" role="group">${[[true,"Oui"],[false,"Non"]].map(([b,l]) => `<button data-pb="${q}:${k}:${b}" aria-pressed="${!!v === b}">${l}</button>`).join("")}</div></div>`;
    return `<div class="set${own ? " own" : ""}"><div><b>${esc(lab)}</b><div>${tag}</div></div><span class="rnum"><input class="set-num" type="number" inputmode="decimal" step="${unit === "max" ? 1 : 0.5}" min="0" data-pr="${q}:${k}" value="${esc(own ? v : "")}" placeholder="${esc(S.rules[k])}" aria-label="${esc(lab)}">${unit === "min" ? "<small>min</small>" : ""}</span></div>`;
  }).join("");
  return `<div class="per-ed"><div class="per-h"><b>Règles ${halves() ? "de " : "du "}${pThe(q+1).replace(/^l[ea] /, "")}</b>${perDiff(q).length ? `<button class="btn small" id="perClear">Revenir ${halves() ? "à la mi-temps" : "au quart"} de base</button>` : ""}</div>
    <p class="muted" style="margin:0 0 4px;font-size:.88rem">Change seulement ce qui est différent. Case vide = même règle que ${baseName().toLowerCase()}.</p>${rows}</div>`;
}
const baseName = () => halves() ? "La mi-temps de base" : "Le quart de base";
function rulesBody(){
  const r = S.rules, lock = matchStarted();
  const tabs = `<button class="pchip-q base" data-perq="base" aria-pressed="${rulesQ === null}">${halves() ? "Mi-temps" : "Quart"}<small>de base</small></button>` + Array.from({length:r.quarters}, (_, q) => { const n = perDiff(q).length; return `<button class="pchip-q${n ? " diff" : ""}" data-perq="${q}" aria-pressed="${rulesQ === q}">${pShort(q+1)}<small>${n ? n + (n > 1 ? " différences" : " différence") : "comme la base"}</small></button>`; }).join("");
  const base = `<div class="per-ed"><div class="per-h"><b>${baseName()}</b></div>
    <p class="muted" style="margin:0 0 4px;font-size:.88rem">Règle d'abord ${baseName().toLowerCase()} : ${halves() ? "les 2 mi-temps le suivent" : "les 4 quarts le suivent"} automatiquement. Pour qu'${halves() ? "une mi-temps soit différente" : "un quart soit différent"}, touche ${halves() ? "MT1 ou MT2" : "Q1 à Q4"} et change seulement ce qui doit l'être.</p>
    ${PER_RULES.map(([k]) => matchRule(k)).join("")}</div>`;
  return `${rulesTimeline()}
  <div class="grp-t">Format du match</div>
  <div class="card grp">
    ${lock ? `<p class="muted" style="margin:10px 0 0;font-size:.88rem">Match en cours : termine-le ou remets-le à 0 pour changer le format.</p>` : ""}
    <div class="set"><div><b>Le match se joue en</b></div><div class="seg" role="group">${[[4,"4 quarts"],[2,"2 mi-temps"]].map(([n,l]) => `<button data-fmt="${n}" aria-pressed="${+r.quarters === n}" ${lock ? "disabled" : ""}>${l}</button>`).join("")}</div></div>
    <div class="set"><div><b>Durée d'${halves() ? "une mi-temps" : "un quart"}</b><div class="muted">Match de ${minTxt(r.quarters * r.qlen)} en tout.</div></div><span class="rnum"><input class="set-num" type="number" inputmode="decimal" step="0.5" min="5" data-rule="qlen" value="${esc(r.qlen)}" aria-label="Durée" ${lock ? "disabled" : ""}><small>min</small></span></div>
  </div>
  <div class="grp-t">Règles ${halves() ? "par mi-temps" : "par quart"}</div>
  <div class="card grp" style="padding-block:12px">
    <div class="perq" style="grid-template-columns:1.3fr repeat(${r.quarters},1fr)">${tabs}</div>
    ${rulesQ !== null && rulesQ < r.quarters ? perEditor(rulesQ) : base}
  </div>
  <div class="grp-t">Pour tout le match</div>
  <div class="card grp rules-all">
    <div class="set"><div><b>Minimum avant de sortir</b><div class="muted">Un joueur reste au moins ce temps sur le terrain, selon sa ligne (son 1er poste).</div></div>
      <div class="rline">${[["minDef","Défense"],["minMid","Milieu"],["minAtt","Attaque"]].map(([k,l]) => `<label><span>${l}</span><input class="set-num" type="number" inputmode="decimal" step="0.5" min="0" data-rule="${k}" value="${esc(r[k])}" aria-label="Minimum avant de sortir, ${l.toLowerCase()}"></label>`).join("")}</div></div>
    <div class="set" style="border-top:0;padding-top:0"><div><b>Titulaires, 1er passage</b><div class="muted">Au début du match, ils peuvent sortir plus tôt pour faire tourner.</div></div>
      <div class="rline">${[["firstDef","minDef","Défense"],["firstMid","minMid","Milieu"],["firstAtt","minAtt","Attaque"]].map(([k,m,l]) => `<label><span>${l}</span><input class="set-num" type="number" inputmode="decimal" step="0.5" min="0" data-rule="${k}" value="${esc(r[k] ?? r[m])}" aria-label="Minimum avant de sortir pour un titulaire au début du match, ${l.toLowerCase()}"></label>`).join("")}</div></div>
    <div class="set"><div><b>Maximum d'affilée sur le terrain</b><div class="muted">Jamais plus longtemps sans sortir, selon sa ligne. ${halves() ? "La pause de la mi-temps remet" : "La pause entre deux quarts remet"} ce compteur à zéro.</div></div>
      <div class="rline">${[["maxDef","Défense"],["maxMid","Milieu"],["maxAtt","Attaque"]].map(([k,l]) => `<label><span>${l}</span><input class="set-num" type="number" inputmode="decimal" step="0.5" min="0" data-rule="${k}" value="${esc(r[k])}" aria-label="Maximum d'affilée, ${l.toLowerCase()}"></label>`).join("")}</div></div>
    ${ruleRow("minBench", "Minimum sur le banc avant de rentrer", "min", "Évite qu'un joueur sorte et rentre presque tout de suite.", r.minBench, 'data-rule="minBench"')}
    ${ruleRow("minPlay", "Temps de jeu minimum", "min", "Le plan évite qu'un joueur joue moins que ça sur le match, sauf si tu lui as prévu moins.", r.minPlay, 'data-rule="minPlay"')}
  </div>
  <p class="muted" style="margin:10px 4px 0;font-size:.85rem">Ces règles-là valent sur tout le match : un passage peut commencer dans un ${pWord()} et finir dans le suivant.</p>
  <div class="row" style="margin-top:12px;justify-content:flex-end">
    <button class="btn small${rulesResetArmed ? " danger" : ""}" id="rulesReset">${rulesResetArmed ? "Sûr ? Toucher encore" : "Remettre les règles de base"}</button>
  </div>`;
}
function bindRules(v){
  v.querySelectorAll("[data-rule]").forEach(el => el.addEventListener("change", () => { const k = el.dataset.rule; if (el.value === "" || isNaN(+el.value) || +el.value < 0) { render(); return; } S.rules[k] = k === "qlen" ? Math.max(5, +el.value) : +el.value; rulesChanged(); }));
  v.querySelectorAll("[data-rb]").forEach(b => b.addEventListener("click", () => { S.rules[b.dataset.rb] = b.dataset.v === "true"; rulesChanged(); }));
  v.querySelectorAll("[data-fmt]").forEach(b => b.addEventListener("click", () => { if (!matchStarted()) setFormat(b.dataset.fmt); }));
  v.querySelectorAll("[data-perq]").forEach(b => b.addEventListener("click", () => { rulesQ = b.dataset.perq === "base" ? null : +b.dataset.perq; render(); }));
  v.querySelectorAll("[data-pr]").forEach(el => el.addEventListener("change", () => { const [q, k] = el.dataset.pr.split(":"); setPer(+q, k, el.value === "" || isNaN(+el.value) ? null : Math.max(0, +el.value)); }));
  v.querySelectorAll("[data-pb]").forEach(b => b.addEventListener("click", () => { const [q, k, val] = b.dataset.pb.split(":"); setPer(+q, k, val === "true"); }));
  $("#perClear")?.addEventListener("click", () => { const per = {...(S.rules.per || {})}; delete per[rulesQ]; S.rules.per = per; rulesChanged(); });
  $("#rulesReset")?.addEventListener("click", () => {
    if (!rulesResetArmed) { rulesResetArmed = true; render(); return; }
    const keep = {quarters:S.rules.quarters, qlen:S.rules.qlen, alertSec:S.rules.alertSec};
    S.rules = {...defaultRules(), ...keep}; rulesResetArmed = false; rulesQ = null; rulesChanged();
  });
}
/* ---------- Plan manuel : plan écrit par le coach, sans règles ---------- */
// S.manual (par match) = [{id, q, m, end, outs:[noms], ins:[noms], pos:[poste de chaque entrant]}] : quart q, minute m dans le quart
// (end = fin du quart). Le moment est gardé par quart pour suivre un changement de durée des quarts ; t (minutes depuis le début) en découle.
let mq = 1, mw = null, mView = 0; // quart affiché, changement en cours de saisie, moment du terrain consulté (s depuis le début du quart)
const mRaw = () => Array.isArray(S.manual) ? S.manual : (S.manual = []);
function mTime(c){
  const ql = +S.rules.qlen, nq = +S.rules.quarters;
  if (c.q == null) { let q = Math.floor(c.t / ql + 1e-6) + 1, m = c.t - (q - 1) * ql; if (m < 1e-6 && q > 1) { q--; c.end = true; m = 0; } c.q = q; c.m = m; c.end = !!c.end; }
  if (c.q > nq || (c.end ? c.q >= nq : c.m >= ql - 1e-6)) return null;
  return (c.q - 1) * ql + (c.end ? ql : c.m);
}
// Changements qui tiennent dans le format actuel (avec leur t), et ceux qui n'y tiennent plus.
const manualList = () => mRaw().filter(c => (c.t = mTime(c)) != null);
const manualLost = () => mRaw().filter(c => mTime(c) == null);
// Compo de départ et joueurs du match. Figés dès que le match a commencé : changer la compo ou les présents
// en cours de match (ou après) ne réécrit pas ce qui s'est déjà passé.
function mBase(){
  const f = S.plan?.manual && S.plan.start && (matchStarted() || S.plan.savedAt) ? S.plan.start : null;
  if (f) return {on: {...f.on}, names: new Set(f.names)};
  const names = new Set(present().map(p => p.name)), on = {};
  Object.entries(S.lineup).forEach(([q, n]) => { if (n && names.has(n)) on[n] = q; });
  return {on, names};
}
const sameOn = (x, y) => Object.keys(x).length === Object.keys(y).length && Object.keys(x).every(k => y[k] === x[k]);
// Imprévus pris en compte par la liste (évènements du plan actif).
const M_EV = ["bless", "retour", "rouge", "libre", "vert", "jaune", "jaune10"];
const mEvents = () => S.plan?.manual ? (S.plan.events || []) : [];
// Terrain (nom -> poste) après les changements et imprévus jusqu'à t inclus. Après une blessure ou un
// hors plan, le remplaçant reprend les changements prévus du joueur sorti (et inversement). Pendant un
// carton, le poste du joueur sanctionné reste vide. Un changement devenu impossible est sauté.
function manualState(t, events = mEvents()){
  const {on, names} = mBase(), bad = [], eff = {}, gone = new Set(), swaps = [], cards = [], ids = PRESETS[S.preset].map(p => p[0]);
  const ren = n => swaps.reduce((x, [a, b]) => x === a ? b : x === b ? a : x, n);
  const items = [...manualList().map(c => ({t: c.t, c})), ...events.filter(e => M_EV.includes(e.type)).map(e => ({t: e.t, e}))]
    .sort((a, b) => a.t - b.t || (a.e ? 1 : 0) - (b.e ? 1 : 0));
  for (const it of items) {
    if (it.t > t + 1e-6) break;
    if (it.c) {
      const c = it.c, outs = c.outs.map(ren), ins = c.ins.map(ren); eff[c.id] = {outs, ins};
      if (outs.length !== ins.length || c.pos.some(q => !ids.includes(q)) || outs.some(n => !(n in on)) || ins.some(n => n in on || gone.has(n) || !names.has(n))) { bad.push(c.id); continue; }
      outs.forEach(n => delete on[n]); ins.forEach((n, i) => on[n] = c.pos[i]);
      continue;
    }
    const e = it.e, p = e.player, q = on[p];
    if (e.type === "bless" || e.type === "libre") {
      if (q) delete on[p];
      if (e.inP && q && !(e.inP in on)) { on[e.inP] = q; swaps.push([p, e.inP]); }
      if (e.type === "bless") gone.add(p);
    } else if (e.type === "retour") gone.delete(p);
    else if (e.type === "rouge") { if (q) delete on[p]; gone.add(p); }
    else if (q) cards.push({q, a: e.t, b: e.t + e.d});
  }
  cards.filter(k => t >= k.a - 1e-6 && t < k.b - 1e-6).forEach(k => { const n = Object.keys(on).find(x => on[x] === k.q); if (n) delete on[n]; });
  return {on, bad, eff};
}
function manualPlan(events = mEvents()){
  const END = S.rules.quarters * S.rules.qlen, evs = events.filter(e => M_EV.includes(e.type)), base = mBase();
  const times = [...manualList().map(c => c.t), ...evs.map(e => e.t), ...evs.filter(e => timedCard(e.type)).map(e => e.t + e.d)];
  const pts = [0, ...new Set(times.filter(t => t > 1e-6 && t < END - 1e-6))].sort((a, b) => a - b);
  const segs = [];
  pts.forEach((a, i) => { const b = pts[i + 1] ?? END, on = manualState(a, events).on, L = segs[segs.length - 1]; if (L && sameOn(L.on, on)) L.b = b; else segs.push({a, b, on}); });
  const changes = [];
  for (let i = 1; i < segs.length; i++) {
    const A = segs[i-1].on, B = segs[i].on;
    changes.push({t: segs[i].a, ins: Object.keys(B).filter(p => !(p in A)).map(p => [p, B[p]]), outs: Object.keys(A).filter(p => !(p in B)).map(p => [p, A[p]]), moves: Object.keys(B).filter(p => p in A && A[p] !== B[p]).map(p => [p, A[p], B[p]])});
  }
  const played = {}, intervals = {};
  base.names.forEach(n => { played[n] = 0; intervals[n] = []; });
  segs.forEach(sg => Object.keys(sg.on).forEach(n => { played[n] = (played[n] || 0) + sg.b - sg.a; const L = (intervals[n] ||= []); if (L.length && Math.abs(L[L.length-1][1] - sg.a) < 1e-6) L[L.length-1][1] = sg.b; else L.push([sg.a, sg.b]); }));
  const st = manualState(END, events), warnings = [];
  if (Object.keys(segs[0].on).length < PRESETS[S.preset].length) warnings.push("La compo de départ n'est pas complète.");
  manualList().filter(c => st.bad.includes(c.id)).sort((a, b) => a.t - b.t).forEach(c => { const f = st.eff[c.id] || c; warnings.push(`${manualWhen(c.t, true)} : changement sauté (${f.ins.join(", ")} pour ${f.outs.join(", ")}), un joueur n'est plus sur le terrain, y est déjà ou ne peut plus jouer.`); });
  const lost = manualLost().length;
  if (lost) warnings.push(`${lost} changement${lost > 1 ? "s ne tiennent" : " ne tient"} plus dans le format du match (${S.rules.quarters} ${pWord()}${halves() ? "" : "s"} de ${R.fmtMin(+S.rules.qlen)}) : ignoré${lost > 1 ? "s" : ""}.`);
  return {start: {on: base.on, names: [...base.names]}, segs, changes, played, targets: {...played}, intervals, warnings, events, score: 0, manual: true, timeMode: "manual", rulesSig: rulesSig(), fmt: fmtSig()};
}
const mEndLab = () => halves() ? "Fin de la mi-temps" : "Fin du quart";
function manualWhen(t, withQ){
  const ql = +S.rules.qlen, q = Math.min(S.rules.quarters, Math.floor(t / ql + 1e-6) + 1), m = t - (q - 1) * ql;
  if (m < 1e-6 && q > 1) return halves() ? "Mi-temps" : `Fin du ${pShort(q - 1)}`;
  return (withQ ? pShort(q) + " · " : "") + R.fmtMin(m);
}
// Le plan actif suit la liste. Pendant le match, seuls les changements à venir bougent et les imprévus restent.
function manualApply(){
  if (S.plan?.manual) {
    if (!matchStarted()) { S.plan = manualPlan([]); S.prevPlan = null; S.basePlan = null; }
    else { const rest = S.plan.savedAt; S.plan = manualPlan(); if (rest) S.plan.savedAt = rest; syncDone(); }
    preview = null; pushClock();
  }
  persist(); render();
}
function manualPitch(t){
  const on = manualState(t).on, who = q => Object.keys(on).find(n => on[n] === q) || "Vide";
  return pitchLines() + PRESETS[S.preset].map(([id, label, line, x, y]) => `<div class="pp" style="left:${x}%;top:${y}%"><span class="dot ${line}">${esc(posShort(id))}</span><span class="nm">${esc(who(id))}</span></div>`).join("");
}
function manualCard(){
  const ql = +S.rules.qlen, nq = S.rules.quarters, q = Math.min(mq, nq), qa = (q - 1) * ql, started = matchStarted(), now = started ? matchT() : -1, lock = !!S.plan?.savedAt;
  const active = !!S.plan?.manual, plan = active ? S.plan : manualPlan();
  const tabs = `<div class="seg seg-full" role="group" aria-label="${halves() ? "Mi-temps" : "Quart"}">${Array.from({length: nq}, (_, k) => `<button data-mq="${k + 1}" aria-pressed="${k + 1 === q}">${esc(pShort(k + 1))}</button>`).join("")}</div>`;
  const fin = manualState(nq * ql), badIds = fin.bad;
  const rows = manualList().filter(c => c.t > qa + 1e-6 && c.t <= qa + ql + 1e-6).sort((a, b) => a.t - b.t).map(c => `<div class="mrow${badIds.includes(c.id) ? " bad" : ""}">
      <div class="mt">${esc(c.t >= qa + ql - 1e-6 ? mEndLab() : R.fmtMin(c.t - qa))}</div>
      <div class="mw"><div class="i">${c.ins.map((n, i) => `<span>↑ ${esc(n)} ${pill(c.pos[i])}</span>`).join("")}</div><div class="o">${c.outs.map(n => `<span>↓ ${esc(n)}</span>`).join("")}</div>${(f => f && (f.outs.join() !== c.outs.join() || f.ins.join() !== c.ins.join()) ? `<div class="note">Après l'imprévu : ${f.ins.map(n => "↑ " + esc(n)).join(" ")} ${f.outs.map(n => "↓ " + esc(n)).join(" ")}</div>` : "")(fin.eff[c.id])}${badIds.includes(c.id) ? `<div class="note">Impossible à ce moment : il est sauté.</div>` : ""}</div>
      ${lock || c.t <= now + 1e-6 ? "" : `<button class="btn small" data-mdel="${c.id}" aria-label="Supprimer ce changement">✕</button>`}</div>`).join("") || `<p class="muted" style="margin:6px 0">Aucun changement dans ${halves() ? "cette mi-temps" : "ce quart"}.</p>`;
  let wiz = "";
  if (mw && !lock) {
    const t = mw.end ? qa + ql : qa + mw.m + mw.s / 60, tOk = (mw.end || (t > qa + 1e-6 && t < qa + ql - 1e-6)) && t > now + 1e-6;
    const st = tOk ? manualState(t).on : {};
    const field = PRESETS[S.preset].map(([id]) => Object.keys(st).find(n => st[n] === id)).filter(Boolean);
    const bench = [...mBase().names].filter(n => !(n in st));
    const mins = Array.from({length: Math.floor(ql) + 1}, (_, k) => k), secs = Array.from({length: 60}, (_, k) => k);
    const when = `<div class="mstep"><b>1. Quand ?</b>
      <div class="row" style="gap:8px;flex-wrap:wrap;margin-top:6px"><label class="msel"><select id="mMin" ${mw.end ? "disabled" : ""} aria-label="Minute">${mins.map(k => `<option value="${k}" ${k === mw.m ? "selected" : ""}>${k} min</option>`).join("")}</select></label>
      <label class="msel"><select id="mSec" ${mw.end ? "disabled" : ""} aria-label="Seconde">${secs.map(k => `<option value="${k}" ${k === mw.s ? "selected" : ""}>${String(k).padStart(2, "0")} s</option>`).join("")}</select></label>
      ${q < nq ? `<button class="btn small" id="mEnd" aria-pressed="${mw.end}">${mEndLab()}</button>` : ""}</div>
      ${tOk ? "" : `<div class="warn" style="margin-top:8px">${t <= now + 1e-6 ? "Ce moment est déjà passé : choisis un moment à venir." : `Choisis un moment entre 0'01 et ${R.fmtMin(ql)} du quart${q < nq ? `, ou « ${mEndLab()} »` : ""}.`}</div>`}</div>`;
    let body = "";
    if (tOk && mw.step === "when") body = `<button class="btn primary" id="mNext" style="margin-top:10px">OK</button>`;
    if (tOk && mw.step !== "when") body += `<div class="mstep"><b>2. Qui sort ?</b> <span class="muted">${mw.outs.length ? mw.outs.length + " choisi" + (mw.outs.length > 1 ? "s" : "") : "touche un ou plusieurs joueurs"}</span>
      <div class="inc-players" style="margin-top:6px">${field.map(n => `<button class="btn" data-mout="${esc(n)}" aria-pressed="${mw.outs.includes(n)}" ${mw.step !== "out" ? "disabled" : ""}>${esc(n)} ${pill(st[n])}</button>`).join("")}</div>
      ${mw.step === "out" ? `<button class="btn primary" id="mOutOk" style="margin-top:10px" ${mw.outs.length ? "" : "disabled"}>OK</button>` : ""}</div>`;
    if (tOk && (mw.step === "in" || mw.step === "pos")) body += `<div class="mstep"><b>3. Qui entre sur le terrain ?</b> <span class="muted">${mw.ins.length} sur ${mw.outs.length}</span>
      <div class="inc-players" style="margin-top:6px">${bench.map(n => `<button class="btn" data-min="${esc(n)}" aria-pressed="${mw.ins.includes(n)}" ${mw.step !== "in" || (!mw.ins.includes(n) && mw.ins.length >= mw.outs.length) ? "disabled" : ""}>${esc(n)}</button>`).join("") || `<span class="muted">Personne sur le banc.</span>`}</div>
      ${mw.step === "in" ? `<button class="btn primary" id="mInOk" style="margin-top:10px" ${mw.ins.length === mw.outs.length ? "" : "disabled"}>OK</button>` : ""}</div>`;
    if (tOk && mw.step === "pos") body += `<div class="mstep"><b>4. Postes</b>${mw.ins.map((n, i) => `<div class="row" style="gap:8px;margin-top:6px;flex-wrap:wrap"><span><b>${esc(n)}</b> joue</span>${mw.ins.length > 1 ? `<select data-mpos="${i}" aria-label="Poste de ${esc(n)}" style="border:1px solid var(--rule);border-radius:8px;padding:6px 8px;background:var(--bg)">${mw.outs.map(o => `<option value="${st[o]}" ${mw.pos[i] === st[o] ? "selected" : ""}>${esc(posName(st[o]))} (à la place de ${esc(o)})</option>`).join("")}</select>` : `<span>${pill(mw.pos[i])} ${esc(posName(mw.pos[i]))} (à la place de ${esc(mw.outs[0])})</span>`}</div>`).join("")}
      <button class="btn go big" id="mSave" style="margin-top:12px">Valider le changement</button></div>`;
    wiz = `<div class="mwiz"><div class="mwiz-t">Nouveau changement · ${esc(pShort(q))}${tOk ? " · " + esc(mw.end ? mEndLab().toLowerCase() : R.fmtMin(t - qa)) : ""}</div>${when}${body}<button class="btn" id="mCancel" style="margin-top:10px">Annuler</button></div>`;
  }
  const vt = qa + Math.min(mView, ql * 60) / 60;
  const tp = Object.keys(plan.played).filter(n => plan.played[n] > 0 || present().some(p => p.name === n)).sort((a, b) => plan.played[b] - plan.played[a]);
  return `${lock ? `<div class="warn" style="margin-top:10px">Ce match est terminé et enregistré.</div>` : started && active ? `<div class="muted" style="margin-top:10px;font-size:.92rem">Match en cours : tu peux encore modifier les changements à venir.</div>` : ""}
    ${lock || (started && active) ? "" : !active ? `<div class="warn" style="margin-top:10px;background:var(--chip);color:var(--ink)">${S.plan ? "Le plan actif n'est pas ta liste de changements." : "Pas encore de plan pour ce match."} <button class="btn go small" id="mUse" ${started ? "disabled" : ""}>Utiliser mes changements pour le match</button></div>` : `<div class="ok" style="margin-top:10px">Plan actif pour le match : tes changements, sans règles. ${visChanges(S.plan).length} moments de changement.</div>`}
    ${plan.warnings.length ? `<div class="warn" style="margin-top:8px">${plan.warnings.map(w => esc(w)).join("<br>")}${manualLost().length && !lock ? ` <button class="btn small" id="mPurge">Effacer ces changements</button>` : ""}</div>` : ""}
    <div style="margin-top:12px">${tabs}</div>
    <div class="mlist">${rows}</div>
    ${lock ? "" : wiz || `<button class="btn primary big" id="mAdd" style="margin-top:10px;width:100%">+ Ajouter un changement</button>`}
    <details class="mdet" ${mView ? "open" : ""}><summary>Voir le terrain à un moment du ${esc(pShort(q))}</summary>
      <div class="row" style="gap:10px;margin:10px 0"><input type="range" id="mView" min="0" max="${Math.round(ql * 60)}" step="5" value="${Math.min(mView, Math.round(ql * 60))}" style="flex:1" aria-label="Moment du quart"><b id="mViewT" style="min-width:56px;text-align:right">${esc(R.fmtMin(vt - qa))}</b></div>
      <div class="pitch" id="mPitch" style="max-width:440px;margin:0 auto">${manualPitch(vt)}</div></details>
    <details class="mdet"><summary>Temps de jeu total</summary>
      <div class="mins" style="margin-top:8px">${tp.map(n => `<div class="minrow"><span>${esc(n)}</span><b>${esc(R.fmtMin(plan.played[n] || 0))}</b></div>`).join("")}</div></details>`;
}
function bindManual(){
  const ql = +S.rules.qlen, qa = (Math.min(mq, S.rules.quarters) - 1) * ql;
  document.querySelectorAll("[data-mq]").forEach(b => b.addEventListener("click", () => { mq = +b.dataset.mq; mw = null; render(); }));
  document.querySelectorAll("[data-mdel]").forEach(b => b.addEventListener("click", () => { S.manual = mRaw().filter(c => c.id !== b.dataset.mdel); manualApply(); }));
  $("#mPurge")?.addEventListener("click", () => { const lost = manualLost(); S.manual = mRaw().filter(c => !lost.includes(c)); manualApply(); });
  $("#mAdd")?.addEventListener("click", () => { const last = manualList().filter(c => c.t > qa && c.t < qa + ql).sort((a, b) => b.t - a.t)[0]; let m0 = last ? Math.min(Math.floor(ql), Math.floor(last.t - qa) + 2) : (mq === 1 ? 6 : 4); if (matchStarted() && matchT() >= qa && matchT() < qa + ql) m0 = Math.max(m0, Math.min(Math.floor(ql), Math.floor(matchT() - qa) + 1)); mw = {step: "when", m: m0, s: 0, end: false, outs: [], ins: [], pos: []}; render(); });
  $("#mCancel")?.addEventListener("click", () => { mw = null; render(); });
  $("#mMin")?.addEventListener("change", e => { mw.m = +e.target.value; mw.step = "when"; mw.outs = []; mw.ins = []; render(); });
  $("#mSec")?.addEventListener("change", e => { mw.s = +e.target.value; mw.step = "when"; mw.outs = []; mw.ins = []; render(); });
  $("#mEnd")?.addEventListener("click", () => { mw.end = !mw.end; mw.step = "when"; mw.outs = []; mw.ins = []; render(); });
  $("#mNext")?.addEventListener("click", () => { mw.step = "out"; render(); });
  document.querySelectorAll("[data-mout]").forEach(b => b.addEventListener("click", () => { const n = b.dataset.mout; mw.outs = mw.outs.includes(n) ? mw.outs.filter(x => x !== n) : [...mw.outs, n]; render(); }));
  $("#mOutOk")?.addEventListener("click", () => { mw.step = "in"; mw.ins = []; render(); });
  document.querySelectorAll("[data-min]").forEach(b => b.addEventListener("click", () => { const n = b.dataset.min; mw.ins = mw.ins.includes(n) ? mw.ins.filter(x => x !== n) : [...mw.ins, n]; render(); }));
  $("#mInOk")?.addEventListener("click", () => {
    const t = mw.end ? qa + ql : qa + mw.m + mw.s / 60, on = manualState(t).on;
    mw.pos = mw.outs.map(o => on[o]); mw.step = "pos"; render();
  });
  document.querySelectorAll("[data-mpos]").forEach(sel => sel.addEventListener("change", () => {
    const i = +sel.dataset.mpos, j = mw.pos.indexOf(sel.value);
    if (j >= 0 && j !== i) mw.pos[j] = mw.pos[i]; // deux entrants ne prennent pas le même poste : ils échangent
    mw.pos[i] = sel.value; render();
  }));
  $("#mSave")?.addEventListener("click", () => {
    mRaw().push({id: newId(), q: Math.min(mq, S.rules.quarters), m: mw.end ? 0 : Math.round((mw.m + mw.s / 60) * 3600) / 3600, end: mw.end, outs: mw.outs.slice(), ins: mw.ins.slice(), pos: mw.pos.slice()});
    mw = null; manualApply();
  });
  $("#mUse")?.addEventListener("click", () => { if (matchStarted()) return; S.plan = manualPlan(); S.prevPlan = null; S.basePlan = null; preview = null; S.sheet = {us:[], them:[], pc:0, log:[]}; C = freshClock(); pushClock(); persist(); render(); });
  $("#mView")?.addEventListener("input", e => { mView = +e.target.value; const t = qa + mView / 60; $("#mPitch").innerHTML = manualPitch(t); $("#mViewT").textContent = R.fmtMin(mView / 60); });
}
// Avant le match, le plan « Plan manuel » suit la compo, les présents et le format.
function mRefresh(){ if (!ADJ && S.plan?.manual && !S.plan.savedAt && !matchStarted()) { const p = manualPlan([]); if (JSON.stringify(p.segs) !== JSON.stringify(S.plan.segs) || JSON.stringify(p.warnings) !== JSON.stringify(S.plan.warnings) || p.fmt !== S.plan.fmt) { S.plan = p; persist(); } } }
function matchPrepTab(){
  // Liste de changements active : le plan suit la compo et les présents tant que le match n'a pas commencé.
  mRefresh();
  const T = computeTargets();
  const pres = present(), ids = PRESETS[S.preset].map(p => p[0]);
  const filled = ids.filter(id => S.lineup[id] && pres.some(p => p.name === S.lineup[id])).length;
  const lineupSel = PRESETS[S.preset].map(([id,label,line,x,y]) => `<div class="pp" style="left:${x}%;top:${y}%"><span class="dot ${line}">${esc(posShort(id))}</span><select data-lu="${id}" aria-label="${esc(label)}"><option value="">—</option>${pres.filter(p=>p.pos.includes(id)).concat(pres.filter(p=>!p.pos.includes(id))).map(p=>`<option ${S.lineup[id]===p.name?"selected":""}>${esc(p.name)}</option>`).join("")}</select></div>`).join("");
  const presList = S.squad.map((p,i) => `<label class="chk${p.present ? " on" : ""}"><input type="checkbox" data-i="${i}" data-k="present" ${p.present?"checked":""}> ${esc(p.name)}</label>`).join("");
  const minList = pres.map(p => { const i = S.squad.indexOf(p); return `<label class="minrow"><span>${p.pos.length && !p.pos.some(q => q !== "G") ? `<b class="gk-tag">GK</b>` : ""}${esc(p.name)}</span><input type="number" step="0.5" min="0" data-i="${i}" data-k="minutes" value="${p.minutes||""}" placeholder="${T[p.name]!==undefined ? R.fmtMin(T[p.name]).replace("'",",").replace(/,$/,"") : ""}" aria-label="Minutes fixées pour ${esc(p.name)}"></label>`; }).join("");
  const anyMin = S.squad.some(p => p.minutes);
  return `<div class="prep-h"><div style="min-width:0"><div class="prep-t">${esc(S.matchLabel || "Match sans nom")}</div><div class="muted">${esc(fmtDate(S.matchDate))} · ${esc(matchStatus(curMatchRec()))}</div></div><button class="btn small" id="cList">Mes matchs (${S.matches.length})</button></div>
  <div class="card steps-card">
    ${step("info", 1, !!S.matchLabel, "Adversaire et date", S.matchLabel ? `${S.matchLabel} · ${fmtDate(S.matchDate)}` : "À remplir",
      `<div class="form"><label class="fld"><span>Nom du match</span><input type="text" id="mLabel" value="${esc(S.matchLabel||"")}" placeholder="ex. Wellington – Daring"></label><label class="fld"><span>Date</span><input type="date" id="mDate" value="${esc(S.matchDate||"")}"></label></div>`)}
    ${step("pres", 2, pres.length >= ids.length, "Présents", `${pres.length} joueurs sur ${S.squad.length}`,
      `<div class="chks">${presList}</div>`)}
    ${step("compo", 3, filled === ids.length, "Compo de départ", `${S.preset} · ${filled} postes sur ${ids.length}`,
      `<div class="row" style="margin-bottom:12px"><span class="muted">Système : <b>${esc(S.preset)}</b>${S.preset === teamSys() ? " (à changer dans « Effectif »)" : ` (celui de ce match ; ton équipe joue maintenant en ${esc(teamSys())})`}</span></div>
      <div class="pitch" style="max-width:440px;margin:0 auto">${pitchLines()}${lineupSel}</div>`)}
    ${step("time", 4, true, "Temps de jeu", TIME_MODES.find(([v]) => v === timeMode())[1] + (anyMin && timeMode() !== "manual" ? " · minutes fixées" : ""),
      `<div class="seg" role="group">${TIME_MODES.map(([v,l]) => `<button data-tmode="${v}" aria-pressed="${timeMode()===v}">${esc(l)}</button>`).join("")}</div>
      <p class="muted" style="margin:8px 0 12px;font-size:.9rem">${TIME_HELP[timeMode()]}${timeMode() === "manual" || timeMode() === "notes" ? "" : " Laisse une case vide pour le calcul automatique (en gris)."}</p>
      ${timeMode() === "manual" || timeMode() === "notes" ? "" : (() => { const field = pres.filter(p => p.pos.some(q => q !== "G")), fixed = field.filter(p => +p.minutes > 0); return fixed.length ? `<div class="warn" style="margin-bottom:10px">${fixed.length === field.length ? "Tous tes joueurs de champ ont" : fixed.length + " joueur" + (fixed.length > 1 ? "s ont" : " a")} des minutes fixées (${esc(fixed.map(p => p.name).join(", "))}) : ${fixed.length > 1 ? "ils gardent" : "il garde"} ces minutes quel que soit le choix. <button class="btn small" id="clearMin2">Effacer les minutes fixées</button></div>` : ""; })()}
      ${timeMode() === "manual" ? "" : `<div id="budget">${budgetLine()}</div><div class="mins">${minList}</div>`}`)}
    ${step("rules", 5, true, "Règles de rotation", `${S.rules.quarters} ${pWord()}${halves() ? "" : "s"} de ${R.fmtMin(+S.rules.qlen)}` + (() => { const n = Array.from({length:S.rules.quarters}, (_, q) => perDiff(q).length ? 1 : 0).reduce((a, b) => a + b, 0); return n ? ` · ${n} ${halves() ? "mi-temps" : "quart" + (n > 1 ? "s" : "")} ${n > 1 ? "différent" + (halves() ? "es" : "s") : "différent" + (halves() ? "e" : "")}` : ""; })(),
      rulesBody())}
  </div>
  <div class="card"><div class="row" style="justify-content:space-between"><h2 style="margin:0">Plan de rotation</h2>${S.plan ? `<button class="btn small" id="pdfB">📄 Plan B (PDF)</button>` : ""}</div>
    ${pdfMsg && S.plan ? `<div class="muted" style="margin-top:6px;font-size:.9rem">${esc(pdfMsg)}</div>` : ""}
    ${timeMode() === "manual" ? manualCard() : planCardBody()}
  </div>`;
}
function planCardBody(){
  return `${S.plan?.manual && !preview && timeMode() !== "manual" ? `<div class="warn" style="margin-top:10px"><b>Pour le match, c'est encore ta liste « ${esc(TIME_MODES.find(m => m[0] === "manual")[1])} » qui sert</b> (${(n => n ? `${n} moment${n > 1 ? "s" : ""} de changement` : "aucun changement")(visChanges(S.plan).length)}). ${matchStarted() ? "Le match a commencé : elle reste jusqu'à la fin ou jusqu'à « Match à 0 »." : "Pour la remplacer, génère un plan puis touche « Utiliser pour le match »."}</div>` : S.plan && !preview && (S.plan.timeMode || "notes") !== timeMode() ? `<div class="warn" style="margin-top:10px">Le plan actif a été fait avec « ${esc(TIME_MODES.find(m => m[0] === (S.plan.timeMode || "notes"))[1])} ». Génère un nouveau plan puis touche « Utiliser pour le match ».</div>` : ""}
    ${S.plan && !preview && !S.plan.savedAt && Object.keys(S.plan.played || {}).some(n => !S.squad.some(p => p.name === n)) ? `<div class="warn" style="margin-top:10px">Un joueur du plan a été renommé ou supprimé. Génère un nouveau plan puis touche « Utiliser pour le match ».</div>` : ""}
    ${S.plan && !preview && !S.plan.manual && S.plan.rulesSig && S.plan.rulesSig !== rulesSig() && !matchStarted() ? `<div class="warn" style="margin-top:10px">Les règles ont changé depuis ce plan. Génère un nouveau plan puis touche « Utiliser pour le match ».</div>` : ""}
    ${(b => b ? `<div class="warn" style="margin-top:10px">${b.left > 0 ? `Il te reste ${R.fmtMin(b.left)} à distribuer` : `Tu dépasses de ${R.fmtMin(-b.left)}`} dans « Temps de jeu » : toutes les minutes doivent être données pour générer le plan.</div>` : "")(budgetBlock())}
    ${(z => z.length ? `<div class="warn" style="margin-top:10px">${esc(z.join(", "))} ${z.length > 1 ? "sont" : "est"} dans la compo de départ mais à 0 minute : donne-${z.length > 1 ? "leur" : "lui"} des minutes ou change la compo.</div>` : "")(zeroStarters())}
    <div class="row" style="margin-top:10px"><button class="btn primary${preview ? "" : " big"}" id="gen"${budgetBlock() || zeroStarters().length ? " disabled" : ""}>${preview ? "Autre version" : "Générer le plan"}</button>${preview && !preview.error ? `<button class="btn go big" id="use">Utiliser pour le match</button>` : ""}</div>
    <div id="genOut" style="margin-top:12px">${previewHtml()}</div>`;
}
const nicePos = w => String(w).replace(/le poste (\w+)/g, (m, q) => "le poste « " + posName(q) + " »");
function previewHtml(){
  const plan = preview || S.plan;
  if (!plan) return `<p class="muted">Clique sur « Générer le plan » une fois l'effectif et la compo prêts.</p>`;
  if (plan.error) return `<div class="warn">${plan.warnings.map(w => esc(nicePos(w))).join("<br>")}</div>`;
  const tag = preview ? `<div class="warn" style="background:var(--chip);color:var(--ink)">Nouvelle version, pas encore utilisée pour le match.</div>` : `<div class="ok">Plan actif pour le match.</div>`;
  const modeTag = `<div class="muted" style="margin-top:6px;font-size:.9rem">Temps de jeu : ${esc(TIME_MODES.find(m => m[0] === (plan.timeMode || "notes"))[1])}</div>`;
  const warn = plan.warnings.length ? `<div class="warn" style="margin-top:8px">${plan.warnings.map(w => esc(nicePos(w))).join("<br>")}</div>` : `<div class="ok" style="margin-top:8px">Toutes les règles sont respectées. ${plan.changes.length} fenêtres de changement.</div>`;
  const names = Object.keys(plan.played).sort((a,b)=>plan.played[b]-plan.played[a]);
  const END = S.rules.quarters*S.rules.qlen;
  const rec = names.map(n => { const d = plan.played[n]-plan.targets[n]; return `<tr><td>${esc(n)}</td><td>${R.fmtMin(plan.played[n])}</td><td class="muted">${R.fmtMin(plan.targets[n])}</td><td class="dev" style="color:${Math.abs(d)<=1.5?"var(--in)":"var(--out)"}">${d>=0?"+":"−"}${R.fmtMin(Math.abs(d))}</td></tr>`; }).join("");
  const tl = names.map(n => `<div class="tlr"><div>${esc(n)}</div><div class="trk">${plan.segs.map(s => s.on[n] ? `<i style="left:${s.a/END*100}%;width:${(s.b-s.a)/END*100}%;background:var(--${posMeta(s.on[n]).line})">${(s.b-s.a)>=2.5?esc(posShort(s.on[n])):""}</i>` : "").join("")}${Array.from({length:S.rules.quarters-1}, (_,k) => `<span class="q" style="left:${(k+1)/S.rules.quarters*100}%"></span>`).join("")}</div></div>`).join("");
  return `${tag}${modeTag}${warn}<div class="grid2" style="margin-top:12px"><div class="tbl-wrap"><table class="recap"><thead><tr><th>Joueur</th><th>Prévu</th><th>Visé</th><th>Écart</th></tr></thead><tbody>${rec}</tbody></table></div><div class="tl"><div class="tl-in">${tl}</div></div></div>`;
}
// Remplace un nom de joueur partout dans un objet (valeurs et clés), sans toucher aux textes.
function renameIn(o, a, b){
  if (!o || typeof o !== "object" || a === b) return;
  for (const k of Object.keys(o)) {
    const v = o[k];
    if (v === a) o[k] = b; else renameIn(v, a, b);
    if (k === a && !Array.isArray(o)) { o[b] = o[k]; delete o[k]; }
  }
}
function bindCoach(){
  const v = $("#view");
  bindTeams();
  bindManual();
  // Le compteur de minutes bouge pendant la saisie, avant même de quitter la case.
  v.querySelectorAll('[data-k="minutes"]').forEach(el => el.addEventListener("input", () => { const b = $("#budget"); if (!b) return; const p = S.squad[+el.dataset.i], old = p.minutes; p.minutes = el.value ? +el.value : 0; b.innerHTML = budgetLine(); p.minutes = old; }));
  v.querySelectorAll("[data-i]").forEach(el => el.addEventListener("change", () => {
    const p = S.squad[+el.dataset.i], k = el.dataset.k;
    if (k === "name") {
      const nn = el.value.trim(), old = p.name;
      // Le plan et la compo retrouvent les joueurs par leur nom : il doit être unique.
      if (!nn || S.squad.some(x => x !== p && x.name.trim().toLowerCase() === nn.toLowerCase())) { squadMsg = nn ? `Il y a déjà un joueur « ${nn} ». Ajoute l'initiale du nom, ex. « ${nn} D. ».` : "Le nom ne peut pas être vide."; render(); return; }
      squadMsg = "";
      // Même nom (ou l'évènement « change » reçu deux fois) : rien à renommer.
      if (nn === old) { render(); return; }
      p.name = nn;
      for (const q in S.lineup) if (S.lineup[q] === old) S.lineup[q] = nn;
      // Les changements écrits par le coach, les plans et les compos des autres matchs suivent aussi le nouveau nom.
      [S.manual, S.plan, S.prevPlan, S.basePlan, ...S.matches.filter(m => m.id !== S.curMatch)].forEach(o => renameIn(o, old, nn));
      // La saison aussi : sinon ses stats seraient coupées en deux (ancien et nouveau nom).
      try { const L = localSeasonL(); renameIn(L, old, nn); localStorage.setItem("banc-season", JSON.stringify(L)); season = null; markChanged(); } catch(e){}
      preview = null; persist(); render(); return;
    }
    if (k === "present") p.present = el.checked;
    else if (k === "pos") p.pos = el.value.split(/[ ,;/]+/).map(x => x.trim().toUpperCase()).filter(Boolean);
    else if (k === "minutes") p[k] = el.value ? +el.value : 0;
    else p[k] = el.value;
    preview = null; persist(); render();
  }));
  v.querySelectorAll("[data-del]").forEach(el => el.addEventListener("click", () => { if (el.dataset.armed) { S.squad.splice(+el.dataset.del,1); preview=null; persist(); render(); } else { el.dataset.armed=1; el.textContent="Sûr ?"; } }));
  v.querySelectorAll("[data-rmpos]").forEach(b => b.addEventListener("click", () => { const p = S.squad[+b.dataset.rmpos]; p.pos = p.pos.filter(q => q !== b.dataset.q); preview = null; persist(); render(); }));
  v.querySelectorAll("[data-addpos]").forEach(sel => sel.addEventListener("change", () => { if (!sel.value) return; const p = S.squad[+sel.dataset.addpos]; p.pos = [...p.pos, sel.value]; preview = null; persist(); render(); }));
  v.querySelectorAll("[data-role]").forEach(b => b.addEventListener("click", () => { const p = S.squad[+b.dataset.ri]; p.roles ||= []; const r = b.dataset.role; p.roles = p.roles.includes(r) ? p.roles.filter(x => x !== r) : [...p.roles, r]; preview = null; persist(); render(); }));
  $("#addP")?.addEventListener("click", () => { let n = S.squad.length + 1; while (S.squad.some(p => p.name === "Joueur " + n)) n++; S.squad.push({name:"Joueur " + n,pos:[],present:true,minutes:0}); persist(); render(); });
  ["#clearMin", "#clearMin2"].forEach(id => $(id)?.addEventListener("click", () => { S.squad.forEach(p => p.minutes = 0); preview=null; persist(); render(); }));
  $("#teamSys")?.addEventListener("change", e => { const to = e.target.value; posNote = "";
    if (S.squad.some(p => p.pos.some(q => q !== "G"))) { sysAsk = to; render(); } else { setSystem(to, false); posNote = ""; persist(); render(); } });
  $("#sysKeep")?.addEventListener("click", () => { setSystem(sysAsk, true); sysAsk = null; persist(); render(); });
  $("#sysClear")?.addEventListener("click", () => { setSystem(sysAsk, false); sysAsk = null; persist(); render(); });
  $("#sysCancel")?.addEventListener("click", () => { sysAsk = null; render(); });
  v.querySelectorAll("[data-ctab]").forEach(b => b.addEventListener("click", () => { coachTab = b.dataset.ctab; sysAsk = null; posNote = ""; render(); }));
  v.querySelectorAll("[data-step]").forEach(b => b.addEventListener("click", () => { coachStep = coachStep === b.dataset.step ? null : b.dataset.step; rulesResetArmed = false; render(); }));
  bindRules(v);
  v.querySelectorAll("[data-lu]").forEach(el => el.addEventListener("change", () => { const id = el.dataset.lu; for (const k in S.lineup) if (S.lineup[k] === el.value && k !== id) delete S.lineup[k]; if (el.value) S.lineup[id] = el.value; else delete S.lineup[id]; preview=null; persist(); render(); }));
  $("#pdfB")?.addEventListener("click", makePdf);
  $("#matchLabel")?.addEventListener("change", e => { S.matchLabel = e.target.value; persist(); render(); });
  $("#mLabel")?.addEventListener("change", e => { S.matchLabel = e.target.value.trim(); persist(); render(); });
  $("#mDate")?.addEventListener("change", e => { S.matchDate = e.target.value; persist(); render(); });
  $("#saveMatchC")?.addEventListener("click", saveMatch);
  document.querySelectorAll("[data-tmode]").forEach(b => b.addEventListener("click", () => { S.timeMode = b.dataset.tmode; preview = null; persist(); render(); }));
  $("#cList")?.addEventListener("click", () => { matchesOpen = true; goTo("match"); });
  document.querySelectorAll("[data-ratem]").forEach(b => b.addEventListener("click", () => { rateId = rateId === b.dataset.ratem ? null : b.dataset.ratem; render(); if (rateId) $(".rate-card")?.scrollIntoView({behavior:"smooth", block:"start"}); }));
  document.querySelectorAll("[data-rate]").forEach(el => el.addEventListener("change", () => { setRating(rateId, el.dataset.rate, el.value); render(); }));
  $("#rateClose")?.addEventListener("click", () => { rateId = null; render(); });
  document.querySelectorAll("[data-delm]").forEach(b => b.addEventListener("click", () => { if (b.dataset.armed) deleteMatch(b.dataset.delm); else { b.dataset.armed = 1; b.textContent = "Sûr ?"; } }));
  $("#gen")?.addEventListener("click", () => { const b = $("#gen"); b.disabled = true; b.textContent = "Calcul…"; setTimeout(() => { preview = generate(Date.now() % 100000 + (seedN++)); render(); }, 30); });
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
