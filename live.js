// Chrono partagé avec l'adjoint (Supabase Realtime, sans compte pour l'adjoint).
// Le coach ouvre un « canal » avec un code au hasard et donne le lien à son adjoint.
// Le téléphone du coach envoie le plan (sans notes ni temps visés) et le chrono ;
// les deux téléphones peuvent lancer, arrêter et régler le chrono. Pour un imprévu ou
// « Match à 0 », l'adjoint envoie une demande : c'est le téléphone du coach qui recalcule.
const ADJ = (() => { try { return (new URLSearchParams(location.search).get("adjoint") || "").replace(/[^A-Za-z0-9]/g, "").slice(0, 16) || null; } catch(e){ return null; } })();
let liveCh = null, liveCode = null, liveOK = false, liveAdj = 0, liveCoach = false, liveTimer = null;
let shareOpen = false, shareMsg = "";
const LIVE_ON = CLOUD_ON;
const liveUrl = code => appUrl() + "?adjoint=" + code;
function genLiveCode(){ const A = "abcdefghjkmnpqrstuvwxyz23456789", r = new Uint32Array(10); crypto.getRandomValues(r); return Array.from(r, x => A[x % A.length]).join(""); }

// Ce que l'adjoint reçoit : de quoi afficher le match, rien de plus.
function adjointView(){
  let plan = null;
  if (S.plan) { plan = JSON.parse(JSON.stringify(S.plan)); delete plan.targets; delete plan.played; delete plan.warnings; delete plan.score; }
  return {teamName:S.teamName, color:S.color || DEFAULT_COLOR, profile:{club:S.profile?.club || ""}, matchLabel:S.matchLabel || "", matchDate:S.matchDate || "",
    preset:S.preset, rules:S.rules, plan, sheet:S.sheet, hasPrev:!!S.prevPlan,
    squad:S.squad.map(p => ({name:p.name, pos:p.pos, present:p.present, roles:p.roles || []}))};
}
// Le chrono voyage en « temps écoulé à l'envoi » : pas besoin que les deux téléphones aient la même heure.
const clockMsg = () => ({q:C.q, elapsed:clockElapsed(), running:C.running, done:[...(C.done || [])]});
function adoptClock(m){
  if (!m || typeof m.q !== "number") return;
  C = {q:m.q, elapsed:m.elapsed, running:!!m.running, startedAt:Date.now(), done:[...(m.done || [])]};
  if (!ADJ) saveClock();
  lastAlertKey = "";
  if (mode === "match" && !inc) render();
}

function liveConnect(code){
  if (!LIVE_ON || liveCode === code) return;
  liveStop();
  const client = sb || (sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseKey, {auth:{persistSession:false, autoRefreshToken:false, detectSessionInUrl:false}}));
  liveCode = code;
  const ch = client.channel("stickmate-" + code, {config:{broadcast:{self:false}, presence:{key:SID}}});
  ch.on("broadcast", {event:"clock"}, ({payload}) => adoptClock(payload));
  if (ADJ) {
    ch.on("broadcast", {event:"state"}, ({payload}) => applyCoachState(payload));
    ch.on("broadcast", {event:"answer"}, ({payload}) => adjAnswer(payload));
  } else {
    ch.on("broadcast", {event:"hello"}, () => liveSendState());
    ch.on("broadcast", {event:"ask"}, ({payload}) => coachAnswer(payload));
  }
  ch.on("presence", {event:"sync"}, () => {
    const all = Object.values(ch.presenceState()).flat();
    liveAdj = all.filter(p => p.role === "adjoint").length;
    liveCoach = all.some(p => p.role === "coach");
    paintLive();
  });
  ch.subscribe(status => {
    liveOK = status === "SUBSCRIBED";
    if (liveOK) {
      ch.track({role: ADJ ? "adjoint" : "coach"});
      if (ADJ) ch.send({type:"broadcast", event:"hello", payload:{}});
      else liveSendState();
    }
    paintLive();
  });
  liveCh = ch;
}
function liveStop(){ if (liveCh) { try { liveCh.unsubscribe(); } catch(e){} } liveCh = null; liveCode = null; liveOK = false; liveAdj = 0; liveCoach = false; }
function liveSendClock(){ if (liveCh && liveOK) liveCh.send({type:"broadcast", event:"clock", payload:clockMsg()}); }
function liveSendState(){
  if (ADJ || !liveCh || !liveOK) return;
  liveCh.send({type:"broadcast", event:"state", payload:{view:adjointView(), clock:clockMsg()}});
}
// Après un changement du coach (plan, imprévu, score…), on renvoie l'état à l'adjoint.
function liveChanged(){ if (ADJ || !liveCh) return; clearTimeout(liveTimer); liveTimer = setTimeout(liveSendState, 300); }
function applyCoachState(p){
  if (!p?.view) return;
  if (adjWait) { clearTimeout(adjWait); adjWait = null; inc = null; incBusy = false; incMsg = ""; }
  S = {squad:[], preset:"3-2-3-2", lineup:{}, rules:{...DEFAULT_RULES}, plan:null, pin:""};
  applyData(p.view);
  adoptClock(p.clock);
  const typing = /INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName || "");
  if (!typing) render();
}

/* ---------- demandes de l'adjoint ---------- */
let adjWait = null;
function adjAsk(kind, data = {}){
  if (!liveCh || !liveOK || !liveCoach) { incBusy = false; incMsg = "Le téléphone du coach n'est pas connecté : il doit avoir StickMate ouvert, avec du réseau."; render(); return; }
  incBusy = true; incMsg = ""; render();
  liveCh.send({type:"broadcast", event:"ask", payload:{kind, ...data, from:SID}});
  clearTimeout(adjWait);
  adjWait = setTimeout(() => { adjWait = null; incBusy = false; incMsg = "Pas de réponse du téléphone du coach (app fermée ou pas de réseau ?). Réessaie."; render(); }, 8000);
}
const adjInc = () => ({type:inc.type, player:inc.player, inP:inc.inP ?? null, pos:inc.pos || null, catchUp:!!inc.catchUp});
function adjAnswer(p){
  if (p?.to !== SID) return;
  clearTimeout(adjWait); adjWait = null; incBusy = false;
  if (p.warnings && inc) { inc.pending = {warnings:p.warnings}; incMsg = ""; }
  else if (p.error) incMsg = p.error;
  else { inc = null; incMsg = ""; }
  render();
}
// Les avertissements qui parlent de temps visés ne partent pas tels quels chez l'adjoint.
const adjWarnings = W => [...new Set(W.map(w => /au lieu de/.test(w) ? "Le temps de jeu prévu de certains joueurs ne pourra pas être respecté." : nicePos(w)))];
// Sur le téléphone du coach : on fait ce que l'adjoint demande, sans toucher à ce que le coach est en train de faire.
function coachAnswer(p){
  if (!p?.kind || !S.plan) return;
  const reply = r => liveCh?.send({type:"broadcast", event:"answer", payload:{to:p.from, ...r}});
  const mine = inc, mineMsg = incMsg, mineBusy = incBusy;
  let r = {ok:true};
  incMsg = "";
  if (p.kind === "reset") resetMatch();
  else if (p.kind === "undo") { if (S.prevPlan) { S.plan = S.prevPlan; S.prevPlan = null; syncDone(); pushClock(); persist(); } }
  else if (p.kind === "heal") { endInjury(p.player); if (incMsg) r = {error:incMsg}; }
  else if (p.kind === "incident" && p.inc) {
    inc = {...p.inc, inP: p.inc.inP ?? undefined};
    doIncident();
    if (inc?.pending && p.force) applyPlan(inc.pending);
    else if (inc?.pending) r = {warnings:adjWarnings(inc.pending.warnings)};
    else if (incMsg) r = {error:incMsg};
  }
  inc = mine === null ? null : mine; incMsg = mineMsg; incBusy = mineBusy;
  clearTimeout(liveTimer); liveSendState(); reply(r); render();
}

/* ---------- coach : partager ---------- */
function shareStart(){
  if (!S.liveCode) { S.liveCode = genLiveCode(); persist(); }
  liveConnect(S.liveCode); shareOpen = true; shareMsg = ""; render();
}
function shareEnd(){ liveStop(); delete S.liveCode; persist(); shareOpen = false; render(); }
function qrSvg(text){
  try { const q = qrcode(0, "M"); q.addData(text); q.make(); return q.createSvgTag({cellSize:5, margin:2, scalable:true}); } catch(e){ return ""; }
}
function liveStatusText(){
  if (!navigator.onLine) return "Pas de réseau : le chrono n'est plus partagé.";
  if (!liveOK) return "Connexion…";
  return liveAdj ? `● ${liveAdj === 1 ? "Ton adjoint est connecté" : liveAdj + " adjoints connectés"}` : "En attente de ton adjoint…";
}
function shareCard(){
  if (!LIVE_ON || ADJ) return "";
  if (!shareOpen) return "";
  const url = liveUrl(S.liveCode);
  return `<div class="card share"><div class="row" style="justify-content:space-between"><h2 style="margin:0">Chrono partagé</h2><button class="btn small" id="shClose">Fermer</button></div>
    <p style="margin:10px 0">Ton adjoint scanne ce code (ou ouvre le lien) sur son téléphone. Pas besoin de compte. Il voit le chrono et les changements en direct, jamais les notes ni les temps visés, et peut lancer ou arrêter le chrono.</p>
    <div class="qr">${qrSvg(url)}</div>
    <div class="row" style="margin-top:10px">${navigator.share ? `<button class="btn primary" id="shShare">Envoyer le lien</button>` : ""}<button class="btn" id="shCopy">Copier le lien</button></div>
    <p class="muted" style="margin:10px 0 0;font-size:.88rem;word-break:break-all">${esc(url)}</p>
    <p id="liveState" style="margin:10px 0 0;font-weight:600">${esc(liveStatusText())}</p>
    ${shareMsg ? `<div class="ok" style="margin-top:10px">${esc(shareMsg)}</div>` : ""}
    <p class="muted" style="margin:10px 0 0;font-size:.88rem">Le lien reste valable pour les prochains matchs. « Arrêter le partage » le coupe : il faudra en donner un nouveau.</p>
    <button class="btn" id="shEnd" style="margin-top:10px">Arrêter le partage</button></div>`;
}
function liveButton(){
  if (!LIVE_ON || ADJ) return "";
  return `<button class="btn" id="shOpen">📲 Adjoint</button><span class="live ${liveOK && liveAdj ? "on" : ""}" id="liveBadge">${liveOK && liveAdj ? "● Adjoint connecté" : ""}</span>`;
}
function bindShare(){
  $("#shOpen")?.addEventListener("click", shareStart);
  $("#shClose")?.addEventListener("click", () => { shareOpen = false; render(); });
  $("#shEnd")?.addEventListener("click", function(){ if (this.dataset.armed) shareEnd(); else { this.dataset.armed = 1; this.textContent = "Sûr ? Ton adjoint sera déconnecté"; } });
  $("#shCopy")?.addEventListener("click", async () => { try { await navigator.clipboard.writeText(liveUrl(S.liveCode)); shareMsg = "Lien copié. Colle-le dans un message à ton adjoint."; } catch(e){ shareMsg = "Copie impossible : appuie longtemps sur le lien pour le copier."; } render(); });
  $("#shShare")?.addEventListener("click", async () => { try { await navigator.share({title:"Chrono du match", text:"Le chrono du match en direct :", url:liveUrl(S.liveCode)}); } catch(e){} });
}
function paintLive(){
  const st = $("#liveState"); if (st) st.textContent = liveStatusText();
  const b = $("#liveBadge"); if (b) { const on = liveOK && liveAdj > 0; b.textContent = on ? "● Adjoint connecté" : ""; b.classList.toggle("on", on); }
  if (ADJ) paintSub();
}

/* ---------- adjoint ---------- */
function adjointWait(){
  return `<div class="card empty"><h2>Chrono de l'adjoint</h2>
    <p>${!navigator.onLine ? "Pas de réseau. Il en faut pour suivre le chrono du coach." : !liveOK ? "Connexion…" : "En attente du téléphone du coach. Demande-lui d'ouvrir l'onglet Match."}</p></div>`;
}
function adjointSub(){ return !navigator.onLine ? "Pas de réseau" : !liveOK ? "Connexion…" : liveCoach ? "● Connecté au coach" : "Coach pas connecté"; }
function liveInit(){
  if (!LIVE_ON) return;
  window.addEventListener("online", () => { const c = liveCode; liveCode = null; if (c) liveConnect(c); paintLive(); });
  window.addEventListener("offline", paintLive);
  if (ADJ) { liveConnect(ADJ); return; }
  if (S.liveCode) liveConnect(S.liveCode);
}
