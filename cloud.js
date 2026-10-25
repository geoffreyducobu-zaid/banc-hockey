// Compte coach et sauvegarde en ligne (Supabase).
// Tout est d'abord enregistré sur le téléphone : l'app marche sans réseau au bord
// du terrain, et envoie les changements dès que le réseau revient.
// Sans config.js rempli, l'app reste « données de cet appareil » comme avant.
const CFG = window.BANC_CONFIG || {};
const CLOUD_ON = !!(CFG.supabaseUrl && CFG.supabaseKey && window.supabase);
let sb = null, user = null, authReady = false;
// Écran de compte affiché : "signup" | "login" | "forgot" | "sent" | "confirmed" | "recovery" | "reset-done"
let authView = "signup", authOpen = false, authMsg = "", authOk = "", authEmail = "", authBusy = false;
let skipAccount = false, cloudChoice = null, logoutArmed = false;
let syncing = false, syncAgain = false, syncTimer = null, cloudErr = false;
// localAt : dernier changement fait sur ce téléphone ; syncedAt : dernière version identique en ligne.
let SY = loadSync();
function loadSync(){ try { return {user:null, localAt:0, syncedAt:0, ...JSON.parse(localStorage.getItem("banc-sync") || "{}")}; } catch(e){ return {user:null, localAt:0, syncedAt:0}; } }
function saveSync(){ try { localStorage.setItem("banc-sync", JSON.stringify(SY)); } catch(e){} }
const appUrl = () => location.origin + location.pathname;
const dirty = () => SY.localAt > SY.syncedAt;
function localSeason(){ try { return JSON.parse(localStorage.getItem("banc-season") || "[]"); } catch(e){ return []; } }
// Une équipe « compte » s'il y a des joueurs ou des matchs dans la saison (un profil seul ne suffit pas).
function hasLocalData(){ return !!(S.squad.length || localSeason().length); }
const rowHasData = row => !!((row.state?.squad || []).length || (row.season || []).length);

/* ---------- synchro ---------- */
function markChanged(){ if (!CLOUD_ON) return; SY.localAt = Date.now(); saveSync(); scheduleSync(); }
function scheduleSync(delay = 1500){ if (!user) return; clearTimeout(syncTimer); syncTimer = setTimeout(sync, delay); paintCloud(); }
async function sync(){
  if (!sb || !user || cloudChoice) return paintCloud();
  if (!navigator.onLine) return paintCloud();
  if (syncing) { syncAgain = true; return; }
  syncing = true; paintCloud();
  try {
    const {data:row, error} = await sb.from("coach_data").select("state,season,updated_at").eq("user_id", user.id).maybeSingle();
    if (error) throw error;
    const cloudAt = row ? Date.parse(row.updated_at) : 0;
    if (SY.user !== user.id) {
      // Première connexion sur ce téléphone : on ne mélange jamais deux équipes sans demander.
      // On ne demande que si le téléphone et le compte ont chacun des joueurs ou des matchs.
      if (row && hasLocalData() && rowHasData(row)) { cloudChoice = row; syncing = false; render(); return; }
      SY.user = user.id; saveSync();
      if (row && !hasLocalData()) applyCloud(row); else if (hasLocalData()) { SY.localAt = Date.now(); await push(); }
    }
    else if (row && cloudAt > SY.syncedAt && cloudAt >= SY.localAt) applyCloud(row);
    else if (!row || dirty()) await push();
    cloudErr = false;
  } catch(e){ cloudErr = true; }
  syncing = false; paintCloud();
  if (syncAgain) { syncAgain = false; sync(); }
}
async function push(){
  const at = SY.localAt || Date.now();
  const st = JSON.parse(JSON.stringify(S)); delete st._by; delete st.coachId;
  const {error} = await sb.from("coach_data").upsert({user_id:user.id, state:st, season:localSeason(), updated_at:new Date(at).toISOString()});
  if (error) throw error;
  SY.syncedAt = at; saveSync();
}
// Remplace les données du téléphone par celles du compte.
function applyCloud(row){
  const at = Date.parse(row.updated_at), pin = S.pin;
  resetState(); applyData(row.state || {});
  S.matches = row.state?.matches; S.curMatch = row.state?.curMatch; ensureMatches();
  try { localStorage.setItem("banc-season", JSON.stringify(row.season || [])); } catch(e){}
  if (S.pin !== pin) coachOK = false;
  season = null; preview = null; saveLocal();
  SY.user = user.id; SY.localAt = SY.syncedAt = at; saveSync();
  if (S.liveCode) liveConnect(S.liveCode);
  render();
}
function resetState(){ S = {squad:[], preset:"3-2-3-2", lineup:{}, rules:defaultRules(), plan:null, pin:""}; }
function clearLocal(){
  ["banc-state", "banc-season", "banc-clock", "banc-sync"].forEach(k => { try { localStorage.removeItem(k); } catch(e){} });
  SY = loadSync(); resetState(); applyData(SEED); ensureMatches();
  C = freshClock(); season = null; preview = null; coachOK = false; liveStop();
}
function paintCloud(){
  if (!CLOUD_ON) return;
  saveState = !user ? "Données de cet appareil"
    : syncing ? "Synchronisation…"
    : !navigator.onLine ? (dirty() ? "Pas de réseau : gardé sur ce téléphone" : "Hors ligne")
    : cloudErr ? "Pas envoyé, nouvel essai bientôt"
    : dirty() ? "Envoi…" : "Sauvegardé en ligne ✓";
  paintSub();
}

/* ---------- connexion ---------- */
async function cloudInit(){
  if (!CLOUD_ON) return;
  // Lien reçu par mail (confirmation, mot de passe oublié, lien expiré).
  const h = new URLSearchParams(location.hash.slice(1)), q = new URLSearchParams(location.search);
  const linkType = h.get("type"), linkErr = h.get("error_code") || q.get("error_code");
  if (linkType === "signup" || linkType === "email") authView = "confirmed";
  if (linkErr) { authView = "login"; authOpen = true; authMsg = linkErr === "otp_expired" ? "Ce lien a expiré ou a déjà servi. Connecte-toi, ou redemande un lien." : "Ce lien ne marche pas. Connecte-toi, ou redemande un lien."; }
  sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseKey, {auth:{persistSession:true, autoRefreshToken:true, detectSessionInUrl:true, storageKey:"banc-auth"}});
  sb.auth.onAuthStateChange((ev, session) => {
    if (ev === "PASSWORD_RECOVERY") { authView = "recovery"; authOpen = true; }
    const u = session?.user || null, changed = (u?.id || null) !== (user?.id || null);
    user = u; authReady = true;
    // Jamais d'appel à Supabase directement dans ce rappel : on le fait juste après.
    setTimeout(() => { if (changed && user) { if (authView !== "recovery" && authView !== "confirmed") authOpen = false; sync(); } paintCloud(); render(); }, 0);
  });
  if (linkType || linkErr) setTimeout(() => history.replaceState(null, "", appUrl()), 1500);
  window.addEventListener("online", () => { paintCloud(); sync(); });
  window.addEventListener("offline", paintCloud);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") sync(); });
  setInterval(() => { if (user && (dirty() || cloudErr)) sync(); }, 30000);
}
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function authError(e){
  const c = e?.code || "", m = String(e?.message || "");
  if (c === "invalid_credentials" || /invalid login/i.test(m)) return "Email ou mot de passe incorrect.";
  if (c === "email_not_confirmed" || /not confirmed/i.test(m)) return "Ton email n'est pas encore confirmé. Clique sur le lien reçu par mail (regarde aussi dans les spams).";
  if (c === "user_already_exists" || /already registered/i.test(m)) return "Un compte existe déjà avec cet email. Connecte-toi.";
  if (c === "weak_password" || /password should/i.test(m)) return "Mot de passe trop faible : au moins 8 caractères.";
  if (c === "email_address_invalid") return "Cet email n'a pas l'air valide.";
  if (/rate limit|too many/i.test(c + m)) return "Trop d'essais d'un coup. Réessaie dans une heure.";
  if (c === "same_password") return "C'est déjà ton mot de passe actuel. Choisis-en un autre.";
  if (!navigator.onLine || /fetch|network/i.test(m)) return "Pas de réseau. Il en faut pour te connecter (une seule fois par téléphone).";
  return "Ça n'a pas marché (" + (m || c || "erreur inconnue") + "). Réessaie.";
}
const val = id => ($("#" + id)?.value || "").trim();
// Lit le formulaire, vérifie, puis appelle Supabase en affichant « Un instant… ».
async function authRun(check, fn){
  if (authBusy) return;
  authMsg = ""; authOk = "";
  const f = check(); if (authMsg || !f) return render();
  authBusy = true; render();
  try { await fn(f); } catch(e){ authMsg = authError(e); }
  authBusy = false; render();
}
function newPassword(){
  const pw = $("#auPw").value, pw2 = $("#auPw2").value;
  if (pw.length < 8) authMsg = "Choisis un mot de passe d'au moins 8 caractères.";
  else if (pw !== pw2) authMsg = "Les deux mots de passe ne sont pas pareils. Retape-les.";
  return pw;
}
function doSignup(){ return authRun(() => {
  const email = authEmail = val("auEmail").toLowerCase();
  if (!EMAIL_RE.test(email)) { authMsg = "Cet email n'a pas l'air valide."; return; }
  return {email, pw:newPassword()};
}, async ({email, pw}) => {
  const {data, error} = await sb.auth.signUp({email, password:pw, options:{emailRedirectTo:appUrl()}});
  if (error) throw error;
  // Supabase répond « ok » sans rien faire si l'email a déjà un compte.
  if (data.user && !data.user.identities?.length) { authView = "login"; authMsg = "Un compte existe déjà avec cet email. Connecte-toi."; return; }
  if (!data.session) authView = "sent";
}); }
function doLogin(){ return authRun(() => {
  const email = authEmail = val("auEmail").toLowerCase(), pw = $("#auPw").value;
  if (!EMAIL_RE.test(email) || !pw) { authMsg = "Tape ton email et ton mot de passe."; return; }
  return {email, pw};
}, async ({email, pw}) => {
  const {error} = await sb.auth.signInWithPassword({email, password:pw});
  if (error) throw error;
}); }
function doResend(){ return authRun(() => authEmail, async () => {
  const {error} = await sb.auth.resend({type:"signup", email:authEmail, options:{emailRedirectTo:appUrl()}});
  if (error) throw error;
  authOk = "Email renvoyé à " + authEmail + ".";
}); }
function doForgot(){ return authRun(() => {
  const email = authEmail = val("auEmail").toLowerCase();
  if (!EMAIL_RE.test(email)) { authMsg = "Tape l'email de ton compte."; return; }
  return email;
}, async email => {
  const {error} = await sb.auth.resetPasswordForEmail(email, {redirectTo:appUrl()});
  if (error) throw error;
  authOk = "Si un compte existe avec cet email, un lien pour changer ton mot de passe vient de partir. Regarde aussi dans les spams.";
}); }
function doNewPassword(){ return authRun(newPassword, async pw => {
  const {error} = await sb.auth.updateUser({password:pw});
  if (error) throw error;
  authView = "reset-done";
}); }
async function logout(){
  if (dirty() && user) await sync();
  if (dirty() && !logoutArmed) { logoutArmed = true; render(); return; }
  try { await sb.auth.signOut({scope:"local"}); } catch(e){}
  try { localStorage.removeItem("banc-auth"); } catch(e){}
  user = null; logoutArmed = false; clearLocal();
  authView = "login"; authOpen = false; mode = "home"; render(); window.scrollTo(0, 0);
}
function chooseData(keepPhone){
  const row = cloudChoice; cloudChoice = null;
  if (keepPhone) { SY.user = user.id; SY.localAt = Date.now(); saveSync(); sync(); }
  else applyCloud(row);
  render();
}
function openAuth(view){ authView = view; authOpen = true; authMsg = ""; authOk = ""; goTo("home"); render(); window.scrollTo(0, 0); }

/* ---------- écrans ---------- */
// Écran de compte à afficher à la place de l'app, ou "" s'il n'y en a pas.
function accountScreen(){
  if (!CLOUD_ON) return "";
  if (cloudChoice) {
    const cs = cloudChoice.state || {}, nCloud = (cs.squad || []).length;
    return `<div class="card onb"><h2>Quelles données garder ?</h2>
      <p style="margin:0">Ce téléphone a déjà une équipe (${S.squad.length} joueurs${S.teamName ? `, ${esc(S.teamName)}` : ""}), et ton compte aussi (${nCloud} joueurs${cs.teamName ? `, ${esc(cs.teamName)}` : ""}).</p>
      <p class="muted" style="margin:0;font-size:.92rem">Celles que tu ne gardes pas seront effacées. Dans le doute, télécharge d'abord une sauvegarde dans Réglages.</p>
      <button class="btn primary big" id="keepCloud">Garder celles du compte</button>
      <button class="btn big" id="keepPhone">Garder celles de ce téléphone</button></div>`;
  }
  const field = (id, label, type, ac, v = "") => `<label class="fld"><span>${esc(label)}</span><input id="${id}" type="${type}" autocomplete="${ac}" value="${esc(v)}" ${type === "email" ? 'inputmode="email" autocapitalize="off" spellcheck="false"' : ""}></label>`;
  const msgs = () => (authMsg ? `<div class="warn">${esc(authMsg)}</div>` : "") + (authOk ? `<div class="ok">${esc(authOk)}</div>` : "");
  const busy = authBusy ? " disabled" : "";
  if (authView === "recovery") return `<div class="card onb"><h2>Nouveau mot de passe</h2>
      <div class="form">${field("auPw", "Nouveau mot de passe (8 caractères min.)", "password", "new-password")}${field("auPw2", "Retape-le", "password", "new-password")}</div>
      ${msgs()}<button class="btn go big" id="auNewPw"${busy}>Enregistrer</button></div>`;
  if (authView === "reset-done") return `<div class="card onb"><h2>Mot de passe changé ✓</h2>
      <p style="margin:0">Si tu as installé l'app sur l'écran d'accueil, ouvre-la et connecte-toi avec ce nouveau mot de passe.</p>
      <button class="btn primary big" id="auDone">Continuer ici</button></div>`;
  if (authView === "confirmed") return `<div class="card onb"><h2>Email confirmé ✓</h2>
      <p style="margin:0">Ton compte est prêt. Si tu as installé l'app sur l'écran d'accueil, ouvre-la et connecte-toi avec ton email et ton mot de passe.</p>
      <button class="btn primary big" id="auDone">Continuer ici</button></div>`;
  if (user || !(authOpen || (!S.profile && !skipAccount))) return "";
  if (authView === "sent") return `<div class="card onb"><h2>Regarde tes emails</h2>
      <p style="margin:0">On t'a envoyé un lien à <b>${esc(authEmail)}</b>. Clique dessus pour confirmer ton compte (regarde aussi dans les spams).</p>
      <p class="muted" style="margin:0;font-size:.92rem">Ensuite, reviens ici et connecte-toi.</p>
      ${msgs()}<button class="btn primary big" id="auToLogin">Me connecter</button>
      <button class="btn" id="auResend"${busy}>Renvoyer l'email</button></div>`;
  const tabs = `<div class="seg" role="group" style="align-self:flex-start"><button data-auth="signup" aria-pressed="${authView === "signup"}">Créer un compte</button><button data-auth="login" aria-pressed="${authView !== "signup"}">Me connecter</button></div>`;
  const later = `<button class="btn" id="auLater" style="align-self:flex-start">${S.profile ? "Plus tard" : "Continuer sans compte"}</button>
      <p class="muted" style="margin:0;font-size:.85rem">${S.profile ? "Tes données restent sur ce téléphone en attendant." : "Sans compte, tout reste seulement sur ce téléphone. Tu pourras créer ton compte plus tard dans Réglages."}</p>`;
  const intro = `${logoLockup()}<h2>Bienvenue sur StickMate</h2><p style="margin:0">L'app qui prépare tes changements et te prévient pendant le match. Avec un compte, ton équipe est sauvegardée en ligne et tu la retrouves sur n'importe quel téléphone.</p>`;
  if (authView === "forgot") return `<div class="card onb"><h2>Mot de passe oublié</h2>
      <p style="margin:0">Tape l'email de ton compte : on t'envoie un lien pour choisir un nouveau mot de passe.</p>
      <div class="form">${field("auEmail", "Email", "email", "email", authEmail)}</div>
      ${msgs()}<button class="btn primary big" id="auForgot"${busy}>Envoyer le lien</button>
      <button class="btn" data-auth="login" style="align-self:flex-start">← Retour</button></div>`;
  if (authView === "signup") return `<div class="card onb">${intro}${tabs}
      <div class="form">${field("auEmail", "Email", "email", "email", authEmail)}<span></span>
        ${field("auPw", "Mot de passe (8 caractères min.)", "password", "new-password")}${field("auPw2", "Retape le mot de passe", "password", "new-password")}</div>
      ${msgs()}<button class="btn go big" id="auSignup"${busy}>${authBusy ? "Un instant…" : "Créer mon compte"}</button>
      <p class="muted" style="margin:0;font-size:.85rem">Tes données servent seulement à faire marcher l'app. Elles sont stockées en Europe et ne sont jamais revendues ni montrées aux joueurs. En créant ton compte, tu acceptes la politique de confidentialité ci-dessous.</p>
      ${privacyDetails()}
      ${later}${contactLine("margin:0")}<p class="muted" style="margin:0;font-size:.8rem">${COPYRIGHT}</p></div>`;
  return `<div class="card onb">${intro}${tabs}
      <div class="form">${field("auEmail", "Email", "email", "email", authEmail)}${field("auPw", "Mot de passe", "password", "current-password")}</div>
      ${msgs()}<button class="btn go big" id="auLogin"${busy}>${authBusy ? "Un instant…" : "Me connecter"}</button>
      <button class="btn" data-auth="forgot" style="align-self:flex-start">Mot de passe oublié ?</button>
      ${authMsg && /pas encore confirmé/.test(authMsg) ? `<button class="btn" id="auResend" style="align-self:flex-start"${busy}>Renvoyer l'email de confirmation</button>` : ""}
      ${later}${contactLine("margin:0")}<p class="muted" style="margin:0;font-size:.8rem">${COPYRIGHT}</p></div>`;
}
function bindAccount(){
  const v = $("#view"), enter = (id, fn) => v.querySelectorAll("input").forEach(el => el.addEventListener("keydown", e => { if (e.key === "Enter" && $("#" + id)) fn(); }));
  v.querySelectorAll("[data-auth]").forEach(b => b.addEventListener("click", () => { authEmail = val("auEmail") || authEmail; authView = b.dataset.auth; authMsg = ""; authOk = ""; render(); }));
  $("#auSignup")?.addEventListener("click", doSignup); enter("auSignup", doSignup);
  $("#auLogin")?.addEventListener("click", doLogin); enter("auLogin", doLogin);
  $("#auForgot")?.addEventListener("click", doForgot); enter("auForgot", doForgot);
  $("#auNewPw")?.addEventListener("click", doNewPassword); enter("auNewPw", doNewPassword);
  $("#auResend")?.addEventListener("click", doResend);
  $("#auToLogin")?.addEventListener("click", () => { authView = "login"; authMsg = ""; authOk = ""; render(); });
  $("#auDone")?.addEventListener("click", () => { authView = "login"; authOpen = false; render(); });
  $("#auLater")?.addEventListener("click", () => { authOpen = false; skipAccount = true; authMsg = ""; render(); });
  $("#keepCloud")?.addEventListener("click", () => chooseData(false));
  $("#keepPhone")?.addEventListener("click", () => chooseData(true));
}
// Carte « Mon compte » dans Réglages.
function accountCard(){
  if (!CLOUD_ON) return "";
  if (!user) return `<div class="card"><h2>Mon compte</h2>
    <p class="muted" style="margin:0 0 10px;font-size:.92rem">Pas de compte : tout est seulement sur ce téléphone. Avec un compte, ton équipe, tes matchs et ta saison sont sauvegardés en ligne et tu les retrouves sur un autre téléphone.</p>
    <div class="row"><button class="btn primary" id="accSignup">Créer mon compte</button><button class="btn" id="accLogin">Me connecter</button></div></div>`;
  return `<div class="card"><h2>Mon compte</h2>
    <p style="margin:0 0 6px">Connecté avec <b>${esc(user.email)}</b></p>
    <p class="muted" style="margin:0 0 10px;font-size:.92rem">Ton équipe, tes matchs et ta saison sont sauvegardés en ligne automatiquement. Sans réseau, tout reste gardé sur ce téléphone et part dès que le réseau revient. Se déconnecter efface les données de ce téléphone (elles restent dans ton compte).</p>
    ${logoutArmed ? `<div class="warn" style="margin-bottom:10px">Des changements ne sont pas encore en ligne (pas de réseau ?). Si tu te déconnectes maintenant, ils seront perdus. Touche encore pour confirmer.</div>` : ""}
    <button class="btn" id="accOut">${logoutArmed ? "Me déconnecter quand même" : "Me déconnecter"}</button></div>`;
}
// Politique de confidentialité, dépliable (inscription et Réglages).
function privacyDetails(style = "margin:0"){
  const P = t => `<p style="margin:0 0 8px">${t}</p>`;
  return `<details class="priv" style="${style}"><summary>Politique de confidentialité</summary><div class="priv-b" style="font-size:.88rem;margin-top:8px">
    ${P(`<b>Qui est responsable</b> : Geoffrey Ducobu, créateur de StickMate. Contact : <a href="mailto:${REPORT_TO}">${REPORT_TO}</a>.`)}
    ${P(`<b>Ce qui est gardé</b> : ton email et ton mot de passe (chiffré, illisible même pour nous), ton profil (prénom, nom, club, équipe), tes joueurs (nom, postes, notes, minutes), tes matchs et ta saison. Sans compte, tout reste seulement sur ton téléphone.`)}
    ${P(`<b>Pourquoi</b> : uniquement pour faire marcher l'app que tu utilises (sauvegarde, retrouver ton équipe sur un autre téléphone, chrono partagé avec ton adjoint). Pas de pub, pas de revente, pas de traceurs publicitaires.`)}
    ${P(`<b>Où</b> : chez Supabase, sur des serveurs en Europe (Francfort). L'app elle-même est servie par GitHub Pages.`)}
    ${P(`<b>Combien de temps</b> : tant que ton compte existe. « Supprimer mon compte » (Réglages) efface tout.`)}
    ${P(`<b>Tes joueurs</b> : tu es responsable de ce que tu notes sur eux. Ils sont souvent mineurs : n'indique que ce qui sert au banc (un prénom suffit). Ils ne voient jamais les notes ni les temps visés.`)}
    ${P(`<b>Tes droits</b> : voir et télécharger tes données, les corriger, les supprimer (tout est dans Réglages), ou nous écrire. Tu peux aussi te plaindre à l'Autorité de protection des données (autoriteprotectiondonnees.be).`)}
    <p class="muted" style="margin:0">Mise à jour : 23 octobre 2026.</p></div></details>`;
}
// Carte « Tes données » (RGPD) : ce qui est gardé, où, et suppression du compte.
let deleteArmed = false, deleteMsg = "";
function dataCard(){
  if (!CLOUD_ON || !user) return "";
  return `<div class="card"><h2>Tes données</h2>
    <p style="margin:0 0 8px;font-size:.95rem"><b>Ce qui est gardé</b> : ton email, ton profil (prénom, nom, club, équipe), tes joueurs (nom, postes, notes, minutes), tes matchs et ta saison.</p>
    <p style="margin:0 0 8px;font-size:.95rem"><b>Où</b> : chez Supabase, sur des serveurs en Europe (Francfort). Ton mot de passe est chiffré : personne ne peut le lire, même pas nous.</p>
    <p style="margin:0 0 8px;font-size:.95rem"><b>Qui les voit</b> : toi seul. Ton adjoint, s'il a le lien du chrono, ne voit que le match (noms, postes, changements), jamais les notes ni les temps visés. Rien n'est revendu ni utilisé pour de la pub.</p>
    <p class="muted" style="margin:0 0 12px;font-size:.88rem">Tes joueurs sont souvent mineurs : n'indique que ce qui sert au banc (un prénom suffit).</p>
    <p class="muted" style="margin:0 0 12px;font-size:.88rem">Une question sur tes données, ou envie qu'on corrige quelque chose ? Écris à <a href="mailto:${REPORT_TO}">${REPORT_TO}</a>.</p>
    <div class="row"><button class="btn" id="dataDl">⬇ Télécharger mes données</button></div>
    <div class="set" style="margin-top:12px;border-top:1px solid var(--rule)"><div><b>Supprimer mon compte</b><div class="muted">Efface pour de bon ton compte et tout ce qu'il contient, en ligne et sur ce téléphone. Impossible de revenir en arrière.</div></div></div>
    ${deleteArmed ? `<div class="warn" style="margin-bottom:10px">Sûr ? Ton équipe, tes matchs et ta saison seront effacés pour toujours. Pense à télécharger tes données avant.</div>` : ""}
    ${deleteMsg ? `<div class="warn" style="margin-bottom:10px">${esc(deleteMsg)}</div>` : ""}
    <div class="row"><button class="btn${deleteArmed ? " danger" : ""}" id="accDel">${deleteArmed ? "Oui, supprimer définitivement" : "Supprimer mon compte"}</button>${deleteArmed ? `<button class="btn" id="accDelNo">Annuler</button>` : ""}</div></div>`;
}
async function deleteAccount(){
  if (!deleteArmed) { deleteArmed = true; deleteMsg = ""; render(); return; }
  if (!navigator.onLine) { deleteMsg = "Pas de réseau : il en faut pour supprimer ton compte."; render(); return; }
  const {error} = await sb.rpc("delete_my_account");
  if (error) { deleteMsg = "La suppression a échoué (" + (error.message || "erreur") + "). Réessaie."; render(); return; }
  try { await sb.auth.signOut({scope:"local"}); } catch(e){}
  try { localStorage.removeItem("banc-auth"); } catch(e){}
  user = null; deleteArmed = false; deleteMsg = ""; clearLocal();
  authView = "signup"; authOpen = false; authOk = ""; authMsg = ""; mode = "home"; render(); window.scrollTo(0, 0);
}
function bindAccountCard(){
  $("#dataDl")?.addEventListener("click", exportBackup);
  $("#accDel")?.addEventListener("click", deleteAccount);
  $("#accDelNo")?.addEventListener("click", () => { deleteArmed = false; render(); });
  $("#accSignup")?.addEventListener("click", () => openAuth("signup"));
  $("#accLogin")?.addEventListener("click", () => openAuth("login"));
  $("#accOut")?.addEventListener("click", logout);
}
// Carte d'Accueil pour inviter à créer un compte.
function accountNudge(){
  if (!CLOUD_ON || user || !authReady) return "";
  return `<div class="card"><h2>Sauvegarde en ligne</h2>
    <p style="margin:0 0 12px">Crée ton compte pour ne jamais perdre ton équipe et la retrouver sur un autre téléphone. Tes données actuelles y seront copiées.</p>
    <div class="row"><button class="btn primary" id="nudgeSignup">Créer mon compte</button><button class="btn" id="nudgeLogin">J'ai déjà un compte</button></div></div>`;
}
function bindAccountNudge(){
  $("#nudgeSignup")?.addEventListener("click", () => openAuth("signup"));
  $("#nudgeLogin")?.addEventListener("click", () => openAuth("login"));
}
