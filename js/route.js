// 階段の道(分かれ道)・次の階へ進む
// index.html から <script src> で読み込まれる(読み込む順番は index.html に書いてある)

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
  { id: "dark", name: "暗闇の道", fx: BALANCE.routeDark,
    desc: () => `真っ暗で、周り${BALANCE.routeDark.sightRadius}マスしか見えない。部屋が少なく、敵が多い。そのかわり宝箱が必ずある` },
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
  if (route.id === "dark") addLog("あたりは真っ暗だ。周りしか見えない…");
  fadeInFloor(); // 演出:暗いところから、ふわっと明るくなる
  playSE("stairs"); // 効果音(js/sound.js)
  if (layerOf(depth) !== layerOf(prev)) {
    addLog(`――${layerOf(depth).name}に入った。ここから先は、さらに厳しくなる`);
    showBanner(layerOf(depth).name, `地下${depth}階`, "banner-layer"); // 演出:層の名前を大きく出す
  }
  announceElite();
  announceGrave();
  checkTreasureMaps(); // 過ぎた地図は消える。地図の階なら知らせる
  questEvent("onFloor"); // 到達の依頼
}
