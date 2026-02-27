// === 렌더러 테스트 (그리드 캐시, save/restore 최적화, 첫 프레임) ===
const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");

const ctx = require("./loader");
const { Renderer, themes, Board, PuyoBoard, PUYO } = ctx;
const { MockCanvas, MockContext } = require("./setup");

describe("Renderer", () => {
  let renderer;

  beforeEach(() => {
    const canvas = new MockCanvas(164, 252);
    renderer = new Renderer(canvas);
    themes.apply("cyberpunk");
  });

  describe("그리드 오프스크린 캐시", () => {
    it("초기에 _gridCache가 null이어야 한다", () => {
      assert.equal(renderer._gridCache, null);
    });

    it("_drawBoardBg 호출 후 _gridCache가 생성되어야 한다", () => {
      const mockCtx = new MockContext();
      renderer._drawBoardBg(mockCtx);
      assert.ok(renderer._gridCache, "그리드 캐시 미생성");
      assert.equal(renderer._gridCacheTheme, "cyberpunk");
    });

    it("같은 테마에서 두 번째 호출 시 캐시 재사용", () => {
      const mockCtx = new MockContext();
      renderer._drawBoardBg(mockCtx);
      const cache1 = renderer._gridCache;
      renderer._drawBoardBg(mockCtx);
      assert.equal(renderer._gridCache, cache1, "캐시가 재생성됨");
    });

    it("테마 변경 시 캐시 무효화 + 재생성", () => {
      const mockCtx = new MockContext();
      renderer._drawBoardBg(mockCtx);
      const cache1 = renderer._gridCache;
      themes.apply("gameboy");
      renderer._drawBoardBg(mockCtx);
      assert.notEqual(renderer._gridCache, cache1, "테마 변경 후 캐시 미갱신");
      assert.equal(renderer._gridCacheTheme, "gameboy");
    });

    it("캐시된 그리드는 drawImage 1회로 그려져야 한다", () => {
      const mockCtx = new MockContext();
      // 첫 호출: 캐시 생성
      renderer._drawBoardBg(mockCtx);
      mockCtx._reset();
      // 두 번째 호출: 캐시 drawImage
      renderer._drawBoardBg(mockCtx);
      // drawImage가 1회 호출되어야 함 (stroke 호출 없어야 함)
      assert.ok(mockCtx._drawCalls >= 1, "drawImage 미호출");
      // stroke는 테두리(1회)만 — 그리드 라인 stroke 없어야 함
      assert.ok(mockCtx._strokeCalls <= 1,
        `stroke ${mockCtx._strokeCalls}번 (기대: <=1, 테두리만)`);
    });
  });

  describe("_drawCell save/restore 최적화", () => {
    it("glow 없는 테마 + alpha 1.0에서 save/restore 스킵", () => {
      themes.apply("gameboy"); // glow: false
      const mockCtx = new MockContext();
      renderer._drawCell(mockCtx, 5, 10, "#306230", 1.0);
      assert.equal(mockCtx._saves, 0,
        `Game Boy 테마에서 save ${mockCtx._saves}번 (기대: 0)`);
    });

    it("glow 있는 테마에서 save/restore 호출", () => {
      themes.apply("cyberpunk"); // glow: true
      const mockCtx = new MockContext();
      renderer._drawCell(mockCtx, 5, 10, "#00fff2", 1.0);
      assert.equal(mockCtx._saves, 1);
      assert.equal(mockCtx._restores, 1);
    });

    it("alpha != 1.0일 때 save/restore 호출", () => {
      themes.apply("gameboy"); // glow: false
      const mockCtx = new MockContext();
      renderer._drawCell(mockCtx, 5, 10, "#306230", 0.85);
      assert.equal(mockCtx._saves, 1, "alpha < 1에서 save 미호출");
    });
  });

  describe("_drawGhost 배치 최적화", () => {
    it("4개 셀에 대해 save/restore 1회만 호출", () => {
      const cells = [[5, 3], [5, 4], [5, 5], [5, 6]];
      const mockCtx = new MockContext();
      renderer._drawGhost(mockCtx, cells, "#00fff2");
      assert.equal(mockCtx._saves, 1, `ghost save ${mockCtx._saves}번`);
      assert.equal(mockCtx._restores, 1, `ghost restore ${mockCtx._restores}번`);
    });

    it("보드 위 셀만 그려져야 한다 (r < 0 스킵)", () => {
      const cells = [[-1, 3], [0, 4], [1, 5], [2, 6]];
      const mockCtx = new MockContext();
      renderer._drawGhost(mockCtx, cells, "#00fff2");
      // r=-1인 셀은 스킵, 나머지 3개만 그려야 함
      // fillRect(3개) + strokeRect(3개)
      assert.equal(mockCtx._drawCalls, 3, `draw ${mockCtx._drawCalls}번 (기대: 3)`);
    });
  });

  describe("_drawGameOver에서 Date.now() 미사용", () => {
    it("glowPhase 기반 알파 계산", () => {
      const mockCtx = new MockContext();
      renderer.glowPhase = Math.PI / 6; // 특정 값
      // _drawGameOver 호출 (state에 필요한 최소 데이터)
      renderer._drawGameOver(mockCtx, { score: 1000 });
      // Date.now()가 아닌 glowPhase 사용 확인은 코드 구조로 검증
      // (Date.now()가 코드에 없으면 통과)
      const fs = require("fs");
      const path = require("path");
      const code = fs.readFileSync(path.join(__dirname, "..", "js", "renderer.js"), "utf8");
      const gameOverBlock = code.slice(code.indexOf("_drawGameOver"));
      assert.ok(!gameOverBlock.includes("Date.now()"),
        "renderer.js _drawGameOver에 Date.now() 사용됨");
    });
  });

  describe("첫 프레임 플래그", () => {
    it("초기에 _firstFrameDone = false", () => {
      assert.equal(renderer._firstFrameDone, false);
    });

    it("draw() 호출 후 body에 'ready' 클래스 추가", () => {
      const board = new Board();
      globalThis.document.body.classList._set.clear();
      renderer.draw({
        board,
        currentCells: null,
        currentColor: null,
        ghostCells: null,
        nextType: null,
        score: 0,
        lines: 0,
        combo: 0,
        level: 1,
        boost: 1,
        particles: { draw() {} },
        shake: { getOffset() { return { x: 0, y: 0 }; } },
        flash: { draw() {} },
        chat: { draw() {} },
        gameOver: false,
      });
      assert.ok(renderer._firstFrameDone);
      assert.ok(globalThis.document.body.classList.contains("ready"),
        "body에 ready 클래스 미추가");
    });
  });

  describe("유틸 함수", () => {
    it("_formatNum: 1000 이상은 K 접미사", () => {
      assert.equal(renderer._formatNum(1500), "1.5K");
      assert.equal(renderer._formatNum(1000000), "1.0M");
      assert.equal(renderer._formatNum(500), "500");
    });

    it("_parseColor: hex 파싱", () => {
      const c = renderer._parseColor("#ff0040");
      assert.equal(c.r, 255);
      assert.equal(c.g, 0);
      assert.equal(c.b, 64);
      assert.equal(c.a, 1);
    });

    it("_parseColor: rgba 파싱", () => {
      const c = renderer._parseColor("rgba(100,200,255,0.7)");
      assert.equal(c.r, 100);
      assert.equal(c.g, 200);
      assert.equal(c.b, 255);
      assert.equal(c.a, 0.7);
    });

    it("_parseColor: 잘못된 형식은 null", () => {
      assert.equal(renderer._parseColor("invalid"), null);
    });
  });

  describe("뿌요 모드 렌더링", () => {
    it("_drawPuyoCell 메서드가 존재해야 한다", () => {
      assert.ok(typeof renderer._drawPuyoCell === "function");
    });

    it("_drawPuyoGhost 메서드가 존재해야 한다", () => {
      assert.ok(typeof renderer._drawPuyoGhost === "function");
    });

    it("_drawPuyoSidePanel 메서드가 존재해야 한다", () => {
      assert.ok(typeof renderer._drawPuyoSidePanel === "function");
    });

    it("_drawChainText 메서드가 존재해야 한다", () => {
      assert.ok(typeof renderer._drawChainText === "function");
    });

    it("_drawPuyoBoardBg 메서드가 존재해야 한다", () => {
      assert.ok(typeof renderer._drawPuyoBoardBg === "function");
    });

    it("_drawPuyoPlacedBlocks 메서드가 존재해야 한다", () => {
      assert.ok(typeof renderer._drawPuyoPlacedBlocks === "function");
    });

    it("_drawCurrentPuyoPair 메서드가 존재해야 한다", () => {
      assert.ok(typeof renderer._drawCurrentPuyoPair === "function");
    });

    it("_drawPuyoGhostPair 메서드가 존재해야 한다", () => {
      assert.ok(typeof renderer._drawPuyoGhostPair === "function");
    });

    it("_drawPuyoCell 호출 시 에러 없이 실행", () => {
      const mockCtx = new MockContext();
      renderer._drawPuyoCell(mockCtx, 2, 5, "#ff0040", 1.0);
      assert.ok(mockCtx._drawCalls > 0, "뿌요 셀 드로우 호출 없음");
    });

    it("_drawPuyoGhost 호출 시 에러 없이 실행", () => {
      const mockCtx = new MockContext();
      renderer._drawPuyoGhost(mockCtx, 3, 8, "#00ff00");
      assert.ok(mockCtx._saves >= 1, "고스트 save 미호출");
    });

    it("_drawChainText 호출 시 에러 없이 실행", () => {
      const mockCtx = new MockContext();
      renderer._drawChainText(mockCtx, 3, 50, 100, 0.5);
      assert.ok(mockCtx._drawCalls > 0, "체인 텍스트 드로우 미호출");
    });

    it("뿌요 모드 draw()에서 뿌요 보드 렌더링", () => {
      const board = new PuyoBoard();
      board.place(12, 2, 1);
      const mockCtx = new MockContext();
      globalThis.document.body.classList._set.clear();
      renderer.draw({
        gameMode: "puyo",
        board,
        puyoGrid: board.grid,
        currentPair: null,
        nextPuyoPair: [1, 2],
        chainCount: 0,
        maxChain: 0,
        chainDisplays: [],
        score: 100,
        lines: 0,
        combo: 0,
        level: 1,
        boost: 1,
        particles: { draw() {} },
        shake: { getOffset() { return { x: 0, y: 0 }; } },
        flash: { draw() {} },
        chat: { draw() {} },
        gameOver: false,
      });
      assert.ok(renderer._firstFrameDone);
    });

    it("뿌요 그리드 캐시 초기화", () => {
      const canvas = new MockCanvas(164, 252);
      const r = new Renderer(canvas);
      assert.equal(r._puyoGridCache, null);
      assert.equal(r._puyoGridCacheTheme, null);
    });

    it("_drawPuyoBoardBg 호출 후 캐시 생성", () => {
      const mockCtx = new MockContext();
      renderer._drawPuyoBoardBg(mockCtx);
      assert.ok(renderer._puyoGridCache, "뿌요 그리드 캐시 미생성");
      assert.equal(renderer._puyoGridCacheTheme, themes.active.id);
    });

    it("_drawPuyoSidePanel에 nextPuyoPair 렌더링 확인", () => {
      const mockCtx = new MockContext();
      renderer._drawPuyoSidePanel(mockCtx, {
        nextPuyoPair: [1, 3],
        score: 500,
        maxChain: 2,
        combo: 1,
        level: 1,
        boost: 1,
      });
      assert.ok(mockCtx._drawCalls > 0, "사이드 패널 드로우 미호출");
    });
  });
});
