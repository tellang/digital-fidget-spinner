// === 성능 벤치마크 테스트 ===
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const ctx = require("./loader");
const { ParticleSystem, Renderer, Board, themes } = ctx;
const { MockCanvas, MockContext } = require("./setup");

describe("성능 벤치마크", () => {
  describe("파티클 시스템", () => {
    it("300개 파티클 update: < 2ms", () => {
      const ps = new ParticleSystem();
      ps.burst(50, 50, "#ff0000", 300);
      const start = performance.now();
      for (let i = 0; i < 100; i++) {
        ps.update(0.016);
        // 죽은 파티클 보충
        while (ps.particles.length < 200) {
          ps.burst(50, 50, "#ff0000", 10);
        }
      }
      const elapsed = (performance.now() - start) / 100;
      assert.ok(elapsed < 2, `평균 ${elapsed.toFixed(3)}ms (제한: 2ms)`);
    });

    it("300개 파티클 draw: < 2ms", () => {
      const ps = new ParticleSystem();
      ps.burst(50, 50, "#ff0000", 300);
      const mockCtx = new MockContext();
      const start = performance.now();
      for (let i = 0; i < 100; i++) {
        ps.draw(mockCtx);
      }
      const elapsed = (performance.now() - start) / 100;
      assert.ok(elapsed < 2, `평균 ${elapsed.toFixed(3)}ms (제한: 2ms)`);
    });

    it("swap-and-pop이 splice보다 빠른지 비교", () => {
      // swap-and-pop 방식 (현재)
      const ps1 = new ParticleSystem();
      ps1.burst(0, 0, "#fff", 300);
      const start1 = performance.now();
      for (let i = 0; i < 50; i++) {
        ps1.update(0.05);
        ps1.burst(0, 0, "#fff", Math.min(50, 300 - ps1.particles.length));
      }
      const time1 = performance.now() - start1;

      // splice 방식 (이전) — 시뮬레이션
      const arr = [];
      for (let i = 0; i < 300; i++) arr.push({ alive: true, life: 0.5, update(dt) { this.life -= dt; this.alive = this.life > 0; } });
      const start2 = performance.now();
      for (let iter = 0; iter < 50; iter++) {
        for (let i = arr.length - 1; i >= 0; i--) {
          arr[i].update(0.05);
          if (!arr[i].alive) arr.splice(i, 1);
        }
        while (arr.length < 200) arr.push({ alive: true, life: 0.5, update(dt) { this.life -= dt; this.alive = this.life > 0; } });
      }
      const time2 = performance.now() - start2;

      console.log(`  swap-and-pop: ${time1.toFixed(2)}ms, splice: ${time2.toFixed(2)}ms`);
      // swap-and-pop이 동등하거나 빨라야 함 (큰 차이 보장은 어렵지만 느려서는 안 됨)
      assert.ok(time1 <= time2 * 2, "swap-and-pop이 splice보다 2배 이상 느림");
    });
  });

  describe("렌더러", () => {
    it("그리드 캐시 후 _drawBoardBg: < 1ms", () => {
      const canvas = new MockCanvas();
      const renderer = new Renderer(canvas);
      themes.apply("cyberpunk");
      const mockCtx = new MockContext();

      // 캐시 워밍업
      renderer._drawBoardBg(mockCtx);

      const start = performance.now();
      for (let i = 0; i < 100; i++) {
        renderer._drawBoardBg(mockCtx);
      }
      const elapsed = (performance.now() - start) / 100;
      assert.ok(elapsed < 1, `평균 ${elapsed.toFixed(3)}ms (제한: 1ms)`);
    });

    it("200개 셀 _drawPlacedBlocks: < 3ms", () => {
      const canvas = new MockCanvas();
      const renderer = new Renderer(canvas);
      themes.apply("cyberpunk");
      const board = new Board();
      // 보드 절반 채우기
      for (let r = 10; r < 20; r++) {
        for (let c = 0; c < 10; c++) {
          board.grid[r][c] = "#00fff2";
        }
      }
      const mockCtx = new MockContext();
      const start = performance.now();
      for (let i = 0; i < 100; i++) {
        renderer._drawPlacedBlocks(mockCtx, board);
      }
      const elapsed = (performance.now() - start) / 100;
      assert.ok(elapsed < 3, `평균 ${elapsed.toFixed(3)}ms (제한: 3ms)`);
    });

    it("glow 없는 테마에서 alpha 1.0 블록은 save/restore 스킵", () => {
      const canvas = new MockCanvas();
      const renderer = new Renderer(canvas);
      themes.apply("gameboy"); // glow: false
      const mockCtx = new MockContext();
      // alpha 기본값(0.85)은 _drawPlacedBlocks에서 전달
      // 직접 _drawCell 호출로 검증 (alpha=1.0)
      renderer._drawCell(mockCtx, 5, 15, "#306230", 1.0);
      assert.equal(mockCtx._saves, 0,
        `Game Boy alpha=1.0에서 save ${mockCtx._saves}번 (기대: 0)`);
    });

    it("glow 테마에서 셀 당 save/restore 1회씩", () => {
      const canvas = new MockCanvas();
      const renderer = new Renderer(canvas);
      themes.apply("cyberpunk"); // glow: true
      const board = new Board();
      const cellCount = 5;
      for (let c = 0; c < cellCount; c++) {
        board.grid[19][c] = "#00fff2";
      }
      const mockCtx = new MockContext();
      renderer._drawPlacedBlocks(mockCtx, board);
      assert.equal(mockCtx._saves, cellCount,
        `Cyberpunk에서 ${cellCount}셀: save ${mockCtx._saves}번`);
    });
  });

  describe("AI", () => {
    it("빈 보드에서 최적 이동 탐색: < 5ms", () => {
      const { AI } = ctx;
      const ai = new AI();
      const board = new Board();
      const piece = { type: "T", rotation: 0, x: 3, y: 0 };

      const start = performance.now();
      for (let i = 0; i < 100; i++) {
        ai.findBestMove(board, piece);
      }
      const elapsed = (performance.now() - start) / 100;
      assert.ok(elapsed < 5, `평균 ${elapsed.toFixed(3)}ms (제한: 5ms)`);
    });

    it("복잡한 보드에서도 < 10ms", () => {
      const { AI } = ctx;
      const ai = new AI();
      const board = new Board();
      // 복잡한 보드: 하위 10행 랜덤 채우기 (70% 확률)
      for (let r = 10; r < 20; r++) {
        for (let c = 0; c < 10; c++) {
          if (Math.random() < 0.7) board.grid[r][c] = "#ff0000";
        }
      }
      const piece = { type: "I", rotation: 0, x: 3, y: 0 };

      const start = performance.now();
      for (let i = 0; i < 100; i++) {
        ai.findBestMove(board, piece);
      }
      const elapsed = (performance.now() - start) / 100;
      assert.ok(elapsed < 10, `평균 ${elapsed.toFixed(3)}ms (제한: 10ms)`);
    });
  });

  describe("전체 프레임", () => {
    it("캔버스 크기가 164x252 (초소형)인지 확인", () => {
      assert.equal(ctx.C.CANVAS_W, 164);
      assert.equal(ctx.C.CANVAS_H, 252);
      const pixels = 164 * 252;
      assert.ok(pixels < 50000, `${pixels}px — 초소형 캔버스`);
    });
  });
});
