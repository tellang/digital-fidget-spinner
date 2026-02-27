// === 이펙트 시스템 테스트 (파티클 최적화 검증) ===
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const ctx = require("./loader");
const { ParticleSystem, Particle, ScreenShake, FlashEffect, ChainDisplay } = ctx;

describe("ParticleSystem", () => {
  describe("최대 제한", () => {
    it("MAX_PARTICLES 상수가 300이어야 한다", () => {
      assert.equal(ParticleSystem.MAX_PARTICLES, 300);
    });

    it("burst()가 MAX_PARTICLES를 초과하지 않아야 한다", () => {
      const ps = new ParticleSystem();
      // 300개 넘게 추가 시도
      for (let i = 0; i < 20; i++) {
        ps.burst(0, 0, "#fff", 20);
      }
      assert.ok(ps.particles.length <= 300,
        `파티클 수: ${ps.particles.length} (최대 300)`);
    });

    it("lineClear()가 MAX_PARTICLES를 초과하지 않아야 한다", () => {
      const ps = new ParticleSystem();
      // 이미 280개 채움
      ps.burst(0, 0, "#fff", 280);
      // lineClear로 50개 추가 시도
      ps.lineClear(10, Array(10).fill("#ff0000"));
      assert.ok(ps.particles.length <= 300);
    });

    it("spark()가 MAX_PARTICLES를 초과하지 않아야 한다", () => {
      const ps = new ParticleSystem();
      ps.burst(0, 0, "#fff", 298);
      ps.spark(0, 0, "#ff0000");
      assert.ok(ps.particles.length <= 300);
    });

    it("chainBurst()가 MAX_PARTICLES를 초과하지 않아야 한다", () => {
      const ps = new ParticleSystem();
      ps.burst(0, 0, "#fff", 280);
      ps.chainBurst(50, 50, 5); // 5*8=40개 시도
      assert.ok(ps.particles.length <= 300);
    });
  });

  describe("swap-and-pop 업데이트", () => {
    it("죽은 파티클이 update 후 제거되어야 한다", () => {
      const ps = new ParticleSystem();
      ps.burst(0, 0, "#fff", 10);
      // 큰 dt로 모든 파티클 죽이기
      ps.update(10);
      assert.equal(ps.particles.length, 0, "죽은 파티클 미제거");
    });

    it("살아있는 파티클은 유지되어야 한다", () => {
      const ps = new ParticleSystem();
      ps.burst(0, 0, "#fff", 10);
      const before = ps.particles.length;
      ps.update(0.001); // 아주 짧은 dt
      assert.equal(ps.particles.length, before, "살아있는 파티클이 제거됨");
    });

    it("업데이트 순서가 파티클 위치에 영향 주지 않아야 한다", () => {
      const ps = new ParticleSystem();
      ps.burst(0, 0, "#fff", 5);
      const initial = ps.particles.map((p) => ({ x: p.x, y: p.y }));
      ps.update(0.016);
      // 물리 업데이트 후 위치 변경 확인
      let changed = false;
      for (let i = 0; i < ps.particles.length; i++) {
        if (ps.particles[i].x !== initial[i].x || ps.particles[i].y !== initial[i].y) {
          changed = true;
          break;
        }
      }
      assert.ok(changed, "파티클 위치가 업데이트되지 않음");
    });
  });

  describe("배치 드로우", () => {
    it("draw()가 빈 배열일 때 ctx 호출 없어야 한다", () => {
      const ps = new ParticleSystem();
      const { MockContext } = require("./setup");
      const mockCtx = new MockContext();
      ps.draw(mockCtx);
      assert.equal(mockCtx._saves, 0, "빈 파티클에 save 호출됨");
    });

    it("draw()가 N개 파티클에 대해 save/restore 1번만 호출", () => {
      const ps = new ParticleSystem();
      ps.burst(50, 50, "#ff0000", 20);
      const { MockContext } = require("./setup");
      const mockCtx = new MockContext();
      ps.draw(mockCtx);
      assert.equal(mockCtx._saves, 1, `save ${mockCtx._saves}번 호출 (기대: 1)`);
      assert.equal(mockCtx._restores, 1, `restore ${mockCtx._restores}번 호출 (기대: 1)`);
    });
  });
});

describe("Particle", () => {
  it("생성 시 alive = true", () => {
    const p = new Particle(0, 0, "#fff");
    assert.ok(p.alive);
  });

  it("충분한 시간 후 alive = false", () => {
    const p = new Particle(0, 0, "#fff", { life: 0.5 });
    p.update(1.0);
    assert.ok(!p.alive);
  });

  it("alpha가 0~1 범위", () => {
    const p = new Particle(0, 0, "#fff", { life: 1.0 });
    assert.ok(p.alpha >= 0 && p.alpha <= 1);
    p.update(0.5);
    assert.ok(p.alpha >= 0 && p.alpha <= 1);
  });

  it("중력이 vy에 영향을 줘야 한다", () => {
    const p = new Particle(0, 0, "#fff", { gravity: 500, speed: 0 });
    const vy0 = p.vy;
    p.update(0.1);
    assert.ok(p.vy > vy0, "중력 미적용");
  });
});

describe("ScreenShake", () => {
  it("trigger 후 intensity > 0", () => {
    const s = new ScreenShake();
    s.trigger(10);
    assert.ok(s.intensity > 0);
  });

  it("update 후 intensity 감소", () => {
    const s = new ScreenShake();
    s.trigger(10);
    const before = s.intensity;
    s.update(0.1);
    assert.ok(s.intensity < before);
  });

  it("intensity 0일 때 offset은 {x:0, y:0}", () => {
    const s = new ScreenShake();
    const o = s.getOffset();
    assert.equal(o.x, 0);
    assert.equal(o.y, 0);
  });
});

describe("FlashEffect", () => {
  it("add 후 flashes 배열에 추가", () => {
    const f = new FlashEffect();
    f.add([5, 6, 7]);
    assert.equal(f.flashes.length, 1);
    assert.deepEqual(f.flashes[0].rows, [5, 6, 7]);
  });

  it("duration 초과 시 자동 제거", () => {
    const f = new FlashEffect();
    f.add([5]);
    f.update(0.5); // duration 0.3 초과
    assert.equal(f.flashes.length, 0);
  });
});

describe("ChainDisplay", () => {
  it("add 후 chains에 추가", () => {
    const cd = new ChainDisplay();
    cd.add(3, 50, 50);
    assert.equal(cd.chains.length, 1);
    assert.equal(cd.chains[0].count, 3);
  });

  it("duration 초과 시 제거", () => {
    const cd = new ChainDisplay();
    cd.add(3, 50, 50);
    cd.update(1.5); // duration 1.0 초과
    assert.equal(cd.chains.length, 0);
  });
});
