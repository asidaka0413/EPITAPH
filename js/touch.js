// スマホなどのタッチ画面で、画面の下に出す操作ボタン(十字キー・決定・戻る など)
// index.html から <script src> で読み込まれる(読み込む順番は index.html に書いてある)
//   ボタンを押すと、キーボードのキーを押したのと同じ動きをする(input.js の pressKey を呼ぶ)
//   パソコン(マウスがある画面)では出さない

// ==================== 操作ボタン ====================
// ボタンを増やすときは、TOUCH_BUTTONS に足す
//   key:押したときのキー(input.js の pressKey に渡す。KEY_ALIASES で置き換えたあとの名前。E で持ち物なら "i")
//   label:ボタンの文字 / area:"pad"(左の十字キー)か "act"(右のボタン)
//   pos:(十字キーだけ)3×3 のマスのどこに置くか [列, 行]
//   repeat:true なら、押しっぱなしで続けて押したことにする(移動・待つ)
//   hold:true なら、離したときに長押しを取り消す(自害)
//   cls:見た目を変えるときの CSS のクラス名
const TOUCH_BUTTONS = [
  // 十字キー(真ん中は「待つ」)
  { key: "ArrowUp",    label: "▲",   area: "pad", pos: [2, 1], repeat: true },
  { key: "ArrowLeft",  label: "◀",   area: "pad", pos: [1, 2], repeat: true },
  { key: "z",          label: "待つ", area: "pad", pos: [2, 2], repeat: true, cls: "small" },
  { key: "ArrowRight", label: "▶",   area: "pad", pos: [3, 2], repeat: true },
  { key: "ArrowDown",  label: "▼",   area: "pad", pos: [2, 3], repeat: true },
  // 右のボタン(2列に並ぶ)
  { key: "Enter",  label: "決定",   area: "act", cls: "main" },
  { key: "Escape", label: "戻る",   area: "act" },
  { key: "i",      label: "持ち物", area: "act" },
  { key: "h",      label: "回復薬", area: "act" },
  { key: "f",      label: "視界",   area: "act" },
  { key: "r",      label: "弓で撃つ", area: "act", cls: "small" }, // 押すと狙う → 十字キーで撃つ
  { key: "x",      label: "自害(長押し)", area: "act", hold: true, cls: "danger-btn" },
];

let touchRepeatTimer = null; // 押しっぱなしで続けて押すためのタイマー

// タッチ画面か(スマホ・タブレット。マウスがなく、指で操作する画面)
function isTouchDevice() {
  return !!window.matchMedia && window.matchMedia("(hover: none) and (pointer: coarse)").matches;
}

// 起動したときに1回だけ呼ぶ:タッチ画面なら、画面の下に操作ボタンを作る
function initTouchPad() {
  if (!isTouchDevice()) return;
  document.body.classList.add("touch"); // ボタンの分だけ、ページの下に余白をあける(style.css)
  const pad = document.createElement("div");
  pad.id = "touch-pad";
  const dpad = document.createElement("div");
  dpad.className = "touch-dpad";
  const act = document.createElement("div");
  act.className = "touch-act";
  for (const b of TOUCH_BUTTONS) {
    const btn = document.createElement("button");
    btn.textContent = b.label;
    btn.className = `touch-btn ${b.cls || ""}`;
    if (b.pos) {
      btn.style.gridColumn = b.pos[0];
      btn.style.gridRow = b.pos[1];
    }
    // 指が触れた瞬間に押したことにする(離したときではなく)。preventDefault で、画面のスクロールや拡大を起こさない
    btn.addEventListener("pointerdown", (e) => { e.preventDefault(); touchPress(b, btn); });
    const release = () => touchRelease(b, btn);
    btn.addEventListener("pointerup", release);
    btn.addEventListener("pointercancel", release);
    btn.addEventListener("pointerleave", release); // 押したまま指がボタンの外に出たら、離したことにする
    btn.addEventListener("contextmenu", (e) => e.preventDefault()); // 長押しで出るメニューを出さない
    (b.area === "pad" ? dpad : act).appendChild(btn);
  }
  pad.append(dpad, act);
  document.body.appendChild(pad);
}

// ボタンを押したとき:そのキーを1回押す。repeat のボタンは、少し待ってから続けて押す
function touchPress(b, btn) {
  stopTouchRepeat();
  btn.classList.add("pressed");
  hideTooltip(); // マップをタップして出した詳細ウィンドウは消す(動いたあとも古い場所のが残らないように)
  pressKey(b.key, false);
  if (b.repeat) {
    const loop = () => {
      pressKey(b.key, true); // 押しっぱなしの扱い(input.js で、速さの制限・敵がとなりなら止まる)
      touchRepeatTimer = setTimeout(loop, BALANCE.moveRepeatMs);
    };
    touchRepeatTimer = setTimeout(loop, BALANCE.touchRepeatDelayMs);
  }
}

// ボタンを離したとき:続けて押すのをやめる。自害の長押しは取り消す
function touchRelease(b, btn) {
  btn.classList.remove("pressed");
  if (b.repeat) stopTouchRepeat();
  if (b.hold) cancelGiveUp();
}

function stopTouchRepeat() {
  if (touchRepeatTimer) clearTimeout(touchRepeatTimer);
  touchRepeatTimer = null;
}

// ==================== 右上の引き出し ====================
// 幅の狭い画面(スマホ)では、右の列(装備・依頼・ログ・設定)を隠しておき、右上の [≡] をタップすると右から出てくる
// 見た目は style.css の「スマホなど、幅の狭い画面」。パソコンの広い画面では [≡] は出ない
//   open:true なら開く / false なら閉じる / 省略すると開け閉めを切り替える
function toggleSideDrawer(open) {
  const willOpen = open === undefined ? !document.body.classList.contains("side-open") : open;
  document.body.classList.toggle("side-open", willOpen);
  hideTooltip(); // マップをタップして出した詳細ウィンドウは消す
}
