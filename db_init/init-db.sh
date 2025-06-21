#!/bin/bash
set -e # エラーが発生した場合にスクリプトを終了する

# PostgreSQLが起動するまで待機（docker-entrypoint-initdb.d内のスクリプトは通常、PostgreSQLが準備できた後に実行されますが、念のため）
echo "init-db.sh: PostgreSQLが利用可能になるまで待機中..."
until pg_isready -h localhost -p 5432 -U "$POSTGRES_USER"; do
  >&2 echo "init-db.sh: Postgresはまだ利用できません - スリープ中"
  sleep 1
done
echo "init-db.sh: Postgresは起動しました - 初期化スクリプトを実行中"

# dvdrental データベースが存在するか確認
# psql -tAc "SELECT 1 FROM pg_database WHERE datname='dvdrental'" コマンドは、
# データベースが存在すれば '1' を返し、存在しなければ何も返さない
DB_NAME="dvdrental"
DB_EXISTS=$(psql -h localhost -U "$POSTGRES_USER" -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'")

if [[ "$DB_EXISTS" == "1" ]]; then
  echo "init-db.sh: データベース '$DB_NAME' は既に存在します。作成とリストアをスキップします。"
else
  echo "init-db.sh: データベース '$DB_NAME' が存在しません。作成とリストアを開始します..."
  # データベースを作成
  createdb -h localhost -U "$POSTGRES_USER" -E UTF8 "$DB_NAME"
  echo "init-db.sh: データベース '$DB_NAME' を作成しました。"

  # dvdrental.tar からデータをリストア
  # docker-compose.yml で dvdrental.tar を /docker-entrypoint-initdb.d/dvdrental.tar にマウントすることを想定
  pg_restore -h localhost -U "$POSTGRES_USER" -d "$DB_NAME" "/docker-entrypoint-initdb.d/dvdrental.tar"
  echo "init-db.sh: '$DB_NAME' データベースへのデータリストアが正常に完了しました。"
fi
