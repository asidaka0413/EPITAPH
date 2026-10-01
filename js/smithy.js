// 鍛冶屋:次の冒険の最初から着けている「鍛冶屋の装備」を作る・腕前・鍛冶屋の画面
// index.html から <script src> で読み込まれる(読み込む順番は index.html に書いてある)
//
// ねらい:刻印は「その枠に装備を着けているときだけ」効くので、床で装備を拾うまで刻印が眠ったまま。
//   鍛冶屋の装備を着けて潜れば、1階から刻印が効く(序盤が作業になるのも軽くなる)
// 流れ:拠点の鍛冶屋を素材で建てる → 枠ごとに、少しのゴールドと少しの素材で注文する
//   → 次に潜るとき、最初から着けている(注文は1回使ったら消える)。死んだらなくなる
// 決まり:性能は「しょうもない」(床の装備の smithQuality 割、個体差なし)。刻めない・遺品にならない・冒険の終わりに素材にもならない
//   素材を納品して腕前を上げると、作る装備の質が少し上がる(最後まで上げても、1〜5階の床の装備とほぼ同じ)

// ==================== 鍛冶屋の装備 ====================
// 部位ごとの装備(性能のもとは、1〜5階の床の装備と同じ。ここに smithQuality と腕前の倍率がかかる)
//   name:名前 / stats:もとの性能 / block:(盾だけ)防ぐ%
const SMITH_ITEMS = {
  weapon:  { name: "鍛冶屋の短剣",     stats: { atk: 20 } },
  shield:  { name: "鍛冶屋の木盾",     stats: { hp: 20, def: 15 }, block: 20 },
  head:    { name: "鍛冶屋の革帽子",   stats: { hp: 50, def: 30 } },
  body:    { name: "鍛冶屋の革鎧",     stats: { hp: 100, def: 60 } },
  waist:   { name: "鍛冶屋の革帯",     stats: { hp: 50, agl: 20 } },
  feet:    { name: "鍛冶屋の革靴",     stats: { def: 20, agl: 40 } },
  ring:    { name: "鍛冶屋の銅輪",     stats: { atk: 10, crt: 30 } },
  earring: { name: "鍛冶屋の銅耳飾り", stats: { luk: 20, crt: 20 } },
};

// 腕前の段階。level 番目の段階に上げるには、最高到達階が unlockDepth まで来ていて、deliver の素材を納品する
//   腕前が1段階上がるごとに、性能が smithGrowthPerLevel ぶん上がる(最後まで上げても、1〜5階の床の装備とほぼ同じ)
const SMITH_LEVELS = [
  { unlockDepth: 15, deliver: { ore: 40, hide: 40 } },
  { unlockDepth: 25, deliver: { ore: 80, bone: 60 } },
  { unlockDepth: 35, deliver: { ore: 120, bone: 80, hide: 80 } },
  { unlockDepth: 45, deliver: { ore: 160, bone: 120, hide: 120, plant: 80 } },
];

// 腕前 level の性能の倍率(1〜5階の床の装備のもとに対して)
function smithRate(level) {
  return BALANCE.smithQuality + level * BALANCE.smithGrowthPerLevel;
}

// 腕前 level の性能を文字に(例:"浅い階の装備の69%")
function smithQualityText(level) {
  return `浅い階の装備の${Math.round(smithRate(level) * 100)}%`;
}

// 枠 slot の鍛冶屋の装備を1個作る(level:腕前)
//   smith:鍛冶屋の装備の印(刻めない・遺品にならない・冒険の終わりに素材にならない)
function makeSmithEquipment(slot, level) {
  const type = slotType(slot);
  const item = SMITH_ITEMS[type];
  const rate = smithRate(level);
  const stats = {}, rolls = {};
  for (const key in item.stats) {
    stats[key] = Math.max(1, Math.round(item.stats[key] * rate));
    rolls[key] = 0;
  }
  const eq = { id: `smith_${type}`, name: item.name, slot: type, stats, rolls, baseStats: { ...stats }, plus: 0, effects: [], smith: true };
  if (item.block) eq.block = item.block;
  return eq;
}

// 冒険を始めるとき:注文していた装備を着けた状態にする(注文は消える)
function equipSmithOrders() {
  const slots = Object.keys(base.smithOrders);
  if (slots.length === 0) return;
  for (const slot of slots) {
    const eq = makeSmithEquipment(slot, base.smithOrders[slot].level);
    runPickups.push(eq);
    equipped[slot] = eq;
  }
  base.smithOrders = {};
  // 着けた装備のぶん、最大HPを増やして満タンから始める
  maxHP = getPlayerStats().hp;
  playerHP = maxHP;
  addLog(`鍛冶屋の装備を${slots.length}個着けて出発した`);
  saveGame();
}

// ==================== 注文と腕前 ====================
// 1つ注文するのに使うもの(今の腕前で)
function smithOrderCost(slot) {
  const level = base.smithy.level;
  return {
    gold: BALANCE.smithOrderGold * (1 + level),
    resources: { [ITEM_TYPES[slotType(slot)].resource]: BALANCE.smithOrderResource + level * 2 },
  };
}

// 枠を選んで Enter:注文する / 取り消す(取り消すと、払ったものは戻る)
function toggleSmithOrder(slot) {
  const cost = smithOrderCost(slot);
  if (base.smithOrders[slot]) {
    // 取り消し:注文したときの腕前の分を戻す
    const level = base.smithOrders[slot].level;
    base.gold += BALANCE.smithOrderGold * (1 + level);
    const resId = ITEM_TYPES[slotType(slot)].resource;
    base.resources[resId] += BALANCE.smithOrderResource + level * 2;
    delete base.smithOrders[slot];
    addLog(`${EQUIP_SLOTS[slot]}の注文を取り消した`);
  } else if (base.gold < cost.gold) {
    addLog(`ゴールドが足りない(${cost.gold}G必要)`);
    return;
  } else if (!hasResources(cost.resources)) {
    addLog("素材が足りない");
    return;
  } else {
    base.gold -= cost.gold;
    payResources(cost.resources);
    base.smithOrders[slot] = { level: base.smithy.level };
    addLog(`${SMITH_ITEMS[slotType(slot)].name}を注文した(次の冒険の最初から着けている)`);
  }
  saveGame();
}

// 次の腕前の段階(もう最後まで上げていれば null)
function nextSmithLevel() {
  return SMITH_LEVELS[base.smithy.level] || null;
}

// 腕前を上げる(素材を納品する)
function upgradeSmithy() {
  const next = nextSmithLevel();
  if (!next) return;
  if (base.records.bestDepth < next.unlockDepth) {
    addLog(`地下${next.unlockDepth}階までたどり着くと、腕前を上げられる`);
    return;
  }
  if (!hasResources(next.deliver)) {
    addLog("納品する素材が足りない");
    return;
  }
  payResources(next.deliver);
  base.smithy.level += 1;
  addLog(`鍛冶屋の腕前が上がった！ 作る装備の性能が、${smithQualityText(base.smithy.level)}になった`);
  saveGame();
}

// 鍛冶屋を建てる
function buildSmithy() {
  const cost = BALANCE.smithBuildCost;
  if (!hasResources(cost)) {
    addLog("素材が足りないので、鍛冶屋を建てられない");
    return;
  }
  payResources(cost);
  base.smithy.built = true;
  addLog("鍛冶屋を建てた！ 次の冒険で最初から着ける装備を作ってもらえる");
  saveGame();
}

// ==================== 鍛冶屋の画面 ====================
// 行:10個の枠 + 最後に「腕前を上げる」
function smithRows() {
  return [...Object.keys(EQUIP_SLOTS), "upgrade"];
}

function drawTownSmithy() {
  let h = "";
  if (!base.smithy.built) {
    h += `<div>まだ鍛冶屋はない。素材を使って建てられる。</div>`;
    h += `<div class="note">建てると、次の冒険の最初から着けている装備を作ってもらえる。全部の枠に着けて潜れば、1階から刻印が効く</div>`;
    h += gridRow(true, "6em 1fr", ["<b>建てる</b>", costHTML(BALANCE.smithBuildCost)]);
    setScreen("拠点 - 鍛冶屋", h, false);
    setHint([["Enter / Space", "建てる"], ["Esc / Q", "戻る"]]);
    return;
  }
  h += `<div class="status-top"><span>所持 <b>${base.gold}</b>G</span><span>腕前 Lv.${base.smithy.level + 1}(${smithQualityText(base.smithy.level)})</span>`
     + `<span>注文 ${Object.keys(base.smithOrders).length} / ${Object.keys(EQUIP_SLOTS).length}</span></div>`;
  h += `<div class="note">枠ごとに注文すると、次の冒険の最初から着けている(1回だけ。死んだらなくなる)。性能は控えめで、刻めない・遺品にならない。床でいい装備を拾うまでのつなぎ</div>`;
  const cols = "7em 1fr 9em";
  smithRows().forEach((slot, i) => {
    if (slot === "upgrade") {
      h += `<div class="list-gap"></div>`;
      const next = nextSmithLevel();
      const right = !next ? span("dim", "これ以上は上げられない")
        : base.records.bestDepth < next.unlockDepth ? span("dim", `地下${next.unlockDepth}階で解放`) : costHTML(next.deliver);
      h += gridRow(i === townCursor, cols, ["<b>腕前を上げる</b>", span("sub", next ? `作る装備の性能が、${smithQualityText(base.smithy.level + 1)}になる` : ""), right]);
      return;
    }
    const order = base.smithOrders[slot];
    const preview = makeSmithEquipment(slot, order ? order.level : base.smithy.level);
    const cost = smithOrderCost(slot);
    const right = order ? span("tag", "注文済み")
      : `${span(base.gold >= cost.gold ? "" : "down", `${cost.gold}G`)} ${costHTML(cost.resources)}`;
    h += gridRow(i === townCursor, cols, [
      span("dim", EQUIP_SLOTS[slot]),
      `${order ? "" : `<span class="dim">`}${esc(preview.name)} ${statsText(preview.stats)}${preview.block ? ` 防${preview.block}%` : ""}${order ? "" : "</span>"}`,
      right,
    ]);
  });
  setScreen("拠点 - 鍛冶屋", h, false);
  const sel = smithRows()[townCursor];
  const enter = sel === "upgrade" ? "納品して腕前を上げる" : base.smithOrders[sel] ? "注文を取り消す" : "注文する";
  setHint([["↑↓", "選ぶ"], ["Enter / Space", enter], ["Esc / Q", "戻る"]]);
}

// 鍛冶屋のキー操作
function smithyKey(e) {
  if (e.key === "Escape") { backToTownMenu(); return; }
  if (!base.smithy.built) {
    if (e.key === "Enter") buildSmithy();
    render();
    return;
  }
  const rows = smithRows();
  if (e.key === "ArrowUp") townCursor = Math.max(0, townCursor - 1);
  else if (e.key === "ArrowDown") townCursor = Math.min(rows.length - 1, townCursor + 1);
  else if (e.key === "Enter") {
    const sel = rows[townCursor];
    if (sel === "upgrade") upgradeSmithy();
    else toggleSmithOrder(sel);
  }
  render();
}
