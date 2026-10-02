// 宝の地図
// index.html から <script src> で読み込まれる(読み込む順番は index.html に書いてある)

// ==================== 宝の地図 ====================
// 敵がまれに落とす(mapDropChance)。拾うと道具の枠を1つ使う(runTools に { id: "treasureMap", count: 1, mapDepth } で入る)
//   道具の枠がいっぱいなら、入れ替える画面(screenMode "swap")を出す。捨てた道具はなくなる。「拾わない」なら床に残る
//   書かれた階(mapDepth)に着くと、真ん中の部屋のどこかに宝の印(X)が出る。乗ると掘り出して、地図はなくなる
//   書かれた階を過ぎると(深い穴で飛ばしても)、地図はただの紙切れになって消える。死ぬとなくなる
let treasureSpots = []; // この階の宝の印。1個の形:{ x, y, map: その印の地図(runTools の中のもの) }
let swapMapItem = null; // 入れ替える画面で、拾おうとしている地図(床の items の中のもの)
let swapCursor = 0;     // 入れ替える画面で選んでいる行の番号

function treasureSpotAt(x, y) {
  return treasureSpots.find(s => s.x === x && s.y === y) || null;
}

// 倒した敵 m が、宝の地図をその場に落とすか(エリートは落としやすい。運で少し上がる)
//   書かれる階は、今の階の mapDepthMin〜mapDepthMax 階先
function dropTreasureMap(m) {
  const rate = BALANCE.mapDropChance * luckDropMultiplier() * (m.elite ? BALANCE.eliteDropMultiplier : 1);
  if (!debugAlwaysDrop() && Math.random() >= rate) return;
  const mapDepth = Math.min(BALANCE.goalDepth, depth + randInt(BALANCE.mapDepthMin, BALANCE.mapDepthMax));
  if (mapDepth <= depth) return; // いちばん下の階では落とさない
  items.push({ x: m.x, y: m.y, treasureMap: { mapDepth } });
  addLog(`${monsterName(m)}が宝の地図を落とした！`);
}

// 足元の宝の地図を拾う(it:床の items の中のもの)。道具の枠がいっぱいなら、入れ替える画面を出す
function pickUpTreasureMap(it) {
  if (runTools.length >= BALANCE.carrySlots) {
    swapMapItem = it;
    swapCursor = 0;
    screenMode = "swap";
    addLog(`宝の地図(地下${it.treasureMap.mapDepth}階)を見つけた。道具の枠がいっぱいなので、入れ替えるか決める`);
    return;
  }
  items = items.filter(i => i !== it);
  runTools.push({ id: "treasureMap", count: 1, mapDepth: it.treasureMap.mapDepth });
  addLog(`宝の地図を拾った！ 地下${it.treasureMap.mapDepth}階に宝が眠っているらしい`);
}

// 入れ替える画面で Enter:選んだ枠の道具を捨てて、地図を入れる(いちばん下の「拾わない」なら、そのまま)
function chooseSwap() {
  const it = swapMapItem;
  const tool = runTools[swapCursor];
  if (it && tool) {
    addLog(`${toolLabel(tool)}を捨てて、宝の地図を拾った(地下${it.treasureMap.mapDepth}階)`);
    runTools.splice(swapCursor, 1);
    items = items.filter(i => i !== it);
    runTools.push({ id: "treasureMap", count: 1, mapDepth: it.treasureMap.mapDepth });
  } else {
    addLog("宝の地図は拾わなかった(床に残っている)");
  }
  swapMapItem = null;
  screenMode = "dungeon";
  render();
}

// 道具の表示名(宝の地図なら書かれた階、数があれば ×数)
function toolLabel(t) {
  const name = TOOL_DATA[t.id].name + (t.mapDepth ? `(地下${t.mapDepth}階)` : "");
  return t.count > 1 ? `${name}×${t.count}` : name;
}

// この階が地図に書かれた階なら、地図1枚につき1つ、宝の印を置く(真ん中の部屋の空いている床)
function placeTreasureSpots(rooms) {
  treasureSpots = [];
  if (rooms.length === 0) return;
  for (const t of runTools.filter(t => t.id === "treasureMap" && t.mapDepth === depth)) {
    for (let i = 0; i < 50; i++) {
      const r = rooms[randInt(0, rooms.length - 1)];
      const x = randInt(r.x, r.x + r.w - 1), y = randInt(r.y, r.y + r.h - 1);
      if (map[y][x] !== "." || monsterAt(x, y) || itemAt(x, y) || chestAt(x, y) || hazardAt(x, y) || treasureSpotAt(x, y)) continue;
      treasureSpots.push({ x, y, map: t });
      break;
    }
  }
}

// 新しい階に着いたとき:書かれた階を過ぎた地図を消す。書かれた階なら知らせる
function checkTreasureMaps() {
  const expired = runTools.filter(t => t.id === "treasureMap" && t.mapDepth < depth);
  if (expired.length > 0) {
    runTools = runTools.filter(t => !expired.includes(t));
    addLog(`地下${expired.map(t => t.mapDepth).join("・")}階を過ぎてしまった。宝の地図は、ただの紙切れになった`);
  }
  if (treasureSpots.length > 0) addLog("宝の地図の階に着いた！ どこかに宝の印(X)がある");
}

// 宝の印の上に乗ったとき:宝を掘り出す(装備 mapRewardItems 個 + mapLumpChance で謎の塊)。地図はなくなる
function digTreasure(spot) {
  treasureSpots = treasureSpots.filter(s => s !== spot);
  runTools = runTools.filter(t => t !== spot.map);
  addLog("宝の印の下を掘ると、宝が出てきた！");
  for (let i = 0; i < BALANCE.mapRewardItems; i++) {
    const data = pickTreasureData();
    if (data) pickUpEquipment(makeEquipment(data, depth));
  }
  if (chance(BALANCE.mapLumpChance * 100)) gainLump();
}
