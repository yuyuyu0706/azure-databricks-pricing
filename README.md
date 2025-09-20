# Azure Databricks Pricing Simulator Orange

- Azure Databricks の使用量課金（DBU 単価 × 使用量）と、（任意で）インフラ費用の概算をシミュレーションする、シンプルな静的Webアプリです。
- 社内見積・検討段階の粗い試算から、パラメータ調整による感度分析までを素早く回すことを狙いとしています。
- **愛称：Orange**（オレンジ）。静的ホスティング（GitHub Pages など）で動作します。

> ⚠️ 免責: 本ツールは参考用です。公式価格の変更や条件差異により実費と乖離する可能性があります。最終判断は必ず公式の価格情報・見積手段でご確認ください。

## デモ（GitHub Pages）

- URL : https://yuyuyu0706.github.io/azure-databricks-pricing/

## 目的

- **見積もりの初期あたり**で「だいたいのオーダー感」を掴むため
- **パラメータの感度**（ノード数・稼働時間・DBU効率など）を素早く比較するため
- 社内の非エンジニア/調達部門向けに、**根拠と出典が明確**な形で共有するため
- **重要**：DBU は Databricks の**プラットフォーム課金**です。
  - 実運用ではこれに **インフラ費用（VM・ストレージ・転送）** が加算されます。
- 本アプリはまず DBU 部分の計算を軸に、インフラ費も扱えるよう段階的に拡張します。


## 現時点で出来ること

- DBU 単価・DBU 使用量（または時間×係数）を入力し、**月次のプラットフォーム費用**を試算
- `pricing.json` のレートを読み込み、**出典・発効日**を UI に表示（将来の厳密化に備えた設計）
- 入力内容はブラウザに一時保存（localStorage）し、**前回の設定を復元**（実装済み or 近日実装）
- **A/B 比較**や**感度レンジ（±20%）**の表示はロードマップ項目です（下記参照）

## 使い方

### パターン1) ローカルで開く
- このリポジトリをクローンし、`index.html` をブラウザで開くだけです。
- もしくは、VS Code 拡張の「Live Server」等で起動しても OK です。

### パターン2) GitHub Pages で公開（推奨）
1. リポジトリの **Settings → Pages** を開く
2. **Build and deployment**: `Deploy from a branch`
3. **Branch**: `main` の `/ (root)` または `/docs` を選択
4. 表示された URL がデモ URL となります（README に追記すると便利）

> 参考: スクリーンショットは `docs/screenshot.png` などに配置してください（任意）。


## 入力パラメータ（例）

| 項目 | 例 | 説明 |
|---|---|---|
| ワークロード | Jobs / All‑Purpose / SQL / DLT / Model Serving / Serverless SQL | 将来はプリセットで切替（v0 は最小入力） |
| エディション | Standard / Premium など | 単価に影響 |
| リージョン | japaneast / eastus など | 将来はデータで切替 |
| DBU 単価 | 0.15 USD/DBU | `pricing.json` から読込 |
| DBU 消費量 | 1,200 DBU / 月 | 直接入力 or 「時間×係数」で算出 |
| 稼働時間 | 100 時間 / 月 | オプション（DBU直入力の代替） |
| インフラ費 | VM/Storage/Egress | v0 では**非表示**、将来拡張で追加 |

> **注**：実務では **アイドル自動終了** や **Auto-Scale (min/max/平均)**、**起動回数/日** が費用に効きます。


## 計算ロジック

- **DBU 費用** = `DBU 使用量 × DBU 単価`
- **インフラ費用** = VM / ストレージ / 転送の積み上げ（将来の拡張）
- **合計** = DBU 費用 + インフラ費用

> VM/ストレージ/ネットワーク等のインフラ費は別で発生（必要に応じて積み上げ）
> 丸めや端数（分課金/秒課金の切上げ等）はユースケースに合わせて**設定可能**にしていきます。
> 実務では、Auto-Scale/Idle Termination/スケジュール運用等で使用量が変動します（詳細は今後拡充）


## 価格データ：`pricing.json`

### 目的
- 価格や前提を **コードから分離** し、更新履歴・出典・発効日を持たせます。
- v0 はシンプル。今後はスキーマを厳密化し、**監査性**を高めます。

### シンプル版サンプル
```json
{
  "version": "2025-09-20",
  "currency": "USD",
  "workloads": [
    {
      "cloud": "Azure",
      "region": "japaneast",
      "edition": "Premium",
      "service": "Jobs Compute",
      "serverless": false,
      "dbu_rate": 0.15,
      "source": "https://www.databricks.com/product/azure-pricing",
      "effective_from": "2025-08-01",
      "notes": "DBU platform rate only; infra excluded."
    }
  ]
}
```

### フィールド定義（抜粋）
| フィールド | 型 | 必須 | 説明 |
|---|---|:---:|---|
| `version` | string | ✓ | データの発行日やバージョン。UIに表示 |
| `currency` | string | ✓ | `"USD"` など |
| `workloads[].cloud` | string | ✓ | 常に `"Azure"` を想定 |
| `workloads[].region` | string | ✓ | `"japaneast"` など |
| `workloads[].edition` | string | ✓ | `"Standard"` / `"Premium"` など |
| `workloads[].service` | string | ✓ | `"Jobs Compute"` / `"All‑Purpose"` / `"SQL"` / `"DLT"` / `"Model Serving"` 等 |
| `workloads[].serverless` | boolean | ✓ | Serverless かどうか |
| `workloads[].dbu_rate` | number | ✓ | 単価（通貨/DBU） |
| `workloads[].source` | string(URL) | ✓ | 公開情報の URL（一次情報） |
| `workloads[].effective_from` | string(date) | ✓ | レートの適用開始日 |
| `workloads[].notes` | string |  | 任意のメモ |


## ディレクトリ構成（提案）

```
.
├─ index.html
├─ style.css
├─ main.js                 # UI とイベント
├─ pricing.json            # レート定義（上記の v0 サンプル）
├─ /docs                   # GitHub Pages 用（任意）
│   └─ screenshot.png
├─ /schema                 # 将来: JSON Schema (Ajv 用)
│   └─ pricing.schema.json
├─ /src                    # 将来: TS 化して分割
│   ├─ calc.ts            # 計算（純関数）
│   ├─ format.ts          # 通貨/丸め/表記
│   └─ ui.ts              # 描画/バインド
└─ /tests                  # 将来: ユニットテスト（Jest など）
    └─ calc.spec.ts
```

## よくある質問（FAQ）

- Q. 公式の見積とズレます
A. 本ツールは簡易モデルです。Serverless/Reserved/スポット、最小課金単位、地域差、プロモ、為替等の要因で差が出ます。前提値を見直し、最終確認は公式にてお願いします。

- Q. 通貨を JPY にしたい
A. 初版は USD 基準です。為替入力欄や通貨切替は Roadmap に含めています。

- Q. 実績データから係数を当て込みたい
A. 将来、実測CSVの取り込みで“社内ベンチ係数”を反映できるようにする予定です。


## 開発メモ

- **計算ロジックを関数化**し、将来の TS 化・テスト容易性を確保
- **丸め/端数の扱い**と **A/B 比較** を最初の拡張ターゲットに
- `pricing.json` の **`source` と `effective_from` を UI 表示**
- 将来は `infra.vm_prices[]` や `storage` を追加し、**VM/Storage/転送**の積み上げも同一 JSON で扱える設計にします。

## ロードマップ

- **短期**
  - pricing.json のスキーマ導入と CI 検証（Ajv）
  - UI : A/B 比較
  - UI : 感度（±20%）表示
  - UI : 通貨/為替入力
  - ツールチップに出典表示
- **中期**
  - Auto-Scale/Idle/起動回数のモデリング
  - Serverless/SQL/Model Serving/DLT のプリセット化
  - UI : PDF/CSV エクスポート
- **長期**
  - インフラ積み上げ（VM/Storage/転送）
  - 予約（Prepurchase/DBCU）試算
  - 実測（Cost Management/Usage CSV）取り込み
  - UI : モンテカルロで分布を可視化

## 既知の制約 / 注意事項

- 本ツールは **試算支援** を目的とした OSS です。
  - **正確な価格は公式情報と請求実績** をご確認ください。
- 地域・エディション・ワークロード・キャンペーン等により **レートは変動** します。
- 本プロジェクトは **非公式** であり、Databricks/Microsoft とは関係ありません。


## ライセンス

MIT License © Contributors


## 貢献（Contributing）

Issues / PR 歓迎です。以下の点にご配慮ください。
- UI 文言は非エンジニアにも伝わる表現を優先する
- 価格データは出典URLと有効日を必ず明記する
- 計算ロジックは純関数化しテスト可能に保つ


### 謝辞

本ツールは、Azure Databricks の費用構造理解と、チーム内の初期見積・意思決定を支援する目的で作成されています。改善アイデアとなるIssue/PR、お待ちしています。

