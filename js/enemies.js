// 敵の動き・炎・毒・衰弱
// index.html から <script src> で読み込まれる(読み込む順番は index.html に書いてある)

// ==================== モンスターの行動 ====================
// そのマスに入れないなら true(壁・ほかのモンスター・プレイヤーがいる)
function isBlockedForMonster(x, y) {
  return map[y][x] === "#" || monsterAt(x, y) !== null || (x === px && y === py);
}

// 1マス動かしてみる。動けたら true
function tryMonsterStep(m, sx, sy) {
  if (sx === 0 && sy === 0) return false;
  if (isBlockedForMonster(m.x + sx, m.y + sy)) return false;
  m.x += sx;
  m.y += sy;
  return true;
}

// 敵の特殊な動き(monsters.js の ability.type)。図鑑に出す説明
//   動きそのものは monsterAction の中に書いてある
const MONSTER_ABILITIES = {
  ranged:  a => `縦か横にまっすぐ並ぶと、離れたところから矢を撃つ(射程${a.range})`,
  poison:  a => `攻撃が当たると毒にする(${a.turns}ターン、毎ターン${a.damage}〜)`,
  steal:   a => `攻撃が当たると回復薬を盗んで逃げる。${a.fleeTurns || 8}回逃げたら戻ってくる(倒すと取り返せる)`,
  fire:    a => `追いかけてくる炎を放つ(炎は${a.turns}ターン残る。ぶつかれば消せる)`,
  explode: () => "隣に来ると膨らみ、次の行動で周りを巻きこんで爆発する",
  erratic: a => `${Math.round(a.chance * 100)}%くらいの確率で、ふらふらと適当な方向に飛ぶ`,
  alarm:   a => `見つかると一度だけ角笛を吹いて、${a.radius}マス以内の敵を呼び寄せる`,
  split:   () => "攻撃されて生き残ると、2体に分裂する(1回だけ。一撃で倒せば増えない)",
  armored: a => `鎧が硬く、普通の攻撃のダメージを${Math.round(a.cut * 100)}%減らす(会心は貫通する)`,
  regen:   a => `毎ターン最大HPの${Math.round(a.rate * 100)}%回復する(毒のあいだは回復しない)`,
  weaken:  a => `攻撃が当たると衰弱させる(${a.turns}ターン、ATK-${Math.round(a.atkCut * 100)}%)`,
};

// 敵全員が、それぞれの速さに応じて行動する
//   毎ターン speed ずつ行動力がたまり、1 たまるごとに1回行動する
//   (speed 2 なら毎ターン2回、speed 0.5 なら2ターンに1回)
//   そのあと、炎が動き、毒が効く
function monstersAct() {
  for (const m of monsters.slice()) { // 爆発などで途中でいなくなる敵がいるので、コピーを回す
    m.energy += m.data.speed;
    while (m.energy >= 1 && monsters.includes(m)) {
      m.energy -= 1;
      monsterAction(m);
      if (playerHP <= 0) return;
    }
  }
  flamesAct();
  if (playerHP <= 0) return;
  poisonTick();
}

// 今の階の、敵の会心率(%)。深い階ほど少しずつ上がる
function enemyCritPercent() {
  return BALANCE.enemyCritBase + (depth - 1) * BALANCE.enemyCritPerDepth + effectValue("enemyCrit"); // 呪い「隙」で上がる
}

// 敵の攻撃力(1回分)。深い階層ほど上がる(11階からは段階的な倍率もかかる)。エリートはさらに強い
function monsterPower(m, min = m.data.attackMin, max = m.data.attackMax) {
  const raw = (randInt(min, max) + (depth - 1) * (m.data.attackPerDepth || 0)) * enemyAttackRate(depth);
  return Math.round(m.elite ? raw * BALANCE.eliteAttackMultiplier : raw);
}

// プレイヤーがダメージを受ける(食いしばり・死因の記録もここ)
//   cause:死んだときの死因 / text:ログに出す文 / killerId:倒した敵の種類(monsters.js の id。墓守に使う)
function damagePlayer(dmg, cause, text, killerId = null) {
  playerHP -= dmg;
  runStats.damageTaken += dmg;
  addLog(text);
  // 特性「食いしばり」:1回の冒険で1度だけ、HP1で耐える
  if (playerHP <= 0 && hasTrait("guts") && !runStats.gutsUsed) {
    playerHP = 1;
    runStats.gutsUsed = true;
    addLog("食いしばった！ HP1で耐えた");
  }
  if (playerHP <= 0) {
    runStats.killedBy = cause; // 死因として記録
    runStats.killedById = killerId;
  }
}

// プレイヤーが向いている方向([dx, dy])。最後に動いた(攻撃した)方向。盾で受けられるかに使う
let facing = null;

// 向きを矢印で(ステータス欄用)
function facingArrow() {
  if (!facing) return "―";
  return { "0,-1": "↑", "0,1": "↓", "-1,0": "←", "1,0": "→" }[facing.join(",")];
}

// 敵の攻撃がプレイヤーに向かう。当たったら true
//   AGL で回避できる(evadable: false なら回避できない)。当たったら DEF で軽減
//   label:ログに出す攻撃の名前 / cause:死因 / canCrit: false なら会心なし
//   from:遠距離攻撃が飛んできた方向([dx, dy]。プレイヤーから見て)。向いている方向と同じなら、盾で減らせる
//   killer:攻撃した敵の種類(monsters.js の id)
function hitPlayer(raw, { label, cause, evadable = true, canCrit = true, from = null, killer = null }) {
  const s = getPlayerStats();
  if (evadable && chance(evadePercent(s))) {
    addLog(`${label}をかわした！`);
    return false;
  }
  // 敵の会心(痛恨の一撃)。特性「急所守り」で受けるダメージが減る
  const isCrit = canCrit && chance(enemyCritPercent());
  if (isCrit) raw = raw * BALANCE.enemyCritMultiplier * (1 - traitMax("critTakenDown", 0));
  // 盾:飛んできた方向を向いていれば、盾の「防ぐ%」だけ減らす
  const shield = equipped.shield;
  const blocked = from && shield && shield.block && facing && facing[0] === from[0] && facing[1] === from[1];
  if (blocked) raw = raw * (1 - shield.block / 100);
  // 呪い「紙の守り」で受けるダメージが増える
  const dmg = Math.round(reduceByDef(raw, s) * (1 + effectValue("dmgTaken") / 100));
  damagePlayer(dmg, cause, `${isCrit ? "痛恨の一撃！ " : ""}${label}！ ${blocked ? `盾で受けた(-${shield.block}%) ` : ""}${dmg}のダメージ`, killer);
  return true;
}

// 敵1体の、1回分の行動
function monsterAction(m) {
  const ab = m.data.ability || {};
  const name = monsterName(m);
  const dx = px - m.x, dy = py - m.y;
  const dist = Math.abs(dx) + Math.abs(dy);
  if (m.cooldown > 0) m.cooldown -= 1;

  // 墓守:起こされるまで眠っている(こちらから攻撃するか、遺品を拾うと目を覚ます)
  if (m.dormant) return;

  // 盗賊:回復薬を盗んだあとは、しばらく逃げ回る。逃げ疲れたら戻ってくる(もう盗まない)
  if (m.fleeing > 0) {
    stepAwayFromPlayer(m);
    m.fleeing -= 1;
    if (m.fleeing === 0) {
      m.hunting = true; // 遠くにいても、まっすぐ戻ってくる
      addLog(`${name}が逃げるのをやめて、こちらに向かってくる`);
    }
    return;
  }
  // 爆ぜ虫:膨らんだ次の行動で爆発する(離れていれば当たらない)
  if (m.primed) {
    explode(m, ab);
    return;
  }
  // コウモリ:ときどき、ふらふらと適当な方向に飛ぶ
  if (ab.type === "erratic" && Math.random() < ab.chance) {
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    const [sx, sy] = dirs[randInt(0, 3)];
    tryMonsterStep(m, sx, sy);
    return;
  }
  // 呼び子:見つけたら一度だけ角笛を吹いて、周りの敵を呼び寄せる
  if (ab.type === "alarm" && !m.alarmed && dist <= BALANCE.monsterSightRange) {
    m.alarmed = true;
    m.hunting = true;
    let called = 0;
    for (const o of monsters) {
      if (o !== m && !o.hunting && Math.abs(o.x - m.x) + Math.abs(o.y - m.y) <= ab.radius) { o.hunting = true; called++; }
    }
    addLog(`${name}が角笛を吹いた！${called > 0 ? ` 周りの敵が${called}体、こちらに向かってくる` : ""}`);
    return;
  }

  if (dist === 1) {
    if (ab.type === "explode") {
      m.primed = true;
      addLog(`${name}が膨らみ始めた！ 次に爆発する`);
      return;
    }
    // 隣にいれば攻撃
    const hit = hitPlayer(monsterPower(m), { label: `${name}の攻撃`, cause: name, killer: m.data.id });
    if (!hit || playerHP <= 0) return;
    if (ab.type === "poison") {
      const dmg = Math.round((ab.damage + (depth - 1) * (ab.damagePerDepth || 0)) * enemyAttackRate(depth) * (m.elite ? BALANCE.eliteAttackMultiplier : 1));
      poisonPlayer(dmg, ab.turns, name, m.data.id);
    }
    if (ab.type === "weaken") weakenPlayer(ab.turns, ab.atkCut);
    if (ab.type === "steal" && potions > 0 && !m.stolen) { // 盗むのは1回だけ
      potions -= 1;
      m.stolen = 1;
      m.fleeing = ab.fleeTurns || 8; // 逃げる回数
      addLog(`${name}に回復薬を盗まれた！ 倒せば取り返せる`);
    }
  } else if (dist <= BALANCE.monsterSightRange || m.hunting) {
    // 弓兵:縦か横にまっすぐ並んでいて、間に何もなければ矢を撃つ
    if (ab.type === "ranged" && dist <= ab.range && clearLineToPlayer(m)) {
      hitPlayer(monsterPower(m), { label: `${name}の矢`, cause: name, killer: m.data.id, from: [Math.sign(m.x - px), Math.sign(m.y - py)] });
      return;
    }
    // 鬼火:射程内なら、追いかけてくる炎を放つ(しばらく撃てない)
    if (ab.type === "fire" && !(m.cooldown > 0) && dist <= ab.range) {
      spawnFlame(m, ab);
      m.cooldown = ab.cooldown;
      return;
    }
    // 近くにいれば追いかける
    stepTowardPlayer(m);
  } else if (Math.random() < BALANCE.monsterWanderChance) {
    // 遠ければ、たまにうろうろする
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    const [sx, sy] = dirs[randInt(0, 3)];
    tryMonsterStep(m, sx, sy);
  }
}

// プレイヤーに向かって1マス動く(距離が遠いほうの向きを優先し、ふさがっていたらもう片方)
function stepTowardPlayer(m) {
  const dx = px - m.x, dy = py - m.y;
  const stepX = Math.sign(dx), stepY = Math.sign(dy);
  if (Math.abs(dx) >= Math.abs(dy)) {
    tryMonsterStep(m, stepX, 0) || tryMonsterStep(m, 0, stepY);
  } else {
    tryMonsterStep(m, 0, stepY) || tryMonsterStep(m, stepX, 0);
  }
}

// プレイヤーから離れる方向に1マス動く(いちばん遠くなる向き)
function stepAwayFromPlayer(m) {
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const now = Math.abs(px - m.x) + Math.abs(py - m.y);
  let best = null, bestDist = now;
  for (const [sx, sy] of dirs) {
    if (isBlockedForMonster(m.x + sx, m.y + sy)) continue;
    const d = Math.abs(px - m.x - sx) + Math.abs(py - m.y - sy);
    if (d > bestDist) { best = [sx, sy]; bestDist = d; }
  }
  if (best) tryMonsterStep(m, best[0], best[1]);
}

// 敵からプレイヤーまで、縦か横にまっすぐで、間に壁も敵もいないか
function clearLineToPlayer(m) {
  if (m.x !== px && m.y !== py) return false;
  const sx = Math.sign(px - m.x), sy = Math.sign(py - m.y);
  for (let x = m.x + sx, y = m.y + sy; x !== px || y !== py; x += sx, y += sy) {
    if (map[y][x] === "#" || monsterAt(x, y)) return false;
  }
  return true;
}

// スライムの分裂:残りHPを半分ずつに分けて、となりの空いているマスにもう1体出す(どちらももう分裂しない)
function splitMonster(m) {
  m.splitDone = true;
  const spot = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([sx, sy]) => [m.x + sx, m.y + sy])
    .find(([x, y]) => !isBlockedForMonster(x, y));
  if (!spot || m.hp < 2) return;
  const half = Math.ceil(m.hp / 2);
  m.hp = half;
  const child = newMonster(m.data, spot[0], spot[1], { splitDone: true });
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
    hitPlayer(monsterPower(m, ab.damageMin, ab.damageMax), { label: `${name}の爆発`, cause: name, killer: m.data.id, evadable: false, canCrit: false });
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
  hitPlayer(flame.power, { label: `${flame.owner}の炎`, cause: `${flame.owner}の炎`, killer: flame.ownerId, evadable: false, canCrit: false, from });
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

// ==================== 毒 ====================
// プレイヤーの毒:{ dmg: 毎ターンのダメージ, turns: 残りターン, from: 毒にした敵 }(毒でなければ null)
let playerPoison = null;

// プレイヤーを毒にする(もう毒なら、長いほう・強いほうにする)
//   from:毒にした敵の名前 / fromId:その敵の種類(毒で死んだときの墓守に使う)
function poisonPlayer(dmg, turns, from, fromId = null) {
  if (playerPoison) {
    playerPoison.dmg = Math.max(playerPoison.dmg, dmg);
    playerPoison.turns = Math.max(playerPoison.turns, turns);
  } else {
    playerPoison = { dmg, turns, from, fromId };
  }
  addLog(`毒を受けた！(${turns}ターン、毎ターン${dmg}ダメージ)`);
}

// ==================== 衰弱 ====================
// プレイヤーの衰弱:{ turns: 残りターン, atkCut: ATK が下がる割合 }(衰弱でなければ null)
let playerWeak = null;

function weakenPlayer(turns, atkCut) {
  if (playerWeak) {
    playerWeak.turns = Math.max(playerWeak.turns, turns);
    playerWeak.atkCut = Math.max(playerWeak.atkCut, atkCut);
  } else {
    playerWeak = { turns, atkCut };
  }
  addLog(`力が抜けていく…(衰弱:${turns}ターン、ATK-${Math.round(atkCut * 100)}%)`);
}

// 衰弱で下がったあとの ATK の倍率(衰弱でなければ 1)
function weakMultiplier() {
  return playerWeak ? 1 - playerWeak.atkCut : 1;
}

// 毎ターンの毒のダメージ(プレイヤーと、毒になった敵)・衰弱の残りターン・トロルの回復
function poisonTick() {
  if (playerWeak) {
    playerWeak.turns -= 1;
    if (playerWeak.turns <= 0) {
      playerWeak = null;
      addLog("力が戻ってきた");
    }
  }
  // トロル:毒でなければ回復する
  for (const m of monsters) {
    const ab = m.data.ability;
    if (ab && ab.type === "regen" && !m.poison && m.hp < m.maxHp) {
      m.hp = Math.min(m.maxHp, m.hp + Math.max(1, Math.round(m.maxHp * ab.rate)));
    }
  }
  if (playerPoison) {
    const p = playerPoison;
    p.turns -= 1;
    damagePlayer(p.dmg, `${p.from}の毒`, `毒で${p.dmg}のダメージ${p.turns > 0 ? `(あと${p.turns}ターン)` : ""}`, p.fromId);
    if (p.turns <= 0) {
      playerPoison = null;
      if (playerHP > 0) addLog("毒が抜けた");
    }
    if (playerHP <= 0) return;
  }
  for (const m of monsters.slice()) {
    if (!m.poison) continue;
    m.hp -= m.poison.dmg;
    runStats.damageDealt += m.poison.dmg;
    m.poison.turns -= 1;
    if (m.hp <= 0) killMonster(m, `${monsterName(m)}は毒で倒れた！`);
    else if (m.poison.turns <= 0) m.poison = null;
  }
}

// プレイヤーが1回行動したあとの処理:敵が動き、死んだか確認して、画面を描き直す
function endPlayerTurn() {
  monstersAct();
  if (playerHP <= 0) {
    handlePlayerDeath();
    return;
  }
  render();
}

// 運(LUK)でドロップ率が上がる倍率(運10%なら 1.1倍)
function luckDropMultiplier() {
  return 1 + luckPercent(getPlayerStats()) / 100;
}

// 倒した敵が、dropChance の確率で固有装備(equipment.js で from がその敵の装備)をその場に落とす
function dropMonsterEquipment(m) {
  const rate = m.data.dropChance * luckDropMultiplier() * (m.elite ? BALANCE.eliteDropMultiplier : 1); // エリートは落としやすい
  if (!debugAlwaysDrop() && Math.random() >= rate) return;
  const data = pickEquipmentData(depth, m.data.id);
  if (!data) return;
  items.push({ x: m.x, y: m.y, equip: makeEquipment(data, depth) });
  addLog(`${monsterName(m)}が${data.name}を落とした！`);
}

// 倒した敵が、bookDropChance の確率で書(books.js で from がその敵の書)をその場に落とす
function dropMonsterBook(m) {
  if (!debugAlwaysDrop() && Math.random() >= (m.data.bookDropChance || 0) * luckDropMultiplier()) return;
  const book = pickWeighted(bookList.filter(b => bookFrom(b).includes(m.data.id)), depth);
  if (!book) return;
  items.push({ x: m.x, y: m.y, book });
  addLog(`${monsterName(m)}が${book.name}を落とした！`);
}

// 書を拾ったとき:その場で拠点に登録する(死んでもなくならない)
function obtainBook(book) {
  const had = base.books[book.id] || 0;
  base.books[book.id] = had + 1;
  base.bookNew[book.id] = true;
  base.records.booksFound[book.id] = true; // 図鑑に登録
  addLog(had > 0
    ? `${book.name}を手に入れた！(${had + 1}冊目。${BALANCE.bookExchangeCost}冊で上の書と交換できる)`
    : `${book.name}を手に入れた！ 拠点の「プレイヤー」でセットできる`);
  if (screenMode !== "town" && runStats) runStats.books.push(book.name); // 冒険の記録(拠点でのデバッグ入手は数えない)
  saveGame();
}
