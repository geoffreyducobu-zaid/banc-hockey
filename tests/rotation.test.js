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

test("passages entre le minimum de la ligne et le maximum", () => {
  for (const [p, iv] of Object.entries(plan.intervals)) {
    const pl = byName[p]; if (pl.note >= 5) continue;
    const max = pl.maxStint || rules.maxStint;
    for (const [a, b] of iv) {
      if (b < END - EPS) assert.ok(b - a >= minStintOf(pl) - EPS, `${p} : passage de ${b - a}'`);
      assert.ok(b - a <= max + EPS, `${p} : passage de ${b - a}'`);
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
