// 酒場の依頼(クエスト)とゴールド:依頼の型・掲示板・進み具合・酒場の画面・右側の「依頼」欄
// index.html から <script src> で読み込まれる(読み込む順番は index.html に書いてある)
//
// 流れ:拠点の酒場で依頼を受ける(普通の依頼は questMaxAccepted 個まで + 特殊依頼1つ)
//   → 冒険中に条件を満たすと、その場で達成。ゴールドがすぐ拠点に届く(死んでもなくならない)
//   → 冒険が終わると、受けた依頼は消える(失敗しても罰はなし)。掲示板は、拠点に戻るたびに新しくなる

// ==================== 依頼の型 ====================
// 型を増やすときは QUEST_TYPES に足す
//   name:型の名前 / weight:掲示板に出る出やすさ / special:true なら特殊依頼の枠にだけ出る(縛りなど)
//   make(d, big):中身を決めて返す(d:基準の階 / big:大口なら true)。作れなければ null
//                返すものには reward(報酬のゴールド)を入れる。進み具合 progress などもここで用意する
//   text(q):依頼の文 / progressText(q):進み具合の文(右側の欄と酒場に出す)
//   onKill(q, m, sneak) / onFloor(q) / onPotion(q) / onRoute(q, route):冒険中のできごとで呼ばれる。達成したら true を返す
//     sneak:不意打ちで倒したら true / q.failed = true にすると失敗(縛りを破ったとき)
const QUEST_TYPES = {
  kill: {
    name: "討伐", weight: 4,
    make(d, big) {
      const data = pickWeighted(monsterList, d);
      if (!data) return null;
      const count = Math.round(randInt(3, 8) * (big ? BALANCE.questBigCount : 1));
      return { monsterId: data.id, depth: d, count, progress: 0, reward: questGold(BALANCE.questGold.kill * count, d) };
    },
    text: q => `${monsterNameOf(q.monsterId)}を${q.count}体倒す`,
    progressText: q => `${q.progress} / ${q.count}`,
    onKill(q, m) {
      if (m.data.id === q.monsterId) q.progress += 1;
      return q.progress >= q.count;
    },
  },
  clanKill: {
    name: "一族討伐", weight: 2,
    make(d, big) {
      // その階のあたりに出る敵がいる一族から選ぶ
      const clans = clanList.filter(c => monsterList.some(m => monsterClans(m).includes(c) && d >= m.minDepth && (m.maxDepth === null || d <= m.maxDepth)));
      if (clans.length === 0) return null;
      const clan = clans[randInt(0, clans.length - 1)];
      const count = Math.round(randInt(5, 10) * (big ? BALANCE.questBigCount : 1));
      return { clanId: clan.id, depth: d, count, progress: 0, reward: questGold(BALANCE.questGold.clanKill * count, d) };
    },
    text: q => `${(clanById(q.clanId) || { name: "？？？" }).name}の敵を${q.count}体倒す`,
    progressText: q => `${q.progress} / ${q.count}`,
    onKill(q, m) {
      if (monsterClans(m.data).some(c => c.id === q.clanId)) q.progress += 1; // 一族が2つある敵は、どちらの依頼にも数える
      return q.progress >= q.count;
    },
  },
  reach: {
    name: "到達", weight: 3,
    make(d, big) {
      const target = Math.min(BALANCE.goalDepth, Math.max(2, d + (big ? BALANCE.questBigDepth : 0)));
      return { depth: target, reward: questGold(BALANCE.questGold.reach * target, target) };
    },
    text: q => `地下${q.depth}階までたどり着く`,
    progressText: () => (inRunScreen() ? `今 地下${depth}階` : "未達成"),
    onFloor: q => depth >= q.depth,
  },
  elite: {
    name: "エリート討伐", weight: 2,
    make(d) {
      // 基準の階のまわりの、エリートの階(10・20 …階)
      const every = BALANCE.eliteEveryFloors;
      const target = Math.min(BALANCE.goalDepth, Math.max(every, Math.round(d / every) * every));
      return { depth: target, reward: questGold(BALANCE.questGold.elite, target) };
    },
    text: q => `地下${q.depth}階のエリートを倒す`,
    progressText: () => "未達成",
    onKill: (q, m) => m.elite && !m.guardian && depth === q.depth,
  },

  // ---------- 特殊依頼(縛り。特殊依頼の枠にだけ出る。報酬は questSpecialReward 倍) ----------
  noPotion: {
    name: "縛り", weight: 1, special: true,
    make(d) {
      const target = Math.min(BALANCE.goalDepth, Math.max(3, d));
      return { depth: target, reward: questGold(BALANCE.questGold.noPotion * target, target) };
    },
    text: q => `回復薬を使わずに、地下${q.depth}階までたどり着く`,
    progressText: () => (inRunScreen() ? `今 地下${depth}階` : "未達成"),
    onFloor: q => depth >= q.depth,
    onPotion(q) {
      q.failed = true;
      addLog(`回復薬を使ったので、依頼「${questText(q)}」は失敗した`);
      return false;
    },
  },
  sneak: {
    name: "腕試し", weight: 1, special: true,
    make(d) {
      const count = randInt(4, 8);
      return { count, progress: 0, reward: questGold(BALANCE.questGold.sneak * count, d) };
    },
    text: q => `不意打ちで敵を${q.count}体倒す`,
    progressText: q => `${q.progress} / ${q.count}`,
    onKill(q, m, sneak) {
      if (sneak) q.progress += 1;
      return q.progress >= q.count;
    },
  },
  rough: {
    name: "冒険", weight: 1, special: true,
    make(d) {
      const count = 3;
      return { count, progress: 0, reward: questGold(BALANCE.questGold.rough * count, d) };
    },
    text: q => `分かれ道で、険しい道を${q.count}回選ぶ`,
    progressText: q => `${q.progress} / ${q.count}`,
    onRoute(q, route) {
      if (route.id === "rough") q.progress += 1;
      return q.progress >= q.count;
    },
  },
};

// 報酬のゴールド:もと × (1 + 階 × questGoldPerDepth)、±questGoldSpread のブレ
function questGold(amount, d) {
  const spread = 1 + (Math.random() * 2 - 1) * BALANCE.questGoldSpread;
  return Math.max(1, Math.round(amount * (1 + d * BALANCE.questGoldPerDepth) * spread));
}

function monsterNameOf(id) {
  return (monsterList.find(m => m.id === id) || { name: "？？？" }).name;
}

// 依頼の文(大口・特殊の印は questTagHTML で別に出す)
function questText(q) {
  return QUEST_TYPES[q.type].text(q);
}

// ==================== 掲示板 ====================
// 依頼の基準の階:これまでの最高到達階の半分 〜 最高+5階 のどこか
function questBaseDepth() {
  const best = Math.max(1, base.records.bestDepth);
  const lo = Math.max(1, Math.floor(best / 2));
  return randInt(lo, Math.min(BALANCE.goalDepth, best + 5));
}

// 依頼を1つ作る(special:特殊依頼の型から)。作れなければ null
function makeQuest(special) {
  const types = Object.keys(QUEST_TYPES).filter(id => !!QUEST_TYPES[id].special === special);
  for (let tries = 0; tries < 20; tries++) {
    // 型を weight の出やすさで選ぶ
    const total = types.reduce((sum, id) => sum + QUEST_TYPES[id].weight, 0);
    let r = Math.random() * total, type = types[types.length - 1];
    for (const id of types) {
      r -= QUEST_TYPES[id].weight;
      if (r < 0) { type = id; break; }
    }
    const big = !special && type !== "elite" && Math.random() < BALANCE.questBigChance;
    const q = QUEST_TYPES[type].make(questBaseDepth(), big);
    if (!q) continue;
    q.type = type;
    q.uid = `q${Date.now()}_${randInt(0, 999999)}`;
    if (big) { q.big = true; q.reward = Math.round(q.reward * BALANCE.questBigReward); }
    if (special) { q.special = true; q.reward = Math.round(q.reward * BALANCE.questSpecialReward); }
    return q;
  }
  return null;
}

// 掲示板を新しくする(force でなければ、まだ作っていないときだけ)
function refreshQuestBoard(force = false) {
  const qs = base.quests;
  if (qs.board && !force) return;
  qs.board = [];
  for (let i = 0; i < BALANCE.questBoardSize * 3 && qs.board.length < BALANCE.questBoardSize; i++) {
    const q = makeQuest(false);
    // 同じ文の依頼は2つ並べない
    if (q && !qs.board.some(x => questText(x) === questText(q))) qs.board.push(q);
  }
  qs.special = Math.random() < BALANCE.specialQuestChance ? makeQuest(true) : null;
  saveGame();
}

// 掲示板の行(普通の依頼のあとに、特殊依頼)
function tavernRows() {
  return [...(base.quests.board || []), ...(base.quests.special ? [base.quests.special] : [])];
}

function isAccepted(q) {
  return base.quests.accepted.some(x => x.uid === q.uid);
}

// 依頼を受ける / やめる(普通の依頼は questMaxAccepted 個まで、特殊依頼は1つまで)
function toggleQuest(q) {
  const acc = base.quests.accepted;
  if (isAccepted(q)) {
    base.quests.accepted = acc.filter(x => x.uid !== q.uid);
    addLog(`依頼「${questText(q)}」をやめた`);
  } else if (q.special && acc.some(x => x.special)) {
    addLog("特殊依頼は1つまでしか受けられない");
  } else if (!q.special && acc.filter(x => !x.special).length >= BALANCE.questMaxAccepted) {
    addLog(`普通の依頼は${BALANCE.questMaxAccepted}つまでしか受けられない`);
  } else {
    acc.push(JSON.parse(JSON.stringify(q))); // 冒険中に進み具合を書きこむので、コピーを受ける
    addLog(`依頼「${questText(q)}」を受けた(報酬 ${q.reward}G)`);
  }
  saveGame();
}

// 冒険が終わったとき:受けていた依頼を消し、掲示板を次に拠点に戻ったとき新しくする
function endRunQuests() {
  base.quests.accepted = [];
  base.quests.board = null;
  base.quests.special = null;
}

// ==================== 依頼の進み具合 ====================
// 冒険中のできごとを、受けている依頼に伝える(kind:"onKill" / "onFloor" / "onPotion" / "onRoute")
function questEvent(kind, ...args) {
  if (!runStats) return;
  for (const q of base.quests.accepted) {
    if (q.done || q.failed) continue;
    const fn = QUEST_TYPES[q.type][kind];
    if (fn && fn(q, ...args)) completeQuest(q);
  }
  drawQuestPanel();
}

// 依頼達成:ゴールドがすぐ拠点に届く
function completeQuest(q) {
  q.done = true;
  base.gold += q.reward;
  if (runStats) runStats.gold = (runStats.gold || 0) + q.reward;
  addLog(`依頼達成！「${questText(q)}」 ${q.reward}ゴールドを手に入れた`);
  saveGame();
}

// 依頼の状態の文(右側の欄・酒場用)
function questStateHTML(q) {
  if (q.done) return span("up", "達成！");
  if (q.failed) return span("down", "失敗");
  return span("sub", QUEST_TYPES[q.type].progressText(q));
}

// 依頼の印(特殊・大口)
function questTagHTML(q) {
  if (q.special) return `<span class="quest-tag special">特殊</span> `;
  if (q.big) return `<span class="quest-tag big">大口</span> `;
  return "";
}

// ==================== 右側の「依頼」欄 ====================
// 受けている依頼と進み具合、持っているゴールドを、いつでも出す
function drawQuestPanel() {
  const goldEl = document.getElementById("gold");
  const el = document.getElementById("quests");
  if (!goldEl || !el) return;
  goldEl.textContent = `${base.gold}G`;
  const acc = base.quests.accepted;
  if (acc.length === 0) {
    el.innerHTML = span("dim", screenMode === "town" ? "受けている依頼はない(酒場で受けられる)" : "受けている依頼はない");
    return;
  }
  el.innerHTML = acc.map(q => `<div class="quest-row">${questTagHTML(q)}<span>${esc(questText(q))}</span>`
    + `<span class="quest-state">${questStateHTML(q)}</span></div>`).join("");
}

// ==================== 酒場の画面 ====================
function drawTownTavern() {
  const rows = tavernRows();
  const acc = base.quests.accepted;
  let h = `<div class="status-top"><span>所持 <b>${base.gold}</b>G</span>`
        + `<span>受けている依頼 ${acc.filter(q => !q.special).length} / ${BALANCE.questMaxAccepted}${acc.some(q => q.special) ? "(+特殊)" : ""}</span></div>`;
  h += `<div class="note">受けた依頼は、次の冒険のあいだだけ有効。冒険中に条件を満たすと、その場でゴールドが届く(死んでもなくならない)。掲示板は潜るたびに入れ替わる</div>`;
  if (rows.length === 0) h += `<div class="dim">今は依頼がない</div>`;
  const cols = "1.4em 3.2em 1fr 6em";
  rows.forEach((q, i) => {
    if (q.special && i > 0) h += `<div class="list-gap"></div>`; // 特殊依頼は少し離して出す
    h += gridRow(i === townCursor, cols, [
      isAccepted(q) ? span("tag", "受") : "",
      questTagHTML(q),
      esc(questText(q)),
      span("up", `${q.reward}G`),
    ]);
  });
  // 選んでいる依頼のくわしいこと
  const sel = rows[townCursor];
  if (sel) {
    const t = QUEST_TYPES[sel.type];
    h += `<div class="info"><div>${esc(t.name)}${sel.special ? "(特殊依頼:普通の依頼とは別に1つ受けられる)" : ""}${sel.big ? "(大口:数が多い・階が深いぶん、報酬が多い)" : ""}</div>`
       + `<div class="sub">${isAccepted(sel) ? "Enter でやめる" : "Enter で受ける"}</div></div>`;
  }
  setScreen("拠点 - 酒場", h, false);
  setHint([["↑↓", "選ぶ"], ["Enter / Space", "受ける / やめる"], ["Esc / Q", "戻る"]]);
}

// 酒場のキー操作
function tavernKey(e) {
  const rows = tavernRows();
  if (e.key === "ArrowUp") townCursor = Math.max(0, townCursor - 1);
  else if (e.key === "ArrowDown") townCursor = Math.max(0, Math.min(rows.length - 1, townCursor + 1));
  else if (e.key === "Enter" && rows[townCursor]) toggleQuest(rows[townCursor]);
  else if (e.key === "Escape") { backToTownMenu(); return; }
  render();
}
