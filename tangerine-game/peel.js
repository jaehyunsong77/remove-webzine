/* 감귤 껍질 한 줄 까기 v2.0 (Claude Code 버전)
 * v2.0: 표정을 더 앙증맞게(가운데로 모인 눈 · 큰 입 · 볼터치) + v1.5 힘 바 복구 + 끊어진 이유(힘/점선/손 뗌) 구분
 *       + 결과 버튼(메인으로 · 다시하기/다음 단계) + 제주 감귤따기 체험 상세(운영 웹진) 연결. 점수·최고점수·랭킹은 v1.9와 같음.
 * v1.9: 시작 화면 큰 감귤에 웃는 표정(테두리 없이 눈·코·입만) + 단계별 TOP 5 랭킹
 *       (공유 링크: 함께 보는 사람들 기록 / 로컬: 이 기기 기록). 점수·최고점수 저장은 v1.8과 같음.
 * v1.8: v1.7 디자인 그대로 + 온글잎 하루나눔 글씨 + 작은 웃는 감귤(외곽선 없는 종이 질감, 준비·결과 화면)
 *       + v1.6 점수 방식을 다듬어 재사용(이어 벗긴 길이 + 완주 + 정확도 + 시간) + 단계별 최고점수 저장·갱신 표시.
 * 목표: 첫 번째 4단계 시안(시작 · 준비 · 까기 · 완성)을 웹게임으로 최대한 그대로 옮기기.
 * 조작·판정·난이도는 v1.6과 같음: 시작점을 누른 채 손을 떼지 않고 나선 점선을 따라가면 껍질이 한 줄로 벗겨짐.
 * 점선에서 크게 벗어나거나(off) · 너무 빨리 당기거나(fast) · 손을 떼면(lift) 끊어짐. 아기귤 → 보통귤 → 대왕귤 순서대로.
 * v1.7: 시안처럼 거친 종이 질감 감귤, 위쪽 꼭지·잎, 화면 중앙에 크게, 넓고 말리며 늘어지는 껍질,
 *       결과는 '완성!' · 큰 깐 감귤 · 기록(시간) · 다시하기/메인으로 만. */
(() => {
  'use strict';

  const CFG = Object.assign({ webzineUrl: '', experienceUrl: '', experienceLabel: '감귤따기 체험 보러 가기', saveKey: 'remove-peel20' }, window.RE_PEEL_CONFIG || {});
  const TAU = Math.PI * 2;
  const WW = 360, CX = 180;
  const SEG = 7, CM_PER_UNIT = 0.04;            // 껍질 길이: 나선 길이 1 = 0.04cm (아기귤 약 38cm · 보통귤 57cm · 대왕귤 79cm)
  const PH = -Math.PI / 2, TH0 = Math.PI * 0.6;
  const PEEL_W = 0.72;                          // 한 바퀴 띠 간격 중 실제로 벗겨지는 폭(나머지는 바퀴 사이에 남는 껍질)
  const VIEW_R = 150;                           // 화면에 보이는 귤 반지름(가로 360 기준) — 시안처럼 화면 폭의 약 80%

  // 단계(v1.6과 같음): 바퀴가 늘수록 껍질이 길어지고, 허용 폭(tol)과 속도 한계(vN·vT)가 빡빡해짐. par = 시간 보너스 기준(초), mult = 점수 배수
  const STAGES = [
    { name: '아기귤', RT: 118, turns: 3, tol: 0.78, zones: 0, vN: 460, vT: 260, par: 16, mult: 1 },
    { name: '보통귤', RT: 128, turns: 4, tol: 0.62, zones: 2, vN: 380, vT: 210, par: 24, mult: 1.5 },
    { name: '대왕귤', RT: 138, turns: 5, tol: 0.5, zones: 3, vN: 330, vT: 180, par: 32, mult: 2 },
  ];
  const CAUSE = { done: '한 줄로 다 벗겼어요', fast: '힘이 너무 세서 끊어졌어요', off: '점선을 벗어나 끊어졌어요', lift: '손을 떼서 끊어졌어요' };
  // 끊어진 이유를 한눈에: 짧은 이름표 + 다음 판 요령
  const CAUSE_TAG = { fast: '힘 초과', off: '경로 이탈', lift: '손 뗌' };
  const CAUSE_TIP = { fast: '힘 바가 빨간 눈금을 넘지 않게, 조금 천천히 당겨 보세요', off: '하얀 점선 위를 그대로 따라가 보세요', lift: '끝까지 손가락을 떼지 말고 따라가 보세요' };

  const $ = (id) => document.getElementById(id);
  const app = $('app'), board = $('board'), cv = $('cv'), ctx = cv.getContext('2d');
  const hud = $('hud'), guide = $('guide'), hintEl = $('hint'), pop = $('pop'), live = $('live');
  const sheetStart = $('start'), sheetOver = $('over');
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rand = (a, b) => a + Math.random() * (b - a);
  const fmt = (n) => n.toLocaleString('ko-KR');
  const mmss = (sec) => { const t = Math.max(0, Math.floor(sec)); return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`; };

  /* ---------- 저장(단계별 최고점수·최고 길이, 깬 단계, 소리) — 아기귤·보통귤·대왕귤 따로 ---------- */
  const save = (() => {
    let d = { best: [0, 0, 0], bestCm: [0, 0, 0], clear: [false, false, false], sound: true, runs: [[], [], []] };
    try { d = Object.assign(d, JSON.parse(localStorage.getItem(CFG.saveKey) || '{}')); } catch (e) { /* 처음이거나 막힘 */ }
    // 저장할 때 이미 저장된 값과 합침(단계별로 더 높은 기록을 남김) → 같은 게임을 탭 두 개로 열어도 기록이 내려가지 않음
    const sync = () => {
      try {
        const o = JSON.parse(localStorage.getItem(CFG.saveKey) || '{}');
        for (let i = 0; i < 3; i++) {
          if (o.best) d.best[i] = Math.max(d.best[i], o.best[i] || 0);
          if (o.bestCm) d.bestCm[i] = Math.max(d.bestCm[i], o.bestCm[i] || 0);
          if (o.clear) d.clear[i] = d.clear[i] || !!o.clear[i];
          if (o.runs && o.runs[i]) d.runs[i] = topRuns([...(d.runs[i] || []), ...o.runs[i]]);
        }
      } catch (e) { /* 읽지 못해도 동작 */ }
    };
    return { d, sync, write() { sync(); try { localStorage.setItem(CFG.saveKey, JSON.stringify(d)); } catch (e) { /* 저장 못 해도 동작 */ } } };
  })();

  /* ---------- 소리 · 진동(소리 버튼 하나로 같이 켜고 끔) ---------- */
  let ac = null, noise = null;
  function ensureAudio() {
    if (!ac) {
      const C = window.AudioContext || window.webkitAudioContext;
      if (!C) return;
      ac = new C();
      noise = ac.createBuffer(1, ac.sampleRate * 0.3, ac.sampleRate);
      const d = noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ac.state === 'suspended') ac.resume();
  }
  function tone(f, d = 0.08, type = 'sine', v = 0.07, f2 = 0, delay = 0) {
    if (!save.d.sound || !ac) return;
    const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g).connect(ac.destination); o.start(t); o.stop(t + d + 0.02);
  }
  function hiss(d, v, freq) {
    if (!save.d.sound || !ac) return;
    const t = ac.currentTime, s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noise; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 1.2;
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    s.connect(f).connect(g).connect(ac.destination); s.start(t, Math.random() * 0.2, d + 0.02);
  }
  function buzz(p) {
    const ua = navigator.userActivation;
    if (save.d.sound && navigator.vibrate && (!ua || ua.hasBeenActive)) navigator.vibrate(p);
  }
  const sfx = {
    tap: () => tone(880, 0.05, 'triangle', 0.05, 1200),
    grab: () => { tone(620, 0.07, 'triangle', 0.06, 930); buzz(10); },
    rip: () => hiss(0.05, 0.05, rand(1800, 3200)),
    cheer: () => { tone(784, 0.07, 'triangle', 0.05); tone(1046, 0.1, 'triangle', 0.05, 0, 0.07); },
    warn: () => { tone(1300, 0.03, 'square', 0.018); buzz(8); },
    tear: () => { hiss(0.22, 0.16, 900); tone(300, 0.14, 'triangle', 0.06, 190); buzz([30, 30, 60]); },
    done: () => { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.15, 'triangle', 0.06, 0, i * 0.09)); buzz([20, 40, 60]); },
  };

  /* ---------- 단계별 나선 ---------- */
  let st = STAGES[0], RT = 128, SP = 30, B = 1, THMAX = 1, TOL = 18, TOTAL = 1;
  let CY = 400, WH = 760, s = 1, ox = 0, dpr = 1, Z = 1.2;
  const FY = 0.9;   // 세로로 살짝 눌러 납작하게
  const arc = (a, b) => (B * (b * b - a * a)) / 2;
  const pt = (th) => [CX + B * th * Math.cos(th + PH), CY + B * th * Math.sin(th + PH)];
  // 귤 그림·판정은 '귤 좌표'(완전한 원 나선). 화면에는 Z배 크게, 세로는 FY만큼 납작하게
  const W = (p) => [CX + (p[0] - CX) * Z, CY + (p[1] - CY) * FY * Z];
  const fromScreen = (x, y) => [CX + (x - CX) / Z, CY + (y - CY) / (FY * Z)];
  function setStage(i) {
    st = STAGES[i]; RT = st.RT;
    SP = RT / (st.turns + 0.5); B = SP / TAU; THMAX = (RT - SP / 2) / B; TOL = SP * st.tol;
    TOTAL = arc(TH0, THMAX);
    Z = VIEW_R / (RT * 1.03);   // 단계마다 귤 크기가 달라도 화면에서는 같은 크기로 크게
    layout();
  }
  function layout() {
    const r = board.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
    WH = clamp(r.height * (WW / r.width), 520, 900);
    s = Math.min(r.width / WW, r.height / WH);
    ox = (r.width - WW * s) / 2;
    const RVy = VIEW_R * FY;
    CY = clamp(WH * 0.52, 176 / s + RVy, WH - RVy - 150 / s);
    if (layers) { layers = makeLayers(s * dpr * Z); layers.erase(0, th); }
  }

  /* ---------- 손그림 재료: 과슈 같은 거친 입자 · 불규칙한 윤곽 ---------- */
  const seeded = (seed) => { let sd = seed; return () => (sd = (sd * 16807) % 2147483647) / 2147483647; };
  const grains = {};
  // kind: 'peel'(주황 위 밝은·어두운 입자) / 'flesh'(과육 위 흰 입자) / 'leaf'
  function grain(g, kind = 'peel') {
    if (!grains[kind]) {
      const c = document.createElement('canvas'); c.width = c.height = 160;
      const q = c.getContext('2d'), rnd = seeded(kind === 'peel' ? 77 : kind === 'flesh' ? 91 : 13);
      const n = kind === 'peel' ? 2600 : 1400;
      for (let i = 0; i < n; i++) {
        const x = rnd() * 160, y = rnd() * 160, r = 0.35 + rnd() * (rnd() < 0.08 ? 1.6 : 0.9), lite = rnd() < 0.58;
        q.fillStyle = kind === 'peel' ? (lite ? `rgba(255,198,120,${0.16 + rnd() * 0.3})` : `rgba(196,80,0,${0.08 + rnd() * 0.18})`)
          : kind === 'flesh' ? (lite ? `rgba(255,252,240,${0.2 + rnd() * 0.35})` : `rgba(230,140,50,${0.06 + rnd() * 0.12})`)
            : (lite ? `rgba(200,235,170,${0.15 + rnd() * 0.25})` : `rgba(40,90,30,${0.08 + rnd() * 0.15})`);
        q.beginPath(); q.ellipse(x, y, r, r * (0.6 + rnd() * 0.4), rnd() * 3, 0, TAU); q.fill();
      }
      grains[kind] = c;
    }
    return g.createPattern(grains[kind], 'repeat');
  }
  // 손으로 그린 듯한 타원(울퉁불퉁 + 가장자리가 살짝 거침)
  function wobble(g, x, y, rx, ry, seed = 1) {
    g.beginPath();
    for (let i = 0; i <= 120; i++) {
      const a = (i / 120) * TAU;
      const k = 1 + 0.022 * Math.sin(3 * a + seed) + 0.012 * Math.sin(5 * a + seed * 2.3) + 0.004 * Math.sin(17 * a + seed) + 0.003 * Math.sin(41 * a + seed * 3);
      i ? g.lineTo(x + Math.cos(a) * rx * k, y + Math.sin(a) * ry * k) : g.moveTo(x + rx * k, y);
    }
    g.closePath();
  }
  // 감귤 껍질 칠하기(시작 화면 · 결과 · 게임판 공통): 선명한 주황 + 아래·오른쪽 부드러운 그늘 + 왼쪽 위 밝은 기운 + 거친 입자
  function paintOrange(g, shape, x, y, rx, ry) {
    shape(); g.fillStyle = '#f5871f'; g.fill();
    g.save(); shape(); g.clip();
    const sh = g.createRadialGradient(x - rx * 0.25, y - ry * 0.3, Math.min(rx, ry) * 0.3, x, y, Math.max(rx, ry) * 1.08);
    sh.addColorStop(0, 'rgba(255,170,80,.42)'); sh.addColorStop(0.55, 'rgba(245,135,31,0)'); sh.addColorStop(1, 'rgba(200,82,0,.42)');
    g.fillStyle = sh; g.fillRect(x - rx * 1.2, y - ry * 1.2, rx * 2.4, ry * 2.4);
    g.fillStyle = grain(g, 'peel'); g.fillRect(x - rx * 1.2, y - ry * 1.2, rx * 2.4, ry * 2.4);
    g.restore();
    shape(); g.strokeStyle = 'rgba(214,98,14,.55)'; g.lineWidth = Math.max(1, rx * 0.012); g.stroke();
  }
  function leaf(g, x, y, len, ang) {
    g.save(); g.translate(x, y); g.rotate(ang);
    const shape = () => { g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(len * 0.25, -len * 0.42, len * 0.72, -len * 0.42, len, -len * 0.08); g.bezierCurveTo(len * 0.7, len * 0.22, len * 0.3, len * 0.2, 0, 0); g.closePath(); };
    shape(); g.fillStyle = '#6aa84f'; g.fill();
    g.save(); shape(); g.clip();
    g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(len * 0.3, len * 0.18, len * 0.7, len * 0.2, len, -len * 0.08); g.lineTo(len, len); g.lineTo(0, len); g.closePath(); g.fillStyle = 'rgba(60,120,40,.35)'; g.fill();
    g.fillStyle = grain(g, 'leaf'); g.fillRect(0, -len, len, len * 2);
    g.restore();
    g.beginPath(); g.moveTo(len * 0.04, -len * 0.01); g.quadraticCurveTo(len * 0.5, -len * 0.12, len * 0.92, -len * 0.08); g.strokeStyle = 'rgba(210,240,180,.6)'; g.lineWidth = Math.max(1, len * 0.025); g.lineCap = 'round'; g.stroke();
    g.restore();
  }
  function stem(g, x, y, h) {
    g.beginPath(); g.moveTo(x, y); g.lineTo(x - h * 0.06, y - h);
    g.strokeStyle = '#6e4a2e'; g.lineWidth = Math.max(3, h * 0.22); g.lineCap = 'round'; g.stroke();
  }
  // 시안의 '반짝 표시' 세 줄
  function accents(g, x, y, r, a0, color = '#f5871f', w = 3, len = r * 0.14) {
    g.save(); g.strokeStyle = color; g.lineWidth = w; g.lineCap = 'round';
    const spread = Math.min(0.36, (len * 1.3) / r);
    for (let i = 0; i < 3; i++) {
      const a = a0 + (i - 1) * spread, r1 = r, r2 = r + len * (i === 1 ? 1 : 0.72);
      g.beginPath(); g.moveTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1); g.lineTo(x + Math.cos(a) * r2, y + Math.sin(a) * r2); g.stroke();
    }
    g.restore();
  }
  function groundShadow(g, x, y, rx, ry) {
    g.save(); g.translate(x, y); g.scale(1, ry / rx);
    const gr = g.createRadialGradient(0, 0, rx * 0.2, 0, 0, rx);
    gr.addColorStop(0, 'rgba(232,206,170,.75)'); gr.addColorStop(0.7, 'rgba(236,214,182,.5)'); gr.addColorStop(1, 'rgba(240,222,196,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, rx, 0, TAU); g.fill();
    g.restore();
  }

  const deco = (() => {
    const rnd = seeded(5);
    const veins = [], vesicles = [], cuts = [], blots = [];
    let acc = rnd() * TAU; const n = 11;
    for (let i = 0; i < n; i++) { cuts.push(acc); acc += (TAU / n) * (0.82 + rnd() * 0.36); }
    const sc = TAU / (acc - cuts[0]); for (let i = 0; i < n; i++) cuts[i] = cuts[0] + (cuts[i] - cuts[0]) * sc;
    for (let i = 0; i < 300; i++) { const a = rnd() * TAU, r = 0.12 + Math.sqrt(rnd()) * 0.86; vesicles.push([a, r, 1.2 + rnd() * 1.8, rnd()]); }
    for (let i = 0; i < 26; i++) veins.push({ a0: rnd() * TAU, bend: (rnd() - 0.5) * 1.1, len: 0.35 + rnd() * 0.6, w: 0.8 + rnd() * 1.6, r0: 0.04 + rnd() * 0.35 });
    for (let i = 0; i < 18; i++) blots.push([rnd() * TAU, 0.15 + rnd() * 0.8, 3 + rnd() * 7, rnd() * 3]);
    return { veins, vesicles, cuts, blots };
  })();

  // 껍질 바깥선: 원보다 살짝 크고 울퉁불퉁 + 가장자리 거침(나선 끝보다 항상 바깥이라 판정에 영향 없음)
  const peelR = (a) => RT * (1.03 + 0.01 * Math.sin(3 * a + 0.7) + 0.006 * Math.sin(5 * a + 2.1) + 0.003 * Math.sin(13 * a + 1) + 0.002 * Math.sin(37 * a) + 0.0015 * Math.sin(61 * a + 1));
  const fleshR = (a) => RT + 2.5 + RT * (0.006 + 0.006 * Math.sin(3 * a + 0.7) + 0.004 * Math.sin(7 * a + 1.3));
  function blob(g, rf) {
    g.beginPath();
    for (let i = 0; i <= 160; i++) { const a = (i / 160) * TAU, r = rf(a), x = CX + Math.cos(a) * r, y = CY + Math.sin(a) * r; i ? g.lineTo(x, y) : g.moveTo(x, y); }
    g.closePath();
  }

  const paintPeel = (g) => paintOrange(g, () => blob(g, peelR), CX, CY, RT * 1.03, RT * 1.03);
  // 흰 속껍질: 크림색 + 가는 섬유
  function paintPith(g) {
    blob(g, fleshR); g.fillStyle = '#fff5e4'; g.fill();
    g.save(); g.clip();
    const rnd = seeded(11);
    g.lineCap = 'round';
    for (let i = 0; i < 240; i++) {
      const a = rnd() * TAU, r = Math.sqrt(rnd()) * RT, x = CX + Math.cos(a) * r, y = CY + Math.sin(a) * r, d = rnd() * TAU, l = 3 + rnd() * 6;
      g.strokeStyle = rnd() < 0.5 ? 'rgba(238,214,176,.7)' : 'rgba(255,255,255,.85)'; g.lineWidth = 0.8;
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(d + 0.6) * l * 0.6, y + Math.sin(d + 0.6) * l * 0.6, x + Math.cos(d) * l, y + Math.sin(d) * l); g.stroke();
    }
    g.restore();
  }
  // 깐 속살(시안 3번 화면): 밝은 살구색 과육 조각 + 흰 경계 + 흰 귤락이 얼룩처럼 많이
  function paintFlesh(g) {
    blob(g, fleshR); g.fillStyle = '#ffd7a0'; g.fill();
    g.save(); blob(g, fleshR); g.clip();
    const cuts = deco.cuts, n = cuts.length, R = RT * 1.1, SWIRL = 0.3;
    const edge = (a) => [CX + Math.cos(a + SWIRL) * R * 0.5, CY + Math.sin(a + SWIRL) * R * 0.5, CX + Math.cos(a) * R, CY + Math.sin(a) * R];
    for (let i = 0; i < n; i++) {
      const a = cuts[i], b = i + 1 < n ? cuts[i + 1] : cuts[0] + TAU;
      const [c1x, c1y, e1x, e1y] = edge(a), [c2x, c2y] = edge(b);
      g.beginPath(); g.moveTo(CX, CY); g.quadraticCurveTo(c1x, c1y, e1x, e1y); g.arc(CX, CY, R, a, b); g.quadraticCurveTo(c2x, c2y, CX, CY); g.closePath();
      g.fillStyle = i % 2 ? '#ffd296' : '#ffdcab'; g.fill();
      g.save(); g.clip();
      g.lineCap = 'round';
      for (const [va, vr, vl, vk] of deco.vesicles) {
        const aa = a + ((va / TAU) % 1) * (b - a) + SWIRL * (1 - vr) * 0.6;
        const x = CX + Math.cos(aa) * vr * RT, y = CY + Math.sin(aa) * vr * RT;
        g.strokeStyle = vk < 0.6 ? 'rgba(255,248,232,.7)' : 'rgba(240,160,70,.35)'; g.lineWidth = 1.4;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(aa) * vl * 1.7, y + Math.sin(aa) * vl * 1.7); g.stroke();
      }
      g.restore();
    }
    // 흰 귤락 얼룩
    for (const [a, r, sz, sd] of deco.blots) {
      const x = CX + Math.cos(a) * r * RT, y = CY + Math.sin(a) * r * RT;
      g.beginPath();
      for (let j = 0; j <= 10; j++) { const b = (j / 10) * TAU, rr = sz * (0.7 + 0.3 * Math.sin(b * 3 + sd)); j ? g.lineTo(x + Math.cos(b) * rr, y + Math.sin(b) * rr * 0.7) : g.moveTo(x + rr, y); }
      g.closePath(); g.fillStyle = 'rgba(255,250,238,.6)'; g.fill();
    }
    g.strokeStyle = '#fffaf0'; g.lineWidth = 2.6; g.lineCap = 'round';
    for (const a of cuts) { const [cx, cy, ex, ey] = edge(a); g.beginPath(); g.moveTo(CX, CY); g.quadraticCurveTo(cx, cy, ex, ey); g.stroke(); }
    g.strokeStyle = 'rgba(255,252,244,.9)';
    for (const v of deco.veins) {
      const a1 = v.a0 + v.bend;
      const p0 = [CX + Math.cos(v.a0) * v.r0 * RT, CY + Math.sin(v.a0) * v.r0 * RT];
      const pc = [CX + Math.cos(v.a0 + v.bend * 0.3) * (v.r0 + v.len * 0.55) * RT, CY + Math.sin(v.a0 + v.bend * 0.3) * (v.r0 + v.len * 0.55) * RT];
      const p2 = [CX + Math.cos(a1) * (v.r0 + v.len) * RT, CY + Math.sin(a1) * (v.r0 + v.len) * RT];
      g.lineWidth = v.w;
      g.beginPath(); g.moveTo(p0[0], p0[1]); g.quadraticCurveTo(pc[0], pc[1], p2[0], p2[1]); g.stroke();
    }
    const sh = g.createRadialGradient(CX - RT * 0.2, CY - RT * 0.25, RT * 0.45, CX, CY, RT * 1.05);
    sh.addColorStop(0, 'rgba(240,150,60,0)'); sh.addColorStop(1, 'rgba(240,140,50,.3)');
    g.fillStyle = sh; g.fillRect(CX - R, CY - R, R * 2, R * 2);
    g.fillStyle = grain(g, 'flesh'); g.fillRect(CX - R, CY - R, R * 2, R * 2);
    g.restore();
  }

  // 과육 · 흰 속껍질 · 겉껍질 세 층을 미리 그려 두고, 깐 만큼 지움(깐 자리가 바뀔 때만 다시 합침 → 휴대폰에서도 가볍게)
  function makeLayers(k) {
    const box = RT * 1.07 + 8, size = Math.ceil(box * 2 * k);
    const mk = () => { const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d'); g.setTransform(k, 0, 0, k, -(CX - box) * k, -(CY - box) * k); return [c, g]; };
    const [fc, fg] = mk(), [pc, pg] = mk(), [wc, wg] = mk(), [cc, cg] = mk();
    paintFlesh(fg); paintPith(wg); paintPeel(pg);
    let dirty = true;
    const compose = () => {
      cg.save(); cg.setTransform(1, 0, 0, 1, 0, 0); cg.clearRect(0, 0, size, size);
      cg.drawImage(fc, 0, 0);
      cg.shadowColor = 'rgba(200,100,20,.28)'; cg.shadowBlur = 2 * k; cg.shadowOffsetY = 1.4 * k;
      cg.drawImage(wc, 0, 0);
      cg.shadowColor = 'rgba(180,70,10,.25)'; cg.shadowBlur = 2 * k; cg.shadowOffsetY = 1.2 * k;
      cg.drawImage(pc, 0, 0);
      cg.restore();
      dirty = false;
    };
    const erase = (g, a, b, w, off) => {
      g.save(); g.globalCompositeOperation = 'destination-out';
      g.lineWidth = w; g.lineCap = 'butt'; g.lineJoin = 'round';
      g.beginPath(); path(g, Math.max(0, a - 0.03), b, 0.03, off); g.stroke(); g.restore();
    };
    // 시안 3번처럼 벗긴 자리가 '나선 띠'로 보이게: 띠 간격보다 좁게(PEEL_W) 지워 바퀴 사이에 주황 껍질이 남고,
    // 속껍질은 조금 덜 지워 띠 양쪽 가장자리에 흰 테두리가 보임. 다 까면 남은 껍질은 사라지며 과육 전체가 드러남
    return {
      flesh: fc, peel: pc, pith: wc, box,
      whole() { if (dirty) compose(); return cc; },
      erase(a, b) { if (b <= a) return; erase(pg, a, b, SP * PEEL_W, 0); erase(wg, a, b, SP * PEEL_W - 7, 0); dirty = true; },
    };
  }
  function path(g, a, b, step = 0.04, off = 0) {
    const q = (t) => { if (!off) return pt(t); const r = Math.max(0, B * t + off); return [CX + r * Math.cos(t + PH), CY + r * Math.sin(t + PH)]; };
    let p = q(a); g.moveTo(p[0], p[1]);
    for (let t = a + step; t < b; t += step) { p = q(t); g.lineTo(p[0], p[1]); }
    p = q(b); g.lineTo(p[0], p[1]);
  }

  // 껍질 띠: 폭이 넓고, 점마다 비틀림(ph)이 있어 앞면(주황)·안쪽 면(크림)이 번갈아 보임.
  // curl > 0 이면 늘어진 길이를 따라 S자로 부드럽게 말리게 그림(물리는 그대로, 그릴 때만 옆으로 휘게)
  function drawRope(g, src, w, curl = 0) {
    const n = src.length;
    if (n < 2) return;
    const pts = curl ? src.map((p, i) => {
      const k = Math.min(1, i / 22) * curl, off = Math.sin(i * 0.15 + 0.6) * 22 * k + Math.min(i, 34) * 1.9 * curl;
      return { x: clamp(p.x + off, 6, WW - 6), y: p.y + Math.cos(i * 0.15 + 0.6) * 5 * k, ph: p.ph };
    }) : src;
    const L = [], R = [], face = [];
    let ptx = 0, pty = 1;
    for (let i = 0; i < n; i++) {
      const a = pts[Math.max(0, i - 2)], b = pts[Math.min(n - 1, i + 2)];
      let tx = b.x - a.x, ty = b.y - a.y; const d = Math.hypot(tx, ty);
      if (d < 3) { tx = ptx; ty = pty; } else { tx /= d; ty /= d; if (tx * ptx + ty * pty < -0.2 && i) { tx = ptx; ty = pty; } }
      ptx = tx; pty = ty;
      const c = Math.cos(pts[i].ph || 0), taper = Math.min(1, 0.55 + i * 0.15) * (i === n - 1 ? 0.7 : 1);
      const h = (w / 2) * (0.42 + 0.58 * Math.abs(c)) * taper;
      L.push([pts[i].x - ty * h, pts[i].y + tx * h]); R.push([pts[i].x + ty * h, pts[i].y - tx * h]);
      face.push(c);
    }
    const outline = (dx, dy) => {
      g.beginPath(); g.moveTo(L[0][0] + dx, L[0][1] + dy);
      for (let i = 1; i < n; i++) g.lineTo(L[i][0] + dx, L[i][1] + dy);
      for (let i = n - 1; i >= 0; i--) g.lineTo(R[i][0] + dx, R[i][1] + dy);
      g.closePath();
    };
    g.save(); g.lineJoin = 'round'; g.lineCap = 'round';
    outline(3, 6); g.fillStyle = 'rgba(190,140,90,.13)'; g.fill();
    outline(0, 2); g.fillStyle = '#d96a12'; g.fill();
    for (let i = 0; i < n - 1; i++) {
      const out = face[i] + face[i + 1] > -0.7;
      g.beginPath(); g.moveTo(L[i][0], L[i][1]); g.lineTo(L[i + 1][0], L[i + 1][1]); g.lineTo(R[i + 1][0], R[i + 1][1]); g.lineTo(R[i][0], R[i][1]); g.closePath();
      g.fillStyle = out ? '#f5871f' : '#ffe6c2'; g.strokeStyle = g.fillStyle; g.lineWidth = 0.8; g.fill(); g.stroke();
      const m = (p, q, k) => [p[0] + (q[0] - p[0]) * k, p[1] + (q[1] - p[1]) * k];
      const a1 = m(R[i], L[i], 0.3), a2 = m(R[i + 1], L[i + 1], 0.3);
      g.beginPath(); g.moveTo(R[i][0], R[i][1]); g.lineTo(R[i + 1][0], R[i + 1][1]); g.lineTo(a2[0], a2[1]); g.lineTo(a1[0], a1[1]); g.closePath();
      g.fillStyle = out ? 'rgba(210,95,10,.32)' : 'rgba(240,200,150,.5)'; g.fill();
      const b1 = m(L[i], R[i], 0.25), b2 = m(L[i + 1], R[i + 1], 0.25);
      g.beginPath(); g.moveTo(b1[0], b1[1]); g.lineTo(b2[0], b2[1]); g.strokeStyle = out ? 'rgba(255,190,110,.55)' : 'rgba(255,255,255,.7)'; g.lineWidth = 1.4; g.stroke();
    }
    g.save(); outline(0, 0); g.clip(); g.globalAlpha = 0.8; g.fillStyle = grain(g, 'peel'); g.fillRect(0, 0, WW, 2000); g.restore();
    outline(0, 0); g.strokeStyle = 'rgba(210,96,14,.6)'; g.lineWidth = 1; g.stroke();
    g.restore();
  }

  /* ---------- 일러스트(시안 1·4번 화면) ---------- */
  function sideTangerine(g, x, y, r, leafSway = 0) {
    groundShadow(g, x, y + r * 0.84, r * 1.0, r * 0.17);
    paintOrange(g, () => wobble(g, x, y, r * 1.06, r * 0.9, 1.3), x, y, r * 1.06, r * 0.9);
    stem(g, x - r * 0.02, y - r * 0.78, r * 0.3);
    leaf(g, x - r * 0.02, y - r * 0.98, r * 0.6, -0.42 + leafSway);
  }
  // 껍질을 다 깐 감귤(시안 4번): 볼록한 조각 여러 개 + 조각 사이 골 + 흰 귤락 결 + 위쪽 꼭지
  function peeledTangerine(g, x, y, r) {
    groundShadow(g, x, y + r * 0.8, r * 1.02, r * 0.16);
    const body = () => wobble(g, x, y, r * 1.08, r * 0.84, 2.1);
    body(); g.fillStyle = '#f7a23c'; g.fill();
    g.save(); body(); g.clip();
    const n = 9;
    for (const k of [0, 8, 1, 7, 2, 6, 3, 5, 4]) {
      const u = (k - (n - 1) / 2) / ((n - 1) / 2);          // -1 ~ 1
      const xc = x + Math.sin(u * Math.PI / 2) * r * 0.98, wd = r * 0.27 * Math.cos(u * Math.PI / 2 * 0.9) + r * 0.06;
      g.beginPath(); g.ellipse(xc, y + r * 0.02, wd, r * 0.84, 0, 0, TAU);
      const lg = g.createLinearGradient(xc - wd, 0, xc + wd, 0);
      lg.addColorStop(0, '#f08a2a'); lg.addColorStop(0.45, '#ffc978'); lg.addColorStop(1, '#f2922e');
      g.fillStyle = lg; g.fill();
      g.strokeStyle = 'rgba(214,105,20,.55)'; g.lineWidth = Math.max(1.2, r * 0.016); g.stroke();
      // 조각 위 흰 결
      g.strokeStyle = 'rgba(255,248,232,.85)'; g.lineWidth = Math.max(1.2, r * 0.018); g.lineCap = 'round';
      g.beginPath(); g.moveTo(xc - wd * 0.15, y - r * 0.62); g.quadraticCurveTo(xc + wd * 0.25, y, xc - wd * 0.05, y + r * 0.6); g.stroke();
    }
    const rnd = seeded(31);
    g.strokeStyle = 'rgba(255,252,244,.9)'; g.lineWidth = Math.max(1, r * 0.012);
    for (let i = 0; i < 40; i++) {
      const px = x + (rnd() - 0.5) * r * 1.9, py = y + (rnd() - 0.5) * r * 1.5, l = r * (0.06 + rnd() * 0.16), d = rnd() * TAU;
      g.beginPath(); g.moveTo(px, py); g.quadraticCurveTo(px + Math.cos(d + 0.8) * l * 0.5, py + Math.sin(d + 0.8) * l * 0.5, px + Math.cos(d) * l, py + Math.sin(d) * l); g.stroke();
    }
    const sh = g.createRadialGradient(x - r * 0.25, y - r * 0.3, r * 0.4, x, y, r * 1.12);
    sh.addColorStop(0, 'rgba(255,200,120,.15)'); sh.addColorStop(1, 'rgba(200,90,10,.35)');
    g.fillStyle = sh; g.fillRect(x - r * 1.2, y - r, r * 2.4, r * 2);
    g.fillStyle = grain(g, 'flesh'); g.fillRect(x - r * 1.2, y - r, r * 2.4, r * 2);
    g.restore();
    g.beginPath(); g.ellipse(x, y - r * 0.8, r * 0.12, r * 0.05, 0, 0, TAU); g.fillStyle = '#fff2dc'; g.fill();
    stem(g, x, y - r * 0.78, r * 0.17);
  }
  function ribbonArt(g, f, n, w, twist) {
    const pts = [];
    for (let i = 0; i < n; i++) { const t = i / (n - 1), [x, y] = f(t); pts.push({ x, y, ph: 0.3 + t * twist }); }
    drawRope(g, pts, w);
    return pts;
  }
  function drawHero(t) {
    const g = heroCtx, S = hero.width, H = hero.height;
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, S, H);
    sideTangerine(g, S * 0.5, H * 0.6, S * 0.36, Math.sin(t * 1.2) * 0.04);
    heroFace(g, S * 0.5, H * 0.6, S * 0.36, t);
    accents(g, S * 0.5, H * 0.6, S * 0.42, -2.3, '#f5871f', S * 0.011, S * 0.05);
  }
  // 시작 화면 큰 감귤의 표정(첨부 시안처럼): 테두리 없이 가운데로 모인 점 눈 · 끝이 살짝 말린 큰 입 · 분홍 볼터치
  function cuteFace(g, fx, fy, r, mood, t) {
    const L = '#3b2416', blink = mood === 'smile' && (t % 3.8) < 0.12;
    g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
    // 볼터치(입 끝에 살짝 겹치게)
    g.fillStyle = mood === 'sad' ? 'rgba(247,160,170,.55)' : 'rgba(247,160,170,.92)';
    for (const dx of [-0.43, 0.43]) { g.beginPath(); g.ellipse(fx + dx * r, fy + r * 0.2, r * 0.15, r * 0.135, 0, 0, TAU); g.fill(); }
    g.fillStyle = L; g.strokeStyle = L; g.lineWidth = r * 0.045;
    // 눈: 가운데로 모인 작은 세로 점
    for (const dx of [-0.075, 0.075]) {
      const ex = fx + dx * r, ey = fy - r * 0.02;
      g.beginPath();
      if (mood === 'happy') { g.arc(ex, ey + r * 0.03, r * 0.045, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); }
      else if (blink) { g.moveTo(ex - r * 0.03, ey); g.lineTo(ex + r * 0.03, ey); g.stroke(); }
      else { g.ellipse(ex, ey, r * 0.026, r * 0.048, 0, 0, TAU); g.fill(); }
    }
    // 입: 볼터치 사이를 잇는 넓은 웃음 + 양 끝 짧은 말림
    const lx = fx - r * 0.34, rx = fx + r * 0.34, my = fy + r * 0.14;
    g.beginPath();
    if (mood === 'sad') { g.moveTo(fx - r * 0.16, my + r * 0.1); g.quadraticCurveTo(fx, my - r * 0.02, fx + r * 0.16, my + r * 0.1); g.stroke(); }
    else {
      g.moveTo(lx, my); g.quadraticCurveTo(fx, my + r * (mood === 'happy' ? 0.36 : 0.3), rx, my); g.stroke();
      g.beginPath(); g.moveTo(lx - r * 0.035, my - r * 0.06); g.quadraticCurveTo(lx - r * 0.01, my + r * 0.01, lx + r * 0.02, my + r * 0.06); g.stroke();
      g.beginPath(); g.moveTo(rx + r * 0.035, my - r * 0.06); g.quadraticCurveTo(rx + r * 0.01, my + r * 0.01, rx - r * 0.02, my + r * 0.06); g.stroke();
    }
    g.restore();
  }
  function heroFace(g, x, y, r, t) { cuteFace(g, x + r * 0.02, y + r * 0.08, r, 'smile', t); }
  function drawResultArt(ok, pct) {
    const g = rArt.getContext('2d'), S = rArt.width, H = rArt.height, k = S / 320;
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, S, H);
    if (ok) {
      // 다 깐 감귤 + 아래로 감기듯 놓인 긴 껍질 한 줄(시안 4번)
      // 껍질은 왼쪽에서 한 번 말려 올라왔다가 감귤 앞을 지나 오른쪽으로 길게 늘어짐
      peeledTangerine(g, S * 0.54, H * 0.42, H * 0.34);
      ribbonArt(g, (t) => [S * (0.05 + t * 0.9), H * (0.76 + 0.055 * Math.sin(t * Math.PI * 2.6 + 0.4) + t * 0.05)], 70, 27 * k, 11);
      accents(g, S * 0.54, H * 0.42, H * 0.42, -0.62, '#6aa84f', 3 * k, H * 0.05);
    } else {
      // 덜 깐 감귤 + 짧게 끊어진 껍질
      sideTangerine(g, S * 0.42, H * 0.52, H * 0.32);
      g.save(); wobble(g, S * 0.42, H * 0.52, H * 0.32 * 1.06, H * 0.32 * 0.9, 1.3); g.clip();
      const cut = 0.25 + pct * 0.5;
      g.beginPath(); g.ellipse(S * 0.42, H * 0.52 - H * 0.32 * (1.0 - cut), H * 0.34, H * 0.32 * cut * 0.9, 0, 0, TAU); g.fillStyle = '#ffd7a0'; g.fill();
      g.strokeStyle = '#fff5e4'; g.lineWidth = 3 * k; g.stroke();
      g.restore();
      const pts = ribbonArt(g, (t) => [S * (0.64 + t * 0.28), H * (0.64 + Math.sin(t * 5) * 0.07 + t * 0.18)], 12 + Math.round(pct * 14), 26 * k, 5);
      const e = pts[pts.length - 1];
      g.save(); g.translate(e.x, e.y); g.scale(k, k); g.fillStyle = '#ffe6c2'; g.strokeStyle = 'rgba(210,96,14,.6)'; g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(-6, -11); g.lineTo(2, -5); g.lineTo(-3, 0); g.lineTo(4, 5); g.lineTo(-4, 11); g.lineTo(-9, 0); g.closePath(); g.fill(); g.stroke();
      g.restore();
      accents(g, e.x, e.y, 16 * k, 0, '#cf4f2a', 2.6 * k);
    }
  }
  // 작은 웃는 감귤(v1.5의 점 얼굴을 v1.7 질감으로): 굵은 외곽선 없이 종이 질감 + 점 눈 + 선 하나 입
  // mood: smile(가끔 깜빡) · happy(눈웃음, 최고 기록) · sad(끊어졌을 때)
  function drawFace(g, mood, t) {
    const S = g.canvas.width, k = S / 100;
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, S, S);
    g.setTransform(k, 0, 0, k, 0, 0);
    const bob = mood === 'happy' ? Math.abs(Math.sin(t * 5)) * -3 : 0;
    g.translate(0, bob);
    paintOrange(g, () => wobble(g, 50, 60, 37, 32, 2.4), 50, 60, 37, 32);
    stem(g, 50, 30, 8);
    leaf(g, 50, 27, 24, -0.5);
    cuteFace(g, 50, 61, 36, mood, t);
  }

  // 모서리 잎(시안 1·4번)
  function drawCorners() {
    const tl = $('c-tl'), br = $('c-br'), br2 = $('c-br2');
    let g = tl.getContext('2d'), S = tl.width;
    g.clearRect(0, 0, S, S);
    g.save(); g.strokeStyle = 'rgba(120,150,90,.35)'; g.lineWidth = S * 0.008; g.beginPath(); g.moveTo(-5, S * 0.45); g.quadraticCurveTo(S * 0.3, S * 0.3, S * 0.55, -5); g.stroke(); g.restore();
    leaf(g, -S * 0.04, S * 0.52, S * 0.5, -1.05);
    leaf(g, S * 0.3, S * 0.1, S * 0.52, -0.55);
    g = br.getContext('2d'); S = br.width; const H = br.height;
    g.clearRect(0, 0, S, H);
    peeledTangerine(g, S * 0.55, H * 0.98, H * 0.36);
    leaf(g, S * 0.8, H * 0.98, S * 0.36, -1.15);
    g = br2.getContext('2d'); g.clearRect(0, 0, br2.width, br2.height);
    leaf(g, br2.width * 0.5, br2.height * 1.02, br2.width * 0.38, -1.35);
    leaf(g, br2.width * 0.58, br2.height * 0.95, br2.width * 0.44, -0.65);
  }

  /* ---------- 게임 상태 ---------- */
  // start → ready(준비) → peel(까는 중) → end(끝난 연출) → over(결과)
  let state = 'start', stageIdx = 0;
  let layers = null, th = TH0, zones = [];
  let speed = 0, frameDs = 0, tension = 0, hotT = 0, devT = 0, warnT = 0;
  let finger = null, grabbed = false, lastFeed = 0;
  let rope = [], ropeBank = 0, attached = true, ropePh = 0;
  let bits = [], shake = 0, peelFade = 1, endT = 0, cause = '', playClock = 0, clock = 0;
  let ripAcc = 0, bitAcc = 0, hintT = 0, cheerIdx = 0, inThinPrev = false, flash = 0;
  const cleared = [false, false, false];

  const progress = () => clamp(arc(TH0, th) / TOTAL, 0, 1);
  // 점수(v1.6 방식을 다듬어 재사용) — 플레이 시간이 아니라 '끊김 없이 이어 벗긴 길이'와 '완성도'가 중심
  //  · 길이 점수   : 끊기기 전까지 이어 벗긴 비율 1%당 10점(최대 1,000)
  //  · 완주 보너스 : 한 줄로 끝까지 벗기면 500
  //  · 정확도 보너스: 완주했을 때 점선에 얼마나 가깝게 따라갔는지(0~300)
  //  · 시간 보너스 : 완주했을 때 기준 시간보다 1초 빠를 때마다 10점(덤, 최대 100 — 정확도보다 작게)
  //  · 단계 배수   : 아기귤 ×1 · 보통귤 ×1.5 · 대왕귤 ×2
  let devSum = 0, devN = 0;
  const accuracy = () => (devN ? clamp(1 - devSum / devN, 0, 1) : 0);
  const lengthPct = () => (cause === 'done' ? 100 : Math.floor(progress() * 100));
  function scoreParts(ok) {
    const length = lengthPct() * 10, done = ok ? 500 : 0;
    const acc = ok ? Math.round(accuracy() * 300) : 0, time = ok ? clamp(Math.round((st.par - playClock) * 10), 0, 100) : 0;
    return { length, done, acc, time, total: Math.round((length + done + acc + time) * st.mult) };
  }
  const inThin = (t) => zones.some((z) => t >= z[0] && t <= z[1]);
  const stageCm = () => Math.round(TOTAL * CM_PER_UNIT);

  function makeZones() {
    const out = [], n = st.zones, a0 = TH0 + TAU * 0.9, span = THMAX - 0.6 - a0;
    for (let i = 0; i < n; i++) {
      const c = a0 + span * (i + rand(0.25, 0.75)) / n, len = rand(0.7, 1.05);
      out.push([c - len / 2, c + len / 2]);
    }
    return out;
  }
  function hint(text, bad = false, hold = 1.2) {
    hintEl.textContent = text; hintEl.classList.toggle('bad', bad); hintEl.classList.add('show'); hintT = hold;
  }
  function showPop(text, kind = '') {
    pop.textContent = text; pop.className = `pop ${kind}`;
    void pop.offsetWidth; pop.classList.add('show');
  }
  // 오른쪽 위 작은 귤 3개 = 단계(지금·깬 단계는 주황, 남은 단계는 흐리게)
  function renderDots() {
    $('dots').innerHTML = STAGES.map((x, i) => `<i class="${i === stageIdx ? 'cur' : cleared[i] || i < stageIdx ? '' : 'off'}"></i>`).join('');
    $('dots').setAttribute('aria-label', `${STAGES.length}단계 중 ${stageIdx + 1}단계 ${st.name}`);
  }

  function startStage(i) {
    ensureAudio();
    stageIdx = i; setStage(i);
    th = TH0; zones = makeZones();
    layers = makeLayers(s * dpr * Z); layers.erase(0, th);
    speed = 0; frameDs = 0; tension = 0; hotT = 0; devT = 0; warnT = 0;
    finger = null; grabbed = false; grabId = null;
    const [x, y] = W(pt(th));
    ropePh = 0.4;
    rope = [{ x, y, px: x, py: y, ph: ropePh }]; ropeBank = 0; attached = true;
    devSum = 0; devN = 0;
    bits = []; shake = 0; peelFade = 1; cause = ''; playClock = 0; ripAcc = 0; bitAcc = 0; hintT = 0; cheerIdx = 0; inThinPrev = false; flash = 0;
    $('tag-text').textContent = i === 0 ? '준비되었나요?' : `${st.name}, 준비되었나요?`;
    $('time').textContent = '00:00'; $('live-score').textContent = '0';
    save.sync();
    const best = save.d.best[i], bl = $('best-line');
    bl.hidden = false; bl.innerHTML = readyLine(i, best);
    $('tag').hidden = false; $('timer').hidden = true; guide.hidden = false; hintEl.classList.remove('show');
    sheetStart.hidden = true; sheetOver.hidden = true; hud.hidden = false;
    app.dataset.screen = 'play';
    renderDots();
    state = 'ready';
    live.textContent = `${i + 1}단계 ${st.name}. 귤 가운데 하얀 동그라미를 누른 채 점선을 따라가세요.`;
  }

  /* ---------- 손가락 → 껍질 (v1.0부터 같은 판정) ---------- */
  function grab(wx, wy, t) {
    const [tx, ty] = pt(th);
    if (Math.hypot(wx - tx, wy - ty) > 38) { flash = 1; hint('하얀 동그라미를 눌러 시작해요'); return; }
    grabbed = true; state = 'peel'; lastFeed = t; finger = { x: wx, y: wy, warn: false };
    $('tag').hidden = true; $('best-line').hidden = true; $('timer').hidden = false; guide.hidden = true;
    sfx.grab();
  }
  function feed(wx, wy, t) {
    const gap = Math.max(0, (t - lastFeed) / 1000);
    lastFeed = t;
    finger = { x: wx, y: wy, warn: false };
    let bt = th, bd = Infinity;
    for (let a = Math.max(TH0, th - 0.3); a <= Math.min(THMAX, th + 1.2); a += 0.012) {
      const [x, y] = pt(a), d = Math.hypot(wx - x, wy - y);
      if (d < bd) { bd = d; bt = a; }
    }
    if (bd > TOL) {
      devT += gap;
      if (devT > 0.1 || bd > TOL * 1.8) end('off');
      return;
    }
    devT = 0;
    devSum += bd / TOL; devN++;
    finger.warn = bd > TOL * 0.65;
    if (bt > THMAX - 0.03) bt = THMAX;
    if (bt > th) advance(bt);
  }
  function advance(nt) {
    const ds = arc(th, nt);
    layers.erase(th, nt);
    th = nt;
    frameDs += ds; ripAcc += ds; bitAcc += ds; ropeBank += ds;
    const [x, y] = W(pt(th));
    while (ropeBank >= SEG) {
      ropeBank -= SEG;
      ropePh += 0.15 + Math.random() * 0.07;
      rope.unshift({ x, y, px: x, py: y, ph: ropePh });
      if (rope.length > 200) rope.pop();
    }
    if (ripAcc > 14) { ripAcc = 0; sfx.rip(); }
    if (bitAcc > 22) {
      bitAcc = 0;
      for (let i = 0; i < 2; i++) { const a = rand(0, TAU), v = rand(30, 80); bits.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30, t: 0, life: rand(0.35, 0.7), r: rand(1.5, 3), c: '#ffc04a' }); }
    }
    const p = progress();
    const cheers = [[0.5, '절반!'], [0.8, '거의 다!']];
    if (cheerIdx < cheers.length && p >= cheers[cheerIdx][0]) { showPop(cheers[cheerIdx][1]); sfx.cheer(); cheerIdx++; }
    const thin = inThin(th);
    if (thin && !inThinPrev) hint('얇은 곳이에요, 천천히');
    inThinPrev = thin;
    if (th >= THMAX - 1e-6) end('done');
  }
  function end(c) {
    if (state !== 'peel' && state !== 'ready') return;
    cause = c; state = 'end'; endT = 0; grabbed = false; finger = null;
    guide.hidden = true; $('tag').hidden = true; $('best-line').hidden = true;
    if (c === 'done') {
      sfx.done(); showPop('완성!', 'big'); hintEl.classList.remove('show');
      for (let i = 0; i < 40; i++) {
        const a = rand(0, TAU), v = rand(90, 240), [mx, my] = W([CX + Math.cos(a) * RT * 0.9, CY + Math.sin(a) * RT * 0.9]);
        bits.push({ x: mx, y: my, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, t: 0, life: rand(0.6, 1.1), r: rand(2, 4.5), c: i % 5 ? (i % 2 ? '#f5871f' : '#ffc04a') : '#6aa84f', dash: i % 3 === 0 });
      }
    } else {
      attached = false; shake = 0.3;
      sfx.tear(); showPop(c === 'fast' ? '힘이 너무 셌어요!' : c === 'off' ? '점선 밖!' : '툭!', 'big bad'); hint(CAUSE[c], true, 2);
    }
    live.textContent = CAUSE[c];
  }

  /* ---------- 업데이트 ---------- */
  function update(dt) {
    clock += dt;
    if (state === 'peel') {
      playClock += dt;
      const inst = frameDs / Math.max(dt, 1e-3);
      frameDs = 0;
      speed += (inst - speed) * (1 - Math.exp(-dt * 10));
      tension = speed / (inThin(th) ? st.vT : st.vN);
      if (tension > 1) { hotT += dt; if (hotT > 0.12) end('fast'); } else hotT = Math.max(0, hotT - dt);
      if (state === 'peel' && (tension > 0.78 || (finger && finger.warn))) {
        warnT -= dt;
        if (warnT <= 0) { sfx.warn(); warnT = 0.25; hint(tension > 0.78 ? '천천히!' : '점선 위로!', true, 0.5); }
      }
      $('time').textContent = mmss(playClock);
      $('live-score').textContent = fmt(Math.round(Math.floor(progress() * 100) * 10 * st.mult));   // 진행 중에는 길이 점수만
    } else if (state === 'end' && cause === 'fast' && endT < 0.9) { tension = 1.15; }
    else { speed *= Math.exp(-dt * 6); tension = speed / st.vN; }
    if (state === 'end') {
      endT += dt;
      if (cause === 'done') peelFade = Math.max(0, 1 - endT / 0.7);
      if (endT > (cause === 'done' ? 1.6 : 1.2)) showResult();
    }
    renderPower();
    hintT = Math.max(0, hintT - dt);
    if (hintT === 0 && state !== 'end') hintEl.classList.remove('show');
    flash = Math.max(0, flash - dt * 2);
    shake = Math.max(0, shake - dt);
    stepRope(dt);
    for (const m of bits) { m.t += dt; m.vy += 220 * dt; m.x += m.vx * dt; m.y += m.vy * dt; }
    bits = bits.filter((m) => m.t < m.life);
  }
  // 힘 바: v1.5와 같은 값·같은 구간(0.75 넘으면 노랑, 1 넘으면 빨강 — 1을 0.12초 넘기면 끊어짐). 막대 끝은 1.15
  const pbar = $('pbar');
  let pwLast = '';
  function renderPower() {
    const tv = clamp(tension, 0, 1.15), w = `${((tv / 1.15) * 100).toFixed(1)}%`, cls = tension > 1 ? 'hot' : tension > 0.75 ? 'warn' : '';
    if (w + cls === pwLast) return;
    pwLast = w + cls; pbar.style.width = w; pbar.className = cls;
  }

  function stepRope(dt) {
    if (rope.length < 2 && attached) return;
    const G = 1100 * dt * dt, floor = WH - 10;
    if (attached) { const [x, y] = W(pt(th)); rope[0].x = rope[0].px = x; rope[0].y = rope[0].py = y; }
    for (let i = attached ? 1 : 0; i < rope.length; i++) {
      const p = rope[i], vx = (p.x - p.px) * 0.985, vy = (p.y - p.py) * 0.985;
      p.px = p.x; p.py = p.y; p.x += vx; p.y += vy + G;
    }
    for (let k = 0; k < 8; k++) {
      for (let i = 0; i < rope.length - 1; i++) {
        const a = rope[i], b = rope[i + 1], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1e-4, diff = (d - SEG) / d;
        if (i === 0 && attached) { b.x -= dx * diff; b.y -= dy * diff; }
        else { a.x += dx * diff * 0.5; a.y += dy * diff * 0.5; b.x -= dx * diff * 0.5; b.y -= dy * diff * 0.5; }
      }
      for (const p of rope) { if (p.y > floor) { p.y = floor; p.px = p.x - (p.x - p.px) * 0.5; } p.x = clamp(p.x, 6, WW - 6); }
    }
  }

  /* ---------- 그리기 ---------- */
  // 흰 점선 가이드(시안 2번): 굵은 흰 점선, 다음 한 바퀴는 진하게, 얇은 곳은 노란 점선
  function drawGuide() {
    if (state !== 'ready' && state !== 'peel') return;
    ctx.save(); ctx.lineCap = 'round';
    for (const [a, b] of zones) {
      if (b <= th) continue;
      ctx.lineWidth = SP * 0.6; ctx.strokeStyle = 'rgba(255,236,190,.26)';
      ctx.beginPath(); path(ctx, Math.max(a, th), b); ctx.stroke();
    }
    const segs = [];
    let t0 = th + 0.12;
    while (t0 < THMAX) {
      const thin = inThin(t0);
      let t1 = t0 + 0.05;
      while (t1 < THMAX && inThin(t1) === thin) t1 += 0.05;
      segs.push([t0, Math.min(t1, THMAX), thin]); t0 = t1;
    }
    for (const [a, b, thin] of segs) {
      const near = Math.min(b, th + TAU);
      ctx.setLineDash([10 / Z, 9 / Z]); ctx.lineWidth = (thin ? 4.2 : 3.6) / Z;
      ctx.strokeStyle = thin ? '#ffe27a' : (finger && finger.warn ? '#ffe2b0' : '#fffaf0');
      if (a < near) { ctx.globalAlpha = 0.95; ctx.beginPath(); path(ctx, a, near); ctx.stroke(); }
      if (b > near) { ctx.globalAlpha = state === 'ready' ? 0.95 : 0.45; ctx.beginPath(); path(ctx, Math.max(a, near), b); ctx.stroke(); }
    }
    ctx.restore();
  }
  // 위쪽 꼭지 + 잎(시안 2·3번): 껍질을 다 깔 때까지 그대로
  function drawTopStem() {
    const top = CY - RT * 1.03 * FY * Z;
    stem(ctx, CX + 1, top + 6, 26);
    leaf(ctx, CX + 2, top - 14, 72, -0.32);
  }
  // 하얀 손잡이(시작점·지금 껍질 끝). 힘이 세지면 테두리가 노랑 → 빨강
  function drawHandle(t) {
    if (state !== 'ready' && state !== 'peel') return;
    const [x, y] = W(pt(th));
    const ring = state === 'ready' ? (flash > 0 ? '#cf4f2a' : '#d9c7b2') : (tension > 1 ? '#cf4f2a' : tension > 0.75 || (finger && finger.warn) ? '#f2b33d' : '#d9c7b2');
    if (state === 'ready') {
      const r = 20 + Math.sin(t * 5) * 4;
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.strokeStyle = 'rgba(255,250,240,.75)'; ctx.lineWidth = 3; ctx.stroke();
    }
    ctx.beginPath(); ctx.arc(x, y + 1.5, 11, 0, TAU); ctx.fillStyle = 'rgba(120,60,10,.18)'; ctx.fill();
    ctx.beginPath(); ctx.arc(x, y, 11, 0, TAU); ctx.fillStyle = '#fffdf8'; ctx.fill(); ctx.strokeStyle = ring; ctx.lineWidth = 2; ctx.stroke();
    if (state === 'peel' && tension > 0.25) {
      const [x2, y2] = W(pt(Math.min(THMAX, th + 0.08))), a = Math.atan2(y2 - y, x2 - x) - Math.PI / 2;
      accents(ctx, x, y, 17, a, 'rgba(255,250,240,.95)', 2.2, 7);
    }
  }
  function draw(t) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    if (state === 'start' || state === 'over' || !layers) return;
    ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * ox, 0);
    if (shake) ctx.translate(rand(-3, 3), rand(-2, 2));
    groundShadow(ctx, CX, CY + VIEW_R * FY * 0.9, VIEW_R * 1.0, VIEW_R * 0.17);
    ctx.save();
    ctx.translate(CX, CY); ctx.scale(Z, FY * Z); ctx.translate(-CX, -CY);
    const bx = layers.box;
    if (peelFade >= 1) ctx.drawImage(layers.whole(), CX - bx, CY - bx, bx * 2, bx * 2);
    else {
      ctx.drawImage(layers.flesh, CX - bx, CY - bx, bx * 2, bx * 2);
      if (peelFade > 0) {
        ctx.save(); ctx.globalAlpha = peelFade;
        const sc = 1 + (1 - peelFade) * 0.1;
        ctx.translate(CX, CY); ctx.scale(sc, sc); ctx.translate(-CX, -CY);
        ctx.drawImage(layers.pith, CX - bx, CY - bx, bx * 2, bx * 2);
        ctx.drawImage(layers.peel, CX - bx, CY - bx, bx * 2, bx * 2);
        ctx.restore();
      }
    }
    drawGuide();
    ctx.restore();
    drawTopStem();
    if (state === 'ready') accents(ctx, CX, CY, VIEW_R * 1.08, -0.68, '#f5871f', 3, 15);
    drawRope(ctx, rope, SP * Z * PEEL_W * 1.12, 1);
    drawHandle(t);
    for (const m of bits) {
      ctx.globalAlpha = 1 - m.t / m.life;
      if (m.dash) { ctx.save(); ctx.strokeStyle = m.c; ctx.lineWidth = 2.6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(m.x - m.vx * 0.03, m.y - m.vy * 0.03); ctx.stroke(); ctx.restore(); }
      else { ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, TAU); ctx.fillStyle = m.c; ctx.fill(); }
    }
    ctx.globalAlpha = 1;
  }

  /* ---------- 처음 화면으로 ---------- */
  function goHome() {
    state = 'start';
    sheetOver.hidden = true; hud.hidden = true; guide.hidden = true; hintEl.classList.remove('show'); sheetStart.hidden = false;
    app.dataset.screen = 'start';
    rope = []; layers = null; bits = [];
    cleared.fill(false);
  }

  /* ---------- 결과(시안 4번 + 점수 카드): 완성! · 큰 감귤 · 이번 점수/내 최고점수 · 다시하기/메인으로 ---------- */
  let resMood = 'smile';
  function showResult() {
    state = 'over';
    hud.hidden = true; hintEl.classList.remove('show');
    app.dataset.screen = 'over';
    const ok = cause === 'done', last = stageIdx === STAGES.length - 1;
    const p = ok ? 1 : progress(), pct = lengthPct(), cm = Math.round(p * stageCm());
    save.sync();
    const sc = scoreParts(ok), prev = save.d.best[stageIdx], isNew = sc.total > prev;
    if (isNew) save.d.best[stageIdx] = sc.total;
    if (sc.total > 0) save.d.runs[stageIdx] = topRuns([...(save.d.runs[stageIdx] || []), { s: sc.total, at: Date.now() }]);
    if (ok) { save.d.clear[stageIdx] = true; cleared[stageIdx] = true; }
    save.d.bestCm[stageIdx] = Math.max(save.d.bestCm[stageIdx], cm);
    save.write();
    sheetOver.dataset.ok = ok ? '1' : '0';
    $('r-title').textContent = ok ? (last ? '모두 완성!' : '완성!') : '앗, 끊어졌어요';
    $('r-score').textContent = fmt(sc.total);
    $('r-best').textContent = fmt(save.d.best[stageIdx]);
    const msg = $('r-msg');
    msg.classList.toggle('new', isNew);
    msg.textContent = isNew ? (prev ? 'NEW RECORD! 최고 기록 갱신!' : 'NEW RECORD!') : sc.total === prev ? '최고 기록과 같아요!' : `최고 기록까지 ${fmt(prev - sc.total)}점 남았어요`;
    sheetOver.dataset.cause = cause;
    if (ok) $('r-sub').textContent = `${st.name} · 껍질 ${cm}cm · ${mmss(playClock)}`;
    else { $('r-sub').innerHTML = `<span class="r-cause">${CAUSE_TAG[cause]}</span>`; $('r-sub').append(`${CAUSE[cause]} · ${pct}%까지`); }
    $('r-break').textContent = ok
      ? `길이 ${fmt(sc.length)} + 완주 ${sc.done} + 정확도 ${sc.acc} + 시간 ${sc.time}${st.mult > 1 ? ` (×${st.mult})` : ''}`
      : CAUSE_TIP[cause];
    resMood = isNew ? 'happy' : ok ? 'smile' : 'sad';
    const main = $('main'), alt = $('alt'), rl = $('retry-link');
    alt.textContent = '메인으로'; alt.dataset.act = 'home';
    if (ok && !last) {
      main.innerHTML = `${STAGES[stageIdx + 1].name} 도전 <span class="chev" aria-hidden="true">›</span>`; main.dataset.act = 'next';
      rl.hidden = false; rl.textContent = `${st.name} 다시하기`;   // 최고점수에 다시 도전할 수 있게
    } else { main.textContent = '다시하기'; main.dataset.act = 'retry'; rl.hidden = true; }
    main.dataset.place = `peel20_${main.dataset.act}`;
    // 제주 감귤따기 체험 상세(운영 웹진) — 주소는 config.js
    const cta = $('cta');
    cta.hidden = !CFG.experienceUrl;
    if (CFG.experienceUrl) { cta.href = CFG.experienceUrl; $('cta-label').textContent = CFG.experienceLabel; }
    drawResultArt(ok, p);
    lastScore = sc.total;
    renderRankLine();
    submitShared(stageIdx, save.d.best[stageIdx]);
    sheetOver.hidden = false;
    live.textContent = `${$('r-title').textContent}. 이번 점수 ${sc.total}점, 내 최고점수 ${save.d.best[stageIdx]}점. ${msg.textContent}`;
    main.focus({ preventScroll: true });
  }
  /* ---------- TOP 5 랭킹 ----------
   * 공유 링크(claude.ai)에서는 이 게임을 함께 보는 사람들의 단계별 최고점수를 모아 TOP 5를 보여 줌:
   *   db 'ranks/<내 id>' 문서에 { b1, b2, b3 }(단계별 최고점수)만 저장 — 각자 자기 문서만 쓰고, 모두가 읽음.
   *   이름은 저장하지 않고 화면에 그릴 때마다 claude.ai 프로필 이름으로 찾음.
   * 로컬(파일·로컬 서버)이나 공유 저장소를 못 쓰면 이 기기에서 낸 점수 TOP 5로 대신함.
   * 운영 웹진에서 '모든 방문자' 랭킹을 하려면 서버(점수 저장·닉네임·부정 점수 거르기)가 따로 필요함. */
  let lastScore = 0;
  const RK = { mode: 'local', db: null, user: null, me: null, docs: [], names: {}, readOnly: false, mine: [0, 0, 0] };
  const fmtDate = (ms) => { const d = new Date(ms); return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
  // 이 기기 기록 상위 10개(같은 판은 시각(at)으로 한 번만 — 저장소와 합칠 때 겹치지 않게)
  function topRuns(list) {
    const seen = new Set();
    return list.filter((r) => r && r.s > 0 && !seen.has(r.at) && seen.add(r.at)).sort((a, b) => b.s - a.s || a.at - b.at).slice(0, 10);
  }
  // 단계별 상위 목록: [{ id, s, me }]
  function rankRows(i) {
    if (RK.mode === 'shared') {
      const k = `b${i + 1}`;
      return RK.docs.filter((d) => (d[k] || 0) > 0).map((d) => ({ id: d.id, s: d[k], at: d.at || 0, me: d.id === RK.me })).sort((a, b) => b.s - a.s || a.at - b.at);
    }
    return (save.d.runs[i] || []).map((r, n) => ({ id: `run${n}`, s: r.s, at: r.at, me: false }));
  }
  function readyLine(i, best) {
    const rows = rankRows(i), top = rows[0];
    if (RK.mode === 'shared' && top && !top.me) return `1위 <b>${fmt(top.s)}</b>점 · 내 최고 ${best ? `${fmt(best)}점` : '아직 없음'}`;
    if (RK.mode === 'shared' && top && top.me) return `지금 내가 1위! 내 최고점수 <b>${fmt(best)}</b>점`;
    return best ? `내 최고점수 <b>${fmt(best)}</b>점` : '첫 기록에 도전해 보세요';
  }
  function renderRankLine() {
    const el = $('r-rank-text'), i = stageIdx;
    if (RK.mode === 'shared') {
      const rows = rankRows(i), n = rows.findIndex((r) => r.me) + 1;
      if (n === 1) el.innerHTML = `${st.name} <b>전체 1위!</b>`;
      else if (n > 1) el.innerHTML = `${st.name} 전체 <b>${n}위</b> · 1위까지 ${fmt(rows[0].s - rows[n - 1].s)}점`;
      else if (rows[0]) el.innerHTML = `${st.name} 1위 <b>${fmt(rows[0].s)}</b>점`;
      else el.textContent = `${st.name} 첫 랭킹에 올라가요`;
    } else {
      const rows = rankRows(i), n = rows.findIndex((r) => r.s === lastScore) + 1;
      el.innerHTML = lastScore && n >= 1 && n <= 5 ? `이 기기 TOP 5 중 <b>${n}위</b>` : '이 기기 기록';
    }
  }
  let rankTab = 0;
  async function renderRankSheet() {
    const i = rankTab, rows = rankRows(i).slice(0, 5), all = rankRows(i);
    $('rank-scope').textContent = RK.mode === 'shared' ? '이 게임을 함께 하는 사람들의 단계별 최고점수' : '이 기기에서 낸 점수 (공유 링크에서는 함께 하는 사람들의 랭킹이 보여요)';
    $('rank-tabs').innerHTML = STAGES.map((x, n) => `<button type="button" role="tab" aria-selected="${n === i}" data-i="${n}">${x.name}</button>`).join('');
    if (RK.mode === 'shared' && RK.user) {
      const ids = rows.map((r) => r.id).filter((id) => !(id in RK.names));
      if (ids.length) { try { const ps = await RK.user.profiles(ids); for (const id of ids) RK.names[id] = (ps && ps[id] && ps[id].name) || ''; } catch (e) { /* 이름 없이 표시 */ } }
    }
    const name = (r) => (RK.mode === 'shared' ? (r.me ? '나' : RK.names[r.id] || '익명') : fmtDate(r.at));
    const list = $('rank-list');
    list.innerHTML = rows.length ? rows.map((r, n) => `<li class="${r.me ? 'me' : ''}"><span class="no">${n + 1}</span><span class="nm"></span><span class="sc">${fmt(r.s)}</span></li>`).join('')
      : '<li class="empty">아직 기록이 없어요. 첫 1위에 도전해 보세요!</li>';
    if (rows.length) [...list.querySelectorAll('.nm')].forEach((el, n) => { el.textContent = name(rows[n]); });
    const me = $('rank-me'), myN = all.findIndex((r) => r.me) + 1;
    if (RK.mode === 'shared') {
      if (RK.readOnly) me.textContent = '보기 권한이라 내 점수는 랭킹에 올라가지 않아요';
      else if (myN > 5) me.innerHTML = `내 순위 <b>${myN}위</b> · ${fmt(all[myN - 1].s)}점 · 5위까지 ${fmt(rows[4].s - all[myN - 1].s)}점`;
      else if (!myN) me.textContent = save.d.best[i] ? '내 점수를 올리는 중이에요' : '이 단계를 깨면 랭킹에 이름이 올라가요';
      else me.textContent = '';
    } else me.textContent = save.d.best[i] ? `내 최고점수 ${fmt(save.d.best[i])}점` : '';
  }
  function openRank(i) {
    rankTab = i; $('rank').hidden = false; renderRankSheet();
    $('rank-close').focus({ preventScroll: true });
  }
  function closeRank() { $('rank').hidden = true; }
  // 공유 랭킹: 내 문서에는 단계별 최고점수만(더 높아졌을 때만 한 번 씀)
  async function submitShared(i, best) {
    if (RK.mode !== 'shared' || RK.readOnly || !RK.me || best <= (RK.mine[i] || 0)) return;
    const body = { b1: Math.max(RK.mine[0], i === 0 ? best : 0), b2: Math.max(RK.mine[1], i === 1 ? best : 0), b3: Math.max(RK.mine[2], i === 2 ? best : 0), at: Date.now() };
    try { await RK.db.doc(`ranks/${RK.me}`).set(body); RK.mine = [body.b1, body.b2, body.b3]; }
    catch (e) { if (e && (e.code === 'invalid_argument' || e.code === 'not_granted')) RK.readOnly = true; }
    if (state === 'over') renderRankLine();
  }
  // 확인용: ?test&fakeshared 는 공유 저장소를 흉내 냄(다른 사람 기록 6개가 있는 상태) — 공유 랭킹 화면 확인용
  if (/[?&]test/.test(location.search) && /[?&]fakeshared/.test(location.search)) {
    const store = { a: { b1: 2100, b2: 900, at: 1 }, b: { b1: 1500, at: 2 }, c: { b1: 900, b3: 400, at: 3 }, d: { b1: 2400, at: 4 }, e: { b1: 1200, at: 5 }, f: { b1: 600, at: 6 } };
    const names = { a: '테스트A', b: '테스트B', c: '테스트C', d: '테스트D', e: '테스트E', f: '테스트F' };
    const subs = [];
    const snap = () => ({ docs: Object.keys(store).map((id) => ({ id, data: () => store[id] })) });
    const fdb = { collection: () => ({ onSnapshot: (cb) => { subs.push(cb); setTimeout(() => cb(snap()), 0); return () => {}; } }),
      doc: (path) => ({ set: async (body) => { store[path.split('/')[1]] = body; subs.forEach((cb) => setTimeout(() => cb(snap()), 0)); } }) };
    const fuser = { id: async () => 'me', can: () => true, profiles: async (ids) => Object.fromEntries(ids.map((id) => [id, { name: names[id] || '' }])) };
    window.claude = { use: async (n) => (n === 'db' ? fdb : n === 'user' ? fuser : null) };
  }
  // 공유 저장소 연결(공유 링크에서만 응답함, 없으면 로컬 랭킹 그대로)
  (async () => {
    if (!window.claude || typeof window.claude.use !== 'function') return;
    try {
      const [db, user] = await Promise.all([window.claude.use('db'), window.claude.use('user')]);
      if (!db || !user) return;
      const me = await user.id();
      if (!me) return;
      Object.assign(RK, { mode: 'shared', db, user, me });
      if (user.can && user.can('data.write') === false) RK.readOnly = true;
      db.collection('ranks').onSnapshot((snap) => {
        RK.docs = snap.docs.map((d) => Object.assign({ id: d.id }, d.data()));
        const mine = RK.docs.find((d) => d.id === me);
        RK.mine = mine ? [mine.b1 || 0, mine.b2 || 0, mine.b3 || 0] : [0, 0, 0];
        // 이 기기 최고점수가 공유 기록보다 높으면(예: 공유 전에 낸 점수) 한 번 올림
        for (let i = 0; i < 3; i++) if (save.d.best[i] > RK.mine[i]) { submitShared(i, save.d.best[i]); break; }
        if (!$('rank').hidden) renderRankSheet();
        if (state === 'over') renderRankLine();
        if (state === 'ready') $('best-line').innerHTML = readyLine(stageIdx, save.d.best[stageIdx]);
      }, () => { /* 공유 랭킹을 못 읽으면 로컬 랭킹 그대로 */ });
    } catch (e) { /* 로컬 랭킹 그대로 */ }
  })();

  function act(a) {
    ensureAudio(); sfx.tap();
    if (a === 'next') startStage(stageIdx + 1);
    else if (a === 'retry') startStage(stageIdx);
    else goHome();
  }

  /* ---------- 루프 ---------- */
  // 확인용: ?test 는 rAF 대신 타이머(화면에 안 보이는 미리보기 창용). &bot 은 자동으로 점선을 따라감(&fast 는 일부러 빨리), &stage=1~3
  const qs = new URLSearchParams(location.search);
  const TEST = qs.has('test'), BOT = TEST && qs.has('bot'), BOT_FAST = BOT && qs.has('fast');
  const nextFrame = TEST ? (fn) => setTimeout(() => fn(performance.now()), 16) : requestAnimationFrame;
  let botTh = TH0;
  function bot(dt, now) {
    if (state === 'ready') { const [x, y] = pt(th); botTh = th; grab(x, y, now); return; }
    if (state !== 'peel') return;
    const v = BOT_FAST ? st.vN * 1.4 : (inThin(botTh) ? st.vT : st.vN) * 0.6;
    botTh = Math.min(THMAX, botTh + (v * dt) / Math.max(12, B * botTh));
    const [x, y] = pt(botTh);
    feed(x + rand(-2, 2), y + rand(-2, 2), now);
  }
  let last = 0;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    if (BOT) bot(dt, now);
    update(dt);
    draw(now / 1000);
    if (state === 'start') drawHero(now / 1000);
    else if (state === 'ready') drawFace(faceCtx, 'smile', now / 1000);
    else if (state === 'over') drawFace(rFaceCtx, resMood, now / 1000);
    nextFrame(frame);
  }
  if (TEST) {
    window.__peel = {
      status: () => ({ state, cause, stage: stageIdx + 1, name: st.name, pct: Math.round(progress() * 100), cm: Math.round(progress() * stageCm()), tension: +tension.toFixed(2), score: $('r-score').textContent, sub: $('r-sub').textContent, tip: $('r-break').textContent, power: pbar.style.width + ' ' + pbar.className, cta: $('cta').href, retryLink: !$('retry-link').hidden, best: $('r-best').textContent, msg: $('r-msg').textContent, rank: $('r-rank-text').textContent, rankMode: RK.mode, runs: save.d.runs.map((r) => r.map((x) => x.s)), acc: +accuracy().toFixed(2), main: $('main').dataset.act || '', alt: $('alt').dataset.act || '', saved: save.d }),
      tip: () => { const [x, y] = W(pt(th)); return { x: x * s + ox, y: y * s }; },
      path: (a) => { const [x, y] = W(pt(th + a)); return { x: x * s + ox, y: y * s }; },
    };
  }

  /* ---------- 입력: 껍질을 잡은 손가락(포인터) 하나만 따라감 ---------- */
  const toWorld = (e) => { const r = board.getBoundingClientRect(); return fromScreen((e.clientX - r.left - ox) / s, (e.clientY - r.top) / s); };
  let grabId = null;
  board.addEventListener('pointerdown', (e) => {
    if (state !== 'ready' || BOT || e.target.closest('button')) return;
    try { board.setPointerCapture(e.pointerId); } catch (err) { /* 캡처 못 해도 조작은 그대로 */ }
    const [x, y] = toWorld(e);
    grab(x, y, e.timeStamp);
    if (grabbed) grabId = e.pointerId;
  });
  board.addEventListener('pointermove', (e) => {
    if (state !== 'peel' || !grabbed || BOT || e.pointerId !== grabId) return;
    const list = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
    for (const ev of (list.length ? list : [e])) {
      const [x, y] = toWorld(ev);
      feed(x, y, ev.timeStamp);
      if (state !== 'peel') break;
    }
  });
  const release = () => { if (state === 'peel' && grabbed && !BOT) end('lift'); };
  const releaseIfMine = (e) => { if (e.pointerId === grabId) release(); };
  board.addEventListener('pointerup', releaseIfMine);
  board.addEventListener('pointercancel', releaseIfMine);
  document.addEventListener('visibilitychange', () => { if (document.hidden) release(); });

  const snd = $('snd');
  snd.setAttribute('aria-pressed', String(save.d.sound));
  snd.addEventListener('click', () => { save.d.sound = !save.d.sound; save.write(); snd.setAttribute('aria-pressed', String(save.d.sound)); ensureAudio(); if (save.d.sound) { sfx.tap(); buzz(15); } });

  $('go').addEventListener('click', () => { cleared.fill(false); startStage(TEST && qs.get('stage') ? clamp(Number(qs.get('stage')) - 1, 0, 2) : 0); });
  $('back').addEventListener('click', goHome);
  $('open-rank').addEventListener('click', () => { ensureAudio(); sfx.tap(); openRank(0); });
  $('open-rank2').addEventListener('click', () => { sfx.tap(); openRank(stageIdx); });
  $('rank-close').addEventListener('click', closeRank);
  $('rank').addEventListener('click', (e) => { if (e.target === e.currentTarget) closeRank(); });
  $('rank-tabs').addEventListener('click', (e) => { const b = e.target.closest('button[data-i]'); if (b) { rankTab = Number(b.dataset.i); renderRankSheet(); } });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('rank').hidden) closeRank(); });
  $('main').addEventListener('click', (e) => act(e.currentTarget.dataset.act));
  $('alt').addEventListener('click', (e) => act(e.currentTarget.dataset.act));
  $('retry-link').addEventListener('click', () => act('retry'));

  const hero = $('hero'), heroCtx = hero.getContext('2d'), rArt = $('r-art'), faceCtx = $('face').getContext('2d'), rFaceCtx = $('r-face').getContext('2d');
  const hiDpi = (c) => { const k = Math.min(2, window.devicePixelRatio || 1); c.width = Math.round(c.width * k); c.height = Math.round(c.height * k); };
  for (const id of ['hero', 'r-art', 'c-tl', 'c-br', 'c-br2', 'face', 'r-face']) hiDpi($(id));
  window.addEventListener('resize', layout);
  setStage(0);
  drawCorners();
  nextFrame(frame);
})();
