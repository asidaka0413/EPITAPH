// 墓と遺品
// index.html から <script src> で読み込まれる(読み込む順番は index.html に書いてある)

// ==================== 墓と遺品 ====================
// 死ぬと、その階に墓が建つ(いちばん最近の1つだけ。base.grave)
//   墓の上に乗ると墓碑銘がログに出て、遺品(死んだときに着けていた装備から1つ)を拾える
//   遺品が残っているあいだは、自分を倒した敵が「墓守」(エリート)になって墓の隣で眠っている
//   墓守はこちらから攻撃するか、遺品を拾うまで動かない
let graveSpot = null; // この階の墓の位置 { x, y }(墓がない階は null)

function graveAt(x, y) {
  return !!graveSpot && graveSpot.x === x && graveSpot.y === y;
}

// 装備を遺品にする(コピーを作る)。キャンプで強化した分は、強化前の性能(+0)に戻す
//   強化が残ると、遺品を拾い直すたびに強化を重ねて、1つの装備が冒険をまたいで強くなり続けてしまうため
//   呪い・効果・個体差はそのまま
function makeRelic(eq) {
  const relic = JSON.parse(JSON.stringify(eq));
  if (relic.baseStats) relic.stats = { ...relic.baseStats };
  relic.plus = 0;
  return relic;
}

// 死んだとき:墓を建てる(前の墓は消える)
function buildGrave(totalKills) {
  const worn = Object.values(equipped).filter(eq => !eq.smith); // 鍛冶屋の装備は遺品にならない
  const relic = worn.length > 0 ? makeRelic(worn[randInt(0, worn.length - 1)]) : null; // 着けていた装備から1つ
  base.grave = {
    depth, killerId: runStats.killedById || null, killerName: runStats.killedBy || "何か",
    level: base.level, kills: totalKills, turns: runStats.turns, runNo: base.records.runs,
    relic, relicTaken: false,
  };
}

// この階が墓のある階なら、真ん中の部屋のどこかに墓を置き、遺品が残っていれば隣に墓守を眠らせる
function placeGrave(rooms) {
  graveSpot = null;
  const g = base.grave;
  if (!g || g.depth !== depth) return;
  const middle = rooms.length > 2 ? rooms.slice(1, rooms.length - 1) : rooms;
  const free = (x, y) => map[y] && map[y][x] === "." && !monsterAt(x, y) && !itemAt(x, y) && !chestAt(x, y) && !hazardAt(x, y)
    && !(x === px && y === py) && !(stairs && x === stairs.x && y === stairs.y) && !graveAt(x, y);
  for (let i = 0; i < 100 && !graveSpot; i++) {
    const r = middle[randInt(0, middle.length - 1)];
    const x = randInt(r.x, r.x + r.w - 1), y = randInt(r.y, r.y + r.h - 1);
    if (free(x, y)) graveSpot = { x, y };
  }
  if (!graveSpot || !g.relic || g.relicTaken || !g.killerId) return;
  const data = monsterList.find(m => m.id === g.killerId);
  const spot = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [graveSpot.x + dx, graveSpot.y + dy]).find(([x, y]) => free(x, y));
  if (data && spot) {
    monsters.push(newMonster(data, spot[0], spot[1], { elite: true, guardian: true, dormant: true }));
  }
}

// 墓のある階に来たときのお知らせ
function announceGrave() {
  if (!graveSpot) return;
  const g = base.grave;
  addLog(g.relic && !g.relicTaken
    ? `この階のどこかに、前の自分の墓がある。遺品(${equipName(g.relic)})が眠っている…`
    : "この階のどこかに、前の自分の墓がある");
}

// 墓碑銘(墓に刻まれていること)
function epitaphLines(g) {
  return [
    `――ここに眠る。${g.runNo}回目の冒険、Lv.${g.level}の冒険者`,
    `　${depthLabel(g.depth)}にて、${g.killerName === "自害" ? "自ら命を絶つ" : `${g.killerName}に倒れる`}。倒した敵 ${g.kills}体、${g.turns}ターン`,
  ];
}

// 墓の上に乗ったとき:墓碑銘を読み、遺品があれば拾う(墓守が目を覚ます)
function visitGrave() {
  const g = base.grave;
  epitaphLines(g).forEach(addLog);
  if (!g.relic || g.relicTaken) return;
  g.relicTaken = true;
  addLog(`遺品を手に入れた`);
  pickUpEquipment(JSON.parse(JSON.stringify(g.relic)), false); // 前に拾った装備なので、図鑑の拾った回数は増やさない
  const guard = monsters.find(m => m.guardian && m.dormant);
  if (guard) wakeGuardian(guard, "墓を荒らす気配に");
  saveGame();
}

// 墓守を起こす
function wakeGuardian(m, reason) {
  m.dormant = false;
  m.hunting = true;
  addLog(`${reason}${monsterName(m)}が目を覚ました！`);
}
