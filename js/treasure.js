// 宝箱・ミミック・謎の塊
// index.html から <script src> で読み込まれる(読み込む順番は index.html に書いてある)

// ==================== 宝箱 ====================
// 階に宝箱が置かれていることがある(chestChance)。上に乗ると開いて、中の装備を拾う
//   中身:ふつうは床の装備。chestMonsterGearChance の確率で、この階に出る敵の固有装備(隠し装備は出ない)
let chests = []; // この階の宝箱。1個の形:{ x, y }

function chestAt(x, y) {
  return chests.find(c => c.x === x && c.y === y) || null;
}

// 部屋の一覧 rooms のどこかの空いている床に、宝箱を1つ置く(空きが見つからなければ置かない)
function placeChest(rooms) {
  if (rooms.length === 0) return;
  for (let i = 0; i < 30; i++) {
    const r = rooms[randInt(0, rooms.length - 1)];
    const x = randInt(r.x, r.x + r.w - 1), y = randInt(r.y, r.y + r.h - 1);
    if (map[y][x] !== "." || monsterAt(x, y) || itemAt(x, y) || chestAt(x, y)) continue;
    if ((x === px && y === py) || (stairs && x === stairs.x && y === stairs.y)) continue;
    // mimicChance の確率で、宝箱のかわりにミミック(宝箱に化けた敵)を置く
    const mimic = monsterList.find(m => m.id === "mimic");
    if (mimic && depth >= mimic.minDepth && chance(BALANCE.mimicChance * 100) && placeMimic(x, y)) return;
    chests.push({ x, y });
    return;
  }
}

// ==================== ミミック ====================
// 宝箱に化けた敵(monsters.js の mimic)。化けているあいだ(disguised)は、マップでは宝箱と同じに見え、動かない
//   見分け方:マウスを合わせる(スマホはタップ)と、名前が少しおかしい(fakeName)
//   上に乗ろうとすると正体を現して、すぐ1回噛みつく(revealMimic)。道具を当てても正体を現す(噛みつかない)
//   倒すと、宝箱の中身を落とす(dropMimicTreasure)
// 化けているときの、おかしな名前の候補(宝箱に似ているけれど、どこか違う)
const MIMIC_FAKE_NAMES = ["宝笛", "玉箱", "宅箱", "宝相", "宝箸", "宝稲", "宝箱箱", "主箱"];

// (x, y) に、宝箱に化けたミミックを置く。置けたら true
function placeMimic(x, y) {
  const data = monsterList.find(m => m.id === "mimic");
  if (!data) return false;
  const fakeName = MIMIC_FAKE_NAMES[randInt(0, MIMIC_FAKE_NAMES.length - 1)];
  monsters.push(newMonster(data, x, y, { disguised: true, fakeName }));
  return true;
}

// ミミックが正体を現す。bite:true ならそのまま1回噛みつく(上に乗ろうとしたとき)
function revealMimic(m, bite) {
  m.disguised = false;
  m.hunting = true;
  m.justNoticed = true; // 正体を現したターンは、もう動かない(噛みつきは下でする)
  addLog(`宝箱は${monsterName(m)}だった！`);
  if (bite) hitPlayer(monsterPower(m), { label: `${monsterName(m)}の噛みつき`, cause: monsterName(m), killer: m.data.id });
}

// ミミックを倒したとき:宝箱と同じ中身を、その場に落とす(chestDoubleChance で2個)
function dropMimicTreasure(m) {
  const count = chance(BALANCE.chestDoubleChance * 100) ? 2 : 1;
  for (let i = 0; i < count; i++) {
    const eq = makeChestEquipment();
    if (eq) items.push({ x: m.x, y: m.y, equip: eq });
  }
  addLog(`${monsterName(m)}がため込んでいた装備を落とした！`);
}

// 宝箱を開ける(上に乗ったとき):中の装備を拾う
function openChest(chest) {
  chests = chests.filter(c => c !== chest);
  addLog("宝箱を開けた！");
  // chestDoubleChance の確率で、装備が2個入っている
  const count = chance(BALANCE.chestDoubleChance * 100) ? 2 : 1;
  if (count > 1) addLog("中に装備が2つ入っていた！");
  for (let i = 0; i < count; i++) {
    const eq = makeChestEquipment();
    if (eq) pickUpEquipment(eq);
  }
}

// 宝箱の中身の装備を1個作る(この階の強さで)
function makeChestEquipment() {
  const data = pickTreasureData();
  return data ? makeEquipment(data, depth) : null;
}

// 宝箱・謎の塊から出る装備の種類を選ぶ(equipment.js の1行)
//   ふつうは床の装備。chestMonsterGearChance の確率で、この階に出る敵の固有装備(隠し装備は出ない)
function pickTreasureData() {
  if (chance(BALANCE.chestMonsterGearChance * 100)) {
    // この階に出る敵のうち、固有装備を持っている敵から1体選び、その装備から1つ
    const hasGear = m => equipmentList.some(e => e.from === m.id && !e.hidden);
    const m = pickWeighted(monsterList.filter(hasGear), depth);
    const data = m && pickWeighted(equipmentList.filter(e => e.from === m.id && !e.hidden), depth);
    if (data) return data;
  }
  return pickEquipmentData(depth, "field");
}

// ==================== 謎の塊 ====================
// 敵がまれに落とす(lumpDropChance)。拾うと持ち物の「道具」タブに入る
//   キャンプに入ると、持っている謎の塊を全部鑑定して、レア度つきの装備になる(レア度の表は config.js の RARITY_TYPES)
//   鑑定する前に死ぬと、なくなる
let runLumps = 0; // この冒険で持っている謎の塊の数

// 倒した敵 m が、謎の塊をその場に落とすか(エリートは落としやすい。運で少し上がる)
function dropLump(m) {
  const rate = BALANCE.lumpDropChance * luckDropMultiplier() * (m.elite ? BALANCE.eliteDropMultiplier : 1);
  if (!debugAlwaysDrop() && Math.random() >= rate) return;
  items.push({ x: m.x, y: m.y, lump: true });
  addLog(`${monsterName(m)}が謎の塊を落とした！`);
}

// 謎の塊を拾った
function gainLump() {
  runLumps += 1;
  addLog(`謎の塊を拾った！ キャンプで鑑定される(${runLumps}個)`);
}

// キャンプに入ったとき:持っている謎の塊を全部鑑定する(この階の強さの、レア度つきの装備になる)
function identifyLumps() {
  if (runLumps === 0) return;
  addLog(`謎の塊を${runLumps}個、鑑定した…`);
  for (; runLumps > 0; runLumps--) {
    const data = pickTreasureData();
    if (!data) continue;
    const rarity = rollRarity();
    addLog(`${rarity.name}の${data.name}が出てきた！`);
    pickUpEquipment(makeEquipment(data, depth, false, rarity));
  }
}
