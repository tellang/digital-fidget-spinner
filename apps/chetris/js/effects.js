// === 파티클 시스템 & 화면 흔들림 ===

class Particle {
  constructor(x, y, color, opts = {}) {
    this.x = x;
    this.y = y;
    this.color = color;
    const angle = opts.angle ?? Math.random() * Math.PI * 2;
    const speed = opts.speed ?? 60 + Math.random() * 200;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.life = opts.life ?? 0.4 + Math.random() * 0.6;
    this.maxLife = this.life;
    this.size = opts.size ?? 2 + Math.random() * 4;
    this.gravity = opts.gravity ?? 250;
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.vy += this.gravity * dt;
    this.life -= dt;
  }

  get alpha() {
    return Math.max(0, this.life / this.maxLife);
  }

  get alive() {
    return this.life > 0;
  }
}

class ParticleSystem {
  static MAX_PARTICLES = 300;

  constructor() {
    this.particles = [];
  }

  // 폭발 이펙트 (라인 클리어, 충돌)
  burst(x, y, color, count = 20) {
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= ParticleSystem.MAX_PARTICLES) break;
      this.particles.push(new Particle(x, y, color));
    }
  }

  // 라인 클리어 이펙트: 행 전체에서 파티클 방출
  lineClear(row, colors) {
    const y = C.BOARD_Y + row * C.CELL + C.CELL / 2;
    for (let c = 0; c < C.COLS; c++) {
      if (this.particles.length >= ParticleSystem.MAX_PARTICLES) break;
      const x = C.BOARD_X + c * C.CELL + C.CELL / 2;
      const color = colors[c] || C.NEON_POOL[Math.floor(Math.random() * C.NEON_POOL.length)];
      for (let i = 0; i < 5; i++) {
        if (this.particles.length >= ParticleSystem.MAX_PARTICLES) break;
        this.particles.push(new Particle(x, y, color, {
          angle: -Math.PI / 2 + (Math.random() - 0.5) * Math.PI,
          speed: 80 + Math.random() * 180,
          size: 2 + Math.random() * 3,
        }));
      }
    }
  }

  // 키 입력 이펙트: 작은 스파크
  spark(x, y, color) {
    for (let i = 0; i < 3; i++) {
      if (this.particles.length >= ParticleSystem.MAX_PARTICLES) break;
      this.particles.push(new Particle(x, y, color, {
        speed: 30 + Math.random() * 60,
        life: 0.2 + Math.random() * 0.3,
        size: 1 + Math.random() * 2,
        gravity: 0,
      }));
    }
  }

  // 뿌요 터짐 — 원형으로 퍼지는 파티클
  puyoPop(row, col, color) {
    const x = PUYO.BOARD_X + col * PUYO.CELL + PUYO.CELL / 2;
    const y = PUYO.BOARD_Y + row * PUYO.CELL + PUYO.CELL / 2;
    const count = 8 + Math.floor(Math.random() * 5);

    for (let i = 0; i < count; i++) {
      if (this.particles.length >= ParticleSystem.MAX_PARTICLES) break;
      const angle = (i / count) * Math.PI * 2;
      this.particles.push(new Particle(x, y, color, {
        angle: angle,
        speed: 50 + Math.random() * 100,
        size: 1.5 + Math.random() * 2.5,
        life: 0.3 + Math.random() * 0.4,
        gravity: 80, // 낮은 중력
      }));
    }
  }

  // 연쇄 폭발 — 체인 수에 비례하는 큰 폭발
  chainBurst(x, y, chainCount) {
    const pool = themes.active.neonPool;
    const count = chainCount * 8;

    for (let i = 0; i < count; i++) {
      if (this.particles.length >= ParticleSystem.MAX_PARTICLES) break;
      const color = pool[Math.floor(Math.random() * pool.length)];
      this.particles.push(new Particle(x, y, color, {
        angle: Math.random() * Math.PI * 2,
        speed: 80 + Math.random() * 200,
        size: 2 + Math.random() * 4,
        life: 0.5 + Math.random() * 0.8,
        gravity: 120,
      }));
    }
  }

  // 하드 드롭 충격파
  impact(piece, color) {
    const cells = getCells(piece);
    for (const [r, cc] of cells) {
      const x = C.BOARD_X + cc * C.CELL + C.CELL / 2;
      const y = C.BOARD_Y + r * C.CELL + C.CELL / 2;
      this.burst(x, y, color, 6);
    }
  }

  update(dt) {
    // swap-and-pop: splice 대신 마지막 요소와 교환 후 pop (GC 압력 감소)
    let i = 0;
    while (i < this.particles.length) {
      this.particles[i].update(dt);
      if (!this.particles[i].alive) {
        this.particles[i] = this.particles[this.particles.length - 1];
        this.particles.pop();
      } else {
        i++;
      }
    }
  }

  draw(ctx) {
    const len = this.particles.length;
    if (len === 0) return;

    // 배치 드로우: save/restore를 개별 호출 대신 한 번만
    ctx.save();
    // 파티클 수 100+ 시 shadowBlur 비활성화 (성능 우선)
    ctx.shadowBlur = len > 100 ? 0 : 10;
    for (let i = 0; i < len; i++) {
      const p = this.particles[i];
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.fillRect(p.x - p.size / 2 | 0, p.y - p.size / 2 | 0, p.size, p.size);
    }
    ctx.restore();
  }
}

class ScreenShake {
  constructor() {
    this.intensity = 0;
    this.decay = 10;
    // 재사용 오프셋 객체 (프레임당 GC 방지)
    this._offset = { x: 0, y: 0 };
  }

  trigger(intensity = 5) {
    this.intensity = Math.max(this.intensity, intensity);
  }

  update(dt) {
    this.intensity *= Math.max(0, 1 - this.decay * dt);
    if (this.intensity < 0.1) this.intensity = 0;
  }

  getOffset() {
    if (this.intensity === 0) {
      this._offset.x = 0;
      this._offset.y = 0;
    } else {
      this._offset.x = (Math.random() - 0.5) * this.intensity * 2;
      this._offset.y = (Math.random() - 0.5) * this.intensity * 2;
    }
    return this._offset;
  }
}

// === 뿌요 연쇄 텍스트 디스플레이 ===

class ChainDisplay {
  constructor() {
    this.chains = [];
  }

  // 연쇄 텍스트 추가
  add(chainCount, x, y) {
    this.chains.push({
      count: chainCount,
      x: x,
      y: y,
      timer: 0,
      duration: 1.0,
    });
  }

  update(dt) {
    // swap-and-pop: splice 대신 (GC 압력 감소)
    let i = 0;
    while (i < this.chains.length) {
      this.chains[i].timer += dt;
      if (this.chains[i].timer >= this.chains[i].duration) {
        this.chains[i] = this.chains[this.chains.length - 1];
        this.chains.pop();
      } else {
        i++;
      }
    }
  }

  draw(ctx) {
    const t = themes.active;
    const pool = t.neonPool;

    for (const c of this.chains) {
      const progress = c.timer / c.duration;
      const alpha = Math.max(0, 1 - progress);
      // 위로 플로팅
      const offsetY = -30 * progress;
      // 스케일: 처음 크게, 점점 작게
      const scale = 1 + (1 - progress) * 0.5;
      // 체인수에 따라 폰트 크기 조절
      const baseSize = c.count >= 4 ? 14 : 10;
      const fontSize = Math.round(baseSize * scale);
      // 색상: neonPool에서 순환
      const color = pool[c.count % pool.length];

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = `bold ${fontSize}px "Courier New", monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // 글로우 강도: 4+ 체인 강화
      if (c.count >= 4) {
        ctx.shadowBlur = 16 + (1 - progress) * 10;
      } else {
        ctx.shadowBlur = 8;
      }
      ctx.shadowColor = color;
      ctx.fillStyle = color;
      ctx.fillText(c.count + ' CHAIN!', c.x, c.y + offsetY);

      // 4+ 체인: 이중 글로우 후광
      if (c.count >= 4) {
        ctx.globalAlpha = alpha * 0.4;
        ctx.shadowBlur = 24;
        ctx.fillText(c.count + ' CHAIN!', c.x, c.y + offsetY);
      }

      ctx.restore();
    }
  }
}

// 라인 클리어 플래시 애니메이션
class FlashEffect {
  constructor() {
    this.flashes = [];
  }

  add(rows) {
    this.flashes.push({ rows, timer: 0, duration: 0.3 });
  }

  update(dt) {
    // swap-and-pop: splice 대신 (GC 압력 감소)
    let i = 0;
    while (i < this.flashes.length) {
      this.flashes[i].timer += dt;
      if (this.flashes[i].timer >= this.flashes[i].duration) {
        this.flashes[i] = this.flashes[this.flashes.length - 1];
        this.flashes.pop();
      } else {
        i++;
      }
    }
  }

  draw(ctx) {
    for (const f of this.flashes) {
      const progress = f.timer / f.duration;
      const alpha = 1 - progress;
      ctx.save();
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.6})`;
      for (const row of f.rows) {
        ctx.fillRect(
          C.BOARD_X,
          C.BOARD_Y + row * C.CELL,
          C.COLS * C.CELL,
          C.CELL
        );
      }
      ctx.restore();
    }
  }
}
