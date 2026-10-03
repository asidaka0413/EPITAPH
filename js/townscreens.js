// 拠点の画面を描くところ(メニュー・プレイヤー・制作・遊び方・設定・図鑑)
// index.html から <script src> で読み込まれる(読み込む順番は index.html に書いてある)
// 一覧の1行(listRow)や gridRow・setScreen などは screens.js のものを使う

// ==================== 拠点の画面 ====================
function drawTown() {
  if (townPage === "player") drawTownPlayer();
  else if (townPage === "craft") drawTownCraft();
  else if (townPage === "dex") drawTownDex();
  else if (townPage === "achieve") drawTownAchieve();
  else if (townPage === "settings") drawTownSettings();
  else if (townPage === "help") drawTownHelp();
  else if (townPage === "tavern") drawTownTavern();
  else if (townPage === "shop") drawTownShop();
  else if (townPage === "smithy") drawTownSmithy();
  else if (townPage !== "menu") drawTownComingSoon();
  else drawTownMenu();
}

// 拠点:メニュー
function drawTownMenu() {
  let h = `<div class="game-title">EPITAPH</div>`;
  TOWN_MENU.forEach((item, i) => {
    const newMark = item.hasNew && item.hasNew() ? newBadge() : "";
    // summary の中の改行(\n)は、そのまま改行して出す
    const summary = esc(item.summary()).replace(/\n/g, "<br>");
    h += gridRow(i === townMenuCursor, "10em 1fr", [`${esc(item.name)}${newMark}`, `<span class="sub">${summary}</span>`]);
    if (item.gapAfter) h += `<div class="list-gap"></div>`; // まとまりの切れ目を少しあける
  });
  setScreen("拠点", h, false);
  setHint([["↑↓", "選ぶ"], ["Enter / Space", "決定"]]);
}

// 拠点:プレイヤー(タブ:ステータス・特性・道具・刻印・書・スキル)
function drawTownPlayer() {
  if (townPickSlot) {
    drawMaterialPicker();
    return;
  }
  if (townPickBook !== null) {
    drawBookPicker();
    return;
  }
  if (townPickTool !== null) {
    drawCarryPicker();
    return;
  }
  let h = `<div class="status-top"><span>Lv.<b>${base.level}</b> ${span("sub", `XP ${base.xp} / ${xpNeeded(base.level)}`)}</span>`
        + `<span>スキルポイント <b>${base.skillPoints}</b></span></div>`;

  // タブの見出し
  h += `<div class="tabs">`;
  PLAYER_TABS.forEach((tab, i) => {
    const newMark = tab.hasNew() ? newBadge() : "";
    h += `<span class="tab clickable${i === playerTab ? " active" : ""}" onclick="playerClickTab(${i})">${esc(tab.name)}${newMark}</span>`;
  });
  h += `</div>`;

  const tab = PLAYER_TABS[playerTab].id;
  if (tab === "status") h += statusPageHTML({}) + `<div class="note">拠点では装備を着けていない状態の値。装備は冒険中に拾う</div>`;
  else if (tab === "trait") h += traitPageHTML({});
  else if (tab === "material") h += playerMaterialHTML();
  else if (tab === "clan") h += playerClanHTML();
  else if (tab === "book") h += playerBookHTML();
  else if (tab === "tools") h += playerToolsHTML();
  else h += playerSkillHTML();

  setScreen("拠点 - プレイヤー", h, false);
  if (townAllocating) {
    setHint([["←→", "1ポイント"], ["↑↓", "10ポイント"], ["Enter / Esc", "決定"]]);
  } else if (tab === "status" || tab === "trait") {
    setHint([["←→", "タブ"], ["Esc / Q", "戻る"]]);
  } else {
    const enter = { material: "刻印を選ぶ", book: townCursor < BALANCE.bookSlots ? "書を選ぶ" : "交換する", skill: "ポイントを振る", tools: "道具を選ぶ" }[tab];
    setHint([["←→", "タブ"], ["↑↓", "選ぶ"], ["Enter / Space", enter], ["Esc / Q", "戻る"]]);
  }
}

// ステータスのページ:6つのステータスを「どこから来た数値か」に分けて表にする
//   拠点では装備を着けていないので eqMap は {}(刻印は効いていない値として (　) で出す)
function statusPageHTML(eqMap) {
  const src = statSources(eqMap);
  const total = getPlayerStats(eqMap);
  const cols = "2.6em 3em 3.4em 5em 4em 5.4em 1fr";
  // 増えていれば +、呪いで減っていれば赤
  const plus = v => (v > 0 ? `+${v}` : v < 0 ? span("down", String(v)) : span("dim", "―"));
  const signed = v => (v > 0 ? `+${v}` : String(v));
  // 効果の欄(%に換算したものなど)
  const effect = {
    hp: eqMap === equipped && screenMode !== "town" ? `今 ${playerHP}` : "",
    atk: `会心×${critMultiplier()}`,
    def: `軽減${fmt(defCutPercent(total))}%`,
    luk: `運${fmt(luckPercent(total))}%`,
    agl: `回避${fmt(evadePercent(total))}%`,
    crt: `会心${fmt(critChanceTotal(total))}%${critRolls() > 1 ? `(${critRolls()}回)` : ""}`,
  };
  let h = gridRow(false, cols, ["", "素", "装備", "刻印", "書・特性", "合計", "効果"].map(t => span("dim", t)));
  for (const key in STAT_NAMES) {
    const idle = src.materialIdle[key] !== 0 ? span("dim", `(${signed(src.materialIdle[key])})`) : "";
    const mat = src.material[key] !== 0 ? `${plus(src.material[key])}${idle ? " " + idle : ""}` : idle || span("dim", "―");
    h += gridRow(false, cols, [
      span("dim", STAT_NAMES[key]),
      src.base[key],
      plus(src.equip[key]),
      mat,
      plus(src.book[key] + src.trait[key]),
      // 合計の隣に、( )の刻印も効いたときの値
      `<b>${total[key]}</b>${src.materialIdle[key] !== 0 ? " " + span("dim", `(${total[key] + src.materialIdle[key]})`) : ""}`,
      `<span class="sub" style="white-space:nowrap">${esc(effect[key])}</span>`,
    ]);
  }
  const hasIdle = Object.values(src.materialIdle).some(v => v !== 0);
  if (hasIdle) {
    h += `<div class="list-gap"></div><div class="note">(　)の刻印は、その枠に装備を着けていないので今は効いていない`
       + `${screenMode === "town" ? "。ダンジョンで装備を着けると効く" : ""}。合計の(　)は、それも効いたときの値</div>`;
  }
  return h;
}

// 特性のページ:今ついている(解放されている)特性と、呪われた装備・刻印の効果だけを並べる
//   eqMap:着けている装備(拠点では {})
function traitPageHTML(eqMap = equipped) {
  let h = "";
  // 呪われた装備・刻印の効果(着けている装備と、装備を着けた枠の刻印の合計)
  const totals = effectTotals(eqMap);
  const ids = Object.keys(totals).filter(id => EFFECTS[id]).sort((a, b) => (EFFECTS[a].kind === "bless" ? 0 : 1) - (EFFECTS[b].kind === "bless" ? 0 : 1));
  if (ids.length > 0) {
    h += gridRow(false, "10em 1fr", [span("dim", "装備の効果"), span("dim", "")]);
    for (const id of ids) {
      const e = EFFECTS[id];
      h += gridRow(false, "10em 1fr", [span(e.kind, e.name), effectText({ id, value: totals[id] }, false).replace(/^.*?:/, "")]);
    }
    h += `<div class="list-gap"></div>`;
  }
  // セットしているけれど、装備を着けていない枠の刻印の効果(今は効いていない)
  const idle = mergeEffects(...Object.keys(base.materialSet).filter(s => !eqMap[s]).map(s => base.materialSet[s].effects));
  if (idle.length > 0) {
    h += gridRow(false, "10em 1fr", [span("dim", "効いていない効果"), span("sub", "刻印の枠に装備を着けると効く")]);
    for (const fx of idle) h += gridRow(false, "10em 1fr", [span("dim", EFFECTS[fx.id].name), span("dim", effectText(fx, false).replace(/^.*?:/, ""))]);
    h += `<div class="list-gap"></div>`;
  }
  // 一族のセット効果(冒険中だけ。拠点ではプレイヤー画面の「一族」タブに出す)
  if (inRunScreen()) {
    h += `<div class="list-title"><b>一族のセット効果</b></div>${clanSetHTML(eqMap, true)}<div class="list-gap"></div>`;
  }
  const books = setBooks().filter(b => (base.skillAlloc[b.id] || 0) >= b.maxPoints);
  if (books.length === 0) {
    return h + `<div class="note">ついている特性はない。セットした書にポイントを上限まで振ると、特性が解放される</div>`;
  }
  h += gridRow(false, "10em 1fr", [span("dim", "特性"), span("dim", "効果")]);
  for (const book of books) {
    let desc = esc(book.trait.desc);
    if (book.trait.guts && runStats && runStats.gutsUsed && screenMode !== "town") desc += span("down", "(この冒険ではもう使った)");
    h += gridRow(false, "10em 1fr", [
      span("trait-on", book.trait.name),
      `${desc}<div class="sub">${esc(book.name)}</div>`,
    ]);
    // 書3などで、下のレベルの書の特性もすべて発動しているもの
    if (book.trait.includeLower) {
      for (const lower of bookList.filter(x => x.group === book.group && x.level < book.level)) {
        h += gridRow(false, "10em 1fr", [
          span("trait-on", lower.trait.name),
          `${esc(lower.trait.desc)}<div class="sub">${esc(book.name)}の効果で発動</div>`,
        ]);
      }
    }
  }
  h += `<div class="list-gap"></div><div class="note">同じ種類の効果がいくつあっても、いちばん大きいものだけが効く(足し算はしない)</div>`;
  return h;
}

// プレイヤー画面の「刻印」タブ
function playerMaterialHTML() {
  let h = `<div class="note">枠ごとに1個セットできる。その枠に装備を着けているときだけ効果がある(所持 ${base.materials.length}個)</div>`;
  h += gridRow(false, "7em 3em 1fr", [span("dim", "枠"), span("dim", "所持"), span("dim", "セット中")]);
  townSlots().forEach((slot, i) => {
    const mat = base.materialSet[slot];
    const count = materialChoices(slot).length - 1; // この枠にセットできる刻印の数
    const newMark = hasNewMaterial(slotType(slot)) ? newBadge() : "";
    h += gridRow(i === townCursor, "7em 3em 1fr", [
      span("dim", EQUIP_SLOTS[slot]),
      span(count > 0 ? "" : "dim", `${count}個`),
      `${mat ? materialMarks(mat) + materialStatsHTML(mat) : span("dim", "―")}${newMark}`,
    ]);
  });
  h += `<div class="list-gap"></div><div class="note">一族のセット効果は、となりの「一族」タブで確かめられる</div>`;
  return h;
}

// プレイヤー画面の「一族」タブ:一族のセット効果(拠点では装備を着けていないので、セットしている刻印を全部数える)
function playerClanHTML() {
  let h = `<div class="note">同じ一族の固有装備から刻んだ刻印をそろえると付く。ここではセット中の刻印を全部数えている。ダンジョンでは、装備を着けている枠の刻印だけ数える</div>`;
  h += clanSetHTML({}, false);
  return h;
}

// 一族の名前を、一族の色で(例:ゴブリン一族)
function clanNameHTML(clan) {
  return `<span class="clan-tag" style="color:${clan.color}">${esc(clan.name)}</span>`;
}

// 一族の小さな札(短い名前。刻印の名前の横に出す。「呪」「浄化」の印と同じ形で、色は一族の色)
function clanBadgeHTML(clan) {
  return `<span class="clan-badge" style="background:${clan.color}">${esc(clan.short || clan.name)}</span>`;
}

// 一族ごとの刻印の数と、セット効果の一覧(数がそろっているものは明るく)
//   needEquip:true なら装備を着けている枠の刻印だけ数える(ダンジョン)/ false ならセット中の全部(拠点)
function clanSetHTML(eqMap, needEquip) {
  const counts = clanCounts(eqMap, needEquip);
  const cols = "8em 3em 1fr";
  let h = gridRow(false, cols, [span("dim", "一族"), span("dim", "数"), span("dim", "セット効果")]);
  for (const clan of clanList) {
    if (!clan.sets || clan.sets.length === 0) continue; // セット効果のない一族(はぐれ者)は出さない
    const n = counts[clan.id] || 0;
    const max = Math.max(...clan.sets.map(s => s.count));
    const sets = clan.sets.map(s => span(n >= s.count ? "trait-on" : "dim", `${s.count}個:${s.desc}`)).join("<br>");
    h += gridRow(false, cols, [n > 0 ? clanNameHTML(clan) : span("dim", clan.name), span(n > 0 ? "" : "dim", `${n}/${max}`), sets]);
  }
  return h;
}

// プレイヤー画面の「書」タブ:書の枠と、持っている書
function playerBookHTML() {
  let h = `<div class="note">${BALANCE.bookSlots}枠までセットできる。セットした書のスキルに、スキルポイントを振れる</div>`;
  base.bookSet.forEach((id, i) => {
    const book = id ? bookById(id) : null;
    const pts = book ? span("sub", `${base.skillAlloc[book.id] || 0} / ${book.maxPoints} pt`) : "";
    h += gridRow(i === townCursor, "4em 1fr 8em", [span("dim", `書${i + 1}`), book ? span("book", book.name) : span("dim", "―"), pts]);
  });
  h += `<div class="list-gap"></div><div class="list-title"><b>持っている書</b></div>`;
  const owned = ownedBooks();
  if (owned.length === 0) h += `<div class="note">まだありません(敵が低い確率で落とします)</div>`;
  for (const book of owned) {
    h += gridRow(false, "4em 1fr 8em", [span("dim", `×${base.books[book.id]}`), `${esc(book.name)}${base.bookNew[book.id] ? newBadge() : ""}`, ""]);
  }
  h += bookExchangeHTML(); // 書の交換(以前は制作にあった)
  return h;
}

// プレイヤー画面の「スキル」タブ:セットしている書のスキルと、振ったポイント
function playerSkillHTML() {
  const books = setBooks();
  if (books.length === 0) return `<div class="dim">書をセットすると、ここにスキルが出ます</div>`;
  let h = "";
  books.forEach((book, i) => {
    const pts = base.skillAlloc[book.id] || 0;
    const isSel = i === townCursor;
    const allocMark = isSel && townAllocating ? span("tag", "振り分け中") + " " : "";
    const traitOn = pts >= book.maxPoints;
    const pct = Math.min(100, pts / book.maxPoints * 100);
    const miniBar = `<span class="mini-bar"><span style="width:${pct}%;background:${traitOn ? "#ffae42" : "#5ac8fa"}"></span></span>`;
    // 次の段階と特性(名前の下に小さく)
    const next = nextTierPoints(book, pts);
    let sub = "";
    if (!traitOn) {
      const nextText = next < book.maxPoints ? `次:${next}pt で ${STAT_NAMES[book.stat]}+${book.perTier}` : `次:${next}pt で特性解放`;
      sub += `<div class="sub">${nextText}</div>`;
    }
    const traitName = traitOn ? span("trait-on", `特性「${book.trait.name}」解放中`) : `特性「${esc(book.trait.name)}」(${book.maxPoints}pt で解放)`;
    sub += `<div class="sub">${traitName} ${esc(book.trait.desc)}</div>`;
    h += gridRow(isSel, "1fr 90px 7.5em 5.5em", [
      `${allocMark}${span("book", book.name)}`,
      miniBar,
      `${pts} / ${book.maxPoints} pt`,
      span("up", `${STAT_NAMES[book.stat]}+${skillBonus(book, pts)}`),
    ]);
    h += `<div style="padding-left:1.6em;margin-bottom:10px">${sub}</div>`;
  });
  return h;
}

// 拠点:書の枠にセットする書を選ぶ画面
function drawBookPicker() {
  const slotIndex = townPickBook;
  let h = `<div class="list-title"><b>書${slotIndex + 1}</b> にセットする書</div>`;
  h += `<div class="note">外すと、その書に振っていたポイントは手元に戻ります</div>`;
  const choices = bookChoices();
  choices.forEach((book, i) => {
    const isSel = i === townPickCursor;
    if (!book) {
      h += gridRow(isSel, "1.4em 1fr 3em", ["", span("dim", "(何もセットしない)"), ""]);
      return;
    }
    const setIn = base.bookSet.indexOf(book.id);
    const mark = setIn === slotIndex ? span("tag", "E") : "";
    const other = setIn >= 0 && setIn !== slotIndex ? span("dim", ` (書${setIn + 1}にセット中)`) : "";
    h += gridRow(isSel, "1.4em 1fr 3em", [mark, `${span("book", book.name)}${other}${base.bookNew[book.id] ? newBadge() : ""}`, span("dim", `×${base.books[book.id]}`)]);
  });
  // 選んでいる書の説明
  const sel = choices[townPickCursor];
  if (sel) {
    h += `<div class="info">`;
    h += `<div>${STAT_NAMES[sel.stat]} が段階的に上がる(1段階 +${sel.perTier}、上限 ${sel.maxPoints}pt)</div>`;
    h += `<div>特性「${esc(sel.trait.name)}」:${esc(sel.trait.desc)}</div>`;
    h += `</div>`;
  }
  setScreen("拠点 - プレイヤー - 書", h, false);
  setHint([["↑↓", "選ぶ"], ["Enter / Space", "セットする"], ["Esc / Q", "戻る"]]);
}

// 拠点:制作(タブ:強化・合成・浄化・書の交換)
function drawTownCraft() {
  let h = `<div><b>素材</b>　${resourcesHTML(base.resources)}</div>`;
  h += `<div class="tabs">`;
  CRAFT_TABS.forEach((tab, i) => {
    h += `<span class="tab clickable${i === craftTab ? " active" : ""}" onclick="craftClickTab(${i})">${esc(tab.name)}</span>`;
  });
  h += `</div>`;

  const tab = CRAFT_TABS[craftTab].id;
  if (!craftType) h += craftTypeListHTML(tab);
  else if (tab === "enhance") h += craftEnhanceHTML();
  else if (tab === "purify") h += craftPurifyHTML();
  else if (tab === "salvage") h += craftSalvageHTML();
  else h += craftFuseHTML();

  setScreen("拠点 - 制作", h, false);
  if (craftType) {
    const enter = tab === "enhance" ? "強化する" : tab === "purify" ? "浄化する" : tab === "salvage" ? "解体する" : fuseFirst ? "合成する" : "1個目に選ぶ";
    setHint([["↑↓", "選ぶ"], ["Enter / Space", enter], ["Esc / Q", fuseFirst ? "1個目を選び直す" : "種類を選び直す"]]);
  } else {
    setHint([["←→", "タブ"], ["↑↓", "選ぶ"], ["Enter / Space", "種類を選ぶ"], ["Esc / Q", "戻る"]]);
  }
}

// 制作(強化・合成)の1段目:刻印の種類(頭・胴 …)の一覧
function craftTypeListHTML(tab) {
  const notes = {
    enhance: `強化する刻印の種類を選ぶ。種類ごとに使う素材が決まっている。効果つき(呪い・浄化)の刻印は素材が${BALANCE.specialEnhanceCostMultiplier}倍いる`,
    fuse: "同じ種類の刻印2個を1個にまとめる(性能は足し算)。強化値は +0 に戻るので、さらに強化できる。合成したものは、もう合成できない(解体はできる)。効果つき(呪い・浄化)どうしは合成できない",
    purify: `聖水を使って、刻印の呪いを消す(良い効果は残る)。呪い1つにつき聖水1個。聖水はエリートがまれに落とす(今 ${base.resources.holy || 0}個)`,
    salvage: `いらない刻印を解体して、その種類の強化に使う素材に戻す。戻るのは刻印の価値(強化に使った素材など)の${Math.round(BALANCE.salvageRate * 100)}%。合成したものも解体できる`,
  };
  let h = `<div class="note">${notes[tab]}</div>`;
  const third = { enhance: "使う素材", fuse: "合成できる", purify: "呪いつき", salvage: "戻る素材" }[tab];
  h += gridRow(false, "7em 3em 1fr", [span("dim", "種類"), span("dim", "所持"), span("dim", third)]);
  CRAFT_TYPES.forEach((type, i) => {
    const all = materialsOfType(type);
    let third;
    if (tab === "enhance" || tab === "salvage") {
      const r = RESOURCE_TYPES[ITEM_TYPES[type].resource];
      third = `<span style="color:${r.color}">${r.name}</span> ${span("sub", `(${base.resources[ITEM_TYPES[type].resource] || 0}個 持っている)`)}`;
    } else {
      const n = (tab === "purify" ? all.filter(hasCurse) : all.filter(canFuse)).length;
      third = n >= (tab === "purify" ? 1 : 2) ? `${n}個` : span("dim", `${n}個`);
    }
    h += gridRow(i === townCursor, "7em 3em 1fr", [
      span("dim", ITEM_TYPES[type].name),
      span(all.length > 0 ? "" : "dim", `${all.length}個`),
      third,
    ]);
  });
  return h;
}

// 制作の「強化」タブ:選んだ種類の刻印の一覧
function craftEnhanceHTML() {
  const type = craftType;
  const resId = ITEM_TYPES[type].resource;
  const res = RESOURCE_TYPES[resId];
  let h = `<div class="list-title"><b>${ITEM_TYPES[type].name}</b>の刻印を強化　`
        + `${span("sub", "使う素材")} <span style="color:${res.color}">${res.name}</span> ${base.resources[resId] || 0}個</div>`;
  const list = craftMatList();
  if (list.length === 0) return h + `<div class="note">この種類の刻印を持っていない(死んだときに装備を刻むと手に入る)</div>`;
  h += gridRow(false, "4.5em 1fr 5em", [span("dim", "強化"), span("dim", "性能"), span("dim", "必要")]);
  list.forEach((mat, i) => {
    const c = enhanceCost(mat);
    const costText = !c ? span("dim", "最大")
      : span((base.resources[c.id] || 0) >= c.cost ? "up" : "down", `${c.cost}個`);
    h += gridRow(i === craftPickCursor, "4.5em 1fr 5em", [
      materialMarks(mat) || span("dim", "+0"),
      `${materialStatsHTML(mat)}${materialSetText(mat)}`,
      costText,
    ]);
  });
  // 選んでいる刻印を強化すると、どのくらい上がるか
  const sel = list[craftPickCursor];
  const c = sel && enhanceCost(sel);
  h += `<div class="info">`;
  if (c) {
    h += `<div>+${sel.plus} → +${sel.plus + 1}</div><div class="sub">${enhanceRangeText(sel.stats)}</div>`;
    h += `<div class="sub">今の性能の ${BALANCE.enhanceMinPercent}〜${BALANCE.enhanceMaxPercent}% 上がる(大きいほど出にくい。運が高いと出やすい)</div>`;
  } else if (sel) {
    h += `<div class="sub">+${BALANCE.enhanceMax}(最大)まで強化済み。${sel.fused ? "" : "合成すると +0 に戻って、さらに強化できる"}</div>`;
  }
  h += `</div>`;
  return h;
}

// 制作の「合成」タブ:選んだ種類の刻印の一覧(1個目 → 2個目の順に選ぶ)
function craftFuseHTML() {
  const type = craftType;
  let h = `<div class="list-title"><b>${ITEM_TYPES[type].name}</b>の刻印を合成　`
        + span("sub", fuseFirst ? "2個目を選ぶ" : "1個目を選ぶ") + `</div>`;
  const list = craftMatList();
  if (list.length < 2 && !fuseFirst) return h + `<div class="note">合成できる刻印が2個ない(合成したものは、もう合成できない)</div>`;
  h += gridRow(false, "6em 1fr", [span("dim", "強化"), span("dim", "性能")]);
  list.forEach((mat, i) => {
    const first = mat === fuseFirst ? ` ${span("tag", "1個目")}` : "";
    // 2個目を選んでいるとき、組み合わせられないもの(効果つきどうし)は灰色にする
    const ng = fuseFirst && mat !== fuseFirst && !canFusePair(fuseFirst, mat);
    h += gridRow(i === craftPickCursor, "6em 1fr", [
      materialMarks(mat) || span("dim", "+0"),
      ng ? `<span class="dim">${esc(mat.name || "")} ${statsText(mat.stats)} (効果つきどうしは合成できない)</span>`
         : `${materialStatsHTML(mat)}${first}${materialSetText(mat)}`,
    ]);
  });
  // 2個目を選んでいるとき:合成するとどうなるか
  const sel = list[craftPickCursor];
  if (fuseFirst && sel && sel !== fuseFirst && canFusePair(fuseFirst, sel)) {
    h += `<div class="info"><div>合成すると ${span("tag", "合成")} ${materialStatsHTML({ name: `${fuseFirst.name}と${sel.name}`, sources: [...(fuseFirst.sources || []), ...(sel.sources || [])], stats: fusedStats(fuseFirst, sel), effects: mergeEffects(fuseFirst.effects, sel.effects) })}</div>`
       + `<div class="sub">強化値は +0 に戻る。もう合成はできない(解体はできる)</div></div>`;
  }
  return h;
}

// 制作の「浄化」タブ:選んだ種類の、呪いつきの刻印の一覧
function craftPurifyHTML() {
  let h = `<div class="list-title"><b>${ITEM_TYPES[craftType].name}</b>の刻印を浄化　`
        + `${span("sub", "聖水")} ${base.resources.holy || 0}個</div>`;
  const list = craftMatList();
  if (list.length === 0) return h + `<div class="note">この種類に呪いつきの刻印はない</div>`;
  h += gridRow(false, "6em 1fr 5em", [span("dim", "強化"), span("dim", "性能"), span("dim", "聖水")]);
  list.forEach((mat, i) => {
    const cost = purifyCost(mat);
    h += gridRow(i === craftPickCursor, "6em 1fr 5em", [
      materialMarks(mat) || span("dim", "+0"),
      `${materialStatsHTML(mat)}${materialSetText(mat)}`,
      span((base.resources.holy || 0) >= cost ? "up" : "down", `${cost}個`),
    ]);
  });
  // 浄化するとどうなるか
  const sel = list[craftPickCursor];
  if (sel) {
    const after = { ...sel, effects: sel.effects.filter(fx => EFFECTS[fx.id].kind !== "curse"), purified: true };
    h += `<div class="info"><div>浄化すると ${materialMarks(after)}${materialStatsHTML(after)}</div>`
       + `<div class="sub">呪いだけが消えて、良い効果は残る。強化に使う素材は${BALANCE.specialEnhanceCostMultiplier}倍のまま。効果つきどうしの合成はできないまま</div></div>`;
  }
  return h;
}

// 制作の「解体」タブ:選んだ種類の刻印の一覧と、解体すると戻る素材の数
function craftSalvageHTML() {
  const resId = ITEM_TYPES[craftType].resource;
  const res = RESOURCE_TYPES[resId];
  let h = `<div class="list-title"><b>${ITEM_TYPES[craftType].name}</b>の刻印を解体　`
        + `${span("sub", "戻る素材")} <span style="color:${res.color}">${res.name}</span></div>`;
  const list = craftMatList();
  if (list.length === 0) return h + `<div class="note">この種類の刻印を持っていない</div>`;
  h += gridRow(false, "6em 1fr 5em", [span("dim", "強化"), span("dim", "性能"), span("dim", "戻る")]);
  list.forEach((mat, i) => {
    h += gridRow(i === craftPickCursor, "6em 1fr 5em", [
      materialMarks(mat) || span("dim", "+0"),
      `${materialStatsHTML(mat)}${materialSetText(mat)}`,
      span("up", `${salvageValue(mat)}個`),
    ]);
  });
  h += `<div class="info"><div class="sub">解体すると、元に戻せない(確認が出る)。セットしている刻印なら、その枠から外れる</div></div>`;
  return h;
}

// その刻印を枠にセットしていれば「(頭にセット中)」
function materialSetText(mat) {
  const setIn = Object.keys(base.materialSet).find(s => base.materialSet[s] === mat);
  return setIn ? ` <span class="dim" style="white-space:nowrap">(${EQUIP_SLOTS[setIn]}にセット中)</span>` : "";
}

// プレイヤー画面の「書」タブの下:書の交換(行の番号は、書の枠のあとから数える)
function bookExchangeHTML() {
  let h = `<div class="list-gap"></div><div class="list-title"><b>書の交換</b>　${span("sub", `同じ書 ${BALANCE.bookExchangeCost}冊 → 1つ上のレベルの書 1冊`)}</div>`;
  const recipes = bookRecipes();
  if (recipes.length === 0) h += `<div class="note">交換できる書はありません</div>`;
  recipes.forEach((r, i) => {
    const have = base.books[r.from.id] || 0;
    const ok = have >= BALANCE.bookExchangeCost;
    h += gridRow(BALANCE.bookSlots + i === townCursor, "11em 1fr 6em", [
      span("book", r.to.name),
      `${span("dim", "←")} ${esc(r.from.name)} ×${BALANCE.bookExchangeCost}`,
      span(ok ? "up" : "dim", `所持 ${have}冊`),
    ]);
  });
  return h;
}

// 拠点:遊び方(説明の文は data/help.js)
function drawTownHelp() {
  let h = `<div class="tabs">`;
  HELP_PAGES.forEach((page, i) => {
    h += `<span class="tab clickable${i === helpTab ? " active" : ""}" onclick="helpClickTab(${i})">${esc(page.title)}</span>`;
  });
  h += `</div>`;
  for (const sec of HELP_PAGES[helpTab].sections) {
    h += `<div class="help-head">${esc(sec.head)}</div>`;
    for (const line of sec.lines) h += `<div class="help-line">${esc(line)}</div>`;
  }
  setScreen("拠点 - 遊び方", h, false);
  setHint([["←→", "タブ"], ["↑↓", "スクロール"], ["Esc / Q", "戻る"]]);
}

// 拠点:実績(タブごとに、取ったもの・まだのものを並べる。実績の中身は data/achievements.js)
function drawTownAchieve() {
  // タブの見出し(取った数つき)
  let h = `<div class="tabs">`;
  ACHIEVEMENT_TABS.forEach((tab, i) => {
    const list = achievementList.filter(a => a.tab === tab.id);
    const got = list.filter(a => base.achievements[a.id]).length;
    h += `<span class="tab clickable${i === achieveTab ? " active" : ""}" onclick="achieveClickTab(${i})">${esc(tab.name)} ${span("dim", `${got}/${list.length}`)}</span>`;
  });
  h += `</div>`;

  // 1つ2行:称号(取った日)/ 取り方と進み具合
  for (const a of achievementList.filter(x => x.tab === ACHIEVEMENT_TABS[achieveTab].id)) {
    const got = base.achievements[a.id];
    let name, desc;
    if (got) {
      name = `${span("up", a.name)}${typeof got === "string" ? ` ${span("dim", got.replace(/-/g, "/"))}` : ""}`;
      desc = esc(a.desc);
    } else if (a.secret) {
      name = span("dim", "？？？");
      desc = "ひみつの実績";
    } else {
      // 数える実績は、進み具合(37/100)を出す
      const p = achievementProgress(a);
      name = esc(a.name);
      desc = esc(a.desc) + (p ? `　${Math.min(p.now, p.goal).toLocaleString()}/${p.goal.toLocaleString()}` : "");
    }
    h += gridRow(false, "1.4em 1fr", [got ? span("up", "★") : span("dim", "・"), `${name}<br><span class="sub">${desc}</span>`]);
  }

  h += `<div class="list-gap"></div><div class="note">達成 ${achievementCount()}/${achievementList.length}　取っても強さは変わらない(記念)</div>`;
  setScreen("拠点 - 実績", h, false);
  setHint([["←→", "タブ"], ["↑↓", "スクロール"], ["Esc / Q", "戻る"]]);
}

// 拠点:設定
function drawTownSettings() {
  let h = "";
  townSettings().forEach((item, i) => {
    h += gridRow(i === townCursor, "20em 1fr", [esc(item.name), item.value()]);
  });
  h += `<div class="list-gap"></div><div class="note">${lastSavedAt ? `最終セーブ ${lastSavedAt.toLocaleString()}` : "まだセーブしていません"}</div>`;
  setScreen("拠点 - 設定", h, false);
  setHint([["↑↓", "選ぶ"], ["Enter / Space", "切り替え / 実行"], ["←→", "音量"], ["Esc / Q", "戻る"]]);
}

// 拠点:図鑑(タブ:敵・装備・書)
function drawTownDex() {
  // タブの見出し(発見数つき)
  let h = `<div class="tabs">`;
  DEX_TABS.forEach((tab, i) => {
    h += `<span class="tab clickable${i === dexTab ? " active" : ""}" onclick="dexClickTab(${i})">${esc(tab.name)} ${span("dim", `${dexCount(tab.id)}/${dexEntries(tab.id).length}`)}</span>`;
  });
  h += `</div>`;

  // 装備タブは、その下に種類(武器・盾・頭…)の小さいタブ(発見数つき)
  const tab = DEX_TABS[dexTab].id;
  if (tab === "equip") {
    h += `<div class="tabs sub-tabs">`;
    Object.keys(ITEM_TYPES).forEach((type, i) => {
      const all = dexEntries("equip").filter(e => e.slot === type);
      const found = all.filter(e => dexFound("equip", e)).length;
      h += `<span class="tab clickable${i === dexEquipType ? " active" : ""}" onclick="dexClickEquipType(${i})">${esc(ITEM_TYPES[type].name)} ${span("dim", `${found}/${all.length}`)}</span>`;
    });
    h += `</div>`;
  }

  // 武器を開いているときは、ジャンルの絞りこみの行(押すと次のジャンルへ)
  const isWeapon = tab === "equip" && Object.keys(ITEM_TYPES)[dexEquipType] === "weapon";
  if (isWeapon) {
    const weapons = dexEntries("equip").filter(e => e.slot === "weapon" && (!dexWeaponKind || e.kind === dexWeaponKind));
    const found = weapons.filter(e => dexFound("equip", e)).length;
    const kindName = dexWeaponKind ? WEAPON_KINDS[dexWeaponKind].name : "全部";
    h += `<div class="dex-filter clickable" onclick="dexCycleWeaponKind()">ジャンル:<b>${esc(kindName)}</b> ${span("dim", `${found}/${weapons.length}　(F か、ここを押すと次のジャンル)`)}</div>`;
  }

  // 左に一覧、右に選んでいるものの詳しい情報
  const entries = dexListEntries();
  let list = "";
  entries.forEach((e, i) => {
    const found = dexFound(tab, e);
    // 見つけていない武器は、ジャンル(剣・槍など)だけヒントに出す(ジャンルで絞りこんでいるときは出さない)
    const hint = tab === "equip" && e.kind && !dexWeaponKind ? span("dim", ` [${WEAPON_KINDS[e.kind].name}]`) : "";
    list += listRow(i === townCursor, found ? esc(e.name) : span("dim", "？？？") + hint);
  });
  const sel = entries[townCursor];
  const detail = !sel ? "" : dexFound(tab, sel) ? dexDetailHTML(tab, sel) : `<div class="dim">まだ見つけていない</div>`;
  h += `<div class="dex"><div class="dex-list">${list}</div><div class="dex-detail">${detail}</div></div>`;

  setScreen("拠点 - 図鑑", h, false);
  const typeHint = tab === "equip" ? [["[ ]", "装備の種類"], ...(isWeapon ? [["F", "ジャンル"]] : [])] : [];
  setHint([["←→", "タブ"], ...typeHint, ["↑↓", "選ぶ"], ["Esc / Q", "戻る"]]);
}

// 図鑑の詳しい情報
function dexDetailHTML(tab, e) {
  const row = (label, value) => `<div class="grid-row" style="grid-template-columns:6em 1fr"><span class="dex-label">${label}</span><span>${value}</span></div>`;
  const depthText = x => (x.maxDepth === null ? `地下${x.minDepth}階〜` : `地下${x.minDepth}〜${x.maxDepth}階`);
  let h = "";

  if (tab === "monster") {
    // 倒した数で、分かることが増える(BALANCE.dexRevealKills。town.js の dexMonsterLevel)
    const level = dexMonsterLevel(e);
    const kills = base.records.kills[e.id] || 0;
    const stars = n => `${"★".repeat(n)}${span("dim", "☆".repeat(5 - n))}`;
    h += `<div class="dex-name"><span style="color:${monsterColor(e)}">${esc(e.symbol)}</span> ${esc(e.name)}</div>`;
    h += row("倒した数", `${kills}体`);
    // 1体:強さ(★)・速さ・群れ・一族
    if (level >= 1) {
      h += row("一族", monsterClans(e).length ? monsterClans(e).map(clanNameHTML).join("・") : span("dim", "なし"));
      h += row("HP", stars(dexStars(e, "hp")));
      h += row("攻撃", e.attackMax > 0 ? stars(dexStars(e, "attack")) : span("dim", "攻撃してこない"));
      h += row("速さ", speedText(e.speed));
      if (e.pack) h += row("群れ", level >= 3 ? `${e.pack[0]}〜${e.pack[1]}匹の群れで出てくる` : "群れで出てくる");
    }
    // 5体:特徴・素材・固有装備
    if (level >= 2) {
      if (e.ability) h += row("特徴", MONSTER_ABILITIES[e.ability.type](e.ability));
      if (e.material) h += row("素材", `${RESOURCE_TYPES[e.material].name} ×${e.materialAmount || 1}`);
      const drops = equipmentList.filter(x => x.from === e.id && (!x.hidden || base.records.equipFound[x.id])) // 隠し装備は拾うまで出さない
        .map(x => base.records.equipFound[x.id] ? esc(x.name) : span("dim", "？？？"));
      h += row("固有装備", drops.length ? drops.join("、") : span("dim", "なし"));
    }
    // 20体:くわしい数字(出始める階での値)・出る階
    if (level >= 3) {
      const d = e.minDepth;
      const boost = layerOf(d).enemyBoost;
      const atkStep = (e.attackPerDepth || 0) * enemySteps(d, "attack");
      const hp = Math.round((e.hp + (e.hpPerDepth || 0) * enemySteps(d, "hp")) * boost);
      const atk = `${Math.round((e.attackMin + atkStep) * boost)}〜${Math.round((e.attackMax + atkStep) * boost)}`;
      h += row("くわしく", `地下${d}階で HP ${hp}・攻撃 ${atk} ${span("dim", "(深い階ほど強くなる)")}`);
      h += row("出る階", depthText(e));
    }
    // 次の段階まであと何体か
    if (level < BALANCE.dexRevealKills.length) {
      h += `<div class="dim" style="margin-top:6px">あと${BALANCE.dexRevealKills[level] - kills}体倒すと、もっと分かる</div>`;
    }
  } else if (tab === "equip") {
    // 「性能」「手に入れ方」「刻むと」の3つのまとまりに分けて、見出しを付ける
    const section = title => `<div class="dex-section">${title}</div>`;
    h += `<div class="dex-name">${span(ITEM_TYPES[e.slot].cls, ITEM_TYPES[e.slot].symbol)} ${esc(e.name)}</div>`;
    h += section("性能");
    h += row("種類", ITEM_TYPES[e.slot].name);
    if (e.kind) h += row("ジャンル", `${weaponKindBadgeHTML(e.kind)} ${span("dim", `(同じジャンルの武器の刻印は、この武器を着けていると +${Math.round(BALANCE.weaponKindBonus * 100)}%)`)}`);
    h += row("ステータス", `${statsHTML(e.stats)} ${span("dim", "(1〜5階)")}`);
    if (e.block) h += row("防ぐ", `向いている方向から飛んでくる矢・炎・属性の球のダメージ -${e.block}%`);
    if (e.effects && e.effects.length) h += row("効果", effectsHTML(e.effects, false));
    const m = monsterList.find(x => x.id === e.from);
    const from = e.from === "field" ? "床に落ちている"
      : base.records.seen[e.from] ? `${esc(m.name)}が落とす` : `${span("dim", "？？？")}が落とす`;
    h += section("手に入れ方");
    h += row("場所", from);
    h += row("出る階", depthText(e));
    h += row("拾った回数", `${base.records.equipFound[e.id]}回`);
    const clans = equipmentClans(e);
    if (e.materialName || clans.length) h += section("刻むと");
    if (e.materialName) h += row("刻印", `「${span("mat-name", e.materialName)}」になる`);
    if (clans.length) h += row("一族", `${clans.map(clanNameHTML).join("・")} ${span("dim", `(${clans.length > 1 ? "どちらの" : "この"}一族のセット効果にも数えられる)`)}`);
  } else {
    h += `<div class="dex-name">${span("book", "?")} ${esc(e.name)}</div>`;
    h += row("上がる", `${STAT_NAMES[e.stat]}(1段階 +${e.perTier})`);
    h += row("上限", `${e.maxPoints}pt(最大 +${maxSkillTiers(e) * e.perTier})`);
    h += row("特性", `${esc(e.trait.name)}`);
    h += `<div class="dim" style="padding-left:6em">${esc(e.trait.desc)}</div>`;
    const froms = bookFrom(e);
    h += row("手に入れ方", froms.length ? "敵がまれに落とす" : `「プレイヤー」→「書」で交換(1つ下の書 ×${BALANCE.bookExchangeCost})`);
    h += row("持っている数", `${base.books[e.id] || 0}冊`);
  }
  // 紹介文(monsters.js・equipment.js・books.js の desc。書いていなければ出さない)
  if (typeof e.desc === "string" && e.desc !== "") {
    h += `<div class="list-gap"></div><div class="note">${esc(e.desc).replace(/\n/g, "<br>")}</div>`;
  }
  return h;
}

// 速さの説明
function speedText(speed) {
  if (speed === 1) return "普通";
  if (speed > 1) return `速い(1ターンに${speed}回動く)`;
  return `遅い(${Math.round(1 / speed)}ターンに1回動く)`;
}

// 拠点:まだ中身のない画面(TOWN_MENU に足したけれど、画面をまだ作っていないもの)
function drawTownComingSoon() {
  const item = TOWN_MENU.find(m => m.id === townPage);
  setScreen(`拠点 - ${item.name}`, `<div class="dim">準備中です</div>`, false);
  setHint([["Esc / Q", "戻る"]]);
}

// 拠点:枠にセットする刻印を選ぶ画面
function drawMaterialPicker() {
  const slot = townPickSlot;
  let h = `<div class="list-title"><b>${EQUIP_SLOTS[slot]}</b> にセットする刻印</div>`;
  h += `<div class="note">${ITEM_TYPES[slotType(slot)].name}の装備を着けているときだけ効果があります(性能の高い順)</div>`;
  materialChoices(slot).forEach((mat, i) => {
    const isSel = i === townPickCursor;
    if (!mat) {
      h += gridRow(isSel, "1.4em 1fr", ["", span("dim", "(何もセットしない)")]);
      return;
    }
    const setIn = Object.keys(base.materialSet).find(s => base.materialSet[s] === mat);
    const mark = setIn === slot ? span("tag", "E") : "";
    const other = setIn && setIn !== slot ? span("dim", ` (${EQUIP_SLOTS[setIn]}にセット中)`) : "";
    h += gridRow(isSel, "1.4em 1fr", [mark, `${materialMarks(mat)}${materialStatsHTML(mat)}${other}${mat.isNew ? newBadge() : ""}`]);
  });
  setScreen("拠点 - プレイヤー - 刻印", h, false);
  setHint([["↑↓", "選ぶ"], ["Enter / Space", "セットする"], ["Esc / Q", "戻る"]]);
}
