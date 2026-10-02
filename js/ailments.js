// プレイヤーの状態異常:継続ダメージ(毒・やけど)・鈍足・盲目・衰弱と、毎ターンの残りターン処理
// index.html から <script src> で読み込まれる(読み込む順番は index.html に書いてある)

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
//   refresh:true なら、残りターンを turns まで戻す(毒沼・マグマ:上にいるあいだ切れないように。もともと短いので長引かない)
function dotPlayer(kind, dmg, turns, from, fromId = null, refresh = false) {
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
    if (refresh) {
      cur.turns = Math.max(cur.turns, turns);
      addLog(`${type.name}が続いている…(毎ターン${cur.dmg}ダメージ、あと${cur.turns}ターン)`);
    } else {
      addLog(`${type.name}が強まった…(毎ターン${cur.dmg}ダメージ、あと${cur.turns}ターン)`);
    }
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

// ==================== 盲目 ====================
// プレイヤーの盲目:{ turns: 残りターン }(盲目でなければ null)。時間・回復薬・キャンプで治る
//   盲目のあいだは、周り blindSightRadius マスしか見えない(見える範囲の仕組みは dungeon.js の「見える範囲」)
let playerBlind = null;

function blindPlayer(turns) {
  // 影の衣などの効果「影の目」:盲目にならない
  if (effectValue("blindImmune") > 0) {
    addLog("影の目の力で、目がくらまなかった");
    return;
  }
  playerBlind = { turns: Math.max(playerBlind ? playerBlind.turns : 0, turns) };
  addLog(`目がくらんだ！(盲目:${turns}ターン、周り${BALANCE.blindSightRadius}マスしか見えない)`);
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

// 毎ターンの継続ダメージ(プレイヤーの毒・やけどと、毒になった敵)・衰弱・鈍足・盲目の残りターン・トロルの回復
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
  if (playerBlind) {
    playerBlind.turns -= 1;
    if (playerBlind.turns <= 0) {
      playerBlind = null;
      addLog("目が見えるようになった");
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
