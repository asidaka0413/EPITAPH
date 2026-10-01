// ==================== 一族データ ====================
// 敵の「一族」と、刻印のセット効果。index.html から読み込まれる
// 同じ一族の固有装備から刻んだ刻印をそろえると、ボーナス(セット効果)が付く
//   敵がどの一族かは、monsters.js の clan に、ここの id を書く
//   刻印は「その枠に装備を着けているときだけ」数える(刻印の効果と同じ)
//   合成した刻印は、元の2つの一族それぞれに1個ずつ数える(同じ一族どうしなら1個)
//
//   id    :一族を区別するための名前(半角英数字)
//   name  :画面に出る名前
//   short :短い名前(刻印の横に出す札に使う)
//   color :一族の色(札の色と、colors に書いていない敵のマップ上の色)
//   colors:敵ごとのマップ上の色(monsters.js の id → 色)。同じ一族でも見分けられるよう、明るさを少しずつ変える
//           エリートの金色・墓守の薄い金色は、この色より優先される。一族のない敵は monsters.js の color のまま
//   sets  :セット効果。count 個そろうと効く(sets: [] ならセット効果なしの一族。刻印の札と、依頼の「一族討伐」には出る)。desc:説明 / 効果(下のどれか。数値はすべて仮)
//             stats        … ステータスが上がる(例:{ agl: 60 })
//             shieldBlock  … 盾で防ぐ% が増える(例:10 なら +10%)
//             alarmImmune  … ゴブリンの呼び子の角笛が効かない(吹かれても仲間が集まらない)
//             poisonHalf   … 毒が半分のターンで抜ける
//             weakenImmune … 衰弱にならない
//             guts         … 食いしばり(体力アップの書3の特性と同じ。両方あっても1回の冒険で1回だけ)
//             burnImmune   … やけどにならない
//             damageCut    … 受けるダメージを減らす。[{ category: 種類, element: 属性, rate: 減らす割合 }, …]
//                            category・element は elements.js の id。書かなかったほうは「何でも」。rate 0.5 なら半分
//                            例:[{ category: "dot", rate: 0.3 }] … 状態異常(毒・やけど)のダメージを30%減らす
//                            いくつも当てはまるときは、掛け算で減る(半分 × 半分 = 4分の1)
//   効果を増やしたいときは、js/ のプログラムにも処理が必要(stats だけは処理を足さなくても効く)

const CLAN_DATA = [
  {
    id: "goblins", name: "ゴブリン一族", short: "ゴブリン", color: "#6fcf5f", // 緑系
    colors: { goblin: "#6fcf5f", caller: "#b5e070", archer: "#3fb88a", chieftain: "#a0f070" },
    sets: [
      { count: 2, desc: "盾で防ぐ% +10", shieldBlock: 10 },
      { count: 4, desc: "ゴブリンの呼び子の角笛が効かない", alarmImmune: true },
    ],
  },
  {
    id: "beasts", name: "獣", short: "獣", color: "#c8a070", // 茶色系
    colors: { rat: "#c8a070", bat: "#9c8060", spider: "#e6c49a", slime: "#b89040", basilisk: "#a87850", direwolf: "#8c7a6a" },
    sets: [
      { count: 2, desc: "AGL+60", stats: { agl: 60 } },
      { count: 4, desc: "毒が半分のターンで抜ける", poisonHalf: true },
    ],
  },
  {
    id: "undead", name: "不死", short: "不死", color: "#b8d0ff", // 青白系
    colors: { wisp: "#9cc8ff", skeleton: "#e4ecf8", wraith: "#b0b8ff", vampire: "#d0c8ff", necromancer: "#8c98e0" },
    sets: [
      { count: 2, desc: "衰弱にならない", weakenImmune: true },
      { count: 4, desc: "食いしばり(1回の冒険で1度だけ、死ぬダメージをHP1で耐える。書の食いしばりと重ねても1回だけ)", guts: true },
    ],
  },
  {
    id: "heavy", name: "重装", short: "重装", color: "#a8acb4", // 灰色系
    colors: { orc: "#a0a0a0", knight: "#dcdfe6", troll: "#80848a", golem: "#b4bccc", darkknight: "#6c7480" },
    sets: [
      { count: 2, desc: "DEF+80", stats: { def: 80 } },
      { count: 4, desc: "爆発・火属性のダメージが半分(やけども)",
        damageCut: [{ category: "explosion", rate: 0.5 }, { element: "fire", rate: 0.5 }] },
    ],
  },
  {
    // 竜より格が上の「龍」の一族も、いずれ別に作る予定
    id: "dragons", name: "竜", short: "竜", color: "#e8603c", // 赤橙系
    colors: { salamander: "#ff7a50", lizardman: "#d05a3a", wyvern: "#f09060", drake: "#ff4a3a" },
    sets: [
      { count: 2, desc: "やけどにならない", burnImmune: true },
      { count: 4, desc: "ブレスのダメージが半分(属性に関係なく)", damageCut: [{ category: "breath", rate: 0.5 }] },
    ],
  },
  {
    // どの一族にも属さない、はぐれた者たち。セット効果はない
    id: "outcasts", name: "はぐれ者", short: "はぐれ", color: "#c9a227", // 黄土色系(呪いの紫と紛れないように)
    colors: { thief: "#c9a227", bomber: "#e8c020" },
    sets: [],
  },
];
