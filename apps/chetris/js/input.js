// === 입력 핸들러 & 채팅 디스플레이 ===

class InputHandler {
  constructor() {
    this.boost = 1.0;
    this.maxBoost = 8.0;
    this.boostPerKey = 0.6;
    this.decayRate = 1.5;
    this.pendingChars = [];
    this.keyCount = 0;
    this.hardDropCount = 0;

    this._onInput = () => {
      this.boost = Math.min(this.maxBoost, this.boost + this.boostPerKey);
      this.keyCount++;
      this.hardDropCount++;
    };

    // 브라우저 직접 포커스 시 (개발/테스트용)
    this._onKey = (e) => {
      if (["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"," "].includes(e.key)) {
        e.preventDefault();
      }
      this._onInput();
      if (e.key.length === 1) {
        this.pendingChars.push(e.key);
      }
    };
    document.addEventListener("keydown", this._onKey);

    // Tauri 이벤트 리스너
    this._unlisteners = [];
    if (window.__TAURI__) {
      // 글로벌 키보드 훅 (포커스 없이도 동작)
      window.__TAURI__.event.listen("global-keypress", () => {
        this._onInput();
      }).then((u) => this._unlisteners.push(u));

      // 트레이 메뉴 테마 변경
      window.__TAURI__.event.listen("set-theme", (e) => {
        themes.apply(e.payload);
      }).then((u) => this._unlisteners.push(u));
    }
  }

  update(dt) {
    this.boost = Math.max(1.0, this.boost - this.decayRate * dt);
  }

  getBoost() {
    return this.boost;
  }

  popChars() {
    const chars = this.pendingChars;
    this.pendingChars = [];
    return chars;
  }

  popHardDrops() {
    const count = this.hardDropCount;
    this.hardDropCount = 0;
    return count;
  }

  destroy() {
    document.removeEventListener("keydown", this._onKey);
    for (const u of this._unlisteners) u();
  }
}

class ChatDisplay {
  constructor() {
    this.bubbles = [];
  }

  add(char) {
    this.bubbles.push({
      char,
      x: C.BOARD_X + 20 + Math.random() * (C.COLS * C.CELL - 40),
      y: C.CHAT_Y + 30,
      vy: -50 - Math.random() * 40,
      vx: (Math.random() - 0.5) * 30,
      life: 1.8,
      maxLife: 1.8,
      size: 9 + Math.random() * 6,
      color: C.NEON_POOL[Math.floor(Math.random() * C.NEON_POOL.length)],
      rotation: (Math.random() - 0.5) * 0.5,
    });
  }

  update(dt) {
    // swap-and-pop: splice 대신 (GC 압력 감소)
    let i = 0;
    while (i < this.bubbles.length) {
      const b = this.bubbles[i];
      b.y += b.vy * dt;
      b.x += b.vx * dt;
      b.vy *= 0.99;
      b.life -= dt;
      if (b.life <= 0) {
        this.bubbles[i] = this.bubbles[this.bubbles.length - 1];
        this.bubbles.pop();
      } else {
        i++;
      }
    }
  }

  draw(ctx) {
    for (const b of this.bubbles) {
      const alpha = Math.max(0, b.life / b.maxLife);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(b.x, b.y);
      ctx.rotate(b.rotation);
      ctx.font = `bold ${b.size}px "Courier New", monospace`;
      ctx.fillStyle = b.color;
      ctx.shadowBlur = 15;
      ctx.shadowColor = b.color;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(b.char, 0, 0);
      ctx.restore();
    }
  }
}
