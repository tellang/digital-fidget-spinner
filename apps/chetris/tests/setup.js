// === 테스트 환경 셋업: 브라우저 API 모킹 ===
// Node.js에서 Canvas/DOM 없이 CHATRIS 코드를 테스트하기 위한 최소 모킹

class MockCanvas {
  constructor(w = 164, h = 252) {
    this.width = w;
    this.height = h;
    this._ctx = new MockContext();
  }
  getContext() { return this._ctx; }
}

class MockContext {
  constructor() {
    this._saves = 0;
    this._restores = 0;
    this._drawCalls = 0;
    this._strokeCalls = 0;
    this.fillStyle = "";
    this.strokeStyle = "";
    this.globalAlpha = 1;
    this.shadowBlur = 0;
    this.shadowColor = "";
    this.lineWidth = 1;
    this.font = "";
    this.textAlign = "";
    this.textBaseline = "";
  }
  save() { this._saves++; }
  restore() { this._restores++; }
  fillRect() { this._drawCalls++; }
  strokeRect() { this._strokeCalls++; }
  fillText() { this._drawCalls++; }
  clearRect() { this._drawCalls++; }
  beginPath() {}
  moveTo() {}
  lineTo() {}
  stroke() { this._strokeCalls++; }
  fill() { this._drawCalls++; }
  arc() {}
  closePath() {}
  quadraticCurveTo() {}
  translate() {}
  setLineDash() {}
  drawImage() { this._drawCalls++; }
  createRadialGradient() {
    return { addColorStop() {} };
  }
  set filter(_) {}
  get filter() { return ""; }

  // 테스트 유틸: 카운터 리셋
  _reset() {
    this._saves = 0;
    this._restores = 0;
    this._drawCalls = 0;
    this._strokeCalls = 0;
  }
}

class MockElement {
  constructor(id) {
    this.id = id;
    this.style = {};
    this.classList = {
      _set: new Set(),
      add(c) { this._set.add(c); },
      remove(c) { this._set.delete(c); },
      toggle(c, force) {
        if (force !== undefined) {
          force ? this._set.add(c) : this._set.delete(c);
        } else {
          this._set.has(c) ? this._set.delete(c) : this._set.add(c);
        }
      },
      contains(c) { return this._set.has(c); },
    };
    this.children = [];
    this.textContent = "";
    this.innerHTML = "";
    this.dataset = {};
  }
  getAttribute() { return null; }
  setAttribute() {}
  addEventListener() {}
  removeEventListener() {}
  querySelector() { return null; }
  querySelectorAll() { return []; }
  contains() { return false; }
  focus() {}
}

// 글로벌 브라우저 API 모킹
globalThis.document = {
  _elements: {},
  getElementById(id) {
    if (!this._elements[id]) this._elements[id] = new MockElement(id);
    return this._elements[id];
  },
  createElement(tag) {
    const el = new MockElement(tag);
    if (tag === "canvas") return new MockCanvas();
    return el;
  },
  addEventListener() {},
  removeEventListener() {},
  body: new MockElement("body"),
  documentElement: { style: { setProperty() {} } },
};

globalThis.window = {
  addEventListener() {},
  removeEventListener() {},
  focus() {},
  innerWidth: 174,
  innerHeight: 288,
  __TAURI__: null,
};

globalThis.localStorage = {
  _data: {},
  getItem(k) { return this._data[k] || null; },
  setItem(k, v) { this._data[k] = v; },
  removeItem(k) { delete this._data[k]; },
  clear() { this._data = {}; },
};

globalThis.performance = {
  now() { return Date.now(); },
};

// 테스트 환경: setTimeout 즉시 실행 (크로스페이드 등 타이머 기반 코드 검증용)
const _origSetTimeout = globalThis.setTimeout;
globalThis.setTimeout = (fn, ms) => {
  if (typeof fn === "function") fn();
  return 0;
};

globalThis.console = globalThis.console || {
  log() {}, error() {}, warn() {},
};

module.exports = { MockCanvas, MockContext, MockElement };
