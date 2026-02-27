// === 테마 시스템 테스트 ===
const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");

const ctx = require("./loader");
const { themes } = ctx;

describe("ThemeRegistry", () => {
  describe("테마 등록", () => {
    it("내장 10개 테마가 모두 등록되어 있어야 한다", () => {
      const expected = [
        "cyberpunk", "gameboy", "pastel", "matrix", "glass", "retro",
        "vaporwave", "abyss", "cloud", "eclipse",
      ];
      for (const id of expected) {
        assert.ok(themes.get(id), `테마 "${id}" 미등록`);
      }
      assert.ok(themes.count >= 10, `테마 수: ${themes.count} (최소 10 필요)`);
    });

    it("각 테마에 필수 필드가 있어야 한다", () => {
      const required = ["name", "colors", "bg", "borderColor", "boardBg", "textColor", "block", "effects", "css"];
      for (const id of themes.names) {
        const t = themes.get(id);
        for (const field of required) {
          assert.ok(t[field] !== undefined, `테마 "${id}"에 "${field}" 없음`);
        }
      }
    });

    it("각 테마의 colors에 7개 테트로미노 색상이 있어야 한다", () => {
      const pieces = ["I", "O", "T", "S", "Z", "J", "L"];
      for (const id of themes.names) {
        const t = themes.get(id);
        for (const p of pieces) {
          assert.ok(t.colors[p], `테마 "${id}"에 피스 "${p}" 색상 없음`);
        }
      }
    });

    it("각 테마의 block에 glow/highlight/shadow/roundness가 있어야 한다", () => {
      for (const id of themes.names) {
        const b = themes.get(id).block;
        assert.equal(typeof b.glow, "boolean");
        assert.equal(typeof b.glowBlur, "number");
        assert.equal(typeof b.highlight, "boolean");
        assert.equal(typeof b.shadow, "boolean");
        assert.equal(typeof b.roundness, "number");
      }
    });

    it("각 테마의 effects에 scanline/vignette/particles/shake가 있어야 한다", () => {
      for (const id of themes.names) {
        const e = themes.get(id).effects;
        assert.equal(typeof e.scanline, "boolean");
        assert.equal(typeof e.vignette, "boolean");
        assert.equal(typeof e.particles, "boolean");
        assert.equal(typeof e.shake, "boolean");
      }
    });
  });

  describe("테마 적용", () => {
    it("apply() 호출 후 active가 변경되어야 한다", () => {
      themes.apply("gameboy");
      assert.equal(themes.active.id, "gameboy");
      themes.apply("cyberpunk");
      assert.equal(themes.active.id, "cyberpunk");
    });

    it("존재하지 않는 테마 apply 시 false 반환", () => {
      assert.equal(themes.apply("nonexistent"), false);
    });

    it("onChange 리스너가 테마 변경 시 호출되어야 한다", () => {
      let called = false;
      let receivedTheme = null;
      const unsub = themes.onChange((t) => {
        called = true;
        receivedTheme = t;
      });
      themes.apply("matrix");
      assert.ok(called, "리스너 미호출");
      assert.equal(receivedTheme.id, "matrix");
      unsub();
    });

    it("unsubscribe 후 리스너가 호출되지 않아야 한다", () => {
      let count = 0;
      const unsub = themes.onChange(() => count++);
      themes.apply("pastel");
      assert.equal(count, 1);
      unsub();
      themes.apply("retro");
      assert.equal(count, 1, "unsubscribe 후에도 호출됨");
    });
  });

  describe("신규 테마 무결성", () => {
    it("Vaporwave: CRT 효과 ON, 핑크 보더", () => {
      const t = themes.get("vaporwave");
      assert.equal(t.name, "Vaporwave Sunset");
      assert.ok(t.effects.scanline);
      assert.ok(t.effects.crt);
      assert.equal(t.borderColor, "#ff71ce");
    });

    it("Abyss: 심해 배경, 글로우 blur 12", () => {
      const t = themes.get("abyss");
      assert.equal(t.bg, "#000814");
      assert.equal(t.block.glowBlur, 12);
      assert.ok(t.effects.vignette);
      assert.ok(!t.effects.scanline);
    });

    it("Cloud Dancer: 밝은 배경, glow 없음, roundness 4", () => {
      const t = themes.get("cloud");
      assert.equal(t.bg, "#f8f6f0");
      assert.equal(t.block.glow, false);
      assert.equal(t.block.roundness, 4);
    });

    it("Eclipse: 순수 검정, 강한 glow", () => {
      const t = themes.get("eclipse");
      assert.equal(t.bg, "#000000");
      assert.equal(t.block.glowBlur, 15);
      assert.ok(t.block.glow);
    });
  });

  describe("테마 등록/해제", () => {
    it("커스텀 테마 등록 후 적용 가능", () => {
      themes.register("test-custom", {
        name: "Test",
        colors: { I: "#fff", O: "#fff", T: "#fff", S: "#fff", Z: "#fff", J: "#fff", L: "#fff" },
      });
      assert.ok(themes.get("test-custom"));
      themes.apply("test-custom");
      assert.equal(themes.active.id, "test-custom");
      themes.apply("cyberpunk");
    });

    it("활성 테마는 해제 불가", () => {
      themes.apply("cyberpunk");
      assert.equal(themes.unregister("cyberpunk"), false);
    });

    it("비활성 테마 해제 가능", () => {
      themes.register("temp", {
        name: "Temp",
        colors: { I: "#000", O: "#000", T: "#000", S: "#000", Z: "#000", J: "#000", L: "#000" },
      });
      assert.ok(themes.unregister("temp"));
      assert.equal(themes.get("temp"), undefined);
    });
  });

  // 크로스페이드 — setTimeout 모킹이 필요하므로 구조만 검증
  describe("크로스페이드 전환", () => {
    it("같은 테마 재적용 시 크로스페이드 없이 즉시 적용", () => {
      themes.apply("cyberpunk");
      const container = globalThis.document.getElementById("game-container");
      container.classList._set.clear();
      themes.apply("cyberpunk");
      // 같은 테마 → classList에 theme-switching 없어야 함
      assert.ok(!container.classList.contains("theme-switching"));
    });
  });
});
