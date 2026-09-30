// キー操作・自害(X 長押し)・起動
// index.html から <script src> で読み込まれる(読み込む順番は index.html に書いてある)

// ==================== 入力処理 ====================
// 別のキーでも同じ操作ができるようにする(押されたキー → 同じ働きをするキー)
//   ここに足せば、すべての画面で使えるようになる
const KEY_ALIASES = {
  w: "ArrowUp", a: "ArrowLeft", s: "ArrowDown", d: "ArrowRight", // WASD で移動
  W: "ArrowUp", A: "ArrowLeft", S: "ArrowDown", D: "ArrowRight",
  " ": "Enter",           // スペースで決定
  Backspace: "Escape",    // バックスペースで戻る
  q: "Escape", Q: "Escape", // Q でも戻る
  e: "i", E: "i",         // E で持ち物
};

let lastRepeatMoveAt = 0; // 押しっぱなしで最後に動いた時刻(ミリ秒)

// ==================== 自害(X キー長押し) ====================
// ダンジョンで X を giveUpHoldMs ミリ秒押し続けると、その冒険を終わらせる(死因は「自害」)
//   途中で離すと取り消し。墓は建つが、倒した敵がいないので墓守は出ない
let giveUpStartAt = 0;   // 押し始めた時刻(押していないときは 0)
let giveUpTimer = null;  // 押している間、進み具合を描き直すためのタイマー

function giveUpProgress() {
  return giveUpStartAt ? Math.min(1, (performance.now() - giveUpStartAt) / BALANCE.giveUpHoldMs) : 0;
}

function startGiveUp() {
  if (giveUpStartAt || screenMode !== "dungeon") return;
  giveUpStartAt = performance.now();
  giveUpTimer = setInterval(() => {
    if (screenMode !== "dungeon") { cancelGiveUp(); return; }
    if (giveUpProgress() >= 1) {
      cancelGiveUp();
      runStats.killedBy = "自害";
      runStats.killedById = null;
      playerHP = 0;
      addLog("もう、ここまでだ…");
      handlePlayerDeath();
      return;
    }
    drawStatus();
  }, 50);
  drawStatus();
}

function cancelGiveUp() {
  giveUpStartAt = 0;
  if (giveUpTimer) clearInterval(giveUpTimer);
  giveUpTimer = null;
  if (screenMode === "dungeon" || screenMode === "inventory" || screenMode === "camp") drawStatus();
}

document.addEventListener("keyup", (e) => {
  if (e.key === "x" || e.key === "X") cancelGiveUp();
});
window.addEventListener("blur", cancelGiveUp); // ほかのウィンドウに切り替えたら取り消し

document.addEventListener("keydown", (e) => {
  const key = KEY_ALIASES[e.key] || e.key;
  // 矢印キー・スペース・バックスペースで、ページがスクロールしたり戻ったりしないようにする
  if (key.startsWith("Arrow") || key === "Enter" || key === "Escape") e.preventDefault();
  // X を押し始めたら自害のカウント開始(押しっぱなしの繰り返しは無視)
  if (key === "x" || key === "X") {
    if (!e.repeat) startGiveUp();
    return;
  }
  // ダンジョンで移動キーを押しっぱなしにしたとき(e.repeat)
  //   ・moveRepeatMs ミリ秒に1回までしか動かない(速く動きすぎないように)
  //   ・敵が隣にいたら止まる(押しっぱなしのまま敵に突っこまないように。攻撃するときは押し直す)
  if (e.repeat && screenMode === "dungeon" && key.startsWith("Arrow")) {
    const now = performance.now();
    if (now - lastRepeatMoveAt < BALANCE.moveRepeatMs) return;
    if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => monsterAt(px + dx, py + dy))) return;
    lastRepeatMoveAt = now;
  }
  handleKey({ key });
});

// キー操作の本体(key は KEY_ALIASES で置き換えたあとのキー)
function handleKey(e) {
  if (screenMode === "town") {
    townKey(e);
    return;
  }

  if (screenMode === "result") {
    if (e.key === "Enter") leaveResult();
    return;
  }

  if (screenMode === "refine") {
    // 持ち物タブで、部位をまだ選んでいないときは、部位の一覧を動く
    const pickingType = REFINE_TABS[refineTab].id === "spare" && !refineType;
    const rows = pickingType ? Object.keys(ITEM_TYPES).length : refineList().length;
    if (e.key === "ArrowUp") {
      refineCursor = Math.max(0, refineCursor - 1);
    } else if (e.key === "ArrowDown") {
      refineCursor = Math.max(0, Math.min(rows - 1, refineCursor + 1));
    } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      switchRefineTab(e.key === "ArrowRight" ? 1 : -1);
    } else if (e.key === "Enter" && pickingType) {
      // 部位を選ぶ(その部位の装備を持っていれば)
      const type = Object.keys(ITEM_TYPES)[refineCursor];
      if (refineSpare(type).length > 0) { refineType = type; refineCursor = 0; }
    } else if (e.key === "Enter") {
      refineSelected();
      return;
    } else if (e.key === "Escape" && refineType) {
      // 部位の一覧に戻る
      refineCursor = Object.keys(ITEM_TYPES).indexOf(refineType);
      refineType = null;
    }
    render();
    return;
  }

  if (screenMode === "inventory") {
    // 装備タブで、枠に着ける装備を選んでいる最中
    if (invPickSlot) {
      const count = equipChoices(invPickSlot).length;
      if (e.key === "ArrowUp") invPickCursor = Math.max(0, invPickCursor - 1);
      else if (e.key === "ArrowDown") invPickCursor = Math.min(count - 1, invPickCursor + 1);
      else if (e.key === "Enter") { equipSelected(); return; }
      else if (e.key === "Escape") invPickSlot = null;
      render();
      return;
    }
    if (e.key === "ArrowUp") {
      invCursor = Math.max(0, invCursor - 1);
      render();
    } else if (e.key === "ArrowDown") {
      invCursor = Math.min(invTabItems().length - 1, invCursor + 1);
      clampInvCursor();
      render();
    } else if (e.key === "ArrowLeft") {
      switchInvTab(-1);
    } else if (e.key === "ArrowRight") {
      switchInvTab(1);
    } else if (e.key === "Enter") {
      if (INV_TABS[invTab].id === "equip") openEquipPicker();
      else if (INV_TABS[invTab].id === "tool") useToolSelected();
    } else if (e.key === "i" || e.key === "I" || e.key === "Escape") {
      closeInventory();
    }
    return;
  }

  if (screenMode === "camp" && campPicking) {
    const count = campEquipList().length;
    if (e.key === "ArrowUp") campPickCursor = Math.max(0, campPickCursor - 1);
    else if (e.key === "ArrowDown") campPickCursor = Math.min(count - 1, campPickCursor + 1);
    else if (e.key === "Enter") { chooseCamp(); return; }
    else if (e.key === "Escape") campPicking = false;
    render();
    return;
  }

  if (screenMode === "camp") {
    if (e.key === "ArrowUp") {
      campCursor = Math.max(0, campCursor - 1);
      render();
    } else if (e.key === "ArrowDown") {
      campCursor = Math.min(CAMP_OPTIONS.length - 1, campCursor + 1);
      render();
    } else if (e.key === "Enter") {
      chooseCamp();
    } else if (e.key === "i" || e.key === "I") {
      openInventory();
    }
    return;
  }

  if (e.key === "i" || e.key === "I") {
    openInventory();
    return;
  }

  if (e.key === "h" || e.key === "H") {
    usePotion();
    return;
  }

  let dx = 0, dy = 0;
  if (e.key === "ArrowUp") dy = -1;
  if (e.key === "ArrowDown") dy = 1;
  if (e.key === "ArrowLeft") dx = -1;
  if (e.key === "ArrowRight") dx = 1;
  if (dx === 0 && dy === 0) return;

  tryMove(dx, dy);
}

// ==================== 起動 ====================
if (typeof EQUIPMENT_DATA === "undefined" || typeof MONSTER_DATA === "undefined" || typeof BOOK_DATA === "undefined"
    || typeof BLESSING_DATA === "undefined" || typeof CURSE_DATA === "undefined") {
  document.getElementById("screen").textContent =
    "equipment.js・monsters.js・books.js・effects.js のどれかが読み込めませんでした。index.html と同じ場所の data フォルダにあるか確認してください。";
} else {
  // メイン画面の大きさを、マップの大きさ(文字数 × 行数)に固定する
  //   ch は文字1個分の幅、em は文字の高さ。1.15 はマップの行の高さ(CSS の line-height)
  const screenEl = document.getElementById("screen");
  screenEl.style.width = `${BALANCE.mapWidth}ch`;
  screenEl.style.height = `${BALANCE.mapHeight * 1.15}em`;

  const warnings = loadGameData();
  addLog(loadGame()); // セーブデータを読み込む
  warnings.forEach(addLog);
  // 拠点から始める(読み込んだ刻印を、潜る前にセットできるように)
  goToTown();
  render();
}
