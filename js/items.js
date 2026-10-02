// 装備・呪われた装備の効果・持ち物・刻む・素材・刻印の強化と合成
// index.html から <script src> で読み込まれる(読み込む順番は index.html に書いてある)

// ==================== 装備 ====================
// 入手先が from("field" か敵の id)の装備の中から1種類選ぶ
function pickEquipmentData(d, from) {
  return pickWeighted(equipmentList.filter(e => e.from === from), d);
}

// -1〜+1 の乱数。0 付近が出やすく、端(±1)ほど出にくい
//   乱数を3つ平均すると、真ん中に寄りやすくなる性質を使っている
function biasedRoll() {
  const avg = (Math.random() + Math.random() + Math.random()) / 3; // 0〜1、0.5付近が出やすい
  return avg * 2 - 1;
}

// 装備データ(equipment.js の1行)から、実際に落ちている装備を1個作る(d:ドロップした階層)
//   rarity:レア度(RARITY_TYPES の1つ。謎の塊を鑑定したときだけ渡す。床・宝箱・敵の装備にはレア度は付かない)
function makeEquipment(data, d, forceCursed = false, rarity = null) {
  // 5階ごとに一段階強くなる(1〜5階は段階0、6〜10階は段階1、…)
  const tier = Math.floor((d - 1) / BALANCE.equipTierFloors);
  const tierRate = 1 + tier * BALANCE.equipGrowthPerTier;

  // 呪われた装備:基礎値が高く、良い効果と呪いが1つずつ付く
  //   謎の塊の装備(レア度つき)も lumpCursedChance で呪われる(レア度の性能に、呪いの分が上乗せ。呪われたミシックもある)
  const cursed = forceCursed || chance((rarity ? BALANCE.lumpCursedChance : BALANCE.cursedChance) * 100);
  const cursedRate = cursed ? 1 + BALANCE.cursedStatBonus : 1;
  // レア度:基礎値の倍率と、個体差の範囲が変わる(普通は今までの装備と同じ)
  const special = rarity && rarity.id !== "common";
  const rarityRate = rarity ? rarity.statRate : 1;

  const luck = luckPercent(getPlayerStats());
  const stats = {}, rolls = {};
  for (const key in data.stats) {
    // ステータスごとに、別々の個体差をかける
    let roll;
    if (special) {
      // レア度つき:rollMin〜rollMax の間(真ん中あたりが出やすい)
      roll = rarity.rollMin + (rarity.rollMax - rarity.rollMin) * (biasedRoll() + 1) / 2;
    } else {
      //   運(LUK)の%の確率で、もう1回引いて良いほうを採用する
      let r = biasedRoll();
      if (chance(luck)) r = Math.max(r, biasedRoll());
      if (hasTrait("noBadRoll")) r = Math.max(0, r); // 特性「目利き」:マイナスにならない
      roll = r * BALANCE.equipVariance; // -0.2〜+0.2
    }
    stats[key] = Math.max(1, Math.round(data.stats[key] * tierRate * cursedRate * rarityRate * (1 + roll)));
    rolls[key] = roll;
  }
  // baseStats:強化する前の性能(刻むときはこちらを使う) / plus:キャンプで強化した回数(上限なし)
  // effects:呪われた装備の効果([{ id, value }]。普通の装備は空)
  // 最初から付いている効果(equipment.js の effects)はそのままの強さ
  // block:盾だけ。向いている方向から飛んでくる矢・炎・属性の球のダメージを減らす割合(%)
  const eq = { id: data.id, name: data.name, slot: data.slot, stats, rolls, baseStats: { ...stats }, plus: 0,
               effects: (data.effects || []).map(fx => ({ ...fx })) };
  if (data.block) eq.block = data.block;
  if (cursed) {
    eq.cursed = true;
    eq.effects = mergeEffects(eq.effects, rollCurseEffects(tierRate));
  }
  // rarity:レア度の id(普通は付けない)。良い効果がレア度に応じて付く
  if (special) {
    eq.rarity = rarity.id;
    eq.effects = mergeEffects(eq.effects, rollRarityEffects(rarity, tierRate));
  }
  return eq;
}

// ==================== レア度 ====================
// 謎の塊を鑑定すると、レア度つきの装備になる(レア度の表は config.js の RARITY_TYPES)
function rarityById(id) {
  return RARITY_TYPES.find(r => r.id === id) || null;
}

// 装備・刻印のレア度(普通・レア度なしは null。印や色を付けるものだけ返す)
function rarityOf(item) {
  const r = item && item.rarity ? rarityById(item.rarity) : null;
  return r && r.id !== "common" ? r : null;
}

// レア度を weight(%)の確率で1つ選ぶ(運では変わらない)
function rollRarity() {
  const total = RARITY_TYPES.reduce((sum, r) => sum + r.weight, 0);
  let x = Math.random() * total;
  for (const r of RARITY_TYPES) {
    x -= r.weight;
    if (x < 0) return r;
  }
  return RARITY_TYPES[0];
}

// レア度の良い効果を effects 個(違う種類から)選ぶ。強さは、効果の幅の effectMin〜effectMax のあたり
function rollRarityEffects(rarity, tierRate) {
  const list = Object.values(EFFECTS).filter(e => e.kind === "bless" && !e.noRoll);
  const effects = [];
  for (let i = 0; i < rarity.effects && list.length > 0; i++) {
    const e = list.splice(randInt(0, list.length - 1), 1)[0];
    const t = rarity.effectMin + (rarity.effectMax - rarity.effectMin) * Math.random();
    effects.push({ id: e.id, value: effectRollValue(e, t, tierRate) });
  }
  return effects;
}

// レア度の印(例:エピック を青緑で)。普通・レア度なしは ""
function rarityTagHTML(item) {
  const r = rarityOf(item);
  return r ? `<span class="rarity-tag ${r.cls}">${esc(r.name)}</span> ` : "";
}

// ==================== 呪われた装備の効果 ====================
// 良い効果1つと呪い1つを選ぶ。良い効果が強いほど、呪いも重くなる
//   tierRate:装備の階層の倍率(scale: true の効果だけ、深い階ほど強くなる)
function rollCurseEffects(tierRate) {
  const pick = kind => {
    const list = Object.values(EFFECTS).filter(e => e.kind === kind && !e.noRoll); // noRoll の効果(影の目など)はランダムでは付かない
    return list[randInt(0, list.length - 1)];
  };
  const t = Math.random(); // 良い効果の強さ(0〜1)
  const spread = BALANCE.cursedRollSpread;
  const t2 = Math.max(0, Math.min(1, t + (Math.random() * 2 - 1) * spread)); // 呪いの重さは t の近く
  const bless = pick("bless"), curse = pick("curse");
  const effects = [];
  if (bless) effects.push({ id: bless.id, value: effectRollValue(bless, t, tierRate) });
  if (curse) effects.push({ id: curse.id, value: effectRollValue(curse, t2, tierRate) });
  return effects;
}

// 効果 e の強さ:幅(min〜max)の t のところ(0 なら min、1 なら max)。scale の効果は深い階ほど強い
function effectRollValue(e, t, tierRate) {
  return Math.round((e.min + (e.max - e.min) * t) * (e.scale ? tierRate : 1));
}

// 効果1つの説明(例:"追撃:攻撃すると、与えたダメージの25%で追撃する")。short なら "追撃25%" のような短い形
function effectText(fx, short) {
  const e = EFFECTS[fx.id];
  if (!e) return "";
  if (short) return (e.short || e.desc).replace("{v}", fx.value);
  return `${e.name}:${e.desc.replace("{v}", fx.value)}`;
}

// 効果の一覧を色つきで(良い効果は緑、呪いは紫)。short なら短い形
function effectsHTML(effects, short) {
  return (effects || []).filter(fx => EFFECTS[fx.id])
    .map(fx => span(EFFECTS[fx.id].kind, effectText(fx, short))).join(short ? " " : "<br>");
}

// 同じ種類の効果をまとめる(合成した刻印用。強さは足し算)
function mergeEffects(...lists) {
  const sum = {};
  for (const list of lists) for (const fx of list || []) sum[fx.id] = (sum[fx.id] || 0) + fx.value;
  return Object.keys(sum).map(id => ({ id, value: sum[id] }));
}

// 呪いが付いているか(装備・刻印)
function hasCurse(item) {
  return (item.effects || []).some(fx => EFFECTS[fx.id] && EFFECTS[fx.id].kind === "curse");
}

// 今効いている効果の合計(着けている装備と、装備を着けている枠の刻印)。id → 強さ
function effectTotals(eqMap = equipped) {
  const lists = [];
  for (const slot in eqMap) {
    lists.push(eqMap[slot].effects);
    if (base.materialSet[slot]) lists.push(base.materialSet[slot].effects);
  }
  const sum = {};
  for (const fx of mergeEffects(...lists)) sum[fx.id] = fx.value;
  return sum;
}

// 効果 id の今の強さ(なければ 0)
function effectValue(id) {
  return effectTotals()[id] || 0;
}

// 装備の表示名(強化していれば「革の兜+3」)
function equipName(eq) {
  return eq.plus > 0 ? `${eq.name}+${eq.plus}` : eq.name;
}

// 装備の名前と性能(画面用)。呪われた装備は「呪」の印と、効果を下の行に出す
//   extra:ステータスのすぐ後ろに付け足す HTML(「(指輪1に装備中)」など)
function equipHTML(eq, extra = "") {
  const tag = (eq.cursed ? `<span class="curse-tag">呪</span> ` : "") + rarityTagHTML(eq);
  const block = eq.block ? ` ${span("shield", `防${eq.block}%`)}` : "";
  const fx = eq.effects && eq.effects.length ? `<div class="sub">${effectsHTML(eq.effects, true)}</div>` : "";
  return `${tag}${esc(equipName(eq))} ${statsHTML(eq.stats, eq.rolls)}${block}${extra}${fx}`;
}

// ステータスを文字にする(例:"HP+56(+12%) DEF+28(-7%)")。rolls を渡すと個体差も表示。ログ用
function statsText(stats, rolls) {
  return Object.keys(stats).map((key) => {
    let s = `${STAT_NAMES[key]}+${fmt(stats[key])}`;
    if (rolls) {
      const p = Math.round(rolls[key] * 100);
      s += `(${p >= 0 ? "+" : ""}${p}%)`;
    }
    return s;
  }).join(" ");
}

// statsText の色つき版(個体差がプラスなら緑、マイナスなら赤)。画面用
function statsHTML(stats, rolls) {
  return Object.keys(stats).map((key) => {
    let h = esc(`${STAT_NAMES[key]}+${fmt(stats[key])}`);
    if (rolls) {
      const p = Math.round(rolls[key] * 100);
      const cls = p > 0 ? "up" : p < 0 ? "down" : "dim";
      h += span(cls, `(${p >= 0 ? "+" : ""}${p}%)`);
    }
    return `<span style="white-space:nowrap">${h}</span>`; // 1つのステータスの途中では折り返さない
  }).join(" ");
}

// 2つのステータスの差を、色つきで表示する(増えたら緑、減ったら赤)
function statDiffHTML(before, after) {
  const parts = [];
  for (const key in STAT_NAMES) {
    const d = after[key] - before[key];
    if (d !== 0) parts.push(span(d > 0 ? "up" : "down", `${STAT_NAMES[key]}${d > 0 ? "+" : ""}${fmt(d)}`));
  }
  return parts.length > 0 ? parts.join(" ") : span("dim", "変化なし");
}

// 装備を拾ったとき:持ち物に入れる
//   自動装備が ON で、その種類の枠が空いていれば、そのまま装備する(着けている装備は替えない)
//   countFound:図鑑の「拾った回数」を増やすか(遺品は前に拾った装備なので増やさない)
function pickUpEquipment(eq, countFound = true) {
  if (countFound) base.records.equipFound[eq.id] = (base.records.equipFound[eq.id] || 0) + 1; // 図鑑に登録
  runPickups.push(eq);
  const r = rarityOf(eq);
  addLog(`${eq.cursed ? "呪われた" : ""}${r ? `【${r.name}】` : ""}${eq.name}[${ITEM_TYPES[eq.slot].name}]を拾った！ ${statsText(eq.stats, eq.rolls)}`);
  // レア度の良い効果(呪われた装備は、下で呪いと一緒に出す)
  if (r && !eq.cursed && eq.effects && eq.effects.length) addLog(`　${eq.effects.map(fx => effectText(fx, true)).join(" / ")}`);
  if (eq.cursed) {
    // 呪われた装備は自動では着けない(一度着けると外せないので、自分で決める)
    addLog(`　${(eq.effects || []).map(fx => effectText(fx, true)).join(" / ")}(着けると外せない)`);
    return;
  }
  if (base.settings.autoEquip) {
    // 鍛冶屋の装備を着けている枠も「空いている」とみなす(拾った装備に付け替える)
    const empty = ITEM_TYPES[eq.slot].slots.find(s => !equipped[s]) || ITEM_TYPES[eq.slot].slots.find(s => equipped[s].smith);
    if (empty) changeEquip(empty, eq);
  }
}

// 自動装備の ON / OFF を切り替える
function toggleAutoEquip() {
  base.settings.autoEquip = !base.settings.autoEquip;
  saveGame();
  drawSettings();
}

function drawSettings() {
  const btn = document.getElementById("auto-equip-btn");
  btn.textContent = base.settings.autoEquip ? "ON" : "OFF";
  btn.className = base.settings.autoEquip ? "toggle on" : "toggle";
}

// その装備を着けている枠の名前(着けていなければ null)
function equippedSlotOf(eq) {
  return Object.keys(equipped).find(slot => equipped[slot] === eq) || null;
}

// ==================== 持ち物 ====================
let invReturnMode = "dungeon"; // 持ち物を閉じたときに戻る画面(ダンジョンかキャンプ)

function openInventory() {
  invReturnMode = screenMode;
  screenMode = "inventory";
  invPickSlot = null;
  clampInvCursor();
  render();
}

function closeInventory() {
  screenMode = invReturnMode;
  render();
}

// 今のタブに並んでいるものの一覧(装備タブは装備枠)
function invTabItems() {
  const tab = INV_TABS[invTab].id;
  if (tab === "equip") return Object.keys(EQUIP_SLOTS);
  // 道具タブ:回復薬と、道具屋で買って持ってきた道具
  //   謎の塊は見るだけ(キャンプで自動で鑑定される)
  if (tab === "tool") return [...(potions > 0 ? [{ kind: "potion" }] : []), ...runTools.map((t, index) => ({ kind: "tool", index })),
                              ...(runLumps > 0 ? [{ kind: "lump" }] : [])];
  return []; // 素材・その他はまだない
}

function clampInvCursor() {
  invCursor = Math.max(0, Math.min(invCursor, invTabItems().length - 1));
}

function switchInvTab(step) {
  invTab = (invTab + step + INV_TABS.length) % INV_TABS.length;
  invCursor = 0;
  invPickSlot = null;
  render();
}

// 枠 slot に着けられる装備の一覧(先頭の null は「外す」)
function equipChoices(slot) {
  const list = runPickups.filter(eq => ITEM_TYPES[eq.slot].slots.includes(slot));
  return [null, ...list];
}

// 装備タブで枠を選んで Enter:その枠に着けられる装備の一覧を開く
function openEquipPicker() {
  invPickSlot = Object.keys(EQUIP_SLOTS)[invCursor];
  // 今着けている装備にカーソルを合わせる
  invPickCursor = Math.max(0, equipChoices(invPickSlot).indexOf(equipped[invPickSlot] || null));
  render();
}

// 装備の一覧で Enter:選んだ装備を枠に着ける(「外す」なら外す)
function equipSelected() {
  const eq = equipChoices(invPickSlot)[invPickCursor];
  changeEquip(invPickSlot, eq);
  invPickSlot = null;
  render();
}

// 枠 slot の装備を eq に替える(eq が null なら外す)。付け替えたら true
//   eq がほかの枠に着いていたら、2つの枠の中身を入れ替える
function changeEquip(slot, eq) {
  if (equipped[slot] === (eq || undefined)) return false; // 変化なし
  // 呪われた装備は、一度着けると外せない(ほかの枠に移すこともできない)
  const stuck = [equipped[slot], eq && equippedSlotOf(eq) ? eq : null].find(x => x && x.cursed);
  if (stuck) {
    addLog(`${equipName(stuck)}は呪われていて外せない`);
    return false;
  }
  const plan = planEquip(slot, eq);

  // 付け替えで最大HPが減って、HPが0以下になってしまうなら付け替えられない
  const damage = maxHP - playerHP;
  if (getPlayerStats(plan).hp - damage <= 0) {
    addLog("HPが0になってしまうので、付け替えられない");
    return false;
  }

  const old = equipped[slot];
  const other = eq ? equippedSlotOf(eq) : null;
  equipped = plan;
  if (!eq) {
    addLog(`${equipName(old)}を外した`);
  } else if (other) {
    addLog(`${equipName(eq)}を${EQUIP_SLOTS[slot]}に付け替えた`);
  } else {
    addLog(old ? `${equipName(old)}を外して、${equipName(eq)}を装備した` : `${equipName(eq)}を装備した`);
    if (eq.cursed) addLog(`${equipName(eq)}は呪われていた…！ もう外せない`);
  }
  updateMaxHP();
  return true;
}

// 道具タブで選んでいるものを使う
function useToolSelected() {
  const tool = invTabItems()[invCursor];
  if (!tool) return;
  if (tool.kind === "potion") {
    if (invReturnMode === "camp") {
      addLog("キャンプでは回復薬は使えない");
      render();
      return;
    }
    usePotion();
    clampInvCursor();
    render();
  } else if (tool.kind === "tool") {
    // 道具屋で買った道具(キャンプ・分かれ道では使えない)
    if (invReturnMode !== "dungeon") {
      addLog("今は道具を使えない");
      render();
      return;
    }
    invCursor = 0;
    useRunTool(tool.index);
  } else if (tool.kind === "lump") {
    addLog("謎の塊は、キャンプに入ると鑑定される");
    render();
  }
}

// ==================== 刻む処理 ====================
// 装備を刻んだときにできる刻印の性能(各ステータス × materialRatio)
//   ステータスが小数にならないよう、整数に丸める(最低1)
//   キャンプで強化した分は入らない(強化する前の性能 baseStats を使う)
function materialStats(eq) {
  const src = eq.baseStats || eq.stats;
  const stats = {};
  for (const key in src) stats[key] = Math.max(1, Math.round(src[key] * BALANCE.materialRatio));
  return stats;
}

// 刻んだときの刻印の名前
//   敵の固有装備:equipment.js の materialName(その装備だけの名前。例:小鬼の牙)
//   それ以外:個体差の平均でレア度を決めて「輝く胴の刻印」のような名前(BALANCE.materialRanks)
//   レア度つき(謎の塊から):レア度の名前が付く(例:エピック胴の刻印 / エピック・小鬼の牙)
function materialNameFor(eq) {
  const data = equipmentList.find(e => e.id === eq.id);
  const r = rarityOf(eq);
  if (data && data.materialName) return r ? `${r.name}・${data.materialName}` : data.materialName;
  return `${r ? r.name : materialRankOf(eq).word}${ITEM_TYPES[eq.slot].name}の刻印`;
}

// 装備の個体差の平均(%)から、刻印のレア度(BALANCE.materialRanks の1つ)を決める
function materialRankOf(eq) {
  const rolls = Object.values(eq.rolls || {});
  const avg = rolls.length > 0 ? rolls.reduce((a, b) => a + b, 0) / rolls.length * 100 : 0;
  const ranks = BALANCE.materialRanks;
  return ranks.find(r => avg >= r.minRoll) || ranks[ranks.length - 1];
}

// 名前を持っていない古い刻印に付ける名前(例:胴の刻印)
function defaultMaterialName(slot) {
  return `${ITEM_TYPES[slot].name}の刻印`;
}

// この冒険で、死んだときに刻める数(エリートを倒した数だけ増える)
function refineCount() {
  return BALANCE.refineBase + (runStats ? runStats.elitesKilled : 0);
}

// 刻む画面のタブ:死んだときに着けていた装備 / 持っていただけの装備
const REFINE_TABS = [
  { id: "worn",  name: "装備中" },
  { id: "spare", name: "持ち物" },
];

// 刻める装備(この冒険で手に入れた装備のうち、鍛冶屋の装備ではないもの)
function refinablePickups() {
  return runPickups.filter(eq => !eq.smith);
}

// 死んだときに着けていた装備(枠の順:武器 → 盾 → 頭 …)。鍛冶屋の装備は刻めないので入れない
function refineWorn() {
  return Object.keys(EQUIP_SLOTS).map(s => equipped[s]).filter(eq => eq && !eq.smith && runPickups.includes(eq));
}

// 着けていなかった装備。type を渡すと、その部位のものだけ
function refineSpare(type = null) {
  const worn = refineWorn();
  return refinablePickups().filter(eq => !worn.includes(eq) && (!type || eq.slot === type));
}

// 刻む画面で、今選べる装備の一覧
//   装備中タブ:着けていた装備 / 持ち物タブ:部位を選んだあとの、その部位の装備(部位を選ぶ前は空)
function refineList() {
  if (REFINE_TABS[refineTab].id === "worn") return refineWorn();
  return refineType ? refineSpare(refineType) : [];
}

// タブに出す数
function refineTabCount(tabIndex) {
  return REFINE_TABS[tabIndex].id === "worn" ? refineWorn().length : refineSpare().length;
}

// 刻む画面のタブを切り替える(step:+1 / -1)。持ち物タブは部位の一覧から
function switchRefineTab(step) {
  refineTab = (refineTab + step + REFINE_TABS.length) % REFINE_TABS.length;
  refineType = null;
  refineCursor = 0;
}

// 刻む画面で Enter:選んだ装備を刻む
//   刻印がいっぱい(materialMax)なら、代わりに解体する刻印を選ぶ一覧を開く
function refineSelected() {
  const eq = refineList()[refineCursor];
  if (!eq) return; // このタブに装備がない
  if (materialsFull()) {
    refineDiscardFor = eq;
    refineDiscardCursor = 0;
    addLog(`刻印がいっぱい(${BALANCE.materialMax}個)。代わりに解体する刻印を選んでください`);
    render();
    return;
  }
  engraveEquipment(eq);
  finishRefineOne(eq);
}

// 刻印を持てる数の上限に届いているか
function materialsFull() {
  return base.materials.length >= BALANCE.materialMax;
}

// 刻印の空きが materialDiveFree より少ないか(少ないとダンジョンに潜れない)
function materialsNearFull() {
  return BALANCE.materialMax - base.materials.length < BALANCE.materialDiveFree;
}

// 刻印がいっぱいのとき、代わりに解体する刻印の候補
//   先頭の null は「新しく刻むほうを解体する(刻まない)」。そのあとは同じ部位の刻印を、性能の低い順に
function discardChoices() {
  const list = base.materials.filter(mat => mat.slot === refineDiscardFor.slot);
  list.sort((a, b) => materialTotal(a) - materialTotal(b));
  return [null, ...list];
}

// 解体する刻印を選んで Enter:それを解体して刻む(先頭を選んだら、刻もうとした装備のほうを素材にする)
function chooseDiscard() {
  const eq = refineDiscardFor;
  const mat = discardChoices()[refineDiscardCursor];
  refineDiscardFor = null;
  if (mat) {
    salvageNow(mat);
    engraveEquipment(eq);
  } else {
    // 刻まずに素材にする(刻印1個を解体したときと同じ数)
    turn += 1; // ログの色分け(刻んだときと同じ)
    const resId = ITEM_TYPES[eq.slot].resource;
    const amount = Math.max(1, Math.floor(BALANCE.salvageBaseValue * BALANCE.salvageRate));
    base.resources[resId] = (base.resources[resId] || 0) + amount;
    addLog(`${equipName(eq)}は刻まずに解体した。${RESOURCE_TYPES[resId].name}を${amount}個手に入れた`);
    saveGame();
  }
  finishRefineOne(eq);
}

// 装備を刻んで、新しい刻印を1個作る
function engraveEquipment(eq) {
  turn += 1;
  // 新しい刻印を1個作って、ストックに追加する
  // 呪われた装備の効果(良い効果も呪いも)は、そのままの強さで刻印に引き継ぐ
  // name:刻印の名前 / sources:元の装備の id の一覧(equipment.js の id。合成すると2つになる。一族のセット効果に使う)
  const mat = { slot: eq.slot, name: materialNameFor(eq), sources: [eq.id], stats: materialStats(eq), effects: (eq.effects || []).map(fx => ({ ...fx })),
                plus: 0, fused: false, isNew: true }; // isNew:まだ一覧で見ていない印
  if (rarityOf(eq)) mat.rarity = eq.rarity; // レア度(名前の色に使う)
  base.materials.push(mat);
  base.records.engraved += 1; // 実績用
  addLog(`${equipName(eq)}を刻んだ！ 刻印「${mat.name}」(${statsText(mat.stats)})を手に入れた`);
  saveGame();
}

// 1つ刻み終わったとき(刻まずに解体したときも):まだ刻めれば続けて選び、終わりなら拠点へ
function finishRefineOne(eq) {
  // 刻んだ装備は一覧から消す。まだ刻めて、刻める装備も残っていれば続けて選ぶ
  runPickups = runPickups.filter(x => x !== eq);
  refineLeft -= 1;
  if (refineLeft > 0 && refinablePickups().length > 0) {
    if (refineType && refineSpare(refineType).length === 0) {
      // その部位がなくなったら、部位の一覧に戻る(カーソルはその部位に)
      refineCursor = Object.keys(ITEM_TYPES).indexOf(refineType);
      refineType = null;
    }
    // 今のタブが空になったら、もう一方のタブへ
    if (refineTabCount(refineTab) === 0) switchRefineTab(1);
    const rows = REFINE_TABS[refineTab].id === "spare" && !refineType ? Object.keys(ITEM_TYPES).length : refineList().length;
    refineCursor = Math.max(0, Math.min(refineCursor, rows - 1));
  } else {
    salvageLeftovers(); // 刻まなかった装備は、少しの素材になる
    goToTown();
  }
  render();
}

// ==================== 素材 ====================
// 敵を倒したとき:その敵の系統の素材を手に入れる(すぐ拠点に入るので、死んでもなくならない)
//   エリートは eliteMaterialMultiplier 倍もらえる
function gainMonsterResource(m) {
  const id = m.data.material;
  if (!id) return;
  // 特性「拾い上手」で +1(エリートは、それも含めて10倍)。険しい道ではさらに倍
  const amount = Math.round(((m.data.materialAmount || 1) + traitMax("bonusMaterial", 0))
    * (m.elite ? BALANCE.eliteMaterialMultiplier : 1) * routeFx("materialRate", 1));
  base.resources[id] = (base.resources[id] || 0) + amount;
  runStats.resources[id] = (runStats.resources[id] || 0) + amount;
  addLog(`${RESOURCE_TYPES[id].name}を${amount}個手に入れた`);
}

// エリートを倒したとき:holyWaterDropChance の確率で聖水を手に入れる(すぐ拠点に入る。運で少し上がる)
function dropHolyWater() {
  const rate = BALANCE.holyWaterDropChance * luckDropMultiplier() * traitMax("holyWaterRate", 1); // 特性「強運」で2倍
  if (!debugAlwaysDrop() && Math.random() >= rate) return;
  base.resources.holy = (base.resources.holy || 0) + 1;
  runStats.resources.holy = (runStats.resources.holy || 0) + 1;
  addLog("聖水を手に入れた！ 拠点の「制作」で刻印の呪いを浄化できる");
}

// 素材の数の表示(例:"骨 12 / 皮 3 / 鉱石 0 / 植物 5")。counts は 系統 → 数
function resourcesHTML(counts) {
  return Object.keys(RESOURCE_TYPES).map(id =>
    `<span style="color:${RESOURCE_TYPES[id].color}">${RESOURCE_TYPES[id].name}</span> ${counts[id] || 0}`).join("　");
}

// ==================== 刻印の強化・合成 ====================
// 刻印の印(強化値と、合成したものの印)
function materialMarks(mat) {
  let h = "";
  if (mat.plus > 0) h += span("up", `+${mat.plus}`) + " ";
  if (mat.fused) h += span("tag", "合成") + " ";
  if (hasCurse(mat)) h += `<span class="curse-tag">呪</span> `;
  if (mat.purified) h += `<span class="holy-tag">浄化</span> `;
  return h;
}

// 刻印の名前と性能(ステータスと、呪われた装備から引き継いだ効果)。名前がなければ性能だけ
//   強化値や「呪」「浄化」の印は materialMarks で、名前とは別に出す
//   一族の固有装備から刻んだ刻印は、名前のあとに一族の札(一族の色で、短い名前。例:[ゴブリン][不死])
function materialStatsHTML(mat) {
  const clans = materialClans(mat).map(c => `${clanBadgeHTML(c)} `).join("");
  const r = rarityOf(mat); // レア度つきの刻印は、名前をレア度の色に
  const name = mat.name ? `${span(r ? `mat-name ${r.cls}` : "mat-name", mat.name)} ${clans}` : clans;
  const fx = mat.effects && mat.effects.length ? ` ${effectsHTML(mat.effects, true)}` : "";
  return `${name}${statsHTML(mat.stats)}${fx}`;
}

// 刻印の性能の合計(一覧を並べる順番に使う)
function materialTotal(mat) {
  return Object.values(mat.stats).reduce((a, b) => a + b, 0);
}

// 強化に使う素材と、必要な数({ id, cost })。もう上限なら null
function enhanceCost(mat) {
  if (mat.plus >= BALANCE.enhanceMax) return null;
  const cost = BALANCE.enhanceCostBase + mat.plus * BALANCE.enhanceCostPerPlus;
  return {
    id: ITEM_TYPES[mat.slot].resource,
    cost: isSpecialMaterial(mat) ? cost * BALANCE.specialEnhanceCostMultiplier : cost, // 効果つきは多め
  };
}

// 効果つきの刻印か(呪いつき、または浄化したもの)
function isSpecialMaterial(mat) {
  return mat.purified || (mat.effects || []).length > 0;
}

// 浄化に必要な聖水の数(呪い1つにつき1個。呪いがなければ 0)
function purifyCost(mat) {
  return (mat.effects || []).filter(fx => EFFECTS[fx.id] && EFFECTS[fx.id].kind === "curse").length;
}

// 刻印を浄化する:呪いだけを消して、良い効果は残す。「浄化」の印が付く
function purifyMaterial(mat) {
  const cost = purifyCost(mat);
  if (cost === 0) return;
  if ((base.resources.holy || 0) < cost) {
    addLog(`聖水が足りない(${cost}個必要)`);
    return;
  }
  base.resources.holy -= cost;
  mat.effects = mat.effects.filter(fx => EFFECTS[fx.id].kind !== "curse");
  mat.purified = true;
  addLog(`刻印「${mat.name}」を浄化した！ 呪いが消えた`);
  saveGame();
}

// 強化1回で上がる量(%)を決める
//   5〜15% の間で、上に行くほど出にくい(乱数を2乗すると 0 に寄る)
//   運(LUK)の%の確率で、もう1回引いて良いほうを採用する
function rollEnhancePercent() {
  const roll = () => Math.pow(Math.random(), 2); // 0〜1、0 に近いほど出やすい
  let r = roll();
  if (chance(luckPercent(getPlayerStats()))) r = Math.max(r, roll());
  const { enhanceMinPercent: min, enhanceMaxPercent: max } = BALANCE;
  return Math.round(min + (max - min) * r);
}

// 1つのステータスが、pct% の強化で上がる量(最低 +1)
function enhanceGain(refValue, pct) {
  return Math.max(1, Math.round(refValue * pct / 100));
}

// 性能 stats を pct% 強化する(各ステータスを同じ%だけ上げる。最低 +1)
//   ref:何に対しての%か。省略すると今の性能に対して(刻印)。
//        装備は強化前の性能(baseStats)を渡すので、毎回同じくらいずつ上がる
//   強化前 → 強化後 の文字(ログ用)を返す
function applyEnhance(stats, pct, ref = stats) {
  const before = { ...stats };
  const src = ref === stats ? before : ref;
  for (const key in stats) stats[key] = before[key] + enhanceGain(src[key], pct);
  return Object.keys(stats).map(k => `${STAT_NAMES[k]} ${before[k]}→${stats[k]}`).join(" ");
}

// 強化したらどのくらい上がるかの目安(例:"HP 30→32〜35 DEF 22→23〜25")。ref は applyEnhance と同じ
function enhanceRangeText(stats, ref = stats) {
  const { enhanceMinPercent: min, enhanceMaxPercent: max } = BALANCE;
  return Object.keys(stats).map(k => {
    const lo = stats[k] + enhanceGain(ref[k], min);
    const hi = stats[k] + enhanceGain(ref[k], max);
    return `${STAT_NAMES[k]} ${stats[k]}→${lo === hi ? lo : `${lo}〜${hi}`}`;
  }).join(" ");
}

// 刻印を1回強化する
function enhanceMaterial(mat) {
  const c = enhanceCost(mat);
  if (!c) {
    addLog(`もう+${BALANCE.enhanceMax}なので強化できない`);
    return;
  }
  if ((base.resources[c.id] || 0) < c.cost) {
    addLog(`${RESOURCE_TYPES[c.id].name}が足りない(${c.cost}個必要)`);
    return;
  }
  base.resources[c.id] -= c.cost;
  mat.spent = (mat.spent || 0) + c.cost; // 強化に使った素材の合計(解体したときに半分戻る)
  const pct = rollEnhancePercent();
  const diff = applyEnhance(mat.stats, pct);
  mat.plus += 1;
  addLog(`${pct >= 13 ? "大成功！ " : ""}刻印「${mat.name}」を+${mat.plus}に強化した(+${pct}%) ${diff}`);
  saveGame();
}

// ==================== 解体(サルベージ) ====================
// 刻印を素材に戻す。戻るのは「刻印の価値」の半分(salvageRate)。その種類の刻印を強化するときに使う素材で戻る
//   刻印の価値 = salvageBaseValue(合成したものは2個分)+ 強化に使った素材の合計(spent)
function salvageValue(mat) {
  const value = BALANCE.salvageBaseValue * (mat.fused ? 2 : 1) + (mat.spent || 0);
  return Math.max(1, Math.floor(value * BALANCE.salvageRate));
}

// 刻印を解体する(確認してから)。枠にセットしていたら外れる
function salvageMaterial(mat) {
  const resId = ITEM_TYPES[mat.slot].resource;
  if (!confirm(`刻印「${mat.name}」を解体して、${RESOURCE_TYPES[resId].name}${salvageValue(mat)}個にしますか？(元に戻せません)`)) return false;
  salvageNow(mat);
  return true;
}

// 刻印を解体する(確認なし。刻印がいっぱいのときに、刻む画面で選んだもの)
function salvageNow(mat) {
  const resId = ITEM_TYPES[mat.slot].resource;
  const amount = salvageValue(mat);
  for (const s in base.materialSet) {
    if (base.materialSet[s] === mat) delete base.materialSet[s];
  }
  base.materials = base.materials.filter(x => x !== mat);
  base.resources[resId] = (base.resources[resId] || 0) + amount;
  addLog(`刻印「${mat.name}」を解体した。${RESOURCE_TYPES[resId].name}を${amount}個手に入れた`);
  saveGame();
}

// 冒険が終わって拠点に戻るとき:刻まなかった装備を、少しの素材にする(1個につき leftoverSalvageAmount。その部位の素材)
//   鍛冶屋の装備は素材にならない(ゴールドで安く作れるので、素材に化けると強すぎるため)
function salvageLeftovers() {
  const left = refinablePickups();
  runPickups = [];
  if (left.length === 0) return;
  const got = {};
  for (const eq of left) {
    const id = ITEM_TYPES[eq.slot].resource;
    got[id] = (got[id] || 0) + BALANCE.leftoverSalvageAmount;
  }
  for (const id in got) base.resources[id] = (base.resources[id] || 0) + got[id];
  addLog(`刻まなかった装備${left.length}個を、素材にした(${Object.keys(got).map(id => `${RESOURCE_TYPES[id].name}+${got[id]}`).join(" ")})`);
  saveGame();
}

// 合成できるか(合成してできた刻印は、もう合成できない)
function canFuse(mat) {
  return !mat.fused;
}

// 2個の組み合わせで合成できるか:効果つき(呪い・浄化)どうしは合成できない
function canFusePair(a, b) {
  return a !== b && a.slot === b.slot && canFuse(a) && canFuse(b) && !(isSpecialMaterial(a) && isSpecialMaterial(b));
}

// 2個の刻印を合成したときの性能(足し算)
function fusedStats(a, b) {
  const stats = { ...a.stats };
  for (const key in b.stats) stats[key] = (stats[key] || 0) + b.stats[key];
  return stats;
}

// 同じ種類の刻印2個を、1個にまとめる
//   性能は足し算(強化した分も含む)。強化値は +0 に戻るので、さらに強化できる。もう合成はできない(解体はできる)
//   どちらかが枠にセットされていたら、できた刻印をその枠にセットし直す
//   2個とも別々の枠(指輪1と指輪2など)にセットされていたら、片方の枠は空になる(ログで知らせる)
function fuseMaterials(a, b) {
  // 名前は2つの名前を合わせたもの(例:小鬼の牙と誓いの紋章)
  // 元の装備の一覧も合わせる(一族が合わさる)
  // spent:強化に使った素材は、2つ分を合わせる(解体したときの価値になる)
  const mat = { slot: a.slot, name: `${a.name}と${b.name}`, sources: [...(a.sources || []), ...(b.sources || [])],
                spent: (a.spent || 0) + (b.spent || 0), stats: fusedStats(a, b), effects: mergeEffects(a.effects, b.effects), plus: 0, fused: true,
                purified: !!(a.purified || b.purified) };
  // レア度は、2つのうち上のほう
  const ra = RARITY_TYPES.findIndex(r => r.id === a.rarity), rb = RARITY_TYPES.findIndex(r => r.id === b.rarity);
  if (Math.max(ra, rb) > 0) mat.rarity = RARITY_TYPES[Math.max(ra, rb)].id;
  const setSlots = Object.keys(base.materialSet).filter(s => base.materialSet[s] === a || base.materialSet[s] === b);
  for (const s of setSlots) delete base.materialSet[s];
  base.materials = base.materials.filter(x => x !== a && x !== b);
  base.materials.push(mat);
  if (setSlots.length > 0) base.materialSet[setSlots[0]] = mat;
  addLog(`刻印を合成した！「${mat.name}」 ${statsText(mat.stats)}`);
  if (setSlots.length > 1) {
    addLog(`合成した刻印は${EQUIP_SLOTS[setSlots[0]]}にセットした。${EQUIP_SLOTS[setSlots[1]]}の枠は空になったので、別の刻印をセットしてください`);
  }
  saveGame();
  return mat;
}
