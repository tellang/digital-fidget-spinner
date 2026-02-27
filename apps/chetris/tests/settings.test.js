// === 설정 매니저 테스트 ===
const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");

const ctx = require("./loader");
const { Settings, settings } = ctx;

describe("Settings", () => {
  describe("기본값", () => {
    it("theme 기본값은 cyberpunk", () => {
      assert.equal(settings.get("theme"), "cyberpunk");
    });

    it("autoStart 기본값은 true (토스 스타일)", () => {
      assert.equal(settings.get("autoStart"), true);
    });

    it("autoTheme 기본값은 false", () => {
      assert.equal(settings.get("autoTheme"), false);
    });

    it("particles 기본값은 true", () => {
      assert.equal(settings.get("particles"), true);
    });

    it("shake 기본값은 true", () => {
      assert.equal(settings.get("shake"), true);
    });

    it("autoFade 기본값은 true", () => {
      assert.equal(settings.get("autoFade"), true);
    });

    it("autoFadeDelay 기본값은 5", () => {
      assert.equal(settings.get("autoFadeDelay"), 5);
    });

    it("autoFadeOpacity 기본값은 0.15", () => {
      assert.equal(settings.get("autoFadeOpacity"), 0.15);
    });
  });

  describe("set/get", () => {
    it("set 후 get으로 읽기 가능", () => {
      settings.set("theme", "matrix");
      assert.equal(settings.get("theme"), "matrix");
      settings.set("theme", "cyberpunk"); // 복원
    });

    it("같은 값 set 시 리스너 미호출", () => {
      settings.set("theme", "cyberpunk");
      let called = false;
      const unsub = settings.onChange(() => { called = true; });
      settings.set("theme", "cyberpunk"); // 같은 값
      assert.ok(!called, "같은 값에 리스너 호출됨");
      unsub();
    });
  });

  describe("onChange 리스너", () => {
    it("값 변경 시 key/value 전달", () => {
      let receivedKey = null;
      let receivedValue = null;
      const unsub = settings.onChange((k, v) => {
        receivedKey = k;
        receivedValue = v;
      });
      settings.set("particles", false);
      assert.equal(receivedKey, "particles");
      assert.equal(receivedValue, false);
      settings.set("particles", true); // 복원
      unsub();
    });

    it("여러 리스너 동시 등록 가능", () => {
      let count = 0;
      const unsub1 = settings.onChange(() => count++);
      const unsub2 = settings.onChange(() => count++);
      settings.set("shake", false);
      assert.equal(count, 2);
      settings.set("shake", true); // 복원
      unsub1();
      unsub2();
    });
  });

  describe("시간대 기반 테마", () => {
    it("getTimeBasedTheme()이 유효한 테마 ID를 반환해야 한다", () => {
      const id = settings.getTimeBasedTheme();
      assert.ok(typeof id === "string");
      assert.ok(["cloud", "glass", "vaporwave", "abyss"].includes(id),
        `반환값 "${id}"가 예상 범위 밖`);
    });

    it("06~10시는 cloud", () => {
      // 시간을 직접 변경할 수 없으므로 함수 로직을 검증
      // getTimeBasedTheme 내부 로직: h >= 6 && h < 10 → cloud
      const fn = settings.getTimeBasedTheme;
      // 현재 시간에 따라 결과가 달라지므로 범위만 검증
      const result = fn.call(settings);
      const h = new Date().getHours();
      if (h >= 6 && h < 10) assert.equal(result, "cloud");
      if (h >= 10 && h < 17) assert.equal(result, "glass");
      if (h >= 17 && h < 20) assert.equal(result, "vaporwave");
      if (h >= 20 || h < 6) assert.equal(result, "abyss");
    });
  });

  describe("all getter", () => {
    it("모든 설정을 객체로 반환", () => {
      const all = settings.all;
      assert.equal(typeof all, "object");
      assert.ok("theme" in all);
      assert.ok("particles" in all);
      assert.ok("autoTheme" in all);
    });

    it("반환 객체 수정이 원본에 영향 없어야 한다", () => {
      const all = settings.all;
      all.theme = "HACKED";
      assert.notEqual(settings.get("theme"), "HACKED");
    });
  });
});
