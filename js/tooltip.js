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
  const iw = iceWallAt(x, y);
  if (iw) {
    return tipBox(span("ice-wall", "# 氷の壁"), [
      `凛龍が立てた壁。あと${iw.turns}ターンで溶ける`,
      span("tip-sub", "ぶつかると叩き割れる(1ターン使う)"),
    ]);
  }
  if (rockAt(x, y)) {
    return tipBox(span("rock", "# 岩石"), [
      "ベヒーモスの地響きで降ってきた岩。通れない",
      span("tip-sub", "エクリプスメテオのときは、落下地点から見てこの岩の陰(緑のマス)にいれば助かる。メテオのあとで砕ける"),
    ]);
  }
  const caster = meteorCaster();
  if (caster && x === caster.meteor.x && y === caster.meteor.y) {
    return tipBox(span("meteor-mark", "* エクリプスメテオの落下地点"), [
      `あと${Math.max(0, caster.meteor.at - turn)}ターンで落ちてきて、マップ全体を焼き尽くす(即死)`,
      span("tip-sub", "ここから見て岩石の陰(緑のマス)に隠れろ。階段で逃げてもよい"),
    ]);
  }
  const ball = ballAt(x, y);
  if (ball) {
    const el = ELEMENT_DATA[ball.element];
    return tipBox(`<span style="color:${el.color}">• ${esc(el.ballName)}</span>`, [
      `${esc(ball.owner)}が放った${esc(el.name)}属性の球。まっすぐ飛んで、壁に当たると消える`
        + (ball.bounces > 0 ? `(あと${ball.bounces}回は跳ね返る)` : ""),
      span("tip-sub", "横に動けばよけられる。回避はできないが、盾と DEF で減らせる"),
    ]);
  }
  const lm = lightningMarkAt(x, y);
  if (lm && !monsterAt(x, y)) {
    return tipBox(span("down", "落雷の印！"), [span("tip-sub", `${esc(lm.owner)}の雷が、次のターンの終わりにここへ落ちる。ほかの敵にも当たる`)]);
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
  const corpse = corpseAt(x, y);
  if (corpse) {
    return tipBox(span("corpse", `${corpse.m.data.symbol} ${esc(corpse.m.data.name)}の死体`), [
      corpse.wait > 0 ? `あと${corpse.wait}回動くと起き上がる(HP ${Math.round(corpse.m.data.ability.revive.hpRate * 100)}%)` : "今にも起き上がりそうだ",
      span("tip-sub", "踏みつぶすと完全に倒せる(経験値・ドロップはそのとき)"),
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
    const temp = tempHazards.find(h => h.x === x && h.y === y);
    return tipBox(span(t.cls, `${t.symbol} ${t.name}`), [
      t.ailment
        ? `ダメージはないが、上にいるあいだ${AILMENT_TYPES[t.ailment].name}が切れない(出れば${b.ailTurns}ターンで抜ける)`
        : t.fog
        ? `中にいるあいだ、盲目と${DOT_TYPES[t.dot].name}になる(ダメージは${DOT_TYPES[t.dot].name}だけ)`
        : `上にいるあいだ、行動するたびにダメージ。${DOT_TYPES[t.dot].name}にもなる(${b.dotTurns}ターン)`,
      ...(temp ? [span("tip-sub", `あと${temp.turns}ターンで消える`)] : []),
      span("tip-sub", "敵は平気。押しっぱなしで歩いているときは、手前で止まる"),
    ]);
  }
  if (it) {
    const eq = it.equip;
    const type = ITEM_TYPES[eq.slot];
    const found = base.records.equipFound[eq.id];
    const kind = weaponKindOf(eq); // 武器はジャンルの札も
    return tipBox(span(type.cls, `${type.symbol} ${type.name}の装備`),
      [found ? `${kind ? `${weaponKindBadgeHTML(kind)} ` : ""}${esc(equipName(eq))}` : span("dim", "？？？(まだ拾ったことのない装備)")]);
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
      m.charging ? span("down", `${d.ability.type === "sweep" ? "大技を構えている" : d.ability.type === "rush" || d.ability.rush ? "突進を溜めている" : "息を溜めている"}！ 赤いマスから離れろ`) : "",
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
    m.calm
      ? `<span class="tip-badge calm">見ている</span> ${span("tip-sub", "攻撃しなければ襲ってこない(見られているので不意打ちにならない)")}`
      : m.hunting
      ? `<span class="tip-badge alert">気づいている</span> ${span("tip-sub", "追いかけてくる")}`
      : `<span class="tip-badge calm">気づいていない</span> ${span("tip-sub", `殴ると不意打ちで${weaponKindOf(equipped.weapon) === "dagger" ? BALANCE.daggerSneakHits : BALANCE.sneakHits}回攻撃`)}`,
  ];
  if (d.ability) lines.push(span("tip-sub", MONSTER_ABILITIES[d.ability.type](d.ability)));
  // 今の状態
  if (m.dormant) lines.push(span("dim", "眠っている(攻撃するか、遺品を拾うと目を覚ます)"));
  if (m.primed) lines.push(span("down", "膨らんでいる！ 次に爆発する"));
  if (m.charging) lines.push(span("down", d.ability.type === "sweep"
    ? `${m.chargeKind === "spin" ? "回転切り" : "薙ぎ払い"}を構えている！ 赤いマスから離れろ`
    : d.ability.type === "rush" || d.ability.rush ? "突進を溜めている！ 赤い線から横へ離れろ"
    : `${ELEMENT_DATA[d.ability.element].name}のブレスを溜めている！ 赤いマスから離れろ`));
  if (m.blazing) lines.push(span("down", "体が赤熱している！ 次に爆炎。赤いマスから離れろ"));
  if (m.stomping) lines.push(span("down", `前足を振り上げている！ あと${Math.max(0, m.stompAt - turn)}ターンで地響き。赤いマスから離れろ`));
  if (m.meteor) lines.push(span("down", `エクリプスメテオを詠唱している！ 詠唱中は倒せない(あと${Math.max(0, m.meteor.at - turn)}ターン)`));
  if (m.roared) lines.push(span("down", `咆哮で猛っている(攻撃力+${Math.round(d.ability.roar.atkUp * 100)}%)`));
  if (m.stunned > 0) lines.push(span("dim", `体勢を崩している(あと${m.stunned}回動けない)`));
  if (m.summoned) lines.push(span("dim", "呼び出されたもの(倒しても素材だけ。術師を倒すと崩れ落ちる)"));
  const boss = commanderOf(m);
  if (boss) lines.push(span("down", `${esc(monsterName(boss))}の号令で、攻撃力+${Math.round(boss.data.ability.atkUp * 100)}%`));
  if (m.poison) lines.push(span("poison", `毒 ${m.poison.dmg}×${m.poison.turns}`));
  if (m.enraged) lines.push(span("down", `怒り狂っている(攻撃力+${Math.round(d.ability.atkUp * 100)}%・ときどき空振りする)`));
  if (inWall(m)) lines.push(span("dim", "壁の中にいる(殴れないが、殴ってもこない)"));
  if (m.burrowLeft !== undefined) lines.push(span("down", `逃げている(あと${m.burrowLeft}回逃げると床に潜って消える)`));
  if (m.fleeing > 0) lines.push(span("down", `${m.stolenTool ? esc(toolLabel(m.stolenTool)) : "回復薬"}を盗んで逃げている(倒せば取り返せる)`));
  return tipBox(head, lines);
}
