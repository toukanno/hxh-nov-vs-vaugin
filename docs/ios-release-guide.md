# iOS アプリリリース手順書

このドキュメントは `hxh-nov-vs-uvogin` を iOS アプリとして TestFlight / App Store にリリースするまでの完全手順です。
本リポジトリ側で用意済みの範囲と、macOS + Xcode 側で実施していただく範囲を明確に分けています。

---

## 1. 前提条件（macOS 側）

以下が必要です。Linux 側からは準備できません。

- macOS (最新 Ventura 以降推奨)
- Xcode 15 以降 (App Store Connect にアップロードするには Xcode 15+ 必須)
- Apple Developer Program 年間契約（有償 / 個人・法人）
- CocoaPods: `sudo gem install cocoapods`
- Node.js 18 以上（本リポジトリの `package.json` を使うため）

## 2. このリポジトリで既に整っている内容

- Web ゲーム本体 (`index.html` / `styles.css` / `game.js`)
  - タッチ操作 (仮想スティック + 攻撃/回避ボタン)
  - 高 DPI / レスポンシブキャンバス
  - セーフエリア対応 (`env(safe-area-inset-*)`)
  - バックグラウンド時の自動一時停止
- PWA マニフェスト (`manifest.webmanifest`)
- Capacitor 6 の iOS プロジェクト (`ios/App/`)
  - Bundle ID: `com.toukanno.hxhnovvsuvogin`
  - 表示名: `Nov vs Uvogin`
  - 対応向き: 横（iPhone / iPad）
  - ダークモード固定 / ステータスバー非表示
  - 輸出規制申告 `ITSAppUsesNonExemptEncryption = false`
- `Assets.xcassets` にアプリアイコン (1024×1024、アルファなし) とスプラッシュ (2732×2732) 生成済み
- `www/` 用ビルドスクリプト (`npm run sync:www`)
- アイコン再生成スクリプト (`npm run icons:generate`)

## 3. 初回セットアップ (macOS)

リポジトリをクローンしたあと、macOS で以下を実行します。

```bash
git clone git@github.com:toukanno/hxh-nov-vs-vaugin.git
cd hxh-nov-vs-vaugin
git checkout claude/ios-app-release-dudRo

npm install
npm run cap:sync       # www を更新して ios/App/App/public に反映
cd ios/App
pod install            # CocoaPods で Capacitor 系依存を解決
cd ../..

npm run cap:open       # Xcode で App.xcworkspace が開く
```

> 重要: 必ず **`App.xcworkspace`** を開いてください。`App.xcodeproj` ではなくワークスペース側です（CocoaPods 経由の依存を読み込むため）。

## 4. Xcode での設定

1. プロジェクトツリーで `App` ターゲットを選択。
2. **Signing & Capabilities** タブ:
   - "Automatically manage signing" を ON
   - **Team**: あなたの Apple Developer アカウントを選択
   - **Bundle Identifier**: `com.toukanno.hxhnovvsuvogin`
     - すでに他のアプリで使用済みの場合は App Store Connect 側と重複しない値に変更し、`capacitor.config.json` の `appId` も同じ値に合わせて `npm run cap:sync` を再実行してください。
3. **General** タブ:
   - **Display Name**: `Nov vs Uvogin`
   - **Version**: `1.0.0` 以降で自由
   - **Build**: アップロードするたびに **必ず** 1 ずつ増やす
   - **Minimum Deployments**: iOS 13.0 のままで可
4. **Info** タブ:
   - `CFBundleDevelopmentRegion` が `ja` になっていることを確認
   - 必要に応じてプライバシー説明文字列を追加（本アプリは権限を使わないため基本不要）

## 5. App Store Connect 側の準備

1. <https://appstoreconnect.apple.com/> にサインイン。
2. **マイ App** → **+** → **新規 App**:
   - プラットフォーム: iOS
   - 名前: `Nov vs Uvogin` (App Store の表示名, 最長 30 文字)
   - プライマリ言語: 日本語
   - バンドル ID: 上で設定したものを選択
   - SKU: 任意の一意文字列 (例: `hxh-nov-vs-uvogin-001`)
   - ユーザアクセス: フル
3. 以下の審査情報を用意:
   - スクリーンショット (iPhone 6.7" 必須、iPhone 6.5"、iPad Pro 12.9" など)
     - 横向きでプレイ画面、HUD が映ったものを推奨
   - アプリ説明文 (4000 字以内)
   - プロモーションテキスト (170 字以内)
   - キーワード (100 字以内)
   - サポート URL / マーケティング URL
   - プライバシーポリシー URL (必須)
   - 年齢区分 (本ゲームは軽度のアクション暴力表現があるため 9+ または 12+ 目安)
   - カテゴリ: プライマリ "ゲーム" / サブ "アクション"
4. **App プライバシー** セクションで「収集するデータ: なし」を選択 (本アプリは外部送信を行いません)

> ⚠️ 著作権に関する注意
> 本作はハンターハンターのキャラクター名 (ノヴ / ヴォーギン) をモチーフにしています。App Store は第三者 IP を含むアプリを原則拒否します。審査通過のためには以下のいずれかが必要です。
>
> - 集英社 / 冨樫義博氏からの正規ライセンス取得
> - タイトル・キャラクター名を完全にオリジナルへ差し替え
>
> ライセンスなしで提出すると審査で拒否 (Guideline 5.2 Intellectual Property) される可能性が高いため、公開前に必ず対応してください。

## 6. アーカイブとアップロード

1. Xcode 上部のデバイス選択を **Any iOS Device (arm64)** に変更。
2. **Product** → **Archive**。
3. 完了後に Organizer が開くので、該当アーカイブを選び **Distribute App**。
4. **App Store Connect** → **Upload** を選択。
5. 署名方法は "Automatically manage signing" のまま Next。
6. アップロード完了後、App Store Connect 側で "処理中" → "TestFlight で利用可能" に変わるまで 10〜30 分待ちます。

## 7. TestFlight で動作確認

1. App Store Connect の **TestFlight** タブに該当ビルドが表示されたら、輸出規制の質問に「いいえ / 標準暗号のみ」と回答 (すでに Info.plist に `ITSAppUsesNonExemptEncryption=false` を入れてあるため自動で省略されることもあります)。
2. 内部テスター / 外部テスターを追加して iPhone 実機で確認:
   - タッチスティックと攻撃/回避ボタンが反応するか
   - セーフエリア (ノッチ / Dynamic Island) に UI がかぶっていないか
   - バックグラウンド復帰後、ポーズから再開できるか
   - アプリアイコンが正しく表示されているか

## 8. 本番審査提出

1. App Store Connect の **App Store** タブ → **バージョン 1.0** → 該当ビルドを選択。
2. 審査メモ (英語) にテスト手順を記入:

   ```
   This is a single-player action game. No login required.
   Tap "開始 / リトライ" to start. Use the left virtual stick to move,
   right buttons to attack and dash.
   ```

3. **審査へ提出** をクリック。通常 24〜72 時間で審査結果が返ってきます。
4. 承認後は自動公開 / 日時指定公開のいずれかを選択して公開完了。

## 9. 追加リリース (v1.0.1 以降)

1. Web ゲームを編集 (`index.html` / `game.js` / `styles.css` など)。
2. 以下を実行:

   ```bash
   npm run cap:sync     # www を再生成し iOS プロジェクトに反映
   ```

3. Xcode で **Build** を 1 増やし、必要に応じて **Version** も上げる。
4. 手順 6 以降を繰り返す。

## 10. アイコンを差し替えたい場合

`scripts/generate-icons.mjs` を編集して絵柄を変えるか、1024×1024 の PNG を直接 `assets/icon.png` (アルファなし) に上書きし、以下を実行:

```bash
npx @capacitor/assets generate --ios --assetPath assets
npm run cap:sync
```

---

## トラブルシューティング

| 症状 | 対処 |
| --- | --- |
| `pod install` で `Unable to find a specification for CapacitorCordova` | `cd ios/App && pod repo update && pod install` |
| Xcode で "No account" エラー | Xcode → Settings → Accounts で Apple ID 追加 |
| アップロード時に "Invalid Binary" | Build 番号が既存と重複。1 つ上げて再アーカイブ |
| 審査で IP 侵害拒否 | タイトル / キャラ名をオリジナルに差し替えて再提出 |
| ステータスバーが残る | Info.plist の `UIStatusBarHidden` が true か確認 |
