// ==================== 呪われた装備の効果データ ====================
// 呪われた装備には「良い効果」と「呪い」が1つずつランダムで付く。index.html から読み込まれる
// 良い効果が強いほど、呪いも重くなる(強さは min〜max の間で決まる)
// 効果を増やしたいときは、{ ... }, のかたまりをコピーして書き換えればOK
//
//   id    :効果を区別するための名前(半角英数字。良い効果と呪いで同じ id を使わない)
//   name  :画面に出る名前
//   desc  :説明。{v} のところに強さの数字が入る
//   short :一覧に出す短い説明(省略すると desc と同じ)
//   min / max :強さの範囲
//   stat  :(呪いだけ)ステータスを下げる呪いなら、そのステータス(hp / atk / def / luk / agl / crt)
//   scale :true にすると、深い階で拾った装備ほど強さが大きくなる(装備の基礎値と同じ倍率)
//   noRoll:true にすると、呪われた装備にランダムでは付かない(決まった装備にだけ、equipment.js の effects で付ける効果)
//
// 効果の働き方は id で決まっているので、新しい id を足したときは js/ のプログラムにも処理が必要
//   (stat を書いた呪いは、処理を足さなくてもそのステータスを下げる)

const BLESSING_DATA = [
  { id: "followUp",  name: "追撃",     desc: "攻撃すると、与えたダメージの{v}%で追撃する", short: "追撃{v}%", min: 15, max: 35 },
  { id: "lifeSteal", name: "吸血",     desc: "攻撃すると、与えたダメージの{v}%だけHPが回復する(1回の回復は、吸血1%につき3まで)", short: "吸血{v}%", min: 2, max: 5 },
  { id: "killHeal",  name: "糧",       desc: "敵を倒すとHPが{v}回復する", short: "撃破でHP+{v}", min: 5, max: 15, scale: true },
  { id: "dmgUp",     name: "剛力",     desc: "与えるダメージ+{v}%", min: 10, max: 25 },
  { id: "critDmg",   name: "急所狙い", desc: "会心のダメージ倍率+{v}%", min: 10, max: 30 },
  { id: "poisonHit", name: "毒刃",     desc: "攻撃すると20%の確率で敵を毒にする(5ターン、毎ターン{v}ダメージ)", short: "毒刃{v}", min: 5, max: 15, scale: true },
  // 決まった装備にだけ付く効果(ランダムでは付かない)。value は 1 と書く
  { id: "blindImmune", name: "影の目", desc: "盲目にならない", short: "盲目無効", min: 1, max: 1, noRoll: true },
];

const CURSE_DATA = [
  { id: "hpDown",    name: "虚弱",     desc: "HP-{v}",  stat: "hp",  min: 40, max: 120, scale: true },
  { id: "atkDown",   name: "非力",     desc: "ATK-{v}", stat: "atk", min: 15, max: 50,  scale: true },
  { id: "defDown",   name: "脆弱",     desc: "DEF-{v}", stat: "def", min: 30, max: 100, scale: true },
  { id: "aglDown",   name: "鈍重",     desc: "AGL-{v}", stat: "agl", min: 20, max: 60,  scale: true },
  { id: "dmgTaken",  name: "紙の守り", desc: "受けるダメージ+{v}%", min: 10, max: 30 },
  { id: "healDown",  name: "渇き",     desc: "回復量-{v}%", min: 20, max: 50 },
  { id: "enemyCrit", name: "隙",       desc: "敵の会心率+{v}%", min: 3, max: 10 },
];
