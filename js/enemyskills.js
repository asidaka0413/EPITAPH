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
  addLog(`${monsterName(m)}が${data.name}を呼び出した！(術師を倒すと崩れ落ちる)`);
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
function breathFire(m, ab) {
  const name = monsterName(m), el = ELEMENT_DATA[ab.element];
  const tiles = m.breathTiles || [];
  m.charging = false;
  m.breathTiles = null;
  const hitTile = tiles.find(t => t.x === px && t.y === py);
  if (!hitTile) {
    addLog(`${name}の${el.name}のブレス！ …範囲の外に逃れた`);
    return;
  }
  const rate = Math.max(0, 1 - BALANCE.breathFalloff * (hitTile.k - 1));
  const power = Math.round(monsterPower(m) * ab.breathPower * rate);
  const hit = hitPlayer(power, { label: `${name}の${el.name}のブレス${rate < 1 ? `(${Math.round(rate * 100)}%)` : ""}`, cause: name,
    killer: m.data.id, evadable: false, canCrit: false, category: "breath", element: ab.element });
  if (hit && playerHP > 0) elementDot(ab.element, ab.dot, ab.dot ? dotDamageOf(m, ab.dot) : 0, name, m.data.id);
}

// 属性の状態異常を付ける(火ならやけど)。dot:{ turns, … }(ability の dot)/ dmg:毎ターンのダメージ
function elementDot(element, dot, dmg, from, fromId) {
  const kind = ELEMENT_DATA[element] && ELEMENT_DATA[element].dot;
  if (kind && dot && dmg > 0) dotPlayer(kind, dmg, dot.turns, from, fromId);
}

// 属性の球を放つ(プレイヤーのいる向きのとなりのマスから)。放てたら true
function spawnBall(m, ab) {
  const dx = Math.sign(px - m.x), dy = Math.sign(py - m.y);
  const x = m.x + dx, y = m.y + dy;
  if (map[y][x] === "#" || monsterAt(x, y)) return false;
  const name = monsterName(m);
  // fresh:放ったばかり(そのターンは動かない。見てからよけられるように)
  balls.push({ x, y, dx, dy, power: monsterPower(m), element: ab.element, owner: name, ownerId: m.data.id,
               dot: ab.dot, dotDmg: ab.dot ? dotDamageOf(m, ab.dot) : 0, fresh: true });
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
      const nx = b.x + b.dx, ny = b.y + b.dy;
      if (map[ny][nx] === "#" || monsterAt(nx, ny)) {
        balls = balls.filter(x => x !== b);
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
function sweepStrike(m, ab) {
  const name = monsterName(m), spin = m.chargeKind === "spin";
  const skill = spin ? "回転切り" : "薙ぎ払い";
  const tiles = m.breathTiles || [];
  m.charging = false;
  m.breathTiles = null;
  m.chargeKind = null;
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
  }
  for (const bl of deathBlasts) for (const t of blastTiles(bl)) set.add(`${t.x},${t.y}`);
  return set;
}
