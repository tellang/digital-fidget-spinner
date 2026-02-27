// === 바닐라 JS 파일을 Node.js 컨텍스트에 순서대로 로드 ===
const fs = require("fs");
const path = require("path");
const vm = require("vm");

require("./setup");

const jsDir = path.join(__dirname, "..", "js");

const loadOrder = [
  "themes.js",
  "settings.js",
  "constants.js",
  "board.js",
  "puyo-constants.js",
  "puyo-board.js",
  "puyo-ai.js",
  "effects.js",
  "input.js",
  "ai.js",
  "renderer.js",
  "game.js",
];

// 전처리: class/const/function 선언을 globalThis에 바인딩
function preprocess(code) {
  return code
    // class Foo { → globalThis.Foo = class Foo {
    .replace(/^class\s+(\w+)/gm, "globalThis.$1 = class $1")
    // const foo = new/{ → globalThis.foo = new/{
    .replace(/^const\s+(\w+)\s*=\s*/gm, "globalThis.$1 = ")
    // function foo( → globalThis.foo = function foo(
    .replace(/^function\s+(\w+)\s*\(/gm, "globalThis.$1 = function $1(");
}

for (const file of loadOrder) {
  const raw = fs.readFileSync(path.join(jsDir, file), "utf8");
  const code = preprocess(raw);
  try {
    const script = new vm.Script(code, { filename: file });
    script.runInThisContext();
  } catch (e) {
    console.error(`로드 실패: ${file}`, e.message);
  }
}

module.exports = {
  ThemeRegistry: globalThis.ThemeRegistry,
  Settings: globalThis.Settings,
  Board: globalThis.Board,
  PuyoBoard: globalThis.PuyoBoard,
  PuyoAI: globalThis.PuyoAI,
  PUYO: globalThis.PUYO,
  Particle: globalThis.Particle,
  ParticleSystem: globalThis.ParticleSystem,
  ScreenShake: globalThis.ScreenShake,
  FlashEffect: globalThis.FlashEffect,
  ChainDisplay: globalThis.ChainDisplay,
  InputHandler: globalThis.InputHandler,
  ChatDisplay: globalThis.ChatDisplay,
  AI: globalThis.AI,
  Renderer: globalThis.Renderer,
  Game: globalThis.Game,
  themes: globalThis.themes,
  settings: globalThis.settings,
  C: globalThis.C,
  getCells: globalThis.getCells,
  getGhostY: globalThis.getGhostY,
  boardSafeRows: globalThis.boardSafeRows,
};
