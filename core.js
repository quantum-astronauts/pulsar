/* Pulsar core: synthetic mission, personal-baseline drift detector,
   flag rules, validation scoring and the Mission Control handover packet.
   Pure functions, no DOM, so it runs in the browser and in Node tests.
   AI disclosure: written with Anthropic Claude (Claude Code), directed and reviewed
   by Team Quantum Astronauts. All mission data it generates is synthetic. */
(function (root) {
  'use strict';

  const AREAS = {
    bone:       { label: 'Bone & muscle',     blurb: 'Exercise countermeasures, resistance training, body mass' },
    cardio:     { label: 'Cardiovascular',    blurb: 'Resting heart rate, blood pressure and aerobic exercise' },
    immune:     { label: 'Immune',            blurb: 'Temperature, symptoms and viral reactivation' },
    nutrition:  { label: 'Nutrition & metabolism', blurb: 'Food intake, body mass and blood glucose' },
    behavioral: { label: 'Behavioral health', blurb: 'Sleep, mood, stress, social contact, alertness' },
  };
  const AREA_KEYS = Object.keys(AREAS);
  const STATUS = ['Nominal', 'Watch', 'Act'];

  // dir: which way is bad. lam: EWMA weight. floor: minimum SD so a very
  // steady baseline can't make tiny changes look huge. eff: smallest change
  // worth flagging. gap: how many days a reading stays "current".
  const METRICS = {
    sleep:    { emoji: '😴', title: 'Sleeping less than usual', label: 'Sleep',              unit: 'h',   dp: 1, dir: -1, lam: 0.35, floor: 0.35, eff: 0.6, gap: 1, areas: ['behavioral'] },
    exercise: { emoji: '🏃', title: 'Less exercise than usual', label: 'Exercise',           unit: 'min', dp: 0, dir: -1, lam: 0.35, floor: 12,   eff: 22,  gap: 1, areas: ['bone', 'cardio'] },
    hr:       { emoji: '❤️', title: 'Resting heart rate is up', label: 'Resting heart rate', unit: 'bpm', dp: 0, dir: 1,  lam: 0.35, floor: 2,    eff: 4,   gap: 1, areas: ['cardio'] },
    bpsys:    { emoji: '🩺', title: 'Blood pressure is up', label: 'Blood pressure (systolic)', unit: 'mmHg', dp: 0, dir: 1, lam: 0.35, floor: 4, eff: 8, gap: 3, areas: ['cardio'] },
    bpdia:    { emoji: '🩺', title: 'Diastolic pressure is up', label: 'Blood pressure (diastolic)', unit: 'mmHg', dp: 0, dir: 1, lam: 0.35, floor: 3, eff: 6, gap: 3, areas: ['cardio'] },
    temp:     { emoji: '🌡️', title: 'Temperature is up', label: 'Body temperature',   unit: '°C',  dp: 1, dir: 1,  lam: 0.35, floor: 0.15, eff: 0.35, gap: 1, areas: ['immune'] },
    intake:   { emoji: '🍽️', title: 'Eating less than planned', label: 'Food eaten',      unit: '%',   dp: 0, dir: -1, lam: 0.35, floor: 6,    eff: 12,  gap: 1, areas: ['nutrition'] },
    weight:   { emoji: '⚖️', title: 'Losing body mass', label: 'Body mass',          unit: 'kg',  dp: 1, dir: -1, lam: 1,    floor: 0.35, eff: 0.9, gap: 8, areas: ['nutrition', 'bone'] },
    glucose:  { emoji: '🩸', title: 'Fasting glucose is up', label: 'Blood glucose (fasting)', unit: 'mg/dL', dp: 0, dir: 1, lam: 1, floor: 5, eff: 12, gap: 8, areas: ['nutrition'] },
    mood:     { emoji: '🙂', title: 'Mood is lower than usual', label: 'Mood',               unit: '/10', dp: 1, dir: -1, lam: 0.35, floor: 0.7,  eff: 1,   gap: 1, areas: ['behavioral'] },
    stress:   { emoji: '😤', title: 'Stress is higher than usual', label: 'Stress',             unit: '/10', dp: 1, dir: 1,  lam: 0.35, floor: 0.7,  eff: 1.1, gap: 1, areas: ['behavioral'] },
    social:   { emoji: '💬', title: 'Less social contact', label: 'Social contact',     unit: '/5',  dp: 1, dir: -1, lam: 0.35, floor: 0.45, eff: 0.6, gap: 1, areas: ['behavioral'] },
    pvt:      { emoji: '⚡', title: 'Reactions are slower', label: 'Reaction time',      unit: 'ms',  dp: 0, dir: 1,  lam: 0.5,  floor: 15,   eff: 35,  gap: 4, areas: ['behavioral'] },
  };
  const METRIC_KEYS = Object.keys(METRICS);
  const BASE_FROM = 45, BASE_TO = 10; // baseline window: days d-45 .. d-10

  const SYMPTOMS = ['fever', 'congestion', 'sore throat', 'cough', 'fatigue', 'headache', 'nausea', 'rash', 'cold sore'];

  const ACTIONS = {
    sleep:     ['Protect a full 8.5 h sleep tonight', 'Check quarters for light, noise and CO2', 'Redo the reaction test tomorrow', 'Raise at the next medical call if it lasts'],
    sleepcrit: ['Ask the ground for a recovery sleep slot', 'No solo safety-critical tasks', 'Escalate at the next comms window'],
    exercise:  ['Note why sessions were missed', 'Book a make-up session on the backup device', 'Put resistance work first this week'],
    resist:    ['Note why sessions were missed', 'Schedule make-up resistance sessions'],
    hr:        ['Re-measure on waking, before caffeine', 'Drink more fluids today', 'Log palpitations or dizziness', 'Escalate if still up in 48 h'],
    hrhigh:    ['Re-measure lying still for 5 minutes', 'Log palpitations, dizziness or breathlessness', 'Chest pain or fainting: start the onboard emergency procedure', 'Review with the flight surgeon as communications allow'],
    weight:    ['Repeat the mass measurement', 'Check food intake this week', 'Flag it to the nutrition team'],
    mood:      ['Note what changed this week', 'Book a private call home', 'Try a behavioral-health toolkit session', 'Ask for a private psych conference if it lasts'],
    stress:    ['Check tomorrow\'s timeline for overload', 'Block a 15-minute break', 'Talk it through with a crewmate'],
    social:    ['Join the next crew meal', 'Schedule a call home'],
    pvt:       ['Redo the test after sleep', 'No solo safety-critical tasks for now', 'Check sleep and caffeine timing'],
    fever:     ['Take temperature morning and evening', 'Rest, drink fluids, pause hard exercise', 'Own utensils, wipe shared surfaces', 'Contact the flight surgeon as communications allow'],
    symptoms:  ['Log symptoms each day', 'Recheck in 24 h', 'Escalate if fever or 3+ days'],
    reactivation: ['Log size and location', 'Mention it in the handover'],
    temp:      ['Re-measure temperature tonight', 'Log any symptoms', 'Rest and drink fluids'],
    bpsys:     ['Re-measure seated after 5 min rest', 'Cut back on salt this week', 'Check sleep and stress'],
    bpdia:     ['Re-measure seated after 5 min rest', 'Cut back on salt this week', 'Check sleep and stress'],
    bphigh:    ['Re-measure twice, 1 minute apart, seated', 'No caffeine or hard exercise in the 30 minutes before', 'Log both numbers each time', 'Review with the flight surgeon as communications allow'],
    bpsevere:  ['Sit quietly and re-measure in 5 minutes', 'Chest pain, severe headache, vision change, weakness or trouble speaking: start the onboard emergency procedure now', 'Still 180 systolic or 120 diastolic or above: follow the onboard hypertension procedure', 'Contact the flight surgeon as communications allow'],
    bplow:     ['Re-measure lying, then standing', 'Drink fluids and add salt tablets if prescribed', 'Log dizziness or fainting'],
    intake:    ['Note why meals were skipped', 'Add a high-calorie snack each day', 'Flag it to the nutrition team'],
    glucose:   ['Repeat the fasting fingerstick tomorrow', 'Check intake and exercise this week', 'Mention it in the handover'],
    gluhigh:   ['Repeat the fingerstick fasting, next morning', 'Check food, fluids and exercise against plan', 'Review with the flight surgeon as communications allow', 'Very thirsty, drowsy or vomiting: start the onboard medical procedure'],
    glulow:    ['Alert and able to swallow safely: take 15 g fast-acting carbohydrate now', 'Drowsy, confused or unable to swallow safely: crewmate starts the onboard emergency procedure, nothing by mouth', 'Recheck after 15 minutes and log the result', 'Contact the flight surgeon as communications allow'],
  };

  // ---------- helpers ----------
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function gauss(r) { let u = 0; while (!u) u = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r()); }
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const round = (v, dp) => { const k = Math.pow(10, dp || 0); return Math.round(v * k) / k; };
  const mean = a => a.reduce((s, v) => s + v, 0) / a.length;
  const std = (a, m) => Math.sqrt(a.reduce((s, v) => s + (v - m) * (v - m), 0) / Math.max(1, a.length - 1));
  const num = v => (v === '' || v == null || Number.isNaN(+v)) ? null : +v;
  function fmt(key, v) {
    const M = METRICS[key];
    const s = round(v, M.dp).toFixed(M.dp);
    return M.unit.startsWith('/') || M.unit === '%' ? s + M.unit : s + ' ' + M.unit;
  }

  // ---------- synthetic mission ----------
  const EVENTS = [
    { id: 'infection', emoji: '🤒', short: 'Infection', label: 'Upper respiratory infection',   start: 48,  end: 54,  primary: 'immune',     areas: ['immune', 'cardio', 'behavioral', 'bone', 'nutrition'] },
    { id: 'sleepshift', emoji: '🌙', short: 'Sleep shift', label: 'Sleep shift before a spacewalk', start: 82,  end: 92,  primary: 'behavioral', areas: ['behavioral'] },
    { id: 'treadmill', emoji: '🛠️', short: 'Treadmill down', label: 'Treadmill out of service',        start: 115, end: 130, primary: 'bone',       areas: ['bone', 'cardio', 'nutrition'] },
    { id: 'isolation', emoji: '📡', short: 'Isolation', label: 'Comms blackout and isolation',    start: 150, end: 172, primary: 'behavioral', areas: ['behavioral', 'bone', 'cardio', 'nutrition'] },
  ];

  function generate(seed, days) {
    days = days || 180;
    const r = rng(seed);
    const base = { sleep: 6.9 + gauss(r) * 0.2, hr: 58 + gauss(r) * 2, mood: 7.2, stress: 3.4, social: 3.6, pvt: 255 + gauss(r) * 10, weight: 76 + gauss(r) * 4,
      temp: 36.6 + gauss(r) * 0.1, sys: 116 + gauss(r) * 4, dia: 74 + gauss(r) * 3, glucose: 92 + gauss(r) * 3, intake: 90 };
    const infK = [0.5, 1, 1, 0.85, 0.6, 0.4, 0.2];
    const infSym = [['sore throat'], ['fever', 'congestion', 'fatigue'], ['fever', 'congestion', 'cough', 'fatigue'], ['fever', 'congestion', 'fatigue'], ['congestion', 'cough'], ['congestion', 'fatigue'], ['fatigue']];
    const entries = [];
    let massLoss = 0;
    for (let d = 1; d <= days; d++) {
      const e = { sleep: 0, exercise: 0, hr: 0, mood: 0, stress: 0, social: 0, pvt: 0, temp: 0, sys: 0, dia: 0, intake: 0 };
      let aredP = 0.95; let sym = [];
      if (d >= 48 && d <= 54) {
        const k = infK[d - 48];
        e.hr += 9 * k; e.sleep -= 1.2 * k; e.exercise -= 75 * k; e.mood -= 1.5 * k; e.stress += 1 * k; e.pvt += 25 * k; e.temp += 1.6 * k; e.intake -= 35 * k;
        aredP = 0.3; sym = infSym[d - 48].slice(); massLoss += 0.1;
      }
      if (d >= 82 && d <= 92) { e.sleep -= 1.8; e.pvt += 70; e.stress += 1.5; e.mood -= 0.8; }
      if (d >= 115 && d <= 130) { e.exercise -= 75; aredP = 0.35; e.hr += Math.min(5, 0.35 * (d - 114)); massLoss += 0.07; }
      if (d >= 150 && d <= 172) {
        const k = Math.min(1, (d - 149) / 8);
        e.mood -= 2.8 * k; e.social -= 1.6 * k; e.stress += 2 * k; e.sleep -= 0.7 * k; e.exercise -= 15 * k; e.sys += 6 * k; e.dia += 4 * k; e.intake -= 12 * k;
      }
      if (!sym.length && r() < 0.03) sym.push(['headache', 'congestion', 'rash', 'fatigue'][Math.floor(r() * 4)]);
      if (!sym.length && r() < 0.002) sym.push('cold sore');
      const entry = {
        day: d,
        sleep: round(clamp(base.sleep + e.sleep + gauss(r) * 0.45, 3, 9.5), 1),
        exercise: Math.round(clamp(118 + e.exercise + gauss(r) * 14, 0, 200)),
        ared: r() < aredP,
        hr: Math.round(base.hr + e.hr + gauss(r) * 2.2),
        mood: Math.round(clamp(base.mood + e.mood + gauss(r) * 0.7, 1, 10)),
        stress: Math.round(clamp(base.stress + e.stress + gauss(r) * 0.7, 1, 10)),
        social: Math.round(clamp(base.social + e.social + gauss(r) * 0.5, 1, 5)),
        symptoms: sym,
        // Core temperature drifts up slowly over months in flight ("space fever"), so only a personal baseline reads it fairly.
        temp: round(base.temp + Math.min(0.6, 0.004 * d) + e.temp + gauss(r) * 0.12, 1),
        intake: Math.round(clamp(base.intake + e.intake + gauss(r) * 5, 0, 100) / 5) * 5,
        bpsys: null, bpdia: null, glucose: null, weight: null, pvt: null, note: '',
      };
      if (d % 2 === 0) { entry.bpsys = Math.round(base.sys + e.sys + gauss(r) * 5); entry.bpdia = Math.round(base.dia + e.dia + gauss(r) * 3.5); }
      if (d % 7 === 3) entry.glucose = Math.round(base.glucose + gauss(r) * 4);
      if (d % 7 === 0) entry.weight = round(base.weight - 0.004 * d - massLoss + gauss(r) * 0.3, 1);
      if (d % 3 === 0) entry.pvt = Math.round(base.pvt + e.pvt + gauss(r) * 16);
      if (d === 49) entry.note = 'Woke with sore throat and chills.';
      if (d === 116) entry.note = 'T2 treadmill down, waiting on spare part.';
      if (d === 84) entry.note = 'Sleep shifting for EVA prep.';
      entries.push(entry);
    }
    return { entries, events: EVENTS.map(ev => Object.assign({}, ev)) };
  }

  // ---------- detector ----------
  function analyse(entries) {
    const n = entries.length;
    const series = {};
    for (const key of METRIC_KEYS) {
      const M = METRICS[key];
      const out = new Array(n);
      const clean = [];
      const minN = M.gap > 1 ? (key === 'weight' ? 3 : 4) : 10;
      let ew = null, lastIdx = -1;
      for (let i = 0; i < n; i++) {
        const d = entries[i].day;
        // A same-day glucose recheck replaces that day's first fingerstick.
        const v = num(key === 'glucose' && num(entries[i].glucoseRe) != null ? entries[i].glucoseRe : entries[i][key]);
        const win = clean.filter(c => c.d >= d - BASE_FROM && c.d <= d - BASE_TO).map(c => c.v);
        let mu = null, sd = null;
        if (win.length >= minN) { mu = mean(win); sd = Math.max(std(win, mu), M.floor); }
        if (v == null) {
          const prev = lastIdx >= 0 && d - entries[lastIdx].day <= M.gap ? out[lastIdx] : null;
          out[i] = { d, v: null, ew, mu, sd, z: prev ? prev.z : 0, level: prev ? prev.level : 0 };
          continue;
        }
        ew = ew == null ? v : M.lam * v + (1 - M.lam) * ew;
        let z = 0, level = 0;
        if (mu != null) {
          z = (ew - mu) / (sd * Math.sqrt(M.lam / (2 - M.lam)));
          const bad = z * M.dir, effect = (ew - mu) * M.dir;
          if (bad >= 5 && effect >= M.eff * 1.6) level = 2;
          else if (bad >= 3 && effect >= M.eff) level = 1;
        }
        out[i] = { d, v, ew, mu, sd, z, level };
        lastIdx = i;
        if (level === 0) clean.push({ d, v });
      }
      series[key] = out;
    }
    return { entries, series };
  }

  function metricFlag(key, p, since, today) {
    const M = METRICS[key];
    const delta = p.ew - p.mu;
    const word = delta < 0 ? 'below' : 'above';
    const days = today - since + 1;
    return {
      id: key, metric: key, level: p.level, areas: M.areas.slice(), since,
      title: M.title, emoji: M.emoji,
      short: `${fmt(key, p.ew)} · normal ${fmt(key, p.mu)} · ${days} day${days === 1 ? '' : 's'}`,
      text: `${M.label} has ${delta < 0 ? 'dropped' : 'risen'} to about ${fmt(key, p.ew)}, ${fmt(key, Math.abs(delta))} ${word} your normal of ${fmt(key, p.mu)}. Flagged for ${days} day${days === 1 ? '' : 's'}.`,
      actions: ACTIONS[key],
    };
  }

  const has = (e, s) => (e.symptoms || []).indexOf(s) >= 0;

  function flagsAt(an, i) {
    const entries = an.entries, e = entries[i];
    if (!e) return [];
    const d = e.day, flags = [];
    for (const key of METRIC_KEYS) {
      const s = an.series[key], p = s[i];
      if (!p || !p.level) continue;
      let j = i; while (j > 0 && s[j - 1].level > 0) j--;
      flags.push(metricFlag(key, p.v == null ? Object.assign({}, p, { ew: lastEw(s, i) }) : p, entries[j].day, d));
    }
    const recent = []; for (let j = i; j >= 0 && entries[j].day > d - 5; j--) recent.unshift(entries[j]);
    const hot = x => has(x, 'fever') || num(x.temp) >= 38;
    const fever = recent.filter(x => x.day >= d - 1 && hot(x));
    const symDays = recent.filter(x => (x.symptoms || []).some(s => s !== 'cold sore'));
    const allSym = Array.from(new Set([].concat(...recent.map(x => x.symptoms || [])))).filter(s => s !== 'cold sore');
    if (fever.length) {
      const nHot = recent.filter(hot).length, t = num(e.temp);
      flags.push({ id: 'fever', level: 2, areas: ['immune'], since: (recent.find(hot) || e).day,
        title: 'Fever', emoji: '🌡️', short: `${t != null ? t.toFixed(1) + ' °C today · ' : ''}fever on ${nHot} of the last 5 days`, text: `Fever (38.0 °C or above, or logged as a symptom) on ${nHot} of the last 5 days, with ${allSym.filter(s => s !== 'fever').join(', ') || 'no other symptoms'}.`, actions: ACTIONS.fever });
    }
    if (!fever.length && (symDays.length >= 3 || (e.symptoms || []).filter(s => s !== 'cold sore').length >= 2)) {
      flags.push({ id: 'symptoms', level: 1, areas: ['immune'], since: symDays[0] ? symDays[0].day : d,
        title: 'Symptoms keep coming back', emoji: '🤧', short: `Symptoms on ${symDays.length} of the last 5 days`, text: `Symptoms on ${symDays.length} of the last 5 days: ${allSym.join(', ')}.`, actions: ACTIONS.symptoms });
    }
    const sores = recent.filter(x => has(x, 'cold sore'));
    if (sores.length) flags.push({ id: 'reactivation', level: 1, areas: ['immune'], since: sores[0].day,
      title: 'Possible viral reactivation', emoji: '🦠', short: 'Cold sore logged this week', text: 'Cold sore logged in the last 5 days. Latent viruses reactivate more often under spaceflight stress.', actions: ACTIONS.reactivation });

    const week = []; for (let j = i; j >= 0 && entries[j].day > d - 7; j--) if (entries[j].ared != null) week.push(entries[j]);
    if (week.length >= 5) {
      const done = week.filter(x => x.ared).length, frac = done / week.length;
      if (frac < 0.6) flags.push({ id: 'resist', level: frac < 0.35 ? 2 : 1, areas: ['bone'], since: week[week.length - 1].day,
        title: 'Missing resistance sessions', emoji: '💪', short: `${done} of the last ${week.length} days done`, text: `Resistance exercise done on ${done} of the last ${week.length} days. Bone and muscle loss speeds up without it.`, actions: ACTIONS.resist });
    }
    const last4 = recent.slice(-4).filter(x => num(x.sleep) != null && x.sleep < 5);
    if (last4.length >= 3) flags.push({ id: 'sleepcrit', level: 2, areas: ['behavioral'], since: last4[0].day,
      title: 'Severe sleep loss', emoji: '🚨', short: `Under 5 h on ${last4.length} of 4 nights`, text: `Under 5 h of sleep on ${last4.length} of the last 4 days.`, actions: ACTIONS.sleepcrit });
    const latest = (k, gap) => { for (let j = i; j >= 0 && entries[j].day > d - gap; j--) if (num(entries[j][k]) != null) return entries[j]; return null; };
    // Blood pressure: either number can raise a flag on its own; green needs both from one measurement (see logged).
    // Newer one-number entries never hide the last full reading, so the worst reading in the window stands.
    const bps = []; for (let j = i; j >= 0 && entries[j].day > d - 3; j--) {
      const x = entries[j]; if (num(x.bpsys) == null && num(x.bpdia) == null) continue;
      bps.push(x); if (num(x.bpsys) != null && num(x.bpdia) != null) break;
    }
    let bpBest = null;
    bps.forEach(bp => {
      const sy = num(bp.bpsys), di = num(bp.bpdia), txt = `${sy ?? '–'}/${di ?? '–'} mmHg ${bp.day === d ? 'today' : 'on day ' + bp.day}`;
      const over = (a, b) => [sy != null && sy >= a ? `systolic ${sy}` : '', di != null && di >= b ? `diastolic ${di}` : ''].filter(Boolean).join(' and ');
      const one = sy == null || di == null ? ' Only one number was recorded, so log both next time.' : '';
      const mk = (rank, id, level, title, line) => ({ rank, f: { id, level, areas: ['cardio'], since: bp.day, title, emoji: '🩺', short: txt, text: `Blood pressure ${txt}: ${line}.${one}`, actions: ACTIONS[id] } });
      const c = over(180, 120) ? mk(4, 'bpsevere', 2, 'Blood pressure severely high', `${over(180, 120)}, at or above 180 systolic or 120 diastolic`)
        : over(160, 100) ? mk(3, 'bphigh', 2, 'Blood pressure very high', `${over(160, 100)}, at or above 160 systolic or 100 diastolic`)
        : over(140, 90) ? mk(2, 'bphigh', 1, 'Blood pressure high', `${over(140, 90)}, at or above 140 systolic or 90 diastolic`)
        : sy != null && sy < 90 ? mk(1, 'bplow', 1, 'Blood pressure low', `systolic ${sy}, under 90`) : null;
      if (c && (!bpBest || c.rank > bpBest.rank)) bpBest = c;
    });
    if (bpBest) flags.push(bpBest.f);
    // Glucose: the latest fingerstick stands until a newer one replaces it, so an abnormal value never quietly expires.
    // A same-day recheck (glucoseRe) counts as the newest reading of that day.
    const gls = []; for (let j = i; j >= 0 && gls.length < 2; j--) {
      if (num(entries[j].glucoseRe) != null) gls.push({ v: entries[j].glucoseRe, day: entries[j].day, re: true });
      if (gls.length < 2 && num(entries[j].glucose) != null) gls.push({ v: entries[j].glucose, day: entries[j].day, re: false });
    }
    if (gls.length) {
      const g = gls[0].v, prev = gls[1] ? gls[1].v : null, txt = `${g} mg/dL ${gls[0].re ? 'on recheck ' : ''}${gls[0].day === d ? 'today' : 'on day ' + gls[0].day}`;
      const bad = v => v != null && (v < 70 || v >= 126), pending = bad(prev) ? 'Recheck also abnormal' : 'Awaiting recheck';
      if (g < 70) flags.push({ id: 'glulow', level: g < 54 ? 2 : 1, areas: ['nutrition'], since: gls[0].day, title: g < 54 ? 'Blood glucose severely low' : 'Low blood glucose', emoji: '🩸', pending,
        short: `${txt} · ${pending.toLowerCase()}`, text: `Fingerstick glucose ${txt}, under ${g < 54 ? 54 : 70} mg/dL. Treat only if you can swallow safely. Stays open until a normal recheck is logged.`, actions: ACTIONS.glulow });
      else if (g >= 126) flags.push({ id: 'gluhigh', level: g >= 200 ? 2 : 1, areas: ['nutrition'], since: gls[0].day, title: g >= 200 ? 'Blood glucose very high' : 'Glucose 126 or above: review', emoji: '🩸', pending,
        short: `${txt} · ${pending.toLowerCase()}`, text: `Fingerstick glucose ${txt}. A single fingerstick of 126 mg/dL or more is a prompt to recheck and review, not a diagnosis. Stays open until a normal recheck is logged.`, actions: ACTIONS.gluhigh });
    }
    if (num(e.hr) != null && e.hr >= 90) flags.push({ id: 'hrhigh', level: 1, areas: ['cardio'], since: d,
      title: 'Resting heart rate 90 or above: review', emoji: '❤️', short: `${e.hr} bpm today`, text: `Resting heart rate logged at ${e.hr} bpm today. 90 or above at rest is a prompt to re-measure and review.`, actions: ACTIONS.hrhigh });
    // A clinical-line alert already explains the matching drift, so show one alert, not two.
    const covers = { fever: ['temp'], bpsevere: ['bpsys', 'bpdia'], bphigh: ['bpsys', 'bpdia'], bplow: ['bpsys', 'bpdia'], gluhigh: ['glucose'], glulow: ['glucose'], hrhigh: ['hr'] };
    const hidden = [].concat(...flags.map(f => covers[f.id] || []));
    const out = flags.filter(f => hidden.indexOf(f.id) < 0);
    return out.sort((a, b) => b.level - a.level);
  }
  function lastEw(s, i) { for (let j = i; j >= 0; j--) if (s[j].v != null) return s[j].ew; return s[i].ew; }

  function areaSeries(an) {
    let open = {};
    return an.entries.map((e, i) => {
      const flags = flagsAt(an, i), lv = {}, now = {};
      // An alert that stays open keeps the day it opened, so ticked steps stay attached to it.
      flags.forEach(f => { if (open[f.id] != null) f.since = Math.min(f.since, open[f.id]); now[f.id] = f.since; });
      open = now;
      AREA_KEYS.forEach(a => { lv[a] = 0; });
      flags.forEach(f => f.areas.forEach(a => { lv[a] = Math.max(lv[a], f.level); }));
      return { day: e.day, lv, flags };
    });
  }

  function baselineReady(an, i) {
    return ['sleep', 'hr', 'mood'].every(k => an.series[k][i] && an.series[k][i].mu != null);
  }

  // ---------- coverage ----------
  // What each risk area needs logged before "Nominal" means anything.
  const NEEDS = { bone: ['exercise', 'ared'], cardio: ['hr', 'bpsys', 'bpdia', 'exercise'], immune: ['temp', 'symptoms'], nutrition: ['intake', 'weight', 'glucose'], behavioral: ['sleep', 'mood', 'stress', 'social'] };
  const INPUTS = { ared: 'Resistance session', symptoms: 'Symptom check' };
  const inputLabel = k => METRICS[k] ? METRICS[k].label : INPUTS[k];
  const logged = (x, k) => k === 'bpsys' || k === 'bpdia' ? num(x.bpsys) != null && num(x.bpdia) != null : k === 'symptoms' ? Array.isArray(x.symptoms) : k === 'ared' ? x.ared != null : num(x[k]) != null;

  // 'missing': no reading recent enough to judge today; 'learning': readings, but no personal baseline yet.
  function inputState(an, k, i) {
    const E = an.entries, d = E[i].day, gap = METRICS[k] ? METRICS[k].gap : 1;
    let j = i; while (j >= 0 && E[j].day > d - gap && !logged(E[j], k)) j--;
    if (j < 0 || E[j].day <= d - gap) return 'missing';
    if (METRICS[k]) return an.series[k][i].mu == null ? 'learning' : 'ok';
    if (k === 'ared') { let n = 0; for (let m = i; m >= 0 && E[m].day > d - 7; m--) if (E[m].ared != null) n++; return n >= 5 ? 'ok' : 'learning'; }
    return 'ok';
  }
  function coverage(an, i) {
    const out = {};
    AREA_KEYS.forEach(a => {
      const missing = [], learning = [];
      NEEDS[a].forEach(k => { const st = inputState(an, k, i); if (st === 'missing') missing.push(inputLabel(k)); else if (st === 'learning') learning.push(inputLabel(k)); });
      out[a] = { state: missing.length ? 'missing' : learning.length ? 'learning' : 'ok', missing, learning };
    });
    return out;
  }

  // ---------- routine ----------
  // Measurements prompted as part of the mission day, with how often each is due.
  const ROUTINE = [
    { id: 'checkin', label: 'Daily check-in', every: 1, key: 'sleep', view: 'checkin' },
    { id: 'temp', label: 'Morning temperature', every: 1, key: 'temp', view: 'checkin' },
    { id: 'ared', label: 'Resistance session', every: 1, key: 'ared', view: 'checkin' },
    { id: 'bp', label: 'Blood pressure', every: 2, key: 'bpsys', view: 'checkin' },
    { id: 'pvt', label: 'Reaction test', every: 3, key: 'pvt', view: 'pvt' },
    { id: 'weight', label: 'Body mass (SLAMMD)', every: 7, key: 'weight', view: 'checkin' },
    { id: 'glucose', label: 'Fasting glucose', every: 7, key: 'glucose', view: 'checkin' },
  ];
  const done = (x, t) => t.key === 'ared' ? x.ared === true : t.key === 'bpsys' ? logged(x, 'bpsys') : num(x[t.key]) != null;
  // State of each task on mission day `day` (defaults to the day of entry i).
  function routine(an, i, day) {
    const E = an.entries, d = day == null ? (E[i] ? E[i].day : 1) : day;
    const upto = E.slice(0, i + 1);
    const tasks = ROUTINE.map(t => {
      let last = null; for (let j = upto.length - 1; j >= 0; j--) if (done(upto[j], t)) { last = upto[j].day; break; }
      const ago = last == null ? null : d - last;
      const state = ago === 0 ? 'done' : ago != null && ago < t.every ? 'ok' : ago == null || ago === t.every ? 'due' : 'overdue';
      return Object.assign({}, t, { last, state, next: last == null ? d : last + t.every, late: ago == null ? 0 : Math.max(0, ago - t.every) });
    });
    // Streak: consecutive days, ending today, with a full daily check-in.
    const full = x => ['sleep', 'hr', 'temp', 'mood'].every(k => num(x[k]) != null) && Array.isArray(x.symptoms);
    let streak = 0; for (let j = upto.length - 1; j >= 0 && upto[j].day === d - streak && full(upto[j]); j--) streak++;
    // Week score: share of due measurements actually taken over the last 7 days.
    let due = 0, got = 0;
    ROUTINE.forEach(t => { for (let k = d - 6; k <= d; k++) if (k >= 1 && (k - 1) % t.every === 0) { due++; if (upto.some(x => x.day > k - t.every && x.day <= Math.min(d, k + t.every - 1) && done(x, t))) got++; } });
    return { day: d, tasks, streak, week: due ? Math.round(got / due * 100) : 0 };
  }

  // ---------- validation ----------
  function episodes(as, area) {
    const eps = []; let cur = null;
    for (const r of as) {
      if (r.lv[area] > 0) {
        if (cur && r.day - cur.end <= 3) { cur.end = r.day; cur.peak = Math.max(cur.peak, r.lv[area]); }
        else { cur = { area, start: r.day, end: r.day, peak: r.lv[area] }; eps.push(cur); }
      }
    }
    return eps;
  }

  function evaluate(as, events) {
    const res = events.map(ev => {
      const hit = episodes(as, ev.primary).find(ep => ep.end >= ev.start && ep.start <= ev.end + 5);
      return { event: ev, detected: !!hit, firstFlag: hit ? Math.max(hit.start, ev.start) : null, latency: hit ? Math.max(hit.start, ev.start) - ev.start : null, peak: hit ? hit.peak : 0 };
    });
    const falseAlarms = [];
    AREA_KEYS.forEach(a => episodes(as, a).forEach(ep => {
      const explained = events.some(ev => ev.areas.indexOf(a) >= 0 && ep.end >= ev.start && ep.start <= ev.end + 7);
      if (!explained) falseAlarms.push(ep);
    }));
    const monitored = Math.max(1, (as.length ? as[as.length - 1].day : 0) - 20);
    const lat = res.filter(r => r.detected).map(r => r.latency);
    return {
      results: res, falseAlarms,
      caught: res.filter(r => r.detected).length, total: res.length,
      meanLatency: lat.length ? mean(lat) : null,
      faPer30: falseAlarms.length / monitored * 30,
    };
  }

  function evaluateSeeds(seeds) {
    const runs = seeds.map(seed => {
      const m = generate(seed);
      return Object.assign({ seed }, evaluate(areaSeries(analyse(m.entries)), m.events));
    });
    const perEvent = EVENTS.map(ev => {
      const rs = runs.map(r => r.results.find(x => x.event.id === ev.id));
      const lat = rs.filter(x => x.detected).map(x => x.latency);
      return { event: ev, caught: rs.filter(x => x.detected).length, meanLatency: lat.length ? mean(lat) : null };
    });
    return {
      runs, perEvent, missions: runs.length,
      sensitivity: runs.reduce((s, r) => s + r.caught, 0) / runs.reduce((s, r) => s + r.total, 0),
      faPer30: mean(runs.map(r => r.faPer30)),
    };
  }

  // ---------- handover ----------
  function handover(an, as, i, windowDays, done, crew) {
    const e = an.entries[i], d = e.day, from = d - windowDays + 1;
    const win = an.entries.slice(0, i + 1).filter(x => x.day >= from);
    const flags = as[i].flags;
    const doneCount = f => (f.actions || []).filter((_, k) => done[`${f.id}@${f.since}#${k}`]).length;
    const trends = {};
    METRIC_KEYS.forEach(key => {
      const p = an.series[key][i], vals = win.map(x => num(x[key])).filter(v => v != null);
      if (!vals.length) return;
      trends[key] = { unit: METRICS[key].unit, normal: p.mu == null ? null : round(p.mu, METRICS[key].dp + 1),
        recent: round(mean(vals.slice(-7)), METRICS[key].dp + 1), status: STATUS[p.level] };
    });
    const resolved = [];
    AREA_KEYS.forEach(a => episodes(as.slice(0, i + 1), a).forEach(ep => {
      if (ep.end >= from && ep.end < d) resolved.push({ area: a, from: ep.start, to: ep.end, peak: STATUS[ep.peak] });
    }));
    const overall = Math.max(0, ...AREA_KEYS.map(a => as[i].lv[a]));
    const cov = coverage(an, i), gaps = AREA_KEYS.some(a => !as[i].lv[a] && cov[a].state !== 'ok');
    const areaStatus = a => as[i].lv[a] ? STATUS[as[i].lv[a]] : cov[a].state === 'missing' ? 'No data' : cov[a].state === 'learning' ? 'Learning' : 'Nominal';
    return {
      format: 'pulsar-handover/1',
      crew: crew || 'CM-1',
      generatedAt: new Date().toISOString(),
      missionDay: d,
      window: { from: Math.max(from, an.entries[0].day), to: d, checkIns: win.length },
      overall: overall || !gaps ? STATUS[overall] : 'Incomplete',
      risks: AREA_KEYS.map(a => ({ area: a, status: areaStatus(a), flags: flags.filter(f => f.areas.indexOf(a) >= 0).map(f => f.id), missing: cov[a].missing, learning: cov[a].learning })),
      priorities: flags.map(f => ({ id: f.id, level: STATUS[f.level], title: f.title, detail: f.text, since: f.since, escalate: f.level === 2, recheck: f.pending || null, actionsDone: `${doneCount(f)}/${(f.actions || []).length}` })),
      resolvedSinceLast: resolved,
      trends,
      adherence: {
        exerciseAvgMin: Math.round(mean(win.map(x => num(x.exercise)).filter(v => v != null).concat(win.length ? [] : [0]))),
        resistanceDays: `${win.filter(x => x.ared).length}/${win.filter(x => x.ared != null).length}`,
      },
      symptomLog: win.filter(x => (x.symptoms || []).length).map(x => ({ day: x.day, symptoms: x.symptoms })),
      notes: win.filter(x => x.note).map(x => ({ day: x.day, note: x.note })),
    };
  }

  function downlinkText(p) {
    const lines = [`PULSAR ${p.crew} MD${p.missionDay} ${p.overall.toUpperCase()} (MD${p.window.from}-${p.window.to}, ${p.window.checkIns} check-ins)`];
    p.risks.forEach(r => lines.push(`${AREAS[r.area].label}: ${r.status}`));
    if (p.priorities.length) {
      lines.push('Open items:');
      p.priorities.forEach(f => lines.push(`- [${f.level}${f.escalate ? ', escalate' : ''}] ${f.title} since MD${f.since}, actions ${f.actionsDone}`));
    } else lines.push('No open items.');
    if (p.resolvedSinceLast.length) lines.push('Resolved: ' + p.resolvedSinceLast.map(r => `${AREAS[r.area].label} MD${r.from}-${r.to}`).join('; '));
    lines.push(`Exercise avg ${p.adherence.exerciseAvgMin} min/day, resistance ${p.adherence.resistanceDays} days`);
    return lines.join('\n');
  }

  root.Core = { AREAS, AREA_KEYS, STATUS, METRICS, METRIC_KEYS, SYMPTOMS, ACTIONS, EVENTS,
    generate, analyse, flagsAt, areaSeries, baselineReady, inputState, coverage, routine, ROUTINE, NEEDS, episodes, evaluate, evaluateSeeds, handover, downlinkText, fmt, round, mean, num };
})(typeof window !== 'undefined' ? window : globalThis);
