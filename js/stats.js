// ステータスの計算と、一族のセット効果、書・スキル・特性
// index.html から <script src> で読み込まれる(読み込む順番は index.html に書いてある)

// ==================== ステータス計算 ====================
// 今のプレイヤーのステータス(素のステータス + 装備 + 刻印 + 書のスキル)を計算する
//   eqMap を渡すと「その装備の組み合わせだったら」のステータスを計算する(付け替えの比較用)
function getPlayerStats(eqMap = equipped) {
  const src = statSources(eqMap);
  const s = {};
  for (const key in STAT_NAMES) {
    s[key] = src.base[key] + src.equip[key] + src.material[key] + src.book[key] + src.trait[key];
  }
  return s;
}

// ステータスを「どこから来た数値か」に分けて計算する(ステータス画面の内訳にも使う)
//   base:素のステータス / equip:装備 / material:刻印(装備を着けている枠だけ)
//   materialIdle:セットしているが、装備を着けていないので効いていない刻印
//   book:書のスキル / trait:特性(頑丈の最大HPなど)と、一族のセット効果(AGL+ など)
function statSources(eqMap = equipped) {
  const zero = () => Object.fromEntries(Object.keys(STAT_NAMES).map(k => [k, 0]));
  const src = { base: { ...zero(), ...BALANCE.playerBaseStats }, equip: zero(), material: zero(), materialIdle: zero(), book: zero(), trait: zero() };
  // ステータスを下げる呪い(effects.js で stat を書いたもの)は、その装備・刻印の分から引く
  const addCurses = (to, effects) => {
    for (const fx of effects || []) {
      const e = EFFECTS[fx.id];
      if (e && e.stat) to[e.stat] -= fx.value;
    }
  };
  for (const slot in eqMap) {
    for (const key in eqMap[slot].stats) src.equip[key] += eqMap[slot].stats[key];
    addCurses(src.equip, eqMap[slot].effects);
  }
  for (const slot in base.materialSet) {
    const to = eqMap[slot] ? src.material : src.materialIdle;
    for (const key in base.materialSet[slot].stats) to[key] += base.materialSet[slot].stats[key];
    addCurses(to, base.materialSet[slot].effects);
  }
  // セットしている書のスキル(振ったポイントに応じた分)
  for (const book of setBooks()) {
    src.book[book.stat] += skillBonus(book, base.skillAlloc[book.id] || 0);
  }
  // 特性「頑丈」で最大HPが増える
  src.trait.hp += traitMax("bonusHp", 0);
  // 一族のセット効果で上がるステータス(ステータス画面では「書・特性」の列に入る)
  for (const set of activeSets(eqMap)) {
    for (const key in set.stats || {}) src.trait[key] += set.stats[key];
  }
  return src;
}

// ==================== 一族のセット効果 ====================
// 同じ一族の固有装備から刻んだ刻印をそろえると、セット効果が付く(一族とセット効果は sets.js)
//   刻印は「その枠に装備を着けているときだけ」数える(刻印の効果と同じ)
function clanById(id) {
  return clanList.find(c => c.id === id) || null;
}

// 敵の一族の一覧(monsters.js の clan は、1つなら "undead"、2つなら ["undead", "dragons"] のように書く)
function monsterClans(monsterData) {
  if (!monsterData || !monsterData.clan) return [];
  return [].concat(monsterData.clan).map(clanById).filter(c => c);
}

// 敵の一族(なければ null)。2つあるときは最初の一族(マップの色・号令に使う)
function monsterClan(monsterData) {
  return monsterClans(monsterData)[0] || null;
}

// 敵のマップ上の色:一族があれば一族の色(sets.js の colors。書いていなければ一族の color)。なければ monsters.js の color
//   エリート・墓守の金色は、マップを描くところ(tileAt)で優先している
function monsterColor(monsterData) {
  const clan = monsterClan(monsterData);
  if (!clan) return monsterData.color;
  return (clan.colors && clan.colors[monsterData.id]) || clan.color || monsterData.color;
}

// 装備の一族の一覧(敵の固有装備なら、その敵の一族。床の装備などは空)
//   一族が2つある敵(ドラゴンゾンビ)の装備は、両方の一族に数える
function equipmentClans(equipData) {
  return equipData ? monsterClans(monsterList.find(m => m.id === equipData.from)) : [];
}

// 刻印の一族の一覧(元の装備から決める)
//   合成した刻印は、元の2つの一族を両方持つ。同じ一族どうしを合成したものは1つ分
function materialClans(mat) {
  const clans = [];
  for (const id of mat.sources || []) {
    for (const clan of equipmentClans(equipmentList.find(e => e.id === id))) {
      if (!clans.includes(clan)) clans.push(clan);
    }
  }
  return clans;
}

// 一族ごとの刻印の数(一族の id → 数)
//   needEquip:true なら、装備を着けている枠の刻印だけ数える(拠点の表示では false で、セット中の全部を数える)
function clanCounts(eqMap = equipped, needEquip = true) {
  const counts = {};
  for (const slot in base.materialSet) {
    if (needEquip && !eqMap[slot]) continue;
    for (const clan of materialClans(base.materialSet[slot])) counts[clan.id] = (counts[clan.id] || 0) + 1;
  }
  return counts;
}

// 今効いているセット効果の一覧(sets.js の sets の中のもの)
function activeSets(eqMap = equipped) {
  const counts = clanCounts(eqMap);
  const list = [];
  for (const clan of clanList) {
    for (const set of clan.sets || []) {
      if ((counts[clan.id] || 0) >= set.count) list.push(set);
    }
  }
  return list;
}

// セット効果 key の合計(数値の効果。なければ 0)
function setEffectSum(key) {
  return activeSets().reduce((sum, set) => sum + (typeof set[key] === "number" ? set[key] : 0), 0);
}

// セット効果 key があるか(ON / OFF の効果)
function hasSetEffect(key) {
  return activeSets().some(set => set[key]);
}

// ==================== ダメージの種類と属性 ====================
// プレイヤーが受けるダメージには、種類(category)と属性(element)の札が付く(elements.js)
// 種類・属性に合う「ダメージを減らす効果」を全部かけた倍率を返す(1 なら減らない、0.5 なら半分)
//   今はセット効果の damageCut だけ。あとで特性や装備の効果からも足せるように、ここにまとめている
function damageTakenRate(category, element = null) {
  let rate = 1;
  for (const set of activeSets()) {
    for (const cut of set.damageCut || []) {
      const okCategory = !cut.category || cut.category === category;
      const okElement = !cut.element || cut.element === element;
      if (okCategory && okElement) rate *= 1 - cut.rate;
    }
  }
  return rate;
}

// ==================== 書・スキル ====================
function bookById(id) {
  return bookList.find(b => b.id === id) || null;
}

// セットしている書の一覧(空いている枠は含まない)
function setBooks() {
  return base.bookSet.filter(id => id).map(bookById).filter(b => b);
}

// points ポイント振ったときに、何段階目まで上がっているか(5, 15, 25, … で1段階ずつ)
function skillTiers(book, points) {
  if (points < BALANCE.bookTierFirst) return 0;
  const tiers = Math.floor((points - BALANCE.bookTierFirst) / BALANCE.bookTierStep) + 1;
  return Math.min(tiers, maxSkillTiers(book));
}

// その書の段階の最大数(上限ポイントより前にある区切りの数)
function maxSkillTiers(book) {
  return Math.floor((book.maxPoints - 1 - BALANCE.bookTierFirst) / BALANCE.bookTierStep) + 1;
}

// points ポイント振ったときのステータスの上がり量
function skillBonus(book, points) {
  return skillTiers(book, points) * book.perTier;
}

// 次の段階に必要なポイントの合計(もう段階がなければ上限ポイント)
function nextTierPoints(book, points) {
  const t = skillTiers(book, points);
  if (t >= maxSkillTiers(book)) return book.maxPoints;
  return BALANCE.bookTierFirst + t * BALANCE.bookTierStep;
}

// 特性が解放されている書の特性の一覧(上限まで振り切った書だけ)
//   includeLower の特性なら、同じ系統の下のレベルの書の特性もすべて発動する(その書を持っていなくても)
function activeTraits() {
  const traits = [];
  for (const b of setBooks().filter(b => (base.skillAlloc[b.id] || 0) >= b.maxPoints)) {
    traits.push(b.trait);
    if (b.trait.includeLower) {
      for (const lower of bookList.filter(x => x.group === b.group && x.level < b.level)) traits.push(lower.trait);
    }
  }
  return traits;
}

// 解放されている特性のうち、効果 key のいちばん大きい値(なければ def)
//   同じ種類の効果が2つあっても足し算はしない
function traitMax(key, def) {
  return Math.max(def, ...activeTraits().map(t => (typeof t[key] === "number" ? t[key] : def)));
}

// 特性 key を持っているか(食いしばりなど、ON / OFF の効果)
function hasTrait(key) {
  return activeTraits().some(t => t[key]);
}

// 会心の抽選回数(特性「会心出やすい」で増える)
function critRolls() {
  return traitMax("critRolls", 1);
}

// 会心のダメージ倍率(特性「会心ダメージUP」で上がる。呪われた装備の「急所狙い」でさらに上がる)
function critMultiplier() {
  return Math.round((traitMax("critMultiplier", BALANCE.critMultiplier) + effectValue("critDmg") / 100) * 100) / 100;
}

// HP回復の倍率(特性「回復強化」で上がる。1.2 なら回復量 +20%。呪い「渇き」で下がる)
function healMultiplier() {
  return Math.max(0, 1 + traitMax("healBoost", 0) - effectValue("healDown") / 100);
}

// 「もし枠 slot の装備を eq に替えたら」の装備の組み合わせを作る(eq が null なら外す)
//   eq がほかの枠(指輪2 など)に着いていたら、2つの枠の中身を入れ替える
function planEquip(slot, eq) {
  const plan = { ...equipped };
  const other = eq ? Object.keys(plan).find(s => plan[s] === eq) : null;
  const old = plan[slot];
  if (eq) plan[slot] = eq; else delete plan[slot];
  if (other && other !== slot) {
    if (old) plan[other] = old; else delete plan[other];
  }
  return plan;
}

// 装備が変わって最大HPが変わったとき、受けているダメージ量はそのままにする
//   (例:HP 150/200 で HP+100 の装備 → 250/300。外すと 150/200 に戻る)
function updateMaxHP() {
  const damage = maxHP - playerHP;
  maxHP = getPlayerStats().hp;
  playerHP = maxHP - damage;
}

// ポイントを%に換算する(curve は BALANCE の defCurve / aglCurve / crtCurve)
//   stepPercent があれば「stepPercent 上がるごとに、必要なポイントの合計が stepRate 倍」の換算(DEF・AGL)
function pointsToPercent(points, curve) {
  const { softPts, softPercent, hardPts, hardPercent } = curve;
  if (points <= 0) return 0;
  // ソフトキャップまでは、まっすぐ上がる
  if (points <= softPts) return softPercent * points / softPts;
  if (curve.stepPercent) return steppedPercent(points, curve);
  // ハードキャップ以上は、それ以上上がらない
  if (points >= hardPts) return hardPercent;
  // その間は、ハードキャップに近づくほど伸びが鈍る
  //   t:ソフト〜ハードの間のどこにいるか(0〜1)。1 - (1 - t)^2 は、最初は大きく伸び、だんだん伸びが小さくなる曲線
  const t = (points - softPts) / (hardPts - softPts);
  return softPercent + (hardPercent - softPercent) * (1 - (1 - t) * (1 - t));
}

// ソフトキャップより先:stepPercent 上がるごとに、必要なポイントの合計が stepRate 倍になる(maxPercent で止まる)
//   例(DEF):30% = 360pt → 40% = 720pt → 50% = 1440pt …。区切りの間は、まっすぐ上がる
function steppedPercent(points, curve) {
  const { softPts, softPercent, stepPercent, stepRate, maxPercent } = curve;
  let pct = softPercent, from = softPts;
  while (pct < maxPercent) {
    const to = from * stepRate; // 次の区切り(pct + stepPercent)に必要なポイント
    if (points < to) return Math.min(maxPercent, pct + stepPercent * (points - from) / (to - from));
    pct += stepPercent;
    from = to;
  }
  return maxPercent;
}

function defCutPercent(stats) {
  return pointsToPercent(stats.def, BALANCE.defCurve);
}

function evadePercent(stats) {
  return pointsToPercent(stats.agl, BALANCE.aglCurve);
}

// 運(LUK)の%
function luckPercent(stats) {
  return pointsToPercent(stats.luk, BALANCE.lukCurve);
}

// 会心率(1回の抽選で当たる確率)
function critPercent(stats) {
  return pointsToPercent(stats.crt, BALANCE.crtCurve);
}

// 実際に会心が出る確率(抽選が複数回なら、どれか1回でも当たれば会心)
function critChanceTotal(stats) {
  const miss = 1 - critPercent(stats) / 100;
  return (1 - Math.pow(miss, critRolls())) * 100;
}

// 会心の判定:抽選回数ぶん抽選して、1回でも当たれば会心
function rollCrit(stats) {
  for (let i = 0; i < critRolls(); i++) {
    if (chance(critPercent(stats))) return true;
  }
  return false;
}

// percent(%)の確率で true を返す
function chance(percent) {
  return Math.random() * 100 < percent;
}

// 攻撃力を元に、ブレ幅つきのダメージを出す
function rollDamage(power) {
  const spread = 1 + (Math.random() * 2 - 1) * BALANCE.damageSpread;
  return Math.max(1, Math.round(power * spread));
}

// DEF の軽減率ぶん、受けるダメージを減らす
function reduceByDef(dmg, stats) {
  const reduced = dmg * (1 - defCutPercent(stats) / 100);
  return Math.max(1, Math.round(reduced));
}
