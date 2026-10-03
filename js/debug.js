// デバッグ用のボタン
// index.html から <script src> で読み込まれる(読み込む順番は index.html に書いてある)

// ==================== デバッグ ====================
// デバッグモード(拠点の「設定」で ON)のときだけ、画面右にボタンを出す
//   ボタンを増やしたいときは、DEBUG_ACTIONS に { name, when, run } を足す
//   when:"any"(いつでも)/ "dungeon"(ダンジョンにいるときだけ)
const DEBUG_ACTIONS = [
  { name: "スキルポイント +50", when: "any", run: () => { base.skillPoints += 50; } },
  { name: "経験値 +100", when: "any", run: () => { base.xp += 100; checkLevelUp(); } },
  { name: "素材 全種類 +100", when: "any", run: () => { for (const id in RESOURCE_TYPES) base.resources[id] += 100; } },
  { name: "ゴールド +1000", when: "any", run: () => { base.gold += 1000; } },
  { name: "酒場の依頼を入れ替える", when: "any", run: () => { refreshQuestBoard(true); addLog("[デバッグ] 酒場の掲示板を新しくした"); } },
  { name: "サウンドテスト", when: "any", run: () => { openSoundTest(); } },
  { name: "テスト層に入る(敵のいない大部屋)", when: "any", run: () => {
    // 何階の強さにするかを聞く(拠点からなら、新しく冒険を始めてから入る)
    if (screenMode !== "town" && screenMode !== "dungeon") { addLog("[デバッグ] 拠点かダンジョンで押してください"); return; }
    const input = prompt(`何階の強さのテスト層に入る？(1〜${BALANCE.goalDepth})`, String(screenMode === "town" ? 90 : depth));
    const d = Math.floor(Number(input));
    if (!input || !(d >= 1)) return;
    if (screenMode === "town") startNewRun();
    enterTestFloor(Math.min(BALANCE.goalDepth, d));
  } },
  { name: "HP全回復", when: "dungeon", run: () => { playerHP = maxHP; } },
  { name: "近い敵に最大HPの10%ダメージ", when: "dungeon", run: () => { debugHurtNearest(0.1); } },
  { name: "近い敵に最大HPの50%ダメージ", when: "dungeon", run: () => { debugHurtNearest(0.5); } },
  { name: "近い敵に最大HPの90%ダメージ", when: "dungeon", run: () => { debugHurtNearest(0.9); } },
  { name: "凍える(10ターン)", when: "dungeon", run: () => { ailPlayer("chill", 10); } },
  { name: "しびれる(10ターン)", when: "dungeon", run: () => { ailPlayer("shock", 10); } },
  { name: "選んだ敵を近くに出す", when: "dungeon", run: () => {
    // 横の一覧で選んだ敵を1体、プレイヤーから少し離れた床に出す
    const data = monsterList.find(m => m.id === debugSpawnId) || monsterList[0];
    if (!data) return;
    for (let r = 3; r <= 8; r++) {
      const spots = [[r, 0], [-r, 0], [0, r], [0, -r]].map(([dx, dy]) => [px + dx, py + dy])
        .filter(([x, y]) => map[y] && map[y][x] === "." && !monsterAt(x, y));
      if (spots.length === 0) continue;
      const [x, y] = spots[0];
      monsters.push(newMonster(data, x, y));
      addLog(`[デバッグ] ${data.name}を出した`);
      return;
    }
  } },
  { name: "宝箱を近くに置く", when: "dungeon", run: () => {
    // プレイヤーのとなりの空いている床に、宝箱を1つ置く
    const spot = DIRS4.map(([dx, dy]) => [px + dx, py + dy])
      .find(([x, y]) => map[y] && map[y][x] === "." && !monsterAt(x, y) && !itemAt(x, y) && !chestAt(x, y));
    if (!spot) { addLog("[デバッグ] となりに空いている床がない"); return; }
    chests.push({ x: spot[0], y: spot[1] });
    addLog("[デバッグ] 宝箱を置いた");
  } },
  { name: "ミミック(化けた状態)を近くに置く", when: "dungeon", run: () => {
    const spot = DIRS4.map(([dx, dy]) => [px + dx, py + dy])
      .find(([x, y]) => map[y] && map[y][x] === "." && !monsterAt(x, y) && !itemAt(x, y) && !chestAt(x, y));
    if (!spot) { addLog("[デバッグ] となりに空いている床がない"); return; }
    if (placeMimic(spot[0], spot[1])) addLog("[デバッグ] ミミックを置いた(見た目は宝箱)");
  } },
  { name: "謎の塊を拾う", when: "dungeon", run: () => { gainLump(); } },
  { name: "宝の地図(1階先)を足元に置く", when: "dungeon", run: () => {
    // すぐ試せるように、書かれる階は次の階。乗り直すと拾う(枠がいっぱいなら入れ替えの画面)
    items.push({ x: px, y: py, treasureMap: { mapDepth: Math.min(BALANCE.goalDepth, depth + 1) } });
    addLog("[デバッグ] 宝の地図を足元に置いた(一度どいて、乗り直すと拾う)");
  } },
  { name: "呪われた装備を拾う", when: "dungeon", run: () => {
    const data = pickEquipmentData(depth, "field");
    if (data) pickUpEquipment(makeEquipment(data, depth, true));
  } },
  { name: "呪われたミシックを拾う", when: "dungeon", run: () => {
    const data = pickEquipmentData(depth, "field");
    if (data) pickUpEquipment(makeEquipment(data, depth, true, rarityById("mythic")));
  } },
  { name: "次の階へ", when: "dungeon", run: () => { addLog("[デバッグ] 次の階へ移動"); goToFloor(depth + 1); } },
  { name: "10階先へ", when: "dungeon", run: () => { addLog("[デバッグ] 10階先へ移動"); goToFloor(Math.min(BALANCE.goalDepth, depth + 10)); } },
];

let debugSpawnId = null; // 「選んだ敵を近くに出す」で出す敵の id(一覧で選んだもの)

// いちばん近い敵1体に、最大HPの rate(0.1 なら 10%)のダメージを与える(ダメージの調整・ベヒーモスのメテオを試す用)
//   道具が当たったときと同じく、ミミックは正体を現し、眠っている敵・襲ってこない龍は怒る。ターンは進まない
function debugHurtNearest(rate) {
  let target = null, best = Infinity;
  for (const m of monsters) {
    const d = Math.max(Math.abs(m.x - px), Math.abs(m.y - py));
    if (d < best) { best = d; target = m; }
  }
  if (!target) { addLog("[デバッグ] 敵がいない"); return; }
  if (target.disguised) revealMimic(target, false);
  if (target.dormant) wakeGuardian(target, "攻撃されて、");
  provokeMonster(target);
  const dmg = Math.max(1, Math.round(target.maxHp * rate));
  const name = monsterName(target);
  target.hp -= dmg;
  addPopup(target.x, target.y, dmg, "pop-dmg"); // 演出:ダメージの数字が浮かぶ
  meteorGuard(target); // ベヒーモス:HP 5%以下でエクリプスメテオ(詠唱中は倒れない)
  if (target.hp <= 0) killMonster(target, `[デバッグ] ${name}に${dmg}のダメージ！ ${name}を倒した！`);
  else addLog(`[デバッグ] ${name}に${dmg}のダメージ！(残り HP ${target.hp}/${target.maxHp})`);
}

// デバッグモードは、アドレスの最後に ?debug を付けて開いたときだけ使える(遊ぶ人がうっかり入れないように)
//   例:index.html?debug / https://asidaka0413.github.io/EPITAPH/?debug
//   付けずに開くと、設定にも出ず、セーブで ON になっていても効かない
const DEBUG_ALLOWED = new URLSearchParams(location.search).has("debug");

// ==================== テスト層 ====================
// 敵・罠・宝箱・床の装備のない、大部屋1つだけの階(デバッグ用)。強さは d 階のもの
//   「選んだ敵を近くに出す」で好きな敵と戦える。右の端に階段があり、降りるとふつうの次の階へ
function enterTestFloor(d) {
  depth = d;
  floorRoute = STAIR_ROUTES[0];
  const W = BALANCE.mapWidth, H = BALANCE.mapHeight;
  map = [];
  for (let y = 0; y < H; y++) {
    const row = [];
    for (let x = 0; x < W; x++) row.push(x >= 2 && x < W - 2 && y >= 2 && y < H - 2 ? "." : "#");
    map.push(row);
  }
  seenMap = map.map(row => row.map(() => false));
  px = 4;
  py = Math.floor(H / 2);
  stairs = { x: W - 4, y: py };
  monsters = [];
  items = [];
  chests = [];
  flames = [];
  balls = [];
  deathBlasts = [];
  corpses = [];
  lightningMarks = [];
  deathFx = [];
  tileFx = [];
  popups = [];
  graveSpot = null;
  placeHazards([]);       // ダメージ床なし(しばらくで消える床・氷の壁・岩石も空に)
  placeTreasureSpots([]); // 宝の印なし
  screenMode = "dungeon";
  addLog(`[デバッグ] テスト層(地下${d}階の強さ)に入った。「選んだ敵を近くに出す」で敵を出せる`);
}

// ==================== サウンドテスト ====================
// 効果音(config.js の SE_SOUNDS)を1つずつ選んで鳴らす画面(デバッグ用)
//   並びは SE_SOUNDS に書いた順。名前は SE_NAMES。Esc で開く前の画面に戻る
let soundTestCursor = 0;   // 選んでいる音の番号
let soundTestBack = null;  // 開く前の screenMode(戻るときに使う)

function openSoundTest() {
  if (screenMode === "soundtest") return;
  soundTestBack = screenMode;
  screenMode = "soundtest";
}

function closeSoundTest() {
  screenMode = soundTestBack || "town";
  soundTestBack = null;
  render();
}

function drawSoundTest() {
  const names = Object.keys(SE_SOUNDS);
  let h = "";
  if (!seEnabled()) h += `<div class="note">効果音が OFF になっている(拠点の設定で ON にすると鳴る)</div>`;
  h += `<div class="note">音量 ${base.settings.seVolume ?? BALANCE.seVolumeDefault}(拠点の設定で変えられる)</div>`;
  names.forEach((n, i) => {
    h += gridRow(i === soundTestCursor, "12em 1fr", [esc(SE_NAMES[n] || n), span("dim", n)]);
  });
  setScreen("サウンドテスト", h, false);
  setHint([["↑↓", "選ぶ"], ["Enter / Space", "鳴らす"], ["Esc / Q", "もどる"]]);
}

function soundTestKey(e) {
  const names = Object.keys(SE_SOUNDS);
  if (e.key === "ArrowUp") soundTestCursor = Math.max(0, soundTestCursor - 1);
  else if (e.key === "ArrowDown") soundTestCursor = Math.min(names.length - 1, soundTestCursor + 1);
  else if (e.key === "Enter") playSE(names[soundTestCursor]);
  else if (e.key === "Escape") { closeSoundTest(); return; }
  render();
}

// デバッグモードが効いているか
function debugOn() {
  return DEBUG_ALLOWED && base.settings.debug;
}

function debugAlwaysDrop() {
  return debugOn() && base.settings.debugAlwaysDrop;
}

// デバッグの「無敵」:ダメージを受けない(深い階の敵を試すとき用)
function debugInvincible() {
  return debugOn() && base.settings.debugInvincible;
}

// ボタンが押されたとき(index は DEBUG_ACTIONS の番号。"drop" はドロップ率100%、"invincible" は無敵の切り替え、"book:〇〇" は書をもらう)
function debugAction(index) {
  if (index === "drop") {
    base.settings.debugAlwaysDrop = !base.settings.debugAlwaysDrop;
  } else if (index === "invincible") {
    base.settings.debugInvincible = !base.settings.debugInvincible;
  } else if (String(index).startsWith("book:")) {
    obtainBook(bookById(index.slice(5)));
  } else {
    DEBUG_ACTIONS[index].run();
  }
  saveGame();
  render();
}

function drawDebug() {
  const panel = document.getElementById("debug-panel");
  panel.style.display = debugOn() ? "" : "none";
  if (!debugOn()) return;
  const inDungeon = inRunScreen();
  const btn = (arg, label, cls = "toggle") =>
    `<button class="${cls}" onclick="this.blur(); debugAction(${JSON.stringify(arg).replace(/"/g, "&quot;")})">${esc(label)}</button>`;
  let h = "";
  DEBUG_ACTIONS.forEach((a, i) => {
    if (a.when !== "any" && !inDungeon) return;
    h += btn(i, a.name);
    // 「選んだ敵を近くに出す」の横に、出す敵を選ぶ一覧(特殊な動きの敵は ★ 付き)
    //   選んだら this.blur() で一覧から離れる(矢印キーがゲームの操作に戻るように)
    if (a.name === "選んだ敵を近くに出す") {
      if (!debugSpawnId && monsterList[0]) debugSpawnId = monsterList[0].id;
      const opts = monsterList.map(m => `<option value="${esc(m.id)}"${m.id === debugSpawnId ? " selected" : ""}>`
        + `${esc(m.name)}${m.ability ? " ★" : ""}(${m.minDepth}階〜)</option>`).join("");
      h += `<select class="debug-select" onchange="debugSpawnId = this.value; this.blur();">${opts}</select>`;
    }
  });
  h += btn("drop", `ドロップ率100% ${base.settings.debugAlwaysDrop ? "ON" : "OFF"}`, base.settings.debugAlwaysDrop ? "toggle on" : "toggle");
  h += btn("invincible", `無敵 ${base.settings.debugInvincible ? "ON" : "OFF"}`, base.settings.debugInvincible ? "toggle on" : "toggle");
  for (const book of bookList) h += btn(`book:${book.id}`, `${book.name} +1`);
  document.getElementById("debug").innerHTML = h;
}
