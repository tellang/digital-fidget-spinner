// === 캔버스 렌더러 (네온/사이버펑크) ===

// 색상 파싱 캐시 (메모이제이션)
const _colorParseCache = new Map();

class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    canvas.width = C.CANVAS_W;
    canvas.height = C.CANVAS_H;

    // 글로우 타이머 (배경 펄스용)
    this.glowPhase = 0;

    // 그리드 오프스크린 캐시 (테마 변경 시 무효화)
    this._gridCache = null;
    this._gridCacheTheme = null;

    // 배치 블록 오프스크린 캐시
    this._boardBlocksCache = null;
    this._boardBlocksVersion = -1;
    this._boardBlocksTheme = null;

    // 첫 프레임 렌더링 완료 플래그
    this._firstFrameDone = false;
  }

  draw(state) {
    const ctx = this.ctx;
    this.glowPhase += 0.02;

    // 배경
    ctx.fillStyle = C.BG;
    ctx.fillRect(0, 0, C.CANVAS_W, C.CANVAS_H);

    // 화면 흔들림 적용
    const shake = state.shake ? state.shake.getOffset() : { x: 0, y: 0 };
    ctx.save();
    ctx.translate(shake.x, shake.y);

    this._drawBoardBg(ctx);
    this._drawPlacedBlocks(ctx, state.board);

    // 고스트 피스
    if (state.ghostCells) {
      this._drawGhost(ctx, state.ghostCells, state.currentColor);
    }

    // 현재 피스
    if (state.currentCells) {
      this._drawPiece(ctx, state.currentCells, state.currentColor);
    }

    // 라인 클리어 플래시
    if (state.flash) {
      state.flash.draw(ctx);
    }

    // 사이드 패널
    this._drawSidePanel(ctx, state);

    // 헤더
    this._drawHeader(ctx, state);

    ctx.restore();

    // 파티클 (흔들림 영향 없음)
    if (state.particles) {
      state.particles.draw(ctx);
    }

    // 채팅 버블
    if (state.chat) {
      state.chat.draw(ctx);
    }

    // 게임 오버 오버레이
    if (state.gameOver) {
      this._drawGameOver(ctx, state);
    }

    // 첫 프레임 렌더 완료 → 페이드인 트리거 (시작 시 투명 네모 방지)
    if (!this._firstFrameDone) {
      this._firstFrameDone = true;
      document.body.classList.add("ready");
    }
  }

  _drawBoardBg(ctx) {
    const t = themes.active;
    const x = C.BOARD_X;
    const y = C.BOARD_Y;
    const w = C.COLS * C.CELL;
    const h = C.ROWS * C.CELL;

    ctx.fillStyle = t.boardBg;
    ctx.fillRect(x, y, w, h);

    // 그리드 라인: 오프스크린 캐시 (테마 변경 시만 재생성)
    if (this._gridCacheTheme !== t.id) {
      const gc = document.createElement("canvas");
      gc.width = w;
      gc.height = h;
      const gctx = gc.getContext("2d");
      gctx.strokeStyle = C.GRID_COLOR;
      gctx.lineWidth = 0.5;
      // 단일 패스: 모든 라인을 하나의 path로 묶어 stroke 1회
      gctx.beginPath();
      for (let r = 0; r <= C.ROWS; r++) {
        gctx.moveTo(0, r * C.CELL);
        gctx.lineTo(w, r * C.CELL);
      }
      for (let c = 0; c <= C.COLS; c++) {
        gctx.moveTo(c * C.CELL, 0);
        gctx.lineTo(c * C.CELL, h);
      }
      gctx.stroke();
      this._gridCache = gc;
      this._gridCacheTheme = t.id;
    }
    ctx.drawImage(this._gridCache, x, y);

    // 네온 테두리
    const pulse = 0.4 + Math.sin(this.glowPhase) * 0.15;
    ctx.save();
    ctx.strokeStyle = C.BORDER_COLOR;
    ctx.lineWidth = 1.5;
    ctx.shadowBlur = 12 + Math.sin(this.glowPhase) * 4;
    ctx.shadowColor = C.BORDER_COLOR;
    ctx.globalAlpha = pulse + 0.5;
    ctx.strokeRect(x - 1, y - 1, w + 2, h + 2);
    ctx.restore();
  }

  _drawPlacedBlocks(ctx, board) {
    const themeId = themes.active.id;
    if (this._boardBlocksVersion !== board.version || this._boardBlocksTheme !== themeId) {
      // 보드 변경 또는 테마 변경 시에만 오프스크린 캔버스 재렌더
      if (!this._boardBlocksCache) {
        this._boardBlocksCache = document.createElement("canvas");
        this._boardBlocksCache.width = C.COLS * C.CELL;
        this._boardBlocksCache.height = C.ROWS * C.CELL;
      }
      const oc = this._boardBlocksCache.getContext("2d");
      oc.clearRect(0, 0, this._boardBlocksCache.width, this._boardBlocksCache.height);
      oc.save();
      oc.translate(-C.BOARD_X, -C.BOARD_Y);
      for (let r = 0; r < C.ROWS; r++) {
        for (let c = 0; c < C.COLS; c++) {
          if (board.grid[r][c]) {
            this._drawCell(oc, c, r, board.grid[r][c], 0.85);
          }
        }
      }
      oc.restore();
      this._boardBlocksVersion = board.version;
      this._boardBlocksTheme = themeId;
    }
    ctx.drawImage(this._boardBlocksCache, C.BOARD_X, C.BOARD_Y);
  }

  _drawCell(ctx, col, row, color, alpha = 1.0) {
    const t = themes.active;
    const b = t.block;
    const x = C.BOARD_X + col * C.CELL;
    const y = C.BOARD_Y + row * C.CELL;
    const s = C.CELL - 1;

    // save/restore 최소화: glow 필요 시에만 사용
    const needsSave = b.glow || alpha !== 1.0;
    if (needsSave) {
      ctx.save();
      ctx.globalAlpha = alpha;
      if (b.glow) {
        ctx.shadowBlur = b.glowBlur;
        ctx.shadowColor = color;
      }
    }

    ctx.fillStyle = color;
    if (b.roundness > 0) {
      this._roundRect(ctx, x + 1, y + 1, s - 1, s - 1, b.roundness);
      ctx.fill();
    } else {
      ctx.fillRect(x + 1, y + 1, s - 1, s - 1);
    }

    if (needsSave) {
      ctx.shadowBlur = 0;
    }

    // 하이라이트
    if (b.highlight) {
      ctx.fillStyle = "rgba(255,255,255,0.2)";
      ctx.fillRect(x + 1, y + 1, s - 1, 2);
      ctx.fillRect(x + 1, y + 1, 2, s - 1);
    }

    // 그림자
    if (b.shadow) {
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      ctx.fillRect(x + s - 2, y + 1, 2, s - 1);
      ctx.fillRect(x + 1, y + s - 2, s - 1, 2);
    }

    if (needsSave) ctx.restore();
  }

  _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  _drawGhost(ctx, cells, color) {
    const s = C.CELL - 1;
    // 배치 드로우: save/restore 2회로 통합
    ctx.save();
    ctx.fillStyle = color;
    ctx.shadowBlur = 6;
    ctx.shadowColor = color;
    ctx.globalAlpha = 0.15;
    for (const [r, c] of cells) {
      if (r < 0) continue;
      ctx.fillRect(C.BOARD_X + c * C.CELL + 1, C.BOARD_Y + r * C.CELL + 1, s - 1, s - 1);
    }
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 0.3;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    for (const [r, c] of cells) {
      if (r < 0) continue;
      ctx.strokeRect(C.BOARD_X + c * C.CELL + 1, C.BOARD_Y + r * C.CELL + 1, s - 1, s - 1);
    }
    ctx.restore();
  }

  _drawPiece(ctx, cells, color) {
    for (const [r, c] of cells) {
      if (r >= 0) {
        this._drawCell(ctx, c, r, color);
      }
    }
  }

  _drawHeader(ctx, state) {
    const t = themes.active;
    ctx.save();
    ctx.font = 'bold 11px "Courier New", monospace';
    ctx.fillStyle = t.textColor;
    ctx.shadowBlur = t.block.glow ? 8 : 0;
    ctx.shadowColor = t.textColor;
    ctx.textBaseline = "middle";
    ctx.fillText("CHATRIS", C.BOARD_X, 11);

    // 속도 표시
    const boost = state.boost || 1;
    const boostColor = boost > 4 ? "#ff0040" : boost > 2 ? "#ffee00" : "#00fff2";
    ctx.font = 'bold 8px "Courier New", monospace';
    ctx.fillStyle = boostColor;
    ctx.shadowColor = boostColor;
    ctx.textAlign = "right";
    ctx.fillText(`⚡${boost.toFixed(1)}x`, C.CANVAS_W - 5, 11);
    ctx.restore();
  }

  _drawSidePanel(ctx, state) {
    const sx = C.SIDE_X;
    const sy = C.SIDE_Y;
    const pw = C.CANVAS_W - sx - 8;

    // 사이드 패널 배경
    ctx.save();
    ctx.fillStyle = themes.active.boardBg;
    ctx.fillRect(sx, sy, pw, C.ROWS * C.CELL);
    ctx.strokeStyle = themes.active.gridColor;
    ctx.lineWidth = 1;
    ctx.strokeRect(sx, sy, pw, C.ROWS * C.CELL);
    ctx.restore();

    let cy = sy + 8;

    // NEXT 피스
    ctx.save();
    ctx.font = '7px "Courier New", monospace';
    const t = themes.active;
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = t.textColor;
    ctx.textAlign = "center";
    ctx.fillText("NEXT", sx + pw / 2, cy);
    cy += 5;

    if (state.nextType) {
      const shape = C.SHAPES[state.nextType][0];
      const color = C.COLORS[state.nextType];
      const cellS = 8;
      const { minC, maxC, minR, maxR } = this._shapeBounds(shape);
      const shapeW = (maxC - minC + 1) * cellS;
      const shapeH = (maxR - minR + 1) * cellS;
      const ox = sx + (pw - shapeW) / 2;
      const oy = cy + 5;

      for (const [r, c] of shape) {
        const bx = ox + (c - minC) * cellS;
        const by = oy + (r - minR) * cellS;
        ctx.fillStyle = color;
        ctx.shadowBlur = 6;
        ctx.shadowColor = color;
        ctx.fillRect(bx + 1, by + 1, cellS - 2, cellS - 2);
      }
      cy = oy + shapeH + 15;
    }
    ctx.restore();

    // 통계 (테마 색상)
    const sc = themes.active.statColors;
    this._drawStat(ctx, sx, cy, pw, "SCORE", this._formatNum(state.score || 0), sc.score);
    cy += 28;
    this._drawStat(ctx, sx, cy, pw, "LINES", String(state.lines || 0), sc.lines);
    cy += 28;
    this._drawStat(ctx, sx, cy, pw, "COMBO", `x${state.combo || 0}`, sc.combo);
    cy += 28;
    this._drawStat(ctx, sx, cy, pw, "LEVEL", String(state.level || 1), sc.level);
    cy += 28;

    // 속도 바
    this._drawSpeedBar(ctx, sx, cy, pw, state.boost || 1);
  }

  _drawStat(ctx, sx, y, pw, label, value, color) {
    ctx.save();
    ctx.font = '6px "Courier New", monospace';
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.textAlign = "center";
    ctx.fillText(label, sx + pw / 2, y);

    ctx.font = 'bold 10px "Courier New", monospace';
    ctx.fillStyle = color;
    ctx.shadowBlur = 6;
    ctx.shadowColor = color;
    ctx.fillText(value, sx + pw / 2, y + 12);
    ctx.restore();
  }

  _drawSpeedBar(ctx, sx, y, pw, boost) {
    ctx.save();
    ctx.font = '6px "Courier New", monospace';
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.textAlign = "center";
    ctx.fillText("SPEED", sx + pw / 2, y);

    const barX = sx + 4;
    const barY = y + 6;
    const barW = pw - 8;
    const barH = 5;
    const fill = Math.min(1, (boost - 1) / 7);

    // 바 배경
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fillRect(barX, barY, barW, barH);

    // 채운 부분
    const sc = themes.active.statColors;
    const barColor = boost > 4 ? sc.combo : boost > 2 ? sc.score : themes.active.boostBorderColor;
    ctx.fillStyle = barColor;
    ctx.shadowBlur = 8;
    ctx.shadowColor = barColor;
    ctx.fillRect(barX, barY, barW * fill, barH);
    ctx.restore();
  }

  _drawGameOver(ctx, state) {
    ctx.save();
    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    ctx.fillRect(0, 0, C.CANVAS_W, C.CANVAS_H);

    const cx = C.CANVAS_W / 2;
    const cy = C.CANVAS_H / 2 - 20;

    ctx.font = 'bold 16px "Courier New", monospace';
    ctx.fillStyle = themes.active.statColors.combo;
    ctx.shadowBlur = 14;
    ctx.shadowColor = themes.active.statColors.combo;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("GAME OVER", cx, cy);

    ctx.font = '8px "Courier New", monospace';
    ctx.fillStyle = themes.active.textColor;
    ctx.shadowColor = themes.active.textColor;
    ctx.shadowBlur = 8;
    ctx.fillText(`SCORE: ${this._formatNum(state.score || 0)}`, cx, cy + 22);

    const restartAlpha = 0.5 + Math.sin(this.glowPhase * 3) * 0.5;
    ctx.globalAlpha = restartAlpha;
    ctx.font = '7px "Courier New", monospace';
    ctx.fillStyle = themes.active.statColors.score;
    ctx.shadowColor = themes.active.statColors.score;
    ctx.fillText("RESTARTING...", cx, cy + 40);

    ctx.restore();
  }

  _shapeBounds(shape) {
    let minR = Infinity, maxR = -Infinity, minC = Infinity, maxC = -Infinity;
    for (const [r, c] of shape) {
      minR = Math.min(minR, r);
      maxR = Math.max(maxR, r);
      minC = Math.min(minC, c);
      maxC = Math.max(maxC, c);
    }
    return { minR, maxR, minC, maxC };
  }

  _formatNum(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
    if (n >= 1000) return (n / 1000).toFixed(1) + "K";
    return String(n);
  }

  // === 뿌요 모드 전용 렌더링 메서드 ===

  // 뿌요 셀 렌더링: 원형 몸체 + 3D 광택 + 눈
  _drawPuyoCell(ctx, col, row, colorStr, alpha = 1.0) {
    const t = themes.active;
    const b = t.block;
    const cx = C.BOARD_X + col * C.CELL + C.CELL / 2;
    const cy = C.BOARD_Y + row * C.CELL + C.CELL / 2;
    const r = (C.CELL - 2) / 2; // 반지름 (셀 간격 여유)

    ctx.save();
    ctx.globalAlpha = alpha;

    // 테마별 글로우 효과
    if (b.glow) {
      ctx.shadowBlur = b.glowBlur;
      ctx.shadowColor = colorStr;
    }

    // 원형 몸체 (radial gradient로 3D 입체감)
    const grad = ctx.createRadialGradient(
      cx - r * 0.3, cy - r * 0.3, r * 0.1, // 좌상단 하이라이트 중심
      cx, cy, r
    );
    grad.addColorStop(0, this._lightenColor(colorStr, 0.35));
    grad.addColorStop(0.5, colorStr);
    grad.addColorStop(1, this._darkenColor(colorStr, 0.3));

    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    // 글로우 초기화 (이후 디테일에 영향 방지)
    ctx.shadowBlur = 0;

    // 좌상단 하이라이트 광택 (반달형 반사)
    ctx.beginPath();
    ctx.arc(cx - r * 0.15, cy - r * 0.15, r * 0.65, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fill();

    // 상단 반원 하이라이트 (더 작고 밝은 광택점)
    ctx.beginPath();
    ctx.arc(cx - r * 0.25, cy - r * 0.3, r * 0.3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fill();

    // 귀여운 눈 2개 (13px 셀에 최적화)
    const eyeOffX = r * 0.32;
    const eyeOffY = -r * 0.05;
    const eyeR = Math.max(1, r * 0.18);

    // 눈 흰자
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.arc(cx - eyeOffX, cy + eyeOffY, eyeR + 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + eyeOffX, cy + eyeOffY, eyeR + 0.5, 0, Math.PI * 2);
    ctx.fill();

    // 눈동자 (검정 점)
    ctx.fillStyle = '#111111';
    ctx.beginPath();
    ctx.arc(cx - eyeOffX, cy + eyeOffY, eyeR, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + eyeOffX, cy + eyeOffY, eyeR, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  // 뿌요 고스트 피스: 반투명 원형 + 점선 테두리
  _drawPuyoGhost(ctx, col, row, colorStr) {
    const cx = C.BOARD_X + col * C.CELL + C.CELL / 2;
    const cy = C.BOARD_Y + row * C.CELL + C.CELL / 2;
    const r = (C.CELL - 2) / 2;

    ctx.save();

    // 반투명 원형 채우기
    ctx.globalAlpha = 0.15;
    ctx.fillStyle = colorStr;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    // 점선 테두리
    ctx.globalAlpha = 0.3;
    ctx.strokeStyle = colorStr;
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.restore();
  }

  // 뿌요 모드 사이드 패널 (NEXT/SCORE/CHAIN/LEVEL/SPEED)
  _drawPuyoSidePanel(ctx, state) {
    const sx = C.SIDE_X;
    const sy = C.SIDE_Y;
    const pw = C.CANVAS_W - sx - 8;
    const t = themes.active;

    // 사이드 패널 배경
    ctx.save();
    ctx.fillStyle = t.boardBg;
    ctx.fillRect(sx, sy, pw, C.ROWS * C.CELL);
    ctx.strokeStyle = t.gridColor;
    ctx.lineWidth = 1;
    ctx.strokeRect(sx, sy, pw, C.ROWS * C.CELL);
    ctx.restore();

    let cy = sy + 8;

    // NEXT 뿌요 쌍 미리보기
    ctx.save();
    ctx.font = '7px "Courier New", monospace';
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = t.textColor;
    ctx.textAlign = 'center';
    ctx.fillText('NEXT', sx + pw / 2, cy);
    cy += 5;

    if (state.nextPuyoPair) {
      const puyoColors = t.puyoColors;
      const previewR = 4; // 미리보기 뿌요 반지름
      const previewCx = sx + pw / 2;

      // 위쪽 뿌요 (축 뿌요)
      const color1 = puyoColors[state.nextPuyoPair[0] % puyoColors.length];
      const py1 = cy + 8;
      const grad1 = ctx.createRadialGradient(
        previewCx - 1, py1 - 1, 1, previewCx, py1, previewR
      );
      grad1.addColorStop(0, this._lightenColor(color1, 0.3));
      grad1.addColorStop(1, color1);
      ctx.beginPath();
      ctx.arc(previewCx, py1, previewR, 0, Math.PI * 2);
      ctx.fillStyle = grad1;
      ctx.fill();

      // 아래쪽 뿌요 (회전 뿌요)
      const color2 = puyoColors[state.nextPuyoPair[1] % puyoColors.length];
      const py2 = py1 + previewR * 2 + 2;
      const grad2 = ctx.createRadialGradient(
        previewCx - 1, py2 - 1, 1, previewCx, py2, previewR
      );
      grad2.addColorStop(0, this._lightenColor(color2, 0.3));
      grad2.addColorStop(1, color2);
      ctx.beginPath();
      ctx.arc(previewCx, py2, previewR, 0, Math.PI * 2);
      ctx.fillStyle = grad2;
      ctx.fill();

      cy = py2 + previewR + 12;
    } else {
      cy += 25;
    }
    ctx.restore();

    // 통계 (테마 색상)
    const sc = t.statColors;
    this._drawStat(ctx, sx, cy, pw, 'SCORE', this._formatNum(state.score || 0), sc.score);
    cy += 28;
    this._drawStat(ctx, sx, cy, pw, 'CHAIN', String(state.maxChain || 0), sc.lines);
    cy += 28;
    this._drawStat(ctx, sx, cy, pw, 'COMBO', 'x' + (state.combo || 0), sc.combo);
    cy += 28;
    this._drawStat(ctx, sx, cy, pw, 'LEVEL', String(state.level || 1), sc.level);
    cy += 28;

    // 속도 바
    this._drawSpeedBar(ctx, sx, cy, pw, state.boost || 1);
  }

  // 연쇄 텍스트 이펙트 렌더링
  _drawChainText(ctx, chainCount, x, y, progress) {
    const t = themes.active;
    const pool = t.neonPool;
    const color = pool[chainCount % pool.length];

    // 크기: 1~3체인 작게, 4+ 크게
    const baseSize = chainCount >= 4 ? 14 : 10;
    // 스케일: 처음 확대, 점점 축소
    const scale = 1 + (1 - progress) * 0.5;
    const fontSize = Math.round(baseSize * scale);
    // 페이드아웃 + 위로 이동
    const alpha = Math.max(0, 1 - progress);
    const offsetY = -30 * progress;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = `bold ${fontSize}px "Courier New", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // 4+ 체인: 강화 글로우
    if (chainCount >= 4) {
      ctx.shadowBlur = 16 + (1 - progress) * 10;
      ctx.shadowColor = color;
    } else {
      ctx.shadowBlur = 8;
      ctx.shadowColor = color;
    }

    ctx.fillStyle = color;
    ctx.fillText(chainCount + ' CHAIN!', x, y + offsetY);

    // 4+ 체인: 이중 글로우 (외곽 후광)
    if (chainCount >= 4) {
      ctx.globalAlpha = alpha * 0.4;
      ctx.shadowBlur = 24;
      ctx.fillText(chainCount + ' CHAIN!', x, y + offsetY);
    }

    ctx.restore();
  }

  // 색상 밝게 (radial gradient용)
  _lightenColor(color, amount) {
    const c = this._parseColor(color);
    if (!c) return color;
    const r = Math.min(255, c.r + (255 - c.r) * amount);
    const g = Math.min(255, c.g + (255 - c.g) * amount);
    const b = Math.min(255, c.b + (255 - c.b) * amount);
    return `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${c.a})`;
  }

  // 색상 어둡게 (radial gradient용)
  _darkenColor(color, amount) {
    const c = this._parseColor(color);
    if (!c) return color;
    const r = c.r * (1 - amount);
    const g = c.g * (1 - amount);
    const b = c.b * (1 - amount);
    return `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${c.a})`;
  }

  // 색상 문자열 파싱 (#hex 또는 rgba) — 메모이제이션 적용
  _parseColor(color) {
    const cached = _colorParseCache.get(color);
    if (cached !== undefined) return cached;
    let result = null;
    // #hex 형식
    if (color.startsWith('#')) {
      let hex = color.slice(1);
      if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
      result = {
        r: parseInt(hex.substr(0, 2), 16),
        g: parseInt(hex.substr(2, 2), 16),
        b: parseInt(hex.substr(4, 2), 16),
        a: 1,
      };
    } else {
      // rgba() 형식
      const m = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)/);
      if (m) {
        result = {
          r: parseInt(m[1]),
          g: parseInt(m[2]),
          b: parseInt(m[3]),
          a: m[4] !== undefined ? parseFloat(m[4]) : 1,
        };
      }
    }
    _colorParseCache.set(color, result);
    return result;
  }
}
