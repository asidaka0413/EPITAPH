// ==================== 属性とダメージの種類 ====================
// プレイヤーが受けるダメージには「種類」と「属性」の2つの札が付く。index.html から読み込まれる
//   例:やけど = 種類「状態異常」+ 属性「火」/ 鬼火の炎 = 種類「遠距離攻撃」+ 属性「火」/ 爆ぜ虫の爆発 = 種類「爆発」(属性なし)
// ダメージを減らす効果(sets.js の damageCut など)は、「どの種類に効くか」「どの属性に効くか」を書くだけで作れる
//   例:{ category: "dot", rate: 0.3 } … 状態異常のダメージを30%減らす
//       { element: "fire", rate: 0.5 } … 火属性のダメージを半分にする(種類は問わない)

// ダメージの種類。id → 表示名
const DAMAGE_CATEGORIES = {
  melee:     "近接攻撃",   // となりからの攻撃
  ranged:    "遠距離攻撃", // 矢・鬼火の炎など、飛んでくる攻撃
  explosion: "爆発",       // 爆ぜ虫の爆発
  breath:    "ブレス",     // ドラゴンの扇形のブレス
  dot:       "状態異常",   // 毒・やけどなど、毎ターンのダメージ
};

// 属性。id → { name:表示名, color:表示の色, ballName:属性の球の名前, dot:当たったときの状態異常(js/enemies.js の DOT_TYPES の id) }
//   氷・雷などは、「龍」の一族を作るときに足す予定(状態異常も一緒に DOT_TYPES に足す)
const ELEMENT_DATA = {
  fire:   { name: "火", color: "#ff7a40", ballName: "火球",   dot: "burn" },
  poison: { name: "毒", color: "#c070e0", ballName: "毒の球", dot: "poison" },
};
