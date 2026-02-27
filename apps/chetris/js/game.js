// === 메인 게임 클래스 ===

class Game {
  constructor() {
    this.canvas = document.getElementById("canvas");
    this.container = document.getElementById("game-container");
    this.renderer = new Renderer(this.canvas);
    this.board = new Board();
    this.particles = new ParticleSystem();
    this.shake = new ScreenShake();
    this.flash = new FlashEffect();
    this.input = new InputHandler();
    this.chat = new ChatDisplay();
    this.ai = new AI();

    // 게임 상태
    this.score = 0;
    this.lines = 0;
    this.combo = 0;
    this.level = 1;

    // 피스 관리
    this.bag = [];
    this.current = null;
    this.next = null;

    // AI 이동 큐
    this.moveQueue = [];
    this.moveTimer = 0;

    // 게임 오버
    this.gameOver = false;
    this.restartTimer = 0;
    this.restartDelay = 2500;

    // 자동 페이드
    this.idleTime = 0;
    this.currentOpacity = 1.0;
    this._prevOpacity = 1.0;
    this._prevBoosted = false;
    document.body.addEventListener("mouseenter", () => {
      this.idleTime = 0;
      this.currentOpacity = 1.0;
    });

    // 렌더 캐시: 고스트 Y, 현재 피스 셀, 고스트 셀
    this._cachedGhostY = null;
    this._cachedCells = null;
    this._cachedGhostCells = null;

    // 설정 로드 (토스 스타일: 첫 실행은 시간대 기반 자동 테마)
    settings.load().then(() => {
      // 자동 테마: 설정에서 켜져 있으면 시간대 기반
      if (settings.get("autoTheme")) {
        const autoId = settings.getTimeBasedTheme();
        themes.apply(autoId);
      }

      // 설정 변경 감시
      settings.onChange((key, value) => {
        if (key === "theme") themes.apply(value);
      });
    });

    // Tauri 설정 이벤트 수신
    if (window.__TAURI__) {
      window.__TAURI__.event.listen("toggle-setting", (e) => {
        const { key, value } = e.payload;
        settings.set(key, value);
      });
    }

    // 초기화
    this._fillBag();
    this.next = this._spawnPiece();
    this._nextPiece();

    // 게임 루프 (setTimeout 기반 — 비활성 탭에서도 동작)
    this.lastTime = performance.now();
    this._loop = this._loop.bind(this);
    this._scheduleNext();
  }

  _scheduleNext() {
    setTimeout(this._loop, 16);
  }

  _loop() {
    const now = performance.now();
    const dt = Math.min((now - this.lastTime) / 1000, 0.1);
    this.lastTime = now;

    this._update(dt);
    this._render();

    this._scheduleNext();
  }

  _update(dt) {
    const boost = this.input.getBoost();

    // 입력 처리
    this.input.update(dt);
    const chars = this.input.popChars();
    const drops = this.input.popHardDrops();
    for (const ch of chars) {
      this.chat.add(ch);
      // 키 입력 시 파티클 스파크
      const sx = C.BOARD_X + Math.random() * C.COLS * C.CELL;
      const sy = C.BOARD_Y + C.ROWS * C.CELL;
      this.particles.spark(sx, sy, C.NEON_POOL[Math.floor(Math.random() * C.NEON_POOL.length)]);
    }

    // 이펙트 업데이트
    this.particles.update(dt);
    this.shake.update(dt);
    this.flash.update(dt);
    this.chat.update(dt);

    // 게임 오버 처리
    if (this.gameOver) {
      this.restartTimer += dt * 1000;
      if (this.restartTimer >= this.restartDelay) {
        this._restart();
      }
      return;
    }

    // 자동 페이드 처리
    if (drops > 0 || chars.length > 0) {
      this.idleTime = 0;
      this.currentOpacity = 1.0;
    } else {
      this.idleTime += dt;
    }
    if (settings.get("autoFade")) {
      const fadeDelay = settings.get("autoFadeDelay");
      const fadeMin = settings.get("autoFadeOpacity");
      if (this.idleTime > fadeDelay) {
        const fadeProgress = Math.min(1, (this.idleTime - fadeDelay) / 2);
        this.currentOpacity = 1.0 - fadeProgress * (1.0 - fadeMin);
      }
    } else {
      this.currentOpacity = 1.0;
    }
    if (this.currentOpacity !== this._prevOpacity) {
      this._prevOpacity = this.currentOpacity;
      this.container.style.opacity = this.currentOpacity;
    }

    // 키 입력 시 AI 이동 즉시 완료 + 하드드롭
    if (drops > 0 && this.current) {
      // 큐에 남은 회전/이동을 전부 즉시 실행 (down 제외)
      while (this.moveQueue.length > 0) {
        const move = this.moveQueue[0];
        if (move === "down" || move === "drop") break;
        this.moveQueue.shift();
        this._executeMove(move);
        if (!this.current) return;
      }
      // 하드드롭
      this.moveQueue = [];
      this.moveTimer = 0;
      this._hardDrop();
      return;
    }

    // AI 이동 실행
    if (this.current && this.moveQueue.length > 0) {
      this.moveTimer += dt * 1000 * boost;

      // 중력(down) vs AI 이동(rotate/left/right)에 다른 딜레이 적용
      const nextMove = this.moveQueue[0];
      const moveDelay = nextMove === "down"
        ? C.BASE_DROP_DELAY / boost                     // 중력: boost=1→800ms, boost=8→100ms
        : C.BASE_MOVE_DELAY / Math.max(1, boost * 0.5); // AI 조작: 빠르게

      while (this.moveTimer >= moveDelay && this.moveQueue.length > 0) {
        this.moveTimer -= moveDelay;
        const move = this.moveQueue.shift();
        this._executeMove(move);

        // 잠금 후에는 루프 탈출
        if (move === "down" && !this.current) {
          break;
        }
        // AI 조작→중력 전환 시 타이머 리셋 + 루프 탈출
        if (this.moveQueue.length > 0 && this.moveQueue[0] === "down" && move !== "down") {
          this.moveTimer = 0;
          break;
        }
      }
    }
  }

  _executeMove(move) {
    if (!this.current) return;

    switch (move) {
      case "rotateCW":
        this._tryRotate(1);
        break;
      case "rotateCCW":
        this._tryRotate(-1);
        break;
      case "left":
        this._tryMove(-1, 0);
        break;
      case "right":
        this._tryMove(1, 0);
        break;
      case "drop":
        this._hardDrop();
        break;
      case "down":
        if (!this._tryMove(0, 1)) {
          const color = C.COLORS[this.current.type];
          if (themes.active.effects.particles && settings.get("particles")) this.particles.impact(this.current, color);
          if (themes.active.effects.shake && settings.get("shake")) this.shake.trigger(2);
          this._lockPiece();
          // _lockPiece → _nextPiece가 새 moveQueue + moveTimer를 설정하므로
          // 여기서 moveQueue를 비우면 안 됨
        }
        break;
    }
  }

  _tryMove(dx, dy) {
    if (!this.current) return false;
    const cells = C.SHAPES[this.current.type][this.current.rotation].map(([r, c]) => [
      r + this.current.y + dy,
      c + this.current.x + dx,
    ]);
    if (this.board.isValid(cells)) {
      this.current.x += dx;
      this.current.y += dy;
      this.current.lastAction = "move";
      this._cachedGhostY = null;
      this._cachedCells = null;
      this._cachedGhostCells = null;
      return true;
    }
    return false;
  }

  _tryRotate(dir) {
    if (!this.current) return false;
    const oldRot = this.current.rotation;
    const newRot = (oldRot + dir + 4) % 4;
    const kickKey = `${oldRot}>${newRot}`;
    const kickTable = this.current.type === "I" ? C.KICKS.I : C.KICKS.normal;
    const kicks = kickTable[kickKey];

    if (!kicks) return false;

    for (const [dx, dy] of kicks) {
      const cells = C.SHAPES[this.current.type][newRot].map(([r, c]) => [
        r + this.current.y - dy,
        c + this.current.x + dx,
      ]);
      if (this.board.isValid(cells)) {
        this.current.rotation = newRot;
        this.current.x += dx;
        this.current.y -= dy;
        this.current.lastAction = "rotate";
        this._cachedGhostY = null;
        this._cachedCells = null;
        this._cachedGhostCells = null;
        return true;
      }
    }
    return false;
  }

  _hardDrop() {
    if (!this.current) return;

    const ghostY = getGhostY(this.board, this.current);
    this.current.y = ghostY;

    // 충격 이펙트 (테마 + 설정)
    const color = C.COLORS[this.current.type];
    if (themes.active.effects.particles && settings.get("particles")) this.particles.impact(this.current, color);
    if (themes.active.effects.shake && settings.get("shake")) this.shake.trigger(4);

    this._lockPiece();
  }

  _lockPiece() {
    if (!this.current) return;

    const cells = getCells(this.current);
    const color = C.COLORS[this.current.type];

    // 보드 위에 배치 불가 → 게임 오버
    const aboveBoard = cells.some(([r]) => r < 0);
    if (aboveBoard) {
      this._triggerGameOver();
      return;
    }

    // T-스핀 체크
    const isTSpin = this.current.lastAction === "rotate" && this.board.checkTSpin(this.current);

    // 보드에 배치
    this.board.place(cells, color);

    // 라인 클리어
    const clearResult = this.board.clearLines();

    if (clearResult.count > 0) {
      // 점수 계산
      let lineScore;
      if (isTSpin) {
        lineScore = C.TSPIN_SCORES[clearResult.count] || 1600;
      } else {
        lineScore = C.LINE_SCORES[clearResult.count] || 800;
      }
      this.combo++;
      lineScore += this.combo * C.COMBO_BONUS;
      lineScore *= this.level;
      this.score += lineScore;
      this.lines += clearResult.count;
      this.level = Math.floor(this.lines / 10) + 1;

      // 이펙트 (테마 설정에 따라)
      if (themes.active.effects.particles && settings.get("particles")) {
        for (const row of clearResult.rows) {
          const rowColors = [];
          for (let c = 0; c < C.COLS; c++) {
            rowColors.push(color);
          }
          this.particles.lineClear(row, rowColors);
        }
      }
      this.flash.add(clearResult.rows);
      if (themes.active.effects.shake && settings.get("shake")) {
        this.shake.trigger(clearResult.count * 3 + (isTSpin ? 5 : 0));
      }
    } else {
      this.combo = 0;
    }

    // 다음 피스
    this._nextPiece();
  }

  _nextPiece() {
    this.current = this.next;
    this.next = this._spawnPiece();
    this._cachedGhostY = null;
    this._cachedCells = null;
    this._cachedGhostCells = null;

    if (!this.current) return;

    // 스폰 위치에서 충돌 → 게임 오버
    const cells = getCells(this.current);
    if (!this.board.isValid(cells)) {
      this._triggerGameOver();
      return;
    }

    // AI가 다음 수 결정
    const bestMove = this.ai.findBestMove(this.board, this.current);
    if (bestMove) {
      this.moveQueue = this.ai.buildMoveQueue(this.current, bestMove);
    } else {
      // AI가 수를 찾지 못하면 바로 드롭
      this.moveQueue = ["drop"];
    }
    this.moveTimer = 0;
  }

  _spawnPiece() {
    if (this.bag.length === 0) this._fillBag();
    const type = this.bag.pop();
    return {
      type,
      rotation: 0,
      x: C.SPAWN_X[type],
      y: 0,
      lastAction: null,
    };
  }

  _fillBag() {
    this.bag = ["I", "O", "T", "S", "Z", "J", "L"];
    for (let i = this.bag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]];
    }
  }

  _triggerGameOver() {
    this.gameOver = true;
    this.restartTimer = 0;
    this.current = null;
    if (themes.active.effects.shake && settings.get("shake")) this.shake.trigger(15);

    if (themes.active.effects.particles && settings.get("particles")) {
      for (let c = 0; c < C.COLS; c++) {
        for (let r = C.ROWS - 5; r < C.ROWS; r++) {
          if (this.board.grid[r][c]) {
            const x = C.BOARD_X + c * C.CELL + C.CELL / 2;
            const y = C.BOARD_Y + r * C.CELL + C.CELL / 2;
            this.particles.burst(x, y, this.board.grid[r][c], 3);
          }
        }
      }
    }
  }

  _restart() {
    this.board = new Board();
    this.score = 0;
    this.lines = 0;
    this.combo = 0;
    this.level = 1;
    this.gameOver = false;
    this.restartTimer = 0;
    this.moveQueue = [];
    this._cachedGhostY = null;
    this._cachedCells = null;
    this._cachedGhostCells = null;
    this.bag = [];
    this._fillBag();
    this.next = this._spawnPiece();
    this._nextPiece();
  }

  _render() {
    // 부스트 시 컨테이너 글로우 변경 (변경 시에만 DOM 조작)
    const boost = this.input.getBoost();
    const boosted = boost > 2.5;
    if (boosted !== this._prevBoosted) {
      this._prevBoosted = boosted;
      if (boosted) this.container.classList.add("boosted");
      else this.container.classList.remove("boosted");
    }

    // 현재 피스 셀 좌표 (캐시 활용)
    let currentCells = null;
    let ghostCells = null;
    let currentColor = null;

    if (this.current) {
      currentCells = this._cachedCells || (this._cachedCells = getCells(this.current));
      currentColor = C.COLORS[this.current.type];
      const ghostY = this._cachedGhostY !== null ? this._cachedGhostY : (this._cachedGhostY = getGhostY(this.board, this.current));
      if (!this._cachedGhostCells) {
        this._cachedGhostCells = C.SHAPES[this.current.type][this.current.rotation].map(([r, c]) => [
          r + ghostY,
          c + this.current.x,
        ]);
      }
      ghostCells = this._cachedGhostCells;
    }

    this.renderer.draw({
      board: this.board,
      currentCells,
      currentColor,
      ghostCells,
      nextType: this.next ? this.next.type : null,
      score: this.score,
      lines: this.lines,
      combo: this.combo,
      level: this.level,
      boost: this.input.getBoost(),
      particles: this.particles,
      shake: this.shake,
      flash: this.flash,
      chat: this.chat,
      gameOver: this.gameOver,
    });
  }
}

// 페이지 로드 시 게임 시작
window.addEventListener("DOMContentLoaded", () => {
  window._game = new Game();
});
