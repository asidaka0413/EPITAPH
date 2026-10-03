// 敵の特殊な技:分裂・爆発・炎・呼び出し・ドラゴンの球とブレス・ガーゴイルの大技・竜人の突進・ドラゴンゾンビの吸収と爆発
// index.html から <script src> で読み込まれる(読み込む順番は index.html に書いてある)

// ==================== 分裂・爆発 ====================
// スライムの分裂:残りHPを半分ずつに分けて、となりの空いているマスにもう1体出す(どちらももう分裂しない)
function splitMonster(m) {
  m.splitDone = true;
  const spot = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([sx, sy]) => [m.x + sx, m.y + sy])
    .find(([x, y]) => !isBlockedForMonster(x, y));
  if (!spot || m.hp < 2) return;
  const half = Math.ceil(m.hp / 2);
  m.hp = half;
  const child = newMonster(m.data, spot[0], spot[1], { splitDone: true, hunting: true, facing: m.facing }); // 分かれたほうも気づいている
  child.hp = half;
  child.maxHp = m.maxHp;
  monsters.push(child);
  addLog(`${monsterName(m)}が分裂した！`);
}

// 爆ぜ虫の爆発:周り8マスにいれば大ダメージ(回避できない)。エリートは爆発しても倒れない
function explode(m, ab) {
  const name = monsterName(m);
  m.primed = false;
  if (Math.abs(px - m.x) <= 1 && Math.abs(py - m.y) <= 1) {
    hitPlayer(monsterPower(m, ab.damageMin, ab.damageMax), { label: `${name}の爆発`, cause: name, killer: m.data.id, evadable: false, canCrit: false, category: "explosion" });
  } else {
    addLog(`${name}が爆発した！ 巻きこまれずにすんだ`);
  }
  if (!m.elite) monsters = monsters.filter(x => x !== m); // 爆発したら消える(経験値・ドロップはなし)
}

// ==================== 炎 ====================
// 鬼火が放つ炎。プレイヤーを追いかけてきて、当たるとダメージ。turns ターンで消える
//   プレイヤーがぶつかると消せる(1ターン使う)
let flames = [];   // 1個の形:{ x, y, turns: 残りターン, power: ダメージの元, owner: 放った敵の名前 }

function flameAt(x, y) {
  return flames.find(f => f.x === x && f.y === y) || null;
}

// 鬼火のとなり(プレイヤーのいる向き)に炎を出す
function spawnFlame(m, ab) {
  const dx = px - m.x, dy = py - m.y;
  const [sx, sy] = Math.abs(dx) >= Math.abs(dy) ? [Math.sign(dx), 0] : [0, Math.sign(dy)];
  const x = m.x + sx, y = m.y + sy;
  if (map[y][x] === "#") return;
  const flame = { x, y, turns: ab.turns, power: monsterPower(m), owner: monsterName(m), ownerId: m.data.id };
  addLog(`${flame.owner}が炎を放った！`);
  if (x === px && y === py) { flameHit(flame, [Math.sign(m.x - px), Math.sign(m.y - py)]); return; }
  flames.push(flame);
}

// 炎が当たった(回避できない。DEF で軽減できる。飛んできた方向を向いていれば盾でも減らせる)
//   from:プレイヤーから見て、炎が来た方向
function flameHit(flame, from) {
  hitPlayer(flame.power, { label: `${flame.owner}の炎`, cause: `${flame.owner}の炎`, killer: flame.ownerId, evadable: false, canCrit: false, from, category: "ranged", element: "fire" });
}

// 炎がそれぞれ1マス、プレイヤーに向かって動く(壁は通れない)。ぶつかったら消える
function flamesAct() {
  for (const f of flames.slice()) {
    const dx = px - f.x, dy = py - f.y;
    const from = [Math.sign(f.x - px), Math.sign(f.y - py)]; // 動く前の位置(当たったとき、この方向から来たことになる)
    const tries = Math.abs(dx) >= Math.abs(dy) ? [[Math.sign(dx), 0], [0, Math.sign(dy)]] : [[0, Math.sign(dy)], [Math.sign(dx), 0]];
    for (const [sx, sy] of tries) {
      if ((sx || sy) && map[f.y + sy][f.x + sx] !== "#") { f.x += sx; f.y += sy; break; }
    }
    if (f.x === px && f.y === py) {
      flames = flames.filter(x => x !== f);
      flameHit(f, from);
      if (playerHP <= 0) return;
      continue;
    }
    f.turns -= 1;
    if (f.turns <= 0) flames = flames.filter(x => x !== f);
  }
}

// ==================== 呼び出し(死霊術師) ====================
// ability の type: "summon"。呼ばれた敵には summoned(呼ばれた印)と summoner(呼んだ敵)が付く
//   呼ばれた敵は、倒しても経験値・固有装備・書を落とさず、素材だけ落とす(combat.js の killMonster)
//   呼んだ敵を倒すと、呼ばれた敵は崩れ落ちる(素材も落とさない)
//   素材を無限に集められないよう、同時に maxAlive 体、合計 maxTotal 体まで

// となりの空いているマスに呼び出す。呼び出せたら true
function trySummon(m, ab) {
  const alive = monsters.filter(o => o.summoner === m).length;
  if (alive >= ab.maxAlive || (m.summonCount || 0) >= ab.maxTotal) return false;
  const data = monsterList.find(d => d.id === ab.summonId);
  const spot = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([sx, sy]) => [m.x + sx, m.y + sy]).find(([x, y]) => !isBlockedForMonster(x, y));
  if (!data || !spot) return false;
  monsters.push(newMonster(data, spot[0], spot[1], { summoned: true, summoner: m, hunting: true }));
  m.summonCount = (m.summonCount || 0) + 1;
  // summonVerb / summonerName:ログの言い方(瘴龍の毒蛇は「産み落とした」「瘴龍を倒すと…」)
  addLog(`${monsterName(m)}が${data.name}を${ab.summonVerb || "呼び出した"}！(${ab.summonerName || "術師"}を倒すと崩れ落ちる)`);
  return true;
}

// 呼んだ敵が倒れたとき:呼ばれた敵を崩れ落ちさせる(素材も落とさない)
function collapseSummons(summoner) {
  const list = monsters.filter(o => o.summoner === summoner);
  if (list.length === 0) return;
  monsters = monsters.filter(o => o.summoner !== summoner);
  addLog(`呼び出されていた${list.length}体が、崩れ落ちた`);
}

// ==================== ドラゴン(属性の球・ブレス) ====================
// monsters.js の ability: { type: "dragon", element, ballCooldown, breathRange, breathCooldown, breathChance, breathPower, dot }
//   通常攻撃:となりなら「ひっかき」。縦か横にまっすぐ並ぶと「属性の球」(1ターンごとに ballSpeed マス進む弾。壁に当たるまで飛ぶ)
//   特殊攻撃:扇形のブレス。溜め(当たる範囲のマスを赤く光らせる)→ 次の行動で吐く。AGL ではかわせないので、範囲の外へ動いてよける
//   球・ブレスが当たると、属性の状態異常(elements.js の dot。火ならやけど)が短く付く(ability の dot)
let balls = []; // 飛んでいる属性の球。1個の形:{ x, y, dx, dy, power, element, owner: 放った敵の名前, ownerId, dot, dotDmg }

function ballAt(x, y) {
  return balls.find(b => b.x === x && b.y === y) || null;
}

// ブレスが当たる扇形のマス(プレイヤーのいる向きに、前方 range マス)。1個の形:{ x, y, k:口から何マス目か }
//   k マス目は、左右に k-1 マスずつ広がる(90度の扇形)
//   壁の後ろには届かない:口から1マスずつ広げていき、ひとつ手前のマス(口からまっすぐ引いた線の上)に
//   ブレスが届いているときだけ、そのマスにも届く。手前が壁なら、その後ろはずっと影になる
function breathTiles(m, range) {
  const dx = px - m.x, dy = py - m.y;
  const [fx, fy] = Math.abs(dx) >= Math.abs(dy) ? [Math.sign(dx), 0] : [0, Math.sign(dy)]; // 前の向き
  const [sx, sy] = [fy, fx]; // 横の向き
  const tiles = [];
  const reached = new Set(); // 届いたマス("k,w"。k:前に何マス目 / w:横にずれた数)
  for (let k = 1; k <= range; k++) {
    for (let w = -(k - 1); w <= k - 1; w++) {
      const x = m.x + fx * k + sx * w, y = m.y + fy * k + sy * w;
      if (!map[y] || map[y][x] === undefined || map[y][x] === "#") continue;
      // ひとつ手前のマス:口からこのマスへの線を、1マス手前で見たときの横のずれ(0 に近いほうへ切り捨て)
      const parentW = Math.trunc(w * (k - 1) / k);
      if (k > 1 && !reached.has(`${k - 1},${parentW}`)) continue;
      reached.add(`${k},${w}`);
      tiles.push({ x, y, k });
    }
  }
  return tiles;
}

// ブレスを溜め始める(吐けるとき・プレイヤーが範囲に入っているとき・breathChance の確率で)。溜め始めたら true
function tryStartBreath(m, ab, dist) {
  if (m.breathCd > 0 || dist > ab.breathRange || Math.random() >= ab.breathChance) return false;
  const tiles = breathTiles(m, ab.breathRange);
  if (!tiles.some(t => t.x === px && t.y === py)) return false;
  m.charging = true;
  m.chargeTurn = turn;
  m.breathTiles = tiles;
  m.breathCd = ab.breathCooldown;
  addLog(`${monsterName(m)}が大きく息を吸いこんだ！ 赤く光るマスから離れろ`);
  return true;
}

// 溜めていたブレスを吐く(溜めたときの範囲に、今プレイヤーがいれば当たる)
//   口から遠いほどダメージが下がる(1マス離れるごとに breathFalloff)
// 演出:技を放った瞬間、範囲のマスを cls の色で光らせる(js/screens.js の addTileFx。ブレスは fx-el-属性)
function flashTiles(tiles, cls) {
  for (const t of tiles) addTileFx(t.x, t.y, cls, 450);
}

function breathFire(m, ab) {
  const name = monsterName(m), el = ELEMENT_DATA[ab.element];
  const tiles = m.breathTiles || [];
  m.charging = false;
  m.breathTiles = null;
  flashTiles(tiles, `fx-el-${ab.element}`);
  playSE(`skill_${ab.element}`); // 効果音(属性ごと。js/sound.js)
  // 凛龍:ブレスの跡が、しばらく凍った床になる(当たっても外れても)
  if (ab.iceFloor) addTempHazardTiles(tiles, "ice", ab.iceFloor.turns);
  const hitTile = tiles.find(t => t.x === px && t.y === py);
  if (!hitTile) {
    addLog(`${name}の${el.name}のブレス！ …範囲の外に逃れた`);
    return;
  }
  const rate = Math.max(0, 1 - BALANCE.breathFalloff * (hitTile.k - 1));
  const power = Math.round(monsterPower(m) * ab.breathPower * rate);
  const hit = hitPlayer(power, { label: `${name}の${el.name}のブレス${rate < 1 ? `(${Math.round(rate * 100)}%)` : ""}`, cause: name,
    killer: m.data.id, evadable: false, canCrit: false, category: "breath", element: ab.element });
  if (hit && playerHP > 0) elementDot(ab.element, ab.dot, elementDotDamage(m, ab), name, m.data.id);
}

// ==================== 凛龍の技(氷の壁・凍てつく風) ====================
// 氷の壁:離れている(minDist マス以上)と chance の確率で、こちらの後ろ(龍と反対側)に3マスの氷の壁を立てる。立てたら true
//   壁は turns ターンで溶ける。殴ると壊れる(壁そのものは js/hazard.js の「氷の壁」)
function tryIceWall(m, cfg, dist) {
  if (m.iceWallCd > 0 || dist < cfg.minDist || Math.random() >= cfg.chance) return false;
  const dx = px - m.x, dy = py - m.y;
  const [fx, fy] = Math.abs(dx) >= Math.abs(dy) ? [Math.sign(dx), 0] : [0, Math.sign(dy)]; // 龍から見たこちらの向き
  const bx = px + fx, by = py + fy; // こちらの真後ろ
  let placed = 0;
  for (const w of [-1, 0, 1]) {
    if (addIceWall(bx + fy * w, by + fx * w, cfg.turns)) placed++;
  }
  if (placed === 0) return false;
  m.iceWallCd = cfg.cooldown;
  playSE("skill_ice"); // 効果音(js/sound.js)
  addLog(`${monsterName(m)}が氷の壁を立てて、逃げ道をふさいだ！(殴れば割れる)`);
  return true;
}

// 凍てつく風:HP が最大の below 以下になると、周り radius マス(壁ごしには届かない)にいるだけで凍える(turns ターン。いるあいだ切れない)
function frostAura(m, cfg) {
  if (m.hp > m.maxHp * cfg.below) return;
  if (!m.auraOn) {
    m.auraOn = true;
    playSE("skill_ice"); // 効果音(js/sound.js)
    addLog(`${monsterName(m)}の周りに、凍てつく風が吹き荒れ始めた！(周り${cfg.radius}マスにいると凍える)`);
  }
  if (Math.max(Math.abs(px - m.x), Math.abs(py - m.y)) > cfg.radius || !sightClear(m.x, m.y, px, py)) return;
  ailPlayer("chill", cfg.turns);
}

// ==================== 霹龍の技(落雷・電光石火) ====================
// 落雷:怒っている霹龍がいるあいだ、毎ターン count か所に印が出て、次のターンの終わりにそこへ雷が落ちる(1マス)
//   印のうち near か所は、こちらの周り nearRadius マス以内。残りは階のどこか。印のマスは黄色く点滅する(screens.js の drawDungeon)
//   こちらに落ちたら、霹龍の攻撃力 × power(回避できない・盾も効かない)としびれ。ほかの敵にも同じダメージ(霹龍は平気)
//   落雷で倒れた敵は、こちらが倒したのと同じ扱い(経験値・ドロップあり。印の上に誘いこむと得)
let lightningMarks = []; // 1個の形:{ x, y, power, owner: 霹龍の名前, ownerId, dot }

function lightningMarkAt(x, y) {
  return lightningMarks.find(l => l.x === x && l.y === y) || null;
}

// ターンの終わり(敵が動いたあと):前のターンの印に雷が落ちて、怒っている霹龍が新しい印を出す
function lightningAct() {
  const strikes = lightningMarks;
  lightningMarks = [];
  if (strikes.length > 0) {
    screenFlash("bolt"); // 演出:雷が落ちた瞬間、画面がほんの一瞬だけ明るくなる
    playSE("skill_thunder"); // 効果音(js/sound.js)
  }
  for (const l of strikes) {
    if (l.x === px && l.y === py) {
      const hit = hitPlayer(l.power, { label: `${l.owner}の落雷`, cause: l.owner, killer: l.ownerId, evadable: false, canCrit: false,
        category: "ranged", element: "thunder" });
      if (hit && playerHP > 0) elementDot("thunder", l.dot, 0, l.owner, l.ownerId);
      if (playerHP <= 0) return;
    }
    const t = monsterAt(l.x, l.y);
    if (t && t.data.id !== l.ownerId && !t.disguised && !t.dormant && !inWall(t)) {
      t.hp -= l.power;
      addPopup(t.x, t.y, l.power, "pop-dmg"); // 演出:ダメージの数字が浮かぶ
      meteorGuard(t); // ベヒーモス:詠唱中は倒れない
      if (t.hp <= 0) killMonster(t, `${monsterName(t)}に雷が落ちた！ ${l.power}のダメージ！ ${monsterName(t)}は倒れた！`);
      else addLog(`${monsterName(t)}に雷が落ちた！ ${l.power}のダメージ！`);
    }
  }
  for (const m of monsters) {
    const ab = m.data.ability || {};
    if (ab.lightning && !m.calm) placeLightning(m, ab);
  }
}

// 霹龍 m が落雷の印を出す
function placeLightning(m, ab) {
  const cfg = ab.lightning;
  const free = (x, y) => map[y] && map[y][x] === "." && !(x === m.x && y === m.y) && !lightningMarkAt(x, y);
  const add = (x, y) => lightningMarks.push({ x, y, power: Math.round(monsterPower(m) * cfg.power), owner: monsterName(m), ownerId: m.data.id, dot: ab.dot });
  // こちらの周り(nearRadius マス以内)に near か所
  const near = [];
  for (let y = py - cfg.nearRadius; y <= py + cfg.nearRadius; y++) {
    for (let x = px - cfg.nearRadius; x <= px + cfg.nearRadius; x++) if (free(x, y)) near.push([x, y]);
  }
  for (let i = 0; i < cfg.near && near.length > 0; i++) {
    const [x, y] = near.splice(randInt(0, near.length - 1), 1)[0];
    add(x, y);
  }
  // 残りは階のどこか(床を何回か選び直す)
  for (let i = 0, placed = 0; placed < cfg.count - cfg.near && i < 200; i++) {
    const x = randInt(1, BALANCE.mapWidth - 2), y = randInt(1, BALANCE.mapHeight - 2);
    if (!free(x, y)) continue;
    add(x, y);
    placed++;
  }
}

// 電光石火:minDist マス以上離れていると chance の確率で、こちらのとなりへ一瞬で移動して、すぐ殴る。動いたら true
function tryBlink(m, cfg, dist) {
  if (m.blinkCd > 0 || dist < cfg.minDist || Math.random() >= cfg.chance) return false;
  const spots = DIRS4.map(([dx, dy]) => [px + dx, py + dy])
    .filter(([x, y]) => map[y] && map[y][x] === "." && !monsterAt(x, y));
  if (spots.length === 0) return false;
  const [x, y] = spots[randInt(0, spots.length - 1)];
  m.x = x;
  m.y = y;
  faceToward(m);
  m.blinkCd = cfg.cooldown;
  playSE("skill_thunder"); // 効果音(js/sound.js)
  const name = monsterName(m);
  addLog(`${name}が稲妻のように、目の前に現れた！`);
  hitPlayer(Math.round(monsterPower(m) * cfg.power), { label: `${name}の電光石火`, cause: name, killer: m.data.id });
  return true;
}

// ==================== 焔龍の技(マグマ・爆炎) ====================
// マグマ:怒っているあいだ、行動のたびに chance の確率で、周り radius マスの床 count マスに、turns ターンで消えるマグマが噴き出す
//   こちらの足元には出さない(よけられるように)。行動のついでに起きる(cooldown 回の行動に1回まで)
function magmaBurst(m, cfg) {
  if (m.magmaCd > 0 || Math.random() >= cfg.chance) return;
  const spots = [];
  for (let y = m.y - cfg.radius; y <= m.y + cfg.radius; y++) {
    for (let x = m.x - cfg.radius; x <= m.x + cfg.radius; x++) {
      if (map[y] && map[y][x] === "." && !(x === m.x && y === m.y) && !(x === px && y === py) && !hazardAt(x, y)) spots.push({ x, y });
    }
  }
  if (spots.length === 0) return;
  const tiles = [];
  for (let i = 0; i < cfg.count && spots.length > 0; i++) tiles.push(spots.splice(randInt(0, spots.length - 1), 1)[0]);
  addTempHazardTiles(tiles, "magma", cfg.turns);
  m.magmaCd = cfg.cooldown;
  playSE("skill_fire"); // 効果音(js/sound.js)
  addLog(`${monsterName(m)}の周りから、マグマが噴き出した！`);
}

// 爆炎の範囲(周り radius マス。あいだに壁があるマスには届かない)
function blazeTiles(m, radius) {
  const tiles = [];
  for (let y = m.y - radius; y <= m.y + radius; y++) {
    for (let x = m.x - radius; x <= m.x + radius; x++) {
      if ((x !== m.x || y !== m.y) && map[y] && map[y][x] === "." && sightClear(m.x, m.y, x, y)) tiles.push({ x, y });
    }
  }
  return tiles;
}

// 爆炎を溜め始める(周り radius マス以内にいるとき、chance の確率で)。溜め始めたら true
//   範囲は赤く光る(dangerTiles)。次の行動で爆発する(blazeExplode)
function tryStartBlaze(m, cfg) {
  if (m.blazeCd > 0 || Math.max(Math.abs(px - m.x), Math.abs(py - m.y)) > cfg.radius || Math.random() >= cfg.chance) return false;
  const tiles = blazeTiles(m, cfg.radius);
  if (!tiles.some(t => t.x === px && t.y === py)) return false;
  m.blazing = true;
  m.chargeTurn = turn;
  m.blazeTiles = tiles;
  m.blazeCd = cfg.cooldown;
  addLog(`${monsterName(m)}の体が赤熱していく！ 赤く光るマスから離れろ`);
  return true;
}

// 溜めていた爆炎を放つ:範囲にいれば攻撃力 × power(かわせない)とやけど。跡は magmaTurns ターンのマグマになる
function blazeExplode(m, cfg) {
  const name = monsterName(m), ab = m.data.ability;
  const tiles = m.blazeTiles || [];
  m.blazing = false;
  m.blazeTiles = null;
  flashTiles(tiles, "fx-el-fire");
  playSE("skill_fire"); // 効果音(js/sound.js)
  if (tiles.some(t => t.x === px && t.y === py)) {
    const hit = hitPlayer(Math.round(monsterPower(m) * cfg.power), { label: `${name}の爆炎`, cause: name, killer: m.data.id,
      evadable: false, canCrit: false, category: "explosion", element: "fire" });
    if (hit && playerHP > 0) elementDot("fire", ab.dot, elementDotDamage(m, ab), name, m.data.id);
  } else {
    addLog(`${name}の爆炎！ …範囲の外に逃れた`);
  }
  addTempHazardTiles(tiles, "magma", cfg.magmaTurns);
}

// ==================== 瘴龍の技(毒の霧・脱皮・毒の子) ====================
// 毒の霧:毒の球(fogCloud を書いた龍の球)が、壁・敵・こちらに当たったところの周り radius マスに、turns ターン残る霧(hazard.js の fog)
//   霧の中にいると、盲目と毒(ダメージは毒だけ)
function ballFog(b, x, y) {
  if (b.fog) addTempHazards(x, y, b.fog.radius, "fog", b.fog.turns);
}

// 脱皮:HP が最大の below 以下になると一度だけ、となりへ滑り出て最大HPの healRate 回復し、元のマスに抜け殻(shellId の敵)が残る
//   抜け殻は動かず攻撃もしない。壊すと皮が手に入る。滑り出るマスがなければ、抜け殻は残らない(回復はする)
//   呼ぶところ:攻撃が当たったあと(combat.js の playerStrike)と、行動の前(毒で減ったとき)
function checkMolt(m) {
  const cfg = m.data.ability && m.data.ability.molt;
  if (!cfg || m.molted || m.hp <= 0 || !monsters.includes(m) || m.hp > m.maxHp * cfg.below) return;
  m.molted = true;
  const ox = m.x, oy = m.y;
  const spot = DIRS8.map(([dx, dy]) => [m.x + dx, m.y + dy]).find(([x, y]) => map[y] && map[y][x] === "." && !isBlockedForMonster(x, y));
  const heal = Math.min(m.maxHp - m.hp, Math.round(m.maxHp * cfg.healRate));
  m.hp += heal;
  playSE("skill_poison"); // 効果音(js/sound.js)
  const shell =monsterList.find(d => d.id === cfg.shellId);
  if (spot && shell) {
    m.x = spot[0];
    m.y = spot[1];
    monsters.push(newMonster(shell, ox, oy));
    addLog(`${monsterName(m)}が脱皮した！ HPが${heal}回復した(${shell.name}が残った)`);
  } else {
    addLog(`${monsterName(m)}が脱皮した！ HPが${heal}回復した`);
  }
}

// 属性の状態異常を付ける(火ならやけど・氷なら凍え)。dot:{ turns, … }(ability の dot)/ dmg:毎ターンのダメージ(凍え・しびれは使わない)
function elementDot(element, dot, dmg, from, fromId) {
  const el = ELEMENT_DATA[element];
  if (!el || !dot) return;
  if (el.dot && dmg > 0) dotPlayer(el.dot, dmg, dot.turns, from, fromId);
  if (el.ailment) ailPlayer(el.ailment, dot.turns);
}

// 球・ブレスの継続ダメージ(凍え・しびれのように、dot に damage がなければ 0)
function elementDotDamage(m, ab) {
  return ab.dot && ab.dot.damage ? dotDamageOf(m, ab.dot) : 0;
}

// 属性の球を放つ(プレイヤーのいる向きのとなりのマスから)。放てたら true
function spawnBall(m, ab) {
  const dx = Math.sign(px - m.x), dy = Math.sign(py - m.y);
  const x = m.x + dx, y = m.y + dy;
  if (map[y][x] === "#" || monsterAt(x, y)) return false;
  const name = monsterName(m);
  // fresh:放ったばかり(そのターンは動かない。見てからよけられるように)
  balls.push({ x, y, dx, dy, power: monsterPower(m), element: ab.element, owner: name, ownerId: m.data.id,
               dot: ab.dot, dotDmg: elementDotDamage(m, ab), fresh: true, bounces: ab.ballBounces || 0, fog: ab.fogCloud || null });
  m.ballCd = ab.ballCooldown;
  addLog(`${name}が${ELEMENT_DATA[ab.element].ballName}を放った！`);
  return true;
}

// 属性の球が当たった(AGL ではかわせない。飛んできた方向を向いていれば盾で受けられる。DEF で減らせる)
function ballHit(b) {
  const el = ELEMENT_DATA[b.element];
  const hit = hitPlayer(b.power, { label: `${b.owner}の${el.ballName}`, cause: b.owner, killer: b.ownerId, evadable: false, canCrit: false,
    from: [-b.dx, -b.dy], category: "ranged", element: b.element });
  if (hit && playerHP > 0) elementDot(b.element, b.dot, b.dotDmg, b.owner, b.ownerId);
  ballFog(b, px, py); // 瘴龍の毒の球:当たったところに霧
}

// 属性の球がそれぞれ ballSpeed マス進む。壁・敵に当たると消える。プレイヤーに当たるとダメージ
//   放ったばかりの球は、そのターンは動かない
function ballsAct() {
  for (const b of balls.slice()) {
    if (b.fresh) {
      b.fresh = false;
      continue;
    }
    for (let i = 0; i < BALANCE.ballSpeed; i++) {
      let nx = b.x + b.dx, ny = b.y + b.dy;
      // 霹龍の雷球:壁に当たると、bounces 回まで向きを反対にして跳ね返る
      if (map[ny][nx] === "#" && b.bounces > 0) {
        b.bounces -= 1;
        b.dx = -b.dx;
        b.dy = -b.dy;
        nx = b.x + b.dx;
        ny = b.y + b.dy;
      }
      if (map[ny][nx] === "#" || monsterAt(nx, ny)) {
        balls = balls.filter(x => x !== b);
        ballFog(b, b.x, b.y); // 瘴龍の毒の球:壁・敵に当たったところ(その手前のマス)に霧
        break;
      }
      b.x = nx;
      b.y = ny;
      if (b.x === px && b.y === py) {
        balls = balls.filter(x => x !== b);
        ballHit(b);
        if (playerHP <= 0) return;
        break;
      }
    }
  }
}

// ==================== 大技(ガーゴイルの薙ぎ払い・回転切り) ====================
// monsters.js の ability: { type: "sweep", chance, cooldown, sweepPower, spinPower }
//   となり(ななめもふくむ)にいると、ときどき(chance)構える → 次の行動で大技。ブレスと同じく、当たる範囲が赤く光る
//   薙ぎ払い:前の3マス(正面と、その左右)/ 回転切り:周りの8マス。どちらを使うかは半々(プレイヤーに当たるほうだけ選ぶ)
//   AGL ではかわせないので、範囲の外へ動いてよける。cooldown 回の行動に1回まで

// 薙ぎ払いのマス(プレイヤーのいる向きの前の3マス)
function sweepTiles(m) {
  const dx = px - m.x, dy = py - m.y;
  const [fx, fy] = Math.abs(dx) >= Math.abs(dy) ? [Math.sign(dx), 0] : [0, Math.sign(dy)]; // 前の向き
  const [sx, sy] = [fy, fx]; // 横の向き
  return [-1, 0, 1].map(w => ({ x: m.x + fx + sx * w, y: m.y + fy + sy * w }))
    .filter(t => map[t.y] && map[t.y][t.x] !== undefined && map[t.y][t.x] !== "#");
}

// 回転切りのマス(周りの8マス)
function spinTiles(m) {
  const tiles = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const x = m.x + dx, y = m.y + dy;
      if ((dx || dy) && map[y] && map[y][x] !== undefined && map[y][x] !== "#") tiles.push({ x, y });
    }
  }
  return tiles;
}

// 大技を構える(となりにいるとき・chance の確率で)。構えたら true
function tryStartSweep(m, ab) {
  if (m.cooldown > 0 || Math.abs(px - m.x) > 1 || Math.abs(py - m.y) > 1 || Math.random() >= ab.chance) return false;
  const kinds = [{ kind: "sweep", tiles: sweepTiles(m) }, { kind: "spin", tiles: spinTiles(m) }]
    .filter(k => k.tiles.some(t => t.x === px && t.y === py));
  if (kinds.length === 0) return false;
  const pick = kinds[randInt(0, kinds.length - 1)];
  m.charging = true;
  m.chargeTurn = turn;
  m.chargeKind = pick.kind;
  m.breathTiles = pick.tiles; // 赤く光らせるマス(ブレスと同じ入れ物を使う)
  m.cooldown = ab.cooldown;
  addLog(`${monsterName(m)}が${pick.kind === "spin" ? "体をひねって身構えた" : "腕を大きく振りかぶった"}！ 赤く光るマスから離れろ`);
  return true;
}

// 構えていた大技を放つ(構えたときの範囲に、今プレイヤーがいれば当たる)
//   名前に注意:combat.js の sweepStrike(こちらの武器の巻きこみ)とは別。同じ名前にすると、あとから読む combat.js のほうに上書きされる
function gargoyleStrike(m, ab) {
  const name = monsterName(m), spin = m.chargeKind === "spin";
  const skill = spin ? "回転切り" : "薙ぎ払い";
  const tiles = m.breathTiles || [];
  m.charging = false;
  m.breathTiles = null;
  m.chargeKind = null;
  flashTiles(tiles, "fx-slash");
  if (!tiles.some(t => t.x === px && t.y === py)) {
    addLog(`${name}の${skill}！ …範囲の外に逃れた`);
    return;
  }
  const power = Math.round(monsterPower(m) * (spin ? ab.spinPower : ab.sweepPower));
  hitPlayer(power, { label: `${name}の${skill}`, cause: name, killer: m.data.id, evadable: false, canCrit: false });
}

// ==================== 突進(竜人) ====================
// monsters.js の ability: { type: "rush", range, chance, cooldown, rushPower, stunTurns }
//   縦か横にまっすぐ並んでいて、2〜range マス離れていると、ときどき(chance)溜める → 次の行動で一直線に突っこむ
//   溜めているあいだ、通る線が赤く光る(ブレスと同じ入れ物を使う)。かわせないので、横へ動いてよける
//   線の上にプレイヤーがいれば、その手前で止まって攻撃力 × rushPower。外れたら線の終わりまで走り、stunTurns 回動けなくなる

// 突進で通るマス(プレイヤーのいる向きに range マスまで。壁・敵の手前で止まる)
function rushTiles(m, range) {
  const sx = Math.sign(px - m.x), sy = Math.sign(py - m.y);
  const tiles = [];
  for (let i = 1; i <= range; i++) {
    const x = m.x + sx * i, y = m.y + sy * i;
    if (map[y][x] === "#" || monsterAt(x, y)) break;
    tiles.push({ x, y });
  }
  return tiles;
}

// 突進を溜める。溜めたら true
function tryStartRush(m, ab, dist) {
  if (m.cooldown > 0 || dist < 2 || dist > ab.range || !clearLineToPlayer(m) || Math.random() >= ab.chance) return false;
  m.charging = true;
  m.chargeTurn = turn;
  m.breathTiles = rushTiles(m, ab.range);
  m.cooldown = ab.cooldown;
  addLog(`${monsterName(m)}が低く身構えた！ 突進してくる。赤く光る線から離れろ`);
  return true;
}

// 溜めていた突進をする(溜めたときの線の上を、1マスずつ進む)
function rushStrike(m, ab) {
  const name = monsterName(m);
  const tiles = m.breathTiles || [];
  m.charging = false;
  m.breathTiles = null;
  if (m.data.ability.rush === ab) screenShake("small"); // ベヒーモスの突進(竜人は揺らさない)
  for (const t of tiles) {
    if (t.x === px && t.y === py) {
      const from = [Math.sign(m.x - px), Math.sign(m.y - py)]; // 正面から受ければ盾で減らせる
      hitPlayer(Math.round(monsterPower(m) * ab.rushPower), { label: `${name}の突進`, cause: name, killer: m.data.id, evadable: false, canCrit: false, from });
      return;
    }
    if (monsterAt(t.x, t.y)) break; // 溜めているあいだに、ほかの敵が入ってきた
    m.facing = [Math.sign(t.x - m.x), Math.sign(t.y - m.y)];
    m.x = t.x;
    m.y = t.y;
  }
  m.stunned = ab.stunTurns;
  addLog(`${name}の突進！ …外れて、勢い余って体勢を崩した(${ab.stunTurns}回動けない)`);
}

// ==================== ベヒーモスの技(地響き・吹き飛ばし・咆哮) ====================
// ability(type は regen のまま)に書き足す。突進は rush: { … } と書くと、竜人と同じ tryStartRush / rushStrike を使う
//   stomp:{ chance, cooldown, radius, chargeTurns, power, staggerTurns }
//     となりにいると chance の確率で前足を振り上げ、chargeTurns 回こちらが動いたあとに、周り radius マスを踏みつける(範囲は赤く光る)
//     かわせない。攻撃力 × power。当たると staggerTurns ターンよろめいて動けない(playerStagger。enemies.js の endPlayerTurn)
//   knockback:{ chance, distance, wallPower }
//     となりで殴って当たると chance の確率で、こちらを distance マス後ろへ吹き飛ばす。壁・敵にぶつかると攻撃力 × wallPower の追加ダメージ
//   roar:{ below, radius, atkUp }
//     HP が最大の below 以下になると一度だけ吼える:周り radius マスの敵が気づいて集まり、自分の攻撃力が atkUp ぶん上がる(monsterPower)

// 地響きの範囲(周り radius マス。あいだに壁があるマスには届かない。爆炎と同じ形)
function tryStartStomp(m, cfg) {
  if (m.stompCd > 0 || Math.max(Math.abs(px - m.x), Math.abs(py - m.y)) > 1 || Math.random() >= cfg.chance) return false;
  m.stomping = true;
  m.stompAt = turn + cfg.chargeTurns;
  m.stompTiles = blazeTiles(m, cfg.radius);
  m.stompCd = cfg.cooldown;
  addLog(`${monsterName(m)}が前足を高く振り上げた！ 赤く光るマスから離れろ(${cfg.chargeTurns}ターン後に踏みつける)`);
  return true;
}

// 溜めていた地響きを放つ
function stompStrike(m, cfg) {
  const name = monsterName(m);
  const tiles = m.stompTiles || [];
  m.stomping = false;
  m.stompTiles = null;
  flashTiles(tiles, "fx-quake");
  playSE("quake"); // 効果音(js/sound.js)
  if (!tiles.some(t => t.x === px && t.y === py)) {
    addLog(`${name}の地響き！ …範囲の外に逃れた`);
  } else {
    const hit = hitPlayer(Math.round(monsterPower(m) * cfg.power), { label: `${name}の地響き`, cause: name, killer: m.data.id,
      evadable: false, canCrit: false });
    if (hit && playerHP > 0) {
      playerStagger = Math.max(playerStagger, cfg.staggerTurns);
      addLog(`足元が揺れて、よろめいた！(${cfg.staggerTurns}ターン動けない)`);
    }
  }
  // 揺れで岩石が降ってくる(エクリプスメテオのときの隠れ場所になる)
  const meteor = m.data.ability.meteor;
  if (meteor && playerHP > 0) dropRocks(m.x, m.y, meteor.rocks, meteor.rockMin, meteor.rockMax, meteor.rockLimit);
  if (m.data.ability.stomp === cfg) screenShake("small"); // ベヒーモスの地響き:画面が揺れる
}

// ==================== エクリプスメテオ(ベヒーモスの最後の大技) ====================
// ability.meteor:{ below, turns, rocks, rockMin, rockMax }
//   HP が最大の below 以下になると(そのダメージで死ぬはずでも HP1 で踏みとどまって)一度だけ詠唱する
//   前方2マスに落下地点の印。turns 回こちらが動いたあとに落ちて、マップ全体に即死ダメージ
//   落下地点から見て岩石(js/hazard.js)の後ろにいれば受けない。詠唱中のベヒーモスは動かず、倒せない(HP が1より下がらない)
//   爆発でベヒーモスも死ぬ(こちらが倒した扱い)。岩の後ろにいないほかの敵も死ぬ(素材だけ)。そのあと岩は砕ける
//   食いしばり・身代わりの護符では耐えられる

// 落下地点 (sx, sy) から (x, y) への線の途中に岩があるか(あれば、その陰で助かる)
function lineHasRock(sx, sy, x, y) {
  const n = Math.max(Math.abs(x - sx), Math.abs(y - sy));
  for (let i = 1; i < n; i++) {
    const tx = Math.round(sx + (x - sx) * i / n), ty = Math.round(sy + (y - sy) * i / n);
    if (rockAt(tx, ty)) return true;
  }
  return false;
}

// 詠唱中のメテオの落下地点にいるベヒーモス(いなければ null)
function meteorCaster() {
  return monsters.find(m => m.meteor) || null;
}

// ダメージを受けたあとに呼ぶ:詠唱中なら HP を1より下げない。まだ詠唱していなくて below 以下なら、ここで詠唱を始める
//   呼ぶところ:playerStrike・toolDamage(道具)・落雷・毒(poisonTick)。倒れたか調べる前に呼ぶ
function meteorGuard(m) {
  const cfg = m.data.ability && m.data.ability.meteor;
  if (!cfg) return;
  if (m.meteor) {
    if (m.hp < 1) m.hp = 1;
    return;
  }
  if (m.meteorDone || m.hp > m.maxHp * cfg.below) return;
  m.hp = Math.max(1, m.hp);
  m.meteorDone = true;
  m.charging = false; // 溜めていた突進・地響きはやめる
  m.breathTiles = null;
  m.stomping = false;
  m.stompTiles = null;
  // 落下地点:こちらのいる向きの、前方2マス(壁ならその手前)
  const dx = px - m.x, dy = py - m.y;
  const [fx, fy] = Math.abs(dx) >= Math.abs(dy) ? [Math.sign(dx), 0] : [0, Math.sign(dy)];
  let x = m.x, y = m.y;
  for (let i = 0; i < 2 && map[y + fy] && map[y + fy][x + fx] === "."; i++) { x += fx; y += fy; }
  m.meteor = { x, y, at: turn + cfg.turns };
  playSE("meteorOmen"); // 効果音(js/sound.js)
  addLog(`${monsterName(m)}が天を仰ぎ、エクリプスメテオの詠唱を始めた！ ${cfg.turns}ターン後、すべてを焼き尽くす！`);
  addLog("落下地点(赤く点滅する印)から見て、岩石の陰に隠れろ！");
  dropRocks(m.x, m.y, cfg.rocks, cfg.rockMin, cfg.rockMax, cfg.rockLimit);
}

// 詠唱中、1ターンに1回:空の様子のログ(残りターンで変わる)
function meteorOmen(m) {
  if (m.meteor.lastOmen === turn) return;
  m.meteor.lastOmen = turn;
  const left = m.meteor.at - turn;
  const cfg = m.data.ability.meteor;
  const text = left > cfg.turns * 2 / 3 ? "空が赤黒く染まっていく…"
    : left > 2 ? "天が裂け、燃えさかる星が近づいてくる…"
    : "星が落ちてくる！ 岩の陰へ！";
  addLog(`${text}(エクリプスメテオまで あと${left}ターン)`);
}

// メテオが落ちる:岩の陰にいなければ即死ダメージ。ほかの敵も同じ。最後にベヒーモスが死に、岩が砕ける
function meteorExplode(m) {
  const { x, y } = m.meteor;
  const name = monsterName(m);
  addLog("エクリプスメテオが落ちてきた！");
  screenFlash();       // 画面が白く光る
  screenShake("big");  // 大きく揺れる
  playSE("meteor");    // 効果音(js/sound.js)
  meteorAftershocks(); // 続く爆発の揺れと光(音と時刻を合わせる)
  if (lineHasRock(x, y, px, py)) {
    addLog("岩石の陰で、爆風をやり過ごした！");
  } else {
    damagePlayer(maxHP * 10, `${name}のエクリプスメテオ`, "エクリプスメテオの爆発に飲みこまれた！", m.data.id);
    if (playerHP <= 0) return;
  }
  // ほかの敵:岩の陰にいなければ消し飛ぶ(素材だけ)
  const blown = monsters.filter(o => o !== m && !lineHasRock(x, y, o.x, o.y));
  monsters = monsters.filter(o => !blown.includes(o));
  for (const o of blown) if (!o.summoned) gainMonsterResource(o);
  if (blown.length > 0) addLog(`周りの敵${blown.length}体が、爆発に巻きこまれて消し飛んだ`);
  m.meteor = null;
  killMonster(m, `${name}は、自らのメテオの爆発に消えた！`);
  breakRocks();
}

// メテオが落ちたあと、続く爆発に合わせて画面を揺らし、オレンジに光らせる(BALANCE.meteorAftershocks)
// こちらが死んだら(リザルト画面に移ったら)やめる
function meteorAftershocks() {
  for (const a of BALANCE.meteorAftershocks) {
    setTimeout(() => {
      if (screenMode !== "dungeon" || playerHP <= 0) return;
      screenShake(a.shake);
      screenFlash("after", a.flash);
    }, a.at);
  }
}

// 吹き飛ばし:こちらを m から離れる向きに distance マス飛ばす。壁・敵・宝箱にぶつかったら追加ダメージ
function knockbackPlayer(m, cfg) {
  const dx = Math.sign(px - m.x), dy = Math.sign(py - m.y);
  let moved = 0, blocked = false;
  for (let i = 0; i < cfg.distance; i++) {
    const nx = px + dx, ny = py + dy;
    if (!map[ny] || map[ny][nx] === "#" || monsterAt(nx, ny) || chestAt(nx, ny)) { blocked = true; break; }
    px = nx;
    py = ny;
    moved++;
  }
  const name = monsterName(m);
  if (moved > 0) addLog(`${name}に吹き飛ばされた！`);
  if (moved > 0) checkFooting(); // 飛ばされた先の物を拾う(階段では降りない)
  if (blocked && playerHP > 0) {
    hitPlayer(Math.round(monsterPower(m) * cfg.wallPower), { label: moved > 0 ? "叩きつけられた" : `${name}に押しつぶされた`,
      cause: name, killer: m.data.id, evadable: false, canCrit: false });
  }
}

// 咆哮:弱ったら一度だけ。吼えたら true(この行動は吼えるだけ)
function tryRoar(m, cfg) {
  if (m.roared || m.hp > m.maxHp * cfg.below) return false;
  m.roared = true;
  let called = 0;
  for (const o of monsters) {
    if (o !== m && !o.hunting && !o.dormant && !o.disguised && !o.calm && !isShell(o) && Math.abs(o.x - m.x) + Math.abs(o.y - m.y) <= cfg.radius) {
      o.hunting = true;
      called++;
    }
  }
  screenShake("small");
  playSE("roar"); // 効果音(js/sound.js)
  addLog(`${monsterName(m)}が大地を揺るがす咆哮をあげた！ 攻撃力+${Math.round(cfg.atkUp * 100)}%${called > 0 ? `。周りの敵が${called}体、こちらに向かってくる` : ""}`);
  return true;
}

// ==================== 吸収・死に際の爆発(ドラゴンゾンビ) ====================
// ドラゴンの ability に、さらに書き足す
//   absorb:{ id, radius, below, healRate, cooldown }
//     HP が最大の below 未満のとき、周り radius マス以内の id の敵を1体吸いこんで(その敵は消える)、最大HPの healRate 回復する
//   deathBlast:{ damageMin, damageMax, radius, delay, poolRadius, poolTurns }
//     倒されると、delay 回プレイヤーが動いたあとに爆発する(周り radius マス。範囲が赤く光る。かわせない)
//     爆発のあと、周り poolRadius マスの床に、poolTurns ターンで消える毒沼が広がる
let deathBlasts = []; // 爆発を待っている死骸。1個の形:{ x, y, wait: あと何回で爆発, fresh: 倒されたばかり, power, owner: 名前, ownerId, b: deathBlast }

// 周りの仲間を吸いこんで回復する。吸いこんだら true
function tryAbsorb(m, a) {
  if (m.absorbCd > 0 || m.hp >= m.maxHp * a.below) return false;
  const food = monsters.filter(o => o !== m && o.data.id === a.id && !o.elite
    && Math.max(Math.abs(o.x - m.x), Math.abs(o.y - m.y)) <= a.radius);
  if (food.length === 0) return false;
  const near = (o) => Math.abs(o.x - m.x) + Math.abs(o.y - m.y);
  const prey = food.sort((p, q) => near(p) - near(q))[0];
  monsters = monsters.filter(o => o !== prey); // 吸いこまれた敵は消える(経験値・ドロップはなし)
  const heal = Math.min(m.maxHp - m.hp, Math.round(m.maxHp * a.healRate));
  m.hp += heal;
  m.absorbCd = a.cooldown;
  addLog(`${monsterName(m)}が${monsterName(prey)}を吸いこんだ！ HPが${heal}回復した`);
  return true;
}

// 倒されたとき:爆発を待つ死骸を置く(delay が 0 なら、すぐ爆発)
function startDeathBlast(m, b) {
  const blast = { x: m.x, y: m.y, wait: b.delay, fresh: true, power: monsterPower(m, b.damageMin, b.damageMax), owner: monsterName(m), ownerId: m.data.id, b };
  if (!(b.delay > 0)) {
    blastExplode(blast);
    return;
  }
  deathBlasts.push(blast);
  addLog(`${blast.owner}の死骸が膨れあがっていく！ 赤く光るマスから離れろ`);
}

// 死骸の爆発で、赤く光らせるマス
function blastTiles(bl) {
  const tiles = [];
  for (let y = bl.y - bl.b.radius; y <= bl.y + bl.b.radius; y++) {
    for (let x = bl.x - bl.b.radius; x <= bl.x + bl.b.radius; x++) {
      if (map[y] && map[y][x] !== undefined && map[y][x] !== "#") tiles.push({ x, y });
    }
  }
  return tiles;
}

// 死骸が爆発する(範囲にいればダメージ)。そのあと毒沼が広がる
function blastExplode(bl) {
  if (Math.max(Math.abs(px - bl.x), Math.abs(py - bl.y)) <= bl.b.radius) {
    hitPlayer(bl.power, { label: `${bl.owner}の死骸の爆発`, cause: bl.owner, killer: bl.ownerId, evadable: false, canCrit: false, category: "explosion", element: "poison" });
  } else {
    addLog(`${bl.owner}の死骸が爆発した！ 巻きこまれずにすんだ`);
  }
  addTempHazards(bl.x, bl.y, bl.b.poolRadius, "poison", bl.b.poolTurns);
  addLog(`あたりに毒沼が広がった(${bl.b.poolTurns}ターンで消える)`);
}

// 敵が動いたあと:倒されたあとプレイヤーが delay 回動いたら爆発する
//   倒されたばかり(fresh)の死骸は数えない(倒したその行動のうちに爆発しないように。fresh は monstersAct の最後に外す)
//   ※ターン数(turn)で比べないのは、道具で倒したときは、倒したあとに turn が進むため
function deathBlastsAct() {
  for (const bl of deathBlasts.slice()) {
    if (bl.fresh) continue;
    bl.wait -= 1;
    if (bl.wait > 0) continue;
    deathBlasts = deathBlasts.filter(x => x !== bl);
    blastExplode(bl);
    if (playerHP <= 0) return;
  }
}

// ブレスを溜めている敵・爆発を待つ死骸の、赤く光らせるマス("x,y" の集まり。マップを描くときと詳細ウィンドウで使う)
function dangerTiles() {
  const set = new Set();
  for (const m of monsters) {
    if (m.charging) for (const t of m.breathTiles || []) set.add(`${t.x},${t.y}`);
    if (m.blazing) for (const t of m.blazeTiles || []) set.add(`${t.x},${t.y}`); // 焔龍の爆炎
    if (m.stomping) for (const t of m.stompTiles || []) set.add(`${t.x},${t.y}`); // ベヒーモスの地響き
  }
  for (const bl of deathBlasts) for (const t of blastTiles(bl)) set.add(`${t.x},${t.y}`);
  return set; // 霹龍の落雷の印は、黄色く点滅させる(screens.js の drawDungeon)
}

// ==================== 起き上がり(グール) ====================
// ability に revive:{ turns, hpRate } を書き足した敵
//   倒すと死体が残り、プレイヤーが turns 回動くと、最大HPの hpRate で一度だけ起き上がる
//   死体を踏むと完全に倒せる。経験値・ドロップは完全に倒したときだけ。エリート・呼び出された敵は起き上がらない
let corpses = []; // 起き上がるのを待っている死体。1個の形:{ x, y, wait: あと何回で起き上がる, fresh: 倒されたばかり, m: 倒れた敵 }

// 倒されたとき(killMonster から):起き上がる敵なら死体を置いて true(経験値などはまだ渡さない)
function leaveCorpse(m, text) {
  const r = m.data.ability && m.data.ability.revive;
  if (!r || m.revived || m.elite || m.summoned) return false;
  corpses.push({ x: m.x, y: m.y, wait: r.turns, fresh: true, m });
  addLog(`${text} …が、まだ蠢いている(${r.turns}回動くと起き上がる。死体を踏めば完全に倒せる)`);
  return true;
}

// そのマスの死体(なければ undefined)
function corpseAt(x, y) {
  return corpses.find(c => c.x === x && c.y === y);
}

// 死体のマスに乗ったとき(checkFooting から):踏みつぶして完全に倒す(ここで経験値・ドロップ)
function stompCorpse(c) {
  corpses = corpses.filter(x => x !== c);
  c.m.revived = true; // もう起き上がらない
  sneakStrike = false;
  killMonster(c.m, `${monsterName(c.m)}の死体を踏みつぶした！`);
}

// 敵が動いたあと:倒されたあとプレイヤーが turns 回動いたら起き上がる(数え方は死骸の爆発と同じ。fresh は monstersAct の最後に外す)
//   死体のマスにほかの敵がいたら、空くまで待つ
function corpsesAct() {
  for (const c of corpses.slice()) {
    if (c.fresh) continue;
    if (c.wait > 0) c.wait -= 1;
    if (c.wait > 0 || monsterAt(c.x, c.y)) continue;
    corpses = corpses.filter(x => x !== c);
    const r = c.m.data.ability.revive;
    const m = newMonster(c.m.data, c.x, c.y, { revived: true, hunting: true }); // 毒などは消えて、こちらに気づいた状態で起き上がる
    m.hp = Math.max(1, Math.round(m.maxHp * r.hpRate));
    monsters.push(m);
    addLog(`${monsterName(m)}が起き上がった！`);
  }
}
