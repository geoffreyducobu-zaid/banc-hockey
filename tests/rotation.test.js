// Tests du moteur de rotation : on génère un plan pour une équipe d'exemple
// (16 joueurs présents, 3-2-3-2) et on vérifie que les règles du coach sont respectées.
// Lancer avec : npm test
const test = require("node:test");
const assert = require("node:assert");
const R = require("../rotation.js");
const ex = require("./equipe-exemple.json");

// Lignes de chaque poste du 3-2-3-2 (même table que PRESETS dans app.js).
const LINE = {G:"gk","1":"def","2":"def","3":"def","4":"dm","5":"dm","6":"mid","7":"mid","8":"mid","9":"att","10":"att"};
const rules = ex.rules, END = rules.quarters * rules.qlen, EPS = 1e-6;
const present = ex.squad.filter(p => p.present);
const minStintOf = p => ({def:rules.minDef, dm:rules.minMid, mid:rules.minMid, att:rules.minAtt})[LINE[p.pos[0]]] || 0;
const { targets } = R.targetsFromNotes(present.map(p => ({name:p.name, note:p.note, override:p.minutes || 0, field:p.pos.some(q => q !== "G")})), 10, END);
rules.minStint = Math.min(rules.minDef, rules.minMid, rules.minAtt);
const plan = R.buildPlan({
  positions: Object.keys(LINE).map(id => ({id, gk: id === "G"})),
  players: present.map(p => ({name:p.name, pos:p.pos, target:targets[p.name], locked: p.note >= 5 && !p.minutes, oneBlock: p.note >= 5, maxStint:p.maxStint || 0, roles:p.roles || [], minFirst:p.minFirst || 0, minStint:minStintOf(p)})),
  lineup: ex.lineup, rules, seed: 4242, iters: 300, saIters: 40000, chains: 4,
});
const byName = Object.fromEntries(present.map(p => [p.name, p]));

test("le plan est généré sans alerte", () => {
  assert.ok(!plan.error, String(plan.warnings));
  assert.deepStrictEqual(plan.warnings, []);
});

test("toujours 11 joueurs, chacun à un poste qu'il sait jouer ou à son poste de départ", () => {
  for (const s of plan.segs) {
    assert.strictEqual(Object.keys(s.on).length, 11);
    assert.strictEqual(new Set(Object.values(s.on)).size, 11);
    for (const [p, q] of Object.entries(s.on)) assert.ok(byName[p].pos.includes(q) || ex.lineup[q] === p, `${p} en ${q}`);
  }
});

test("changements seulement dans les fenêtres autorisées, max 3 entrées à la fois", () => {
  for (const c of plan.changes) {
    const q = Math.floor(c.t / rules.qlen + EPS), m = c.t - q * rules.qlen;
    const atBreak = Math.abs(m) < EPS;
    const from = q === 0 ? rules.firstChange : rules.startBlock;
    assert.ok(atBreak || (m >= from - EPS && m <= rules.qlen - rules.endBlock + EPS), `changement à ${c.t}`);
    assert.ok(c.ins.length <= rules.maxEntries, `${c.ins.length} entrées à ${c.t}`);
  }
});

// Plus long morceau d'un passage sans pause entre quarts (la pause remet à zéro le maximum d'affilée).
const run = (a, b) => { let m = 0, x = a; while (x < b - EPS) { const e = Math.min(b, (Math.floor((x + EPS) / rules.qlen) + 1) * rules.qlen); m = Math.max(m, e - x); x = e; } return m; };
test("passages entre le minimum de la ligne et le maximum", () => {
  for (const [p, iv] of Object.entries(plan.intervals)) {
    const pl = byName[p]; if (pl.note >= 5) continue;
    const max = pl.maxStint || rules.maxStint;
    for (const [a, b] of iv) {
      if (b < END - EPS) assert.ok(b - a >= minStintOf(pl) - EPS, `${p} : passage de ${b - a}'`);
      assert.ok(run(a, b) <= max + EPS, `${p} : ${run(a, b)}' d'affilée`);
    }
  }
});

test("toujours un donneur (D) et un bloqueur (B) sur le terrain", () => {
  for (const s of plan.segs) for (const r of ["D", "B"])
    assert.ok(Object.keys(s.on).some(p => (byName[p].roles || []).includes(r)), `pas de ${r} de ${s.a} à ${s.b}`);
});

test("temps de jeu proche du temps visé (2'30 max d'écart)", () => {
  for (const p of Object.keys(plan.played)) assert.ok(Math.abs(plan.played[p] - plan.targets[p]) <= 2.5, `${p} : ${plan.played[p]} au lieu de ${plan.targets[p]}`);
});

// ---------- blessure en cours de match ----------
const positions = Object.keys(LINE).map(id => ({id, gk: id === "G"}));
const players = present.map(p => ({name:p.name, pos:p.pos, target:targets[p.name], locked: p.note >= 5 && !p.minutes, oneBlock: p.note >= 5, maxStint:p.maxStint || 0, roles:p.roles || [], minStint:minStintOf(p)}));
const segAt = (pl, t) => pl.segs.find(s => s.a <= t + EPS && t < s.b - EPS);
const TB = 24; // Q2, 6'30
const hurt = Object.keys(segAt(plan, TB).on).find(n => segAt(plan, TB).on[n] === "10"); // l'avant droit
const hurtPos = segAt(plan, TB).on[hurt];
const sub = present.find(p => p.pos.includes(hurtPos) && !(p.name in segAt(plan, TB).on)).name;
const afterInjury = R.replan(plan, {T:TB, positions, players, rules, out:[hurt], vacate:[], adjust:{}, enter:{name:sub, pos:hurtPos}, seed:3, saIters:8000});

test("blessure : le remplaçant choisi entre tout de suite au poste du blessé", () => {
  assert.ok(!afterInjury.error, String(afterInjury.warnings));
  assert.strictEqual(segAt(afterInjury, TB).on[sub], hurtPos);
  assert.ok(!(hurt in segAt(afterInjury, TB).on));
});

test("blessure : le blessé ne rejoue plus, 11 joueurs à des postes qu'ils connaissent", () => {
  for (const s of afterInjury.segs.filter(s => s.a >= TB - EPS)) {
    assert.ok(!(hurt in s.on), `${hurt} sur le terrain à ${s.a}`);
    assert.strictEqual(Object.keys(s.on).length, 11);
    for (const [p, q] of Object.entries(s.on)) assert.ok(byName[p].pos.includes(q) || ex.lineup[q] === p, `${p} en ${q}`);
  }
});

test("fin de blessure : le joueur revient et rejoue plus tard", () => {
  const TR = 40;
  const back = R.replan(afterInjury, {T:TR, positions, players, rules, out:[], vacate:[], adjust:{}, seed:5, saIters:8000});
  assert.ok(!back.error, String(back.warnings));
  assert.ok(back.segs.some(s => s.a >= TR - EPS && hurt in s.on), `${hurt} ne rejoue pas`);
});

test("blessure : un remplaçant hors poste prend un poste qu'il connaît, un joueur du terrain glisse au poste du blessé", () => {
  const on = segAt(plan, TB).on;
  // On fabrique le cas : un joueur du banc qui ne joue pas au poste du blessé,
  // et un joueur du terrain qui connaît à la fois son propre poste et celui du blessé.
  const cand = players.find(p => !(p.name in on) && !p.pos.includes(hurtPos) && !p.pos.includes("G"));
  const mover = Object.keys(on).find(n => n !== hurt && on[n] !== "G" && on[n] !== hurtPos);
  const pl = players.map(p => p.name === cand.name ? {...p, pos:[...p.pos, on[mover]]} : p.name === mover ? {...p, pos:[...p.pos, hurtPos]} : p);
  const res = R.replan(plan, {T:TB, positions, players:pl, rules, out:[hurt], vacate:[], adjust:{}, enter:{name:cand.name, pos:null}, seed:3, saIters:8000});
  assert.ok(!res.error, String(res.warnings));
  const s = segAt(res, TB).on;
  assert.ok(cand.name in s, `${cand.name} n'entre pas`);
  assert.notStrictEqual(s[cand.name], hurtPos, `${cand.name} joue hors poste`);
  assert.ok(pl.find(p => p.name === cand.name).pos.includes(s[cand.name]), `${cand.name} en ${s[cand.name]}`);
  const ch = res.changes.find(c => Math.abs(c.t - TB) < EPS);
  assert.ok(ch && ch.moves.length >= 1, "aucune réorganisation annoncée");
});

test("temps égal pour tous : même temps pour les joueurs de champ, minutes fixées respectées", () => {
  const P = [{name:"G", field:false}, {name:"A", field:true, group:"all"}, {name:"B", field:true, group:"all"}, {name:"C", field:true, group:"all", override:20}];
  const t = R.targetsEqual(P, {all:2}, 70).targets;
  assert.strictEqual(t.G, 0);
  assert.strictEqual(t.C, 20);
  assert.strictEqual(t.A, 60);
  assert.strictEqual(t.B, 60);
});

test("temps égal par ligne : chaque ligne partage ses postes, jamais plus que le match", () => {
  const P = [["D1","def"],["D2","def"],["D3","def"],["D4","def"],["M1","mid"],["M2","mid"],["A1","att"]].map(([name, group]) => ({name, field:true, group}));
  const t = R.targetsEqual(P, {def:3, mid:2, att:2}, 70).targets;
  assert.strictEqual(t.D1, 52.5);
  assert.strictEqual(t.M1, 70);
  assert.strictEqual(t.A1, 70);
});

// ---------- règles par période (quart ou mi-temps) ----------
const inWindow = (r, t) => {
  const q = Math.min(r.quarters - 1, Math.floor(t / r.qlen + EPS)), m = t - q * r.qlen;
  if (Math.abs(m) < EPS) return q > 0 && R.rq(r, q, "breakChanges");
  return m >= R.rq(r, q, "startBlock") - EPS && m <= r.qlen - R.rq(r, q, "endBlock") + EPS;
};
const planWith = r => R.buildPlan({positions, players, lineup: ex.lineup, rules: r, seed: 4242, iters: 150, saIters: 25000, chains: 2});

test("ancien format : le 1er changement du Q1 devient une exception du Q1", () => {
  const m = R.migrateRules({...rules, firstChange: 6, startBlock: 4});
  assert.deepStrictEqual(m.per, {0: {startBlock: 6}});
  assert.strictEqual(R.rq(m, 0, "startBlock"), 6);
  assert.strictEqual(R.rq(m, 1, "startBlock"), 4);
  assert.deepStrictEqual(R.migrateRules({firstChange: 4, startBlock: 4}).per, {});
  assert.deepStrictEqual(R.migrateRules(m).per, {0: {startBlock: 6}}, "migrer deux fois ne change rien");
});

test("exceptions par quart : fenêtres, entrées max et pause respectées", () => {
  const r = R.migrateRules({...rules, per: {0: {startBlock: 6}, 2: {breakChanges: false}, 3: {endBlock: 6, maxEntries: 2}}});
  const times = R.changeTimes(r);
  assert.ok(!times.some(t => Math.abs(t - 2 * r.qlen) < EPS), "pas de changement à la pause avant le Q3");
  assert.ok(times.some(t => Math.abs(t - r.qlen) < EPS), "changement possible à la pause avant le Q2");
  assert.ok(!times.some(t => t > 3 * r.qlen + r.qlen - 6 + EPS), "rien dans les 6 dernières minutes du Q4");
  const pl = planWith(r);
  assert.ok(!pl.error, String(pl.warnings));
  for (const c of pl.changes) {
    assert.ok(inWindow(r, c.t), `changement à ${c.t}`);
    const q = Math.min(3, Math.floor(c.t / r.qlen + EPS));
    assert.ok(c.ins.length <= R.rq(r, q, "maxEntries"), `${c.ins.length} entrées à ${c.t}`);
  }
});

test("match en 2 mi-temps : 11 joueurs, changements dans les fenêtres, banc max par mi-temps", () => {
  const r = R.migrateRules({...rules, quarters: 2, qlen: 35, maxBench: 18, per: {0: {startBlock: 6}}});
  const pl = planWith(r);
  assert.ok(!pl.error, String(pl.warnings));
  for (const s of pl.segs) assert.strictEqual(Object.keys(s.on).length, 11);
  for (const c of pl.changes) assert.ok(inWindow(r, c.t), `changement à ${c.t}`);
  assert.strictEqual(pl.segs[pl.segs.length - 1].b, 70);
});

test("ancien format : le maximum d'affilée devient un maximum par ligne", () => {
  const m = R.migrateRules({maxStint: 20});
  assert.deepStrictEqual([m.maxDef, m.maxMid, m.maxAtt], [20, 20, 20]);
  assert.strictEqual(R.migrateRules({maxStint: 20, maxDef: 25}).maxDef, 25, "un réglage par ligne existant est gardé");
});

test("maximum d'affilée par ligne : chaque joueur respecte le maximum de sa ligne", () => {
  const maxL = {def: 14, dm: 18, mid: 18, att: 12};
  const pl = players.map(p => ({...p, maxStint: p.maxStint || maxL[LINE[p.pos[0]]] || 0}));
  const res = R.buildPlan({positions, players: pl, lineup: ex.lineup, rules, seed: 4242, iters: 150, saIters: 25000, chains: 2});
  assert.ok(!res.error, String(res.warnings));
  for (const p of pl) { if (p.oneBlock || !p.maxStint) continue;
    for (const [a, b] of res.intervals[p.name]) assert.ok(run(a, b) <= p.maxStint + EPS, `${p.name} : ${run(a, b)}' d'affilée (max ${p.maxStint}')`); }
});

// ---------- imprévus : les règles du coach tiennent après le recalcul ----------
const rulesQ = R.migrateRules({...rules, per: {0: {startBlock: 6}, 3: {endBlock: 5, maxEntries: 2}}, maxDef: 22, maxMid: 22, maxAtt: 18});
const playersL = players.map(p => ({...p, maxStint: p.maxStint || ({def: 22, dm: 22, mid: 22, att: 18})[LINE[p.pos[0]]] || 0}));
const planQ = R.buildPlan({positions, players: playersL, lineup: ex.lineup, rules: rulesQ, seed: 4242, iters: 200, saIters: 30000, chains: 3});
const hard = w => /hors des moments permis|en même temps|revient après|d'affilée/.test(w);
const fieldAt = (pl, t) => Object.keys(segAt(pl, t).on).filter(n => segAt(pl, t).on[n] !== "G" && !playersL.find(p => p.name === n).locked);

test("blessure : fenêtres par quart, entrées max, banc mini et passage max par ligne respectés", () => {
  // un poste que plusieurs joueurs connaissent (sinon la règle ne peut pas tenir : voir le message au coach)
  const T = 31, on = segAt(planQ, T).on, hurtP = fieldAt(planQ, T).find(n => ["6", "7", "8", "9", "10"].includes(on[n]));
  const subP = present.find(p => !(p.name in on) && p.pos.includes(on[hurtP]));
  const res = R.replan(planQ, {T, positions, players: playersL, rules: rulesQ, out: [hurtP], vacate: [], adjust: {}, enter: subP ? {name: subP.name, pos: on[hurtP]} : undefined, seed: 3, saIters: 20000});
  assert.ok(!res.error, String(res.warnings));
  assert.deepStrictEqual(res.warnings.filter(hard), []);
  for (const c of res.changes) if (c.t > T + EPS) assert.ok(inWindow(rulesQ, c.t), `changement à ${c.t}`);
});

test("carton jaune : à 10 pendant la carte, le joueur revient à la fin, les autres peuvent encore tourner", () => {
  const T = 24, T1 = 34, p = fieldAt(planQ, T)[1];
  const res = R.replan(planQ, {T, positions, players: playersL, rules: rulesQ, out: [], vacate: [], adjust: {[p]: -10}, freezeUntil: T1, freezeOut: [p], seed: 3, saIters: 20000});
  assert.ok(!res.error, String(res.warnings));
  for (const s of res.segs.filter(s => s.a >= T - EPS && s.b <= T1 + EPS)) { assert.ok(!(p in s.on), `${p} sur le terrain à ${s.a}`); assert.strictEqual(Object.keys(s.on).length, 10); }
  assert.ok(p in segAt(res, T1).on, `${p} ne revient pas à ${T1}`);
  for (const s of res.segs.filter(s => s.a >= T1 - EPS)) assert.strictEqual(Object.keys(s.on).length, 11);
  for (const c of res.changes) if (c.t > T + EPS && Math.abs(c.t - T1) > EPS) assert.ok(inWindow(rulesQ, c.t), `changement à ${c.t}`);
  assert.deepStrictEqual(res.warnings.filter(hard), []);
});

test("carton jaune 10' dans les 10 dernières minutes : pas de plantage", () => {
  const T = 63, p = fieldAt(planQ, T)[0];
  const res = R.replan(planQ, {T, positions, players: playersL, rules: rulesQ, out: [], vacate: [], adjust: {[p]: -7}, freezeUntil: 70, freezeOut: [p], seed: 3, saIters: 8000});
  assert.ok(!res.error, String(res.warnings));
  assert.strictEqual(res.segs[res.segs.length - 1].b, 70);
});

test("un joueur sorti juste avant un imprévu respecte le banc minimum avant de revenir", () => {
  const ch = planQ.changes.find(c => c.t > 20 && c.t < 50 && c.outs.length);
  const left = ch.outs[0][0], T = ch.t + 0.5, hurtP = fieldAt(planQ, T).find(n => n !== left);
  const res = R.replan(planQ, {T, positions, players: playersL, rules: rulesQ, out: [hurtP], vacate: [], adjust: {}, seed: 3, saIters: 20000});
  assert.ok(!res.error, String(res.warnings));
  const back = res.segs.find(s => s.a > ch.t + EPS && left in s.on);
  if (back) assert.ok(back.a - ch.t >= rulesQ.minBench - EPS, `${left} revient après ${back.a - ch.t}'`);
});
