# 柏サイエンスキャンプ(2022)

## 起動方法

2通りの起動方法があります。

1. dockerでサーバーを実行する
2. node.js(express)でサーバーを実行する
3. VSCodeの拡張機能「Live Server」を使う（おすすめ）

いずれの場合も http://localhost:3000/ にアクセスすることで動作を確認できます。

### サーバー実行 (Dockerでホストする場合)

Docker Desktop をインストールする。
https://www.docker.com/

```
docker-compose up
```
を実行する。

http://localhost:3000/ にアクセスする。

### サーバー実行 (Nodeでホストする場合)
node をインストールする
https://nodejs.org/ja/download/

依存ライブラリをインストールする。
```
npm install
```

実行する。
```
npm start
```

http://localhost:3000/ にアクセスする。
