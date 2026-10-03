// エリート・敵の強さ(階が深いほど強くなる)
// index.html から <script src> で読み込まれる(読み込む順番は index.html に書いてある)

// ==================== エリート ====================
// 決まった階(10, 20, 30 …階)には、階段の部屋にエリートが1体だけいる
//   エリートを倒すまで階段は封印されていて、降りられない
//   倒すと、死んだときに刻める数が +1 される
function isEliteFloor(d) {
  return d % BALANCE.eliteEveryFloors === 0;
}

// 階段の部屋に、この階で出る敵を1種類選んでエリートとして置く(階段の2マス左)
//   出てきたばかりの敵(出始めてから eliteMinFloorsSeen 階以内)と、noElite の敵(宝石虫など)はエリートにならない
function placeElite(room) {
  const able = monsterList.filter(m => !m.noElite);
  const pool = able.filter(m => m.minDepth <= depth - BALANCE.eliteMinFloorsSeen);
  const data = pickWeighted(pool.length > 0 ? pool : able, depth);
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

// 階 d までに、敵の「1階ごとの上がり幅」を何回ぶん足すか(kind:"hp" か "attack")
//   2〜10階は1階につき1回ぶん。enemySteepFromFloor 階からは、1階につき enemySteepHp / enemySteepAttack 回ぶん
//   さらに、その階の層の enemySlope 倍(中層・深層 … ほど、1階降りるごとに強くなる量が大きい)
function enemySteps(d, kind) {
  const steep = kind === "hp" ? BALANCE.enemySteepHp : BALANCE.enemySteepAttack;
  let steps = 0;
  for (let x = 2; x <= d; x++) {
    steps += x < BALANCE.enemySteepFromFloor ? 1 : steep * layerOf(x).enemySlope;
  }
  return steps;
}

// 今いる階での、敵の数値(HP・攻撃力・毒などのダメージ)
//   base:1階での値 / perDepth:1階ごとの上がり幅(monsters.js の hpPerDepth など) / kind:"hp" か "attack"
//   = (base + perDepth × 上がった回数) × 層の段差(enemyBoost) × 選んだ道の倍率(険しい道)
function enemyStat(base, perDepth, kind) {
  const route = kind === "hp" ? routeFx("enemyHp", 1) : routeFx("enemyAttack", 1);
  return (base + (perDepth || 0) * enemySteps(depth, kind)) * layerOf(depth).enemyBoost * route;
}

// 敵を1体作る(この階の強さで)。extra に { elite: true } などを渡せる
//   hp / maxHp:今のHPと最大HP(トロルの回復に使う) / data:名前・記号・攻撃力などは data から読む
//   energy:行動力。毎ターン speed ずつたまり、1 たまるごとに1回行動する
function newMonster(data, x, y, extra = {}) {
  let hp = Math.round(enemyStat(data.hp, data.hpPerDepth, "hp"));
  if (extra.elite) hp = Math.round(hp * BALANCE.eliteHpMultiplier);
  // facing:向き(最初はランダム)。hunting:プレイヤーに気づいているか(最初は気づいていない)
  // calm:こちらから攻撃されるまで襲ってこない(monsters.js で aloof の敵。龍)
  return { x, y, hp, maxHp: hp, data, energy: 0, facing: DIRS4[randInt(0, 3)], hunting: false, calm: !!data.aloof, ...extra };
}
