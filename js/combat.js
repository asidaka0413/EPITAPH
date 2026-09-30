// プレイヤーの攻撃・移動・敵を倒したとき・死んだとき
// index.html から <script src> で読み込まれる(読み込む順番は index.html に書いてある)

// ==================== 戦闘・移動処理 ====================
// 敵を倒したとき(攻撃でも毒でも):経験値・素材・ドロップ・エリートの処理
//   text:ログの文(このあとに「XP+〇」が付く)
function killMonster(target, text) {
  monsters = monsters.filter(m => m !== target);
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
  dropMonsterEquipment(target);
  dropMonsterBook(target);
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
    pickups: runPickups.length,
    newBestDepth: depth > rec.bestDepth,
    newBestHit: runStats.bestHit > rec.bestHit,
  };
  // これまでの記録を更新
  rec.runs += 1;
  rec.bestDepth = Math.max(rec.bestDepth, depth);
  rec.totalKills += totalKills;
  for (const id in runStats.kills) rec.kills[id] = (rec.kills[id] || 0) + runStats.kills[id];
  rec.bestHit = Math.max(rec.bestHit, runStats.bestHit);
  if (cleared) rec.clears = (rec.clears || 0) + 1;
  else buildGrave(totalKills); // 死んだ階に墓が建つ

  addLog(cleared ? `地下${depth}階を踏破した！` : `あなたは死んだ… (地下${depth}階)`);
  screenMode = "result";
  saveGame();
  render();
}

// リザルト画面で Enter:拾った装備があれば刻む画面へ、なければ拠点へ
function leaveResult() {
  if (runPickups.length > 0) {
    refineLeft = Math.min(refineCount(), runPickups.length);
    addLog(`刻む装備を${refineLeft}つ選んでください`);
    refineCursor = 0;
    refineTab = refineWorn().length > 0 ? 0 : 1; // 装備中のものがあれば「装備中」タブから
    refineType = null;
    screenMode = "refine";
  } else {
    addLog("拾った装備がないので、そのまま拠点に戻ります");
    goToTown();
  }
  render();
}

function tryMove(dx, dy) {
  const nx = px + dx, ny = py + dy;
  if (map[ny][nx] === "#") return; // 壁にぶつかっただけなら、ターンは進まない

  facing = [dx, dy]; // 動いた(攻撃した)方向を向く。盾はこの方向から飛んでくる攻撃を防ぐ
  turn += 1;
  runStats.turns += 1;

  const target = monsterAt(nx, ny);
  if (target && target.dormant) wakeGuardian(target, "攻撃されて、"); // 眠っている墓守を殴ると目を覚ます
  if (target) {
    // 物理攻撃:ATK を元にダメージを出し、CRT で会心判定
    const s = getPlayerStats();
    const fx = effectTotals(); // 呪われた装備の効果
    // 「剛力」で与ダメージアップ。衰弱していると下がる
    let dmg = rollDamage(s.atk * (1 + (fx.dmgUp || 0) / 100) * weakMultiplier());
    const isCrit = rollCrit(s);
    if (isCrit) dmg = Math.round(dmg * critMultiplier());
    const targetAb = target.data.ability || {};
    // 甲冑騎士:普通の攻撃は鎧で減る(会心は貫通)
    let critText = isCrit ? "会心の一撃！ " : "";
    if (targetAb.type === "armored") {
      if (isCrit) critText = "会心の一撃が鎧を貫いた！ ";
      else dmg = Math.max(1, Math.round(dmg * (1 - targetAb.cut)));
    }

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
  } else if (flameAt(nx, ny)) {
    // 炎にぶつかると、払って消せる(その場からは動かない)
    flames = flames.filter(f => f !== flameAt(nx, ny));
    addLog("炎を払い消した");
  } else {
    px = nx;
    py = ny;

    // 足元のアイテムを全部拾う
    for (const it of items.filter(i => i.x === nx && i.y === ny)) {
      items = items.filter(i => i !== it);
      if (it.book) obtainBook(it.book);
      else pickUpEquipment(it.equip);
    }
    // 墓の上:墓碑銘を読み、遺品があれば拾う
    if (graveAt(nx, ny)) visitGrave();

    if (stairs && nx === stairs.x && ny === stairs.y && stairsSealed()) {
      addLog(`階段は封印されている。${monsterName(aliveElite())}を倒さないと降りられない`);
    } else if (stairs && nx === stairs.x && ny === stairs.y && depth >= BALANCE.goalDepth) {
      handlePlayerDeath(true); // いちばん下の階段を降りたら踏破(ゴール)
      return;
    } else if (stairs && nx === stairs.x && ny === stairs.y) {
      openCamp(); // 次の階へ進む前にキャンプ(階段を降りた直後は、敵は動かない)
      return;
    }
  }

  endPlayerTurn();
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
  if (playerHP >= maxHP) {
    addLog("HPはすでに満タン");
    return;
  }
  turn += 1; // 回復薬を使うのも1ターン(その間に敵も動く)
  runStats.turns += 1;
  potions -= 1;
  const heal = Math.min(maxHP - playerHP, potionHealAmount());
  playerHP += heal;
  addLog(`回復薬を使った！ HPが${heal}回復`);
  endPlayerTurn();
}
