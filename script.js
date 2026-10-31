/* Aeternix website: the two-desk claim animation, the marked-up bill, and the request form. */
(function () {
  'use strict';

  var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  function fmt(n) { try { return n.toLocaleString('en-IN'); } catch (e) { return String(n); } }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function inOut(p) { return p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2; }
  function out(p) { return 1 - (1 - p) * (1 - p); }

  /* =====================================================================
     Two desks: the same twelve example claims, without and with Aeternix.
     Colours come from CSS custom properties on #sim, so the drawing
     follows the page's palette.
     ===================================================================== */

  var FONT = "'Palatino Linotype', Palatino, 'Book Antiqua', 'Aeternix Serif', serif";

  /* v: relative size of the bill.  f: what goes wrong with it (illustration only).
     A  pre-authorisation goes in thin
     B  gap at filing: a document, a code or a charge above the agreed tariff
     C  a clinical query at discharge
     D  short payment at settlement, recovered on dispute
     E  short payment at settlement, dispute lost
     P  the patient's share under the policy (co-pay, room-rent limit, non-payables) */
  var CLAIMS = [
    { v: 1.00, f: 'P' }, { v: 0.80, f: 'A' }, { v: 1.20, f: 'B' }, { v: 0.90, f: 'D' },
    { v: 1.10, f: 'C' }, { v: 0.75, f: '' },  { v: 1.25, f: 'P' }, { v: 0.90, f: 'A' },
    { v: 1.00, f: '' },  { v: 1.15, f: 'E' }, { v: 0.85, f: 'B' }, { v: 1.05, f: '' }
  ];
  var N = CLAIMS.length;
  var TOTAL = CLAIMS.reduce(function (s, c) { return s + c.v; }, 0);
  var SPAWN = 1250;
  var HOP = 850;
  var CUT = { A: 0.26, B: 0.22, D: 0.2, E: 0.2, P: 0.2 };

  var STATIONS = ['Admission', 'Pre-auth', 'Discharge', 'Settlement', 'Bank'];
  var STATIONS_C = ['Admit', 'Pre-auth', 'Discharge', 'Settle', 'Bank'];

  var TRAYS = {
    today: {
      short:    { u: 1,    label: ['Approved', 'short'] },
      deducted: { u: 2,    label: ['Deducted'] },
      counter:  { u: 2.55, label: ['Patient pays', 'at discharge'], c: ['Patient pays'], row: 1, share: true },
      writeoff: { u: 3,    label: ['Written', 'off'] }
    },
    'with': {
      told:     { u: 0.6,  label: ['Patient told', 'at admission'], c: ['Patient', 'told'], share: true },
      disputed: { u: 3,    label: ['Disputed'] }
    }
  };
  var GATES = { today: [], 'with': [0.6, 1.6] };

  function buildLane(id) {
    var lane = { id: id, claims: [], frags: [], gateEvents: [], fixes: [], counts: { bank: [], query: [], cut: [] }, arrivals: [] };

    CLAIMS.forEach(function (c, k) {
      var t = k * SPAWN;
      var u = 0;
      var segs = [];
      var widthEv = [];
      var blue = [];
      var paid = c.v;

      function hold(dur, extra) {
        var s = { t0: t, t1: t + dur, u0: u, u1: u };
        if (extra) { for (var key in extra) { s[key] = extra[key]; } }
        segs.push(s);
        t += dur;
      }
      function move(to, dur) { segs.push({ t0: t, t1: t + dur, u0: u, u1: to }); u = to; t += dur; }
      function loop(down, wait, up) {
        lane.counts.query.push(t);
        hold(down + wait + up, { loop: { down: down, wait: wait, up: up } });
      }
      function cut(kind, tray, delay, ret) {
        var tc = t + (delay || 0);
        var amt = CUT[c.f] * c.v;
        widthEv.push({ t: tc, d: -amt, dur: 320 });
        lane.frags.push({ k: k, t: tc, amt: amt, tray: tray, kind: kind, u: u, ret: ret || null });
        blue.push([tc, tc + 480]);
        if (kind !== 'dispute' || !ret) { paid -= amt; }
        return amt;
      }

      hold(260, { appear: true });

      if (id === 'today') {
        move(1, HOP);
        hold(240);
        if (c.f === 'A') { cut('leak', 'short'); lane.counts.cut.push(t); hold(520); }
        move(2, HOP);
        hold(200);
        if (c.f === 'P') { cut('share', 'counter'); hold(520); }
        if (c.f === 'B' || c.f === 'C') { loop(450, 1700, 450); }
        if (c.f === 'B') { hold(150); cut('leak', 'deducted'); lane.counts.cut.push(t); hold(520); }
        move(3, HOP);
        hold(200);
        if (c.f === 'D' || c.f === 'E') { cut('leak', 'writeoff'); lane.counts.cut.push(t); hold(520); }
      } else {
        move(0.6, HOP * 0.6);
        if (c.f === 'A' || c.f === 'P') {
          lane.gateEvents.push({ gate: 0, t0: t, t1: t + 950 });
          blue.push([t, t + 950]);
          if (c.f === 'A') { lane.fixes.push({ gate: 0, t: t + 950 }); }
          if (c.f === 'P') { cut('share', 'told', 260); }
          hold(950);
        }
        move(1, HOP * 0.4);
        hold(240);
        move(1.6, HOP * 0.6);
        if (c.f === 'B') {
          lane.gateEvents.push({ gate: 1, t0: t, t1: t + 950 });
          blue.push([t, t + 950]);
          lane.fixes.push({ gate: 1, t: t + 950 });
          hold(950);
        }
        move(2, HOP * 0.4);
        hold(200);
        if (c.f === 'C') { loop(350, 450, 350); }
        move(3, HOP);
        hold(200);
        if (c.f === 'D') {
          var amtD = cut('dispute', 'disputed', 0, { t0: t + 1500, t1: t + 2100 });
          widthEv.push({ t: t + 2100, d: amtD, dur: 300 });
          hold(2400);
        } else if (c.f === 'E') {
          cut('dispute', 'disputed', 0, null);
          lane.counts.cut.push(t + 2100);
          lane.frags[lane.frags.length - 1].lostAt = t + 2100;
          hold(2400);
        }
      }

      move(4, HOP);
      lane.counts.bank.push(t);
      lane.arrivals.push({ t: t, v: paid });
      hold(320, { leave: true });

      lane.claims.push({ c: c, segs: segs, widthEv: widthEv, blue: blue });
    });

    var offsets = {};
    lane.frags.sort(function (a, b) { return a.t - b.t; }).forEach(function (fr) {
      var o = offsets[fr.tray] || 0;
      fr.slot = o;
      offsets[fr.tray] = o + fr.amt + 0.06;
    });
    lane.end = lane.claims.reduce(function (m, cl) { return Math.max(m, cl.segs[cl.segs.length - 1].t1); }, 0);
    return lane;
  }

  function geometry(w, h) {
    var compact = w < 640;
    var m = compact ? 30 : 42;
    return {
      w: w, h: h, compact: compact, m: m, unit: (w - 2 * m) / 4,
      labelY: 22, lineY: 50, gateLabelY: 82,
      R: compact ? 13 : 17,
      trayY: 140, trayLabelY: 156, lineGap: compact ? 12 : 14,
      chipH: 10, chipBase: compact ? 20 : 28, trayW: compact ? 32 : 48, fragH: 7,
      colW: compact ? 12 : 14, colTop: 64, colBot: 140,
      fs: w < 480 ? 12 : 13, fsSmall: w < 480 ? 10.5 : (compact ? 11.5 : 12)
    };
  }
  function X(g, u) { return g.m + u * g.unit; }

  function chipWidth(cl, t) {
    var v = cl.c.v;
    for (var i = 0; i < cl.widthEv.length; i++) {
      var e = cl.widthEv[i];
      if (t >= e.t) { v += e.d * out(clamp((t - e.t) / e.dur, 0, 1)); }
    }
    return v;
  }

  function chipState(cl, t, g) {
    var segs = cl.segs;
    if (t < segs[0].t0 || t >= segs[segs.length - 1].t1) { return null; }
    for (var i = 0; i < segs.length; i++) {
      var s = segs[i];
      if (t < s.t0 || t >= s.t1) { continue; }
      var p = (t - s.t0) / (s.t1 - s.t0);
      var st = { x: X(g, s.u0 + (s.u1 - s.u0) * inOut(p)), y: g.lineY, a: 1, wait: 0 };
      if (s.appear) { st.a = out(p); }
      if (s.leave) { st.a = 1 - p; }
      if (s.loop) {
        var L = s.loop, el = t - s.t0, cx = X(g, s.u0), cy = g.lineY + g.R, ang;
        if (el < L.down) {
          ang = -Math.PI / 2 + Math.PI * inOut(el / L.down);
        } else if (el < L.down + L.wait) {
          ang = Math.PI / 2;
          st.wait = el - L.down;
        } else {
          ang = Math.PI / 2 + Math.PI * inOut((el - L.down - L.wait) / L.up);
        }
        st.x = cx + g.R * Math.cos(ang);
        st.y = cy + g.R * Math.sin(ang);
        st.loopCenter = { x: cx, y: cy };
      }
      return st;
    }
    return null;
  }

  function isBlue(cl, t) {
    for (var i = 0; i < cl.blue.length; i++) {
      if (t >= cl.blue[i][0] && t < cl.blue[i][1]) { return true; }
    }
    return false;
  }

  function countAt(list, t) {
    var n = 0;
    for (var i = 0; i < list.length; i++) { if (list[i] <= t) { n++; } }
    return n;
  }

  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function text(ctx, str, x, y, size, color, italic, align) {
    ctx.font = (italic ? 'italic ' : '') + size + 'px ' + FONT;
    ctx.fillStyle = color;
    ctx.textAlign = align || 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(str, x, y);
  }

  function readColours(el) {
    var cs = window.getComputedStyle(el);
    var get = function (name, fallback) { var v = cs.getPropertyValue(name).trim(); return v || fallback; };
    return {
      ink: get('--sim-ink', '#0A0B0D'),
      ink2: get('--sim-ink2', '#2A2E33'),
      muted: get('--sim-muted', '#5C636B'),
      blue: get('--sim-blue', '#9CC6E6'),
      line: get('--sim-line', '#CFE4F5'),
      field: get('--sim-field', '#FFFFFF'),
      blueText: get('--sim-blue-text', '#2D6A99')
    };
  }

  function drawLane(view, t, fade) {
    var ctx = view.ctx, g = view.g, lane = view.lane, id = lane.id, C = view.col;
    ctx.clearRect(0, 0, g.w, g.h);

    // Track
    ctx.strokeStyle = C.line;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(X(g, 0), g.lineY);
    ctx.lineTo(X(g, 4), g.lineY);
    ctx.stroke();

    // Station labels
    var names = g.compact ? STATIONS_C : STATIONS;
    for (var i = 0; i < 5; i++) { text(ctx, names[i], X(g, i), g.labelY, g.fs, C.ink2, false); }

    // Query loop under Discharge
    var lx = X(g, 2), ly = g.lineY + g.R;
    ctx.save();
    ctx.setLineDash([3, 4]);
    ctx.strokeStyle = C.blue;
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.arc(lx, ly, g.R, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    if (!g.compact) { text(ctx, 'Insurer query', lx + g.R + 8, ly + g.R - 2, g.fsSmall, C.muted, true, 'left'); }

    // Station nodes (the bank is the column)
    for (i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.arc(X(g, i), g.lineY, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = C.field;
      ctx.fill();
      ctx.strokeStyle = C.blue;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Our checks
    GATES[id].forEach(function (gu, gi) {
      var gx = X(g, gu), s = g.compact ? 10 : 12;
      var active = null;
      lane.gateEvents.forEach(function (e) { if (e.gate === gi && t >= e.t0 && t < e.t1) { active = e; } });
      if (active) {
        var pt = ((t - active.t0) % 640) / 640;
        var grow = s + 18 * pt;
        ctx.save();
        ctx.globalAlpha = 1 - pt;
        ctx.strokeStyle = C.blue;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(gx - grow / 2, g.lineY - grow / 2, grow, grow);
        ctx.restore();
      }
      ctx.fillStyle = active ? C.blue : C.field;
      ctx.fillRect(gx - s / 2, g.lineY - s / 2, s, s);
      ctx.strokeStyle = active ? C.ink : C.blue;
      ctx.lineWidth = 2;
      ctx.strokeRect(gx - s / 2, g.lineY - s / 2, s, s);
      text(ctx, 'Check', gx, g.gateLabelY, g.fsSmall, C.blueText, true);

      lane.fixes.forEach(function (f) {
        if (f.gate !== gi) { return; }
        var age = t - f.t;
        if (age < 0 || age > 1100) { return; }
        var a = 1 - clamp((age - 500) / 600, 0, 1);
        var ty = g.lineY - 16 - 4 * out(clamp(age / 300, 0, 1));
        ctx.save();
        ctx.globalAlpha = a * fade;
        ctx.strokeStyle = C.ink;
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(gx - 5, ty);
        ctx.lineTo(gx - 1, ty + 4);
        ctx.lineTo(gx + 6, ty - 4);
        ctx.stroke();
        ctx.restore();
      });
    });

    // Trays
    var trays = TRAYS[id];
    Object.keys(trays).forEach(function (key) {
      var tr = trays[key], tx = X(g, tr.u), half = g.trayW / 2;
      ctx.strokeStyle = tr.share ? C.blue : C.ink2;
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      ctx.moveTo(tx - half, g.trayY - 4);
      ctx.lineTo(tx - half, g.trayY);
      ctx.lineTo(tx + half, g.trayY);
      ctx.lineTo(tx + half, g.trayY - 4);
      ctx.stroke();
      var lines = (g.compact && tr.c) ? tr.c : tr.label;
      var base = g.trayLabelY + (g.compact && tr.row ? 2 * g.lineGap - 2 : 0);
      lines.forEach(function (ln, li) { text(ctx, ln, tx, base + li * g.lineGap, g.fsSmall, C.muted, true); });
    });

    // Column: paid by the insurer
    var cx = X(g, 4), cw = g.colW, colH = g.colBot - g.colTop;
    var paid = 0;
    lane.arrivals.forEach(function (a) { if (t >= a.t) { paid += a.v * out(clamp((t - a.t) / 450, 0, 1)); } });
    var fillH = colH * (paid / TOTAL) * fade;
    ctx.fillStyle = id === 'with' ? C.blue : C.ink;
    ctx.fillRect(cx - cw / 2, g.colBot - fillH, cw, fillH);
    ctx.strokeStyle = C.ink2;
    ctx.lineWidth = 1;
    ctx.strokeRect(cx - cw / 2 + 0.5, g.colTop + 0.5, cw - 1, colH - 1);
    var colLines = g.compact ? ['Insurer', 'paid'] : ['Paid by', 'the insurer'];
    colLines.forEach(function (ln, li) { text(ctx, ln, cx, g.trayLabelY + li * g.lineGap, g.fsSmall, C.muted, true); });

    ctx.save();
    ctx.globalAlpha = fade;

    // Fragments: money cut from a claim
    lane.frags.forEach(function (fr) {
      if (t < fr.t) { return; }
      var cl = lane.claims[fr.k];
      var tr = trays[fr.tray];
      var fw = Math.max(4, fr.amt * g.chipBase), fh = g.fragH;
      var tx = X(g, tr.u) - g.trayW / 2 + 3 + fr.slot * g.chipBase;
      var ty = g.trayY - fh - 1;
      var w0 = chipWidth(cl, fr.t) * g.chipBase;
      var sx = X(g, fr.u) + w0 / 2 - fw, sy = g.lineY - fh / 2;
      var p = clamp((t - fr.t) / 760, 0, 1);
      var x = sx + (tx - sx) * out(p);
      var y = sy + (ty - sy) * p * p;
      var rot = Math.sin(p * Math.PI) * 0.55;
      if (fr.ret && t >= fr.ret.t0) {
        if (t >= fr.ret.t1) { return; }
        var q = inOut(clamp((t - fr.ret.t0) / (fr.ret.t1 - fr.ret.t0), 0, 1));
        var st = chipState(cl, t, g);
        var bx = st ? st.x + chipWidth(cl, t) * g.chipBase / 2 : sx;
        x = tx + (bx - tx) * q;
        y = ty + (g.lineY - fh / 2 - ty) * q;
        rot = -Math.sin(q * Math.PI) * 0.4;
      }
      ctx.save();
      ctx.translate(x + fw / 2, y + fh / 2);
      ctx.rotate(rot);
      roundRect(ctx, -fw / 2, -fh / 2, fw, fh, 2);
      if (fr.kind === 'share') {
        ctx.fillStyle = C.blue; ctx.fill();
        ctx.strokeStyle = C.ink; ctx.lineWidth = 1; ctx.stroke();
      } else if (fr.kind === 'dispute' && !(fr.lostAt && t >= fr.lostAt)) {
        ctx.fillStyle = C.field; ctx.fill();
        ctx.strokeStyle = C.ink; ctx.lineWidth = 1.25; ctx.stroke();
      } else {
        ctx.fillStyle = C.ink; ctx.fill();
      }
      ctx.restore();
    });

    // Claims
    lane.claims.forEach(function (cl) {
      var st = chipState(cl, t, g);
      if (!st) { return; }
      var w = chipWidth(cl, t) * g.chipBase, h = g.chipH;

      if (st.wait > 0 && st.loopCenter) {
        var sweep = Math.min(st.wait / 2000, 1) * Math.PI * 2;
        ctx.strokeStyle = C.ink2;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(st.loopCenter.x, st.loopCenter.y, g.R + 6, Math.PI / 2, Math.PI / 2 + sweep);
        ctx.stroke();
      }

      ctx.save();
      ctx.globalAlpha = st.a * fade;
      roundRect(ctx, st.x - w / 2, st.y - h / 2, w, h, h / 2);
      var b = isBlue(cl, t);
      ctx.fillStyle = b ? C.blue : C.ink;
      ctx.fill();
      if (b) { ctx.strokeStyle = C.ink; ctx.lineWidth = 1.25; ctx.stroke(); }
      ctx.restore();
    });

    ctx.restore();
  }

  var sim = document.getElementById('sim');
  if (sim) {
    var built = { today: buildLane('today'), 'with': buildLane('with') };
    var END = Math.max(built.today.end, built['with'].end) + 2600;
    var FADE_MS = 700;
    var views = [];

    Array.prototype.forEach.call(sim.querySelectorAll('.lane'), function (el) {
      var canvas = el.querySelector('canvas');
      if (!canvas || !canvas.getContext) { return; }
      views.push({
        canvas: canvas,
        ctx: canvas.getContext('2d'),
        lane: built[el.getAttribute('data-lane')],
        col: readColours(sim),
        out: {
          bank: el.querySelector('[data-k="bank"]'),
          query: el.querySelector('[data-k="query"]'),
          cut: el.querySelector('[data-k="cut"]'),
          status: el.querySelector('[data-k="status"]')
        },
        last: {}
      });
    });

    var toggle = document.getElementById('sim-toggle');
    var restart = document.getElementById('sim-restart');
    var T = 0;
    var paused = false;
    var inView = true;
    var lastNow = null;
    if (reduce) { T = END - FADE_MS - 10; paused = true; }

    var resize = function () {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      views.forEach(function (v) {
        var w = v.canvas.clientWidth, h = v.canvas.clientHeight;
        if (!w || !h) { return; }
        v.canvas.width = Math.round(w * dpr);
        v.canvas.height = Math.round(h * dpr);
        v.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        v.g = geometry(w, h);
      });
    };

    var setOut = function (v, key, value) {
      if (v.out[key] && v.last[key] !== value) { v.out[key].textContent = value; v.last[key] = value; }
    };

    var render = function () {
      var fade = 1 - clamp((T - (END - FADE_MS)) / FADE_MS, 0, 1);
      views.forEach(function (v) {
        if (!v.g) { return; }
        drawLane(v, T, fade);
        var bank = countAt(v.lane.counts.bank, T);
        setOut(v, 'bank', String(bank));
        setOut(v, 'query', String(countAt(v.lane.counts.query, T)));
        setOut(v, 'cut', String(countAt(v.lane.counts.cut, T)));
        setOut(v, 'status', bank === N ? 'All twelve settled' : 'Working');
      });
      if (toggle) { toggle.textContent = paused ? 'Play' : 'Pause'; }
    };

    var frame = function (now) {
      if (lastNow === null) { lastNow = now; }
      var dt = Math.min(now - lastNow, 50);
      lastNow = now;
      if (!paused && inView && !document.hidden) {
        T += dt;
        if (T >= END) { T = 0; }
        render();
      }
      window.requestAnimationFrame(frame);
    };

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        inView = entries[entries.length - 1].isIntersecting;
      }, { threshold: 0.1 }).observe(sim);
    }
    window.addEventListener('resize', function () { resize(); render(); });
    if (toggle) {
      toggle.addEventListener('click', function () {
        if (T >= END - FADE_MS) { T = 0; }
        paused = !paused;
        render();
      });
    }
    if (restart) {
      restart.addEventListener('click', function () { T = 0; paused = false; render(); });
    }

    resize();
    render();
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { resize(); render(); });
    }
    window.requestAnimationFrame(frame);
  }

  /* =====================================================================
     The bill, read twice. Example figures only.
     Billed 1,64,500. The policy's share is 35,200: the room-rent excess,
     the proportionate cut on linked charges, and IRDAI non-medical items.
     ===================================================================== */

  var bill = document.getElementById('bill-doc');
  if (bill) {
    var STATES = {
      plain:   { billed: 164500, share: null,  cut: null, held: null,  payable: null,
                 when: '', stamp: 'Unread', hint: 'Choose a reading to mark up the bill.' },
      insurer: { billed: 164500, share: 35200, cut: 4200, held: 38000, payable: 87100,
                 when: 'learned at discharge', stamp: 'Partly paid · Query raised',
                 hint: 'Now read it the way we do, before it is sent.' },
      ours:    { billed: 162700, share: 35200, cut: 0,    held: 0,     payable: 127500,
                 when: 'told at admission', stamp: 'Checked before sending',
                 hint: 'The patient’s share is the same. What changes is everything the hospital controls.' }
    };

    var q = function (sel) { return document.querySelector(sel); };
    var buttons = document.querySelectorAll('.read-btn');
    var vals = {
      billed: q('[data-v="billed"]'),
      share: q('[data-v="share"]'),
      cut: q('[data-v="cut"]'),
      held: q('[data-v="held"]'),
      payable: q('[data-v="payable"]')
    };
    var whenEl = q('[data-t="when"]');
    var stamp = q('.stamp');
    var stampText = q('[data-t="stamp"]');
    var hint = q('[data-t="hint"]');
    var total = q('.amt-total');
    var oursBtn = q('.read-btn[data-mode="ours"]');
    var current = 'plain';
    var timers = [];

    var tween = function (el, to, delay) {
      if (!el) { return; }
      if (to === null) { el.textContent = '—'; el.removeAttribute('data-num'); return; }
      var from = el.hasAttribute('data-num') ? Number(el.getAttribute('data-num')) : 0;
      el.setAttribute('data-num', String(to));
      if (reduce || from === to) { el.textContent = fmt(to); return; }
      var start = null;
      var step = function (now) {
        if (start === null) { start = now; }
        var p = Math.min((now - start) / 750, 1);
        el.textContent = fmt(Math.round(from + (to - from) * (1 - Math.pow(1 - p, 3))));
        if (p < 1) { window.requestAnimationFrame(step); }
      };
      timers.push(window.setTimeout(function () { window.requestAnimationFrame(step); }, delay));
    };

    var setMode = function (mode) {
      if (!STATES[mode]) { return; }
      timers.forEach(window.clearTimeout);
      timers = [];
      current = mode;
      var s = STATES[mode];
      bill.setAttribute('data-mode', mode);
      Array.prototype.forEach.call(buttons, function (b) {
        b.setAttribute('aria-pressed', b.getAttribute('data-mode') === mode ? 'true' : 'false');
        b.classList.remove('nudge');
      });
      var delay = mode === 'plain' ? 0 : 900;
      tween(vals.billed, s.billed, delay);
      tween(vals.share, s.share, delay);
      tween(vals.cut, s.cut, delay + 120);
      tween(vals.held, s.held, delay + 240);
      tween(vals.payable, s.payable, delay + 360);
      tween(total, s.billed, delay);
      if (whenEl) { whenEl.textContent = s.when; }
      if (hint) { hint.textContent = s.hint; }
      if (stamp && stampText) {
        timers.push(window.setTimeout(function () {
          stampText.textContent = s.stamp;
          stamp.className = 'stamp stamp-' + mode;
          void stamp.offsetWidth;
          if (mode !== 'plain') { stamp.classList.add('thump'); }
        }, mode === 'plain' ? 0 : 1500));
      }
      if (mode === 'insurer' && oursBtn) {
        timers.push(window.setTimeout(function () {
          if (current === 'insurer') { oursBtn.classList.add('nudge'); }
        }, 2600));
      }
    };

    if (total) { total.setAttribute('data-num', '164500'); }
    if (vals.billed) { vals.billed.setAttribute('data-num', '164500'); }

    Array.prototype.forEach.call(buttons, function (b) {
      b.addEventListener('click', function () { setMode(b.getAttribute('data-mode')); });
    });

    // Mark up the bill once, the first time it is on screen.
    if ('IntersectionObserver' in window && !reduce) {
      var seen = false;
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting && !seen) {
            seen = true;
            io.disconnect();
            window.setTimeout(function () { if (current === 'plain') { setMode('insurer'); } }, 700);
          }
        });
      }, { threshold: 0.3 });
      io.observe(bill);
    }
  }

  /* =====================================================================
     Request form. Submits enquiries to Web3Forms without opening an email app.
     ===================================================================== */

  var form = document.getElementById('contact-form');
  var note = document.getElementById('form-note');
  if (form) {
    form.addEventListener('submit', async function (e) {
      e.preventDefault();

      var button = form.querySelector('button[type="submit"]');
      var originalButtonText = button ? button.textContent : '';
      if (button) {
        button.disabled = true;
        button.textContent = 'Sending...';
      }
      if (note) { note.textContent = ''; }

      try {
        var response = await fetch(form.action, {
          method: 'POST',
          body: new FormData(form)
        });
        var result = await response.json();

        if (response.ok && result.success) {
          if (note) { note.textContent = 'Thank you. Your request has been submitted successfully. We will be in touch soon.'; }
          form.reset();
        } else {
          throw new Error(result.message || 'Unable to submit your request. Please try again.');
        }
      } catch (error) {
        if (note) { note.textContent = error.message || 'Something went wrong. Please try again or email contact@aeternix.in.'; }
      } finally {
        if (button) {
          button.disabled = false;
          button.textContent = originalButtonText;
        }
      }
    });
  }
})();
