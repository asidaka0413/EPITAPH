// 罠(ダメージ床。毒沼・マグマなど)
// index.html から <script src> で読み込まれる(読み込む順番は index.html に書いてある)

// ==================== 罠(ダメージ床) ====================
// 部屋の中に、毒沼・マグマの小さなかたまりがある(見える地形)。敵は平気
//   プレイヤーは、上にいるあいだ行動するたびに、ダメージと短い状態異常を受ける(hazardTick)
//   種類を増やすときは HAZARD_TYPES と、BALANCE.hazards に同じ id で足す
//   name:表示名 / symbol:マップの記号 / cls:色(CSS のクラス名)/ element:属性(elements.js)/ dot:かかる状態異常(DOT_TYPES の id)
//   hitText:ダメージを受けたときのログ(このあとに「〇のダメージ」が付く)
//   ailment:ダメージのかわりに付く状態異常(AILMENT_TYPES の id)。書いた床はダメージなし
//   tempOnly:true なら、部屋には置かない(技でしばらくだけ出る床)
const HAZARD_TYPES = {
  poison: { name: "毒沼",     symbol: "~", cls: "haz-poison", element: "poison", dot: "poison", hitText: "毒沼に足を取られた" },
  magma:  { name: "マグマ",   symbol: "~", cls: "haz-magma",  element: "fire",   dot: "burn",   hitText: "マグマに焼かれた" },
  ice:    { name: "凍った床", symbol: "~", cls: "haz-ice",    ailment: "chill",  tempOnly: true }, // 凛龍のブレスの跡
  fog:    { name: "毒の霧",   symbol: ":", cls: "haz-fog",    element: "poison", dot: "poison", fog: true, tempOnly: true }, // 瘴龍の毒の球の跡
};

let hazardMap = []; // この階のダメージ床。hazardMap[y][x] が種類の id(なければ null)

function hazardAt(x, y) {
  return (hazardMap[y] && hazardMap[y][x]) || null;
}

// 部屋の一覧 rooms に、ダメージ床のかたまりを hazardPoolsMin〜Max 個置く(この階で出る種類から選ぶ)
//   かたまりは、1マスから始めて、となりのマスに少しずつ広げる(部屋の外にははみ出さない)
function placeHazards(rooms) {
  hazardMap = map.map(row => row.map(() => null));
  tempHazards = [];
  iceWalls = [];
  rocks = [];
  const types = Object.keys(HAZARD_TYPES).filter(id => !HAZARD_TYPES[id].tempOnly && depth >= BALANCE.hazards[id].minDepth);
  if (types.length === 0 || rooms.length === 0) return;
  const pools = randInt(BALANCE.hazardPoolsMin, BALANCE.hazardPoolsMax);
  for (let p = 0; p < pools; p++) {
    const type = types[randInt(0, types.length - 1)];
    const r = rooms[randInt(0, rooms.length - 1)];
    const size = randInt(BALANCE.hazardPoolMin, BALANCE.hazardPoolMax);
    // 置けるマス:その部屋の中の床で、物・宝箱・階段・スタートの位置ではない
    const ok = (x, y) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h && map[y][x] === "."
      && !hazardAt(x, y) && !itemAt(x, y) && !chestAt(x, y)
      && !(x === px && y === py) && !(stairs && x === stairs.x && y === stairs.y);
    const sx = randInt(r.x, r.x + r.w - 1), sy = randInt(r.y, r.y + r.h - 1);
    if (!ok(sx, sy)) continue;
    const pool = [[sx, sy]];
    hazardMap[sy][sx] = type;
    for (let tries = 0; pool.length < size && tries < 30; tries++) {
      const [bx, by] = pool[randInt(0, pool.length - 1)];
      const [dx, dy] = DIRS4[randInt(0, 3)];
      if (!ok(bx + dx, by + dy)) continue;
      hazardMap[by + dy][bx + dx] = type;
      pool.push([bx + dx, by + dy]);
    }
  }
}

// ==================== しばらくで消えるダメージ床 ====================
// ドラゴンゾンビの死骸の爆発で広がる毒沼など。turns ターンたつと消える(もともとダメージ床だったマスには置かない)
let tempHazards = []; // 1個の形:{ x, y, turns: 残りターン }

// (cx, cy) の周り radius マスの床に、type のダメージ床を turns ターンだけ置く
function addTempHazards(cx, cy, radius, type, turns) {
  for (let y = cy - radius; y <= cy + radius; y++) {
    for (let x = cx - radius; x <= cx + radius; x++) {
      if (!map[y] || map[y][x] !== "." || hazardAt(x, y) || (stairs && x === stairs.x && y === stairs.y)) continue;
      hazardMap[y][x] = type;
      tempHazards.push({ x, y, turns });
    }
  }
}

// マスの一覧 tiles({ x, y } の配列)に、type のダメージ床を turns ターンだけ置く(凛龍のブレスの跡など)
function addTempHazardTiles(tiles, type, turns) {
  for (const { x, y } of tiles) {
    if (!map[y] || map[y][x] !== "." || hazardAt(x, y) || (stairs && x === stairs.x && y === stairs.y)) continue;
    hazardMap[y][x] = type;
    tempHazards.push({ x, y, turns });
  }
}

// プレイヤーの行動のあと:しばらくで消えるダメージ床・氷の壁の残りターンを減らし、0 になったら消す
function tempHazardsTick() {
  for (const t of tempHazards) {
    t.turns -= 1;
    if (t.turns <= 0) hazardMap[t.y][t.x] = null;
  }
  tempHazards = tempHazards.filter(t => t.turns > 0);
  for (const w of iceWalls) {
    w.turns -= 1;
    if (w.turns <= 0) map[w.y][w.x] = ".";
  }
  if (iceWalls.some(w => w.turns <= 0)) addLog("氷の壁が溶けた");
  iceWalls = iceWalls.filter(w => w.turns > 0);
}

// ==================== 氷の壁 ====================
// 凛龍が、こちらの後ろ(龍と反対側)に立てる壁。turns ターンで溶ける。殴ると1回で壊れる(combat.js の tryMove)
//   立てているあいだは map を "#" にする(敵・球・視界などは、ふつうの壁と同じに扱う)
let iceWalls = []; // 1個の形:{ x, y, turns: 残りターン }

function iceWallAt(x, y) {
  return iceWalls.find(w => w.x === x && w.y === y) || null;
}

// (x, y) が、氷の壁・岩石を置ける何もない床か
function freeForBlock(x, y) {
  return map[y] && map[y][x] === "." && !(x === px && y === py) && !monsterAt(x, y) && !itemAt(x, y) && !chestAt(x, y)
    && !hazardAt(x, y) && !flameAt(x, y) && !ballAt(x, y) && !graveAt(x, y) && !treasureSpotAt(x, y)
    && !(stairs && x === stairs.x && y === stairs.y);
}

// (x, y) に氷の壁を立てる(何もない床だけ)。立てたら true
function addIceWall(x, y, turns) {
  if (!freeForBlock(x, y)) return false;
  map[y][x] = "#";
  iceWalls.push({ x, y, turns });
  return true;
}

// 氷の壁を壊す(殴ったとき)
function breakIceWall(w) {
  map[w.y][w.x] = ".";
  iceWalls = iceWalls.filter(x => x !== w);
  addLog("氷の壁を叩き割った！");
}

// ==================== 岩石(ベヒーモス) ====================
// ベヒーモスの地響き・エクリプスメテオの詠唱で降ってくる岩。壁と同じ(通れない・壊せない。map を "#" にする)
//   エクリプスメテオの落下地点から見て、岩の後ろにいればメテオを受けない(js/enemyskills.js の lineHasRock)。メテオのあとで砕ける
let rocks = []; // 1個の形:{ x, y }

function rockAt(x, y) {
  return rocks.some(r => r.x === x && r.y === y);
}

// (cx, cy) から周り minDist〜maxDist マス(縦横ななめ)の、何もない床に、岩を count 個落とす。落とした数を返す
//   limit:この階の岩の数の上限(もう limit 個あれば落とさない)
function dropRocks(cx, cy, count, minDist, maxDist, limit) {
  count = Math.min(count, limit - rocks.length);
  if (count <= 0) return 0;
  const spots = [];
  for (let y = cy - maxDist; y <= cy + maxDist; y++) {
    for (let x = cx - maxDist; x <= cx + maxDist; x++) {
      if (Math.max(Math.abs(x - cx), Math.abs(y - cy)) >= minDist && freeForBlock(x, y)) spots.push([x, y]);
    }
  }
  let n = 0;
  for (; n < count && spots.length > 0; n++) {
    const [x, y] = spots.splice(randInt(0, spots.length - 1), 1)[0];
    map[y][x] = "#";
    rocks.push({ x, y });
  }
  if (n > 0) addLog(`岩石が${n}個、降ってきた！`);
  return n;
}

// 岩を全部砕く(エクリプスメテオのあと)
function breakRocks() {
  if (rocks.length === 0) return;
  for (const r of rocks) map[r.y][r.x] = ".";
  rocks = [];
  addLog("岩石が砕け散った");
}

// プレイヤーの行動のあと:ダメージ床の上にいたら、ダメージと短い状態異常
//   ダメージは敵の攻撃と同じ伸び方(深い階・険しい道ほど痛い)。回避・会心はない
//   凍った床(ailment)はダメージなしで、上にいるあいだ凍えが切れない
function hazardTick() {
  const id = hazardAt(px, py);
  if (!id) return;
  const t = HAZARD_TYPES[id], b = BALANCE.hazards[id];
  if (t.ailment) {
    ailPlayer(t.ailment, b.ailTurns);
    return;
  }
  // 毒の霧:ダメージは毒だけ。中にいるあいだ盲目と毒が切れない
  if (t.fog) {
    if (playerBlind) playerBlind.turns = Math.max(playerBlind.turns, b.blindTurns);
    else blindPlayer(b.blindTurns);
    dotPlayer(t.dot, Math.round(enemyStat(b.dotDamage, b.dotDamagePerDepth, "attack")), b.dotTurns, t.name, null, true);
    return;
  }
  const dmg = Math.round(enemyStat(b.damage, b.damagePerDepth, "attack"));
  const hit = hitPlayer(dmg, { label: t.hitText, cause: t.name,
    evadable: false, canCrit: false, category: "terrain", element: t.element });
  // 上にいるあいだは状態異常が切れない(残りターンを戻す)。出れば dotTurns ですぐ抜ける
  if (hit && playerHP > 0) dotPlayer(t.dot, Math.round(enemyStat(b.dotDamage, b.dotDamagePerDepth, "attack")), b.dotTurns, t.name, null, true);
}
