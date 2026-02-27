// === 설정 매니저 (Tauri 파일시스템 영속화) ===

class Settings {
  #data = {
    theme: "cyberpunk",
    gameMode: "tetris",
    particles: true,
    shake: true,
    autoFade: true,
    autoFadeDelay: 5,
    autoFadeOpacity: 0.15,
    autoStart: true,
    autoTheme: false,
  };
  #listeners = new Set();
  #loaded = false;

  get(key) { return this.#data[key]; }

  set(key, value) {
    if (this.#data[key] === value) return;
    this.#data[key] = value;
    this.#notify(key, value);
    this.#save();
  }

  get all() { return { ...this.#data }; }

  onChange(fn) {
    this.#listeners.add(fn);
    return () => this.#listeners.delete(fn);
  }

  #notify(key, value) {
    for (const fn of this.#listeners) {
      try { fn(key, value); } catch (e) { console.error("설정 리스너 오류:", e); }
    }
  }

  async load() {
    if (!window.__TAURI__) {
      // 브라우저 폴백: localStorage
      const stored = localStorage.getItem("chatris-settings");
      if (stored) {
        try { Object.assign(this.#data, JSON.parse(stored)); } catch {}
      }
    } else {
      try {
        const json = await window.__TAURI__.core.invoke("load_settings");
        if (json) Object.assign(this.#data, JSON.parse(json));
      } catch {}
    }
    this.#loaded = true;
    // 테마 적용
    themes.apply(this.#data.theme);
    return this.#data;
  }

  async #save() {
    const json = JSON.stringify(this.#data);
    if (!window.__TAURI__) {
      localStorage.setItem("chatris-settings", json);
    } else {
      try { await window.__TAURI__.core.invoke("save_settings", { json }); } catch {}
    }
  }

  // 시간대 기반 테마 추천 (선제적 스무스)
  getTimeBasedTheme() {
    const h = new Date().getHours();
    if (h >= 6 && h < 10) return "cloud";       // 아침: 밝고 차분
    if (h >= 10 && h < 17) return "glass";       // 낮: 깔끔한 글래스
    if (h >= 17 && h < 20) return "vaporwave";   // 저녁: 감성 레트로
    return "abyss";                               // 밤: 어두운 심해
  }
}

const settings = new Settings();
