// ダンジョン生成・階層・墓と遺品・エリート・階段の道(分かれ道)・キャンプ
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

  // エリートの階では、最初に作る部屋を大きくして、そこを階段の部屋にする
  const eliteFloor = isEliteFloor(depth);

  const rooms = [];
  for (let i = 0; i < BALANCE.roomAttempts; i++) {
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
  flames = [];
  balls = [];
  if (eliteFloor) placeElite(stairsRoom);
  for (let i = 1; i < rooms.length - 1; i++) {
    const r = rooms[i];
    // 敵がいる確率は、選んだ道(険しい道・静かな道)で変わる
    const spawnChance = BALANCE.monsterSpawnChance * routeFx("spawnRate", 1);
    const monsterData = Math.random() < spawnChance ? pickWeighted(monsterList, depth) : null;
    if (monsterData) {
      // monsters.js の中から、この階層で出る敵を1体置く
      monsters.push(newMonster(monsterData, r.cx, r.cy));
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

// ==================== 墓と遺品 ====================
// 死ぬと、その階に墓が建つ(いちばん最近の1つだけ。base.grave)
//   墓の上に乗ると墓碑銘がログに出て、遺品(死んだときに着けていた装備から1つ)を拾える
//   遺品が残っているあいだは、自分を倒した敵が「墓守」(エリート)になって墓の隣で眠っている
//   墓守はこちらから攻撃するか、遺品を拾うまで動かない
let graveSpot = null; // この階の墓の位置 { x, y }(墓がない階は null)

function graveAt(x, y) {
  return !!graveSpot && graveSpot.x === x && graveSpot.y === y;
}

// 装備を遺品にする(コピーを作る)。キャンプで強化した分は、強化前の性能(+0)に戻す
//   強化が残ると、遺品を拾い直すたびに強化を重ねて、1つの装備が冒険をまたいで強くなり続けてしまうため
//   呪い・効果・個体差はそのまま
function makeRelic(eq) {
  const relic = JSON.parse(JSON.stringify(eq));
  if (relic.baseStats) relic.stats = { ...relic.baseStats };
  relic.plus = 0;
  return relic;
}

// 死んだとき:墓を建てる(前の墓は消える)
function buildGrave(totalKills) {
  const worn = Object.values(equipped).filter(eq => !eq.smith); // 鍛冶屋の装備は遺品にならない
  const relic = worn.length > 0 ? makeRelic(worn[randInt(0, worn.length - 1)]) : null; // 着けていた装備から1つ
  base.grave = {
    depth, killerId: runStats.killedById || null, killerName: runStats.killedBy || "何か",
    level: base.level, kills: totalKills, turns: runStats.turns, runNo: base.records.runs,
    relic, relicTaken: false,
  };
}

// この階が墓のある階なら、真ん中の部屋のどこかに墓を置き、遺品が残っていれば隣に墓守を眠らせる
function placeGrave(rooms) {
  graveSpot = null;
  const g = base.grave;
  if (!g || g.depth !== depth) return;
  const middle = rooms.length > 2 ? rooms.slice(1, rooms.length - 1) : rooms;
  const free = (x, y) => map[y] && map[y][x] === "." && !monsterAt(x, y) && !itemAt(x, y)
    && !(x === px && y === py) && !(stairs && x === stairs.x && y === stairs.y) && !graveAt(x, y);
  for (let i = 0; i < 100 && !graveSpot; i++) {
    const r = middle[randInt(0, middle.length - 1)];
    const x = randInt(r.x, r.x + r.w - 1), y = randInt(r.y, r.y + r.h - 1);
    if (free(x, y)) graveSpot = { x, y };
  }
  if (!graveSpot || !g.relic || g.relicTaken || !g.killerId) return;
  const data = monsterList.find(m => m.id === g.killerId);
  const spot = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [graveSpot.x + dx, graveSpot.y + dy]).find(([x, y]) => free(x, y));
  if (data && spot) {
    monsters.push(newMonster(data, spot[0], spot[1], { elite: true, guardian: true, dormant: true }));
  }
}

// 墓のある階に来たときのお知らせ
function announceGrave() {
  if (!graveSpot) return;
  const g = base.grave;
  addLog(g.relic && !g.relicTaken
    ? `この階のどこかに、前の自分の墓がある。遺品(${equipName(g.relic)})が眠っている…`
    : "この階のどこかに、前の自分の墓がある");
}

// 墓碑銘(墓に刻まれていること)
function epitaphLines(g) {
  return [
    `――ここに眠る。${g.runNo}回目の冒険、Lv.${g.level}の冒険者`,
    `　${depthLabel(g.depth)}にて、${g.killerName === "自害" ? "自ら命を絶つ" : `${g.killerName}に倒れる`}。倒した敵 ${g.kills}体、${g.turns}ターン`,
  ];
}

// 墓の上に乗ったとき:墓碑銘を読み、遺品があれば拾う(墓守が目を覚ます)
function visitGrave() {
  const g = base.grave;
  epitaphLines(g).forEach(addLog);
  if (!g.relic || g.relicTaken) return;
  g.relicTaken = true;
  addLog(`遺品を手に入れた`);
  pickUpEquipment(JSON.parse(JSON.stringify(g.relic)), false); // 前に拾った装備なので、図鑑の拾った回数は増やさない
  const guard = monsters.find(m => m.guardian && m.dormant);
  if (guard) wakeGuardian(guard, "墓を荒らす気配に");
  saveGame();
}

// 墓守を起こす
function wakeGuardian(m, reason) {
  m.dormant = false;
  m.hunting = true;
  addLog(`${reason}${monsterName(m)}が目を覚ました！`);
}

// ==================== エリート ====================
// 決まった階(10, 20, 30 …階)には、階段の部屋にエリートが1体だけいる
//   エリートを倒すまで階段は封印されていて、降りられない
//   倒すと、死んだときに刻める数が +1 される
function isEliteFloor(d) {
  return d % BALANCE.eliteEveryFloors === 0;
}

// 階段の部屋に、この階で出る敵を1種類選んでエリートとして置く(階段の2マス左)
//   出てきたばかりの敵(出始めてから eliteMinFloorsSeen 階以内)はエリートにならない
function placeElite(room) {
  const pool = monsterList.filter(m => m.minDepth <= depth - BALANCE.eliteMinFloorsSeen);
  const data = pickWeighted(pool.length > 0 ? pool : monsterList, depth);
  if (!data) return;
  const x = Math.max(room.x, stairs.x - 2);
  monsters.push(newMonster(data, x, stairs.y, { elite: true })); // elite:エリートの印(名前・色・強さ・ドロップが変わる)
}

// 生きている、階段を守っているエリート(いなければ null。墓守は含まない)
function aliveElite() {
  return monsters.find(m => m.elite && !m.guardian) || null;
}

// 階段が封印されているか(エリートが生きている間)
function stairsSealed() {
  return aliveElite() !== null;
}

// 敵の表示名(エリートなら「エリート〇〇」)
function monsterName(m) {
  if (m.guardian) return `墓守の${m.data.name}`;
  return m.elite ? `エリート${m.data.name}` : m.data.name;
}

// エリートの階に降りたときのお知らせ
function announceElite() {
  const elite = aliveElite();
  if (elite) addLog(`${monsterName(elite)}が階段を守っている！ 倒すまで階段は封印されている`);
}

// 階 d の敵の段階(enemyGrowthFromFloor 階より浅ければ 0。そこから enemyTierFloors 階ごとに +1)
function enemyTier(d) {
  if (d < BALANCE.enemyGrowthFromFloor) return 0;
  return Math.floor((d - BALANCE.enemyGrowthFromFloor) / BALANCE.enemyTierFloors) + 1;
}

// 階 d の敵のHP・攻撃力にかかる倍率(段階ごとに増える)
function enemyHpRate(d) {
  return 1 + enemyTier(d) * BALANCE.enemyHpGrowthPerTier;
}
function enemyAttackRate(d) {
  return 1 + enemyTier(d) * BALANCE.enemyAttackGrowthPerTier;
}

// 今いる階の敵のHP・攻撃力にかかる倍率(深さの段階 × 選んだ道の効果)
function floorHpRate() {
  return enemyHpRate(depth) * routeFx("enemyHp", 1);
}
function floorAttackRate() {
  return enemyAttackRate(depth) * routeFx("enemyAttack", 1);
}

// 敵を1体作る(この階の強さで)。extra に { elite: true } などを渡せる
//   hp / maxHp:今のHPと最大HP(トロルの回復に使う) / data:名前・記号・攻撃力などは data から読む
//   energy:行動力。毎ターン speed ずつたまり、1 たまるごとに1回行動する
function newMonster(data, x, y, extra = {}) {
  let hp = Math.round((data.hp + (depth - 1) * data.hpPerDepth) * floorHpRate());
  if (extra.elite) hp = Math.round(hp * BALANCE.eliteHpMultiplier);
  // facing:向き(最初はランダム)。hunting:プレイヤーに気づいているか(最初は気づいていない)
  return { x, y, hp, maxHp: hp, data, energy: 0, facing: DIRS4[randInt(0, 3)], hunting: false, ...extra };
}

// ==================== 階段の道 ====================
// 階段を降りるとき、次の階への「道」を選ぶ(階段 → 道を選ぶ → キャンプ → 次の階)
//   選んだ道の効果は、次の1階だけ
// 道を増やすときは、ここに { id, name, desc, ... } を足す
//   id:区別するための名前 / name:表示名 / desc:説明文を返す関数
//   always:true なら毎回必ず出る(それ以外の道は、毎回 routeExtraMin〜routeExtraMax 個だけランダムに出る)
//   available:出せるかどうかを返す関数(省略すると、いつでも出せる)
//   fx:次の階での効果(書いていないものは「ふつう」のまま)
//     enemyHp / enemyAttack:敵のHP・攻撃力の倍率 / spawnRate:部屋に敵がいる確率の倍率
//     materialRate:敵が落とす素材の倍率 / dropRate:固有装備のドロップ率の倍率
//     itemsMin / itemsMax:床に落ちている装備の数
//   fall:true なら、一気に何階か下へ落ちる(落ちる先は holeTarget で決める)
const STAIR_ROUTES = [
  { id: "normal", name: "ふつうの道", always: true, fx: {},
    desc: () => "いつも通りの道" },
  { id: "rough", name: "険しい道", fx: BALANCE.routeRough,
    desc: () => `敵のHP・攻撃力が${BALANCE.routeRough.enemyHp}倍で、敵も多い。そのかわり素材が${BALANCE.routeRough.materialRate}倍、固有装備が${BALANCE.routeRough.dropRate}倍出やすい` },
  { id: "quiet", name: "静かな道", fx: BALANCE.routeQuiet,
    desc: () => `敵の数が半分くらい。そのかわり床の装備は${BALANCE.routeQuiet.itemsMin}〜${BALANCE.routeQuiet.itemsMax}個` },
  { id: "hole", name: "深い穴", fx: {}, fall: true,
    available: () => holeTarget(depth) > depth + 1, // 1階しか落ちられないときは出さない
    desc: () => `一気に地下${holeTarget(depth)}階まで落ちる。途中の階の装備や素材は手に入らない` },
];

let routeChoices = [];           // 道を選ぶ画面に出している道(STAIR_ROUTES の中のもの)
let routeCursor = 0;             // 道を選ぶ画面で選んでいる行の番号
let nextRoute = null;            // 選んだ道(キャンプのあと、次の階に使う)
let floorRoute = STAIR_ROUTES[0]; // 今いる階の道(ステータス欄に表示。効果はこの階だけ)

// 今いる階の道の効果 key(書いていなければ def)
function routeFx(key, def) {
  const v = floorRoute.fx && floorRoute.fx[key];
  return v === undefined ? def : v;
}

// 深い穴で落ちる先:routeHoleFloors 階下
//   途中にエリートの階(10・20 …階)があれば、飛び越えずにそこで止まる。goalDepth より深くはならない
function holeTarget(d) {
  const last = Math.min(BALANCE.goalDepth, d + BALANCE.routeHoleFloors);
  for (let x = d + 1; x < last; x++) {
    if (isEliteFloor(x)) return x;
  }
  return last;
}

// 階段を降りたとき:道を選ぶ画面を出す(必ず出る道 + ランダムに1〜2個)
function openRouteSelect() {
  const pool = STAIR_ROUTES.filter(r => !r.always && (!r.available || r.available()));
  const count = Math.min(pool.length, randInt(BALANCE.routeExtraMin, BALANCE.routeExtraMax));
  const picked = [];
  while (picked.length < count) picked.push(pool.splice(randInt(0, pool.length - 1), 1)[0]);
  // 並び順は STAIR_ROUTES に書いた順にそろえる
  routeChoices = STAIR_ROUTES.filter(r => r.always || picked.includes(r));
  routeCursor = 0;
  screenMode = "route";
  render();
}

// 道を選ぶ画面で Enter:道を決めて、キャンプへ
function chooseRoute() {
  nextRoute = routeChoices[routeCursor];
  addLog(`${nextRoute.name}を選んだ`);
  questEvent("onRoute", nextRoute); // 「険しい道を〇回選ぶ」の依頼
  openCamp();
}

// 次に降りる階(深い穴なら何階か下)
function nextDepth() {
  return nextRoute && nextRoute.fall ? holeTarget(depth) : depth + 1;
}

// 新しい階へ移る(キャンプのあと・デバッグ)。route:その階の道
function goToFloor(newDepth, route = STAIR_ROUTES[0]) {
  const prev = depth;
  depth = newDepth;
  floorRoute = route;
  onNewFloorBuffs(); // 砥石・狂熱の香薬はこの階まで。忍び足の香は残りの階数が1つ減る
  makeMap();
  addLog(route.fall ? `深い穴に飛びこんだ…地下${depth}階まで落ちてきた` : `地下${depth}階に降りた`);
  if (layerOf(depth) !== layerOf(prev)) addLog(`――${layerOf(depth).name}に入った。ここから先は、さらに厳しくなる`);
  announceElite();
  announceGrave();
  questEvent("onFloor"); // 到達の依頼
}

// ==================== キャンプ ====================
// キャンプで選べること。選択肢を増やすときは、ここに { name, desc, apply } を足す
//   name:表示名 / desc:説明文を返す関数 / apply:選んだときの処理
//   pickEquip:true にすると、選んだあとに装備を1つ選ぶ画面が出る(apply には選んだ装備が渡される)
//   available:選べるかどうかを返す関数(省略すると、いつでも選べる)
const CAMP_OPTIONS = [
  {
    name: "休む",
    // 特性「野営上手」で回復量アップ(回復強化とは別に掛け算)
    desc: () => `HPを最大HPの${fmt(BALANCE.campHealRatio * 100)}%回復する${traitMax("campRestBoost", 0) > 0 ? `(野営上手で+${Math.round(traitMax("campRestBoost", 0) * 100)}%)` : ""}`,
    apply: () => {
      const heal = Math.min(maxHP - playerHP, Math.round(maxHP * BALANCE.campHealRatio * healMultiplier() * (1 + traitMax("campRestBoost", 0))));
      playerHP += heal;
      addLog(`キャンプで休んだ。HPが${heal}回復`);
    },
  },
  {
    name: "回復薬を補充",
    // 特性「行商の知恵」で +1個
    desc: () => `回復薬を${campPotionAmount()}個もらう(今 ${potions}個)`,
    apply: () => {
      potions += campPotionAmount();
      addLog(`回復薬を${campPotionAmount()}個補充した`);
    },
  },
  {
    name: "装備を強化",
    // 特性「鍛冶の心得」で2回強化する
    desc: () => `拾った装備を1つ、強化前の性能の${BALANCE.enhanceMinPercent}〜${BALANCE.enhanceMaxPercent}%ぶん強化する${campEnhanceTimes() > 1 ? `(鍛冶の心得で${campEnhanceTimes()}回)` : ""}(何回でも。素材は使わない)`,
    pickEquip: true,
    available: () => runPickups.length > 0,
    apply: (eq) => { for (let i = 0; i < campEnhanceTimes(); i++) enhanceEquipment(eq); },
  },
];

// キャンプの「回復薬を補充」でもらえる数(特性「行商の知恵」で増える)
function campPotionAmount() {
  return BALANCE.campPotionGain + traitMax("campPotionBonus", 0);
}

// キャンプの「装備を強化」で強化する回数(特性「鍛冶の心得」で増える)
function campEnhanceTimes() {
  return traitMax("campEnhanceTimes", 1);
}

let campPicking = false;   // キャンプで、装備を選んでいる最中か
let campPickCursor = 0;    // 装備を選ぶ一覧で選んでいる行の番号

function openCamp() {
  campCursor = 0;
  campPicking = false;
  screenMode = "camp";
  render();
}

// キャンプで強化する装備の一覧(装備中のものを枠の順に先に、そのあと持っているだけのもの)
function campEquipList() {
  const worn = Object.keys(EQUIP_SLOTS).map(s => equipped[s]).filter(eq => eq);
  return [...worn, ...runPickups.filter(eq => !worn.includes(eq))];
}

// 装備を1回強化する(上限なし)
//   上がる量は「強化前の性能(baseStats)」の5〜15%。毎回同じくらいずつ上がる(何回も強化しても強くなりすぎない)
//   強化する前の性能は baseStats に残っていて、刻むときもそちらを使う
function enhanceEquipment(eq) {
  const pct = rollEnhancePercent();
  const diff = applyEnhance(eq.stats, pct, eq.baseStats);
  eq.plus = (eq.plus || 0) + 1;
  if (equippedSlotOf(eq)) updateMaxHP(); // 着けている装備のHPが上がったら、最大HPも上げる
  addLog(`${pct >= 13 ? "大成功！ " : ""}${eq.name}を+${eq.plus}に強化した(+${pct}%) ${diff}`);
}

// キャンプで Enter:選んだものを実行して次の階へ(装備を選ぶものなら、先に装備の一覧を開く)
function chooseCamp() {
  const opt = CAMP_OPTIONS[campCursor];
  if (opt.available && !opt.available()) {
    addLog(`今は「${opt.name}」を選べない`);
    render();
    return;
  }
  if (opt.pickEquip && !campPicking) {
    campPicking = true;
    campPickCursor = 0;
    render();
    return;
  }
  turn += 1;
  // 毒・やけど・衰弱・鈍足はキャンプで治る
  const hadDots = cureDots();
  if (hadDots || playerWeak || playerSlow) {
    playerWeak = null;
    playerSlow = null;
    addLog("キャンプで一息ついて、体の調子が戻った");
  }
  if (opt.pickEquip) opt.apply(campEquipList()[campPickCursor]);
  else opt.apply();
  campPicking = false;
  // 選んだ道で、次の階へ(深い穴なら何階か下へ)
  goToFloor(nextDepth(), nextRoute || STAIR_ROUTES[0]);
  nextRoute = null;
  screenMode = "dungeon";
  render();
}
