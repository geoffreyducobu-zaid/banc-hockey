// Rotation solver: randomized pacing heuristic + restarts, scored on constraints.
// Exposes buildPlan(input) -> {segs, totals, changes, warnings, score}
(function (root) {
  const EPS = 1e-6;

  function hungarian(cost) { // square matrix, returns assignment row->col
    const n = cost.length, INF = 1e15;
    const u = new Array(n + 1).fill(0), v = new Array(n + 1).fill(0), p = new Array(n + 1).fill(0), way = new Array(n + 1).fill(0);
    for (let i = 1; i <= n; i++) {
      p[0] = i; let j0 = 0; const minv = new Array(n + 1).fill(INF), used = new Array(n + 1).fill(false);
      do {
        used[j0] = true; const i0 = p[j0]; let delta = INF, j1 = 0;
        for (let j = 1; j <= n; j++) if (!used[j]) {
          const cur = cost[i0 - 1][j - 1] - u[i0] - v[j];
          if (cur < minv[j]) { minv[j] = cur; way[j] = j0; }
          if (minv[j] < delta) { delta = minv[j]; j1 = j; }
        }
        for (let j = 0; j <= n; j++) { if (used[j]) { u[p[j]] += delta; v[j] -= delta; } else minv[j] -= delta; }
        j0 = j1;
      } while (p[j0] !== 0);
      do { const j1 = way[j0]; p[j0] = p[j1]; j0 = j1; } while (j0);
    }
    const res = new Array(n); for (let j = 1; j <= n; j++) res[p[j] - 1] = j - 1; return res;
  }

  function canMatch(onList, posIds, can) { // Kuhn bipartite matching
    const match = {}; // pos -> player
    function tryP(p, seen) {
      for (const q of posIds) {
        if (!can[p].has(q) || seen.has(q)) continue; seen.add(q);
        if (match[q] === undefined || tryP(match[q], seen)) { match[q] = p; return true; }
      }
      return false;
    }
    for (const p of onList) if (!tryP(p, new Set())) return false;
    return true;
  }

  function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

  // Règle k pour la période q (0 = 1er quart ou 1re mi-temps) : l'exception de la période si elle existe, sinon la règle du match.
  // Règles réglables par période : startBlock, endBlock, maxBench, maxEntries, breakChanges (pause avant la période), gkOnlyAtBreaks.
  // Exception propre à une période : stay = joueurs qui ne doivent pas sortir de cette période (passés au moteur par joueur, p.stay).
  function rq(R, q, k) {
    if (k === 'startBlock' && q === 0 && !R.per && R.firstChange != null) return R.firstChange; // ancien format
    if (k === 'maxMoves') return R[k]; // vaut pour tout le match
    const o = R.per && R.per[q];
    return o && o[k] !== undefined && o[k] !== null ? o[k] : R[k];
  }

  // Ancien format (firstChange = 1er changement du Q1) -> exceptions par période (per). firstChange reste écrit
  // pour les anciennes versions de l'app ; quand per existe, le moteur l'ignore.
  function migrateRules(r) {
    r = JSON.parse(JSON.stringify(r || {}));
    if (!r.per || typeof r.per !== 'object') {
      const f = r.firstChange != null ? +r.firstChange : 6, sb = r.startBlock != null ? +r.startBlock : 4;
      r.per = f !== sb ? { 0: { startBlock: f } } : {};
    }
    // Ancien format : un seul maximum d'affilée -> un maximum par ligne (défense, milieu, attaque).
    if (r.maxDef == null && r.maxStint != null) r.maxDef = r.maxMid = r.maxAtt = +r.maxStint;
    return r;
  }

  // Plus long morceau de [a, b] sans pause entre quarts : une pause remet à zéro le temps d'affilée sur le terrain.
  // minimum avant de sortir : un titulaire (sur le terrain depuis le coup d'envoi) a le sien pour son 1er passage
  const minOn = (I, p, start) => start < EPS ? I.minS0[p] : I.minS[p];
  // skip : quarts où le joueur ne doit pas sortir (le coach l'a demandé) : son maximum d'affilée n'y compte pas.
  function longestRun(a, b, ql, skip) {
    let m = 0, x = a;
    while (x < b - EPS) { const e = Math.min(b, (Math.floor((x + EPS) / ql) + 1) * ql); if (!(skip && skip.has(Math.floor((x + EPS) / ql)))) m = Math.max(m, e - x); x = e; }
    return m;
  }

  // Temps passé hors du terrain pendant un quart où le joueur ne doit pas sortir (fenêtre [F, U] seulement).
  function stayMiss(iv, stay, ql, F, U) {
    let miss = 0;
    if (!stay) return 0;
    for (const q of stay) {
      const a = Math.max(q * ql, F), b = Math.min((q + 1) * ql, U); if (b - a < EPS) continue;
      let on = 0; for (const [x, y] of iv) on += Math.max(0, Math.min(y, b) - Math.max(x, a));
      miss += Math.max(0, b - a - on);
    }
    return miss;
  }

  function changeTimes(R) {
    const T = new Set();
    for (let q = 0; q < R.quarters; q++) {
      const qa = q * R.qlen;
      if (q > 0 && rq(R, q, 'breakChanges')) T.add(+qa.toFixed(3));
      for (let m = Math.ceil(rq(R, q, 'startBlock')); m <= R.qlen - rq(R, q, 'endBlock') + EPS; m += 1) T.add(+(qa + m).toFixed(3));
    }
    const F = R.from || 0, U = R.until || R.quarters * R.qlen; return [...T].filter(t => t > F + EPS && t < U - EPS).sort((a, b) => a - b);
  }

  function runOnce(I, rand, knobs) {
    const { players, posIds, lineup, R, targets, locked, can, pref, gkPos } = I;
    const END = R.until || R.quarters * R.qlen;
    const T = I.times;
    const on = new Map(); // player -> pos
    for (const q of posIds) on.set(lineup[q], q);
    const F = R.from || 0;
    const st = {}; players.forEach(p => { st[p] = { played: 0, since: (I.since && I.since[p] !== undefined) ? I.since[p] : F, onNow: on.has(p) }; });
    const segs = []; let last = F; const entriesAt = {};
    let viol = 0;
    const qStart = t => Math.floor((t + EPS) / R.qlen) * R.qlen;
    const qIdx = t => Math.min(R.quarters - 1, Math.floor((t + EPS) / R.qlen));
    function advance(t) {
      if (t > last) { segs.push({ a: last, b: t, on: new Map(on) }); for (const p of on.keys()) st[p].played += t - last; last = t; }
    }
    for (let i = 0; i < T.length; i++) {
      const t = T[i]; advance(t);
      const next = i + 1 < T.length ? T[i + 1] : END;
      const isBreak = Math.abs(t - qStart(t)) < EPS;
      const qEnd = qStart(t) + R.qlen, qi = qIdx(t);
      const remain = END - t;
      const benchList = players.filter(p => !on.has(p));
      const onList = [...on.keys()];
      const need = p => (targets[p] - st[p].played) / Math.max(remain, EPS);
      // eligibility
      const canEnter = p => remain >= I.minS[p] - EPS && (t - st[p].since) >= R.minBench - EPS;
      const canLeave = p => !locked.has(p) && !(I.stay[p] && I.stay[p].has(qi)) && (t - st[p].since) >= minOn(I, p, st[p].since) - EPS;
      const gkChangeOk = isBreak || !rq(R, qi, 'gkOnlyAtBreaks');
      // forced
      const forcedOut = onList.filter(p => !locked.has(p) && longestRun(st[p].since, next, R.qlen, I.stay[p]) > I.maxS[p] + EPS && canLeave(p));
      const forcedIn = benchList.filter(p => {
        if (I.stay[p] && I.stay[p].has(qi) && remain > EPS) return true; // ne doit pas sortir de ce quart : il rentre dès que possible
        if (!canEnter(p)) return false;
        const bq = Math.max(st[p].since, qStart(t));
        const nextOpp = Math.min(next, qEnd);
        return (nextOpp - bq) > rq(R, qi, 'maxBench') + EPS && I.fieldPlayer[p];
      });
      // candidates
      const ins = [], outs = [];
      const pairs = [];
      const thr = knobs.thr * (0.7 + 0.6 * rand());
      for (const b of benchList) {
        if (!canEnter(b)) continue;
        for (const o of onList) {
          if (!canLeave(o)) continue;
          let val = need(b) - need(o) + (rand() - 0.5) * knobs.noise;
          if (forcedIn.includes(b)) val += 10;
          if (forcedOut.includes(o)) val += 10;
          if (st[b].played + remain < targets[b] - 0.5) val += 2; // must play rest
          if (val > thr) pairs.push([val, b, o]);
        }
      }
      pairs.sort((x, y) => y[0] - x[0]);
      const usedB = new Set(), usedO = new Set();
      const trial = new Set(onList);
      for (const [val, b, o] of pairs) {
        if (usedB.size >= rq(R, qi, 'maxEntries')) break;
        if (usedB.has(b) || usedO.has(o)) continue;
        // gk restriction
        const touchesGK = (can[b].has(gkPos) && !I.fieldPlayer[b]) || on.get(o) === gkPos;
        if (touchesGK && !gkChangeOk) continue;
        trial.delete(o); trial.add(b);
        if (canMatch([...trial], posIds, can)) { usedB.add(b); usedO.add(o); }
        else { trial.delete(b); trial.add(o); }
      }
      if (usedB.size) {
        for (const o of usedO) { on.delete(o); st[o].since = t; }
        for (const b of usedB) { on.set(b, null); st[b].since = t; }
        // assign positions: hungarian with switch penalty
        const list = [...on.keys()];
        const C = list.map(p => posIds.map(q => {
          if (!can[p].has(q)) return 1e9;
          let c = pref[p][q] * knobs.prefW;
          const prev = on.get(p); if (prev && prev !== q) c += knobs.swW;
          return c;
        }));
        const asg = hungarian(C);
        list.forEach((p, k) => on.set(p, posIds[asg[k]]));
        entriesAt[t] = usedB.size;
      }
      // violations for forced not satisfied
      for (const p of forcedIn) if (!on.has(p)) viol++;
      for (const p of forcedOut) if (on.has(p)) viol++;
    }
    advance(END);
    return { segs, played: Object.fromEntries(players.map(p => [p, st[p].played])), entriesAt, viol };
  }

  function evaluate(I, res) {
    const { players, R, targets } = I; const END = R.until || R.quarters * R.qlen;
    let dev = 0, v = res.viol, sw = 0, pc = 0;
    for (const p of players) dev += Math.abs(res.played[p] - targets[p]) + Math.max(0, Math.abs(res.played[p] - targets[p]) - 2) * 4;
    // stints & bench check
    const iv = intervals(res.segs, players);
    for (const p of players) {
      for (const [a, b] of iv[p]) {
        if (b - a < minOn(I, p, a) - EPS && b < END - EPS) v += 1;
        if (!I.locked.has(p) && longestRun(a, b, R.qlen, I.stay[p]) > I.maxS[p] + EPS) v += 1;
      }
      if (I.stay[p]) v += Math.ceil(stayMiss(iv[p], I.stay[p], R.qlen, R.from || 0, END) - EPS) * 2;
      if (!I.fieldPlayer[p] || I.locked.has(p)) continue;
      let t = R.from || 0; const off = [];
      for (const [a, b] of iv[p]) { if (a > t) off.push([t, a]); t = b; }
      if (t < END) off.push([t, END]);
      for (const [a, b] of off) for (let q = 0; q < R.quarters; q++) {
        const qa = q * R.qlen; if (Math.min(b, qa + R.qlen) - Math.max(a, qa) > rq(R, q, 'maxBench') + EPS) v += 1;
      }
    }
    for (let i = 1; i < res.segs.length; i++) {
      const A = res.segs[i - 1].on, B = res.segs[i].on;
      for (const [p, q] of B) if (A.has(p) && A.get(p) !== q) sw++;
    }
    for (const s of res.segs) for (const [p, q] of s.on) pc += I.pref[p][q] * (s.b - s.a);
    const windows = Object.keys(res.entriesAt).length;
    return v * 1000 + dev * 10 + sw * 3 + windows * 2 + pc * 0.05;
  }

  function intervals(segs, players) {
    const iv = {}; players.forEach(p => iv[p] = []);
    for (const s of segs) for (const p of s.on.keys()) {
      const L = iv[p]; if (L.length && Math.abs(L[L.length - 1][1] - s.a) < EPS) L[L.length - 1][1] = s.b; else L.push([s.a, s.b]);
    }
    return iv;
  }


  // ---------- simulated annealing on on-sets per grid segment ----------
  function anneal(I, init, rand, iters) {
    const { players, posIds, R, targets, locked, can } = I;
    const END = R.until || R.quarters * R.qlen; // until : fenêtre qui s'arrête avant la fin du match (carton)
    const F0 = R.from || 0; const grid = [F0, ...I.times, END];
    const nS = grid.length - 1; const dur = []; for (let s = 0; s < nS; s++) dur.push(grid[s + 1] - grid[s]);
    const isBreak = grid.map(t => t > 0 && Math.abs(t / R.qlen - Math.round(t / R.qlen)) < EPS);
    const qOf = s => Math.min(R.quarters - 1, Math.floor((grid[s] + EPS) / R.qlen));
    const gkLock = grid.map((t, s) => !isBreak[s] && !!rq(R, qOf(s), 'gkOnlyAtBreaks')); // gardien qui ne change qu'à la pause
    const idx = {}; players.forEach((p, i) => idx[p] = i);
    const nP = players.length;
    // on matrix
    const on = Array.from({ length: nS }, () => new Uint8Array(nP));
    for (let s = 0; s < nS; s++) {
      const mid = (grid[s] + grid[s + 1]) / 2;
      const seg = init.segs.find(g => g.a <= mid && mid < g.b);
      for (const p of seg.on.keys()) on[s][idx[p]] = 1;
    }
    const gkOnly = players.map(p => !I.fieldPlayer[p]);
    // minutes de chaque segment dans un quart où le joueur ne doit pas sortir
    const stayDur = players.map(p => I.stay[p] ? dur.map((d, s) => { let o = 0; for (const q of I.stay[p]) o += Math.max(0, Math.min(grid[s + 1], (q + 1) * R.qlen) - Math.max(grid[s], q * R.qlen)); return o; }) : null);
    function score() {
      let pen = 0, windows = 0, stints = 0;
      const entries = new Array(nS).fill(0);
      for (let i = 0; i < nP; i++) {
        const p = players[i]; let played = 0; let runStart = (I.since && I.since[p] !== undefined) ? I.since[p] : F0;
        let benchStart = runStart;
        for (let s = 0; s <= nS; s++) {
          const v = s < nS ? on[s][i] : 0;
          const pv = s > 0 ? on[s - 1][i] : 0;
          if (s < nS && v) played += dur[s];
          if (s < nS && !v && stayDur[i] && stayDur[i][s] > EPS) pen += 400 + stayDur[i][s] * 60;
          if (v && !pv) { // enter
            if (s > 0) { entries[s]++; if (gkOnly[i] && gkLock[s]) pen += 40; if (I.oneBlock.has(p)) pen += 200; }
            if (s > 0) runStart = grid[s]; stints++;
            // bench just ended: check bench per quarter
            if (s > 0 && I.fieldPlayer[p] && !locked.has(p)) pen += benchPen(benchStart, grid[s]);
          }
          if (!v && pv) { // leave at grid[s]
            const L = grid[s] - runStart;
            const mn = minOn(I, p, runStart);
            if (L < mn - EPS && !(R.until && s === nS)) pen += 300 + (mn - L) * 30;
            if (I.minFirst[p] && Math.abs(runStart - F0) < EPS && F0 === 0 && L < I.minFirst[p] - EPS) pen += 300 + (I.minFirst[p] - L) * 30;
            const Lr = longestRun(runStart, grid[s], R.qlen, I.stay[p]);
            if (!locked.has(p) && Lr > I.maxS[p] + EPS) pen += 300 + (Lr - I.maxS[p]) * 30;
            if (s < nS && gkOnly[i] && gkLock[s]) pen += 40;
            benchStart = grid[s];
          }
          if (s === nS && !pv && I.fieldPlayer[p] && !locked.has(p)) pen += benchPen(benchStart, END);
          if (s < nS && !v && pv === 1 && s > 0) {
            // min bench before re-entry checked on enter below
          }
        }
        const d = Math.abs(played - targets[p]);
        pen += d * 8 + Math.max(0, d - 1.5) * 20;
        // temps de jeu minimum sur tout le match (après un imprévu : minutes déjà jouées + minutes à venir)
        const pr = I.prior ? I.prior[p] || 0 : 0;
        if (!R.until && I.fieldPlayer[p] && targets[p] + pr >= R.minPlay && played + pr < R.minPlay - EPS) pen += F0 ? 100 + (R.minPlay - played - pr) * 40 : 30 + (R.minPlay - played) * 20;
      }
      for (let s = 1; s < nS; s++) if (entries[s]) { windows++; const me = rq(R, qOf(s), 'maxEntries'); if (entries[s] > me) pen += 300 * (entries[s] - me); }
      return pen + windows * 3 + stints * 3 + sumSeg() + movesPen();
    }
    function benchPen(a, b) {
      let pen = 0;
      if (b - a < R.minBench - EPS && a > EPS && b < END) pen += F0 ? 300 + (R.minBench - (b - a)) * 30 : 150; // aussi pour un joueur sorti juste avant un imprévu
      for (let q = 0; q < R.quarters; q++) {
        const qa = q * R.qlen, mb = rq(R, q, 'maxBench'); const ov = Math.min(b, qa + R.qlen) - Math.max(a, qa);
        if (ov > mb + EPS) pen += 300 + (ov - mb) * 30;
      }
      return pen;
    }
    // Postes de chaque segment. Sans maximum de changements de poste : chaque segment est placé seul (préférences).
    // Avec ce maximum : placement à la suite du segment d'avant, comme dans le plan final, pour compter les changements de poste.
    const seqPos = !!I.seqPos; // plus lent : seulement si le plan normal fait trop de changements de poste
    const L0 = new Map(); for (const q of posIds) L0.set(I.lineup[q], q); // le coup d'envoi suit la compo du coach
    const segAsg = new Array(nS), segMv = new Array(nS).fill(0);
    const baseRow = {}; players.forEach(p => baseRow[p] = posIds.map(q => can[p].has(q) ? I.pref[p][q] * 2 : 1e9));
    const posIx = {}; posIds.forEach((q, k) => posIx[q] = k);
    function placeSeg(list, prev, mv) { // null si personne ne peut jouer à un des postes
      const C = list.map(p => { const r = baseRow[p].slice(), pq = prev.get(p); if (pq !== undefined) for (let k = 0; k < r.length; k++) if (k !== posIx[pq]) r[k] += mv; return r; });
      const asg = hungarian(C), r = new Map(); for (let k = 0; k < list.length; k++) { if (C[k][asg[k]] >= 1e9) return null; r.set(list[k], posIds[asg[k]]); } return r;
    }
    const movesOf = (prev, r) => { let n = 0; for (const [p, q] of r) if (prev.has(p) && prev.get(p) !== q) n++; return n; };
    function segCostOf(s) {
      const list = []; for (let i = 0; i < nP; i++) if (on[s][i]) list.push(players[i]);
      if (!seqPos && !canMatch(list, posIds, can)) return Infinity;
      let c = 0;
      if (seqPos) {
        let m;
        if (s === 0) m = L0;
        else {
          const prev = segAsg[s - 1], mm = rq(R, qOf(s), 'maxMoves');
          m = placeSeg(list, prev, 6); if (!m) return Infinity;
          if (mm != null && movesOf(prev, m) > mm) { const m2 = placeSeg(list, prev, 1000); if (movesOf(prev, m2) < movesOf(prev, m)) m = m2; }
          segMv[s] = movesOf(prev, m);
        }
        segAsg[s] = m; for (const [p, q] of m) c += can[p].has(q) ? I.pref[p][q] : 3;
      } else {
        const C = list.map(p => posIds.map(q => can[p].has(q) ? I.pref[p][q] : 1e6));
        const asg = hungarian(C); list.forEach((p, k) => c += C[k][asg[k]]);
      }
      let miss = 0;
      for (const r of I.rolesAvail) if (!list.some(p => I.roles[p] && I.roles[p].includes(r))) miss++;
      return c * dur[s] * 3 + miss * dur[s] * 150;
    }
    const segCost = []; for (let s = 0; s < nS; s++) segCost.push(segCostOf(s));
    function movesPen() {
      if (!seqPos) return 0;
      let pen = 0;
      for (let s = 1; s < nS; s++) { const mm = rq(R, qOf(s), 'maxMoves'); if (mm != null && segMv[s] > mm) pen += 300 * (segMv[s] - mm); pen += segMv[s] * 2; }
      return pen;
    }
    const sumSeg = () => segCost.reduce((a, b) => a + b, 0);
    let cur = score(), best = cur; let bestOn = on.map(r => r.slice()); let bestAsg = segAsg.slice();
    const free = players.map((p, i) => i).filter(i => !locked.has(players[i]));
    const T0 = 40, T1 = 0.3;
    let lastEntry = 1; for (let s = 1; s < nS; s++) if (R.until || grid[s] <= END - R.minStint + EPS) lastEntry = s;
    for (let k = 0; k < iters; k++) {
      const temp = T0 * Math.pow(T1 / T0, k / iters);
      const s0 = 1 + Math.floor(rand() * (lastEntry));
      const len = rand() < 0.5 ? 1 : 1 + Math.floor(rand() * 6);
      let s1 = Math.min(nS - 1, s0 + len - 1);
      if (!R.until && s1 + 1 < nS && grid[s1 + 1] > END - R.minStint + EPS) s1 = nS - 1;
      // choose x on in all segs, y off in all segs
      const xs = free.filter(i => { for (let s = s0; s <= s1; s++) if (!on[s][i]) return false; return true; });
      const ys = free.filter(i => { for (let s = s0; s <= s1; s++) if (on[s][i]) return false; return true; });
      if (!xs.length || !ys.length) continue;
      const x = xs[Math.floor(rand() * xs.length)], y = ys[Math.floor(rand() * ys.length)];
      for (let s = s0; s <= s1; s++) { on[s][x] = 0; on[s][y] = 1; }
      const old = []; let ok = true;
      for (let s = s0; s <= s1; s++) { old.push([s, segCost[s], segAsg[s], segMv[s]]); segCost[s] = segCostOf(s); if (segCost[s] === Infinity) { ok = false; break; } }
      // placement à la suite : les segments d'après changent tant que leur placement bouge
      if (ok && seqPos) for (let s = s1 + 1; s < nS; s++) { const was = segAsg[s]; old.push([s, segCost[s], was, segMv[s]]); segCost[s] = segCostOf(s); if (sameMap(was, segAsg[s])) break; }
      let nw = ok ? score() : Infinity;
      if (ok && (nw <= cur || rand() < Math.exp((cur - nw) / temp))) {
        cur = nw; if (cur < best) { best = cur; bestOn = on.map(r => r.slice()); bestAsg = segAsg.slice(); }
      } else { for (let s = s0; s <= s1; s++) { on[s][x] = 1; on[s][y] = 0; } for (let k = old.length - 1; k >= 0; k--) { const [s, c, a, mv] = old[k]; segCost[s] = c; segAsg[s] = a; segMv[s] = mv; } }
    }
    // rebuild segs with positions (sequential hungarian, switch penalty ; avec un maximum de changements de poste : ceux du recuit)
    const segs = []; let prev = new Map(); for (const q of posIds) prev.set(I.lineup[q], q);
    const entriesAt = {};
    for (let s = 0; s < nS; s++) {
      const list = []; for (let i = 0; i < nP; i++) if (bestOn[s][i]) list.push(players[i]);
      let m;
      if (s === 0) m = new Map(prev);
      else if (seqPos) { m = bestAsg[s]; const ent = list.filter(p => !prev.has(p)).length; if (ent) entriesAt[grid[s]] = ent; }
      else {
        const C = list.map(p => posIds.map(q => {
          if (!can[p].has(q)) return 1e9;
          let c = I.pref[p][q] * 2; const pq = prev.get(p);
          if (pq !== undefined && pq !== q) c += 6; return c;
        }));
        const asg = hungarian(C); m = new Map(); list.forEach((p, k) => m.set(p, posIds[asg[k]]));
        // trop de changements de poste : on garde le placement qui en fait le moins
        const mm = rq(R, qOf(s), 'maxMoves'), mv = r => { let n = 0; for (const [p, q] of r) if (prev.has(p) && prev.get(p) !== q) n++; return n; };
        if (mm != null && mv(m) > mm) {
          const C2 = list.map((p, k) => C[k].map((c, j) => c + (prev.has(p) && prev.get(p) !== posIds[j] ? 1000 : 0)));
          const a2 = hungarian(C2), m2 = new Map(); list.forEach((p, k) => m2.set(p, posIds[a2[k]])); if (mv(m2) < mv(m)) m = m2;
        }
        const ent = list.filter(p => !prev.has(p)).length; if (ent) entriesAt[grid[s]] = ent;
      }
      const lastSeg = segs[segs.length - 1];
      if (lastSeg && sameMap(lastSeg.on, m)) lastSeg.b = grid[s + 1];
      else segs.push({ a: grid[s], b: grid[s + 1], on: m });
      prev = m;
    }
    const played = {}; players.forEach(p => played[p] = 0);
    for (const sg of segs) for (const p of sg.on.keys()) played[p] += sg.b - sg.a;
    return { segs, played, entriesAt, viol: 0, saScore: best };
  }
  function sameMap(a, b) { if (a.size !== b.size) return false; for (const [k, v] of a) if (b.get(k) !== v) return false; return true; }

  function buildPlan(input) {
    const { positions, players: P, lineup, rules: R, seed } = input;
    const posIds = positions.map(p => p.id);
    const gkPos = positions.find(p => p.gk)?.id;
    const END = R.quarters * R.qlen;
    const players = P.map(p => p.name);
    const can = {}, pref = {}, fieldPlayer = {};
    P.forEach(p => {
      can[p.name] = new Set(p.pos.filter(q => posIds.includes(q)));
      pref[p.name] = {}; p.pos.forEach((q, i) => pref[p.name][q] = Math.pow(p.rank && p.rank[i] != null ? p.rank[i] : i, 1.5)); // rank : places d'un même groupe à égalité
      fieldPlayer[p.name] = p.pos.some(q => q !== gkPos);
    });
    const locked = new Set(P.filter(p => p.locked).map(p => p.name));
    const targets = {}; P.forEach(p => targets[p.name] = p.target);
    const warnings = [];
    for (const q of posIds) if (!lineup[q]) warnings.push(`Le poste ${q} n'a pas de titulaire.`);
    const starters = Object.values(lineup);
    if (new Set(starters).size !== starters.length) warnings.push('Un joueur est titulaire à deux postes.');
    for (const q of posIds) if (lineup[q] && !can[lineup[q]]?.has(q)) warnings.push(`${lineup[q]} n'a pas le poste ${q} dans sa liste.`);
    if (warnings.length) return { warnings, error: true };
    // allow starters at their starting post
    for (const q of posIds) can[lineup[q]].add(q), pref[lineup[q]][q] ??= 3;
    for (const p of players) if (!can[p].size) warnings.push(`${p} n'a aucun poste valide dans ce système.`);
    const oneBlock = new Set(P.filter(p => p.oneBlock).map(p => p.name));
    const roles = {}; P.forEach(p => roles[p.name] = p.roles || []);
    const minFirst = {}; P.forEach(p => { if (p.minFirst) minFirst[p.name] = p.minFirst; });
    const minS = {}; P.forEach(p => minS[p.name] = Math.max(R.minStint, p.minStint || 0));
    const minS0 = {}; P.forEach(p => minS0[p.name] = p.minStart ?? minS[p.name]);
    const rolesAvail = [...new Set(P.flatMap(p => (p.roles || [])))];
    const maxS = {}; P.forEach(p => maxS[p.name] = p.oneBlock ? END : Math.max(R.minStint, p.minStint || 0, p.maxStint || R.maxStint));
    // stay : quarts (0 = Q1) où le coach ne veut pas que ce joueur sorte : il est sur le terrain tout le quart
    const stay = {}; P.forEach(p => { const L = (p.stay || []).filter(q => q >= 0 && q < R.quarters); if (L.length && fieldPlayer[p.name] && !locked.has(p.name)) stay[p.name] = new Set(L); });
    if (!R.from) for (const p of P) if (stay[p.name]) {
      const pq = q => (R.quarters === 2 ? 'MT' : 'Q') + (q + 1);
      if (stay[p.name].has(0) && !starters.includes(p.name)) warnings.push(`${p.name} ne doit pas sortir ${R.quarters === 2 ? 'de la MT1' : 'du Q1'}, mais il n'est pas titulaire.`);
      for (const q of stay[p.name]) if (q > 0 && !rq(R, q, 'breakChanges') && !starters.includes(p.name) && rq(R, q, 'startBlock') > EPS) { /* peut rentrer plus tard : contrôlé par checkRules */ }
      const need = stay[p.name].size * R.qlen;
      if (p.target < need - 0.5) warnings.push(`${p.name} ne sort pas ${[...stay[p.name]].sort().map(pq).join(', ')} : il lui faut au moins ${fmtMin(need)} de jeu, tu lui en as prévu ${fmtMin(p.target)}.`);
    }
    const I = { players, posIds, lineup, R, targets, locked, can, pref, gkPos, fieldPlayer, maxS, oneBlock, roles, rolesAvail, minFirst, minS, minS0, stay, since: input.since || null, prior: input.prior || null, times: changeTimes(R) };
    const rand = rng(seed || 12345);
    let best = null, bestScore = Infinity;
    const iters = input.iters || 300;
    for (let k = 0; k < iters; k++) {
      const knobs = { thr: 0.05 + rand() * 0.5, noise: rand() * 0.4, prefW: 1 + rand() * 3, swW: 2 + rand() * 6 };
      const res = runOnce(I, rand, knobs);
      const sc = evaluate(I, res);
      if (sc < bestScore) { bestScore = sc; best = res; }
    }
    const start = best;
    // seq : calcul fin des postes, plus lent, donc deux fois moins de pas
    const runSA = seq => { I.seqPos = seq; let b = null; for (let c = 0; c < (input.chains || 3); c++) { const sa = anneal(I, start, rand, Math.round((input.saIters || 30000) * (seq ? 0.5 : 1))); if (!b || sa.saScore < b.saScore) b = sa; } return b; };
    // changements de poste au-delà du maximum du coach, pour un plan
    const movesOver = segs => { let n = 0; for (let i = 1; i < segs.length; i++) { const mm = rq(R, Math.min(R.quarters - 1, Math.floor((segs[i].a + EPS) / R.qlen)), 'maxMoves'); if (mm == null) continue; let k = 0; for (const [p, q] of segs[i].on) if (segs[i - 1].on.has(p) && segs[i - 1].on.get(p) !== q) k++; n += Math.max(0, k - mm); } return n; };
    let bestSA = runSA(false);
    if (movesOver(bestSA.segs)) { const alt = runSA(true); if (movesOver(alt.segs) < movesOver(bestSA.segs)) bestSA = alt; }
    best = bestSA; bestScore = bestSA.saScore;
    // build outputs
    const segs = best.segs.map(s => ({ a: s.a, b: s.b, on: Object.fromEntries(s.on) }));
    const changes = [];
    for (let i = 1; i < segs.length; i++) {
      const A = segs[i - 1].on, B = segs[i].on;
      const ins = Object.keys(B).filter(p => !(p in A)).map(p => [p, B[p]]);
      const outs = Object.keys(A).filter(p => !(p in B)).map(p => [p, A[p]]);
      const moves = Object.keys(B).filter(p => p in A && A[p] !== B[p]).map(p => [p, A[p], B[p]]);
      if (ins.length || moves.length) changes.push({ t: segs[i].a, ins, outs, moves });
    }
    const iv = intervals(best.segs, players);
    // plan complet : toutes les règles du coach (un sous-plan d'imprévu est contrôlé par replan)
    const check = R.from ? [] : checkRules(segs, P, R, { T: 0, T1: 0, hit: new Set(), gk: gkPos, targets, freezeOut: [] });
    check.push(...roleGaps(best.segs.map(s => ({ a: s.a, b: s.b, on: Object.fromEntries(s.on) })), roles, rolesAvail));
    for (const p of players) if (Math.abs(best.played[p] - targets[p]) > 2.5) check.push(`${p} : ${fmtMin(best.played[p])} au lieu de ${fmtMin(targets[p])}`);
    return { segs, changes, played: best.played, targets, intervals: iv, warnings: [...warnings, ...check], score: bestScore };
  }
  function fmtMin(m) { const mm = Math.floor(m + EPS), ss = Math.round((m - mm) * 60); return ss ? `${mm}'${String(ss).padStart(2, '0')}` : `${mm}'`; }

  // minutes from notes: note 5 = full, others linear from 35 (note 2)
  function targetsFromNotes(P, fieldSlots, END) {
    const out = {};
    const free = P.filter(p => !p.override && !(p.note >= 5));
    let fixed = 0;
    P.forEach(p => {
      if (p.override) out[p.name] = p.override;
      else if (p.note >= 5) out[p.name] = END;
    });
    P.filter(p => p.field).forEach(p => { if (out[p.name] !== undefined) fixed += out[p.name]; });
    const freeField = free.filter(p => p.field);
    const budget = fieldSlots * END - fixed;
    const base = END / 2;
    const sumd = freeField.reduce((s, p) => s + (p.note - 2), 0);
    let k = sumd > 0 ? (budget - base * freeField.length) / sumd : 0;
    freeField.forEach(p => out[p.name] = base + k * (p.note - 2));
    if (sumd === 0 && freeField.length) freeField.forEach(p => out[p.name] = budget / freeField.length);
    free.filter(p => !p.field).forEach(p => out[p.name] = 0);
    return { targets: out, k, budget };
  }

  // Temps égal : P = [{name, override, field, group}], slots = {group: nombre de postes}.
  // Chaque groupe partage à égalité son temps (postes × durée), moins les minutes fixées.
  function targetsEqual(P, slots, END) {
    const out = {};
    P.forEach(p => { if (!p.field) out[p.name] = 0; else if (p.override) out[p.name] = p.override; });
    for (const g of Object.keys(slots)) {
      const inG = P.filter(p => p.field && p.group === g);
      const free = inG.filter(p => !p.override);
      const budget = slots[g] * END - inG.filter(p => p.override).reduce((a, p) => a + p.override, 0);
      free.forEach(p => out[p.name] = Math.max(0, Math.min(END, budget / free.length)));
    }
    P.forEach(p => { if (out[p.name] === undefined) out[p.name] = 0; });
    return { targets: out };
  }

  const ROLE_NAMES = { D: "donneur", B: "bloqueur" };
  function roleGaps(segs, roles, avail) {
    const out = [];
    for (const r of avail) {
      let start = null;
      for (const s of segs) {
        const ok = Object.keys(s.on).some(p => roles[p] && roles[p].includes(r));
        if (!ok && start === null) start = s.a;
        if (ok && start !== null) { out.push(`Pas de ${ROLE_NAMES[r] || r} sur le terrain de ${fmtMin(start)} à ${fmtMin(s.a)}`); start = null; }
      }
      if (start !== null) out.push(`Pas de ${ROLE_NAMES[r] || r} sur le terrain à partir de ${fmtMin(start)}`);
    }
    return out;
  }
  // ---------- re-plan after an incident ----------
  function replan(plan, o) {
    // o: {T, positions, players:[{name,pos,target,locked,oneBlock,maxStint}], rules, out:[names], vacate:[posIds], freezeUntil, freezeOut:[names], adjust:{name:+-min}, enter:{name,pos}, seed}
    const END = o.rules.quarters * o.rules.qlen;
    const T = o.T, T1 = o.freezeUntil || T;
    const segAt = t => plan.segs.find(s => s.a <= t + EPS && t < s.b - EPS) || plan.segs[plan.segs.length - 1];
    const prefix = [];
    for (const s of plan.segs) { if (s.a >= T - EPS) break; prefix.push({ a: s.a, b: Math.min(s.b, T), on: { ...s.on } }); }
    const cur = { ...segAt(T).on };
    const outSet = new Set(o.out || []);
    let startOn = { ...cur };
    // minutes jouées et heure du dernier changement de chaque joueur, d'après des segments et ceux sur le terrain à t0
    const stats = (segs, startMap, t0) => {
      const played = {}, since = {};
      o.players.forEach(p => { played[p.name] = 0; let last = 0, prevOn = null;
        for (const s of segs) { if (p.name in s.on) played[p.name] += s.b - s.a; const on = p.name in s.on; if (prevOn !== null && on !== prevOn) last = s.a; prevOn = on; }
        if (prevOn !== null && (p.name in startMap) !== prevOn) last = t0;
        since[p.name] = last; });
      return { played, since };
    };
    if (T1 > T + EPS) { // carton : on joue à un de moins de T à T1, avec des changements permis entre-temps
      const fo = (o.freezeOut || []).filter(p => p in cur);
      const fr = { ...cur }; fo.forEach(p => delete fr[p]);
      let segsA = null;
      try {
        const vac0 = new Set(o.vacate || []), posA = o.positions.filter(p => !vac0.has(p.id) && !fo.some(n => cur[n] === p.id));
        const st = stats(prefix, fr, T), playersA = o.players.filter(p => !outSet.has(p.name) && !fo.includes(p.name));
        const share = (T1 - T) / Math.max(EPS, END - T), lineupA = {}; for (const [n, q] of Object.entries(fr)) lineupA[q] = n;
        const subA = buildPlan({ positions: posA, players: playersA.map(p => ({ name: p.name, pos: p.pos, rank: p.rank, target: Math.max(0, p.target + ((o.adjust || {})[p.name] || 0) - st.played[p.name]) * share, locked: p.locked, oneBlock: p.oneBlock, maxStint: p.maxStint, roles: p.roles, minStint: p.minStint, minStart: p.minStart, stay: p.stay })),
          lineup: lineupA, rules: { ...o.rules, from: T, until: T1 }, since: st.since, prior: st.played, seed: (o.seed || 7) + 13, iters: 80, saIters: Math.round((o.saIters || 35000) / 3), chains: 2 });
        if (!subA.error && subA.segs.length) segsA = subA.segs;
      } catch (e) { segsA = null; }
      if (segsA) { prefix.push(...segsA.map(s => ({ a: s.a, b: s.b, on: { ...s.on } }))); startOn = { ...segsA[segsA.length - 1].on }; fo.forEach(p => startOn[p] = cur[p]); }
      else prefix.push({ a: T, b: T1, on: fr });
    }
    outSet.forEach(p => delete startOn[p]);
    if (o.swap) { const q = startOn[o.swap.out]; delete startOn[o.swap.out]; startOn[o.swap.in] = o.swap.pos || q; }
    if (o.enter) startOn[o.enter.name] = o.enter.pos; // remplaçant choisi par le coach (blessure)
    const vac = new Set(o.vacate || []);
    for (const [p, q] of Object.entries(startOn)) if (vac.has(q)) delete startOn[p];
    const positions = o.positions.filter(p => !vac.has(p.id));
    const posIds = positions.map(p => p.id);
    // played so far & since
    const played = {}, since = {};
    o.players.forEach(p => { played[p.name] = 0; since[p.name] = 0; });
    for (const s of prefix) for (const p in s.on) if (played[p] !== undefined) played[p] += s.b - s.a;
    o.players.forEach(p => {
      let last = 0, prevOn = null;
      for (const s of prefix) { const on = p.name in s.on; if (prevOn !== null && on !== prevOn) last = s.a; prevOn = on; }
      const onAtStart = p.name in startOn;
      if (prevOn !== null && onAtStart !== prevOn) last = T1;
      since[p.name] = last;
    });
    const avail = o.players.filter(p => !outSet.has(p.name));
    const remCap = (posIds.length - posIds.filter(q => positions.find(x => x.id === q).gk).length) * (END - T1);
    const rem = {};
    avail.forEach(p => rem[p.name] = Math.max(0, p.target + ((o.adjust || {})[p.name] || 0) - played[p.name]));
    const field = avail.filter(p => p.pos.some(q => q !== 'G'));
    const fixedP = field.filter(p => p.locked || (p.oneBlock && p.name in startOn));
    fixedP.forEach(p => rem[p.name] = Math.min(rem[p.name] || 0, END - T1) || (p.locked ? END - T1 : rem[p.name]));
    const flex = field.filter(p => !fixedP.includes(p));
    const fixedSum = fixedP.reduce((a, p) => a + rem[p.name], 0);
    const flexSum = flex.reduce((a, p) => a + rem[p.name], 0);
    const k = flexSum > 0 ? (remCap - fixedSum) / flexSum : 1;
    flex.forEach(p => rem[p.name] = Math.max(0, Math.min(END - T1, rem[p.name] * k)));
    // fill empty positions
    const canP = {}; avail.forEach(p => canP[p.name] = new Set(p.pos.filter(q => posIds.includes(q))));
    let onList = Object.keys(startOn);
    const bench = avail.map(p => p.name).filter(n => !onList.includes(n)).sort((a, b) => (rem[b] - rem[a]));
    while (onList.length < posIds.length) {
      const c = bench.find(b => canMatch([...onList, b], posIds, canP));
      if (!c) break; onList.push(c); bench.splice(bench.indexOf(c), 1);
    }
    if (!canMatch(onList, posIds, canP)) return { error: true, warnings: [o.swap ? `Avec ${o.swap.in} à la place de ${o.swap.out}, impossible de placer tout le monde à un poste qu'il sait jouer. Choisis un autre remplaçant.` : "Impossible de placer tout le monde à un poste qu'il sait jouer."] };
    const C = onList.map(p => posIds.map(q => canP[p].has(q) ? (startOn[p] && startOn[p] !== q ? 10 : 0) + (avail.find(x => x.name === p).pos.indexOf(q)) : 1e9));
    const asg = hungarian(C); const lineup = {}; onList.forEach((p, i) => lineup[posIds[asg[i]]] = p);
    if (Object.keys(lineup).length < posIds.length) return { error: true, warnings: ["Impossible de compléter l'équipe avec les joueurs disponibles."] };
    const hit = new Set([...(o.out || []), ...(o.freezeOut || [])]);
    const gk = (o.positions.find(p => p.gk) || {}).id;
    const totals = Object.fromEntries(o.players.map(p => [p.name, p.target + ((o.adjust || {})[p.name] || 0)]));
    // temps visé réaliste pour le minimum de jeu : déjà joué + ce qu'il reste à jouer (moins si l'équipe joue à 10)
    const eff = {}; avail.forEach(p => eff[p.name] = played[p.name] + (rem[p.name] || 0));
    const rl = {}; o.players.forEach(p => rl[p.name] = p.roles || []);
    // Deux essais (graines différentes) : on garde celui qui respecte le plus de règles.
    const attempt = seed => {
      let subSegs = [];
      if (T1 < END - EPS) { // un carton qui finit avec le match : plus rien à planifier
        const sub = buildPlan({ positions, players: avail.map(p => ({ name: p.name, pos: p.pos, rank: p.rank, target: rem[p.name], locked: p.locked, oneBlock: p.oneBlock, maxStint: p.maxStint, roles: p.roles, minStint: p.minStint, minStart: p.minStart, stay: p.stay })), lineup, rules: { ...o.rules, from: T1 }, since, prior: played, seed, iters: 150, saIters: o.saIters || 35000, chains: 3 });
        if (sub.error) return sub;
        subSegs = sub.segs;
      }
      const segs = prefix.concat(subSegs);
      const merged = []; for (const s of segs) { const L = merged[merged.length - 1]; if (L && Math.abs(L.b - s.a) < EPS && JSON.stringify(L.on) === JSON.stringify(s.on)) L.b = s.b; else merged.push({ a: s.a, b: s.b, on: { ...s.on } }); }
      const res = finalize(merged, o.players, totals, [], plan.events || []);
      res.warnings.push(...checkRules(merged, avail, o.rules, { T, T1, hit, gk, targets: eff, freezeOut: o.freezeOut || [] }));
      res.warnings.push(...roleGaps(merged.filter(s => s.b > T1 + EPS), rl, [...new Set(avail.flatMap(p => p.roles || []))]));
      return res;
    };
    let res = null;
    for (let k = 0; k < (o.tries || 2); k++) {
      const r = attempt((o.seed || 7) + k * 7919);
      if (r.error) return r;
      if (!res || r.warnings.length < res.warnings.length) res = r;
      if (!res.warnings.length) break;
    }
    return res;
  }
  // Contrôle d'un plan après un imprévu, sur la partie qui suit l'imprévu (T) : toutes les règles du coach.
  // Ce qui se passe pile à T (le remplacement forcé) et à T1 (retour d'un joueur sanctionné) est permis d'office.
  function checkRules(segs, players, R, c) {
    const END = R.quarters * R.qlen, out = [], T1 = c.T1, pName = q => (R.quarters === 2 ? 'MT' : 'Q') + (q + 1);
    const qOf = t => Math.min(R.quarters - 1, Math.floor((t + EPS) / R.qlen));
    // Un message par joueur et par règle, avec la pire valeur réelle entre parenthèses.
    const worst = new Map(), note = (key, txt, v, more) => { const w = worst.get(key); if (!w || (more ? v > w.v : v < w.v)) worst.set(key, { txt, v }); };
    const forced = t => Math.abs(t - c.T) < EPS || Math.abs(t - T1) < EPS;
    // moments de changement et entrées en même temps
    for (let i = 1; i < segs.length; i++) {
      const t = segs[i].a; if (t < T1 - EPS || forced(t)) continue;
      const ins = Object.keys(segs[i].on).filter(p => !(p in segs[i - 1].on)).length;
      if (!ins) continue;
      const q = qOf(t), m = t - q * R.qlen, atBreak = Math.abs(m) < EPS;
      const ok = atBreak ? q > 0 && rq(R, q, 'breakChanges') : m >= rq(R, q, 'startBlock') - EPS && m <= R.qlen - rq(R, q, 'endBlock') + EPS;
      if (!ok) out.push(`Changement à ${fmtMin(m)} du ${pName(q)} : en dehors des moments permis`);
      if (ins > rq(R, q, 'maxEntries')) out.push(`${ins} joueurs entrent en même temps à ${fmtMin(m)} du ${pName(q)} (maximum ${rq(R, q, 'maxEntries')})`);
      const mv = Object.keys(segs[i].on).filter(p => p in segs[i - 1].on && segs[i - 1].on[p] !== segs[i].on[p]).length, mm = rq(R, q, 'maxMoves');
      if (mm != null && mv > mm) out.push(`${mv} joueurs changent de poste sur le terrain à ${fmtMin(m)} du ${pName(q)} (maximum ${mm})`);
    }
    for (const p of players) {
      const field = p.pos.some(q => q !== c.gk), fixed = p.locked || p.oneBlock;
      const iv = []; for (const s of segs) if (p.name in s.on) { const L = iv[iv.length - 1]; if (L && Math.abs(L[1] - s.a) < EPS) L[1] = s.b; else iv.push([s.a, s.b]); }
      const minN = Math.max(R.minStint, p.minStint || 0), maxS = fixed ? END : Math.max(minN, p.maxStint || R.maxStint);
      for (const [a, b] of iv) {
        if (b < T1 + EPS) continue;
        const minS = a < EPS ? p.minStart ?? minN : minN; // titulaire : son 1er passage a son propre minimum
        if (b - a < minS - EPS && b < END - EPS && !(c.hit.has(p.name) && Math.abs(b - c.T) < EPS)) note(p.name + '<', `${p.name} : passage de moins de ${fmtMin(minS)}`, b - a, false);
        const run = longestRun(a, b, R.qlen, field && !fixed && p.stay ? new Set(p.stay) : null);
        if (run > maxS + EPS) note(p.name + '>', `${p.name} : plus de ${fmtMin(maxS)} d'affilée sur le terrain`, run, true);
      }
      if (!field || fixed) continue;
      // quarts où le coach a demandé qu'il ne sorte pas (après l'imprévu ; pas pendant son exclusion par un carton)
      for (const q of p.stay || []) {
        if (q >= R.quarters || (q + 1) * R.qlen <= T1 + EPS) continue;
        const a = Math.max(q * R.qlen, T1), b = (q + 1) * R.qlen;
        const cardIv = c.freezeOut.includes(p.name) ? [[c.T, T1]] : [];
        if (stayMiss([...iv, ...cardIv], [q], R.qlen, a, b) > 0.05) note(p.name + 's' + q, `${p.name} sort ${R.quarters === 2 ? 'pendant la' : 'pendant le'} ${pName(q)}, alors qu'il ne devait pas sortir`, null, true);
      }
      // banc : morceaux hors du terrain (sans la période où il était exclu par un carton)
      let t0 = 0; const off = [];
      for (const [a, b] of iv) { if (a > t0 + EPS) off.push([t0, a]); t0 = b; }
      if (t0 < END - EPS) off.push([t0, END]);
      const carded = c.freezeOut.includes(p.name);
      for (const [a, b] of off) {
        if (b < T1 + EPS || (carded && a <= c.T + EPS && b >= T1 - EPS)) continue;
        for (let q = 0; q < R.quarters; q++) {
          const qa = q * R.qlen, mb = rq(R, q, 'maxBench');
          if (qa + R.qlen <= T1 + EPS) continue;
          const d = Math.min(b, qa + R.qlen) - Math.max(a, qa);
          if (d > mb + EPS) note(p.name + 'b' + q, `${p.name} : plus de ${fmtMin(mb)} sur le banc ${R.quarters === 2 ? 'en' : 'au'} ${pName(q)}`, d, true);
        }
        if (a > EPS && b < END - EPS && b - a < R.minBench - EPS && !forced(b)) note(p.name + 'r', `${p.name} : revient après moins de ${fmtMin(R.minBench)} sur le banc`, b - a, false);
      }
      const played = iv.reduce((s, [a, b]) => s + b - a, 0), tg = c.targets[p.name] || 0;
      if (tg >= R.minPlay && played < R.minPlay - 0.5) worst.set(p.name + 'm', { txt: `${p.name} : jouera moins que le temps de jeu minimum`, v: null }); // sans chiffres : cet écran peut être vu hors de la page Coach
    }
    worst.forEach(w => out.push(w.v === null ? w.txt : `${w.txt} (${fmtMin(w.v)})`));
    return [...new Set(out)];
  }
  function finalize(segs, players, targets, warnings, events) {
    const changes = [];
    for (let i = 1; i < segs.length; i++) {
      const A = segs[i - 1].on, B = segs[i].on;
      const ins = Object.keys(B).filter(p => !(p in A)).map(p => [p, B[p]]);
      const outs = Object.keys(A).filter(p => !(p in B)).map(p => [p, A[p]]);
      const moves = Object.keys(B).filter(p => p in A && A[p] !== B[p]).map(p => [p, A[p], B[p]]);
      if (ins.length || moves.length || outs.length) changes.push({ t: segs[i].a, ins, outs, moves });
    }
    const played = {}; players.forEach(p => played[p.name] = 0);
    for (const s of segs) for (const p in s.on) if (played[p] !== undefined) played[p] += s.b - s.a;
    const iv = {}; players.forEach(p => iv[p.name] = []);
    for (const s of segs) for (const p in s.on) { const L = iv[p]; if (!L) continue; if (L.length && Math.abs(L[L.length - 1][1] - s.a) < EPS) L[L.length - 1][1] = s.b; else L.push([s.a, s.b]); }
    return { segs, changes, played, targets, intervals: iv, warnings: warnings || [], events, score: 0 };
  }

  root.Rotation = { rq, migrateRules, checkRules, buildPlan, targetsFromNotes, targetsEqual, fmtMin, changeTimes, replan, roleGaps };
  if (typeof module !== 'undefined') module.exports = root.Rotation;
})(typeof window !== 'undefined' ? window : globalThis);
