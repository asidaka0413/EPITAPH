// キー操作・自害(X 長押し)・起動(スマホの操作ボタンは js/touch.js。押されると、ここの pressKey を呼ぶ)
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
  if (inRunScreen()) drawStatus();
}

document.addEventListener("keyup", (e) => {
  if (e.key === "x" || e.key === "X") cancelGiveUp();
});
window.addEventListener("blur", cancelGiveUp); // ほかのウィンドウに切り替えたら取り消し

document.addEventListener("keydown", (e) => {
  // Ctrl・Alt などと一緒に押したキーは、ブラウザの操作(Ctrl+S など)なので無視する(S で動いてしまわないように)
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const key = KEY_ALIASES[e.key] || e.key;
  // 矢印キー・スペース・バックスペースで、ページがスクロールしたり戻ったりしないようにする
  if (key.startsWith("Arrow") || key === "Enter" || key === "Escape") e.preventDefault();
  pressKey(key, e.repeat);
});

// キーが押されたとき(キーボードでも、スマホの操作ボタン(js/touch.js)でも、ここを通る)
//   key:KEY_ALIASES で置き換えたあとのキー / repeat:押しっぱなしの繰り返しなら true
function pressKey(key, repeat) {
  if (playerDying) return; // 自分が砕け散っているあいだは、何もしない
  if (refineFinishing) return; // 最後に刻んだ光を見せているあいだも、何もしない(js/items.js)
  // 押しっぱなしの Enter / Space は無視する(分かれ道 → キャンプ、リザルト → 刻む が勝手に決まらないように)
  if (repeat && key === "Enter") return;
  // 分かれ道・キャンプ・宝の地図の入れ替えでは、押しっぱなしの矢印も無視する(移動キーを押したまま階段に乗ったとき、選んでいる道が動かないように)
  if (repeat && ["route", "camp", "swap"].includes(screenMode) && key.startsWith("Arrow")) return;
  // 弓:押しっぱなしの R・狙っているあいだの押しっぱなしは無視する(移動キーを押したまま R を押して、勝手に撃たないように)
  if (repeat && (key === "r" || key === "R" || bowAiming)) return;
  // X を押し始めたら自害のカウント開始(押しっぱなしの繰り返しは無視)
  if (key === "x" || key === "X") {
    if (!repeat) startGiveUp();
    return;
  }
  // F で、敵の視界と攻撃範囲の表示を切り替える(ダンジョンだけ。押しっぱなしの繰り返しは無視)
  //   拠点の図鑑では、武器のジャンルの絞りこみ(js/town.js の dexCycleWeaponKind)
  if (key === "f" || key === "F") {
    if (!repeat && screenMode === "dungeon") {
      threatView = !threatView;
      render();
    } else if (!repeat && screenMode === "town" && townPage === "dex") {
      dexCycleWeaponKind();
    }
    return;
  }
  // ダンジョンで移動キー・ターンスキップを押しっぱなしにしたとき(repeat)
  //   ・moveRepeatMs ミリ秒に1回までしか動かない(速く動きすぎないように)
  //   ・敵が隣にいたら止まる(押しっぱなしのまま敵に突っこまないように。攻撃するときは押し直す)
  if (repeat && screenMode === "dungeon" && (key.startsWith("Arrow") || isWaitKey(key))) {
    const now = performance.now();
    if (now - lastRepeatMoveAt < BALANCE.moveRepeatMs) return;
    // (宝箱に化けたミミックでは止まらない。止まると正体がばれてしまうため)
    if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const m = monsterAt(px + dx, py + dy); return m && !m.disguised; })) return;
    // 進む先が毒沼・マグマなら止まる(踏むときは押し直す)。もう上にいるときは止まらない(抜け出せるように)
    const step = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[key];
    if (step && hazardAt(px + step[0], py + step[1]) && !hazardAt(px, py)) return;
    lastRepeatMoveAt = now;
  }
  handleKey({ key });
  checkAchievements(); // 実績の条件を満たしたか
}

// ターンスキップのキーか(Z か .)
function isWaitKey(key) {
  return key === "z" || key === "Z" || key === ".";
}

// キー操作の本体(key は KEY_ALIASES で置き換えたあとのキー)
function handleKey(e) {
  // デバッグのサウンドテスト(js/debug.js)
  if (screenMode === "soundtest") {
    soundTestKey(e);
    return;
  }

  if (screenMode === "town") {
    townKey(e);
    return;
  }

  if (screenMode === "result") {
    if (e.key === "Enter") leaveResult();
    return;
  }

  if (screenMode === "refine" && refineDiscardFor) {
    // 刻印がいっぱいで、代わりに解体する刻印を選んでいる最中(Esc で刻む装備を選び直す)
    const count = discardChoices().length;
    if (e.key === "ArrowUp") refineDiscardCursor = Math.max(0, refineDiscardCursor - 1);
    else if (e.key === "ArrowDown") refineDiscardCursor = Math.min(count - 1, refineDiscardCursor + 1);
    else if (e.key === "Enter") { chooseDiscard(); return; }
    else if (e.key === "Escape") refineDiscardFor = null;
    render();
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

  // 宝の地図の入れ替え(道具の枠 + いちばん下に「拾わない」)
  if (screenMode === "swap") {
    if (e.key === "ArrowUp") swapCursor = Math.max(0, swapCursor - 1);
    else if (e.key === "ArrowDown") swapCursor = Math.min(runTools.length, swapCursor + 1);
    else if (e.key === "Enter") { chooseSwap(); return; }
    else if (e.key === "Escape") { swapCursor = runTools.length; chooseSwap(); return; }
    render();
    return;
  }

  // 階段の道を選ぶ画面
  if (screenMode === "route") {
    if (e.key === "ArrowUp") routeCursor = Math.max(0, routeCursor - 1);
    else if (e.key === "ArrowDown") routeCursor = Math.min(routeChoices.length - 1, routeCursor + 1);
    else if (e.key === "Enter") { chooseRoute(); return; }
    render();
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

  // 弓で狙っているあいだ:方向キーで撃つ。ほかのキーならやめる(js/combat.js)
  if (bowAiming) {
    handleBowAim(e.key);
    return;
  }

  // R で弓を狙う
  if (e.key === "r" || e.key === "R") {
    startBowAim();
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

  // Z / . でターンスキップ(その場で1ターン待つ。敵は動く)
  if (isWaitKey(e.key)) {
    waitTurn();
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
    || typeof BLESSING_DATA === "undefined" || typeof CURSE_DATA === "undefined" || typeof CLAN_DATA === "undefined" || typeof HELP_PAGES === "undefined" || typeof ELEMENT_DATA === "undefined"
    || typeof ACHIEVEMENT_DATA === "undefined") {
  document.getElementById("screen").textContent =
    "equipment.js・monsters.js・books.js・effects.js・sets.js・elements.js・help.js・achievements.js のどれかが読み込めませんでした。index.html と同じ場所の data フォルダにあるか確認してください。";
} else {
  // メイン画面の大きさを、マップの大きさ(文字数 × 行数)に固定する
  //   ch は文字1個分の幅、em は文字の高さ。1.15 はマップの行の高さ(CSS の line-height)
  const screenEl = document.getElementById("screen");
  screenEl.style.width = `${BALANCE.mapWidth}ch`;
  screenEl.style.height = `${BALANCE.mapHeight * 1.15}em`;

  initTooltip(); // マップにマウスを合わせたときの詳細ウィンドウ
  initTouchPad(); // スマホなどのタッチ画面なら、画面の下に操作ボタンを出す

  const warnings = loadGameData();
  addLog(loadGame()); // セーブデータを読み込む
  warnings.forEach(addLog);
  // 拠点から始める(読み込んだ刻印を、潜る前にセットできるように)
  goToTown();
  checkAchievements(); // これまでの記録で、もう取れている実績
  render();
}
