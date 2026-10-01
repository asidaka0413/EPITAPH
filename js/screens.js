// 画面を描くところ(ダンジョン・持ち物・キャンプ・リザルトなど)
// index.html から <script src> で読み込まれる(読み込む順番は index.html に書いてある)

// ==================== 描画 ====================
// 冒険中の画面か(ダンジョン・持ち物・道を選ぶ・キャンプ)。ステータス欄と装備欄を出す画面
function inRunScreen() {
  return ["dungeon", "inventory", "route", "camp"].includes(screenMode);
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
  const m = monsterAt(x, y);
  if (m) {
    if (m.primed) return [m.data.symbol, "monster primed", null]; // 膨らんだ爆ぜ虫(次に爆発する)
    if (m.elite) return [m.data.symbol, `monster elite${m.dormant ? " dormant" : ""}`, BALANCE.eliteColor]; // エリートは金色・下線(眠っている墓守は薄く)
    return [m.data.symbol, "monster", monsterColor(m.data)]; // 3つ目は敵ごとの色(一族があれば一族の色)
  }
  const ball = ballAt(x, y);
  if (ball) return ["•", "ball", ELEMENT_DATA[ball.element].color]; // ドラゴンの属性の球(属性の色)
  if (flameAt(x, y)) return ["*", "flame"];
  if (stairs && x === stairs.x && y === stairs.y) return [">", stairsSealed() ? "stairs-sealed" : "stairs"];
  if (graveAt(x, y)) return ["†", "grave"]; // 前の自分の墓
  const it = itemAt(x, y);
  if (it) {
    if (it.book) return ["?", "book"];
    const info = ITEM_TYPES[it.equip.slot];
    return [info.symbol, info.cls];
  }
  if (map[y][x] === "#") return isWallVisible(x, y) ? ["#", "wall"] : null;
  return [".", "floor"];
}

// F キーで切り替え。true のあいだ、敵の視界(薄い黄色)と攻撃が届く範囲(薄い赤)をマップに出す
let threatView = false;

function drawDungeon() {
  const danger = dangerTiles(); // ドラゴンがブレスを溜めているときの、当たる範囲(赤く光らせる)
  // F キー:全部の敵の視界と攻撃範囲を集める
  const vision = new Set(), attack = new Set();
  if (threatView) {
    for (const m of monsters) {
      monsterVisionTiles(m).forEach(t => vision.add(t));
      monsterAttackTiles(m).forEach(t => attack.add(t));
    }
  }
  // 重なったら、ブレスの範囲 > 攻撃範囲 > 視界 の順に優先
  const overlay = key => danger.has(key) ? " danger" : attack.has(key) ? " atk" : vision.has(key) ? " vis" : "";
  let html = "";
  for (let y = 0; y < BALANCE.mapHeight; y++) {
    for (let x = 0; x < BALANCE.mapWidth; x++) {
      const tile = tileAt(x, y);
      const cls = tile && `${tile[1]}${overlay(`${x},${y}`)}`;
      if (!tile) html += " ";
      // 壁は文字ではなく、マスいっぱいに塗りつぶしたブロックで描く(縦にもすき間なくつながるように)
      else if (tile[1] === "wall") html += `<span class="wall-block"> </span>`;
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
    let content = eq ? `${eq.cursed ? `<span class="curse-tag">呪</span> ` : ""}${esc(equipName(eq))} ${span("dim", statsText(eq.stats))}`
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
        `${span("potion", "!")} 回復薬`, `×${potions}`, span("dim", `HPを${potionHealAmount()}回復する。毒・やけども治る`)]);
    } else if (tool.kind === "tool") {
      // 道具屋で買って持ってきた道具
      const t = runTools[tool.index];
      const data = TOOL_DATA[t.id];
      h += gridRow(i === invCursor, "7em 3em 1fr", [esc(data.name), `×${t.count}`, span("dim", data.desc)]);
    }
  });
  return h;
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

// 一覧の1行(選んでいる行はハイライト)
function listRow(isSel, inner) {
  return `<div class="${isSel ? "sel" : ""}">${cursorMark(isSel)} ${inner}</div>`;
}

function drawTown() {
  if (townPage === "player") drawTownPlayer();
  else if (townPage === "craft") drawTownCraft();
  else if (townPage === "dex") drawTownDex();
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
    h += `<span class="tab${i === playerTab ? " active" : ""}">${esc(tab.name)}${newMark}</span>`;
  });
  h += `</div>`;

  const tab = PLAYER_TABS[playerTab].id;
  if (tab === "status") h += statusPageHTML({}) + `<div class="note">拠点では装備を着けていない状態の値。装備は冒険中に拾う</div>`;
  else if (tab === "trait") h += traitPageHTML({});
  else if (tab === "material") h += playerMaterialHTML();
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
  // 一族のセット効果(冒険中だけ。拠点ではプレイヤー画面の「刻印」タブに出す)
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
  // 一族のセット効果(拠点では装備を着けていないので、セットしている刻印を全部数える)
  h += `<div class="list-gap"></div><div class="list-title"><b>一族のセット効果</b></div>`;
  h += `<div class="note">同じ一族の固有装備から刻んだ刻印をそろえると付く。ここではセット中の刻印を全部数えている。ダンジョンでは、装備を着けている枠の刻印だけ数える</div>`;
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
    h += `<span class="tab${i === craftTab ? " active" : ""}">${esc(tab.name)}</span>`;
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
    h += `<span class="tab${i === helpTab ? " active" : ""}">${esc(page.title)}</span>`;
  });
  h += `</div>`;
  for (const sec of HELP_PAGES[helpTab].sections) {
    h += `<div class="help-head">${esc(sec.head)}</div>`;
    for (const line of sec.lines) h += `<div class="help-line">${esc(line)}</div>`;
  }
  setScreen("拠点 - 遊び方", h, false);
  setHint([["←→", "タブ"], ["↑↓", "スクロール"], ["Esc / Q", "戻る"]]);
}

// 拠点:設定
function drawTownSettings() {
  let h = "";
  TOWN_SETTINGS.forEach((item, i) => {
    h += gridRow(i === townCursor, "20em 1fr", [esc(item.name), item.value()]);
  });
  h += `<div class="list-gap"></div><div class="note">${lastSavedAt ? `最終セーブ ${lastSavedAt.toLocaleString()}` : "まだセーブしていません"}</div>`;
  setScreen("拠点 - 設定", h, false);
  setHint([["↑↓", "選ぶ"], ["Enter / Space", "切り替え / 実行"], ["Esc / Q", "戻る"]]);
}

// 拠点:図鑑(タブ:敵・装備・書)
function drawTownDex() {
  // タブの見出し(発見数つき)
  let h = `<div class="tabs">`;
  DEX_TABS.forEach((tab, i) => {
    h += `<span class="tab${i === dexTab ? " active" : ""}">${esc(tab.name)} ${span("dim", `${dexCount(tab.id)}/${dexEntries(tab.id).length}`)}</span>`;
  });
  h += `</div>`;

  // 左に一覧、右に選んでいるものの詳しい情報
  const tab = DEX_TABS[dexTab].id;
  const entries = dexEntries(tab);
  let list = "";
  entries.forEach((e, i) => {
    const found = dexFound(tab, e);
    // 見つけていない装備は、種類(頭・胴など)だけヒントに出す
    const hint = tab === "equip" ? span("dim", ` [${ITEM_TYPES[e.slot].name}]`) : "";
    list += listRow(i === townCursor, found ? esc(e.name) : span("dim", "？？？") + hint);
  });
  const sel = entries[townCursor];
  const detail = !sel ? "" : dexFound(tab, sel) ? dexDetailHTML(tab, sel) : `<div class="dim">まだ見つけていない</div>`;
  h += `<div class="dex"><div class="dex-list">${list}</div><div class="dex-detail">${detail}</div></div>`;

  setScreen("拠点 - 図鑑", h, false);
  setHint([["←→", "タブ"], ["↑↓", "選ぶ"], ["Esc / Q", "戻る"]]);
}

// 図鑑の詳しい情報
function dexDetailHTML(tab, e) {
  const row = (label, value) => `<div class="grid-row" style="grid-template-columns:6em 1fr"><span class="dex-label">${label}</span><span>${value}</span></div>`;
  const depthText = x => (x.maxDepth === null ? `地下${x.minDepth}階〜` : `地下${x.minDepth}〜${x.maxDepth}階`);
  let h = "";

  if (tab === "monster") {
    h += `<div class="dex-name"><span style="color:${monsterColor(e)}">${esc(e.symbol)}</span> ${esc(e.name)}</div>`;
    h += row("出る階", depthText(e));
    h += row("一族", monsterClan(e) ? clanNameHTML(monsterClan(e)) : span("dim", "なし"));
    h += row("HP", `${e.hp} ${span("dim", `(1階ごとに+${e.hpPerDepth})`)}`);
    h += row("攻撃", `${e.attackMin}〜${e.attackMax} ${span("dim", `(1階ごとに+${e.attackPerDepth || 0})`)}`);
    h += row("", span("dim", `地下${BALANCE.enemySteepFromFloor}階からは、1階ごとの上がり幅が HP×${BALANCE.enemySteepHp}・攻撃×${BALANCE.enemySteepAttack}。深い層ほど、さらに強くなる`));
    h += row("速さ", speedText(e.speed));
    if (e.ability) h += row("特徴", MONSTER_ABILITIES[e.ability.type](e.ability));
    if (e.pack) h += row("群れ", `${e.pack[0]}〜${e.pack[1]}匹の群れで出てくる`);
    if (e.material) h += row("素材", `${RESOURCE_TYPES[e.material].name} ×${e.materialAmount || 1}`);
    h += row("倒した数", `${base.records.kills[e.id] || 0}体`);
    const drops = equipmentList.filter(x => x.from === e.id)
      .map(x => base.records.equipFound[x.id] ? esc(x.name) : span("dim", "？？？"));
    h += row("固有装備", drops.length ? drops.join("、") : span("dim", "なし"));
  } else if (tab === "equip") {
    h += `<div class="dex-name">${span(ITEM_TYPES[e.slot].cls, ITEM_TYPES[e.slot].symbol)} ${esc(e.name)}</div>`;
    h += row("種類", ITEM_TYPES[e.slot].name);
    h += row("ステータス", `${statsHTML(e.stats)} ${span("dim", "(1〜5階)")}`);
    if (e.block) h += row("防ぐ", `向いている方向から飛んでくる矢・炎・属性の球のダメージ -${e.block}%`);
    if (e.effects && e.effects.length) h += row("効果", effectsHTML(e.effects, false));
    const m = monsterList.find(x => x.id === e.from);
    const from = e.from === "field" ? "床に落ちている"
      : base.records.seen[e.from] ? `${esc(m.name)}が落とす` : `${span("dim", "？？？")}が落とす`;
    h += row("手に入る場所", from);
    h += row("出る階", depthText(e));
    h += row("拾った回数", `${base.records.equipFound[e.id]}回`);
    if (e.materialName) h += row("刻むと", `刻印「${span("mat-name", e.materialName)}」になる`);
    if (equipmentClan(e)) h += row("一族", `${clanNameHTML(equipmentClan(e))} ${span("dim", "(刻むと、この一族のセット効果に数えられる)")}`);
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
