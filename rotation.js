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

  function changeTimes(R) {
    const T = new Set();
    for (let q = 0; q < R.quarters; q++) {
      const qa = q * R.qlen;
      if (q > 0 && R.breakChanges) T.add(+qa.toFixed(3));
      const from = q === 0 ? R.firstChange : R.startBlock;
      for (let m = Math.ceil(from); m <= R.qlen - R.endBlock + EPS; m += 1) T.add(+(qa + m).toFixed(3));
    }
    const F = R.from || 0; return [...T].filter(t => t > F + EPS && t < R.quarters * R.qlen).sort((a, b) => a - b);
  }

  function runOnce(I, rand, knobs) {
    const { players, posIds, lineup, R, targets, locked, can, pref, gkPos } = I;
    const END = R.quarters * R.qlen;
    const T = I.times;
    const on = new Map(); // player -> pos
    for (const q of posIds) on.set(lineup[q], q);
    const F = R.from || 0;
    const st = {}; players.forEach(p => { st[p] = { played: 0, since: (I.since && I.since[p] !== undefined) ? I.since[p] : F, onNow: on.has(p) }; });
    const segs = []; let last = F; const entriesAt = {};
    let viol = 0;
    const qStart = t => Math.floor((t + EPS) / R.qlen) * R.qlen;
    function advance(t) {
      if (t > last) { segs.push({ a: last, b: t, on: new Map(on) }); for (const p of on.keys()) st[p].played += t - last; last = t; }
    }
    for (let i = 0; i < T.length; i++) {
      const t = T[i]; advance(t);
      const next = i + 1 < T.length ? T[i + 1] : END;
      const isBreak = Math.abs(t - qStart(t)) < EPS;
      const qEnd = qStart(t) + R.qlen;
      const remain = END - t;
      const benchList = players.filter(p => !on.has(p));
      const onList = [...on.keys()];
      const need = p => (targets[p] - st[p].played) / Math.max(remain, EPS);
      // eligibility
      const canEnter = p => remain >= I.minS[p] - EPS && (t - st[p].since) >= R.minBench - EPS;
      const canLeave = p => !locked.has(p) && (t - st[p].since) >= I.minS[p] - EPS;
      const gkChangeOk = isBreak || !R.gkOnlyAtBreaks;
      // forced
      const forcedOut = onList.filter(p => !locked.has(p) && (next - st[p].since) > I.maxS[p] + EPS && canLeave(p));
      const forcedIn = benchList.filter(p => {
        if (!canEnter(p)) return false;
        const bq = Math.max(st[p].since, qStart(t));
        const nextOpp = Math.min(next, qEnd);
        return (nextOpp - bq) > R.maxBench + EPS && I.fieldPlayer[p];
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
        if (usedB.size >= R.maxEntries) break;
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
    const { players, R, targets } = I; const END = R.quarters * R.qlen;
    let dev = 0, v = res.viol, sw = 0, pc = 0;
    for (const p of players) dev += Math.abs(res.played[p] - targets[p]) + Math.max(0, Math.abs(res.played[p] - targets[p]) - 2) * 4;
    // stints & bench check
    const iv = intervals(res.segs, players);
    for (const p of players) {
      for (const [a, b] of iv[p]) {
        if (b - a < I.minS[p] - EPS && b < END - EPS) v += 1;
        if (!I.locked.has(p) && b - a > I.maxS[p] + EPS) v += 1;
      }
      if (!I.fieldPlayer[p] || I.locked.has(p)) continue;
      let t = R.from || 0; const off = [];
      for (const [a, b] of iv[p]) { if (a > t) off.push([t, a]); t = b; }
      if (t < END) off.push([t, END]);
      for (const [a, b] of off) for (let q = 0; q < R.quarters; q++) {
        const qa = q * R.qlen; if (Math.min(b, qa + R.qlen) - Math.max(a, qa) > R.maxBench + EPS) v += 1;
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
    const END = R.quarters * R.qlen;
    const F0 = R.from || 0; const grid = [F0, ...I.times, END];
    const nS = grid.length - 1; const dur = []; for (let s = 0; s < nS; s++) dur.push(grid[s + 1] - grid[s]);
    const isBreak = grid.map(t => t > 0 && Math.abs(t / R.qlen - Math.round(t / R.qlen)) < EPS);
    const qOf = s => Math.floor((grid[s] + EPS) / R.qlen);
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
          if (v && !pv) { // enter
            if (s > 0) { entries[s]++; if (gkOnly[i] && !isBreak[s]) pen += 40; if (I.oneBlock.has(p)) pen += 200; }
            if (s > 0) runStart = grid[s]; stints++;
            // bench just ended: check bench per quarter
            if (s > 0 && I.fieldPlayer[p] && !locked.has(p)) pen += benchPen(benchStart, grid[s]);
          }
          if (!v && pv) { // leave at grid[s]
            const L = grid[s] - runStart;
            if (L < I.minS[p] - EPS) pen += 300 + (I.minS[p] - L) * 30;
            if (I.minFirst[p] && Math.abs(runStart - F0) < EPS && F0 === 0 && L < I.minFirst[p] - EPS) pen += 300 + (I.minFirst[p] - L) * 30;
            if (!locked.has(p) && L > I.maxS[p] + EPS) pen += 300 + (L - I.maxS[p]) * 30;
            if (s < nS && gkOnly[i] && !isBreak[s]) pen += 40;
            benchStart = grid[s];
          }
          if (s === nS && !pv && I.fieldPlayer[p] && !locked.has(p)) pen += benchPen(benchStart, END);
          if (s < nS && !v && pv === 1 && s > 0) {
            // min bench before re-entry checked on enter below
          }
        }
        const d = Math.abs(played - targets[p]);
        pen += d * 8 + Math.max(0, d - 1.5) * 20;
        if (!F0 && I.fieldPlayer[p] && targets[p] >= R.minPlay && played < R.minPlay - EPS) pen += 30 + (R.minPlay - played) * 20;
      }
      for (let s = 1; s < nS; s++) if (entries[s]) { windows++; if (entries[s] > R.maxEntries) pen += 300 * (entries[s] - R.maxEntries); }
      return pen + windows * 3 + stints * 3 + sumSeg();
    }
    function benchPen(a, b) {
      let pen = 0;
      if (b - a < R.minBench - EPS && a > F0 + EPS && b < END) pen += 150;
      for (let q = 0; q < R.quarters; q++) {
        const qa = q * R.qlen; const ov = Math.min(b, qa + R.qlen) - Math.max(a, qa);
        if (ov > R.maxBench + EPS) pen += 300 + (ov - R.maxBench) * 30;
      }
      return pen;
    }
    function segCostOf(s) {
      const list = []; for (let i = 0; i < nP; i++) if (on[s][i]) list.push(players[i]);
      if (!canMatch(list, posIds, can)) return Infinity;
      const C = list.map(p => posIds.map(q => can[p].has(q) ? I.pref[p][q] : 1e6));
      const asg = hungarian(C); let c = 0; list.forEach((p, k) => c += C[k][asg[k]]);
      let miss = 0;
      for (const r of I.rolesAvail) if (!list.some(p => I.roles[p] && I.roles[p].includes(r))) miss++;
      return c * dur[s] * 3 + miss * dur[s] * 150;
    }
    const segCost = []; for (let s = 0; s < nS; s++) segCost.push(segCostOf(s));
    const sumSeg = () => segCost.reduce((a, b) => a + b, 0);
    let cur = score(), best = cur; let bestOn = on.map(r => r.slice());
    const free = players.map((p, i) => i).filter(i => !locked.has(players[i]));
    const T0 = 40, T1 = 0.3;
    let lastEntry = 1; for (let s = 1; s < nS; s++) if (grid[s] <= END - R.minStint + EPS) lastEntry = s;
    for (let k = 0; k < iters; k++) {
      const temp = T0 * Math.pow(T1 / T0, k / iters);
      const s0 = 1 + Math.floor(rand() * (lastEntry));
      const len = rand() < 0.5 ? 1 : 1 + Math.floor(rand() * 6);
      let s1 = Math.min(nS - 1, s0 + len - 1);
      if (s1 + 1 < nS && grid[s1 + 1] > END - R.minStint + EPS) s1 = nS - 1;
      // choose x on in all segs, y off in all segs
      const xs = free.filter(i => { for (let s = s0; s <= s1; s++) if (!on[s][i]) return false; return true; });
      const ys = free.filter(i => { for (let s = s0; s <= s1; s++) if (on[s][i]) return false; return true; });
      if (!xs.length || !ys.length) continue;
      const x = xs[Math.floor(rand() * xs.length)], y = ys[Math.floor(rand() * ys.length)];
      for (let s = s0; s <= s1; s++) { on[s][x] = 0; on[s][y] = 1; }
      const oldC = []; let ok = true;
      for (let s = s0; s <= s1; s++) { oldC.push(segCost[s]); segCost[s] = segCostOf(s); if (segCost[s] === Infinity) ok = false; }
      let nw = ok ? score() : Infinity;
      if (ok && (nw <= cur || rand() < Math.exp((cur - nw) / temp))) {
        cur = nw; if (cur < best) { best = cur; bestOn = on.map(r => r.slice()); }
      } else { for (let s = s0; s <= s1; s++) { on[s][x] = 1; on[s][y] = 0; segCost[s] = oldC[s - s0]; } }
    }
    // rebuild segs with positions (sequential hungarian, switch penalty)
    const segs = []; let prev = new Map(); for (const q of posIds) prev.set(I.lineup[q], q);
    const entriesAt = {};
    for (let s = 0; s < nS; s++) {
      const list = []; for (let i = 0; i < nP; i++) if (bestOn[s][i]) list.push(players[i]);
      let m;
      if (s === 0) m = new Map(prev);
      else {
        const C = list.map(p => posIds.map(q => {
          if (!can[p].has(q)) return 1e9;
          let c = I.pref[p][q] * 2; const pq = prev.get(p);
          if (pq !== undefined && pq !== q) c += 6; return c;
        }));
        const asg = hungarian(C); m = new Map(); list.forEach((p, k) => m.set(p, posIds[asg[k]]));
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
      pref[p.name] = {}; p.pos.forEach((q, i) => pref[p.name][q] = Math.pow(i, 1.5));
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
    const rolesAvail = [...new Set(P.flatMap(p => (p.roles || [])))];
    const maxS = {}; P.forEach(p => maxS[p.name] = p.oneBlock ? END : Math.max(R.minStint, p.minStint || 0, p.maxStint || R.maxStint));
    const I = { players, posIds, lineup, R, targets, locked, can, pref, gkPos, fieldPlayer, maxS, oneBlock, roles, rolesAvail, minFirst, minS, since: input.since || null, times: changeTimes(R) };
    const rand = rng(seed || 12345);
    let best = null, bestScore = Infinity;
    const iters = input.iters || 300;
    for (let k = 0; k < iters; k++) {
      const knobs = { thr: 0.05 + rand() * 0.5, noise: rand() * 0.4, prefW: 1 + rand() * 3, swW: 2 + rand() * 6 };
      const res = runOnce(I, rand, knobs);
      const sc = evaluate(I, res);
      if (sc < bestScore) { bestScore = sc; best = res; }
    }
    const start = best; let bestSA = null;
    for (let c = 0; c < (input.chains || 3); c++) {
      const sa = anneal(I, start, rand, input.saIters || 30000);
      if (!bestSA || sa.saScore < bestSA.saScore) bestSA = sa;
    }
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
    const check = [];
    for (const p of players) for (const [a, b] of iv[p]) {
      if (b - a < I.minS[p] - EPS && b < END - EPS) check.push(`${p} : passage de moins de ${I.minS[p]}'`);
      if (!locked.has(p) && b - a > I.maxS[p] + EPS) check.push(`${p} : passage de plus de ${I.maxS[p]}'`);
    }
    for (const p of players) {
      if (!fieldPlayer[p] || locked.has(p)) continue;
      let t = R.from || 0; const off = [];
      for (const [a, b] of iv[p]) { if (a > t) off.push([t, a]); t = b; }
      if (t < END) off.push([t, END]);
      for (const [a, b] of off) for (let q = 0; q < R.quarters; q++) {
        const qa = q * R.qlen; if (Math.min(b, qa + R.qlen) - Math.max(a, qa) > R.maxBench + EPS) check.push(`${p} : plus de ${R.maxBench}' sur le banc au Q${q + 1}`);
      }
    }
    for (const [t, n] of Object.entries(best.entriesAt)) if (n > R.maxEntries) check.push(`Trop d'entrées à ${t}'`);
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
    if (T1 > T + EPS) { // frozen period with players temporarily off (cards)
      const fr = { ...cur }; (o.freezeOut || []).forEach(p => delete fr[p]);
      prefix.push({ a: T, b: T1, on: fr });
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
    const sub = buildPlan({ positions, players: avail.map(p => ({ name: p.name, pos: p.pos, target: rem[p.name], locked: p.locked, oneBlock: p.oneBlock, maxStint: p.maxStint, roles: p.roles, minStint: p.minStint })), lineup, rules: { ...o.rules, from: T1 }, since, seed: o.seed || 7, iters: 150, saIters: o.saIters || 35000, chains: 3 });
    if (sub.error) return sub;
    const segs = prefix.concat(sub.segs);
    const merged = []; for (const s of segs) { const L = merged[merged.length - 1]; if (L && Math.abs(L.b - s.a) < EPS && JSON.stringify(L.on) === JSON.stringify(s.on)) L.b = s.b; else merged.push({ a: s.a, b: s.b, on: { ...s.on } }); }
    const res = finalize(merged, o.players, Object.fromEntries(o.players.map(p => [p.name, p.target + ((o.adjust || {})[p.name] || 0)])), [], plan.events || []);
    const hit = new Set([...(o.out || []), ...(o.freezeOut || [])]);
    const maxOf = n => { const p = o.players.find(x => x.name === n); return p.oneBlock || p.locked ? END : Math.max(o.rules.minStint, p.maxStint || o.rules.maxStint); };
    for (const n in res.intervals) for (const [a, b] of res.intervals[n]) {
      if (b <= T1 + EPS && a < T - EPS) continue;
      if (hit.has(n) && (Math.abs(b - T) < EPS)) continue;
      const mn = Math.max(o.rules.minStint, (o.players.find(x => x.name === n) || {}).minStint || 0);
      if (b - a < mn - EPS && b < END - EPS) res.warnings.push(`${n} : passage de moins de ${mn}'`);
      if (b - a > maxOf(n) + EPS) res.warnings.push(`${n} : passage de plus de ${maxOf(n)}'`);
    }
    const rl = {}; o.players.forEach(p => rl[p.name] = p.roles || []);
    res.warnings.push(...roleGaps(merged.filter(s => s.b > T1 + EPS), rl, [...new Set(avail.flatMap(p => p.roles || []))]));
    return res;
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

  root.Rotation = { buildPlan, targetsFromNotes, targetsEqual, fmtMin, changeTimes, replan, roleGaps };
  if (typeof module !== 'undefined') module.exports = root.Rotation;
})(typeof window !== 'undefined' ? window : globalThis);
