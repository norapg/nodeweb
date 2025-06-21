初動がなぜかおかしいが、
docker-compose run --rm web npm init -y
docker-compose run --rm web npm install pg
この辺をやり直すと docker-compose up --build -d で動いた。

http://localhost:8000/actor にアクセスするとJSONデータ
http://localhost:8000/actor?format=html にアクセスするとHTMLテーブル
が帰る
