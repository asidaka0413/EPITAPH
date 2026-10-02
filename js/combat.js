// プレイヤーの攻撃・移動・敵を倒したとき・死んだとき
// index.html から <script src> で読み込まれる(読み込む順番は index.html に書いてある)

// ==================== 戦闘・移動処理 ====================
let sneakStrike = false; // 今の攻撃が不意打ちか(倒したときに依頼に伝える)

// 敵を倒したとき(攻撃でも毒でも):経験値・素材・ドロップ・エリート・依頼の処理
//   text:ログの文(このあとに「XP+〇」が付く)
function killMonster(target, text) {
  monsters = monsters.filter(m => m !== target);
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
    if (heal > 0) { playerHP += heal; addLog(`糧を得た。HPが${heal}回復`); }
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
function handlePlayerDeath(cleared = false) {
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
function playerStrike(target, prefix = "") {
  const s = getPlayerStats();
  const fx = effectTotals(); // 呪われた装備の効果
  // 「剛力」で与ダメージアップ。衰弱していると下がる。砥石・狂熱の香薬で上がる
  let dmg = rollDamage(s.atk * (1 + (fx.dmgUp || 0) / 100) * weakMultiplier() * buffAtkMultiplier());
  const isCrit = rollCrit(s);
  if (isCrit) {
    dmg = Math.round(dmg * critMultiplier());
    runStats.crits += 1;
  }
  const targetAb = target.data.ability || {};
  // 甲冑騎士:普通の攻撃は鎧で減る(会心は貫通)
  let critText = isCrit ? "会心の一撃！ " : "";
  if (targetAb.type === "armored") {
    if (isCrit) critText = "会心の一撃が鎧を貫いた！ ";
    else dmg = Math.max(1, Math.round(dmg * (1 - targetAb.cut)));
  }
  critText = prefix + critText;

  const name = monsterName(target);
  target.hp -= dmg;
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
    if (heal > 0) { playerHP += heal; extraText += ` HP+${heal}`; }
  }
  // 「毒刃」:poisonHitChance の確率で敵を毒にする(もう毒なら、強いほう・残りターンは最初から)
  if (fx.poisonHit && target.hp > 0 && chance(BALANCE.poisonHitChance * 100)) {
    target.poison = { dmg: Math.max(fx.poisonHit, target.poison ? target.poison.dmg : 0), turns: BALANCE.poisonHitTurns };
    extraText += " 毒にした！";
  }
  if (target.hp <= 0) {
    killMonster(target, `${critText}${name}に${dmg}のダメージ！${extraText} ${name}を倒した！`);
  } else {
    addLog(`${critText}${name}に${dmg}のダメージ！${extraText}`);
    if (targetAb.type === "split" && !target.splitDone) splitMonster(target);
  }
}

function tryMove(dx, dy) {
  const nx = px + dx, ny = py + dy;
  if (map[ny][nx] === "#") return; // 壁にぶつかっただけなら、ターンは進まない

  facing = [dx, dy]; // 動いた(攻撃した)方向を向く。盾はこの方向から飛んでくる攻撃を防ぐ
  turn += 1;
  runStats.turns += 1;

  const target = monsterAt(nx, ny);
  if (target && target.disguised) {
    // 宝箱に化けたミミック:開けようとすると正体を現して噛みつく(こちらは攻撃しない)
    revealMimic(target, true);
    if (playerHP <= 0) { handlePlayerDeath(); return; }
  } else if (target) {
    meetMonster(target.data.id); // 戦った敵は図鑑に登録
    // 不意打ち:気づいていない敵(眠っている墓守も)を殴ると、2回攻撃できる
    const sneak = !target.hunting;
    if (target.dormant) wakeGuardian(target, "攻撃されて、"); // 眠っている墓守を殴ると目を覚ます
    const hits = sneak ? 2 : 1;
    sneakStrike = sneak; // 不意打ちで倒したかを、依頼(不意打ちで〇体倒す)に伝えるため
    for (let i = 0; i < hits && target.hp > 0 && monsters.includes(target); i++) {
      playerStrike(target, sneak && i === 0 ? "不意打ち！ " : "");
    }
    sneakStrike = false;
    // 攻撃された敵は気づいて、こちらを向く
    if (monsters.includes(target) && !target.hunting) noticePlayer(target, false);
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
//   宝箱なら開けて、足元のアイテムを全部拾い、墓の上なら墓碑銘を読んで、遺品があれば拾う
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
  // HPが満タンでも、毒・やけど・盲目なら使える(治すため)
  if (playerHP >= maxHP && Object.keys(playerDots).length === 0 && !playerBlind) {
    addLog("HPはすでに満タン");
    return;
  }
  turn += 1; // 回復薬を使うのも1ターン(その間に敵も動く)
  runStats.turns += 1;
  potions -= 1;
  const heal = Math.min(maxHP - playerHP, potionHealAmount());
  playerHP += heal;
  addLog(`回復薬を使った！ HPが${heal}回復`);
  questEvent("onPotion"); // 「回復薬を使わずに」の依頼は失敗
  // 回復薬は毒・やけど・盲目も治す(継続ダメージに、何もできずに削られ続けないように)
  const hadBlind = !!playerBlind;
  playerBlind = null;
  if (cureDots() || hadBlind) addLog("毒・やけど・盲目が治った");
  endPlayerTurn();
}
