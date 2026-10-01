// 敵の動き・炎・ドラゴンの球とブレス・毒・衰弱
// index.html から <script src> で読み込まれる(読み込む順番は index.html に書いてある)

// ==================== モンスターの行動 ====================
// そのマスに入れないなら true(壁・ほかのモンスター・プレイヤーがいる)
function isBlockedForMonster(x, y) {
  return map[y][x] === "#" || monsterAt(x, y) !== null || (x === px && y === py);
}

// 1マス動かしてみる。動けたら true。動いた方向を向く
function tryMonsterStep(m, sx, sy) {
  if (sx === 0 && sy === 0) return false;
  if (isBlockedForMonster(m.x + sx, m.y + sy)) return false;
  m.x += sx;
  m.y += sy;
  m.facing = [sx, sy];
  return true;
}

// ==================== 視界(気づく・不意打ち) ====================
// 敵は向き(facing:[dx, dy])を持ち、前方半分(180度)・monsterSightRange マス以内・あいだに壁がなければ、プレイヤーに気づく
//   後ろ半分にいれば、となりにいても気づかれない
//   気づいた敵は hunting が true になり、その階のあいだずっと追いかけてくる(攻撃されたときも気づく)
//   気づいた瞬間の行動は「気づく」だけで終わる(こちらを向く)
//   気づいていない敵を殴ると「不意打ち」で2回攻撃できる(combat.js の tryMove)
const DIRS4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

// 2マスのあいだに壁がないか(両はしのマスは調べない)。ブレゼンハムの線(マスを1つずつたどる)
function sightClear(x0, y0, x1, y1) {
  const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
  const sx = Math.sign(x1 - x0), sy = Math.sign(y1 - y0);
  let err = dx - dy, x = x0, y = y0;
  while (true) {
    const e2 = err * 2;
    if (e2 > -dy) { err -= dy; x += sx; }
    if (e2 < dx) { err += dx; y += sy; }
    if (x === x1 && y === y1) return true;
    if (map[y][x] === "#") return false;
  }
}

// 敵 m のマス (x, y) が見えるか(前方半分・見える距離以内・あいだに壁なし)
function monsterCanSee(m, x, y) {
  if (m.blind > 0) return false; // 煙玉で見失っているあいだは、見えても気づけない
  const dx = x - m.x, dy = y - m.y;
  if (dx === 0 && dy === 0) return false;
  if (Math.abs(dx) + Math.abs(dy) > sightRangeNow()) return false; // 忍び足の香で短くなる
  const f = m.facing || [0, 1];
  if (dx * f[0] + dy * f[1] < 0) return false; // 後ろ半分は見えない
  return sightClear(m.x, m.y, x, y);
}

// プレイヤーのほうを向く(縦か横の、近いほう)
function faceToward(m) {
  const dx = px - m.x, dy = py - m.y;
  if (dx === 0 && dy === 0) return;
  m.facing = Math.abs(dx) >= Math.abs(dy) ? [Math.sign(dx), 0] : [0, Math.sign(dy)];
}

// 向きを矢印で(詳細ウィンドウ用)。d:[dx, dy]
function dirArrow(d) {
  if (!d) return "―";
  return { "0,-1": "↑", "0,1": "↓", "-1,0": "←", "1,0": "→" }[d.join(",")] || "―";
}

// 敵の視界のマス(F キーの表示用。"x,y" の集まり)。気づいていない・眠っていない敵だけ
function monsterVisionTiles(m) {
  const set = new Set();
  if (m.hunting || m.dormant) return set;
  const r = sightRangeNow();
  for (let y = m.y - r; y <= m.y + r; y++) {
    for (let x = m.x - r; x <= m.x + r; x++) {
      if (map[y] && map[y][x] === "." && monsterCanSee(m, x, y)) set.add(`${x},${y}`);
    }
  }
  return set;
}

// 敵の攻撃が届くマス(F キーの表示用。"x,y" の集まり)
//   となり(爆ぜ虫は周り8マス)/ 弓兵・リザードマンはまっすぐ射程まで / ドラゴンの球はまっすぐ壁まで / 鬼火は射程内
function monsterAttackTiles(m) {
  const set = new Set();
  if (m.dormant) return set;
  const ab = m.data.ability || {};
  const add = (x, y) => { if (map[y] && map[y][x] !== undefined && map[y][x] !== "#") set.add(`${x},${y}`); };
  if (ab.type === "explode") {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy) add(m.x + dx, m.y + dy);
  } else {
    for (const [sx, sy] of DIRS4) add(m.x + sx, m.y + sy);
  }
  // 縦横まっすぐ max マスまで(壁で止まる)
  const line = (max) => {
    for (const [sx, sy] of DIRS4) {
      for (let i = 1; i <= max; i++) {
        const x = m.x + sx * i, y = m.y + sy * i;
        if (!map[y] || map[y][x] === undefined || map[y][x] === "#") break;
        add(x, y);
      }
    }
  };
  if (ab.type === "ranged" || ab.type === "reach") line(ab.range);
  if (ab.type === "dragon") line(Math.max(BALANCE.mapWidth, BALANCE.mapHeight));
  if (ab.type === "fire") {
    for (let y = m.y - ab.range; y <= m.y + ab.range; y++) {
      for (let x = m.x - ab.range; x <= m.x + ab.range; x++) {
        if (Math.abs(x - m.x) + Math.abs(y - m.y) <= ab.range) add(x, y);
      }
    }
  }
  return set;
}

// プレイヤーが動いたあと、敵が動く前に呼ぶ:視界に入っている敵は、その瞬間に気づく
//   気づいた敵は justNoticed の印が付き、このターンの次の行動は「気づくだけ」で終わる(となりで見つかって、すぐ殴られないように)
//   敵が自分で動いてプレイヤーが視界に入ったときは、その行動の中で気づく(monsterAction)
function noticeCheck() {
  for (const m of monsters) {
    if (!m.hunting && !m.dormant && monsterCanSee(m, px, py)) {
      noticePlayer(m);
      m.justNoticed = true;
    }
  }
}

// プレイヤーに気づく(こちらを向いて、追いかけ始める)
function noticePlayer(m, log = true) {
  m.hunting = true;
  faceToward(m);
  if (log) addLog(`${monsterName(m)}がこちらに気づいた！`);
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
  slow:    a => `攻撃が当たると鈍足にする(${a.turns}ターン、回避率-${Math.round(a.aglCut * 100)}%)`,
  drain:   a => `攻撃が当たると、与えたダメージの${Math.round(a.rate * 100)}%だけ自分が回復する`,
  burn:    a => `攻撃が当たるとやけどにする(${a.turns}ターン、毎ターン${a.damage}〜)`,
  command: a => `周り${a.radius}マス以内の同じ一族の攻撃力を${Math.round(a.atkUp * 100)}%上げる。手下を${a.escorts}体連れて出てくる`,
  summon:  a => `${(monsterList.find(m => m.id === a.summonId) || { name: "？？？" }).name}を呼び出す(同時に${a.maxAlive}体、合計${a.maxTotal}体まで)。`
    + "呼ばれたものは素材しか落とさない。術師を倒すと崩れ落ちる",
  reach:   a => `槍で、縦か横にまっすぐ${a.range}マス先まで、その場から突いてくる`,
  dragon:  a => {
    const el = ELEMENT_DATA[a.element];
    return `となりならひっかく。縦か横にまっすぐ並ぶと${el.ballName}を飛ばす(壁に当たるまで飛ぶ。見てからよけられる)。`
      + `ときどき前方${a.breathRange}マスの扇形に${el.name}のブレスを吐く(溜めのあいだ範囲が赤く光る。口から遠いほど弱い)`;
  },
};

// 敵全員が、それぞれの速さに応じて行動する
//   毎ターン speed ずつ行動力がたまり、1 たまるごとに1回行動する
//   (speed 2 なら毎ターン2回、speed 0.5 なら2ターンに1回)
//   そのあと、炎と属性の球が動き、毒が効く
function monstersAct() {
  noticeCheck(); // プレイヤーが敵の視界に入っていたら、その瞬間に気づく
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
  ballsAct();
  if (playerHP <= 0) return;
  poisonTick();
}

// 今の階の、敵の会心率(%)。深い階ほど少しずつ上がる
function enemyCritPercent() {
  return BALANCE.enemyCritBase + (depth - 1) * BALANCE.enemyCritPerDepth + effectValue("enemyCrit"); // 呪い「隙」で上がる
}

// 敵の攻撃力(1回分)。深い階層ほど上がる(11階からは上がり幅が大きく、層の段差・険しい道の倍率もかかる)。エリートはさらに強い
//   ゴブリンの族長などの号令を受けていれば、さらに上がる
function monsterPower(m, min = m.data.attackMin, max = m.data.attackMax) {
  const raw = enemyStat(randInt(min, max), m.data.attackPerDepth, "attack") * commandRate(m);
  return Math.round(m.elite ? raw * BALANCE.eliteAttackMultiplier : raw);
}

// 号令(ability の type: "command")で上がる攻撃力の倍率(号令を受けていなければ 1)
//   周り radius マス以内に、同じ一族の号令を出す敵(眠っていない)がいれば、その atkUp ぶん上がる。号令を出す敵自身は上がらない
function commandRate(m) {
  const boss = commanderOf(m);
  return boss ? 1 + boss.data.ability.atkUp : 1;
}

// m に号令をかけている敵(いなければ null)
function commanderOf(m) {
  const clan = monsterClan(m.data);
  if (!clan) return null;
  return monsters.find(o => o !== m && !o.dormant && o.data.ability && o.data.ability.type === "command"
    && monsterClan(o.data) === clan && Math.abs(o.x - m.x) + Math.abs(o.y - m.y) <= o.data.ability.radius) || null;
}

// プレイヤーがダメージを受ける(食いしばり・死因の記録もここ)
//   cause:死んだときの死因 / text:ログに出す文 / killerId:倒した敵の種類(monsters.js の id。墓守に使う)
function damagePlayer(dmg, cause, text, killerId = null) {
  // デバッグの「無敵」:ダメージを受けない(ログには本来のダメージを出す)
  if (debugInvincible()) {
    addLog(`${text}(無敵)`);
    return;
  }
  playerHP -= dmg;
  runStats.damageTaken += dmg;
  addLog(text);
  // 特性「食いしばり」:1回の冒険で1度だけ、HP1で耐える(不死のセット効果でも付く。両方あっても1回だけ)
  if (playerHP <= 0 && (hasTrait("guts") || hasSetEffect("guts")) && !runStats.gutsUsed) {
    playerHP = 1;
    runStats.gutsUsed = true;
    addLog("食いしばった！ HP1で耐えた");
  }
  // 身代わりの護符:持っていれば、1回だけ代わりに砕けて HP1 で耐える(食いしばりのあと)
  if (playerHP <= 0 && consumePassiveTool("amulet")) {
    playerHP = 1;
    addLog("身代わりの護符が砕けた！ HP1で耐えた");
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

// 敵を図鑑に「出会った」として登録する(初めて戦ったとき:こちらが攻撃したか、攻撃を受けたとき。矢・炎・爆発も)
//   マップは最初から全部見えているので、見えただけでは登録しない(マウスを合わせても「？？？」)
function meetMonster(id) {
  base.records.seen[id] = true;
}

// 敵の攻撃力の範囲 [最小, 最大](詳細ウィンドウ用。monsterPower と同じ計算)
function monsterPowerRange(m) {
  const calc = v => Math.round(enemyStat(v, m.data.attackPerDepth, "attack") * commandRate(m) * (m.elite ? BALANCE.eliteAttackMultiplier : 1));
  return [calc(m.data.attackMin), calc(m.data.attackMax)];
}

// 着けている盾の「防ぐ%」(ゴブリン一族のセット効果で増える。shieldBlockMax まで)
function shieldBlockPercent() {
  const shield = equipped.shield;
  if (!shield || !shield.block) return 0;
  return Math.min(BALANCE.shieldBlockMax, shield.block + setEffectSum("shieldBlock"));
}

// 敵の攻撃がプレイヤーに向かう。当たったら受けたダメージ(1以上)、かわしたら 0 を返す
//   AGL で回避できる(evadable: false なら回避できない)。当たったら DEF で軽減
//   label:ログに出す攻撃の名前 / cause:死因 / canCrit: false なら会心なし
//   from:遠距離攻撃が飛んできた方向([dx, dy]。プレイヤーから見て)。向いている方向と同じなら、盾で減らせる
//   killer:攻撃した敵の種類(monsters.js の id)
//   category:ダメージの種類 / element:属性(elements.js の id。属性なしは null)。種類・属性に合う軽減の効果がかかる
function hitPlayer(raw, { label, cause, evadable = true, canCrit = true, from = null, killer = null, category = "melee", element = null }) {
  if (killer) meetMonster(killer); // 攻撃してきた敵は図鑑に登録(かわしても)
  const s = getPlayerStats();
  // 回避(鈍足のあいだは、回避率が下がる)
  if (evadable && chance(evadePercent(s) * slowMultiplier())) {
    addLog(`${label}をかわした！`);
    return 0;
  }
  // 敵の会心(痛恨の一撃)。特性「急所守り」で受けるダメージが減る
  const isCrit = canCrit && chance(enemyCritPercent());
  if (isCrit) raw = raw * BALANCE.enemyCritMultiplier * (1 - traitMax("critTakenDown", 0));
  // 盾:飛んできた方向を向いていれば、盾の「防ぐ%」だけ減らす
  const shield = equipped.shield;
  const blocked = from && shield && shield.block && facing && facing[0] === from[0] && facing[1] === from[1];
  const block = blocked ? shieldBlockPercent() : 0;
  if (blocked) raw = raw * (1 - block / 100);
  // 種類・属性に合う軽減(重装のセット効果で爆発・火属性が半分、など)
  const cut = 1 - damageTakenRate(category, element);
  if (cut > 0) raw = raw * (1 - cut);
  // 呪い「紙の守り」・狂熱の香薬で受けるダメージが増える
  const dmg = Math.round(reduceByDef(raw, s) * (1 + effectValue("dmgTaken") / 100) * buffTakenMultiplier());
  damagePlayer(dmg, cause, `${isCrit ? "痛恨の一撃！ " : ""}${label}！ ${blocked ? `盾で受けた(-${block}%) ` : ""}${cut > 0 ? `軽減(-${Math.round(cut * 100)}%) ` : ""}${dmg}のダメージ`, killer);
  return dmg;
}

// 敵1体の、1回分の行動
function monsterAction(m) {
  const ab = m.data.ability || {};
  const name = monsterName(m);
  const dx = px - m.x, dy = py - m.y;
  const dist = Math.abs(dx) + Math.abs(dy);
  if (m.cooldown > 0) m.cooldown -= 1;
  if (m.ballCd > 0) m.ballCd -= 1;     // ドラゴン:属性の球を次に撃てるまで
  if (m.breathCd > 0) m.breathCd -= 1; // ドラゴン:ブレスを次に吐けるまで
  if (m.blind > 0) m.blind -= 1;       // 煙玉:また気づけるようになるまで

  // 墓守:起こされるまで眠っている(こちらから攻撃するか、遺品を拾うと目を覚ます)
  if (m.dormant) return;

  // 視界に入った瞬間に気づいた敵:この行動は「気づくだけ」で終わる
  if (m.justNoticed) {
    m.justNoticed = false;
    return;
  }

  // ドラゴン:ブレスを溜めていたら吐く
  //   溜めたターンのうちは待つ(足の速い敵でも、溜めてから吐くまでに、必ずプレイヤーが1回動ける)
  if (m.charging) {
    if (turn > m.chargeTurn) breathFire(m, ab);
    return;
  }

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
    const [sx, sy] = DIRS4[randInt(0, 3)];
    tryMonsterStep(m, sx, sy);
    return;
  }
  // 視界:まだ気づいていなければ、見えたときに気づく(この行動は気づくだけ)。見えなければ、ときどきうろうろする
  if (!m.hunting) {
    if (monsterCanSee(m, px, py)) {
      noticePlayer(m);
    } else if (Math.random() < BALANCE.monsterWanderChance) {
      const [sx, sy] = DIRS4[randInt(0, 3)];
      tryMonsterStep(m, sx, sy);
    }
    return;
  }
  faceToward(m); // 気づいている敵は、こちらを向いて動く
  // 呼び子:気づいたあと、一度だけ角笛を吹いて、周りの敵を呼び寄せる
  if (ab.type === "alarm" && !m.alarmed) {
    m.alarmed = true;
    m.hunting = true;
    // ゴブリン一族のセット効果:角笛が効かない(仲間は集まらない)
    if (hasSetEffect("alarmImmune")) {
      addLog(`${name}が角笛を吹いた！ …が、ゴブリン一族の刻印の力で、仲間は気づかなかった`);
      return;
    }
    let called = 0;
    for (const o of monsters) {
      // 眠っている墓守は起きない(角笛で「気づいている」になると、不意打ちできなくなるため)
      if (o !== m && !o.hunting && !o.dormant && Math.abs(o.x - m.x) + Math.abs(o.y - m.y) <= ab.radius) { o.hunting = true; called++; }
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
    // ドラゴン:となりにいても、ときどきブレスを溜める
    if (ab.type === "dragon" && tryStartBreath(m, ab, dist)) return;
    // 隣にいれば攻撃(hit:当たったときのダメージ。かわされたら 0)。ドラゴンは「ひっかき」
    const hit = hitPlayer(monsterPower(m), { label: `${name}の${ab.type === "dragon" ? "ひっかき" : "攻撃"}`, cause: name, killer: m.data.id });
    // 吸血鬼:当たったら、与えたダメージ × rate だけ自分が回復する(死にかけでも)
    if (hit && ab.type === "drain" && m.hp < m.maxHp) {
      const heal = Math.min(m.maxHp - m.hp, Math.round(hit * ab.rate));
      if (heal > 0) { m.hp += heal; addLog(`${name}は血をすすって、HPが${heal}回復した`); }
    }
    if (!hit || playerHP <= 0) return;
    if (ab.type === "poison") dotPlayer("poison", dotDamageOf(m, ab), ab.turns, name, m.data.id);
    if (ab.type === "burn") dotPlayer("burn", dotDamageOf(m, ab), ab.turns, name, m.data.id);
    if (ab.type === "weaken") weakenPlayer(ab.turns, ab.atkCut);
    if (ab.type === "slow") slowPlayer(ab.turns, ab.aglCut);
    if (ab.type === "steal" && potions > 0 && !m.stolen) { // 盗むのは1回だけ
      potions -= 1;
      m.stolen = 1;
      m.fleeing = ab.fleeTurns || 8; // 逃げる回数
      addLog(`${name}に回復薬を盗まれた！ 倒せば取り返せる`);
    }
  } else {
    // (ここに来るのは、気づいている敵だけ)
    // 弓兵:縦か横にまっすぐ並んでいて、間に何もなければ矢を撃つ
    if (ab.type === "ranged" && dist <= ab.range && clearLineToPlayer(m)) {
      hitPlayer(monsterPower(m), { label: `${name}の矢`, cause: name, killer: m.data.id, from: [Math.sign(m.x - px), Math.sign(m.y - py)], category: "ranged" });
      return;
    }
    // 鬼火:射程内なら、追いかけてくる炎を放つ(しばらく撃てない)
    if (ab.type === "fire" && !(m.cooldown > 0) && dist <= ab.range) {
      spawnFlame(m, ab);
      m.cooldown = ab.cooldown;
      return;
    }
    // リザードマン:縦か横にまっすぐ range マス先までなら、その場から槍で突く(となりは普通の攻撃)
    if (ab.type === "reach" && dist <= ab.range && clearLineToPlayer(m)) {
      hitPlayer(monsterPower(m), { label: `${name}の槍`, cause: name, killer: m.data.id });
      return;
    }
    // 死霊術師:しばらくおきに、となりに呼び出す
    if (ab.type === "summon" && !(m.cooldown > 0) && trySummon(m, ab)) {
      m.cooldown = ab.cooldown;
      return;
    }
    // ドラゴン:ブレスを溜めるか、縦か横にまっすぐ並んでいれば属性の球を飛ばす
    if (ab.type === "dragon") {
      if (tryStartBreath(m, ab, dist)) return;
      if (!(m.ballCd > 0) && clearLineToPlayer(m) && spawnBall(m, ab)) return;
    }
    // 追いかける
    stepTowardPlayer(m);
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

// ブレスを溜めている敵の、赤く光らせるマス("x,y" の集まり。マップを描くときと詳細ウィンドウで使う)
function dangerTiles() {
  const set = new Set();
  for (const m of monsters) {
    if (m.charging) for (const t of m.breathTiles || []) set.add(`${t.x},${t.y}`);
  }
  return set;
}

// ==================== 継続ダメージ(毒・やけど) ====================
// 毎ターンダメージを受ける状態。DEF は効かない。回復薬・キャンプで治る
//   ダメージの種類は「状態異常」(dot)。属性は element(elements.js の id)。どちらかに合う軽減の効果で減らせる
//   種類を増やすときは DOT_TYPES に足す
//   name:表示名 / element:属性 / cls:ステータス欄の色(CSS のクラス名) / gotText:かかったときのログ / endText:抜けたときのログ
const DOT_TYPES = {
  poison: { name: "毒",     element: "poison", cls: "poison", gotText: "毒を受けた！",     endText: "毒が抜けた" },
  burn:   { name: "やけど", element: "fire",   cls: "burn",   gotText: "やけどを負った！", endText: "やけどが治まった" },
};

// プレイヤーの継続ダメージ:種類 → { dmg: 毎ターンのダメージ, turns: 残りターン, from: かけた敵の名前, fromId: その敵の種類 }
//   かかっていない種類は入っていない(毒とやけどは、同時にかかることもある)
let playerDots = {};

// プレイヤーを継続ダメージの状態にする(kind:"poison" / "burn")
//   もうかかっていれば、強いほうのダメージだけ引き継ぐ。残りターンは戻らない(何度も攻撃されて、ずっと切れないのを防ぐ)
//   from:かけた敵の名前 / fromId:その敵の種類(これで死んだときの墓守に使う)
function dotPlayer(kind, dmg, turns, from, fromId = null) {
  const type = DOT_TYPES[kind];
  // 竜のセット効果:やけどにならない
  if (kind === "burn" && hasSetEffect("burnImmune")) {
    addLog("竜の刻印の力で、やけどしなかった");
    return;
  }
  // 獣のセット効果:毒が半分のターンで抜ける
  if (kind === "poison" && hasSetEffect("poisonHalf")) turns = Math.ceil(turns / 2);
  const cur = playerDots[kind];
  if (cur) {
    cur.dmg = Math.max(cur.dmg, dmg);
    addLog(`${type.name}が強まった…(毎ターン${cur.dmg}ダメージ、あと${cur.turns}ターン)`);
    return;
  }
  playerDots[kind] = { dmg, turns, from, fromId };
  addLog(`${type.gotText}(${turns}ターン、毎ターン${dmg}ダメージ)`);
}

// 継続ダメージを全部治す(回復薬・キャンプ)。何か治ったら true
function cureDots() {
  const had = Object.keys(playerDots).length > 0;
  playerDots = {};
  return had;
}

// 敵の攻撃が当たったときの、継続ダメージ(ability の damage / damagePerDepth / turns から計算)
//   深い階・険しい道・エリートほど強い(攻撃力と同じ倍率)
function dotDamageOf(m, ab) {
  return Math.round(enemyStat(ab.damage, ab.damagePerDepth, "attack") * (m.elite ? BALANCE.eliteAttackMultiplier : 1));
}

// ==================== 鈍足 ====================
// プレイヤーの鈍足:{ turns: 残りターン, aglCut: 回避率が下がる割合 }(鈍足でなければ null)。キャンプで治る
let playerSlow = null;

function slowPlayer(turns, aglCut) {
  if (playerSlow) {
    playerSlow.turns = Math.max(playerSlow.turns, turns);
    playerSlow.aglCut = Math.max(playerSlow.aglCut, aglCut);
  } else {
    playerSlow = { turns, aglCut };
  }
  addLog(`体が重くなった…(鈍足:${turns}ターン、回避率-${Math.round(aglCut * 100)}%)`);
}

// 鈍足で下がったあとの回避率の倍率(鈍足でなければ 1)
function slowMultiplier() {
  return playerSlow ? 1 - playerSlow.aglCut : 1;
}

// ==================== 衰弱 ====================
// プレイヤーの衰弱:{ turns: 残りターン, atkCut: ATK が下がる割合 }(衰弱でなければ null)
let playerWeak = null;

function weakenPlayer(turns, atkCut) {
  // 不死のセット効果:衰弱にならない
  if (hasSetEffect("weakenImmune")) {
    addLog("不死の刻印の力で、衰弱しなかった");
    return;
  }
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

// 毎ターンの継続ダメージ(プレイヤーの毒・やけどと、毒になった敵)・衰弱と鈍足の残りターン・トロルの回復
function poisonTick() {
  if (playerWeak) {
    playerWeak.turns -= 1;
    if (playerWeak.turns <= 0) {
      playerWeak = null;
      addLog("力が戻ってきた");
    }
  }
  if (playerSlow) {
    playerSlow.turns -= 1;
    if (playerSlow.turns <= 0) {
      playerSlow = null;
      addLog("体の重さが抜けた");
    }
  }
  // トロル:毒でなければ回復する
  for (const m of monsters) {
    const ab = m.data.ability;
    if (ab && ab.type === "regen" && !m.poison && m.hp < m.maxHp) {
      m.hp = Math.min(m.maxHp, m.hp + Math.max(1, Math.round(m.maxHp * ab.rate)));
    }
  }
  for (const kind in playerDots) {
    const p = playerDots[kind];
    const type = DOT_TYPES[kind];
    p.turns -= 1;
    // 状態異常・その属性に合う軽減がかかる(重装のセット効果で、やけどが半分など)
    const dmg = Math.max(1, Math.round(p.dmg * damageTakenRate("dot", type.element)));
    damagePlayer(dmg, `${p.from}の${type.name}`, `${type.name}で${dmg}のダメージ${p.turns > 0 ? `(あと${p.turns}ターン)` : ""}`, p.fromId);
    if (p.turns <= 0) {
      delete playerDots[kind];
      if (playerHP > 0) addLog(type.endText);
    }
    if (playerHP <= 0) return;
  }
  for (const m of monsters.slice()) {
    // 途中でいなくなった敵(術師が毒で倒れて、崩れ落ちた呼び出しなど)は飛ばす
    if (!m.poison || !monsters.includes(m)) continue;
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
  // エリートは落としやすい。険しい道でも落としやすくなる
  const rate = m.data.dropChance * luckDropMultiplier() * (m.elite ? BALANCE.eliteDropMultiplier : 1) * routeFx("dropRate", 1);
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
