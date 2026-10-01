// どこからでも使う小さな道具(乱数・表示用の関数・ログ・マップの検索)
// index.html から <script src> で読み込まれる(読み込む順番は index.html に書いてある)

// ==================== ユーティリティ ====================
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// 小数を1桁に丸めて表示用の文字にする(0.6000000001 → "0.6")
function fmt(n) {
  return String(Math.round(n * 10) / 10);
}

// 画面に文字を出すとき、< や & などが HTML として解釈されないように変換する
function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// 色つきの文字(cls は CSS のクラス名)
function span(cls, text) {
  return `<span class="${cls}">${esc(text)}</span>`;
}

// 一覧のカーソル(選んでいる行には ▶)。幅を固定して、選んだ行の文字がずれないようにする
function cursorMark(isSel) {
  return `<span class="cur">${isSel ? "▶" : ""}</span>`;
}

// 冒険ごとにリセットされる状態(レベルは base にあるのでリセットされない)
function resetPlayerStats() {
  potions = BALANCE.startPotions;
  equipped = {};
  runPickups = [];
  invTab = 0;
  invCursor = 0;
  invPickSlot = null;
  maxHP = getPlayerStats().hp;
  playerHP = maxHP;
  playerDots = {};
  runTools = [];
  playerBuffs = {};
  playerWeak = null;
  playerSlow = null;
  facing = null;
}

// ==================== ログ ====================
function addLog(text) {
  logLines.push({ text, turn });
  // 古い行から捨てて、決まった行数だけ残す
  if (logLines.length > BALANCE.logMaxLines) logLines.shift();
  drawLog();
}

function clearLog() {
  logLines = [];
  drawLog();
}

function drawLog() {
  const el = document.getElementById("log");
  el.innerHTML = "";
  for (const line of logLines) {
    const div = document.createElement("div");
    div.textContent = line.text;
    // 今のターンの出来事は黄色、それより前は灰色
    div.className = line.turn === turn ? "log-new" : "log-old";
    el.appendChild(div);
  }
  el.scrollTop = el.scrollHeight; // いちばん下(最新)までスクロール
}

// ==================== 検索ヘルパー ====================
function monsterAt(x, y) {
  return monsters.find(m => m.x === x && m.y === y) || null;
}
function itemAt(x, y) {
  return items.find(i => i.x === x && i.y === y) || null;
}
