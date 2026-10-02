// マップにマウスを合わせたときの詳細ウィンドウ(ツールチップ)
// index.html から <script src> で読み込まれる(読み込む順番は index.html に書いてある)

// ==================== ツールチップ ====================
// ダンジョンのマップで、マウスカーソルを敵や物の上に合わせると、そばに小さなウィンドウで詳細を出す(スマホではタップ)
//   マウスの位置から「どのマスか」を計算するので、マップを描く処理には手を入れていない
//   キーボードの操作には関係しない(マウスを動かしたときと、画面を描き直したときに中身を更新するだけ)
let tipMouse = null; // 最後のマウスの位置 { x, y }(画面の左上からのピクセル。マップの外に出たら null)
let tipByTouch = false; // スマホでタップして出したか(指で隠れないよう、タップした場所の上側に出す)

// 起動したときに1回だけ呼ぶ:マップの上でマウスが動いたら、ツールチップを更新する
//   スマホ(タッチ画面)では、マップのマスをタップすると出す。同じマスをもう一度タップするか、マップの外をタップすると消える
function initTooltip() {
  const screenEl = document.getElementById("screen");
  screenEl.addEventListener("mousemove", (e) => {
    if (isTouchDevice()) return; // スマホでタップしたときにも mousemove が来るので、無視する(タップで出す)
    tipMouse = { x: e.clientX, y: e.clientY };
    tipByTouch = false;
    updateTooltip();
  });
  screenEl.addEventListener("mouseleave", () => {
    if (isTouchDevice()) return;
    hideTooltip();
  });
  // タップ:そのマスの詳細を出す(同じマスなら消す)
  screenEl.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse") return;
    const before = tileUnderMouse();
    tipMouse = { x: e.clientX, y: e.clientY };
    tipByTouch = true;
    const now = tileUnderMouse();
    if (before && now && before.x === now.x && before.y === now.y) tipMouse = null;
    updateTooltip();
  });
  // マップの外をタップしたら消す
  document.addEventListener("pointerdown", (e) => {
    if (e.pointerType !== "mouse" && !screenEl.contains(e.target)) hideTooltip();
  });
}

// ツールチップを消す(マウスがマップの外に出たとき・スマホで操作ボタンを押したときなど)
function hideTooltip() {
  tipMouse = null;
  updateTooltip();
}

// マウスがあるマップのマス { x, y }(ダンジョン画面でないときや、マップの外なら null)
//   メイン画面の大きさはマップと同じ(横 mapWidth 文字 × 縦 mapHeight 行)なので、割り算でマスが分かる
function tileUnderMouse() {
  if (!tipMouse || screenMode !== "dungeon") return null;
  const rect = document.getElementById("screen").getBoundingClientRect();
  const x = Math.floor((tipMouse.x - rect.left) / (rect.width / BALANCE.mapWidth));
  const y = Math.floor((tipMouse.y - rect.top) / (rect.height / BALANCE.mapHeight));
  if (x < 0 || y < 0 || x >= BALANCE.mapWidth || y >= BALANCE.mapHeight) return null;
  return { x, y };
}

// ツールチップを出し直す(出すものがなければ隠す)。render() の最後にも呼ばれる
function updateTooltip() {
  const tip = document.getElementById("tooltip");
  const tile = tileUnderMouse();
  const html = tile ? tooltipHTML(tile.x, tile.y) : "";
  if (!html) {
    tip.style.display = "none";
    return;
  }
  tip.innerHTML = html;
  tip.style.display = "block";
  // カーソルの右下に出す。画面の端からはみ出すなら、左側・上側に出す
  //   タップで出したときは、指で隠れないように、タップした場所の上側に出す(上に入らなければ下側)
  const gap = 14;
  let left = tipMouse.x + gap, top = tipMouse.y + gap;
  if (tipByTouch) {
    left = tipMouse.x - tip.offsetWidth / 2;
    top = tipMouse.y - tip.offsetHeight - gap * 2;
    if (top < 4) top = tipMouse.y + gap * 2;
    left = Math.min(left, window.innerWidth - tip.offsetWidth - 4);
  }
  if (left + tip.offsetWidth > window.innerWidth - 4) left = tipMouse.x - tip.offsetWidth - gap;
  if (top + tip.offsetHeight > window.innerHeight - 4) top = tipMouse.y - tip.offsetHeight - gap;
  tip.style.left = `${Math.max(4, left)}px`;
  tip.style.top = `${Math.max(4, top)}px`;
}

// ツールチップの中身:1行目に見出し、その下に説明の行(lines は HTML の一覧)
function tipBox(title, lines) {
  return `<div class="tip-title">${title}</div>` + lines.filter(l => l).map(l => `<div class="tip-line">${l}</div>`).join("");
}

// マス (x, y) の詳細(何もなければ "")。重なっているときは、マップに見えているものを優先する
function tooltipHTML(x, y) {
  if (x === px && y === py) return "";
  if (!canSeeTile(x, y)) return ""; // 盲目などで見えないマスは調べられない
  const m = monsterAt(x, y);
  if (m && m.disguised) return chestTipHTML(m.fakeName); // 宝箱に化けたミミック:名前だけが少しおかしい
  if (m) return monsterTipHTML(m);
  const ball = ballAt(x, y);
  if (ball) {
    const el = ELEMENT_DATA[ball.element];
    return tipBox(`<span style="color:${el.color}">• ${esc(el.ballName)}</span>`, [
      `${esc(ball.owner)}が放った${esc(el.name)}属性の球。まっすぐ飛んで、壁に当たると消える`,
      span("tip-sub", "横に動けばよけられる。回避はできないが、盾と DEF で減らせる"),
    ]);
  }
  if (dangerTiles().has(`${x},${y}`)) {
    // ブレス・ガーゴイルの大技・竜人の突進・ドラゴンゾンビの死骸の爆発
    return tipBox(span("down", "危ない！ 攻撃の範囲"), [span("tip-sub", "次に、ここへブレスや大技などが来る。かわせないので、範囲の外へ動いてよけよう")]);
  }
  const f = flameAt(x, y);
  if (f) {
    return tipBox(span("flame", "* 炎"), [
      `${esc(f.owner)}が放った、追いかけてくる炎`,
      span("tip-sub", "ぶつかれば払って消せる。回避はできないが、盾と DEF で減らせる"),
      span("tip-sub", `あと${f.turns}ターンで消える`),
    ]);
  }
  if (stairs && x === stairs.x && y === stairs.y) {
    const text = stairsSealed() ? span("down", "封印中。この階のエリートを倒すまで降りられない")
      : depth >= BALANCE.goalDepth ? "降りると踏破！"
      : "降りると、分かれ道とキャンプがある";
    return tipBox(span("stairs", "> 階段"), [text]);
  }
  if (graveAt(x, y)) {
    const g = base.grave;
    const relic = g.relic && !g.relicTaken ? `遺品:${esc(equipName(g.relic))}` : span("dim", "遺品はもう持ち帰った");
    return tipBox(span("grave", "† 前の自分の墓"), [...epitaphLines(g).map(l => span("tip-sub", l)), relic]);
  }
  if (chestAt(x, y)) return chestTipHTML("宝箱");
  if (treasureSpotAt(x, y)) {
    return tipBox(span("treasure", "X 宝の印"), ["宝の地図に書かれていた場所。乗ると宝を掘り出せる"]);
  }
  const it = itemAt(x, y);
  if (it && it.treasureMap) {
    return tipBox(span("map-item", "{ 宝の地図"), [
      `地下${it.treasureMap.mapDepth}階に宝が眠っているらしい`,
      span("tip-sub", "拾うと道具の枠を1つ使う。その階を過ぎると使えなくなる"),
    ]);
  }
  if (it && it.lump) {
    return tipBox(span("lump", "% 謎の塊"), [
      "拾っておくと、キャンプで鑑定されてレア度つきの装備になる",
      span("tip-sub", "鑑定する前に死ぬとなくなる"),
    ]);
  }
  if (it && it.book) {
    const found = base.records.booksFound[it.book.id];
    return tipBox(span("book", "? 書"), [found ? span("book", it.book.name) : span("dim", "？？？(まだ手に入れたことのない書)")]);
  }
  const hz = !it && hazardAt(x, y);
  if (hz) {
    const t = HAZARD_TYPES[hz], b = BALANCE.hazards[hz];
    return tipBox(span(t.cls, `${t.symbol} ${t.name}`), [
      `上にいるあいだ、行動するたびにダメージ。${DOT_TYPES[t.dot].name}にもなる(${b.dotTurns}ターン)`,
      span("tip-sub", "敵は平気。押しっぱなしで歩いているときは、手前で止まる"),
    ]);
  }
  if (it) {
    const eq = it.equip;
    const type = ITEM_TYPES[eq.slot];
    const found = base.records.equipFound[eq.id];
    return tipBox(span(type.cls, `${type.symbol} ${type.name}の装備`), [found ? esc(equipName(eq)) : span("dim", "？？？(まだ拾ったことのない装備)")]);
  }
  return "";
}

// 宝箱の詳細。name:見出しの名前(本物は「宝箱」。ミミックは「宝笛」のような少しおかしい名前)
function chestTipHTML(name) {
  return tipBox(span("chest", `& ${esc(name)}`), [
    "上に乗ると開く",
    span("tip-sub", "床の装備や、この階に出る敵の固有装備が入っている"),
  ]);
}

// 敵の詳細。図鑑に登録されていない(まだ戦ったことのない)敵は「？？？」
function monsterTipHTML(m) {
  const d = m.data;
  const color = m.elite ? BALANCE.eliteColor : monsterColor(d);
  const title = `<span style="color:${color}">${esc(d.symbol)}</span> `;
  if (!base.records.seen[d.id]) {
    return tipBox(`${title}${span("dim", "？？？")}`, [
      span("tip-sub", "まだ戦ったことのない敵。戦うと図鑑に登録され、詳しいことが分かる"),
      m.primed ? span("down", "膨らんでいる！ 次に爆発する") : "",
      m.charging ? span("down", `${d.ability.type === "sweep" ? "大技を構えている" : d.ability.type === "rush" ? "突進を溜めている" : "息を溜めている"}！ 赤いマスから離れろ`) : "",
    ]);
  }
  const badges = monsterClans(d).map(c => " " + clanBadgeHTML(c)).join(""); // 一族の札(2つある敵は両方)
  const tag = m.guardian ? span("elite-tag", "墓守") : m.elite ? span("elite-tag", "エリート") : "";
  const [lo, hi] = monsterPowerRange(m);
  // 見出しの右側:エリートなどの印と、一族の札
  const head = `${title}${esc(monsterName(m))}<span class="tip-head-right">${tag}${badges}</span>`;
  // HP はゲージつき(残りが半分を切ると黄色、4分の1を切ると赤)
  const ratio = m.hp / m.maxHp;
  const hpColor = ratio > 0.5 ? "#4cd964" : ratio > 0.25 ? "#ffcc00" : "#ff3b30";
  const lines = [
    `<div class="tip-row"><span>HP ${m.hp} / ${m.maxHp}</span></div>${bar(ratio, hpColor, 4)}`,
    // 攻撃・速さ・向き(1つずつ、途中で改行しない)
    `<div class="tip-row"><span><span class="dim">攻撃</span> ${lo}〜${hi}</span><span><span class="dim">速さ</span> ${speedText(d.speed)}</span>`
      + `<span><span class="dim">向き</span> ${dirArrow(m.facing)}</span></div>`,
    // 気づいているか(色つきの札)と、その説明
    m.hunting
      ? `<span class="tip-badge alert">気づいている</span> ${span("tip-sub", "追いかけてくる")}`
      : `<span class="tip-badge calm">気づいていない</span> ${span("tip-sub", "殴ると不意打ちで2回攻撃")}`,
  ];
  if (d.ability) lines.push(span("tip-sub", MONSTER_ABILITIES[d.ability.type](d.ability)));
  // 今の状態
  if (m.dormant) lines.push(span("dim", "眠っている(攻撃するか、遺品を拾うと目を覚ます)"));
  if (m.primed) lines.push(span("down", "膨らんでいる！ 次に爆発する"));
  if (m.charging) lines.push(span("down", d.ability.type === "sweep"
    ? `${m.chargeKind === "spin" ? "回転切り" : "薙ぎ払い"}を構えている！ 赤いマスから離れろ`
    : d.ability.type === "rush" ? "突進を溜めている！ 赤い線から横へ離れろ"
    : `${ELEMENT_DATA[d.ability.element].name}のブレスを溜めている！ 赤いマスから離れろ`));
  if (m.stunned > 0) lines.push(span("dim", `体勢を崩している(あと${m.stunned}回動けない)`));
  if (m.summoned) lines.push(span("dim", "呼び出されたもの(倒しても素材だけ。術師を倒すと崩れ落ちる)"));
  const boss = commanderOf(m);
  if (boss) lines.push(span("down", `${esc(monsterName(boss))}の号令で、攻撃力+${Math.round(boss.data.ability.atkUp * 100)}%`));
  if (m.poison) lines.push(span("poison", `毒 ${m.poison.dmg}×${m.poison.turns}`));
  if (m.fleeing > 0) lines.push(span("down", `${m.stolenTool ? esc(toolLabel(m.stolenTool)) : "回復薬"}を盗んで逃げている(倒せば取り返せる)`));
  return tipBox(head, lines);
}
