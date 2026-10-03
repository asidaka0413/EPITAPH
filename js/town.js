// 拠点のメニューと、プレイヤー・制作・図鑑・設定の画面
// index.html から <script src> で読み込まれる(読み込む順番は index.html に書いてある)

// ==================== 拠点 ====================
// 拠点のメニュー。項目を増やすときはここに足す
//   id:画面の名前 / name:表示名 / summary:メニューの右側に出す一言
//   gapAfter:true なら、そのあとに少しすき間をあける(潜る / 潜る前の準備 / そのほか のまとまりに分ける)
const TOWN_MENU = [
  { id: "dive",     name: "ダンジョンに潜る", gapAfter: true,
    // 1行目:記録と墓 / 2行目:潜る前の確認(受けている依頼・持ちこむ道具・セットしている刻印。忘れに気づけるように)
    summary: () => {
      const rec = base.records.runs === 0 ? `目指すは地下${BALANCE.goalDepth}階`
        : `最高 ${depthLabel(base.records.bestDepth)}${base.records.clears > 0 ? `　踏破 ${base.records.clears}回` : ""}`
          + `${base.grave && base.grave.relic && !base.grave.relicTaken ? `　墓 地下${base.grave.depth}階` : ""}`;
      const tools = base.shop.built ? `　道具 ${base.carry.filter(c => c).length}/${BALANCE.carrySlots}` : "";
      // 刻印の空きが少なくて潜れないときは、3行目に出す
      const full = materialsNearFull() ? `\n⚠ 刻印が多すぎて潜れない(${base.materials.length}/${BALANCE.materialMax}個。制作で解体・合成を)` : "";
      return `${rec}\n依頼 ${base.quests.accepted.length}${tools}　刻印 ${Object.keys(base.materialSet).length}/${Object.keys(EQUIP_SLOTS).length}${full}`;
    } },
  { id: "player",   name: "プレイヤー",
    summary: () => `Lv.${base.level}　スキルポイント ${base.skillPoints}　刻印 ${Object.keys(base.materialSet).length}/${Object.keys(EQUIP_SLOTS).length}`,
    hasNew: () => PLAYER_TABS.some(tab => tab.hasNew()) }, // hasNew:NEW の印を付けるか(省略できる)
  { id: "tavern",   name: "酒場",
    summary: () => `所持 ${base.gold}G　受けている依頼 ${base.quests.accepted.length}` },
  { id: "shop",     name: "道具屋",
    summary: () => base.shop.built ? `持ちこみ枠 ${base.carry.filter(c => c).length}/${BALANCE.carrySlots}` : "まだない(素材で建てられる)" },
  { id: "smithy",   name: "鍛冶屋",
    summary: () => base.smithy.built ? `注文 ${Object.keys(base.smithOrders).length}/${Object.keys(EQUIP_SLOTS).length}　腕前 ${smithQualityText(base.smithy.level)}` : "まだない(素材で建てられる)" },
  { id: "craft",    name: "制作",   summary: () => `刻印の強化・合成・解体・浄化　刻印 ${base.materials.length}/${BALANCE.materialMax}個`, gapAfter: true },
  { id: "dex",      name: "図鑑",
    summary: () => DEX_TABS.map(t => `${t.name} ${dexCount(t.id)}/${dexEntries(t.id).length}`).join("　") },
  { id: "achieve",  name: "実績",
    summary: () => `達成 ${achievementCount()}/${achievementList.length}` },
  { id: "help",     name: "遊び方",
    summary: () => base.records.runs === 0 ? "はじめての人は、まずここ" : "操作と仕組みの説明" },
  { id: "settings", name: "設定",   summary: () => "" },
];

// 制作のタブ(よく使う順。浄化は聖水がないとできないので後ろ)。制作は「刻印をいじる場所」
//   書の交換は、プレイヤー画面の「書」タブにある
const CRAFT_TABS = [
  { id: "enhance", name: "強化" },
  { id: "fuse",    name: "合成" },
  { id: "salvage", name: "解体" },
  { id: "purify",  name: "浄化" },
];

// 制作(強化・合成・浄化・解体)で並べる刻印の種類(武器・盾・頭・胴・腰・足・指輪・イヤリング)
const CRAFT_TYPES = Object.keys(ITEM_TYPES);

// その種類の刻印(手に入れた順。強化してもカーソルの位置がずれないように、並べ替えない)
function materialsOfType(type) {
  return base.materials.filter(mat => mat.slot === type);
}

// 種類を選んだあとの一覧:強化・解体はその種類の全部、合成はまだ合成していないもの、浄化は呪いつきのものだけ
function craftMatList() {
  const list = materialsOfType(craftType);
  const tab = CRAFT_TABS[craftTab].id;
  if (tab === "fuse") return list.filter(canFuse);
  if (tab === "purify") return list.filter(hasCurse);
  return list;
}

// 制作画面で Enter
function craftEnter() {
  const tab = CRAFT_TABS[craftTab].id;
  // 1段目:種類を選ぶ
  if (!craftType) {
    craftType = CRAFT_TYPES[townCursor];
    craftPickCursor = 0;
    fuseFirst = null;
    return;
  }
  const mat = craftMatList()[craftPickCursor];
  if (!mat) return;
  if (tab === "enhance") {
    enhanceMaterial(mat);
  } else if (tab === "purify") {
    purifyMaterial(mat);
    craftPickCursor = Math.max(0, Math.min(craftPickCursor, craftMatList().length - 1)); // 浄化したものは一覧から消える
  } else if (tab === "salvage") {
    salvageMaterial(mat);
    craftPickCursor = Math.max(0, Math.min(craftPickCursor, craftMatList().length - 1)); // 解体したものは一覧から消える
  } else if (!fuseFirst) {
    fuseFirst = mat; // 1個目を選んだ → 2個目を選ぶ
  } else if (mat === fuseFirst) {
    fuseFirst = null; // 同じものを選んだら、選び直し
  } else if (!canFusePair(fuseFirst, mat)) {
    addLog("効果つき(呪い・浄化)の刻印どうしは合成できない");
  } else {
    fuseMaterials(fuseFirst, mat);
    fuseFirst = null;
    craftPickCursor = 0;
  }
}

// 制作画面のキー操作
function craftKey(e) {
  // 2段目:種類を選んだあとの刻印の一覧
  if (craftType) {
    const count = craftMatList().length;
    if (e.key === "ArrowUp") craftPickCursor = Math.max(0, craftPickCursor - 1);
    else if (e.key === "ArrowDown") craftPickCursor = Math.max(0, Math.min(count - 1, craftPickCursor + 1));
    else if (e.key === "Enter") craftEnter();
    else if (e.key === "Escape") {
      if (fuseFirst) fuseFirst = null;  // 合成の1個目を選び直す
      else craftType = null;            // 種類を選び直す
    }
    render();
    return;
  }
  // 1段目:種類の一覧
  const rows = CRAFT_TYPES.length;
  if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
    craftClickTab(craftTab + (e.key === "ArrowRight" ? 1 : -1));
  } else if (e.key === "ArrowUp") townCursor = Math.max(0, townCursor - 1);
  else if (e.key === "ArrowDown") townCursor = Math.max(0, Math.min(rows - 1, townCursor + 1));
  else if (e.key === "Enter") craftEnter();
  else if (e.key === "Escape") { backToTownMenu(); return; }
  render();
}

// ==================== タブのクリック/タップ ====================
// 画面のタブを押したとき、そのタブへ切り替える(←→ キーからも呼ぶ)。i:何番目のタブか(はみ出したら反対の端へ回る)
//   タブを描くところ(townscreens.js・screens.js)で onclick="〇〇ClickTab(番号)" と書いて使う

// 制作のタブ。刻印を選んでいる途中なら、選ぶのをやめる
function craftClickTab(i) {
  craftTab = (i + CRAFT_TABS.length) % CRAFT_TABS.length;
  craftType = null;
  fuseFirst = null;
  townCursor = 0;
  render();
}

// プレイヤーのタブ。スキルにポイントを振っている途中なら、そこで終わってセーブ
function playerClickTab(i) {
  if (townAllocating) { townAllocating = false; saveGame(); }
  playerTab = (i + PLAYER_TABS.length) % PLAYER_TABS.length;
  townCursor = 0;
  render();
}

// 遊び方のタブ(替えたら、いちばん上から)
function helpClickTab(i) {
  helpTab = (i + HELP_PAGES.length) % HELP_PAGES.length;
  render();
  document.getElementById("screen").scrollTop = 0;
}

// 実績のタブ(替えたら、いちばん上から)
function achieveClickTab(i) {
  achieveTab = (i + ACHIEVEMENT_TABS.length) % ACHIEVEMENT_TABS.length;
  render();
  document.getElementById("screen").scrollTop = 0;
}

// 図鑑のタブ
const DEX_TABS = [
  { id: "monster", name: "敵" },
  { id: "equip",   name: "装備" },
  { id: "book",    name: "書" },
];

// 図鑑に並べるもの(データファイルに書いてあるもの全部。装備は床 → 敵の順)
function dexEntries(tab) {
  if (tab === "monster") return monsterList;
  if (tab === "equip") {
    // 装備の種類の順(武器が一番上)。同じ種類の中は equipment.js に書いた順
    //   隠し装備(hidden)は、一度拾うまで一覧に出さない
    const order = Object.keys(ITEM_TYPES);
    return equipmentList.filter(e => !e.hidden || base.records.equipFound[e.id])
      .sort((a, b) => order.indexOf(a.slot) - order.indexOf(b.slot));
  }
  return bookList;
}

// 図鑑の左の一覧に今出すもの(装備タブは、開いている種類だけ)
function dexListEntries() {
  const tab = DEX_TABS[dexTab].id;
  if (tab !== "equip") return dexEntries(tab);
  const type = Object.keys(ITEM_TYPES)[dexEquipType];
  return dexEntries("equip").filter(e => e.slot === type && (type !== "weapon" || !dexWeaponKind || e.kind === dexWeaponKind));
}

// 図鑑の武器の絞りこみを次のジャンルにする(全部 → 剣 → 短剣 → … → 全部)。F とクリック/タップから呼ぶ
//   武器を開いていないときは何もしない。図鑑に1つも載っていないジャンルは飛ばす
function dexCycleWeaponKind() {
  if (DEX_TABS[dexTab].id !== "equip" || Object.keys(ITEM_TYPES)[dexEquipType] !== "weapon") return;
  const weapons = dexEntries("equip").filter(e => e.slot === "weapon");
  const kinds = [null, ...Object.keys(WEAPON_KINDS).filter(k => weapons.some(e => e.kind === k))];
  dexWeaponKind = kinds[(kinds.indexOf(dexWeaponKind) + 1) % kinds.length];
  townCursor = 0;
  render();
}

// 図鑑の大きいタブ(敵・装備・書)を i 番目にする。←→ とクリック/タップから呼ぶ
function dexClickTab(i) {
  dexTab = (i + DEX_TABS.length) % DEX_TABS.length;
  townCursor = 0;
  render();
}

// 図鑑の装備の種類(武器・盾…)を i 番目にする。[ ] とクリック/タップから呼ぶ
function dexClickEquipType(i) {
  const typeCount = Object.keys(ITEM_TYPES).length;
  dexEquipType = (i + typeCount) % typeCount;
  townCursor = 0;
  render();
}

// 見つけたことがあるか
function dexFound(tab, e) {
  if (tab === "monster") return !!base.records.seen[e.id];
  if (tab === "equip") return !!base.records.equipFound[e.id];
  return !!base.records.booksFound[e.id];
}

// 図鑑の敵がどこまで分かっているか(0〜3)。倒した数が BALANCE.dexRevealKills をいくつ越えたか
//   0:戦っただけ / 1:強さ・速さ など / 2:特徴・素材 など / 3:くわしい数字・出る階
function dexMonsterLevel(m) {
  const kills = base.records.kills[m.id] || 0;
  return BALANCE.dexRevealKills.filter(n => kills >= n).length;
}

// 敵の階 d での HP・攻撃力(kind:"hp" か "attack"。攻撃力は幅のまんなか)
//   層の段差(enemyBoost)は同じ階どうしでくらべるので入れない
function dexStatAt(m, d, kind) {
  if (kind === "hp") return m.hp + (m.hpPerDepth || 0) * enemySteps(d, "hp");
  return (m.attackMin + m.attackMax) / 2 + (m.attackPerDepth || 0) * enemySteps(d, "attack");
}

// 図鑑の敵の強さの★の数(1〜5)。出始める階で、同じ階に出るほかの敵の平均とくらべる
//   攻撃しない敵(宝石虫など)は攻撃の平均に入れない
function dexStars(m, kind) {
  const d = m.minDepth;
  const others = monsterList.filter(x => x.minDepth <= d && (x.maxDepth === null || x.maxDepth >= d) && (kind === "hp" || x.attackMax > 0));
  const avg = others.reduce((sum, x) => sum + dexStatAt(x, d, kind), 0) / others.length;
  const ratio = dexStatAt(m, d, kind) / avg;
  return 1 + BALANCE.dexStarRatios.filter(r => ratio >= r).length;
}

// 見つけた数
function dexCount(tab) {
  return dexEntries(tab).filter(e => dexFound(tab, e)).length;
}

// プレイヤー画面のタブ。hasNew:タブに NEW の印を付けるか
//   並び:見るだけ(ステータス・特性)→ 潜る前の準備(道具・刻印)→ 育てる(書・スキル)
const PLAYER_TABS = [
  { id: "status",   name: "ステータス", hasNew: () => false },
  { id: "trait",    name: "特性",       hasNew: () => false },
  { id: "tools",    name: "道具",       hasNew: () => false }, // 冒険に持ちこむ道具(js/shop.js)
  { id: "material", name: "刻印",       hasNew: () => base.materials.some(mat => mat.isNew) },
  { id: "clan",     name: "一族",       hasNew: () => false }, // 一族のセット効果(見るだけ)
  { id: "book",     name: "書",         hasNew: () => Object.keys(base.bookNew).length > 0 },
  { id: "skill",    name: "スキル",     hasNew: () => false },
];

// プレイヤー画面の今のタブに並んでいる行の数
function playerTabRows() {
  const tab = PLAYER_TABS[playerTab].id;
  if (tab === "material") return townSlots().length;
  if (tab === "book") return BALANCE.bookSlots + bookRecipes().length; // 書の枠のあとに、書の交換のレシピ
  if (tab === "skill") return setBooks().length;
  if (tab === "tools") return base.shop.built ? BALANCE.carrySlots : 0;
  return 0; // ステータス・特性・一族は見るだけ
}

// 持っている書の一覧(系統・レベルの順)
function ownedBooks() {
  return bookList.filter(b => base.books[b.id] > 0);
}

// 書の枠にセットできる書の一覧(先頭の null は「何もセットしない」)
function bookChoices() {
  return [null, ...ownedBooks()];
}

// 書の枠 slotIndex に書 id をセットする(null なら外す)
//   外した書に振っていたポイントは手元に戻す。ほかの枠にセット中の書なら、ポイントごと移す
function setBookToSlot(slotIndex, id) {
  const old = base.bookSet[slotIndex];
  if (old === id) return;
  if (old) {
    const refund = base.skillAlloc[old] || 0;
    base.skillPoints += refund;
    delete base.skillAlloc[old];
    addLog(`${bookById(old).name}を外した${refund > 0 ? `。スキルポイント ${refund} が戻った` : ""}`);
  }
  if (id) {
    const other = base.bookSet.indexOf(id);
    if (other >= 0) base.bookSet[other] = null; // ほかの枠から移す(ポイントはそのまま)
    base.bookSet[slotIndex] = id;
    if (!(id in base.skillAlloc)) base.skillAlloc[id] = 0;
    addLog(`${bookById(id).name}を書${slotIndex + 1}にセットした`);
  } else {
    base.bookSet[slotIndex] = null;
  }
}

// スキルタブで選んでいる書に、delta ポイント振る(マイナスなら戻す)
function allocSelected(delta) {
  const book = setBooks()[townCursor];
  if (!book) return;
  const cur = base.skillAlloc[book.id] || 0;
  // 0 〜 上限の間、かつ手持ちのポイントの範囲で
  const next = Math.max(0, Math.min(book.maxPoints, cur + delta, cur + base.skillPoints));
  base.skillPoints -= next - cur;
  base.skillAlloc[book.id] = next;
  if (cur < book.maxPoints && next >= book.maxPoints) {
    addLog(`${book.name}を振り切った！ 特性「${book.trait.name}」が解放された`);
  }
}

// 書の交換のレシピ一覧:レベル2以上の書それぞれについて、1つ下のレベルの書から作れる
function bookRecipes() {
  const recipes = [];
  for (const to of bookList) {
    const from = bookList.find(b => b.group === to.group && b.level === to.level - 1);
    if (from) recipes.push({ from, to });
  }
  return recipes;
}

// 書を交換する(下のレベルの書を bookExchangeCost 冊使って、上のレベルの書を1冊)
function exchangeBook(recipe) {
  const { from, to } = recipe;
  const cost = BALANCE.bookExchangeCost;
  if ((base.books[from.id] || 0) < cost) {
    addLog(`${from.name}が${cost}冊ないので交換できない`);
    return;
  }
  base.books[from.id] -= cost;
  if (base.books[from.id] <= 0) {
    // 1冊もなくなったら、セットしていても外す(振っていたポイントは戻る)
    delete base.books[from.id];
    delete base.bookNew[from.id];
    const slot = base.bookSet.indexOf(from.id);
    if (slot >= 0) setBookToSlot(slot, null);
  }
  base.books[to.id] = (base.books[to.id] || 0) + 1;
  base.bookNew[to.id] = true;
  base.records.booksFound[to.id] = true; // 図鑑に登録
  addLog(`${from.name} ×${cost} を ${to.name} と交換した！`);
  saveGame();
}

// 拠点の設定画面の項目。name:表示名 / value:右側に出す今の状態 / apply:Enter を押したときの処理
//   shown:(省略できる)false を返すときは一覧に出さない
//   adjust:(省略できる)←→ を押したときの処理(d:← なら -1 / → なら +1)
const TOWN_SETTINGS = [
  { name: "拾ったとき、空いている枠に自動で装備",
    value: () => base.settings.autoEquip ? span("up", "ON") : span("dim", "OFF"),
    apply: () => toggleAutoEquip() },
  { name: "効果音",
    value: () => seEnabled() ? span("up", "ON") : span("dim", "OFF"),
    apply: () => toggleSE() },
  { name: "効果音の音量",
    value: () => `${base.settings.seVolume} ${span("dim", "(←→ で変える)")}`,
    apply: () => cycleSEVolume(), // Enter は上げていき、100 の次は 0 に戻る
    adjust: d => changeSEVolume(d) },
  { name: "デバッグモード",
    shown: () => DEBUG_ALLOWED, // アドレスに ?debug を付けて開いたときだけ(js/debug.js)
    value: () => base.settings.debug ? `${span("up", "ON")} ${span("dim", "(実績は取れない)")}` : span("dim", "OFF"),
    apply: () => { base.settings.debug = !base.settings.debug; saveGame(); } },
  { name: "セーブデータを書き出す(ファイルに保存)",
    value: () => span("sub", "ほかの場所で遊ぶときに持っていける"),
    apply: () => exportSave() },
  { name: "セーブデータを読み込む(ファイルから)",
    value: () => span("sub", "今のセーブデータは上書きされる"),
    apply: () => importSave() },
  { name: "セーブデータを消す",
    value: () => "",
    apply: () => deleteSave() },
];

// 設定画面に出す項目(shown が false のものを除く)
function townSettings() {
  return TOWN_SETTINGS.filter(item => !item.shown || item.shown());
}

// 拠点メニューで Enter
function townMenuEnter() {
  const item = TOWN_MENU[townMenuCursor];
  if (item.id === "dive") {
    // 刻印の空きが少ないと潜れない(死んだときに刻めなくならないように)
    if (materialsNearFull()) {
      addLog(`刻印が多すぎて潜れない(${base.materials.length}/${BALANCE.materialMax}個)。「制作」で解体・合成して、空きを${BALANCE.materialDiveFree}個以上にしてください`);
      return;
    }
    startNewRun();
    return;
  }
  townPage = item.id;
  townCursor = 0;
  closeTownPickers();
  render();
}

// 拠点の選択中の一覧などを全部閉じる
function closeTownPickers() {
  townPickSlot = null;
  townPickBook = null;
  townPickTool = null;
  townAllocating = false;
  craftType = null;
  fuseFirst = null;
}

// 拠点に戻る(起動したとき・死んだとき・刻んだあとなど。メニューの一番上から)
function goToTown() {
  screenMode = "town";
  equipped = {}; // 拠点では装備を着けていない(前の冒険の装備の効果が残らないように)
  townPage = "menu";
  townMenuCursor = 0;
  closeTownPickers();
  refreshQuestBoard(); // 冒険から戻ったら、酒場の掲示板が新しくなる(まだ作っていなければ)
}

// 拠点の各画面から、メニューに戻る
function backToTownMenu() {
  townPage = "menu";
  closeTownPickers();
  render();
}

// 書を選ぶ一覧を閉じたとき:書の NEW を消す(見たことになる)
function clearNewBooks() {
  if (Object.keys(base.bookNew).length === 0) return;
  base.bookNew = {};
  saveGame();
}

// 拠点画面のキー操作
function townKey(e) {
  if (townPage === "menu") {
    if (e.key === "ArrowUp") townMenuCursor = Math.max(0, townMenuCursor - 1);
    else if (e.key === "ArrowDown") townMenuCursor = Math.min(TOWN_MENU.length - 1, townMenuCursor + 1);
    else if (e.key === "Enter") { townMenuEnter(); return; }
    render();
    return;
  }

  if (townPage === "player") {
    playerKey(e);
    return;
  }

  if (townPage === "dex") {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") { dexClickTab(dexTab + (e.key === "ArrowRight" ? 1 : -1)); return; }
    if ((e.key === "[" || e.key === "]") && DEX_TABS[dexTab].id === "equip") { dexClickEquipType(dexEquipType + (e.key === "]" ? 1 : -1)); return; }
    if (e.key === "ArrowUp") townCursor = Math.max(0, townCursor - 1);
    else if (e.key === "ArrowDown") townCursor = Math.min(dexListEntries().length - 1, townCursor + 1);
    else if (e.key === "Escape") { backToTownMenu(); return; }
    render();
    return;
  }

  if (townPage === "craft") {
    craftKey(e);
    return;
  }

  if (townPage === "tavern") {
    tavernKey(e);
    return;
  }

  if (townPage === "shop") {
    shopKey(e);
    return;
  }

  if (townPage === "smithy") {
    smithyKey(e);
    return;
  }

  // 実績:←→ でタブ、↑↓ で一覧をスクロール
  if (townPage === "achieve") {
    const screenEl = document.getElementById("screen");
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") achieveClickTab(achieveTab + (e.key === "ArrowRight" ? 1 : -1));
    else if (e.key === "ArrowUp") screenEl.scrollTop -= 60;
    else if (e.key === "ArrowDown") screenEl.scrollTop += 60;
    else if (e.key === "Escape") backToTownMenu();
    return;
  }

  // 遊び方:←→ でタブ、↑↓ で説明をスクロール
  if (townPage === "help") {
    const screenEl = document.getElementById("screen");
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") helpClickTab(helpTab + (e.key === "ArrowRight" ? 1 : -1));
    else if (e.key === "ArrowUp") screenEl.scrollTop -= 60;
    else if (e.key === "ArrowDown") screenEl.scrollTop += 60;
    else if (e.key === "Escape") backToTownMenu();
    return;
  }

  if (townPage === "settings") {
    if (e.key === "ArrowUp") townCursor = Math.max(0, townCursor - 1);
    else if (e.key === "ArrowDown") townCursor = Math.min(townSettings().length - 1, townCursor + 1);
    else if (e.key === "Enter") townSettings()[townCursor].apply();
    else if ((e.key === "ArrowLeft" || e.key === "ArrowRight") && townSettings()[townCursor].adjust) {
      townSettings()[townCursor].adjust(e.key === "ArrowLeft" ? -1 : 1);
    }
    else if (e.key === "Escape") { backToTownMenu(); return; }
    render();
    return;
  }

  // それ以外(準備中の画面)
  if (e.key === "Escape") backToTownMenu();
}

// 拠点のプレイヤー画面のキー操作
function playerKey(e) {
  // 刻印を選んでいる最中
  if (townPickSlot) {
    const count = materialChoices(townPickSlot).length;
    if (e.key === "ArrowUp") townPickCursor = Math.max(0, townPickCursor - 1);
    else if (e.key === "ArrowDown") townPickCursor = Math.min(count - 1, townPickCursor + 1);
    else if (e.key === "Enter") { setMaterialSelected(); return; }
    else if (e.key === "Escape") { clearNewMaterials(townPickSlot); townPickSlot = null; }
    render();
    return;
  }

  // 書を選んでいる最中
  if (townPickBook !== null) {
    const choices = bookChoices();
    if (e.key === "ArrowUp") townPickCursor = Math.max(0, townPickCursor - 1);
    else if (e.key === "ArrowDown") townPickCursor = Math.min(choices.length - 1, townPickCursor + 1);
    else if (e.key === "Enter") {
      const book = choices[townPickCursor];
      setBookToSlot(townPickBook, book ? book.id : null);
      clearNewBooks();
      townPickBook = null;
      saveGame();
    } else if (e.key === "Escape") { clearNewBooks(); townPickBook = null; }
    render();
    return;
  }

  // 持ちこむ道具を選んでいる最中
  if (townPickTool !== null) {
    carryPickerKey(e);
    return;
  }

  // スキルにポイントを振っている最中(振ったらすぐ反映。Enter / Esc で終わってセーブ)
  if (townAllocating) {
    if (e.key === "ArrowRight") allocSelected(1);
    else if (e.key === "ArrowLeft") allocSelected(-1);
    else if (e.key === "ArrowUp") allocSelected(10);
    else if (e.key === "ArrowDown") allocSelected(-10);
    else if (e.key === "Enter" || e.key === "Escape") { townAllocating = false; saveGame(); }
    render();
    return;
  }

  // タブの一覧
  const tab = PLAYER_TABS[playerTab].id;
  if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
    playerClickTab(playerTab + (e.key === "ArrowRight" ? 1 : -1));
    return;
  } else if (e.key === "ArrowUp") {
    townCursor = Math.max(0, townCursor - 1);
  } else if (e.key === "ArrowDown") {
    townCursor = Math.max(0, Math.min(playerTabRows() - 1, townCursor + 1));
  } else if (e.key === "Enter") {
    if (tab === "material") { openMaterialPicker(); return; }
    if (tab === "book" && townCursor < BALANCE.bookSlots) {
      // 書の枠:セットする書を選ぶ
      townPickBook = townCursor;
      townPickCursor = Math.max(0, bookChoices().map(b => b && b.id).indexOf(base.bookSet[townCursor]));
    } else if (tab === "book") {
      // 書の交換のレシピ
      const r = bookRecipes()[townCursor - BALANCE.bookSlots];
      if (r) exchangeBook(r);
    }
    if (tab === "skill" && setBooks().length > 0) townAllocating = true;
    if (tab === "tools" && base.shop.built) {
      townPickTool = townCursor;
      const cur = base.carry[townCursor];
      townPickCursor = Math.max(0, carryChoices().indexOf(cur ? cur.id : null));
    }
  } else if (e.key === "Escape") {
    backToTownMenu();
    return;
  }
  render();
}

// 拠点画面に並べる装備枠(EQUIP_SLOTS の順)
function townSlots() {
  return Object.keys(EQUIP_SLOTS);
}

// 枠の名前から、装備の種類を調べる(ring1 → "ring")
function slotType(slot) {
  return Object.keys(ITEM_TYPES).find(type => ITEM_TYPES[type].slots.includes(slot));
}

// その種類(type)に、まだ一覧で見ていない新しい刻印があるか
function hasNewMaterial(type) {
  return base.materials.some(mat => mat.slot === type && mat.isNew);
}

// 「NEW」の印
function newBadge() {
  return ` <span class="new">NEW</span>`;
}

// 刻印選択の一覧を閉じたとき:その種類の刻印の NEW を消す(見たことになる)
function clearNewMaterials(slot) {
  const type = slotType(slot);
  let changed = false;
  for (const mat of base.materials) {
    if (mat.slot === type && mat.isNew) {
      delete mat.isNew;
      changed = true;
    }
  }
  if (changed) saveGame();
}

// 枠 slot にセットできる刻印の一覧(先頭の null は「何もセットしない」)
//   性能の合計が大きい順に並べる
function materialChoices(slot) {
  const type = slotType(slot);
  const list = base.materials.filter(mat => mat.slot === type);
  list.sort((a, b) => materialTotal(b) - materialTotal(a));
  return [null, ...list];
}

// プレイヤー画面で枠を選んで Enter:その枠にセットできる刻印の一覧を開く
function openMaterialPicker() {
  townPickSlot = townSlots()[townCursor];
  // 今セットしている刻印にカーソルを合わせる
  const choices = materialChoices(townPickSlot);
  townPickCursor = Math.max(0, choices.indexOf(base.materialSet[townPickSlot] || null));
  render();
}

// 刻印選択の画面で Enter を押したとき:選んだ刻印を枠にセットする
function setMaterialSelected() {
  const slot = townPickSlot;
  const mat = materialChoices(slot)[townPickCursor];
  if (mat) {
    // ほかの枠(指輪1と指輪2など)にセットしていたら、そちらからは外す(1個の刻印は1つの枠にだけ)
    for (const s in base.materialSet) {
      if (base.materialSet[s] === mat) delete base.materialSet[s];
    }
    base.materialSet[slot] = mat;
  } else {
    delete base.materialSet[slot];
  }
  clearNewMaterials(slot);
  townPickSlot = null;
  saveGame();
  render();
}
