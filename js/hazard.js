// 罠(ダメージ床。毒沼・マグマなど)
// index.html から <script src> で読み込まれる(読み込む順番は index.html に書いてある)

// ==================== 罠(ダメージ床) ====================
// 部屋の中に、毒沼・マグマの小さなかたまりがある(見える地形)。敵は平気
//   プレイヤーは、上にいるあいだ行動するたびに、ダメージと短い状態異常を受ける(hazardTick)
//   種類を増やすときは HAZARD_TYPES と、BALANCE.hazards に同じ id で足す
//   name:表示名 / symbol:マップの記号 / cls:色(CSS のクラス名)/ element:属性(elements.js)/ dot:かかる状態異常(DOT_TYPES の id)
//   hitText:ダメージを受けたときのログ(このあとに「〇のダメージ」が付く)
const HAZARD_TYPES = {
  poison: { name: "毒沼",   symbol: "~", cls: "haz-poison", element: "poison", dot: "poison", hitText: "毒沼に足を取られた" },
  magma:  { name: "マグマ", symbol: "~", cls: "haz-magma",  element: "fire",   dot: "burn",   hitText: "マグマに焼かれた" },
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
  const types = Object.keys(HAZARD_TYPES).filter(id => depth >= BALANCE.hazards[id].minDepth);
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

// プレイヤーの行動のあと:しばらくで消えるダメージ床の残りターンを減らし、0 になったら消す
function tempHazardsTick() {
  for (const t of tempHazards) {
    t.turns -= 1;
    if (t.turns <= 0) hazardMap[t.y][t.x] = null;
  }
  tempHazards = tempHazards.filter(t => t.turns > 0);
}

// プレイヤーの行動のあと:ダメージ床の上にいたら、ダメージと短い状態異常
//   ダメージは敵の攻撃と同じ伸び方(深い階・険しい道ほど痛い)。回避・会心はない
function hazardTick() {
  const id = hazardAt(px, py);
  if (!id) return;
  const t = HAZARD_TYPES[id], b = BALANCE.hazards[id];
  const dmg = Math.round(enemyStat(b.damage, b.damagePerDepth, "attack"));
  const hit = hitPlayer(dmg, { label: t.hitText, cause: t.name,
    evadable: false, canCrit: false, category: "terrain", element: t.element });
  // 上にいるあいだは状態異常が切れない(残りターンを戻す)。出れば dotTurns ですぐ抜ける
  if (hit && playerHP > 0) dotPlayer(t.dot, Math.round(enemyStat(b.dotDamage, b.dotDamagePerDepth, "attack")), b.dotTurns, t.name, null, true);
}
