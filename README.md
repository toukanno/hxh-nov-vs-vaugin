# hxh-nov-vs-vaugin

ハンターハンターのノヴ vs ヴォーギンをモチーフにした、ブラウザでもiPhoneでも遊べるバトルロワイヤル風アクションゲームです。

## 遊び方

### デスクトップ (キーボード)

- `W A S D` または `↑←↓→` : 移動
- `Space` : 近距離攻撃（前方扇形）
- `Shift` : 回避ダッシュ（短時間無敵）

### モバイル / iOS アプリ (タッチ)

- 左下の仮想スティック : 移動
- 右下「攻撃」ボタン : 近距離攻撃
- 右下「回避」ボタン : 回避ダッシュ

## 勝利条件

- ノヴ（プレイヤー）が最後の1人になると勝利
- 体力が0になると敗北

## 起動方法（Web）

静的ファイルだけで動作します。

```bash
python3 -m http.server 8000
```

ブラウザで `http://localhost:8000` を開いてください。

## iOS アプリ化

Capacitor で WKWebView ベースの iOS ネイティブアプリとしてパッケージ済みです。

```bash
npm install
npm run cap:sync       # www を再生成し iOS プロジェクトに反映
npm run cap:open       # macOS のみ: Xcode で App.xcworkspace が開く
```

App Store Connect へのアップロード・審査提出までの詳細手順は以下を参照してください。

- [docs/ios-release-guide.md](docs/ios-release-guide.md)

## 企画書ドラフト

ユーザー向けシナリオをゲーム企画書形式に整理したドキュメントを追加しています。

- [docs/black-auction-gdd.md](docs/black-auction-gdd.md)
