// Aide (page Réglages) : guide pas à pas et questions fréquentes.
// Textes simples, au tutoiement. Un bouton « Y aller » ouvre l'écran dont parle l'étape (data-goto).
// Rappel : nulle part on ne dit qu'un joueur peut voir notes ou temps de jeu (ils restent dans Coach).

const GUIDE = [
  {t: "Démarrer", steps: [
    `<b>Crée ton compte</b> à l'ouverture de l'app (e-mail et mot de passe). Tes données sont alors sauvegardées en ligne et tu les retrouves sur n'importe quel téléphone. Tu peux aussi « Continuer sans compte » : tout reste alors sur ce téléphone.`,
    `<b>Remplis ton profil</b> : prénom, club et équipe. Ils s'affichent en haut de l'app.`,
    `<b>Choisis un code de verrouillage</b> (4 ou 6 chiffres). Il protège la page Coach : les notes et les temps de jeu de tes joueurs restent pour toi. Accueil et Match restent ouverts.`,
    `<b>Installe l'app sur ton écran d'accueil</b> pour l'ouvrir comme une vraie app, même sans réseau. Sur iPhone : dans Safari, bouton Partager, puis « Sur l'écran d'accueil ». Sur Android : dans Chrome, menu ⋮, puis « Installer l'application ».`,
  ], go: [["settings:prof", "Mon profil"], ["settings:pin", "Code de verrouillage"]]},
  {t: "Ton effectif", intro: `Tout se passe dans <b>Coach › Effectif</b>.`, steps: [
    `<b>Choisis ton système de jeu</b> (3-2-3-2, 4-3-3, 4-4-2, 4-2-3-1…). Les noms des places suivent ce système.`,
    `<b>Ajoute tes joueurs</b> avec « + Ajouter un joueur » et écris leur nom.`,
    `<b>Donne-leur leurs places</b> avec « + poste », dans l'ordre de préférence : la 1re est sa meilleure place. Touche une place pour la retirer. Les places du centre qui vont par deux (ou trois) ne sont pas séparées : « Milieu déf. », « Back central », « Avant ». Seule la compo de départ montre le côté exact.`,
    `<b>Corners</b> : touche D pour un donneur, B pour un bloqueur. Le plan garde toujours un donneur et un bloqueur sur le terrain.`,
    `Tu changes de système plus tard ? L'app te propose de garder les places adaptées au nouveau système (à vérifier ensuite) ou de tout effacer.`,
  ], go: [["coach:squad", "Effectif"]]},
  {t: "Préparer un match", intro: `Tout se passe dans <b>Coach › Match</b>, étape par étape. Pour un autre match, touche « Mes matchs », puis « + Nouveau match ».`, steps: [
    `<b>Adversaire et date.</b>`,
    `<b>Présents</b> : coche les joueurs qui sont là.`,
    `<b>Compo de départ</b> : choisis qui commence à chaque place.`,
    `<b>Temps de jeu</b>, quatre façons de faire :<br>• <b>Plan automatique</b> : tu donnes des minutes à chaque joueur (0 = il reste sur le banc). Le compteur te dit combien il en reste à distribuer.<br>• <b>Égal pour tous</b> : tous les joueurs de champ jouent autant.<br>• <b>Égal par ligne</b> : chaque ligne (défense, milieu, attaque) partage son temps.<br>• <b>Plan manuel</b> : tu écris toi-même chaque changement.`,
    `<b>Règles de rotation</b> : quand on peut changer, temps minimum et maximum sur le terrain, temps maximum sur le banc… Règle d'abord le « quart de base », puis seulement les quarts qui sont différents. Dans un quart, tu peux aussi choisir des joueurs qui ne sortent pas.`,
    `<b>Génère le plan</b>. S'il ne te plaît pas, touche « Autre version ». Quand il est bon, touche <b>« Utiliser pour le match »</b>.`,
    `<b>Plan B (PDF)</b> : télécharge-le et imprime-le, au cas où le téléphone lâche pendant le match.`,
  ], go: [["coach:match:pres", "Présents"], ["coach:match:time", "Temps de jeu"], ["coach:match:rules", "Règles"]]},
  {t: "Pendant le match", steps: [
    `Ouvre la page <b>Match</b> et touche <b>« ▶ Démarrer »</b> au coup d'envoi. « ❚❚ Pause » arrête le chrono.`,
    `Avant chaque changement, l'app te prévient (son et écran) : <b>« Préparez-vous »</b>, puis <b>« Changement maintenant »</b>. La carte dit qui entre, qui sort et à quelle place. Une ligne orange signale un joueur qui change de place sur le terrain.`,
    `La carte passe toute seule au changement suivant. Les onglets en bas montrent les changements du quart, le terrain et le score.`,
    `À la fin d'un quart, touche « Lancer le quart suivant ». Les changements de la pause s'affichent pendant la pause.`,
    `<b>⚠ Imprévu</b> : blessure, carton vert (2'), jaune (5' ou 10') ou rouge. Le plan se recalcule tout seul. Un blessé qui revient : touche « Fin de blessure ».`,
    `<b>↔ Hors plan</b> : un changement que tu décides toi-même. Le plan se recalcule à partir de là.`,
    `Une erreur ? « ↶ Annuler le dernier imprévu ».`,
    `<b>Outils ⋯</b> : vue de loin (gros chiffres), régler le chrono (±1 min, quart précédent ou suivant), Match à 0, et 📲 Adjoint pour partager le chrono avec un QR code.`,
  ], go: [["match", "Page Match"]]},
  {t: "Après le match", steps: [
    `À la fin du dernier quart, le match s'enregistre tout seul dans la saison.`,
    `Touche <b>« Noter les joueurs »</b> pour donner une note sur 10 à chacun. Ces notes restent dans Coach, protégées par ton code.`,
    `<b>Coach › Saison</b> : temps de jeu, buts, cartons et note moyenne de chaque joueur sur toute la saison.`,
    `<b>Exporter la saison (PDF)</b>, en bas de Coach › Saison : un récapitulatif pour le club ou ton staff. Les notes n'y sont que si tu coches « Avec les notes ».`,
  ], go: [["coach:season", "Saison"]]},
  {t: "Tes données", steps: [
    `<b>Avec un compte</b>, tout est sauvegardé en ligne : connecte-toi sur un autre téléphone et tu retrouves tout.`,
    `<b>Sans compte</b>, télécharge de temps en temps une sauvegarde (Réglages › Sauvegarde). Pour changer de téléphone, charge ce fichier sur le nouveau.`,
    `<b>Plusieurs équipes</b> : dans Coach, « + Nouvelle équipe ». Chaque équipe a son effectif, son système, ses matchs et sa saison.`,
  ], go: [["settings:bk", "Sauvegarde"]]},
];

const FAQ = [
  ["Pourquoi je ne peux pas générer le plan ?", `En « Plan automatique », toutes les minutes doivent être distribuées : regarde le compteur au-dessus des joueurs. Vérifie aussi qu'aucun joueur de la compo de départ n'a 0 minute.`],
  ["C'est quoi l'encadré jaune après avoir généré le plan ?", `Ce sont les règles que le plan n'a pas pu tenir, avec la vraie valeur entre parenthèses. Par exemple : « plus de 8' sur le banc dans le Q1 (10') ». Essaie « Autre version », ou assouplis un peu une règle ou des minutes.`],
  ["Les joueurs peuvent-ils voir leurs notes ou leur temps de jeu ?", `Non. Les notes et les temps de jeu sont seulement dans la page Coach, protégée par ton code. Les écrans du match et le téléphone de l'adjoint ne les montrent pas.`],
  ["Je n'entends pas l'alerte sur iPhone.", `Le bouton silencieux de l'iPhone coupe le son de l'app. Vérifie aussi que le son est activé dans Réglages (bouton « Tester »). Le vibreur ne marche pas sur iPhone : c'est une limite d'Apple.`],
  ["Mon chrono est en avance ou en retard.", `Touche −10 s ou +10 s sous le chrono. Dans « Outils ⋯ », tu as aussi −1 min, +1 min, « Quart à 0 » et quart précédent ou suivant.`],
  ["Comment recommencer un match ?", `Match › Outils ⋯ › « Match à 0 » (touche deux fois). Le chrono repart de zéro et le plan revient comme avant les imprévus. Si le match était déjà enregistré dans la saison, il en est retiré.`],
  ["Un joueur arrive en retard ou doit partir.", `Avant le match : décoche-le dans « Présents » et génère un nouveau plan. Pendant le match : utilise « ↔ Hors plan » pour le faire entrer ou sortir, ou « ⚠ Imprévu » s'il ne peut plus jouer.`],
  ["Un joueur blessé peut rejouer.", `Touche « Fin de blessure » sur la bannière du blessé. Il revient sur le banc et le plan lui redonne du temps.`],
  ["Mon adjoint peut-il suivre le match sur son téléphone ?", `Oui, s'il a du réseau et si tu as un compte en ligne. Match › Outils ⋯ › 📲 Adjoint : il scanne le QR code, sans créer de compte. Il voit le chrono et les changements.`],
  ["Comment changer de système de jeu ?", `Coach › Effectif › Système de jeu. L'app te demande si tu veux garder les places adaptées ou tout effacer. Un match déjà commencé ou enregistré garde son système.`],
  ["Je veux qu'un joueur ne sorte pas pendant un quart.", `Coach › Match › Règles de rotation : touche le quart (Q1 à Q4), puis le joueur dans « Ne sortent pas ». Il reste sur le terrain tout ce quart. S'il était sur le banc, il rentre à la pause juste avant. Si tu le sors toi-même avec « ↔ Hors plan », la règle ne compte plus pour lui jusqu'à la fin de ce quart.`],
  ["Trop de joueurs changent de poste à chaque changement.", `Coach › Match › Règles de rotation, partie « Pour tout le match » › « Changements de poste sur le terrain » : c'est le nombre maximum de joueurs déjà sur le terrain qui changent de place pour chaque joueur qui entre (par défaut 3). Exemple à 1 : X entre pour Y et Z glisse à la place de Y, c'est permis. Si B entre pour C en même temps, il a droit lui aussi à 1 changement de poste. Mets 0 : celui qui entre prend toujours la place de celui qui sort. Plus le chiffre est bas, moins le plan a de solutions, il peut alors moins bien respecter les minutes.`],
  ["Pourquoi je ne peux pas choisir « Milieu déf. gauche » pour un joueur ?", `Dans l'effectif, les places du centre qui vont par deux ou trois sont regroupées : « Milieu déf. », « Back central », « Avant ». Le joueur peut jouer d'un côté ou de l'autre, le plan choisit. Le plan et l'écran du match disent aussi « Milieu déf. », sans le côté. Seule la compo de départ le montre : tu y places toi-même chaque joueur à gauche ou à droite.`],
  ["On joue en 2 mi-temps, pas en 4 quarts.", `Coach › Match › Règles de rotation › « Le match se joue en » : choisis « 2 mi-temps ».`],
  ["L'app marche-t-elle sans réseau ?", `Oui : une fois ouverte une première fois, elle marche sans réseau. Il faut du réseau seulement pour la sauvegarde en ligne et pour le chrono de l'adjoint.`],
  ["Je change de téléphone.", `Avec un compte, connecte-toi simplement sur le nouveau téléphone. Sans compte, télécharge une sauvegarde sur l'ancien (Réglages › Sauvegarde) et charge-la sur le nouveau.`],
  ["À quoi sert le Plan B ?", `C'est ton plan de rotation en PDF, à imprimer. Si le téléphone lâche pendant le match, tu as tout sur papier. Il se télécharge dans Coach › Match, partie « Plan de rotation ».`],
  ["Comment supprimer mes données ?", `Réglages › Compte en ligne : « Supprimer mon compte » efface tout ce qui est en ligne. Sans compte, tes données sont seulement sur ce téléphone.`],
];

let helpOpen = null; // "guide" | "faq" | null
function helpCard(){
  if (helpOpen === "guide") return `<div class="card help"><div class="row" style="justify-content:space-between"><h2 style="margin:0">Guide pas à pas</h2><button class="btn small" data-help="">Fermer</button></div>
    <p class="muted" style="margin:6px 0 0;font-size:.9rem">Touche un chapitre pour l'ouvrir.</p>
    ${GUIDE.map((c, i) => `<details class="mdet"><summary>${i + 1}. ${esc(c.t)}</summary>
      ${c.intro ? `<p style="margin:8px 0 0">${c.intro}</p>` : ""}
      <ol class="steps" style="margin-top:8px">${c.steps.map(s => `<li>${s}</li>`).join("")}</ol>
      <div class="row" style="margin-top:10px;flex-wrap:wrap;gap:8px">${c.go.map(([g, l]) => `<button class="btn small" data-goto="${g}">Y aller : ${esc(l)} ›</button>`).join("")}</div></details>`).join("")}
  </div>`;
  if (helpOpen === "faq") return `<div class="card help"><div class="row" style="justify-content:space-between"><h2 style="margin:0">Questions fréquentes</h2><button class="btn small" data-help="">Fermer</button></div>
    ${FAQ.map(([q, a]) => `<details class="mdet"><summary>${esc(q)}</summary><p style="margin:8px 0 0">${a}</p></details>`).join("")}
  </div>`;
  return "";
}
function helpRows(){
  return `<div class="set"><div><b>Guide pas à pas</b><div class="muted">De la création de l'équipe à la fin du match.</div></div><button class="btn small" data-help="guide">Ouvrir</button></div>
    <div class="set"><div><b>Questions fréquentes</b><div class="muted">Les réponses aux questions qu'on se pose souvent.</div></div><button class="btn small" data-help="faq">Ouvrir</button></div>`;
}
function bindHelp(){
  document.querySelectorAll("[data-help]").forEach(b => b.addEventListener("click", () => { helpOpen = b.dataset.help || null; render(); window.scrollTo(0, 0); }));
  document.querySelectorAll("[data-goto]").forEach(b => b.addEventListener("click", () => {
    const [m, a, s] = b.dataset.goto.split(":");
    helpOpen = null;
    if (m === "coach") { coachTab = a; if (s) coachStep = s; }
    if (m === "settings") setOpen = a === "help" ? null : a || null;
    if (m === mode) { render(); window.scrollTo(0, 0); } else goTo(m);
    if (m === "settings" && a === "help") { helpOpen = s; render(); window.scrollTo(0, 0); } // goTo remet helpOpen à zéro
  }));
}

// Accueil : « Premiers pas » pour un nouveau coach. Chaque étape se coche toute seule quand elle est faite.
function startSteps(){
  const ids = PRESETS[S.preset].map(p => p[0]);
  return [
    [!!S.profile?.first, "Remplis ton profil", "Ton prénom, ton club et ton équipe.", "settings:prof"],
    [!!S.pin, "Choisis ton code de verrouillage", "Il garde les notes et les temps de jeu pour toi.", "settings:pin"],
    [S.squad.length >= ids.length, "Ajoute tes joueurs", `Au moins ${ids.length} joueurs, et choisis ton système de jeu.`, "coach:squad"],
    [S.squad.length > 0 && S.squad.every(p => (p.pos || []).length), "Donne une place à chaque joueur", "Dans l'ordre de préférence, avec D et B pour les corners.", "coach:squad"],
    [ids.every(q => S.lineup[q]), "Prépare ton premier match", "Présents, compo de départ et temps de jeu.", "coach:match:compo"],
    [!!S.plan, "Génère le plan de rotation", "Puis touche « Utiliser pour le match ».", "coach:match:time"],
  ].map(([done, t, d, go]) => ({done, t, d, go}));
}
function startCard(){
  const st = startSteps(), left = st.filter(s => !s.done).length;
  if (!left || prefs.hideStart) return `<div class="card"><div class="row" style="justify-content:space-between;flex-wrap:wrap;gap:8px"><b>Besoin d'aide ?</b><div class="row" style="gap:8px"><button class="btn small" data-goto="settings:help:guide">Guide pas à pas</button><button class="btn small" data-goto="settings:help:faq">Questions fréquentes</button></div></div></div>`;
  return `<div class="card"><div class="row" style="justify-content:space-between"><h2 style="margin:0">Premiers pas</h2><span class="muted" style="font-size:.9rem">${st.length - left} sur ${st.length}</span></div>
    <ol class="startl">${st.map(s => `<li class="${s.done ? "dn" : ""}"><span class="sk" aria-hidden="true">${s.done ? "✓" : ""}</span><span class="st"><b>${esc(s.t)}</b><span class="muted">${esc(s.d)}</span></span>${s.done ? "" : `<button class="btn small" data-goto="${s.go}">Y aller ›</button>`}</li>`).join("")}</ol>
    <div class="row" style="margin-top:10px;justify-content:space-between;flex-wrap:wrap;gap:8px"><button class="btn small" data-goto="settings:help:guide">Guide pas à pas</button><button class="btn small" id="hideStart">Masquer</button></div></div>`;
}
