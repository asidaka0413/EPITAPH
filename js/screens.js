// 画面を描くところ(ダンジョン・持ち物・キャンプ・リザルトなど)
// index.html から <script src> で読み込まれる(読み込む順番は index.html に書いてある)

// ==================== 描画 ====================
// 冒険中の画面か(ダンジョン・持ち物・道を選ぶ・キャンプ)。ステータス欄と装備欄を出す画面
function inRunScreen() {
  return ["dungeon", "inventory", "route", "camp", "swap"].includes(screenMode);
}

function render() {
  const inDungeon = inRunScreen();
  document.getElementById("status-panel").style.display = inDungeon ? "" : "none";
  document.getElementById("equip-panel").style.display = inDungeon ? "" : "none";

  if (screenMode === "town") {
    drawTown();
  } else if (screenMode === "result") {
    drawResult();
  } else if (screenMode === "refine") {
    drawRefine();
  } else if (screenMode === "inventory") {
    drawInventory();
  } else if (screenMode === "route") {
    drawRoute();
  } else if (screenMode === "camp") {
    drawCamp();
  } else if (screenMode === "swap") {
    drawSwap();
  } else {
    drawDungeon();
  }
  if (inDungeon) {
    drawStatus();
    drawEquip();
  }
  drawLog();
  drawQuestPanel(); // 右側の「依頼」欄(いつでも出す)
  drawSettings();
  drawDebug();
  updateTooltip(); // マウスを合わせたままでも、敵が動いたら詳細ウィンドウの中身を更新する
}

// メイン画面の中身を差し替える(isMap が true ならマップ用の見た目)
function setScreen(title, html, isMap) {
  document.getElementById("screen-title").textContent = title;
  const el = document.getElementById("screen");
  el.className = isMap ? "map-mode" : "text-mode";
  el.innerHTML = isMap ? html : `<div class="text-body">${html}</div>`;
  // タブの列が横に長いときは、選んでいるタブが見えるように横スクロールする(縦のスクロールは動かさない)
  for (const tabs of el.querySelectorAll(".tabs")) {
    const act = tabs.querySelector(".tab.active");
    if (!act) continue;
    const margin = 24; // となりのタブが少し見えるように、端から少し余白を空ける
    if (act.offsetLeft - margin < tabs.scrollLeft) tabs.scrollLeft = act.offsetLeft - margin;
    else if (act.offsetLeft + act.offsetWidth + margin > tabs.scrollLeft + tabs.clientWidth) {
      tabs.scrollLeft = act.offsetLeft + act.offsetWidth + margin - tabs.clientWidth;
    }
  }
  // 選んでいる行が見えるように、一覧が長いときはスクロールする
  const sel = el.querySelector(".sel");
  if (sel) sel.scrollIntoView({ block: "nearest" });
}

// 表の形の一覧の1行(列がそろう)。先頭にカーソル(▶)の列がつく
//   cols:各列の幅(CSS の grid-template-columns の書き方。"7em 1fr" など) / cells:各列の中身(HTML)
function gridRow(isSel, cols, cells) {
  return `<div class="grid-row${isSel ? " sel" : ""}" style="grid-template-columns:1.2em ${cols}">`
       + `${cursorMark(isSel)}${cells.map(c => `<span>${c}</span>`).join("")}</div>`;
}

// 画面下の操作説明。keys は [["キー", "説明"], ...] の形
function setHint(keys) {
  document.getElementById("hint").innerHTML =
    keys.map(([k, desc]) => `<span><kbd>${esc(k)}</kbd> ${esc(desc)}</span>`).join("");
}

// 床に隣り合っている壁だけ表示する(何もない岩盤は空白にして、部屋と通路を見やすくする)
function isWallVisible(x, y) {
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const row = map[y + dy];
      if (row && row[x + dx] !== undefined && row[x + dx] !== "#") return true;
    }
  }
  return false;
}

// マップの1マスを、記号と色(CSS のクラス名)にする。何も描かないマスは null
function tileAt(x, y) {
  if (x === px && y === py) return ["@", "player"];
  if (!canSeeTile(x, y)) return rememberedTileAt(x, y); // 盲目などで見えないマス
  const m = monsterAt(x, y);
  if (m) {
    if (m.disguised) return ["&", "chest"]; // 宝箱に化けたミミック(本物の宝箱と同じ見た目)
    if (m.primed) return [m.data.symbol, "monster primed", null]; // 膨らんだ爆ぜ虫(次に爆発する)
    if (m.elite) return [m.data.symbol, `monster elite${m.dormant ? " dormant" : ""}`, BALANCE.eliteColor]; // エリートは金色・下線(眠っている墓守は薄く)
    return [m.data.symbol, "monster", monsterColor(m.data)]; // 3つ目は敵ごとの色(一族があれば一族の色)
  }
  const ball = ballAt(x, y);
  if (ball) return ["•", "ball", ELEMENT_DATA[ball.element].color]; // ドラゴンの属性の球(属性の色)
  if (flameAt(x, y)) return ["*", "flame"];
  if (stairs && x === stairs.x && y === stairs.y) return [">", stairsSealed() ? "stairs-sealed" : "stairs"];
  if (graveAt(x, y)) return ["†", "grave"]; // 前の自分の墓
  if (chestAt(x, y)) return ["&", "chest"]; // 宝箱
  if (treasureSpotAt(x, y)) return ["X", "treasure"]; // 宝の地図の印
  const it = itemAt(x, y);
  if (it) {
    if (it.book) return ["?", "book"];
    if (it.treasureMap) return ["{", "map-item"]; // 宝の地図
    if (it.lump) return ["%", "lump"]; // 謎の塊
    const info = ITEM_TYPES[it.equip.slot];
    return [info.symbol, info.cls];
  }
  const hz = hazardAt(x, y);
  if (hz) return [HAZARD_TYPES[hz].symbol, HAZARD_TYPES[hz].cls]; // 毒沼・マグマ
  if (map[y][x] === "#") return isWallVisible(x, y) ? ["#", "wall"] : null;
  return [".", "floor"];
}

// 今は見えないマス:一度見たことがあれば、地形(壁・床・階段・墓・ダメージ床)だけを薄く描く(クラス mem)。敵・物は描かない
function rememberedTileAt(x, y) {
  if (!seenMap[y] || !seenMap[y][x]) return null;
  if (stairs && x === stairs.x && y === stairs.y) return [">", "stairs mem"];
  if (graveAt(x, y)) return ["†", "grave mem"];
  const hz = hazardAt(x, y);
  if (hz) return [HAZARD_TYPES[hz].symbol, `${HAZARD_TYPES[hz].cls} mem`];
  if (map[y][x] === "#") return isWallVisible(x, y) ? ["#", "wall mem"] : null;
  return [".", "floor mem"];
}

// F キーで切り替え。true のあいだ、敵の視界(薄い黄色)と攻撃が届く範囲(薄い赤)をマップに出す
let threatView = false;

function drawDungeon() {
  updateSeen(); // 今見えているマスを「見たことがある」にする(盲目などのとき、地形を薄く残すため)
  const danger = dangerTiles(); // ブレス・大技・突進・死骸の爆発の、当たる範囲(赤く光らせる)
  // F キー:全部の敵の視界と攻撃範囲を集める(盲目などのときは、見えている敵だけ)
  const vision = new Set(), attack = new Set();
  if (threatView) {
    for (const m of monsters.filter(m => canSeeTile(m.x, m.y))) {
      monsterVisionTiles(m).forEach(t => vision.add(t));
      monsterAttackTiles(m).forEach(t => attack.add(t));
    }
  }
  // 重なったら、ブレスの範囲 > 攻撃範囲 > 視界 の順に優先。見えないマスには出さない
  const overlay = (key, x, y) => !canSeeTile(x, y) ? "" : danger.has(key) ? " danger" : attack.has(key) ? " atk" : vision.has(key) ? " vis" : "";
  let html = "";
  for (let y = 0; y < BALANCE.mapHeight; y++) {
    for (let x = 0; x < BALANCE.mapWidth; x++) {
      const tile = tileAt(x, y);
      const cls = tile && `${tile[1]}${overlay(`${x},${y}`, x, y)}`;
      if (!tile) html += " ";
      // 壁は文字ではなく、マスいっぱいに塗りつぶしたブロックで描く(縦にもすき間なくつながるように)。見えない壁は薄く(mem)
      else if (tile[1] === "wall") html += `<span class="wall-block"> </span>`;
      else if (tile[1] === "wall mem") html += `<span class="wall-block mem"> </span>`;
      else if (tile[2]) html += `<span class="${cls}" style="color:${tile[2]}">${esc(tile[0])}</span>`;
      else html += span(cls, tile[0]);
    }
    html += "\n";
  }
  setScreen(depthLabel(depth), html, true);
  setHint([["WASD / ↑↓←→", "移動・攻撃"], ["H", "回復薬"], ["E", "持ち物"], ["Z / .", "待つ"], ["F", `敵の視界・攻撃範囲 ${threatView ? "ON" : "OFF"}`], ["X 長押し", "自害"]]);
}

// ゲージ(ratio は 0〜1)
function bar(ratio, color, height) {
  const pct = Math.max(0, Math.min(1, ratio)) * 100;
  return `<div class="bar" style="height:${height}px"><div class="bar-fill" style="width:${pct}%;background:${color}"></div></div>`;
}

function statCell(label, value, sub) {
  return `<div><span class="dim">${label}</span> ${value}${sub ? ` <span class="dim">(${sub})</span>` : ""}</div>`;
}

function drawStatus() {
  const s = getPlayerStats();
  const hpRatio = playerHP / maxHP;
  const hpColor = hpRatio > 0.5 ? "#4cd964" : hpRatio > 0.25 ? "#ffcc00" : "#ff3b30";
  let h = "";
  h += `<div class="status-top"><span>${layerOf(depth).name} 地下 <b>${depth}</b> 階</span><span>Lv.<b>${base.level}</b></span><span>回復薬 ×${potions}</span>`;
  if (floorRoute.id !== "normal") h += span("route", floorRoute.name); // この階に来るときに選んだ道
  for (const label of buffLabels()) h += span("up", label);           // 道具の効き目(砥石・狂熱・忍び足)
  if (stairsSealed()) h += span("down", "階段 封印中");
  for (const kind in playerDots) h += span(DOT_TYPES[kind].cls, `${DOT_TYPES[kind].name} ${playerDots[kind].dmg}×${playerDots[kind].turns}`);
  if (playerWeak) h += span("poison", `衰弱 ${playerWeak.turns}`);
  if (playerSlow) h += span("poison", `鈍足 ${playerSlow.turns}`);
  if (playerBlind) h += span("blind", `盲目 ${playerBlind.turns}`);
  if (equipped.shield && equipped.shield.block) h += span("shield", `盾の向き ${facingArrow()}(防${shieldBlockPercent()}%)`);
  if (giveUpProgress() > 0) h += span("down", `自害… ${Math.round(giveUpProgress() * 100)}%`);
  h += `<span class="dim">刻める ${refineCount()}個</span></div>`;
  h += `<div>HP ${playerHP} / ${maxHP}</div>` + bar(hpRatio, hpColor, 10);
  h += `<div class="dim">XP ${base.xp} / ${xpNeeded(base.level)}</div>` + bar(base.xp / xpNeeded(base.level), "#5ac8fa", 4);
  h += `<div class="stats-grid">`;
  h += statCell("ATK", s.atk);
  h += statCell("DEF", s.def, `軽減${fmt(defCutPercent(s))}%`);
  h += statCell("LUK", s.luk, `運${fmt(luckPercent(s))}%`);
  h += statCell("AGL", s.agl, `回避${fmt(evadePercent(s) * slowMultiplier())}%`); // 鈍足のあいだは下がる
  // 会心:抽選が複数回なら「実際に出る確率」と抽選回数を出す
  const rolls = critRolls();
  h += statCell("CRT", s.crt, `会心${fmt(critChanceTotal(s))}%${rolls > 1 ? `・${rolls}回抽選` : ""}`);
  h += `</div>`;
  document.getElementById("status").innerHTML = h;
}

// 画面右上:装備中の装備の一覧
function drawEquip() {
  let h = "";
  for (const slot in EQUIP_SLOTS) {
    const eq = equipped[slot];
    const mat = base.materialSet[slot];
    // 右のパネルは狭いので、個体差(%)は出さない(持ち物画面で見られる)
    let content = eq ? `${eq.cursed ? `<span class="curse-tag">呪</span> ` : ""}${rarityTagHTML(eq)}${esc(equipName(eq))} ${span("dim", statsText(eq.stats))}`
                     + `${eq.block ? " " + span("shield", `防${eq.block}%`) : ""}` : span("dim", "―");
    if (eq && eq.effects && eq.effects.length) content += `<div class="equip-mat">${effectsHTML(eq.effects, true)}</div>`;
    // 刻印は下の行に:装備を着けていれば効果あり(水色)、着けていなければ無効(灰色)
    if (mat) {
      const matText = `◆ ${mat.name ? `${mat.name} ` : ""}${mat.plus > 0 ? `+${mat.plus} ` : ""}${statsText(mat.stats)}`;
      const matFx = mat.effects && mat.effects.length ? " " + (eq ? effectsHTML(mat.effects, true) : span("dim", mat.effects.map(fx => effectText(fx, true)).join(" "))) : "";
      const badges = materialClans(mat).map(c => " " + clanBadgeHTML(c)).join(""); // 一族の札
      content += `<div class="equip-mat">${eq ? span("mat", matText) : span("dim", `${matText}(装備なしで無効)`)}${badges}${matFx}</div>`;
    }
    h += `<div class="equip-row"><span class="dim">${EQUIP_SLOTS[slot]}</span><span>${content}</span></div>`;
  }
  document.getElementById("equip").innerHTML = h;
}

function drawInventory() {
  // タブの見出し
  let h = `<div class="tabs">`;
  INV_TABS.forEach((tab, i) => {
    h += `<span class="tab${i === invTab ? " active" : ""}">${esc(tab.name)}</span>`;
  });
  h += `</div>`;

  const tab = INV_TABS[invTab].id;
  if (tab === "equip") h += invPickSlot ? inventoryEquipPickerHTML() : inventoryEquipHTML();
  else if (tab === "tool") h += inventoryToolHTML();
  else if (tab === "status") h += statusPageHTML(equipped);
  else if (tab === "trait") h += traitPageHTML();
  else if (tab === "material") {
    h += `<div class="note">素材は手に入れた時点で拠点に届いていて、死んでもなくならない。拠点の「制作」で刻印の強化に使う(聖水は呪いの浄化に使う)</div>`;
    for (const id in RESOURCE_TYPES) {
      const r = RESOURCE_TYPES[id];
      const gained = runStats && runStats.resources[id] ? span("up", `この冒険で +${runStats.resources[id]}`) : "";
      h += gridRow(false, "7em 5em 1fr", [`<span style="color:${r.color}">${r.name}</span>`, `${base.resources[id] || 0}個`, gained]);
    }
  }
  else h += `<div class="dim">まだ何もありません</div>`;

  setScreen("持ち物", h, false);
  if (invPickSlot) {
    setHint([["↑↓", "選ぶ"], ["Enter / Space", "装備する"], ["Esc / Q", "戻る"]]);
  } else if (tab === "equip") {
    setHint([["←→", "タブ"], ["↑↓", "枠を選ぶ"], ["Enter / Space", "装備を選ぶ"], ["E / Q", "閉じる"]]);
  } else if (tab !== "tool") {
    setHint([["←→", "タブ"], ["E / Q", "閉じる"]]);
  } else {
    setHint([["←→", "タブ"], ["↑↓", "選ぶ"], ["Enter / Space", "使う"], ["E / Q", "閉じる"]]);
  }
}

// 持ち物画面の「装備」タブ:装備枠の一覧
function inventoryEquipHTML() {
  let h = "";
  h += gridRow(false, "7em 3em 1fr", [span("dim", "枠"), span("dim", "所持"), span("dim", "装備中")]);
  Object.keys(EQUIP_SLOTS).forEach((slot, i) => {
    const eq = equipped[slot];
    const count = equipChoices(slot).length - 1; // この枠に着けられる装備の数
    h += gridRow(i === invCursor, "7em 3em 1fr", [
      span("dim", EQUIP_SLOTS[slot]),
      span(count > 0 ? "" : "dim", `${count}個`),
      eq ? equipHTML(eq) : span("dim", "―"),
    ]);
  });
  if (runPickups.length === 0) {
    h += `<div class="info dim">まだ装備を拾っていない</div>`;
  }
  return h;
}

// 持ち物画面の「装備」タブ:枠を選んだあとの、着けられる装備の一覧
function inventoryEquipPickerHTML() {
  const slot = invPickSlot;
  let h = `<div class="list-title"><b>${EQUIP_SLOTS[slot]}</b> に着ける装備</div>`;
  const choices = equipChoices(slot);

  // 選んでいる装備に付け替えたら、ステータスがどう変わるか
  //   装備がたくさんあっても見えるように、一覧より上に出す
  const sel = choices[invPickCursor];
  const current = equipped[slot];
  h += `<div class="info-top">`;
  h += `<div><span class="dim">今の装備:</span> ${current ? equipHTML(current) : span("dim", "なし")}</div>`;
  h += `<div><span class="dim">付け替えると:</span> ${statDiffHTML(getPlayerStats(), getPlayerStats(planEquip(slot, sel)))}</div>`;
  if (current && current.cursed) h += `<div class="curse">今の装備は呪われていて外せない</div>`;
  else if (sel && sel.cursed && !equippedSlotOf(sel)) h += `<div class="curse">呪われている。着けると、この冒険の間は外せない</div>`;
  h += `</div>`;

  choices.forEach((eq, i) => {
    const isSel = i === invPickCursor;
    if (!eq) {
      h += gridRow(isSel, "1.4em 1fr", ["", span("dim", "(外す)")]);
      return;
    }
    const where = equippedSlotOf(eq);
    const mark = where === slot ? span("tag", "E") : "";
    const other = where && where !== slot ? span("dim", ` (${EQUIP_SLOTS[where]}に装備中)`) : "";
    h += gridRow(isSel, "1.4em 1fr", [mark, equipHTML(eq, other)]);
  });
  if (choices.length === 1) h += `<div class="note">この枠に着けられる装備を持っていない</div>`;
  return h;
}

// 持ち物画面の「道具」タブ
function inventoryToolHTML() {
  const list = invTabItems();
  if (list.length === 0) return `<div class="dim">道具を持っていない</div>`;
  let h = "";
  list.forEach((tool, i) => {
    if (tool.kind === "potion") {
      h += gridRow(i === invCursor, "7em 3em 1fr", [
        `${span("potion", "!")} 回復薬`, `×${potions}`, span("dim", `HPを${potionHealAmount()}回復する。毒・やけど・盲目も治る`)]);
    } else if (tool.kind === "tool") {
      // 道具屋で買って持ってきた道具
      const t = runTools[tool.index];
      const data = TOOL_DATA[t.id];
      const name = data.name + (t.mapDepth ? `(地下${t.mapDepth}階)` : ""); // 宝の地図は書かれた階も
      h += gridRow(i === invCursor, "7em 3em 1fr", [esc(name), `×${t.count}`, span("dim", data.desc)]);
    } else if (tool.kind === "lump") {
      // 謎の塊(使えない。キャンプで鑑定される)
      h += gridRow(i === invCursor, "7em 3em 1fr", [`${span("lump", "%")} 謎の塊`, `×${runLumps}`,
        span("dim", "キャンプに入ると鑑定されて、レア度つきの装備になる。鑑定する前に死ぬとなくなる")]);
    }
  });
  return h;
}

// 宝の地図を拾うとき、道具の枠がいっぱい:どの道具と入れ替えるか選ぶ画面
function drawSwap() {
  let h = `<div>宝の地図(地下${swapMapItem ? swapMapItem.treasureMap.mapDepth : "?"}階)を見つけた。</div>`;
  h += `<div class="note">道具の枠がいっぱい(${BALANCE.carrySlots}枠)。捨てる道具を選ぶと、かわりに地図を拾う(捨てた道具はなくなる)。拾わなければ、地図は床に残る</div>`;
  runTools.forEach((t, i) => {
    h += gridRow(i === swapCursor, "4em 1fr", [span("dim", `枠${i + 1}`), `${esc(toolLabel(t))} を捨てる`]);
  });
  h += gridRow(swapCursor === runTools.length, "4em 1fr", ["", span("dim", "(拾わない)")]);
  setScreen("宝の地図", h, false);
  setHint([["↑↓", "選ぶ"], ["Enter / Space", "決定"], ["Esc / Q", "拾わない"]]);
}

// 階段を降りたとき:次の階への道を選ぶ画面
function drawRoute() {
  let h = "";
  h += `<div>階段を降りると、道が分かれていた。</div>`;
  h += `<div class="note">どの道で進むか選ぶ。道の効果は次の1階だけ。このあとキャンプで一息つける</div>`;
  routeChoices.forEach((r, i) => {
    h += gridRow(i === routeCursor, "8em 1fr", [`<b>${esc(r.name)}</b>`, span("sub", r.desc())]);
  });
  setScreen("分かれ道", h, false);
  setHint([["↑↓", "選ぶ"], ["Enter / Space", "この道を選んでキャンプへ"]]);
}

function drawCamp() {
  if (campPicking) {
    drawCampEquipPicker();
    return;
  }
  let h = "";
  h += `<div>階段の途中で、キャンプを見つけた。</div>`;
  const route = nextRoute && nextRoute.id !== "normal" ? `(${nextRoute.name})` : "";
  h += `<div class="note">ひとつだけ選んで、地下${nextDepth()}階へ進もう。${esc(route)}</div>`;
  CAMP_OPTIONS.forEach((opt, i) => {
    const ok = !opt.available || opt.available();
    const name = ok ? `<b>${esc(opt.name)}</b>` : span("dim", opt.name);
    h += gridRow(i === campCursor, "8em 1fr", [name, span("sub", opt.desc())]);
  });
  setScreen("キャンプ", h, false);
  setHint([["↑↓", "選ぶ"], ["Enter / Space", "決定して次の階へ"], ["E", "持ち物"]]);
}

// キャンプ:強化する装備を選ぶ画面
function drawCampEquipPicker() {
  let h = `<div class="list-title"><b>強化する装備を選ぶ</b></div>`;
  h += `<div class="note">強化前の性能の${BALANCE.enhanceMinPercent}〜${BALANCE.enhanceMaxPercent}%ぶん上がる。刻むときは、強化する前の性能になる</div>`;
  const list = campEquipList();
  list.forEach((eq, i) => {
    const where = equippedSlotOf(eq);
    h += gridRow(i === campPickCursor, "7em 1.4em 1fr", [
      span("dim", where ? EQUIP_SLOTS[where] : `${ITEM_TYPES[eq.slot].name}(予備)`),
      where ? span("tag", "E") : "",
      equipHTML(eq),
    ]);
  });
  const sel = list[campPickCursor];
  if (sel) {
    h += `<div class="info"><div>${esc(equipName(sel))} → +${(sel.plus || 0) + 1}</div>`
       + `<div class="sub">${enhanceRangeText(sel.stats, sel.baseStats)}</div></div>`;
  }
  setScreen("キャンプ - 装備を強化", h, false);
  setHint([["↑↓", "選ぶ"], ["Enter / Space", "強化して次の階へ"], ["Esc / Q", "戻る"]]);
}

// 死んだときのリザルト画面(冒険の記録)
function drawResult() {
  const r = lastRunResult;
  const star = on => (on ? ` ${span("new", "新記録")}` : "");
  const row = (label, value) => `<div><span class="result-label">${label}</span>${value}</div>`;

  let h = r.cleared
    ? `<div class="result-title">${span("up", `地下${r.depth}階を踏破した！`)}</div><br>`
    : r.killedBy === "自害"
      ? `<div class="result-title">${esc(depthLabel(r.depth))}で、自ら命を絶った</div><br>`
      : `<div class="result-title">${esc(depthLabel(r.depth))}で ${span("monster", r.killedBy || "何か")} に倒された</div><br>`;
  h += row("到達した階", `地下${r.depth}階${star(r.newBestDepth)}　${span("dim", `(最高 地下${base.records.bestDepth}階)`)}`);
  h += row("ターン数", r.turns);
  // 倒した敵(種類ごと。monsters.js の順に並べる)
  const killList = monsterList.filter(m => r.kills[m.id]).map(m => `${m.name} ×${r.kills[m.id]}`).join(" / ");
  h += row("倒した敵", `${r.totalKills}体${killList ? `　${span("dim", killList)}` : ""}`);
  h += row("与えたダメージ", `${r.damageDealt}　${span("dim", `最大の一撃 ${r.bestHit}${r.bestHitCrit ? "・会心" : ""}`)}${star(r.newBestHit)}`);
  h += row("受けたダメージ", r.damageTaken);
  const lvText = r.endLevel > r.startLevel ? `Lv.${r.startLevel} → Lv.${r.endLevel}` : `Lv.${r.endLevel}`;
  h += row("経験値", `+${r.xpGained}　${span("dim", lvText)}`);
  h += row("倒したエリート", r.elitesKilled > 0 ? `${r.elitesKilled}体　${span("up", `刻める数 +${r.elitesKilled}`)}` : span("dim", "0体"));
  h += row("拾った装備", `${r.pickups}個　${span("dim", `(刻める数 ${refineCount()})`)}`);
  h += row("手に入れた素材", Object.keys(r.resources).length ? resourcesHTML(r.resources) : span("dim", "なし"));
  h += row("依頼の報酬", r.gold ? span("up", `${r.gold}G`) : span("dim", "なし"));
  if (!r.cleared && base.grave) {
    const g = base.grave;
    h += row("墓", `${esc(depthLabel(g.depth))}に墓が建った　${span("dim", g.relic ? `遺品:${equipName(g.relic)}` : "遺品なし")}`);
  }
  h += row("手に入れた書", r.books.length ? r.books.map(n => span("book", n)).join(" ") : span("dim", "なし"));
  h += `<br><div class="dim">これまで:冒険 ${base.records.runs}回 / 倒した敵 ${base.records.totalKills}体</div>`;
  setScreen("冒険の記録", h, false);
  setHint([["Enter / Space", refinablePickups().length > 0 ? "刻む装備を選ぶ" : "拠点へ"]]);
}

function drawRefine() {
  if (refineDiscardFor) { drawRefineDiscard(); return; }
  let h = "";
  h += `<div>この冒険で拾った装備から、あと <b>${refineLeft}つ</b> 刻めます。</div>`;
  h += `<div class="note">刻むと、性能の${fmt(BALANCE.materialRatio * 100)}%が刻印として拠点に残ります(キャンプで強化した分は入りません)</div>`;
  // タブ:装備中 / 持ち物(それぞれの数つき)
  h += `<div class="tabs">`;
  REFINE_TABS.forEach((tab, i) => {
    h += `<span class="tab${i === refineTab ? " active" : ""}">${esc(tab.name)} ${span("dim", `${refineTabCount(i)}`)}</span>`;
  });
  h += `</div>`;
  const worn = REFINE_TABS[refineTab].id === "worn";

  // 持ち物タブ・部位を選ぶ前:部位(武器・盾・頭 …)の一覧と、それぞれ何個持っているか
  if (!worn && !refineType) {
    if (refineTabCount(refineTab) === 0) h += `<div class="note">着けていない装備は持っていない</div>`;
    h += gridRow(false, "7em 3em 1fr", [span("dim", "部位"), span("dim", "所持"), span("dim", "")]);
    Object.keys(ITEM_TYPES).forEach((type, i) => {
      const items = refineSpare(type);
      h += gridRow(i === refineCursor, "7em 3em 1fr", [
        span(items.length > 0 ? "" : "dim", ITEM_TYPES[type].name),
        span(items.length > 0 ? "" : "dim", `${items.length}個`),
        span("sub", items.map(equipName).join("、")),
      ]);
    });
    setScreen("装備を刻む", h, false);
    setHint([["←→", "装備中 / 持ち物"], ["↑↓", "選ぶ"], ["Enter / Space", "部位を選ぶ"]]);
    return;
  }

  // 装備中タブ、または持ち物タブで部位を選んだあと:刻める装備の一覧
  if (!worn) h += `<div class="list-title"><b>${esc(ITEM_TYPES[refineType].name)}</b> の装備</div>`;
  const list = refineList();
  if (list.length === 0) h += `<div class="note">死んだときに着けていた装備はない</div>`;
  list.forEach((eq, i) => {
    const before = eq.plus > 0 ? `強化前 ${statsText(eq.baseStats)}　` : "";
    // 装備中は左に着けていた枠(指輪1 など)
    h += gridRow(i === refineCursor, worn ? "6.5em 1fr" : "0 1fr", [
      span("dim", worn ? EQUIP_SLOTS[equippedSlotOf(eq)] : ""),
      `${equipHTML(eq)}<div class="sub">${before}→ 刻印「${esc(materialNameFor(eq))}」 ${span("mat", statsText(materialStats(eq)))}`
        + `${eq.effects && eq.effects.length ? "(効果もそのまま引き継ぐ)" : ""}</div>`,
    ]);
  });
  setScreen("装備を刻む", h, false);
  setHint(worn
    ? [["←→", "装備中 / 持ち物"], ["↑↓", "選ぶ"], ["Enter / Space", "刻む"]]
    : [["↑↓", "選ぶ"], ["Enter / Space", "刻む"], ["Esc / Q", "部位を選び直す"]]);
}

// 刻む画面:刻印がいっぱいのとき、代わりに解体する刻印を選ぶ(同じ部位の刻印。性能の低い順)
function drawRefineDiscard() {
  const eq = refineDiscardFor;
  let h = `<div>刻印がいっぱい(${BALANCE.materialMax}個)です。<b>${esc(materialNameFor(eq))}</b> を刻む代わりに、解体する刻印を1つ選んでください。</div>`;
  h += `<div class="note">解体した刻印は、強化に使った素材などの${Math.round(BALANCE.salvageRate * 100)}%が素材に戻ります(元に戻せません)</div>`;
  discardChoices().forEach((mat, i) => {
    if (!mat) {
      h += gridRow(i === refineDiscardCursor, "1fr", [`刻まずに、${esc(equipName(eq))}のほうを解体する ${span("mat", statsText(materialStats(eq)))}`]);
      h += `<div class="list-gap"></div>`;
      return;
    }
    // セットしている刻印には印を付ける(解体すると枠から外れる)
    const setMark = Object.values(base.materialSet).includes(mat) ? span("up", " [セット中]") : "";
    h += gridRow(i === refineDiscardCursor, "1fr", [`${materialMarks(mat)}${materialStatsHTML(mat)}${setMark}`]);
  });
  setScreen("装備を刻む - 解体する刻印", h, false);
  setHint([["↑↓", "選ぶ"], ["Enter / Space", "解体して刻む"], ["Esc / Q", "刻む装備を選び直す"]]);
}

// 一覧の1行(選んでいる行はハイライト)
function listRow(isSel, inner) {
  return `<div class="${isSel ? "sel" : ""}">${cursorMark(isSel)} ${inner}</div>`;
}
