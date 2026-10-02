// 道具屋:冒険に持ちこむ道具・道具の在庫と持ちこみ枠・品ぞろえ・道具屋の画面
// index.html から <script src> で読み込まれる(読み込む順番は index.html に書いてある)
//
// 流れ:拠点の道具屋を素材で建てる → ゴールドで道具を買う(拠点の「道具の在庫」に入る。死んでもなくならない)
//   → プレイヤー画面の「道具」タブで、在庫から持ちこみ枠(carrySlots 個)にセットする
//   → 潜るとき、セットした道具を持っていく(使わなくても、死んだらなくなる)。枠は在庫から同じ道具で自動で補充される
//   → 冒険中は、持ち物の「道具」タブから使う
// 深く潜るほど新しい品が並ぶが、道具屋に素材を納品しないと買えない

// ==================== 道具 ====================
// 冒険に持ちこんで使う道具。増やすときは TOOL_DATA に足す
//   name:名前 / desc:説明 / stack:1枠に入る数
//   use():使ったときの処理。使えたら true(1つ減って、1ターン使う)。使えなければ false
//   passive:true なら「持っているだけで効く」道具(使うことはできない。効く場面のプログラムで consumePassiveTool を呼ぶ)
const TOOL_DATA = {
  smoke: {
    name: "煙玉", stack: 1,
    desc: `周り${BALANCE.smokeRadius}マス以内の敵が、こちらを見失う(気づいていない状態に戻る)`,
    use() {
      let lost = 0;
      for (const m of monsters) {
        if (m.dormant || m.disguised || Math.abs(m.x - px) + Math.abs(m.y - py) > BALANCE.smokeRadius) continue;
        if (m.hunting) lost += 1;
        m.hunting = false;
        m.justNoticed = false;
        m.blind = BALANCE.smokeBlindTurns; // しばらくは、見えても気づけない
      }
      addLog(lost > 0 ? `煙玉を投げた！ 煙にまぎれて、${lost}体の敵がこちらを見失った` : "煙玉を投げた！ …近くに追ってくる敵はいなかった");
      return true;
    },
  },
  knife: {
    name: "投げナイフ", stack: 10,
    desc: `向いている方向にまっすぐ投げる(${BALANCE.knifeRange}マスまで)。最初に当たった敵にダメージ。気づいていない敵には不意打ちで2倍`,
    use() {
      if (!facing) {
        addLog("どちらに投げるか決まっていない(一度動いてから投げる)");
        return false;
      }
      const hit = throwLine(BALANCE.knifeRange);
      if (hit.monster) knifeHit(hit.monster);
      else addLog(hit.wall ? "投げナイフは壁に当たった" : "投げナイフは何にも当たらなかった");
      return true;
    },
  },
  whetstone: {
    name: "砥石", stack: 1,
    desc: `その階のあいだ、ATK +${Math.round(BALANCE.whetstoneAtk * 100)}%`,
    use() {
      if (playerBuffs.whetstone) {
        addLog("もう武器は研いである");
        return false;
      }
      playerBuffs.whetstone = true;
      addLog(`武器を研いだ！ この階のあいだ ATK +${Math.round(BALANCE.whetstoneAtk * 100)}%`);
      return true;
    },
  },
  frenzy: {
    name: "狂熱の香薬", stack: 1,
    desc: `その階のあいだ、攻撃力${BALANCE.frenzyAtk}倍。そのかわり受けるダメージ${BALANCE.frenzyTaken}倍`,
    use() {
      if (playerBuffs.frenzy) {
        addLog("もう香薬の熱が回っている");
        return false;
      }
      playerBuffs.frenzy = true;
      addLog(`狂熱の香薬を吸いこんだ！ 血がたぎる…(この階のあいだ 攻撃力${BALANCE.frenzyAtk}倍・受けるダメージ${BALANCE.frenzyTaken}倍)`);
      return true;
    },
  },
  amulet: {
    name: "身代わりの護符", stack: 1, passive: true,
    desc: "持っているだけで効く。死ぬダメージを受けたとき、1回だけ代わりに砕けてHP1で耐える",
    use() {
      addLog("身代わりの護符は、持っているだけで効く");
      return false;
    },
  },
  stealth: {
    name: "忍び足の香", stack: 1,
    desc: `${BALANCE.stealthFloorsMin}〜${BALANCE.stealthFloorsMax}階のあいだ、敵の見える距離が${Math.round(BALANCE.stealthSightRate * 100)}%になる(忍び寄りやすい)`,
    use() {
      const floors = randInt(BALANCE.stealthFloorsMin, BALANCE.stealthFloorsMax);
      playerBuffs.stealthFloors = Math.max(playerBuffs.stealthFloors || 0, floors);
      addLog(`忍び足の香を焚いた。気配が薄れていく…(この階を含めて${playerBuffs.stealthFloors}階のあいだ)`);
      return true;
    },
  },
  firebomb: {
    name: "火炎瓶", stack: 1,
    desc: `向いている方向に投げる(${BALANCE.firebombRange}マスまで)。当たった場所の周り3×3の敵に、火のダメージ`,
    use() {
      if (!facing) {
        addLog("どちらに投げるか決まっていない(一度動いてから投げる)");
        return false;
      }
      const hit = throwLine(BALANCE.firebombRange);
      firebombBurst(hit.x, hit.y);
      return true;
    },
  },
  // 宝の地図:敵が落とすだけで、道具屋では売らない(SHOP_ITEMS に入れない)。1枚ごとに書かれた階(mapDepth)を持つ
  //   仕組みは js/treasuremap.js の「宝の地図」
  treasureMap: {
    name: "宝の地図", stack: 1, passive: true,
    desc: "書かれた階に行くと、印(X)がある。乗ると宝を掘り出せる。その階を過ぎると使えなくなる",
    use() {
      addLog("宝の地図は、書かれた階で印(X)を探して使う");
      return false;
    },
  },
  warp: {
    name: "転移の札", stack: 1,
    desc: "階段のとなりへ一瞬で移動する(エリートの階では使えない)",
    use() {
      if (isEliteFloor(depth)) {
        addLog("この階では、転移の札が力を失っている(エリートの階では使えない)");
        return false;
      }
      const spot = DIRS4.map(([dx, dy]) => [stairs.x + dx, stairs.y + dy])
        .find(([x, y]) => map[y] && map[y][x] === "." && !monsterAt(x, y));
      if (!spot) {
        addLog("階段のまわりがふさがっていて、転移できない");
        return false;
      }
      px = spot[0];
      py = spot[1];
      addLog("転移の札を使った！ 階段のとなりへ移動した");
      checkFooting(); // 飛んだ先に落ちている物を拾う(墓なら墓碑銘を読む)
      return true;
    },
  },
};

// 向いている方向にまっすぐ投げたときに、どこで止まるか
//   { monster:当たった敵(なければ null), wall:壁に当たったか, x, y:止まったマス(壁なら、その手前) }
function throwLine(range) {
  let x = px, y = py;
  for (let i = 1; i <= range; i++) {
    const nx = px + facing[0] * i, ny = py + facing[1] * i;
    if (!map[ny] || map[ny][nx] === undefined || map[ny][nx] === "#") return { monster: null, wall: true, x, y };
    x = nx;
    y = ny;
    const m = monsterAt(x, y);
    if (m) return { monster: m, wall: false, x, y };
  }
  return { monster: null, wall: false, x, y };
}

// 道具のダメージを敵に与える(倒したら killMonster、生きていれば気づく)
function toolDamage(m, dmg, text, sneak) {
  if (m.disguised) revealMimic(m, false); // 宝箱に化けたミミック:道具を当てると、噛みつかずに正体を現す
  meetMonster(m.data.id);
  if (m.dormant) wakeGuardian(m, "攻撃されて、");
  m.hp -= dmg;
  runStats.damageDealt += dmg;
  if (dmg > runStats.bestHit) { runStats.bestHit = dmg; runStats.bestHitCrit = false; }
  if (m.hp <= 0) {
    sneakStrike = sneak;
    killMonster(m, `${text} ${monsterName(m)}を倒した！`);
    sneakStrike = false;
  } else {
    addLog(text);
    if (!m.hunting) noticePlayer(m, false);
  }
}

// 投げナイフが敵に当たった(会心あり。甲冑騎士などの鎧で減る。気づいていなければ不意打ちで2倍)
function knifeHit(m) {
  const sneak = !m.hunting;
  const s = getPlayerStats();
  let dmg = rollDamage(s.atk * BALANCE.knifePowerRate * weakMultiplier() * buffAtkMultiplier());
  const isCrit = rollCrit(s);
  if (isCrit) dmg = Math.round(dmg * critMultiplier());
  const ab = m.data.ability || {};
  if (ab.type === "armored" && !isCrit) dmg = Math.max(1, Math.round(dmg * (1 - ab.cut)));
  if (sneak) dmg *= 2;
  toolDamage(m, dmg, `${sneak ? "不意打ち！ " : ""}${isCrit ? "会心の一撃！ " : ""}投げナイフが${monsterName(m)}に${dmg}のダメージ！`, sneak);
}

// 火炎瓶が (x, y) で割れた:周り3×3の敵全部に火のダメージ(プレイヤーは巻きこまない)
function firebombBurst(x, y) {
  const s = getPlayerStats();
  const targets = monsters.filter(m => Math.abs(m.x - x) <= 1 && Math.abs(m.y - y) <= 1);
  addLog(targets.length > 0 ? "火炎瓶が割れて、炎が広がった！" : "火炎瓶が割れて、炎が広がった…が、誰も巻きこまれなかった");
  for (const m of targets) {
    if (!monsters.includes(m)) continue; // 途中でいなくなった敵(術師が倒れて崩れた呼び出しなど)
    const dmg = rollDamage(s.atk * BALANCE.firebombPowerRate * weakMultiplier() * buffAtkMultiplier());
    toolDamage(m, dmg, `${monsterName(m)}は炎に巻かれて${dmg}のダメージ！`, false);
  }
}

// ==================== 道具の効き目(この冒険のあいだ) ====================
// playerBuffs:whetstone(砥石)/ frenzy(狂熱の香薬)は今の階だけ / stealthFloors(忍び足の香)は残りの階数
let playerBuffs = {};

// 新しい階に移ったとき:その階だけの効き目を消し、忍び足の残りを1つ減らす
function onNewFloorBuffs() {
  delete playerBuffs.whetstone;
  delete playerBuffs.frenzy;
  if (playerBuffs.stealthFloors > 0) {
    playerBuffs.stealthFloors -= 1;
    if (playerBuffs.stealthFloors === 0) addLog("忍び足の香の効き目が切れた");
  }
}

// 攻撃力の倍率(砥石・狂熱の香薬)
function buffAtkMultiplier() {
  return (playerBuffs.whetstone ? 1 + BALANCE.whetstoneAtk : 1) * (playerBuffs.frenzy ? BALANCE.frenzyAtk : 1);
}

// 受けるダメージの倍率(狂熱の香薬)
function buffTakenMultiplier() {
  return playerBuffs.frenzy ? BALANCE.frenzyTaken : 1;
}

// 敵の見える距離(忍び足の香が効いていると短くなる)
function sightRangeNow() {
  return playerBuffs.stealthFloors > 0 ? Math.max(1, Math.floor(BALANCE.monsterSightRange * BALANCE.stealthSightRate)) : BALANCE.monsterSightRange;
}

// ステータス欄に出す効き目(例:「砥石」「狂熱」「忍び足 2階」)
function buffLabels() {
  const list = [];
  if (playerBuffs.whetstone) list.push("砥石");
  if (playerBuffs.frenzy) list.push("狂熱");
  if (playerBuffs.stealthFloors > 0) list.push(`忍び足 ${playerBuffs.stealthFloors}階`);
  return list;
}

// ==================== 冒険中の道具 ====================
let runTools = []; // この冒険に持ってきた道具。1枠の形:{ id, count }

// 冒険を始めるとき:持ちこみ枠の道具を持っていき、枠は在庫から同じ道具で補充する
function takeCarryIntoRun() {
  runTools = base.carry.filter(c => c).map(c => ({ ...c }));
  base.carry = base.carry.map(c => (c ? takeFromStock(c.id) : null));
  if (runTools.length > 0) addLog(`道具を持ってきた:${runTools.map(t => `${TOOL_DATA[t.id].name}×${t.count}`).join("、")}`);
  saveGame();
}

// 冒険中に道具を使う(index:runTools の何番目か)。使えたら1つ減らして、1ターン進める
function useRunTool(index) {
  const t = runTools[index];
  if (!t) return;
  if (!TOOL_DATA[t.id].use()) {
    render();
    return;
  }
  t.count -= 1;
  if (t.count <= 0) runTools.splice(index, 1);
  screenMode = "dungeon"; // 使ったあとは、マップに戻って結果を見る
  turn += 1;
  runStats.turns += 1;
  endPlayerTurn();
}

// 持っているだけで効く道具を1つ使う(身代わりの護符など)。持っていれば減らして true
function consumePassiveTool(id) {
  const i = runTools.findIndex(t => t.id === id && t.count > 0);
  if (i < 0) return false;
  runTools[i].count -= 1;
  if (runTools[i].count <= 0) runTools.splice(i, 1);
  return true;
}

// ==================== 道具の在庫と持ちこみ枠 ====================
// 在庫から1枠ぶん(stack 個まで)取り出す。在庫がなければ null
function takeFromStock(id) {
  const have = base.toolStock[id] || 0;
  if (have <= 0) return null;
  const count = Math.min(TOOL_DATA[id].stack, have);
  base.toolStock[id] = have - count;
  return { id, count };
}

// 枠の道具を在庫に戻す
function returnToStock(slotIndex) {
  const c = base.carry[slotIndex];
  if (!c) return;
  base.toolStock[c.id] = (base.toolStock[c.id] || 0) + c.count;
  base.carry[slotIndex] = null;
}

// 枠 slotIndex に道具 id をセットする(null なら外す。今の道具は在庫に戻す)
function setCarrySlot(slotIndex, id) {
  returnToStock(slotIndex);
  if (id) base.carry[slotIndex] = takeFromStock(id);
  saveGame();
}

// 枠にセットできる道具(在庫があるもの)。先頭の null は「外す」
function carryChoices() {
  return [null, ...Object.keys(TOOL_DATA).filter(id => (base.toolStock[id] || 0) > 0)];
}

// プレイヤー画面の「道具」タブ:持ちこみ枠と在庫
function playerToolsHTML() {
  if (!base.shop.built) return `<div class="note">道具屋を建てると、道具を買って冒険に持ちこめる</div>`;
  let h = `<div class="note">持ちこみ枠に、在庫から道具をセットする。潜るとき持っていき(使わなくても死んだらなくなる)、枠は在庫から同じ道具で補充される</div>`;
  base.carry.forEach((c, i) => {
    h += gridRow(i === townCursor, "4em 1fr", [span("dim", `枠${i + 1}`), c ? `${esc(TOOL_DATA[c.id].name)} ×${c.count}` : span("dim", "―")]);
  });
  h += `<div class="list-gap"></div><div class="list-title"><b>道具の在庫</b></div>`;
  const stock = Object.keys(TOOL_DATA).filter(id => (base.toolStock[id] || 0) > 0);
  h += stock.length === 0 ? `<div class="note">在庫はない(道具屋で買える)</div>`
    : stock.map(id => gridRow(false, "4em 1fr", [span("dim", `×${base.toolStock[id]}`), esc(TOOL_DATA[id].name)])).join("");
  return h;
}

// 持ちこむ道具を選ぶ画面
function drawCarryPicker() {
  const slotIndex = townPickTool;
  let h = `<div class="list-title"><b>枠${slotIndex + 1}</b> にセットする道具</div>`;
  const choices = carryChoices();
  choices.forEach((id, i) => {
    const isSel = i === townPickCursor;
    if (!id) {
      h += gridRow(isSel, "1fr 4em", [span("dim", "(外す)"), ""]);
      return;
    }
    h += gridRow(isSel, "1fr 4em", [`${esc(TOOL_DATA[id].name)}<div class="sub">${esc(TOOL_DATA[id].desc)}</div>`, span("dim", `在庫${base.toolStock[id]}`)]);
  });
  setScreen("拠点 - プレイヤー - 道具", h, false);
  setHint([["↑↓", "選ぶ"], ["Enter / Space", "セットする"], ["Esc / Q", "戻る"]]);
}

// 持ちこむ道具を選ぶ画面のキー操作
function carryPickerKey(e) {
  const choices = carryChoices();
  if (e.key === "ArrowUp") townPickCursor = Math.max(0, townPickCursor - 1);
  else if (e.key === "ArrowDown") townPickCursor = Math.min(choices.length - 1, townPickCursor + 1);
  else if (e.key === "Enter") {
    setCarrySlot(townPickTool, choices[townPickCursor]);
    townPickTool = null;
  } else if (e.key === "Escape") townPickTool = null;
  render();
}

// ==================== 品ぞろえ ====================
// 道具屋に並ぶ品。増やすときは SHOP_ITEMS に足す
//   tool:道具の id(TOOL_DATA。買うと在庫に入る)/ resource:素材の id(買うとすぐ拠点に入る。tool の代わり)
//   count:1回で買える数 / price:ゴールド
//   unlockDepth:これまでの最高到達階がここまで来たら並ぶ / deliver:解放に納品する素材(null なら納品なし)
//   unlockKey:(省略できる)同じ unlockKey の品は、1回の納品でまとめて解放される
const SHOP_ITEMS = [
  { id: "smoke",     tool: "smoke",     count: 1,  price: 120,  unlockDepth: 0,  deliver: null },
  { id: "knife",     tool: "knife",     count: 10, price: 150,  unlockDepth: 0,  deliver: null },
  { id: "whetstone", tool: "whetstone", count: 1,  price: 100,  unlockDepth: 10, deliver: { ore: 15 } },
  { id: "frenzy",    tool: "frenzy",    count: 1,  price: 150,  unlockDepth: 10, deliver: { plant: 30 } },
  { id: "amulet",    tool: "amulet",    count: 1,  price: 600,  unlockDepth: 20, deliver: { bone: 40, ore: 20 } },
  { id: "stealth",   tool: "stealth",   count: 1,  price: 300,  unlockDepth: 20, deliver: { plant: 40, hide: 20 } },
  { id: "firebomb",  tool: "firebomb",  count: 1,  price: 250,  unlockDepth: 30, deliver: { ore: 40, plant: 20 } },
  { id: "warp",      tool: "warp",      count: 1,  price: 400,  unlockDepth: 30, deliver: { bone: 50, hide: 30 } },
  { id: "holy",      resource: "holy",  count: 1,  price: 1500, unlockDepth: 40, deliver: { bone: 60, ore: 60 } },
  { id: "buyBone",   resource: "bone",  count: 10, price: 300,  unlockDepth: 40, deliver: { hide: 50, plant: 50 }, unlockKey: "materials" },
  { id: "buyHide",   resource: "hide",  count: 10, price: 300,  unlockDepth: 40, deliver: { hide: 50, plant: 50 }, unlockKey: "materials" },
  { id: "buyOre",    resource: "ore",   count: 10, price: 300,  unlockDepth: 40, deliver: { hide: 50, plant: 50 }, unlockKey: "materials" },
  { id: "buyPlant",  resource: "plant", count: 10, price: 300,  unlockDepth: 40, deliver: { hide: 50, plant: 50 }, unlockKey: "materials" },
];

// 品の名前と説明
function shopItemName(item) {
  const name = item.tool ? TOOL_DATA[item.tool].name : RESOURCE_TYPES[item.resource].name;
  return item.count > 1 ? `${name} ×${item.count}` : name;
}
function shopItemDesc(item) {
  if (item.tool) return TOOL_DATA[item.tool].desc;
  return item.resource === "holy" ? "刻印の浄化に使う(買うとすぐ拠点に届く)" : "刻印の強化に使う素材(買うとすぐ拠点に届く)";
}

// 品が並んでいるか(最高到達階に届いている)/ 買えるか(納品が要るなら、納品済み)
function shopItemShown(item) {
  return base.records.bestDepth >= item.unlockDepth;
}
function shopItemUnlocked(item) {
  return shopItemShown(item) && (!item.deliver || !!base.shop.unlocked[item.unlockKey || item.id]);
}

// 素材の一覧を文字に(例:"植物40 皮25")。持っている数が足りなければ赤
function costHTML(cost) {
  return Object.keys(cost).map(id => {
    const ok = (base.resources[id] || 0) >= cost[id];
    return span(ok ? "" : "down", `${RESOURCE_TYPES[id].name}${cost[id]}`);
  }).join(" ");
}
function hasResources(cost) {
  return Object.keys(cost).every(id => (base.resources[id] || 0) >= cost[id]);
}
function payResources(cost) {
  for (const id in cost) base.resources[id] -= cost[id];
}

// 道具屋を建てる
function buildShop() {
  const cost = BALANCE.shopBuildCost;
  if (!hasResources(cost)) {
    addLog("素材が足りないので、道具屋を建てられない");
    return;
  }
  payResources(cost);
  base.shop.built = true;
  addLog("道具屋を建てた！ ゴールドで、冒険に持ちこむ道具を買える");
  saveGame();
}

// 品を選んで Enter:納品して解放する / 買う
function shopEnter(item) {
  if (!shopItemUnlocked(item)) {
    if (!hasResources(item.deliver)) {
      addLog("納品する素材が足りない");
      return;
    }
    payResources(item.deliver);
    base.shop.unlocked[item.unlockKey || item.id] = true;
    addLog(`素材を納品した。道具屋で「${shopItemName(item)}」が買えるようになった`);
    saveGame();
    return;
  }
  if (base.gold < item.price) {
    addLog(`ゴールドが足りない(${item.price}G必要)`);
    return;
  }
  base.gold -= item.price;
  if (item.resource) {
    // 素材・聖水:すぐ拠点に届く
    base.resources[item.resource] = (base.resources[item.resource] || 0) + item.count;
    addLog(`${shopItemName(item)}を買った`);
  } else {
    // 道具:在庫に入る。その道具をどの枠にもセットしていなくて、空いている枠があれば、そこにセットする
    base.toolStock[item.tool] = (base.toolStock[item.tool] || 0) + item.count;
    const empty = base.carry.indexOf(null);
    if (!base.carry.some(c => c && c.id === item.tool) && empty >= 0) base.carry[empty] = takeFromStock(item.tool);
    addLog(`${shopItemName(item)}を買った(在庫に入った。プレイヤー画面の「道具」で持ちこみ枠にセットできる)`);
  }
  saveGame();
}

// ==================== 道具屋の画面 ====================
// 道具屋に並べる行(まだ並ばない品は出さない)
function shopRows() {
  return base.shop.built ? SHOP_ITEMS.filter(shopItemShown) : [];
}

function drawTownShop() {
  let h = "";
  if (!base.shop.built) {
    h += `<div>まだ道具屋はない。素材を使って建てられる。</div>`;
    h += `<div class="note">建てると、ゴールドで冒険に持ちこむ道具を買えるようになる(ゴールドは酒場の依頼で手に入る)</div>`;
    h += gridRow(true, "6em 1fr", ["<b>建てる</b>", costHTML(BALANCE.shopBuildCost)]);
    setScreen("拠点 - 道具屋", h, false);
    setHint([["Enter / Space", "建てる"], ["Esc / Q", "戻る"]]);
    return;
  }
  const carried = base.carry.filter(c => c).length;
  h += `<div class="status-top"><span>所持 <b>${base.gold}</b>G</span><span>持ちこみ枠 ${carried} / ${BALANCE.carrySlots}</span></div>`;
  h += `<div class="note">買った道具は在庫に入る。持ちこむ道具は、プレイヤー画面の「道具」タブでセットする。深く潜るほど新しい品が並び、素材を納品すると買えるようになる</div>`;
  const rows = shopRows();
  const cols = "9em 1fr 6em";
  rows.forEach((item, i) => {
    const right = shopItemUnlocked(item) ? span(base.gold >= item.price ? "up" : "down", `${item.price}G`) : span("dim", "未解放");
    const stock = item.tool && base.toolStock[item.tool] ? span("dim", `(在庫${base.toolStock[item.tool]})`) : "";
    h += gridRow(i === townCursor, cols, [`<b>${esc(shopItemName(item))}</b>${stock}`, span("sub", esc(shopItemDesc(item))), right]);
  });
  // 選んでいる品:納品が要るなら、その素材
  const sel = rows[townCursor];
  if (sel && !shopItemUnlocked(sel)) {
    h += `<div class="info">納品すると買えるようになる:${costHTML(sel.deliver)}${sel.unlockKey ? span("sub", "(同じ種類の品もまとめて解放)") : ""}</div>`;
  }
  setScreen("拠点 - 道具屋", h, false);
  const enter = sel && !shopItemUnlocked(sel) ? "納品する" : "買う";
  setHint([["↑↓", "選ぶ"], ["Enter / Space", enter], ["Esc / Q", "戻る"]]);
}

// 道具屋のキー操作
function shopKey(e) {
  if (e.key === "Escape") { backToTownMenu(); return; }
  if (!base.shop.built) {
    if (e.key === "Enter") buildShop();
    render();
    return;
  }
  const rows = shopRows();
  if (e.key === "ArrowUp") townCursor = Math.max(0, townCursor - 1);
  else if (e.key === "ArrowDown") townCursor = Math.max(0, Math.min(rows.length - 1, townCursor + 1));
  else if (e.key === "Enter" && rows[townCursor]) shopEnter(rows[townCursor]);
  render();
}
