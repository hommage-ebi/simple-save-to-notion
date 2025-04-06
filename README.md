# simple-save-to-notion

ワンクリックで現在のウェブページ情報をNotionデータベースに保存できるChrome拡張機能です。以下の特徴があります。

- 現在のページのURL、タイトル、説明、OGP画像をNotionに保存
- ページが保存された時間を自動的に記録
- ページがすでにNotionに保存されているかチェック
- 保存したページをNotionで直接開くためのリンクを提供
- Notion APIキーの安全な扱い

## セットアップ

### Notion
1. https://www.notion.so/profile/integrations でNotionインテグレーションを作成
2. テンプレートDBをコピー
3. テンプレートDBへインテグレーションのアクセス権を付与

### インストール

1. このリポジトリをクローンまたはダウンロード
2. 依存関係をインストールして拡張機能をビルド：
   ```
   npm install
   ```
3. ビルド：
   ```
   npm run build
   ```
4. Chromeを開き、`chrome://extensions/`に移動
5. 右上の「デベロッパーモード」スイッチをオンにする
6. 「パッケージ化されていない拡張機能を読み込む」をクリックし、ビルドプロセスで作成された`dist`ディレクトリを選択
7. オプションページを開く
   - インテグレーションIDを入力
   - データベースIDを入力

# Thanks
このコードはhttps://github.com/denkiwakame/arxiv2notion をもとにClineで作成されました。
