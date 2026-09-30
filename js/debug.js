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
  { name: "HP全回復", when: "dungeon", run: () => { playerHP = maxHP; } },
  { name: "特殊な敵を近くに出す", when: "dungeon", run: () => {
    // 特殊な動きをする敵を1体、プレイヤーから少し離れた床に出す(順番に)
    const list = monsterList.filter(m => m.ability);
    debugSpawnIndex = (debugSpawnIndex + 1) % list.length;
    const data = list[debugSpawnIndex];
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
  { name: "呪われた装備を拾う", when: "dungeon", run: () => {
    const data = pickEquipmentData(depth, "field");
    if (data) pickUpEquipment(makeEquipment(data, depth, true));
  } },
  { name: "次の階へ", when: "dungeon", run: () => { depth += 1; makeMap(); addLog(`[デバッグ] 地下${depth}階へ移動`); announceElite(); announceGrave(); } },
  { name: "10階先へ", when: "dungeon", run: () => { depth = Math.min(BALANCE.goalDepth, depth + 10); makeMap(); addLog(`[デバッグ] ${depthLabel(depth)}へ移動`); announceElite(); announceGrave(); } },
];

let debugSpawnIndex = -1; // 「特殊な敵を近くに出す」で次に出す敵の番号

function debugAlwaysDrop() {
  return base.settings.debug && base.settings.debugAlwaysDrop;
}

// ボタンが押されたとき(index は DEBUG_ACTIONS の番号。"drop" はドロップ率100%の切り替え、"book:〇〇" は書をもらう)
function debugAction(index) {
  if (index === "drop") {
    base.settings.debugAlwaysDrop = !base.settings.debugAlwaysDrop;
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
  panel.style.display = base.settings.debug ? "" : "none";
  if (!base.settings.debug) return;
  const inDungeon = screenMode === "dungeon" || screenMode === "inventory" || screenMode === "camp";
  const btn = (arg, label, cls = "toggle") =>
    `<button class="${cls}" onclick="this.blur(); debugAction(${JSON.stringify(arg).replace(/"/g, "&quot;")})">${esc(label)}</button>`;
  let h = "";
  DEBUG_ACTIONS.forEach((a, i) => {
    if (a.when === "any" || inDungeon) h += btn(i, a.name);
  });
  h += btn("drop", `ドロップ率100% ${base.settings.debugAlwaysDrop ? "ON" : "OFF"}`, base.settings.debugAlwaysDrop ? "toggle on" : "toggle");
  for (const book of bookList) h += btn(`book:${book.id}`, `${book.name} +1`);
  document.getElementById("debug").innerHTML = h;
}
