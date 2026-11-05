/* 감귤 껍질 한 줄 까기 v3.0 픽셀 테마 (Claude Code 버전)
 * v3.0: 첨부 시안처럼 도트(픽셀아트) 테마. 조작·판정·점수·저장·랭킹은 v2.0과 같고 그림만 바뀜:
 *       도트 감귤 캐릭터(칸 단위로 그림) · 구름/계단 언덕/풀 배경 · 게임판을 작은 캔버스에 그려 팔레트 색으로 맞춘 뒤 키움
 *       · 도트 아이콘과 버튼 테두리(border-image)를 코드로 만듦.
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
  const app = $('app'), board = $('board'), cv = $('cv'), ctx = cv.getContext('2d', { willReadFrequently: true });
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
  let P = 3, CELL = 3;   // v3.0: 게임판 한 칸 = P px(화면), CELL = 화면 좌표에서 한 칸 크기
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
    // v3.0: 게임판을 P px 칸으로 작게 그리고 CSS로 키움(도트). dpr = 1/P
    P = clamp(Math.round(r.width / 130), 2, 4);
    dpr = 1 / P;
    cv.width = Math.max(1, Math.floor(r.width / P)); cv.height = Math.max(1, Math.floor(r.height / P));
    cv.style.width = `${cv.width * P}px`; cv.style.height = `${cv.height * P}px`;
    WH = clamp(r.height * (WW / r.width), 520, 900);
    s = Math.min(r.width / WW, r.height / WH);
    ox = (r.width - WW * s) / 2;
    CELL = P / s;
    const RVy = VIEW_R * FY;
    CY = clamp(WH * 0.52, 176 / s + RVy, WH - RVy - 150 / s);
    if (layers) { layers = makeLayers(s * dpr * Z); layers.erase(0, th); }
    sizeArt();
  }

  /* ---------- 도트(픽셀아트) 재료 ----------
   * v3.0: 첨부 시안처럼 모든 그림을 도트로. 캔버스를 '칸' 단위로 작게 그리고 CSS image-rendering:pixelated로 키움.
   *  - 캐릭터·배경(시작 화면, 얼굴, 결과 그림): 칸마다 직접 칠함(cells) → 또렷한 1칸 외곽선
   *  - 게임판(나선·껍질 띠): 기존 벡터 그림을 작은 캔버스에 그린 뒤 quantize로 팔레트 색에 맞춤 */
  const C = {
    ink: '#4a2812', od: '#e2701c', o: '#f7922c', ol: '#ffad48', oh: '#ffd27e', shine: '#fff4dc',
    cream: '#fff1d2', pith: '#fff6e4', fl: '#ffc565', fl2: '#ffb24d', fll: '#ffe2a6', fld: '#ef9a3c',
    leaf: '#6fb34c', leafM: '#89c95d', leafD: '#428a37', red: '#d9452b', redD: '#a8301c', yel: '#ffe27a', white: '#ffffff',
    pink: '#f6a39b', ground: '#d6ebbd', grass: '#9fd27e', grassD: '#6fb553', tan: '#efd7b0',
    hill: '#fde0b0', hillL: '#feedd2', cloud: '#d8eaed', cloudL: '#eef6f5',
  };
  const PAL = Object.values(C).map((h) => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; });
  const qCache = new Map();
  // 반 넘게 칠해진 칸만 남기고(반투명 가장자리 없앰) 모든 칸을 가장 가까운 팔레트 색으로 → 또렷한 도트
  function quantize(g) {
    const w = g.canvas.width, h = g.canvas.height;
    if (!w || !h) return;
    const im = g.getImageData(0, 0, w, h), d = im.data;
    if (qCache.size > 40000) qCache.clear();
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 128) { d[i + 3] = 0; continue; }
      d[i + 3] = 255;
      const key = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2];
      let c = qCache.get(key);
      if (!c) {
        let bd = Infinity;
        for (const p of PAL) { const dr = d[i] - p[0], dg = d[i + 1] - p[1], db = d[i + 2] - p[2], dd = 2 * dr * dr + 4 * dg * dg + 3 * db * db; if (dd < bd) { bd = dd; c = p; } }
        qCache.set(key, c);
      }
      d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2];
    }
    g.putImageData(im, 0, 0);
  }
  // 칸 단위 모양: inside(칸 가운데)가 참인 칸을 칠하고, 상하좌우 이웃 중 바깥이 있으면 외곽선 색(line=null이면 외곽선 없음)
  function cells(g, x0, y0, x1, y1, inside, color, line = C.ink) {
    for (let y = Math.floor(y0); y < Math.ceil(y1); y++) {
      for (let x = Math.floor(x0); x < Math.ceil(x1); x++) {
        const px = x + 0.5, py = y + 0.5;
        if (!inside(px, py)) continue;
        const edge = line && (!inside(px - 1, py) || !inside(px + 1, py) || !inside(px, py - 1) || !inside(px, py + 1));
        const c = edge ? line : color(px, py);
        if (c) { g.fillStyle = c; g.fillRect(x, y, 1, 1); }
      }
    }
  }
  // 글자 지도 찍기(한 글자 = 한 칸, '.'은 비움). k = 칸 크기
  function stamp(g, map, pal, x, y, k = 1) {
    map.forEach((row, j) => { for (let i = 0; i < row.length; i++) { const c = pal[row[i]]; if (c) { g.fillStyle = c; g.fillRect(x + i * k, y + j * k, k, k); } } });
  }
  const hash = (x, y) => { let h = (x * 374761393 + y * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const seeded = (seed) => { let sd = seed; return () => (sd = (sd * 16807) % 2147483647) / 2147483647; };
  const TUFT = ['g.g.g', 'G.G.G', '.GGG.'];
  const TUFT_PAL = { g: C.grass, G: C.grassD };
  const SPARK = ['..a..', '..a..', 'aabaa', '..a..', '..a..'];

  // 잎(칸): 꼭지 끝에서 오른쪽 위로. 위쪽 절반은 밝은 초록, 가운데 잎맥
  function pxLeaf(g, bx, by, L, Wd, ang) {
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const loc = (x, y) => { const dx = x - bx, dy = y - by; return [dx * ca + dy * sa, -dx * sa + dy * ca]; };
    const inside = (x, y) => { const [u, v] = loc(x, y); return u >= 0 && u <= L && Math.abs(v) <= (Wd / 2) * Math.pow(Math.sin((Math.PI * u) / L), 0.7); };
    cells(g, bx - Wd, by - L - Wd, bx + L + Wd, by + Wd, inside, (x, y) => {
      const [u, v] = loc(x, y);
      return Math.abs(v) < 0.55 && u > L * 0.18 && u < L * 0.82 ? C.leafD : v < 0 ? C.leafM : C.leaf;
    });
  }
  // 표정(칸 그림): 큰 감귤(시작 화면)과 작은 감귤(얼굴 아이콘) 두 벌. 가운데 선을 기준으로 좌우 대칭
  function pxFace(g, cx, cy, rx, ry, mood, blink) {
    const X = Math.round(cx), Y = Math.round(cy + (rx >= 15 ? 0 : ry * 0.12)), K = C.ink;
    const put = (dx, dy, c) => { g.fillStyle = c; g.fillRect(X + dx, Y + dy, 1, 1); g.fillRect(X - 1 - dx, Y + dy, 1, 1); };
    const run = (a, b, dy, c) => { for (let x = a; x <= b; x++) put(x, dy, c); };
    if (rx >= 15) {
      run(-13, -11, 2, C.pink); run(-14, -10, 3, C.pink); run(-13, -11, 4, C.pink);
      if (mood === 'happy') { run(-8, -7, -2, K); put(-9, -1, K); put(-6, -1, K); }
      else if (blink) run(-8, -7, 0, K);
      else for (let y = mood === 'sad' ? -3 : -4; y <= 0; y++) run(-8, -7, y, K);
      if (mood === 'sad') { put(-5, 3, K); run(-4, -1, 2, K); }
      else if (mood === 'happy') { run(-5, -1, 2, K); put(-5, 3, K); run(-4, -1, 3, C.pink); run(-4, -1, 4, K); }
      else { put(-5, 2, K); run(-4, -1, 3, K); }
    } else {
      run(-5, -4, 1, C.pink);
      if (mood === 'happy') { put(-4, -1, K); put(-2, -1, K); put(-3, -2, K); }
      else if (blink) put(-3, 0, K);
      else { put(-3, -1, K); put(-3, 0, K); }
      if (mood === 'sad') { put(-1, 1, K); put(-2, 2, K); }
      else if (mood === 'happy') { run(-2, -1, 1, K); put(-1, 2, K); }
      else { put(-2, 1, K); put(-1, 2, K); }
    }
  }
  // 도트 감귤(시안 캐릭터): 갈색 1칸 외곽선 · 오른쪽 아래 진한 주황 · 왼쪽 위 밝은 주황과 흰 반짝임 · 꼭지 · 잎 · 표정
  // o.cut: 위쪽부터 이만큼(-1~1) 깐 모습(결과 화면 '끊어졌어요')
  function pxTangerine(g, cx, cy, rx, ry, o = {}) {
    const big = rx >= 15;
    const inE = (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
    cells(g, cx - rx - 1, cy - ry - 1, cx + rx + 1, cy + ry + 1, inE, (x, y) => {
      const nx = (x - cx) / rx, ny = (y - cy) / ry;
      if (o.cut != null && ny < o.cut) return ny > o.cut - 0.09 ? C.pith : hash(x | 0, y | 0) < 0.1 ? C.fll : C.fl;
      const u = (nx + 0.5) * 0.8 + (ny + 0.5) * 0.6, v = -(nx + 0.5) * 0.6 + (ny + 0.5) * 0.8;
      if ((u / 0.2) ** 2 + (v / (big ? 0.085 : 0.14)) ** 2 <= 1) return C.shine;
      if ((nx + 0.16) ** 2 + (ny + 0.2) ** 2 > 1.02) return C.od;
      if ((nx + 0.42) ** 2 + (ny + 0.44) ** 2 < 0.17) return C.ol;
      if (big && hash(x | 0, y | 0) < 0.03) return C.od;
      return C.o;
    });
    const top = Math.round(cy - ry), X = Math.round(cx);
    const sh = big ? 6 : Math.max(2, Math.round(ry * 0.32)), sw = big ? 2 : 1;
    if (o.stem !== false) { g.fillStyle = C.ink; g.fillRect(X - (big ? 1 : 0), top - sh + 1, sw, sh); }
    if (o.leaf !== false) pxLeaf(g, X + (big ? 1 : 1), top - sh + (big ? 2 : 1), rx * 0.84, Math.max(3, rx * 0.4), -0.45);
    if (o.face) pxFace(g, cx, cy, rx, ry, o.face, o.blink);
  }
  // 다 깐 감귤(칸): 세로로 휜 조각 줄 · 조각 사이 골 · 흰 결 · 꼭지 자리
  function pxPeeled(g, cx, cy, rx, ry) {
    const inE = (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
    cells(g, cx - rx - 1, cy - ry - 1, cx + rx + 1, cy + ry + 1, inE, (x, y) => {
      const nx = (x - cx) / rx, ny = (y - cy) / ry;
      const q = (Math.asin(clamp(nx / Math.sqrt(Math.max(0.04, 1 - ny * ny)), -1, 1)) / Math.PI + 0.5) * 7, f = q - Math.floor(q);
      if (((nx + 0.45) / 0.16) ** 2 + ((ny + 0.5) / 0.08) ** 2 < 1) return C.white;
      if (f < 0.16 && q > 0.4 && q < 6.6) return C.fld;
      if ((nx + 0.12) ** 2 + (ny + 0.14) ** 2 > 0.98) return C.fl2;
      if (Math.abs(f - 0.55) < 0.12 && Math.abs(ny) < 0.55 && hash(x | 0, y | 0) < 0.55) return C.fll;
      return C.fl;
    });
    const top = Math.round(cy - ry), X = Math.round(cx);
    g.fillStyle = C.pith; g.fillRect(X - 2, top + 1, 4, 1);
    g.fillStyle = C.ink; g.fillRect(X - 1, top - 2, 2, 3);
  }
  // 반달 감귤 조각(시작 화면): 둥근 쪽은 껍질, 자른 면에 흰 속껍질, 속살에 방사형 흰 줄
  function pxSegment(g, sx, sy, R, ang) {
    const ca = Math.cos(ang), sa = Math.sin(ang), R2 = R * 0.8;
    const loc = (x, y) => { const dx = x - sx, dy = y - sy; return [dx * ca + dy * sa, -dx * sa + dy * ca]; };
    const inside = (x, y) => { const [u, v] = loc(x, y); return v <= 0.9 && (u / R) ** 2 + (v / R2) ** 2 <= 1; };
    cells(g, sx - R - 2, sy - R - 2, sx + R + 2, sy + R + 2, inside, (x, y) => {
      const [u, v] = loc(x, y), nr = Math.hypot(u / R, v / R2);
      if (v > -0.5) return C.pith;
      if (nr > 0.78) return C.o;
      if (nr > 0.66) return C.pith;
      const a = (Math.atan2(-v, u) / Math.PI) * 5;
      return Math.abs(a - Math.round(a)) < 0.14 && nr > 0.18 ? C.fll : C.fl;
    });
  }
  function pxCloud(g, x, y, w) {
    const k = w / 22, cs = [[4.5, 6, 4.2], [10.5, 3.6, 5.6], [16.5, 5.6, 4.6]], base = y + 9 * k;
    const inside = (px, py) => py <= base && (cs.some(([a, b, r]) => (px - x - a * k) ** 2 + (py - y - b * k) ** 2 <= (r * k) ** 2) || (py >= y + 6 * k && px >= x + 2 * k && px <= x + 20 * k));
    cells(g, x - 2, y - 3, x + w + 2, base + 1, inside, (px, py) => (py < y + 4.6 * k ? C.cloudL : C.cloud), null);
  }
  // 계단 모양 언덕(3칸씩 오르내림) + 계단 윗면 밝게
  function pxHill(g, px, base, hgt, hw, col, top) {
    for (let x = Math.floor(px - hw); x <= Math.ceil(px + hw); x++) {
      const t = 1 - Math.abs(x + 0.5 - px) / hw;
      if (t <= 0) continue;
      const hh = Math.floor((Math.min(1, t * 1.3) * hgt) / 3) * 3;
      if (hh <= 0) continue;
      g.fillStyle = col; g.fillRect(x, base - hh, 1, hh);
      g.fillStyle = top; g.fillRect(x, base - hh, 1, 1);
    }
  }
  function pxSparks(g, cx, cy, rx, ry, angs, len, col) {
    g.fillStyle = col;
    for (const a of angs) for (let i = 0; i < len; i++) g.fillRect(Math.round(cx + Math.cos(a) * (rx * 1.2 + i)), Math.round(cy + Math.sin(a) * (ry * 1.24 + i)), 2, 2);
  }

  /* ---------- 게임판 그림(벡터 → 작은 캔버스 → quantize) ---------- */
  // CELL: 화면 좌표에서 한 칸의 크기(= 칸 크기 P ÷ 배율 s). 귤 좌표(Z배 확대 안쪽)에서는 CELL / Z
  function stem(g, x, y, h) { g.fillStyle = C.ink; g.fillRect(x - CELL, y - h, CELL * 2, h); }
  function leaf(g, x, y, len, ang) {
    g.save(); g.translate(x, y); g.rotate(ang);
    const shape = () => { g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(len * 0.25, -len * 0.42, len * 0.72, -len * 0.42, len, -len * 0.04); g.bezierCurveTo(len * 0.7, len * 0.3, len * 0.28, len * 0.28, 0, 0); g.closePath(); };
    shape(); g.strokeStyle = C.ink; g.lineWidth = CELL * 2.2; g.lineJoin = 'round'; g.stroke();
    shape(); g.fillStyle = C.leaf; g.fill();
    g.save(); shape(); g.clip(); g.fillStyle = C.leafM; g.fillRect(0, -len, len, len * 0.97); g.restore();
    g.beginPath(); g.moveTo(len * 0.12, -len * 0.01); g.lineTo(len * 0.84, -len * 0.04); g.strokeStyle = C.leafD; g.lineWidth = CELL; g.lineCap = 'butt'; g.stroke();
    g.restore();
  }
  // 반짝 표시 세 줄(도트: 끝이 네모난 굵은 선)
  function accents(g, x, y, r, a0, color = C.o, w = CELL * 2, len = r * 0.14) {
    g.save(); g.strokeStyle = color; g.lineWidth = w; g.lineCap = 'butt';
    const spread = Math.min(0.36, (len * 1.3) / r);
    for (let i = 0; i < 3; i++) {
      const a = a0 + (i - 1) * spread, r1 = r, r2 = r + len * (i === 1 ? 1 : 0.72);
      g.beginPath(); g.moveTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1); g.lineTo(x + Math.cos(a) * r2, y + Math.sin(a) * r2); g.stroke();
    }
    g.restore();
  }
  // 귤 아래 연둣빛 땅 + 풀 두 포기(시작 화면 배경과 같은 느낌)
  function groundShadow(g, x, y, rx, ry) {
    g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, TAU); g.fillStyle = C.ground; g.fill();
    stamp(g, TUFT, TUFT_PAL, x - rx * 0.92, y - ry - CELL * 2, CELL);
    stamp(g, TUFT, TUFT_PAL, x + rx * 0.8, y - ry * 0.4 - CELL * 2, CELL);
  }

  const deco = (() => {
    const rnd = seeded(5);
    const vesicles = [], cuts = [];
    let acc = rnd() * TAU; const n = 11;
    for (let i = 0; i < n; i++) { cuts.push(acc); acc += (TAU / n) * (0.82 + rnd() * 0.36); }
    const sc = TAU / (acc - cuts[0]); for (let i = 0; i < n; i++) cuts[i] = cuts[0] + (cuts[i] - cuts[0]) * sc;
    for (let i = 0; i < 160; i++) { const a = rnd() * TAU, r = 0.14 + Math.sqrt(rnd()) * 0.8; vesicles.push([a, r]); }
    return { vesicles, cuts };
  })();

  // 껍질 바깥선: 원보다 살짝 크고 울퉁불퉁(나선 끝보다 항상 바깥이라 판정에 영향 없음)
  const peelR = (a) => RT * (1.03 + 0.01 * Math.sin(3 * a + 0.7) + 0.006 * Math.sin(5 * a + 2.1));
  const fleshR = (a) => RT + 2.5 + RT * (0.006 + 0.006 * Math.sin(3 * a + 0.7) + 0.004 * Math.sin(7 * a + 1.3));
  function blob(g, rf) {
    g.beginPath();
    for (let i = 0; i <= 160; i++) { const a = (i / 160) * TAU, r = rf(a), x = CX + Math.cos(a) * r, y = CY + Math.sin(a) * r; i ? g.lineTo(x, y) : g.moveTo(x, y); }
    g.closePath();
  }
  // 겉껍질(귤 좌표): 진한 주황 테두리 쪽 그늘 · 왼쪽 위 밝은 주황 · 흰 반짝임 · 껍질 구멍 도트
  function paintPeel(g) {
    const R = RT * 1.03, u = CELL / Z;
    blob(g, peelR); g.fillStyle = C.od; g.fill();
    g.save(); blob(g, peelR); g.clip();
    g.beginPath(); g.ellipse(CX - R * 0.1, CY - R * 0.12, R * 0.95, R * 0.95, 0, 0, TAU); g.fillStyle = C.o; g.fill();
    g.beginPath(); g.ellipse(CX - R * 0.4, CY - R * 0.42, R * 0.4, R * 0.33, -0.75, 0, TAU); g.fillStyle = C.ol; g.fill();
    g.beginPath(); g.ellipse(CX - R * 0.5, CY - R * 0.55, R * 0.17, R * 0.075, -0.75, 0, TAU); g.fillStyle = C.shine; g.fill();
    const rnd = seeded(23); g.fillStyle = C.od;
    for (let i = 0; i < 120; i++) {
      const a = rnd() * TAU, r = Math.sqrt(rnd()) * R * 0.88, x = CX + Math.cos(a) * r, y = CY + Math.sin(a) * r;
      if (Math.hypot(x - (CX - R * 0.42), y - (CY - R * 0.44)) < R * 0.42) continue;
      g.fillRect(x, y, u, u);
    }
    g.restore();
  }
  // 흰 속껍질: 크림색 + 섬유 도트
  function paintPith(g) {
    const u = CELL / Z;
    blob(g, fleshR); g.fillStyle = C.pith; g.fill();
    g.save(); g.clip();
    const rnd = seeded(11); g.fillStyle = C.cream;
    for (let i = 0; i < 90; i++) { const a = rnd() * TAU, r = Math.sqrt(rnd()) * RT; g.fillRect(CX + Math.cos(a) * r, CY + Math.sin(a) * r, u * 2, u); }
    g.restore();
  }
  // 깐 속살: 소용돌이 조각(두 가지 살구색) + 흰 경계 줄 + 알갱이 도트 + 오른쪽 아래 그늘
  function paintFlesh(g) {
    const u = CELL / Z;
    blob(g, fleshR); g.fillStyle = C.fl; g.fill();
    g.save(); blob(g, fleshR); g.clip();
    const cuts = deco.cuts, n = cuts.length, R = RT * 1.1, SWIRL = 0.3;
    const edge = (a) => [CX + Math.cos(a + SWIRL) * R * 0.5, CY + Math.sin(a + SWIRL) * R * 0.5, CX + Math.cos(a) * R, CY + Math.sin(a) * R];
    for (let i = 0; i < n; i++) {
      const a = cuts[i], b = i + 1 < n ? cuts[i + 1] : cuts[0] + TAU;
      const [c1x, c1y, e1x, e1y] = edge(a), [c2x, c2y] = edge(b);
      g.beginPath(); g.moveTo(CX, CY); g.quadraticCurveTo(c1x, c1y, e1x, e1y); g.arc(CX, CY, R, a, b); g.quadraticCurveTo(c2x, c2y, CX, CY); g.closePath();
      g.fillStyle = i % 2 ? C.fl2 : C.fl; g.fill();
    }
    g.fillStyle = C.fll;
    for (const [a, r] of deco.vesicles) g.fillRect(CX + Math.cos(a) * r * RT, CY + Math.sin(a) * r * RT, u, u);
    g.strokeStyle = C.pith; g.lineWidth = u * 1.3; g.lineCap = 'butt';
    for (const a of cuts) { const [cx, cy, ex, ey] = edge(a); g.beginPath(); g.moveTo(CX, CY); g.quadraticCurveTo(cx, cy, ex, ey); g.stroke(); }
    g.beginPath(); g.arc(CX, CY, RT * 0.08, 0, TAU); g.fillStyle = C.pith; g.fill();
    g.beginPath(); g.arc(CX, CY, RT * 1.01, -0.35, 2.05); g.strokeStyle = C.fld; g.lineWidth = u * 3; g.stroke();
    g.restore();
  }

  // 과육 · 흰 속껍질 · 겉껍질 세 층을 미리 그려 두고, 깐 만큼 지움(깐 자리가 바뀔 때만 다시 합침)
  // 합칠 때 층마다 상하좌우 1칸씩 단단한 그림자를 깔아 도트 외곽선을 만듦(껍질 띠 가장자리도 갈색 테두리)
  function outlined(g, img, col) {
    g.save(); g.shadowColor = col; g.shadowBlur = 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { g.shadowOffsetX = dx; g.shadowOffsetY = dy; g.drawImage(img, 0, 0); }
    g.restore();
    g.drawImage(img, 0, 0);
  }
  function makeLayers(k) {
    const box = RT * 1.07 + 8, size = Math.ceil(box * 2 * k);
    const mk = () => { const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d'); g.setTransform(k, 0, 0, k, -(CX - box) * k, -(CY - box) * k); return [c, g]; };
    const [fc, fg] = mk(), [pc, pg] = mk(), [wc, wg] = mk(), [cc, cg] = mk(), [oc, og] = mk();
    paintFlesh(fg); paintPith(wg); paintPeel(pg);
    og.setTransform(1, 0, 0, 1, 0, 0); outlined(og, fc, C.ink);
    let dirty = true;
    const compose = () => {
      cg.save(); cg.setTransform(1, 0, 0, 1, 0, 0); cg.clearRect(0, 0, size, size);
      cg.drawImage(oc, 0, 0);
      outlined(cg, wc, C.fld);
      outlined(cg, pc, C.ink);
      cg.restore();
      dirty = false;
    };
    const erase = (g, a, b, w, off) => {
      g.save(); g.globalCompositeOperation = 'destination-out';
      g.lineWidth = w; g.lineCap = 'butt'; g.lineJoin = 'round';
      g.beginPath(); path(g, Math.max(0, a - 0.03), b, 0.03, off); g.stroke(); g.restore();
    };
    // 벗긴 자리가 '나선 띠'로 보이게: 띠 간격보다 좁게(PEEL_W) 지워 바퀴 사이에 주황 껍질이 남고,
    // 속껍질은 조금 덜 지워 띠 양쪽 가장자리에 흰 테두리가 보임
    return {
      flesh: oc, peel: pc, pith: wc, box,
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

  // 껍질 띠(도트): 갈색 외곽선 · 앞면 주황(아래쪽 진한 줄 · 위쪽 밝은 줄) · 뒤집힌 면 크림 · 땅에 생기는 그림자
  // curl > 0 이면 늘어진 길이를 따라 S자로 부드럽게 말리게 그림(물리는 그대로, 그릴 때만 옆으로 휘게). cell = 한 칸 크기
  function drawRope(g, src, w, curl = 0, cell = CELL) {
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
      if (d < (cell === CELL ? 3 : 1)) { tx = ptx; ty = pty; } else { tx /= d; ty /= d; if (tx * ptx + ty * pty < -0.2 && i) { tx = ptx; ty = pty; } }
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
    outline(cell, cell * 2.5); g.fillStyle = C.tan; g.fill();
    outline(0, 0); g.strokeStyle = C.ink; g.lineWidth = cell * 2.4; g.stroke();
    const m = (p, q, k) => [p[0] + (q[0] - p[0]) * k, p[1] + (q[1] - p[1]) * k];
    for (let i = 0; i < n - 1; i++) {
      const out = face[i] + face[i + 1] > -0.7;
      g.beginPath(); g.moveTo(L[i][0], L[i][1]); g.lineTo(L[i + 1][0], L[i + 1][1]); g.lineTo(R[i + 1][0], R[i + 1][1]); g.lineTo(R[i][0], R[i][1]); g.closePath();
      g.fillStyle = out ? C.o : C.cream; g.strokeStyle = g.fillStyle; g.lineWidth = cell * 0.5; g.fill(); g.stroke();
      const a1 = m(R[i], L[i], 0.3), a2 = m(R[i + 1], L[i + 1], 0.3);
      g.beginPath(); g.moveTo(R[i][0], R[i][1]); g.lineTo(R[i + 1][0], R[i + 1][1]); g.lineTo(a2[0], a2[1]); g.lineTo(a1[0], a1[1]); g.closePath();
      g.fillStyle = out ? C.od : C.fll; g.fill();
      const b1 = m(L[i], R[i], 0.22), b2 = m(L[i + 1], R[i + 1], 0.22);
      g.beginPath(); g.moveTo(b1[0], b1[1]); g.lineTo(b2[0], b2[1]); g.strokeStyle = out ? C.ol : C.white; g.lineWidth = cell; g.lineCap = 'butt'; g.stroke();
    }
    g.restore();
  }

  /* ---------- 시작 화면 장면(시안): 구름 · 계단 언덕 · 지평선 · 풀 · 웃는 감귤 · 감귤 조각 · 반짝 표시 ---------- */
  let heroKey = '';
  function drawHero(t) {
    const g = heroCtx, W = hero.width, H = hero.height;
    if (!W || !H) return;
    const bob = Math.floor(t / 0.55) % 2 ? -1 : 0, blink = t % 3.8 < 0.14, drift = Math.floor(t * 1.5);
    const key = `${W}|${H}|${bob}|${blink}|${drift}`;
    if (key === heroKey) return;
    heroKey = key;
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H);
    const cx = Math.floor(W / 2), cy = 36, gy = 46, span = W + 36;
    pxCloud(g, ((drift + 8) % span) - 28, 2, 24);
    pxCloud(g, ((drift + Math.round(W * 0.8)) % span) - 28, 12, 20);
    pxHill(g, 10, gy, 25, 36, C.hillL, '#fff6e8');
    pxHill(g, W - 12, gy, 22, 34, C.hillL, '#fff6e8');
    pxHill(g, 26, gy, 15, 24, C.hill, C.hillL);
    pxHill(g, W - 30, gy, 12, 22, C.hill, C.hillL);
    g.fillStyle = C.grass; g.fillRect(0, gy, W, 1);
    g.fillStyle = C.ground; g.fillRect(0, gy + 1, W, 1);
    stamp(g, TUFT, TUFT_PAL, 5, gy - 2);
    stamp(g, TUFT, TUFT_PAL, W - 11, gy - 2);
    cells(g, cx - 32, 50, cx + 36, 60, (x, y) => ((x - cx - 4) / 29) ** 2 + ((y - 56) / 3.4) ** 2 <= 1, () => C.ground, null);
    for (const [dx, y] of [[-44, 50], [-52, 56], [38, 50], [46, 56]]) stamp(g, TUFT, TUFT_PAL, cx + dx, y);
    pxSparks(g, cx, cy + bob, 23, 20, [-2.78, -2.4, -2.02], bob ? 4 : 3, C.o);
    pxTangerine(g, cx, cy + bob, 23, 20, { face: 'smile', blink });
    pxSegment(g, cx + 26, 54, 10, 0.35);
  }
  // 얼굴 아이콘(준비 말풍선 · 결과 점수 카드): smile(가끔 깜빡) · happy(최고 기록, 통통 뜀) · sad(끊어짐)
  function drawFace(g, mood, t) {
    const S = g.canvas.width;
    if (!S) return;
    const bob = mood === 'happy' ? (Math.floor(t / 0.18) % 2 ? -1 : 0) : (Math.floor(t / 0.6) % 2 ? -1 : 0);
    const blink = mood === 'smile' && t % 3.8 < 0.14, key = `${S}|${mood}|${bob}|${blink}`;
    if (g.__k === key) return;
    g.__k = key;
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, S, S);
    const r = S * 0.39;
    pxTangerine(g, S / 2, S * 0.6 + bob, r, r * 0.88, { face: mood, blink });
  }
  function ribbonArt(g, f, n, w, twist) {
    const pts = [];
    for (let i = 0; i < n; i++) { const t = i / (n - 1), [x, y] = f(t); pts.push({ x, y, ph: 0.3 + t * twist }); }
    drawRope(g, pts, w, 0, 1);
    return pts;
  }
  // 결과 그림(96×72칸): 완성 = 다 깐 감귤 + 길게 이어진 껍질 + 반짝이 / 끊어짐 = 덜 깐 감귤 + 짧게 끊긴 껍질
  let lastArt = null;
  function drawResultArt(ok, pct) {
    lastArt = [ok, pct];
    const g = rArt.getContext('2d', { willReadFrequently: true }), W = rArt.width, H = rArt.height;
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H);
    cells(g, 4, H - 14, W - 4, H - 2, (x, y) => ((x - W / 2) / (W * 0.44)) ** 2 + ((y - (H - 8)) / 4) ** 2 <= 1, () => C.ground, null);
    if (ok) {
      ribbonArt(g, (t) => [W * (0.05 + t * 0.9), H * (0.8 + 0.05 * Math.sin(t * Math.PI * 2.6 + 0.4) + t * 0.03)], 50, 8, 11);
      pxPeeled(g, W * 0.52, H * 0.42, 21, 18);
      for (const [x, y] of [[0.16, 0.18], [0.84, 0.12], [0.9, 0.48], [0.12, 0.5]]) stamp(g, SPARK, { a: C.o, b: C.yel }, Math.round(W * x) - 2, Math.round(H * y) - 2);
    } else {
      pxTangerine(g, W * 0.4, H * 0.5, 20, 17.5, { cut: -1 + (0.25 + pct * 0.5) * 1.1, leaf: false });
      const pts = ribbonArt(g, (t) => [W * (0.66 + t * 0.26), H * (0.6 + Math.sin(t * 5) * 0.07 + t * 0.18)], 8 + Math.round(pct * 10), 8, 5);
      const e = pts[pts.length - 1];
      pxSparks(g, e.x, e.y, 3, 3, [-0.6, 0, 0.6], 3, C.red);
    }
    quantize(g);
  }

  /* ---------- 도트 아이콘 · 버튼 테두리 · 단계 감귤(시작할 때 한 번 만듦) ---------- */
  const ICONS = {
    snd: ['.....kk.....', '....kkk...k.', '...kkkk.k..k', 'kkkkkkk..k.k', 'kkkkkkk..k.k', 'kkkkkkk..k.k', 'kkkkkkk..k.k', '...kkkk.k..k', '....kkk...k.', '.....kk.....'],
    sndOff: ['.....kk.....', '....kkk.....', '...kkkk.....', 'kkkkkkk.k..k', 'kkkkkkk..kk.', 'kkkkkkk..kk.', 'kkkkkkk.k..k', '...kkkk.....', '....kkk.....', '.....kk.....'],
    back: ['...k.......', '..kk.......', '.kkkkkkkkkk', 'kkkkkkkkkkk', '.kkkkkkkkkk', '..kk.......', '...k.......'],
    close: ['kk.....kk', 'kkk...kkk', '.kkk.kkk.', '..kkkkk..', '...kkk...', '..kkkkk..', '.kkk.kkk.', 'kkk...kkk', 'kk.....kk'],
    crown: ['k....k....k', 'kk..kok..kk', 'kokkoookkok', 'koooooooook', 'koyooyooyok', 'koooooooook', 'kkkkkkkkkkk'],
    play: ['kk.....', 'kck....', 'kcck...', 'kccck..', 'kcccck.', 'kccccck', 'kcccck.', 'kccck..', 'kcck...', 'kck....', 'kk.....'],
    clock: ['..kkkkk..', '.kccccck.', 'kccckccck', 'kccckccck', 'kccckkkck', 'kccccccck', 'kccccccck', '.kccccck.', '..kkkkk..'],
    hand: ['...kk......', '..kwwk.....', '..kwwk.....', '..kwwkkk...', '..kwwkwwkk.', 'kkkwwkwwkwk', 'kwkwwwwwwwk', 'kwwwwwwwwwk', '.kwwwwwwwwk', '.kwwwwwwwk.', '..kwwwwwwk.', '...kwwwwk..', '...kkkkkk..'],
  };
  const ICON_PAL = { k: C.ink, o: C.o, y: C.yel, c: C.cream, w: '#fffaf0' };
  function iconSvg(map) {
    const h = map.length, w = map[0].length;
    let r = '';
    map.forEach((row, y) => {
      for (let x = 0; x < w;) {
        const ch = row[x], c = ICON_PAL[ch];
        let x2 = x + 1; while (x2 < w && row[x2] === ch) x2++;
        if (c) r += `<rect x="${x}" y="${y}" width="${x2 - x}" height="1" fill="${c}"/>`;
        x = x2;
      }
    });
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges">${r}</svg>`;
  }
  // 버튼·상자 테두리(9×10칸): 3칸 계단 모서리 · 위 밝은 줄 · 아래 어두운 두 줄 · 맨 아래 그림자 줄. P = 한 칸의 px
  function boxImage(c, P) {
    const W = 9, H0 = 9, H = 10, inset = (y) => (y === 0 || y === H0 - 1 ? 2 : y === 1 || y === H0 - 2 ? 1 : 0);
    const inside = (x, y) => y >= 0 && y < H0 && x >= inset(y) && x < W - inset(y);
    let r = '';
    const put = (x, y, col) => { r += `<rect x="${x}" y="${y}" width="1" height="1" fill="${col}"/>`; };
    for (let y = 0; y < H0; y++) for (let x = 0; x < W; x++) {
      if (!inside(x, y)) continue;
      const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
      put(x, y, edge ? c.k : y === 1 ? c.h : y >= H0 - 3 ? c.l : c.f);
    }
    for (let x = 2; x < W - 2; x++) put(x, H0, c.s);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W * P}" height="${H * P}" viewBox="0 0 ${W} ${H}" shape-rendering="crispEdges">${r}</svg>`;
    return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
  }
  function initPixelUI() {
    document.querySelectorAll('.ico[data-ico]').forEach((el) => { const m = ICONS[el.dataset.ico]; if (m) el.innerHTML = iconSvg(m); });
    const cream = { k: C.ink, f: '#fffaf0', h: C.white, l: '#f3e2c4', s: C.tan };
    const orange = { k: C.ink, f: C.o, h: C.ol, l: C.od, s: '#e0b47c' };
    const yellow = { k: C.ink, f: '#ffe7bd', h: '#fff3da', l: '#ffd596', s: C.tan };
    const panel = { k: '#8f5f38', f: '#fff8ea', h: C.white, l: '#f6e6c8', s: C.tan };
    const red = { k: C.ink, f: C.red, h: '#ef6a4c', l: C.redD, s: C.tan };
    const st = document.documentElement.style;
    st.setProperty('--bx-c4', boxImage(cream, 4)); st.setProperty('--bx-o4', boxImage(orange, 4));
    st.setProperty('--bx-c3', boxImage(cream, 3)); st.setProperty('--bx-o3', boxImage(orange, 3));
    st.setProperty('--bx-y3', boxImage(yellow, 3)); st.setProperty('--bx-p3', boxImage(panel, 3));
    st.setProperty('--bx-r2', boxImage(red, 2));
    // 단계 표시용 작은 감귤 세 가지(지금 단계 · 깬 단계 · 남은 단계)
    const dot = (kind) => {
      const c = document.createElement('canvas'); c.width = c.height = 15;
      const g = c.getContext('2d');
      pxTangerine(g, 7.5, 8.6, 6, 5.4, { leaf: true });
      if (kind === 'off') {
        const im = g.getImageData(0, 0, 15, 15), d = im.data;
        for (let i = 0; i < d.length; i += 4) if (d[i + 3]) { d[i] = d[i] * 0.3 + 253 * 0.7; d[i + 1] = d[i + 1] * 0.3 + 236 * 0.7; d[i + 2] = d[i + 2] * 0.3 + 214 * 0.7; }
        g.putImageData(im, 0, 0);
      }
      if (kind === 'cur') { g.fillStyle = C.ink; g.fillRect(3, 14, 9, 1); }
      return `url(${c.toDataURL()})`;
    };
    st.setProperty('--dot-on', dot('on')); st.setProperty('--dot-off', dot('off')); st.setProperty('--dot-cur', dot('cur'));
  }
  // 그림 캔버스 크기: 칸 수 × 칸 크기(p)로 CSS 크기를 맞춰 도트가 고르게 보이게
  function fitPix(c, w, h, p) {
    const cw = Math.max(1, Math.floor(w / p)), ch = Math.max(1, Math.floor(h / p));
    if (c.width !== cw) c.width = cw;
    if (c.height !== ch) c.height = ch;
    c.style.width = `${cw * p}px`; c.style.height = `${ch * p}px`;
  }
  function sizeArt() {
    const r = app.getBoundingClientRect(), vh = window.innerHeight || r.height;
    const hp = clamp(Math.floor(Math.min((r.width - 20) / 118, vh / 250)), 2, 4);
    fitPix(hero, Math.min(r.width - 20, 460), 62 * hp, hp); heroKey = '';
    const ap = vh <= 720 ? 2 : 3;
    const was = rArt.width;
    fitPix(rArt, 96 * ap, 72 * ap, ap);
    if (lastArt && rArt.width === was && state === 'over') drawResultArt(...lastArt);
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
      for (let i = 0; i < 2; i++) { const a = rand(0, TAU), v = rand(30, 80); bits.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30, t: 0, life: rand(0.35, 0.7), r: rand(1.5, 3), c: C.oh }); }
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
        bits.push({ x: mx, y: my, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, t: 0, life: rand(0.6, 1.1), r: rand(2, 4.5), c: i % 5 ? (i % 2 ? C.o : C.yel) : C.leaf });
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
    const G = 1100 * dt * dt, floor = WH - 42 / s;   // v3.0: 아래 체크무늬 띠 위에 껍질이 놓이게
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
    ctx.save(); ctx.lineCap = 'butt';   // v3.0: 네모난 점(도트 점선)
    for (const [a, b] of zones) {
      if (b <= th) continue;
      ctx.lineWidth = SP * 0.6; ctx.strokeStyle = 'rgba(255,236,190,.4)';
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
      ctx.setLineDash([CELL * 3 / Z, CELL * 2.4 / Z]); ctx.lineWidth = Math.max((thin ? 4.2 : 3.6) / Z, CELL * 1.3 / Z);
      ctx.strokeStyle = thin ? C.yel : (finger && finger.warn ? C.fll : C.white);
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
    // v3.0: 도트 손잡이 — 흰 원 + 갈색 테두리(힘이 세면 주황 → 빨강), 준비 때는 흰 고리가 2단으로 깜빡이며 커졌다 작아짐
    const ring = state === 'ready' ? (flash > 0 ? C.red : C.ink) : (tension > 1 ? C.red : tension > 0.75 || (finger && finger.warn) ? C.od : C.ink);
    if (state === 'ready') {
      const r = Math.floor(t * 3) % 2 ? 22 : 17;
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.strokeStyle = C.white; ctx.lineWidth = CELL * 1.3; ctx.stroke();
    }
    ctx.beginPath(); ctx.arc(x, y, 11, 0, TAU); ctx.fillStyle = C.white; ctx.fill(); ctx.strokeStyle = ring; ctx.lineWidth = CELL * 1.7; ctx.stroke();
    if (state === 'peel' && tension > 0.25) {
      const [x2, y2] = W(pt(Math.min(THMAX, th + 0.08))), a = Math.atan2(y2 - y, x2 - x) - Math.PI / 2;
      accents(ctx, x, y, 17, a, C.white, CELL * 1.5, 8);
    }
  }
  function draw(t) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    if (state === 'start' || state === 'over' || !layers) return;
    ctx.imageSmoothingEnabled = false;
    ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * ox, 0);
    if (shake) ctx.translate(Math.round(rand(-1, 1)) * CELL, Math.round(rand(-1, 1)) * CELL);   // 칸 단위로 흔들림
    groundShadow(ctx, CX, CY + VIEW_R * FY * 0.94, VIEW_R * 1.08, VIEW_R * 0.12);
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
    if (state === 'ready') accents(ctx, CX, CY, VIEW_R * 1.08, -0.68, C.o, CELL * 2, 16);
    drawRope(ctx, rope, SP * Z * PEEL_W * 1.12, 1);
    drawHandle(t);
    // 튀는 조각: 네모 도트(반쯤 사라지면 없어짐)
    for (const m of bits) {
      if (m.t / m.life > 0.6) continue;
      const sz = Math.max(CELL, m.r * 1.5);
      ctx.fillStyle = m.c; ctx.fillRect(m.x - sz / 2, m.y - sz / 2, sz, sz);
    }
    quantize(ctx);
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
  // v3.0: 얼굴 아이콘은 칸 수 고정(말풍선 22칸×2px, 점수 카드 20칸×3px). 시작 그림·결과 그림은 layout()의 sizeArt()가 맞춤
  fitPix($('face'), 44, 44, 2); fitPix($('r-face'), 60, 60, 3);
  initPixelUI();
  window.addEventListener('resize', layout);
  setStage(0);
  nextFrame(frame);
})();
