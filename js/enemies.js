// 敵の動き・視界・ダメージを与える・ドロップ(特殊な技は enemyskills.js、状態異常は ailments.js)
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
  if (m.hunting || m.dormant || m.disguised) return set;
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
  if (m.dormant || m.disguised) return set; // 化けているミミックは、F キーでも宝箱のまま(正体がばれない)
  const ab = m.data.ability || {};
  const add = (x, y) => { if (map[y] && map[y][x] !== undefined && map[y][x] !== "#") set.add(`${x},${y}`); };
  if (ab.type === "explode" || ab.type === "sweep") {
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
  if (ab.type === "ranged" || ab.type === "reach" || ab.type === "rush") line(ab.range);
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
    if (!m.hunting && !m.dormant && !m.disguised && monsterCanSee(m, px, py)) {
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
  ranged:  a => `縦か横にまっすぐ並ぶと、離れたところから${a.shot || "矢"}を撃つ(射程${a.range})`,
  poison:  a => `攻撃が当たると毒にする(${a.turns}ターン、毎ターン${a.damage}〜)`,
  steal:   a => `攻撃が当たると回復薬を盗んで逃げる。${a.fleeTurns || 8}回逃げたら戻ってくる(倒すと取り返せる)`,
  stealTool: a => `攻撃が当たると、持ちこんだ道具(宝の地図もふくむ)を1つ盗んで逃げる。${a.fleeTurns || 8}回逃げたら戻ってくる(倒すと取り返せる)`,
  fire:    a => `追いかけてくる炎を放つ(炎は${a.turns}ターン残る。ぶつかれば消せる)`,
  explode: () => "隣に来ると膨らみ、次の行動で周りを巻きこんで爆発する",
  erratic: a => `${Math.round(a.chance * 100)}%くらいの確率で、ふらふらと適当な方向に飛ぶ`,
  alarm:   a => `見つかると一度だけ${a.sound || "角笛を吹いて"}、${a.radius}マス以内の敵を呼び寄せる`,
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
  reach:   a => `${a.shot || "槍"}で、縦か横にまっすぐ${a.range}マス先まで、その場から攻撃してくる`,
  mimic:   () => "宝箱に化けている(よく見ると、名前が少しおかしい)。開けようとすると正体を現して噛みつく。倒すと宝箱の中身を落とす",
  blind:   a => `${a.erratic ? `${Math.round(a.erratic * 100)}%くらいの確率で、ふらふらと飛ぶ。` : ""}`
    + `攻撃が当たると盲目にする(${a.turns}ターン、周り${BALANCE.blindSightRadius}マスしか見えない)`,
  sweep:   a => `となりにいると、ときどき構えて、次の行動で大技を放つ(構えのあいだ範囲が赤く光る)。`
    + `薙ぎ払い:前の3マスに攻撃力×${a.sweepPower} / 回転切り:周り8マスに攻撃力×${a.spinPower}`,
  rush:    a => `縦か横にまっすぐ並ぶと、ときどき溜めて、次の行動で${a.range}マスまで一直線に突進する(溜めのあいだ線が赤く光る。`
    + `当たると攻撃力×${a.rushPower}。外れると${a.stunTurns}回動けない)`,
  dragon:  a => {
    const el = ELEMENT_DATA[a.element];
    const prey = a.absorb && (monsterList.find(m => m.id === a.absorb.id) || { name: "？？？" }).name;
    return `となりならひっかく。縦か横にまっすぐ並ぶと${el.ballName}を飛ばす(壁に当たるまで飛ぶ。見てからよけられる)。`
      + `ときどき前方${a.breathRange}マスの扇形に${el.name}のブレスを吐く(溜めのあいだ範囲が赤く光る。口から遠いほど弱い)`
      + (a.absorb ? `。弱ってくると、周り${a.absorb.radius}マスの${prey}を吸いこんで、最大HPの${Math.round(a.absorb.healRate * 100)}%回復する` : "")
      + (a.deathBlast ? `。倒すと${a.deathBlast.delay > 0 ? "少しして" : ""}死骸が爆発し(周り${a.deathBlast.radius}マス)、`
        + `${a.deathBlast.poolTurns}ターンで消える毒沼が広がる` : "");
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
  deathBlastsAct(); // ドラゴンゾンビの死骸の爆発
  if (playerHP <= 0) return;
  poisonTick();
  for (const bl of deathBlasts) bl.fresh = false; // このターンに倒された死骸も、次のプレイヤーの行動から数える
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
  if (m.absorbCd > 0) m.absorbCd -= 1; // ドラゴンゾンビ:次に仲間を吸いこめるまで
  if (m.blind > 0) m.blind -= 1;       // 煙玉:また気づけるようになるまで

  // 墓守:起こされるまで眠っている(こちらから攻撃するか、遺品を拾うと目を覚ます)
  // ミミック:宝箱に化けているあいだは動かない
  if (m.dormant || m.disguised) return;

  // 視界に入った瞬間に気づいた敵:この行動は「気づくだけ」で終わる
  if (m.justNoticed) {
    m.justNoticed = false;
    return;
  }

  // ドラゴン:ブレスを溜めていたら吐く(ガーゴイル:構えていたら大技を放つ)
  //   溜めたターンのうちは待つ(足の速い敵でも、溜めてから吐くまでに、必ずプレイヤーが1回動ける)
  if (m.charging) {
    if (turn > m.chargeTurn) {
      if (ab.type === "sweep") sweepStrike(m, ab);
      else if (ab.type === "rush") rushStrike(m, ab);
      else breathFire(m, ab);
    }
    return;
  }
  // 竜人:突進が外れて体勢を崩しているあいだは動けない
  if (m.stunned > 0) {
    m.stunned -= 1;
    return;
  }

  // 盗賊:回復薬を盗んだあとは(盗賊頭は道具を盗んだあとは)、しばらく逃げ回る。逃げ疲れたら戻ってくる(もう盗まない)
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
  // コウモリ:ときどき、ふらふらと適当な方向に飛ぶ(影蝙蝠のように、ほかの動きと一緒に erratic で書くこともできる)
  const erraticChance = ab.type === "erratic" ? ab.chance : (ab.erratic || 0);
  if (erraticChance > 0 && Math.random() < erraticChance) {
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
  // ドラゴンゾンビ:弱ってきたら、周りのグールを吸いこんで回復する
  if (ab.absorb && tryAbsorb(m, ab.absorb)) return;
  // 呼び子:気づいたあと、一度だけ角笛を吹いて、周りの敵を呼び寄せる
  if (ab.type === "alarm" && !m.alarmed) {
    m.alarmed = true;
    m.hunting = true;
    // 角笛のほかに、叫び声など(monsters.js の ability.sound。ログ用に「〜て」を「〜た」にする)
    const sound = ab.sound ? ab.sound.replace(/て$/, "た") : "角笛を吹いた";
    // ゴブリン一族のセット効果:ゴブリン一族の角笛が効かない(仲間は集まらない)
    if (hasSetEffect("alarmImmune") && m.data.clan === "goblins") {
      addLog(`${name}が${sound}！ …が、ゴブリン一族の刻印の力で、仲間は気づかなかった`);
      return;
    }
    let called = 0;
    for (const o of monsters) {
      // 眠っている墓守は起きない(角笛で「気づいている」になると、不意打ちできなくなるため)
      if (o !== m && !o.hunting && !o.dormant && !o.disguised && Math.abs(o.x - m.x) + Math.abs(o.y - m.y) <= ab.radius) { o.hunting = true; called++; }
    }
    addLog(`${name}が${sound}！${called > 0 ? ` 周りの敵が${called}体、こちらに向かってくる` : ""}`);
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
    // ガーゴイル:ときどき大技を構える
    if (ab.type === "sweep" && tryStartSweep(m, ab)) return;
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
    if (ab.type === "blind") blindPlayer(ab.turns);
    if (ab.type === "steal" && potions > 0 && !m.stolen) { // 盗むのは1回だけ
      potions -= 1;
      m.stolen = 1;
      m.fleeing = ab.fleeTurns || 8; // 逃げる回数
      addLog(`${name}に回復薬を盗まれた！ 倒せば取り返せる`);
    }
    if (ab.type === "stealTool" && runTools.length > 0 && !m.stolenTool) stealTool(m, ab);
  } else {
    // (ここに来るのは、気づいている敵だけ)
    // 弓兵:縦か横にまっすぐ並んでいて、間に何もなければ矢を撃つ(矢のほかの飛び道具は ability.shot)
    if (ab.type === "ranged" && dist <= ab.range && clearLineToPlayer(m)) {
      hitPlayer(monsterPower(m), { label: `${name}の${ab.shot || "矢"}`, cause: name, killer: m.data.id, from: [Math.sign(m.x - px), Math.sign(m.y - py)], category: "ranged" });
      return;
    }
    // 鬼火:射程内なら、追いかけてくる炎を放つ(しばらく撃てない)
    if (ab.type === "fire" && !(m.cooldown > 0) && dist <= ab.range) {
      spawnFlame(m, ab);
      m.cooldown = ab.cooldown;
      return;
    }
    // リザードマン:縦か横にまっすぐ range マス先までなら、その場から槍で突く(となりは普通の攻撃。槍のほかの武器は ability.shot)
    if (ab.type === "reach" && dist <= ab.range && clearLineToPlayer(m)) {
      hitPlayer(monsterPower(m), { label: `${name}の${ab.shot || "槍"}`, cause: name, killer: m.data.id });
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
    // ガーゴイル:ななめのとなりにいても、大技を構えることがある
    if (ab.type === "sweep" && tryStartSweep(m, ab)) return;
    // 竜人:まっすぐ並んでいれば、ときどき突進を溜める
    if (ab.type === "rush" && tryStartRush(m, ab, dist)) return;
    // 追いかける
    stepTowardPlayer(m);
  }
}

// 盗賊頭:持ちこんだ道具(宝の地図もふくむ)から1つ盗んで逃げる(盗むのは1回だけ)
//   何個もある道具は1個だけ盗む。盗んだものは m.stolenTool に入り、倒すと取り返せる(combat.js の killMonster)
function stealTool(m, ab) {
  const t = runTools[randInt(0, runTools.length - 1)];
  if (t.count > 1) {
    t.count -= 1;
    m.stolenTool = { id: t.id, count: 1 };
  } else {
    runTools = runTools.filter(x => x !== t);
    m.stolenTool = t; // 宝の地図は宝の印とつながっているので、そのものを持っていく
  }
  m.fleeing = ab.fleeTurns || 8;
  addLog(`${monsterName(m)}に${toolLabel(m.stolenTool)}を盗まれた！ 倒せば取り返せる`);
}

// 盗賊頭に盗まれた道具を取り返す(同じ道具を持っていれば、その数に足す)
function returnStolenTool(m) {
  const t = m.stolenTool;
  const same = t.id !== "treasureMap" && runTools.find(x => x.id === t.id);
  if (same) same.count += t.count;
  else runTools.push(t);
  addLog(`盗まれた${toolLabel(t)}を取り返した`);
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

// ==================== ターンの終わり・ドロップ ====================
// プレイヤーが1回行動したあとの処理:ダメージ床を確かめ、敵が動き、死んだか確認して、画面を描き直す
function endPlayerTurn() {
  hazardTick(); // 毒沼・マグマの上にいたらダメージ(js/hazard.js)
  tempHazardsTick(); // しばらくで消える毒沼の残りターンを減らす
  if (playerHP <= 0) {
    handlePlayerDeath();
    return;
  }
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
