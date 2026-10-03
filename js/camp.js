// キャンプ
// index.html から <script src> で読み込まれる(読み込む順番は index.html に書いてある)

// ==================== キャンプ ====================
// キャンプで選べること。選択肢を増やすときは、ここに { name, desc, apply } を足す
//   name:表示名 / desc:説明文を返す関数 / apply:選んだときの処理
//   pickEquip:true にすると、選んだあとに装備を1つ選ぶ画面が出る(apply には選んだ装備が渡される)
//   available:選べるかどうかを返す関数(省略すると、いつでも選べる)
const CAMP_OPTIONS = [
  {
    name: "休む",
    // 特性「野営上手」で回復量アップ(回復強化とは別に掛け算)
    desc: () => `HPを最大HPの${fmt(BALANCE.campHealRatio * 100)}%回復する${traitMax("campRestBoost", 0) > 0 ? `(野営上手で+${Math.round(traitMax("campRestBoost", 0) * 100)}%)` : ""}`,
    apply: () => {
      const heal = Math.min(maxHP - playerHP, Math.round(maxHP * BALANCE.campHealRatio * healMultiplier() * (1 + traitMax("campRestBoost", 0))));
      playerHP += heal;
      addLog(`キャンプで休んだ。HPが${heal}回復`);
    },
  },
  {
    name: "回復薬を補充",
    // 特性「行商の知恵」で +1個
    desc: () => `回復薬を${campPotionAmount()}個もらう(今 ${potions}個)`,
    apply: () => {
      potions += campPotionAmount();
      addLog(`回復薬を${campPotionAmount()}個補充した`);
    },
  },
  {
    name: "装備を強化",
    // 特性「鍛冶の心得」で2回強化する
    desc: () => `拾った装備を1つ、強化前の性能の${BALANCE.enhanceMinPercent}〜${BALANCE.enhanceMaxPercent}%ぶん強化する${campEnhanceTimes() > 1 ? `(鍛冶の心得で${campEnhanceTimes()}回)` : ""}(何回でも。素材は使わない)`,
    pickEquip: true,
    available: () => runPickups.length > 0,
    apply: (eq) => { for (let i = 0; i < campEnhanceTimes(); i++) enhanceEquipment(eq); },
  },
];

// キャンプの「回復薬を補充」でもらえる数(特性「行商の知恵」で増える)
function campPotionAmount() {
  return BALANCE.campPotionGain + traitMax("campPotionBonus", 0);
}

// キャンプの「装備を強化」で強化する回数(特性「鍛冶の心得」で増える)
function campEnhanceTimes() {
  return traitMax("campEnhanceTimes", 1);
}

let campPicking = false;   // キャンプで、装備を選んでいる最中か
let campPickCursor = 0;    // 装備を選ぶ一覧で選んでいる行の番号

function openCamp() {
  campCursor = 0;
  campPicking = false;
  screenMode = "camp";
  identifyLumps(); // 持っている謎の塊を鑑定する(出た装備は、このキャンプで強化にも使える)
  render();
}

// キャンプで強化する装備の一覧(装備中のものを枠の順に先に、そのあと持っているだけのもの)
function campEquipList() {
  const worn = Object.keys(EQUIP_SLOTS).map(s => equipped[s]).filter(eq => eq);
  return [...worn, ...runPickups.filter(eq => !worn.includes(eq))];
}

// 装備を1回強化する(上限なし)
//   上がる量は「強化前の性能(baseStats)」の5〜15%。毎回同じくらいずつ上がる(何回も強化しても強くなりすぎない)
//   強化する前の性能は baseStats に残っていて、刻むときもそちらを使う
function enhanceEquipment(eq) {
  const pct = rollEnhancePercent();
  const diff = applyEnhance(eq.stats, pct, eq.baseStats);
  eq.plus = (eq.plus || 0) + 1;
  if (equippedSlotOf(eq)) updateMaxHP(); // 着けている装備のHPが上がったら、最大HPも上げる
  addLog(`${pct >= 13 ? "大成功！ " : ""}${eq.name}を+${eq.plus}に強化した(+${pct}%) ${diff}`);
}

// キャンプで Enter:選んだものを実行して次の階へ(装備を選ぶものなら、先に装備の一覧を開く)
function chooseCamp() {
  const opt = CAMP_OPTIONS[campCursor];
  if (opt.available && !opt.available()) {
    addLog(`今は「${opt.name}」を選べない`);
    render();
    return;
  }
  if (opt.pickEquip && !campPicking) {
    campPicking = true;
    campPickCursor = 0;
    render();
    return;
  }
  turn += 1;
  // 毒・やけど・衰弱・鈍足・盲目・混乱・拘束・凍え・しびれはキャンプで治る
  const hadDots = cureDots();
  const hadAilments = cureAilments();
  playerBindGuard = 0;
  if (hadDots || hadAilments || playerWeak || playerSlow || playerBlind || playerConfused || playerBound) {
    playerWeak = null;
    playerSlow = null;
    playerBlind = null;
    playerConfused = null;
    playerBound = null;
    addLog("キャンプで一息ついて、体の調子が戻った");
  }
  if (opt.pickEquip) opt.apply(campEquipList()[campPickCursor]);
  else opt.apply();
  campPicking = false;
  // 選んだ道で、次の階へ(深い穴なら何階か下へ)
  goToFloor(nextDepth(), nextRoute || STAIR_ROUTES[0]);
  nextRoute = null;
  screenMode = "dungeon";
  render();
}
