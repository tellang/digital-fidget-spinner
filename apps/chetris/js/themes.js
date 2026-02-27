// === 테마 레지스트리 (동적 추가/제거, 이벤트 기반) ===

class ThemeRegistry {
  #themes = new Map();
  #active = null;
  #listeners = new Set();

  register(id, theme) {
    if (!id || !theme?.colors || !theme?.name) {
      throw new Error(`테마 등록 실패: id="${id}" — name, colors 필수`);
    }
    // 기본값 병합
    this.#themes.set(id, { ...ThemeRegistry.DEFAULTS, ...theme, id });
    return this;
  }

  unregister(id) {
    if (this.#active?.id === id) return false;
    return this.#themes.delete(id);
  }

  apply(id) {
    const theme = this.#themes.get(id);
    if (!theme) return false;
    this.#active = theme;
    this.#applyCSS(theme);
    this.#notify(theme);
    return true;
  }

  get active() { return this.#active; }
  get names() { return [...this.#themes.keys()]; }
  get(id) { return this.#themes.get(id); }
  get count() { return this.#themes.size; }

  onChange(fn) {
    this.#listeners.add(fn);
    return () => this.#listeners.delete(fn);
  }

  #notify(theme) {
    for (const fn of this.#listeners) {
      try { fn(theme); } catch (e) { console.error("테마 리스너 오류:", e); }
    }
  }

  #applyCSS(t) {
    const root = document.documentElement;
    root.style.setProperty("--theme-border", t.borderColor);
    root.style.setProperty("--theme-boost-border", t.boostBorderColor);
    root.style.setProperty("--theme-glow", t.css.borderGlow);
    root.style.setProperty("--theme-boost-glow", t.css.boostGlow);
    root.style.setProperty("--theme-bg", t.bg);

    const scanline = document.getElementById("scanline");
    const vignette = document.getElementById("vignette");
    if (scanline) scanline.style.display = t.effects.scanline ? "" : "none";
    if (vignette) vignette.style.display = t.effects.vignette ? "" : "none";
  }

  // 기본값 — 테마에 빠진 필드를 채움
  static DEFAULTS = {
    bg: "#0a0a1a",
    gridColor: "rgba(255,255,255,0.05)",
    borderColor: "#ffffff",
    boostBorderColor: "#ff0040",
    neonPool: ["#ffffff"],
    // 뿌요 기본 색상 (테마에 puyoColors 없을 때 폴백)
    puyoColors: ['#ff4060', '#40a0ff', '#40ff60', '#ffe040', '#c040ff'],
    boardBg: "rgba(0,0,0,0.9)",
    textColor: "#ffffff",
    statColors: { score: "#ffffff", lines: "#ffffff", combo: "#ffffff", level: "#ffffff" },
    block: { glow: false, glowBlur: 0, highlight: false, shadow: false, roundness: 0 },
    effects: { scanline: false, vignette: false, particles: true, shake: true, crt: false },
    css: { borderGlow: "none", boostGlow: "none" },
  };
}

// 싱글턴 인스턴스
const themes = new ThemeRegistry();

// === 내장 테마 등록 ===

themes.register("cyberpunk", {
  name: "Cyberpunk Neon",
  colors: { I: "#00fff2", O: "#ffee00", T: "#b026ff", S: "#39ff14", Z: "#ff0040", J: "#4d4dff", L: "#ff6600" },
  // 뿌요 색상: 네온 도쿄 — 핫핑크, 일렉트릭 블루, 네온 그린, 사이버 옐로, 바이올렛
  puyoColors: ['#ff2d78', '#00b4ff', '#39ff14', '#ffe600', '#c84dff'],
  bg: "#0a0a1a",
  gridColor: "rgba(0,255,242,0.05)",
  borderColor: "#00fff2",
  boostBorderColor: "#ff0040",
  neonPool: ["#00fff2", "#b026ff", "#39ff14", "#ff0040", "#ffee00", "#ff6600", "#4d4dff"],
  boardBg: "rgba(3,3,12,0.95)",
  textColor: "#00fff2",
  statColors: { score: "#00fff2", lines: "#39ff14", combo: "#b026ff", level: "#ffee00" },
  block: { glow: true, glowBlur: 8, highlight: true, shadow: true, roundness: 0 },
  effects: { scanline: true, vignette: true, particles: true, shake: true, crt: true },
  css: {
    borderGlow: "0 0 20px rgba(0,255,242,0.3), 0 0 60px rgba(0,255,242,0.1)",
    boostGlow: "0 0 30px rgba(255,0,64,0.4), 0 0 80px rgba(176,38,255,0.2)",
  },
});

themes.register("gameboy", {
  name: "Game Boy",
  colors: { I: "#0f380f", O: "#306230", T: "#0f380f", S: "#306230", Z: "#0f380f", J: "#306230", L: "#0f380f" },
  // 뿌요 색상: 4톤 그린 스케일 (원본 게임보이 LCD)
  puyoColors: ['#0f380f', '#306230', '#8bac0f', '#9bbc0f'],
  bg: "#9bbc0f",
  gridColor: "rgba(15,56,15,0.15)",
  borderColor: "#306230",
  boostBorderColor: "#0f380f",
  neonPool: ["#0f380f", "#306230", "#8bac0f"],
  boardBg: "#8bac0f",
  textColor: "#0f380f",
  statColors: { score: "#0f380f", lines: "#306230", combo: "#0f380f", level: "#306230" },
  block: { glow: false, glowBlur: 0, highlight: false, shadow: false, roundness: 0 },
  effects: { scanline: false, vignette: false, particles: false, shake: false, crt: false },
  css: { borderGlow: "0 0 4px rgba(15,56,15,0.3)", boostGlow: "0 0 8px rgba(15,56,15,0.5)" },
});

themes.register("pastel", {
  name: "Pastel Dream",
  colors: { I: "#a8e6cf", O: "#ffd3b6", T: "#dcd3ff", S: "#b5e2ff", Z: "#ffaaa5", J: "#c3aed6", L: "#f9c6c9" },
  // 뿌요 색상: 캔디팝 — 부드럽고 달콤한 파스텔 톤
  puyoColors: ['#ffb3ba', '#bae1ff', '#baffc9', '#ffffba', '#e8baff'],
  bg: "#faf5ff",
  gridColor: "rgba(180,160,200,0.12)",
  borderColor: "#dcd3ff",
  boostBorderColor: "#ffaaa5",
  neonPool: ["#a8e6cf", "#dcd3ff", "#ffd3b6", "#ffaaa5", "#b5e2ff", "#f9c6c9"],
  boardBg: "rgba(250,245,255,0.9)",
  textColor: "#7c6c8a",
  statColors: { score: "#7c6c8a", lines: "#6bab90", combo: "#9b7cc3", level: "#c98b6b" },
  block: { glow: false, glowBlur: 0, highlight: true, shadow: true, roundness: 3 },
  effects: { scanline: false, vignette: false, particles: true, shake: true, crt: false },
  css: { borderGlow: "0 0 15px rgba(220,211,255,0.4)", boostGlow: "0 0 20px rgba(255,170,165,0.4)" },
});

themes.register("matrix", {
  name: "Matrix",
  colors: { I: "#00ff41", O: "#00cc33", T: "#00ff41", S: "#008f11", Z: "#00ff41", J: "#00cc33", L: "#008f11" },
  // 뿌요 색상: 그린 해커 톤 변주 (밝기/채도 차이로 구분)
  puyoColors: ['#00ff41', '#00cc33', '#7fff00', '#00e5a0', '#a0ff50'],
  bg: "#000000",
  gridColor: "rgba(0,255,65,0.04)",
  borderColor: "#00ff41",
  boostBorderColor: "#00ff41",
  neonPool: ["#00ff41", "#00cc33", "#008f11"],
  boardBg: "rgba(0,5,0,0.95)",
  textColor: "#00ff41",
  statColors: { score: "#00ff41", lines: "#00cc33", combo: "#00ff41", level: "#008f11" },
  block: { glow: true, glowBlur: 6, highlight: false, shadow: false, roundness: 0 },
  effects: { scanline: true, vignette: true, particles: true, shake: true, crt: true },
  css: {
    borderGlow: "0 0 20px rgba(0,255,65,0.3), 0 0 60px rgba(0,255,65,0.1)",
    boostGlow: "0 0 30px rgba(0,255,65,0.5), 0 0 80px rgba(0,255,65,0.2)",
  },
});

themes.register("glass", {
  name: "Glassmorphism",
  colors: {
    I: "rgba(100,200,255,0.7)", O: "rgba(255,220,100,0.7)", T: "rgba(180,130,255,0.7)",
    S: "rgba(130,255,180,0.7)", Z: "rgba(255,130,150,0.7)", J: "rgba(130,150,255,0.7)", L: "rgba(255,180,100,0.7)",
  },
  // 뿌요 색상: 프로스티드 글래스 반투명 오로라
  puyoColors: [
    'rgba(120,210,255,0.75)', 'rgba(200,140,255,0.75)',
    'rgba(140,255,190,0.75)', 'rgba(255,150,170,0.75)', 'rgba(255,230,120,0.75)',
  ],
  bg: "#1a1a2e",
  gridColor: "rgba(255,255,255,0.04)",
  borderColor: "rgba(255,255,255,0.25)",
  boostBorderColor: "rgba(255,200,100,0.5)",
  neonPool: ["rgba(100,200,255,0.8)", "rgba(180,130,255,0.8)", "rgba(130,255,180,0.8)", "rgba(255,130,150,0.8)"],
  boardBg: "rgba(255,255,255,0.06)",
  textColor: "rgba(255,255,255,0.85)",
  statColors: {
    score: "rgba(100,200,255,0.9)", lines: "rgba(130,255,180,0.9)",
    combo: "rgba(180,130,255,0.9)", level: "rgba(255,220,100,0.9)",
  },
  block: { glow: true, glowBlur: 4, highlight: true, shadow: false, roundness: 2 },
  effects: { scanline: false, vignette: true, particles: true, shake: true, crt: false },
  css: {
    borderGlow: "0 0 20px rgba(102,126,234,0.3), 0 0 60px rgba(118,75,162,0.15)",
    boostGlow: "0 0 30px rgba(255,200,100,0.3), 0 0 60px rgba(255,130,150,0.15)",
  },
});

themes.register("retro", {
  name: "Retro Arcade",
  colors: { I: "#00bfff", O: "#FFD500", T: "#9b59b6", S: "#72CB3B", Z: "#FF3213", J: "#0341AE", L: "#FF971C" },
  // 뿌요 색상: 레트로 아케이드 원색 — 강렬하고 선명
  puyoColors: ['#FF1744', '#2979FF', '#00E676', '#FFEA00', '#D500F9'],
  bg: "#1a1a2e",
  gridColor: "rgba(255,255,255,0.06)",
  borderColor: "#FFD500",
  boostBorderColor: "#FF3213",
  neonPool: ["#00bfff", "#FFD500", "#FF3213", "#72CB3B", "#0341AE", "#FF971C", "#9b59b6"],
  boardBg: "rgba(10,10,30,0.95)",
  textColor: "#FFD500",
  statColors: { score: "#FFD500", lines: "#72CB3B", combo: "#FF3213", level: "#00bfff" },
  block: { glow: false, glowBlur: 0, highlight: true, shadow: true, roundness: 0 },
  effects: { scanline: false, vignette: false, particles: true, shake: true, crt: false },
  css: { borderGlow: "0 0 10px rgba(255,213,0,0.3)", boostGlow: "0 0 15px rgba(255,50,19,0.4)" },
});

// 기본 테마 적용
themes.apply("cyberpunk");
