// ダンジョン生成・階層・見える範囲(盲目など)
// index.html から <script src> で読み込まれる(読み込む順番は index.html に書いてある)

// ==================== ダンジョン生成 ====================
function digH(x1, x2, y) {
  for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) map[y][x] = ".";
}
function digV(y1, y2, x) {
  for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) map[y][x] = ".";
}

function makeMap() {
  const W = BALANCE.mapWidth, H = BALANCE.mapHeight;
  map = [];
  for (let y = 0; y < H; y++) {
    const row = [];
    for (let x = 0; x < W; x++) row.push("#");
    map.push(row);
  }
  seenMap = map.map(row => row.map(() => false)); // この階で見た場所の記録は、新しい階では空から

  // エリートの階では、最初に作る部屋を大きくして、そこを階段の部屋にする
  const eliteFloor = isEliteFloor(depth);

  const rooms = [];
  const attempts = Math.round(BALANCE.roomAttempts * routeFx("roomRate", 1)); // 暗闇の道では部屋が少ない
  for (let i = 0; i < attempts; i++) {
    const big = eliteFloor && rooms.length === 0;
    const w = big ? randInt(BALANCE.eliteRoomMinW, BALANCE.eliteRoomMaxW) : randInt(BALANCE.roomMinW, BALANCE.roomMaxW);
    const h = big ? randInt(BALANCE.eliteRoomMinH, BALANCE.eliteRoomMaxH) : randInt(BALANCE.roomMinH, BALANCE.roomMaxH);
    const x = randInt(1, W - w - 1);
    const y = randInt(1, H - h - 1);

    let overlap = false;
    for (const r of rooms) {
      if (x < r.x + r.w + 1 && x + w + 1 > r.x &&
          y < r.y + r.h + 1 && y + h + 1 > r.y) overlap = true;
    }
    if (overlap) continue;

    for (let yy = y; yy < y + h; yy++) {
      for (let xx = x; xx < x + w; xx++) map[yy][xx] = ".";
    }

    const cx = Math.floor(x + w / 2);
    const cy = Math.floor(y + h / 2);

    if (rooms.length > 0) {
      const prev = rooms[rooms.length - 1];
      digH(prev.cx, cx, prev.cy);
      digV(prev.cy, cy, cx);
    }
    rooms.push({ x, y, w, h, cx, cy });
  }

  // 部屋は作った順に通路でつながっているので、最初と最後の部屋をスタートと階段にする
  //   ふつうの階:最初の部屋がスタート、最後の部屋が階段
  //   エリートの階:大きい最初の部屋が階段(エリートがいる)、最後の部屋がスタート
  const startRoom = eliteFloor ? rooms[rooms.length - 1] : rooms[0];
  const stairsRoom = eliteFloor ? rooms[0] : rooms[rooms.length - 1];
  px = startRoom.cx;
  py = startRoom.cy;
  stairs = { x: stairsRoom.cx, y: stairsRoom.cy };

  monsters = [];
  items = [];
  chests = [];
  flames = [];
  balls = [];
  deathBlasts = [];
  if (eliteFloor) placeElite(stairsRoom);
  for (let i = 1; i < rooms.length - 1; i++) {
    const r = rooms[i];
    // 敵がいる確率は、選んだ道(険しい道・静かな道)で変わる
    //   暗闇の道では、1部屋に monstersPerRoom 回まで抽選する(2体目からは部屋の空いているところ)
    const spawnChance = BALANCE.monsterSpawnChance * routeFx("spawnRate", 1);
    for (let k = 0; k < routeFx("monstersPerRoom", 1); k++) {
      const monsterData = Math.random() < spawnChance ? pickWeighted(monsterList, depth) : null;
      if (!monsterData) continue;
      // monsters.js の中から、この階層で出る敵を1体置く(部屋の真ん中が空いていなければ、部屋の空いているところ)
      if (!monsterAt(r.cx, r.cy)) monsters.push(newMonster(monsterData, r.cx, r.cy));
      else placeInRoom(r, monsterData);
      // 群れ(pack):同じ部屋に、残りの仲間を出す
      if (monsterData.pack) {
        const count = randInt(monsterData.pack[0], monsterData.pack[1]) - 1;
        for (let n = 0; n < count; n++) placeInRoom(r, monsterData);
      }
      // 手下(ゴブリンの族長など):escortFrom の敵から escorts 体を、同じ部屋に出す
      const ab = monsterData.ability;
      if (ab && ab.escorts) {
        for (let n = 0; n < ab.escorts; n++) {
          const data = monsterList.find(m => m.id === ab.escortFrom[randInt(0, ab.escortFrom.length - 1)]);
          if (data) placeInRoom(r, data);
        }
      }
    }
  }

  // 床に落ちている装備(from が "field" のもの)を、決まった個数だけ置く
  //   スタートと階段の部屋以外からランダムに部屋を選び、その中の空いている場所に置く(敵がいる部屋でもOK)
  //   個数は、選んだ道(静かな道)で変わる
  const itemCount = randInt(routeFx("itemsMin", BALANCE.fieldItemsMin), routeFx("itemsMax", BALANCE.fieldItemsMax));
  const middleRooms = rooms.slice(1, rooms.length - 1);
  for (let i = 0; i < itemCount && middleRooms.length > 0; i++) {
    const r = middleRooms[randInt(0, middleRooms.length - 1)];
    const x = randInt(r.x, r.x + r.w - 1), y = randInt(r.y, r.y + r.h - 1);
    if (monsterAt(x, y) || itemAt(x, y)) { i--; continue; } // 埋まっていたら選び直す
    const data = pickEquipmentData(depth, "field");
    if (data) items.push({ x, y, equip: makeEquipment(data, depth) });
  }

  // 宝箱:chestChance の確率で1つ(スタートと階段の部屋以外)。暗闇の道では必ず
  if (chance(routeFx("chestChance", BALANCE.chestChance) * 100)) placeChest(middleRooms);

  // ダメージ床(毒沼・マグマ):スタートと階段の部屋以外に、小さなかたまりで
  placeHazards(middleRooms);

  // 宝の地図に書かれた階なら、宝の印(X)を置く
  placeTreasureSpots(middleRooms);

  // 前回死んだ階なら、墓(と墓守)を置く
  placeGrave(rooms);
}

// 部屋 r の空いているマスに、敵を1体置く(群れ・手下用)。空きが見つからなければ置かない
function placeInRoom(r, data) {
  for (let i = 0; i < 30; i++) {
    const x = randInt(r.x, r.x + r.w - 1), y = randInt(r.y, r.y + r.h - 1);
    if (map[y][x] === "." && !monsterAt(x, y) && !(x === px && y === py)) {
      monsters.push(newMonster(data, x, y));
      return;
    }
  }
}

function startNewRun() {
  depth = 1;
  floorRoute = STAIR_ROUTES[0]; // 最初の階は「ふつうの道」
  nextRoute = null;
  resetPlayerStats();
  runStats = newRunStats();
  makeMap();
  screenMode = "dungeon";
  clearLog();
  addLog("ダンジョンに潜った");
  takeCarryIntoRun(); // 道具屋で買った道具を持っていく
  equipSmithOrders(); // 鍛冶屋に注文した装備を、最初から着けている
  announceGrave();
  render();
}

// ==================== 階層 ====================
// 階 d がどの層か(低層・中層 …)。goalDepth より深いときは最後の層
function layerOf(d) {
  return BALANCE.layers.find(l => d <= l.until) || BALANCE.layers[BALANCE.layers.length - 1];
}

// 「低層 地下12階」のような表示
function depthLabel(d) {
  return `${layerOf(d).name} 地下${d}階`;
}

// ==================== 見える範囲(盲目など) ====================
// ふだんはマップ全体が見える。盲目のあいだと、暗闇の道の階では、プレイヤーの周りだけ見える
//   見えないマスの敵・物・炎などは描かない。一度見たマスの地形(壁・床・階段・墓)は薄く残る(seenMap)
//   F キーの視界・攻撃範囲の表示と、詳細ウィンドウも、見えているマスだけ
let seenMap = []; // この階で見たことのあるマス。seenMap[y][x] が true なら見たことがある

// 今プレイヤーが見える範囲(マス数)。全体が見えるときは null
//   盲目と暗闇の道が重なったときは、狭いほう
function playerSightRadius() {
  const limits = [];
  if (playerBlind) limits.push(BALANCE.blindSightRadius);
  const dark = routeFx("sightRadius", null); // 暗闇の道の階
  if (dark !== null) limits.push(dark);
  return limits.length > 0 ? Math.min(...limits) : null;
}

// マス (x, y) が今見えているか(見える範囲の内側で、あいだに壁がない)
//   範囲は円に近い形(縦横 r マス、ななめは少し短い)
function canSeeTile(x, y) {
  const r = playerSightRadius();
  if (r === null) return true;
  const dx = x - px, dy = y - py;
  if (dx * dx + dy * dy > r * r + r) return false;
  return (dx === 0 && dy === 0) || sightClear(px, py, x, y);
}

// 今見えているマスを「見たことがある」にする(画面を描くたびに呼ぶ)
function updateSeen() {
  for (let y = 0; y < map.length; y++) {
    for (let x = 0; x < map[y].length; x++) {
      if (!seenMap[y][x] && canSeeTile(x, y)) seenMap[y][x] = true;
    }
  }
}
