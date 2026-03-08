// === 키보드 훅 생존 QA 테스트 ===
// 설정 변경을 하드하게 반복하며 입력 핸들러가 살아있는지 검증
const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");

const ctx = require("./loader");
const { InputHandler, ChatDisplay, Game, themes, settings, C } = ctx;

// Tauri 이벤트 시스템 목킹
function setupTauriMock() {
  const listeners = {};
  globalThis.window.__TAURI__ = {
    event: {
      listen(event, cb) {
        if (!listeners[event]) listeners[event] = [];
        listeners[event].push(cb);
        return Promise.resolve(() => {
          listeners[event] = listeners[event].filter((f) => f !== cb);
        });
      },
      emit(event, payload) {
        if (listeners[event]) {
          listeners[event].forEach((cb) => cb({ payload }));
        }
      },
    },
    core: {
      invoke(cmd) {
        if (cmd === "load_settings") return Promise.resolve("{}");
        if (cmd === "save_settings") return Promise.resolve();
        return Promise.resolve();
      },
    },
    webviewWindow: {
      getCurrentWebviewWindow() {
        return { hide() {}, startDragging() {} };
      },
    },
    app: { getVersion: () => Promise.resolve("test") },
  };
  return listeners;
}

function clearTauriMock() {
  globalThis.window.__TAURI__ = null;
}

// 헬퍼: global-keypress 시뮬레이션
function fireKeypress(listeners) {
  if (listeners["global-keypress"]) {
    listeners["global-keypress"].forEach((cb) => cb({ payload: null }));
  }
}

// 헬퍼: hook-status 시뮬레이션
function fireHookStatus(listeners, status) {
  if (listeners["hook-status"]) {
    listeners["hook-status"].forEach((cb) => cb({ payload: status }));
  }
}

describe("키보드 훅 생존 QA", () => {
  let listeners;
  let input;

  beforeEach(() => {
    listeners = setupTauriMock();
    input = new InputHandler();
  });

  // afterEach에서 정리
  // (setup.js의 setTimeout 즉시 실행으로 Promise.then도 즉시 처리됨)

  describe("기본 동작", () => {
    it("global-keypress 수신 시 boost 증가", () => {
      const prevBoost = input.getBoost();
      fireKeypress(listeners);
      assert.ok(input.getBoost() > prevBoost);
    });

    it("global-keypress 수신 시 keyCount 증가", () => {
      const prev = input.keyCount;
      fireKeypress(listeners);
      assert.equal(input.keyCount, prev + 1);
    });

    it("global-keypress 수신 시 hardDropCount 증가", () => {
      fireKeypress(listeners);
      assert.equal(input.popHardDrops(), 1);
    });

    it("global-keypress 수신 시 _hookAlive = true", () => {
      fireKeypress(listeners);
      assert.equal(input._hookAlive, true);
    });
  });

  describe("hook-status 시각 피드백", () => {
    it("active → 힌트 텍스트 정상", () => {
      fireHookStatus(listeners, "active");
      const hint = globalThis.document.getElementById("hint");
      assert.equal(hint.textContent, "⌨ TYPE TO ACCELERATE");
      assert.equal(input._hookAlive, true);
    });

    it("reconnecting → 힌트 텍스트 경고", () => {
      fireHookStatus(listeners, "reconnecting");
      const hint = globalThis.document.getElementById("hint");
      assert.equal(hint.textContent, "⟳ RECONNECTING...");
      assert.equal(input._hookAlive, false);
    });

    it("reconnecting → active → 힌트 복구", () => {
      fireHookStatus(listeners, "reconnecting");
      fireHookStatus(listeners, "active");
      const hint = globalThis.document.getElementById("hint");
      assert.equal(hint.textContent, "⌨ TYPE TO ACCELERATE");
    });

    it("reconnecting 중 keypress 수신 → 자동 복구", () => {
      fireHookStatus(listeners, "reconnecting");
      assert.equal(input._hookAlive, false);

      fireKeypress(listeners);
      assert.equal(input._hookAlive, true);
      const hint = globalThis.document.getElementById("hint");
      assert.equal(hint.textContent, "⌨ TYPE TO ACCELERATE");
    });
  });

  describe("설정 스트레스: 테마 변경", () => {
    it("테마 10종 빠른 순회 후 입력 동작", () => {
      const allThemes = [
        "cyberpunk", "gameboy", "pastel", "matrix", "glass",
        "retro", "vaporwave", "abyss", "cloud", "eclipse",
      ];
      for (const id of allThemes) {
        themes.apply(id);
        settings.set("theme", id);
      }
      const prev = input.keyCount;
      fireKeypress(listeners);
      fireKeypress(listeners);
      fireKeypress(listeners);
      assert.equal(input.keyCount, prev + 3);
    });

    it("같은 테마 50회 반복 적용 후 입력 동작", () => {
      for (let i = 0; i < 50; i++) {
        themes.apply(i % 2 === 0 ? "cyberpunk" : "matrix");
      }
      const prev = input.keyCount;
      fireKeypress(listeners);
      assert.equal(input.keyCount, prev + 1);
    });
  });

  describe("설정 스트레스: 게임 모드 전환", () => {
    it("tetris↔puyo 10회 전환 후 입력 동작", () => {
      for (let i = 0; i < 10; i++) {
        settings.set("gameMode", i % 2 === 0 ? "puyo" : "tetris");
      }
      const prev = input.keyCount;
      fireKeypress(listeners);
      assert.equal(input.keyCount, prev + 1);
    });
  });

  describe("설정 스트레스: 토글 전부 반복", () => {
    it("모든 토글 키 3라운드 on/off 후 입력 동작", () => {
      const toggleKeys = [
        "particles", "shake", "autoFade", "autoStart",
        "autoTheme", "minimizeToTray", "autoUpdate",
      ];
      for (let round = 0; round < 3; round++) {
        for (const key of toggleKeys) {
          settings.set(key, round % 2 === 0);
        }
      }
      const prev = input.keyCount;
      fireKeypress(listeners);
      assert.equal(input.keyCount, prev + 1);
    });
  });

  describe("설정 스트레스: 혼합 폭풍", () => {
    it("테마+모드+토글 동시 변경 30라운드 후 입력 동작", () => {
      const themeIds = ["cyberpunk", "matrix", "glass", "abyss", "cloud"];
      const modes = ["tetris", "puyo"];
      const toggles = ["particles", "shake", "autoFade"];

      for (let i = 0; i < 30; i++) {
        themes.apply(themeIds[i % themeIds.length]);
        settings.set("theme", themeIds[i % themeIds.length]);
        settings.set("gameMode", modes[i % modes.length]);
        for (const t of toggles) {
          settings.set(t, i % 2 === 0);
        }
      }

      const prev = input.keyCount;
      fireKeypress(listeners);
      fireKeypress(listeners);
      assert.equal(input.keyCount, prev + 2);
      assert.ok(input.getBoost() > 1.0);
    });

    it("설정 변경 사이사이 keypress 발사 — 매번 카운트 증가", () => {
      let expected = input.keyCount;
      for (let i = 0; i < 20; i++) {
        themes.apply(i % 2 === 0 ? "cyberpunk" : "vaporwave");
        settings.set("particles", i % 3 === 0);
        fireKeypress(listeners);
        expected++;
        assert.equal(input.keyCount, expected, `라운드 ${i}에서 keyCount 불일치`);
      }
    });
  });

  describe("훅 사망/복구 사이클", () => {
    it("5회 사망/복구 사이클 후 정상 동작", () => {
      for (let i = 0; i < 5; i++) {
        fireHookStatus(listeners, "reconnecting");
        assert.equal(input._hookAlive, false);
        fireHookStatus(listeners, "active");
        assert.equal(input._hookAlive, true);
      }
      const prev = input.keyCount;
      fireKeypress(listeners);
      assert.equal(input.keyCount, prev + 1);
    });

    it("사망 중 설정 변경 → 복구 후 입력 동작", () => {
      fireHookStatus(listeners, "reconnecting");

      // 훅 죽은 상태에서 설정 마구 변경
      themes.apply("matrix");
      settings.set("gameMode", "puyo");
      settings.set("particles", false);
      settings.set("shake", false);

      // 복구
      fireHookStatus(listeners, "active");
      const prev = input.keyCount;
      fireKeypress(listeners);
      assert.equal(input.keyCount, prev + 1);
    });

    it("브라우저 keydown은 훅 상태와 무관하게 동작", () => {
      fireHookStatus(listeners, "reconnecting");
      const prev = input.keyCount;
      // 브라우저 직접 키보드 입력 시뮬레이션
      input._onInput();
      assert.equal(input.keyCount, prev + 1);
    });
  });

  describe("boost 감쇠 무결성", () => {
    it("설정 폭풍 후 boost decay 정상 동작", () => {
      // boost를 최대로 올림
      for (let i = 0; i < 20; i++) fireKeypress(listeners);
      const peak = input.getBoost();
      assert.ok(peak > 1.0);

      // 시간 경과 시뮬레이션
      input.update(2.0);
      assert.ok(input.getBoost() < peak, "boost가 감쇠해야 함");
      assert.ok(input.getBoost() >= 1.0, "boost는 1.0 아래로 내려가면 안 됨");
    });
  });
});
