---
name: web-search
description: 'Playwright のブラウザー自動化を使って Web から情報を検索します。ユーザーがオンラインで何かを探す、調べる、リサーチするよう依頼したときに使用してください。'
metadata:
  verb: search
---

# Web 検索スキル

Playwright MCP のブラウザーツールを使って Web を検索します。

## 手順

1. `https://www.google.com/search?q=<URL エンコード済みのクエリ>` にアクセスします。
2. 検索結果の読み込みを待ちます。
3. 上位 5 件の結果のタイトル、URL、スニペットを抽出します。
4. ユーザーがさらに詳細を求める場合は、最も関連性の高い結果を開いて主要な内容を抽出します。
5. 出典リンクを添えて、調査結果を簡潔にまとめます。

## ヒント

- ニュース検索では、Google の URL に `&tbm=nws` を追加してください。
- 直近の結果が必要な場合は、`&tbs=qdr:d`(過去 1 日)または `&tbs=qdr:w`(過去 1 週間)を追加してください。
- 必ず URL で出典を明示してください。
- Google でブロックされた場合は、DuckDuckGo を試してください: `https://duckduckgo.com/?q=<query>`
