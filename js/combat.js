// プレイヤーの攻撃・移動・敵を倒したとき・死んだとき
// index.html から <script src> で読み込まれる(読み込む順番は index.html に書いてある)

// ==================== 戦闘・移動処理 ====================
let sneakStrike = false; // 今の攻撃が不意打ちか(倒したときに依頼に伝える)

// 敵を倒したとき(攻撃でも毒でも):経験値・素材・ドロップ・エリート・依頼の処理
//   text:ログの文(このあとに「XP+〇」が付く)
function killMonster(target, text) {
  monsters = monsters.filter(m => m !== target);
  if (leaveCorpse(target, text)) return; // グール:一度目は死体が残る(経験値・ドロップは完全に倒したとき。js/enemyskills.js)
  addDeathFx(target); // 砕け散る演出(js/screens.js)
  if (inWall(target)) moveOutOfWall(target); // 壁の中で倒れたゴースト:落とし物は近くの床に
  // 呼び出された敵(死霊術師のスケルトン):経験値・固有装備・書は落とさず、素材だけ
  if (target.summoned) {
    addLog(`${text}(呼び出されたものなので、素材だけ)`);
    gainMonsterResource(target);
    saveGame();
    return;
  }
  // 呼び出していた敵(死霊術師)を倒すと、呼ばれた敵も崩れ落ちる
  collapseSummons(target);
  questEvent("onKill", target, sneakStrike); // 討伐の依頼
  let xp = target.data.xp + (depth - 1) * (target.data.xpPerDepth || 0); // 深い階層ほど多い
  if (target.elite) xp *= BALANCE.eliteXpMultiplier;
  base.xp += xp;
  runStats.xpGained += xp;
  runStats.kills[target.data.id] = (runStats.kills[target.data.id] || 0) + 1;
  addLog(`${text} XP+${xp}`);
  // 盗賊に盗まれた回復薬を取り返す
  if (target.stolen) {
    potions += target.stolen;
    addLog(`盗まれた回復薬を${target.stolen}個取り返した`);
  }
  if (target.stolenTool) returnStolenTool(target); // 盗賊頭に盗まれた道具
  // 「糧」:敵を倒すと回復
  const killHeal = effectValue("killHeal");
  if (killHeal && playerHP < maxHP) {
    const heal = Math.min(maxHP - playerHP, Math.round(killHeal * healMultiplier()));
    if (heal > 0) { playerHP += heal; addLog(`糧を得た。HPが${heal}回復`); addPopup(px, py, `+${heal}`, "pop-heal"); }
  }
  if (target.elite) {
    runStats.elitesKilled += 1;
    addLog(target.guardian
      ? `前の自分の仇を討った！ 死んだときに刻める数が+1(${refineCount()}個)`
      : `階段の封印が解けた！ 死んだときに刻める数が+1(${refineCount()}個)`);
    dropHolyWater();
  }
  gainMonsterResource(target);
  if (target.data.ability && target.data.ability.type === "mimic") dropMimicTreasure(target); // ミミック:宝箱の中身
  dropMonsterEquipment(target);
  dropMonsterBook(target);
  dropLump(target); // 謎の塊(まれに)
  dropTreasureMap(target); // 宝の地図(まれに)
  if (target.data.ability && target.data.ability.deathBlast) startDeathBlast(target, target.data.ability.deathBlast); // ドラゴンゾンビ:死骸が爆発する
  checkLevelUp();
  saveGame(); // 経験値・レベルは拠点のデータなので、倒すたびにセーブ
}

// 冒険が終わったとき(死んだとき、または goalDepth 階を踏破したとき):記録を更新して、リザルト画面へ
//   cleared:踏破したなら true
//   死んだときは、先に自分が砕け散る演出(js/screens.js の playPlayerDeath)を見せてから
function handlePlayerDeath(cleared = false) {
  if (playerDying) return; // 演出の途中で、もう一度呼ばれたとき
  if (!cleared) {
    playSE("death");
    playPlayerDeath(() => finishRun(false));
    return;
  }
  finishRun(true);
}

// 記録を更新して、リザルト画面へ
function finishRun(cleared) {
  const rec = base.records;
  const totalKills = Object.values(runStats.kills).reduce((a, b) => a + b, 0);
  // リザルト画面に出す内容(新記録かどうかは、記録を更新する前に比べる)
  lastRunResult = {
    ...runStats,
    depth,
    cleared,
    totalKills,
    endLevel: base.level,
    pickups: refinablePickups().length, // 鍛冶屋の装備は数えない
    newBestDepth: depth > rec.bestDepth,
    newBestHit: runStats.bestHit > rec.bestHit,
  };
  // これまでの記録を更新
  rec.runs += 1;
  rec.bestDepth = Math.max(rec.bestDepth, depth);
  rec.totalKills += totalKills;
  for (const id in runStats.kills) rec.kills[id] = (rec.kills[id] || 0) + runStats.kills[id];
  rec.bestHit = Math.max(rec.bestHit, runStats.bestHit);
  rec.damageDealt += runStats.damageDealt;
  rec.damageTaken += runStats.damageTaken;
  rec.crits += runStats.crits;
  if (cleared) rec.clears = (rec.clears || 0) + 1;
  else buildGrave(totalKills); // 死んだ階に墓が建つ
  endRunQuests(); // 受けていた依頼は消える(掲示板は拠点に戻ったとき新しくなる)

  addLog(cleared ? `地下${depth}階を踏破した！` : `あなたは死んだ… (地下${depth}階)`);
  screenMode = "result";
  checkAchievements(); // 冒険の終わりで取れる実績(自害はキーを押していないときに終わるので、ここでも調べる)
  saveGame();
  render();
}

// リザルト画面で Enter:刻める装備があれば刻む画面へ、なければ拠点へ(鍛冶屋の装備は刻めない)
function leaveResult() {
  if (refinablePickups().length > 0) {
    refineLeft = Math.min(refineCount(), refinablePickups().length);
    addLog(`刻む装備を${refineLeft}つ選んでください`);
    refineCursor = 0;
    refineTab = refineWorn().length > 0 ? 0 : 1; // 装備中のものがあれば「装備中」タブから
    refineType = null;
    screenMode = "refine";
  } else {
    addLog("刻める装備がないので、そのまま拠点に戻ります");
    runPickups = [];
    goToTown();
  }
  render();
}

// プレイヤーの攻撃1回分。ATK を元にダメージを出し、CRT で会心判定。倒したら killMonster
//   prefix:ログの頭に付ける文(「不意打ち！ 」など)
//   rate:ダメージの割合(爪牙の半分・槍で後ろの敵に当てるときなど)
function playerStrike(target, prefix = "", rate = 1) {
  const s = getPlayerStats();
  const fx = effectTotals(); // 呪われた装備の効果
  // 「剛力」で与ダメージアップ。衰弱していると下がる。砥石・狂熱の香薬で上がる
  let dmg = rollDamage(s.atk * rate * (1 + (fx.dmgUp || 0) / 100) * weakMultiplier() * buffAtkMultiplier());
  const isCrit = rollCrit(s);
  if (isCrit) {
    dmg = Math.round(dmg * critMultiplier());
    runStats.crits += 1;
  }
  const targetAb = target.data.ability || {};
  // 甲冑騎士:普通の攻撃は鎧で減る(会心は貫通)。鈍器なら鎧ごと叩くので減らない
  let critText = isCrit ? "会心の一撃！ " : "";
  if (targetAb.type === "armored") {
    if (isCrit) critText = "会心の一撃が鎧を貫いた！ ";
    else if (weaponKindOf(equipped.weapon) === "blunt") critText = "鎧ごと叩きつけた！ ";
    else dmg = Math.max(1, Math.round(dmg * (1 - targetAb.cut)));
  }
  critText = prefix + critText;

  const name = monsterName(target);
  provokeMonster(target); // 襲ってこなかった龍は、攻撃が当たると怒る
  target.hp -= dmg;
  // 演出:ダメージの数字が浮かぶ。会心ならマスが光って、数字も大きく(js/screens.js)
  //   ふつうの攻撃は、敵が白く光って、殴られた向きに少しはねる(fx-hit-右左上下。斜めのときは横を優先)
  addPopup(target.x, target.y, dmg, isCrit ? "pop-crit" : "pop-dmg");
  if (isCrit) addTileFx(target.x, target.y, "fx-crit", 350);
  else {
    const dx = Math.sign(target.x - px), dy = Math.sign(target.y - py);
    const dir = dx > 0 ? "r" : dx < 0 ? "l" : dy > 0 ? "d" : "u";
    addTileFx(target.x, target.y, `fx-hit-${dir}`, 180);
  }
  playSE(isCrit ? "crit" : "hit"); // 効果音(js/sound.js)
  // 冒険の記録
  runStats.damageDealt += dmg;
  if (dmg > runStats.bestHit) { runStats.bestHit = dmg; runStats.bestHitCrit = isCrit; }
  // 「追撃」:与えたダメージの〇%で、もう1回攻撃する
  let extraText = "";
  if (fx.followUp && target.hp > 0) {
    const extra = Math.max(1, Math.round(dmg * fx.followUp / 100));
    target.hp -= extra;
    runStats.damageDealt += extra;
    extraText += ` 追撃で${extra}！`;
  }
  // 「吸血」:与えたダメージの〇%だけ回復(1回の回復は、吸血1%につき lifeStealCapPerPercent まで)
  if (fx.lifeSteal && playerHP < maxHP) {
    const cap = fx.lifeSteal * BALANCE.lifeStealCapPerPercent;
    const heal = Math.min(maxHP - playerHP, cap, Math.max(1, Math.round(dmg * fx.lifeSteal / 100 * healMultiplier())));
    if (heal > 0) { playerHP += heal; extraText += ` HP+${heal}`; addPopup(px, py, `+${heal}`, "pop-heal"); }
  }
  // 「毒刃」:poisonHitChance の確率で敵を毒にする(もう毒なら、強いほう・残りターンは最初から)
  if (fx.poisonHit && target.hp > 0 && chance(BALANCE.poisonHitChance * 100)) {
    target.poison = { dmg: Math.max(fx.poisonHit, target.poison ? target.poison.dmg : 0), turns: BALANCE.poisonHitTurns };
    extraText += " 毒にした！";
  }
  meteorGuard(target); // ベヒーモス:HP 5%以下でエクリプスメテオ(詠唱中は倒れない)
  if (target.hp <= 0) {
    killMonster(target, `${critText}${name}に${dmg}のダメージ！${extraText} ${name}を倒した！`);
  } else {
    addLog(`${critText}${name}に${dmg}のダメージ！${extraText}`);
    if (targetAb.type === "split" && !target.splitDone) splitMonster(target);
    checkRage(target); // オーガ:HP が減ると怒る
    checkMolt(target); // 瘴龍:HP が減ると脱皮する
    // おどりキノコ:殴られて生き残ると、chance の確率で胞子をまく(となりにいれば混乱する。弓で遠くから撃てば届かない)
    if (targetAb.type === "spore" && Math.max(Math.abs(target.x - px), Math.abs(target.y - py)) <= 1 && Math.random() < targetAb.chance) {
      addLog(`${name}が胞子をまき散らした！`);
      confusePlayer(targetAb.turns);
    }
  }
}

// ==================== 武器のジャンルごとの攻撃の形 ====================
// となりの敵を殴る(1回の行動ぶん)。着けている武器のジャンルで攻撃の形が変わる
//   不意打ち:気づいていない敵(眠っている墓守も)を殴ると、sneakHits 回攻撃できる(短剣は daggerSneakHits 回)
//   爪牙:1回につき fangRate のダメージで fangHits 回攻撃する(不意打ちならさらにその回数ぶん)
//   弓:となりの敵には弱い(bowMeleeRate)
function attackWithWeapon(target) {
  meetMonster(target.data.id); // 戦った敵は図鑑に登録
  const kind = weaponKindOf(equipped.weapon);
  const sneak = !target.hunting && !target.calm; // 襲ってこない龍はこちらを見ているので、不意打ちにならない
  if (target.dormant) wakeGuardian(target, "攻撃されて、"); // 眠っている墓守を殴ると目を覚ます
  const hits = sneak ? (kind === "dagger" ? BALANCE.daggerSneakHits : BALANCE.sneakHits) : 1;
  const strikes = kind === "fang" ? BALANCE.fangHits : 1;
  const rate = kind === "fang" ? BALANCE.fangRate : kind === "bow" ? BALANCE.bowMeleeRate : 1;
  sneakStrike = sneak; // 不意打ちで倒したかを、依頼(不意打ちで〇体倒す)に伝えるため
  for (let i = 0; i < hits * strikes && target.hp > 0 && monsters.includes(target); i++) {
    playerStrike(target, sneak && i === 0 ? "不意打ち！ " : "", rate);
  }
  sneakStrike = false;
  // 攻撃された敵は気づいて、こちらを向く
  if (monsters.includes(target) && !target.hunting) noticePlayer(target, false);
}

// (x, y)にいる、巻きこんで攻撃できる敵。壁・敵なし・宝箱に化けたミミックなら null
function sweepTargetAt(x, y) {
  if (!map[y] || map[y][x] === undefined || map[y][x] === "#") return null;
  const m = monsterAt(x, y);
  return m && !m.disguised ? m : null;
}

// 殴った敵(nx, ny)のほかに巻きこむ敵の一覧と、その割合・ログの頭の文
//   槍:後ろ(同じ方向にもう1マス先)に spearPierceRate
//   斧:殴った敵の左右(こちらのとなりのマス)に axeSideRate
//   鎌:自分の周り8マスのほかの敵に scytheRate
function weaponSweepTargets(kind, nx, ny, dx, dy) {
  let spots = [], rate = 0, prefix = "";
  if (kind === "spear") {
    spots = [[nx + dx, ny + dy]];
    rate = BALANCE.spearPierceRate; prefix = "貫いた！ ";
  } else if (kind === "axe") {
    // まっすぐ殴ったら殴った敵の両どなり、斜めに殴ったら自分と殴った敵の両方のとなりのマス
    spots = dx !== 0 && dy !== 0 ? [[px + dx, py], [px, py + dy]] : [[nx + dy, ny + dx], [nx - dy, ny - dx]];
    rate = BALANCE.axeSideRate; prefix = "薙ぎ払った！ ";
  } else if (kind === "scythe") {
    for (const [ax, ay] of DIRS8) if (px + ax !== nx || py + ay !== ny) spots.push([px + ax, py + ay]);
    rate = BALANCE.scytheRate; prefix = "刈り払った！ ";
  }
  const targets = spots.map(([x, y]) => sweepTargetAt(x, y)).filter(m => m);
  return { targets, rate, prefix };
}

// 巻きこんだ敵(弓の矢が当たった敵も)に1回だけ攻撃する(不意打ちにはならない)
function sweepStrike(m, prefix, rate) {
  meetMonster(m.data.id);
  if (m.dormant) wakeGuardian(m, "攻撃されて、");
  playerStrike(m, prefix, rate);
  if (monsters.includes(m) && !m.hunting) noticePlayer(m, false);
}

// ==================== 弓(R で狙って、方向キーで撃つ) ====================
let bowAiming = false; // R を押して、撃つ方向を選んでいるあいだ true(マップに届く範囲を出す)

// R を押したとき:弓を着けていれば狙う。もう狙っていたらやめる
function startBowAim() {
  if (weaponKindOf(equipped.weapon) !== "bow") {
    addLog("弓を着けていない(R は弓で撃つキー)");
  } else {
    bowAiming = !bowAiming;
    if (bowAiming) addLog(`どの方向に撃つ？(方向キーで撃つ・${BALANCE.bowRange}マスまで。R / Esc でやめる)`);
  }
  render();
}

// 狙っているあいだのキー:方向キーで撃つ。ほかのキーならやめる
function handleBowAim(key) {
  bowAiming = false;
  const dir = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[key];
  if (dir) shootBow(dir[0], dir[1]);
  else render();
}

// 弓で撃って届く距離での、ダメージの割合(となりは bowMeleeRate、2マス先から bowShotRate で、遠いほど下がる)
function bowRateAt(dist) {
  if (dist <= 1) return BALANCE.bowMeleeRate;
  return Math.max(0, BALANCE.bowShotRate - (dist - 2) * BALANCE.bowFalloff);
}

// 狙っているあいだ、マップに出す届く範囲のマス("x,y" の Set)。縦横4方向、壁の手前まで
function bowAimTiles() {
  const tiles = new Set();
  if (!bowAiming) return tiles;
  for (const [dx, dy] of DIRS4) {
    for (let i = 1; i <= BALANCE.bowRange; i++) {
      const x = px + dx * i, y = py + dy * i;
      if (!map[y] || map[y][x] === undefined || map[y][x] === "#") break;
      tiles.add(`${x},${y}`);
    }
  }
  return tiles;
}

// (dx, dy)の方向に撃つ。最初に当たった敵だけにダメージ。1ターン使う
//   となりの敵に撃つのは、殴るのと同じ(弱い・不意打ちはある)。離れた敵は不意打ちにならない
function shootBow(dx, dy) {
  facing = [dx, dy]; // 撃った方向を向く(盾の向きも)
  turn += 1;
  runStats.turns += 1;
  const hit = throwLine(BALANCE.bowRange); // 向いている方向にまっすぐ(js/shop.js。投げナイフと同じ)
  const m = hit.monster;
  if (!m) {
    addLog(hit.wall ? "矢は壁に刺さった" : "矢は何にも当たらなかった");
  } else {
    if (m.disguised) revealMimic(m, false); // 宝箱に化けたミミック:噛みつかずに正体を現す
    const dist = Math.abs(m.x - px) + Math.abs(m.y - py);
    if (dist <= 1) attackWithWeapon(m);
    else sweepStrike(m, `矢が当たった(${dist}マス)！ `, bowRateAt(dist));
  }
  endPlayerTurn();
}

function tryMove(dx, dy) {
  // 凛龍の氷の壁:ぶつかると叩き割る(1ターン使う)
  const iw = iceWallAt(px + dx, py + dy);
  if (iw) {
    facing = [dx, dy];
    turn += 1;
    runStats.turns += 1;
    breakIceWall(iw);
    endPlayerTurn();
    return;
  }
  if (map[py + dy][px + dx] === "#") {
    // 壁にぶつかっただけなら、ターンは進まない(壁の中のゴーストは殴れない)
    const ghost = monsterAt(px + dx, py + dy);
    if (ghost) addLog(`壁の中の${monsterName(ghost)}には、手が届かない`);
    render();
    return;
  }
  // 混乱:ときどき、ほかの方向にふらつく(ふらついて壁にぶつかると、ターンが進む)
  const [cx, cy] = confusedDirection(dx, dy);
  if (cx !== dx || cy !== dy) {
    dx = cx; dy = cy;
    if (map[py + dy][px + dx] === "#") {
      addLog("足がもつれて、壁にぶつかった");
      turn += 1;
      runStats.turns += 1;
      endPlayerTurn();
      return;
    }
    addLog("足がもつれた！");
  }
  const nx = px + dx, ny = py + dy;

  facing = [dx, dy]; // 動いた(攻撃した)方向を向く。盾はこの方向から飛んでくる攻撃を防ぐ
  turn += 1;
  runStats.turns += 1;

  const target = monsterAt(nx, ny);
  // 拘束:移動はできない(敵を殴る・炎を払うのはできる)。もがくだけでターンが進む
  if (playerBound && !target && !flameAt(nx, ny)) {
    addLog("体が縛られていて動けない…");
    endPlayerTurn();
    return;
  }
  if (target && target.disguised) {
    // 宝箱に化けたミミック:開けようとすると正体を現して噛みつく(こちらは攻撃しない)
    revealMimic(target, true);
    if (playerHP <= 0) { handlePlayerDeath(); return; }
  } else if (target) {
    // 槍・斧・鎌で巻きこむ敵は、先に探しておく(殴った敵が分裂などしても、元からいた敵だけに当てる)
    const sweep = weaponSweepTargets(weaponKindOf(equipped.weapon), nx, ny, dx, dy);
    attackWithWeapon(target);
    for (const m of sweep.targets) {
      if (monsters.includes(m)) sweepStrike(m, sweep.prefix, sweep.rate);
    }
  } else if (flameAt(nx, ny)) {
    // 炎にぶつかると、払って消せる(その場からは動かない)
    flames = flames.filter(f => f !== flameAt(nx, ny));
    addLog("炎を払い消した");
  } else {
    px = nx;
    py = ny;
    // 属性の球のマスに自分から入ったら、当たる
    const ball = ballAt(nx, ny);
    if (ball) {
      balls = balls.filter(b => b !== ball);
      ballHit(ball);
      if (playerHP <= 0) { handlePlayerDeath(); return; }
    }

    checkFooting();

    if (stairs && nx === stairs.x && ny === stairs.y && stairsSealed()) {
      addLog(`階段は封印されている。${monsterName(aliveElite())}を倒さないと降りられない`);
    } else if (stairs && nx === stairs.x && ny === stairs.y && depth >= BALANCE.goalDepth) {
      handlePlayerDeath(true); // いちばん下の階段を降りたら踏破(ゴール)
      return;
    } else if (stairs && nx === stairs.x && ny === stairs.y) {
      openRouteSelect(); // 次の階への道を選んで、キャンプへ(階段を降りた直後は、敵は動かない)
      return;
    }
  }

  endPlayerTurn();
}

// 今いるマスの足元を調べる(歩いて乗ったとき・転移の札で飛んだとき)
//   宝箱なら開けて、足元のアイテムを全部拾い、墓の上なら墓碑銘を読んで、遺品があれば拾う。グールの死体なら踏みつぶす
function checkFooting() {
  const chest = chestAt(px, py);
  if (chest) openChest(chest);
  const spot = treasureSpotAt(px, py);
  // 宝の地図の印(地図を盗賊頭に盗まれていると掘れない)
  if (spot && runTools.includes(spot.map)) digTreasure(spot);
  else if (spot) addLog("宝の印だ。…でも地図を盗まれていて、どこを掘ればいいか分からない");
  for (const it of items.filter(i => i.x === px && i.y === py)) {
    // 宝の地図は、道具の枠がいっぱいなら床に残して入れ替える画面を出すので、拾う処理の中で床から消す
    if (it.treasureMap) { pickUpTreasureMap(it); continue; }
    items = items.filter(i => i !== it);
    if (it.book) obtainBook(it.book);
    else if (it.lump) gainLump();
    else pickUpEquipment(it.equip);
  }
  if (graveAt(px, py)) visitGrave();
  const corpse = corpseAt(px, py);
  if (corpse) stompCorpse(corpse); // グールの死体:踏みつぶして完全に倒す
}

// レベル level から次のレベルに上がるのに必要な経験値(レベルが上がるごとに xpPerLevel ずつ増える)
function xpNeeded(level) {
  return BALANCE.xpBase + (level - 1) * BALANCE.xpPerLevel;
}

// そのレベルになったときにスキルポイントがもらえるか(Lv1, 4, 7, 10 …)
function isSkillPointLevel(level) {
  return (level - 1) % BALANCE.skillPointEveryLevels === 0;
}

function checkLevelUp() {
  // 経験値がたくさん入ったときは、何レベルでも続けて上がる
  while (base.xp >= xpNeeded(base.level)) {
    base.xp -= xpNeeded(base.level);
    base.level += 1;
    // レベルアップではHPは増えず、回復もしない。決まったレベルでスキルポイントが拠点に貯まるだけ
    if (isSkillPointLevel(base.level)) {
      const gain = randInt(BALANCE.skillPointGainMin, BALANCE.skillPointGainMax);
      base.skillPoints += gain;
      addLog(`レベルアップ！ Lv.${base.level}になった スキルポイント+${gain}`);
    } else {
      addLog(`レベルアップ！ Lv.${base.level}になった`);
    }
    // 演出:画面のふちとステータス欄が金色に光り、「LEVEL UP!」が浮かぶ
    frameFx("fx-levelup", 1200);
    playSE("levelup");
    if (screenMode === "dungeon") addPopup(px, py, "LEVEL UP!", "pop-level");
  }
}

// ターンスキップ:その場で1ターン待つ(敵は動く。押しっぱなしでも使うので、ログは出さない)
function waitTurn() {
  turn += 1;
  runStats.turns += 1;
  endPlayerTurn();
}

// 回復薬1個で回復する量:最大HPの potionHealRatio(最低 potionHeal)。特性「回復強化」で増える
//   固定の量だと、最大HPが増える深い階で弱くなりすぎるので、最大HPに合わせて増やす
function potionHealAmount() {
  return Math.round(Math.max(BALANCE.potionHeal, maxHP * BALANCE.potionHealRatio) * healMultiplier());
}

function usePotion() {
  if (potions <= 0) {
    addLog("回復薬を持っていない");
    return;
  }
  // HPが満タンでも、毒・やけど・盲目・混乱・凍え・しびれなら使える(治すため)
  if (playerHP >= maxHP && Object.keys(playerDots).length === 0 && Object.keys(playerAilments).length === 0 && !playerBlind && !playerConfused) {
    addLog("HPはすでに満タン");
    return;
  }
  turn += 1; // 回復薬を使うのも1ターン(その間に敵も動く)
  runStats.turns += 1;
  potions -= 1;
  const heal = Math.min(maxHP - playerHP, potionHealAmount());
  playerHP += heal;
  addLog(`回復薬を使った！ HPが${heal}回復`);
  if (heal > 0) addPopup(px, py, `+${heal}`, "pop-heal");
  questEvent("onPotion"); // 「回復薬を使わずに」の依頼は失敗
  // 回復薬は毒・やけど・盲目・混乱・凍え・しびれも治す(継続ダメージに、何もできずに削られ続けないように)
  const hadOther = !!playerBlind || !!playerConfused;
  playerBlind = null;
  playerConfused = null;
  const hadAilments = cureAilments();
  if (cureDots() || hadOther || hadAilments) addLog("状態異常が治った");
  endPlayerTurn();
}
