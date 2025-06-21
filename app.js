const express = require('express');
const app = express();
const port = 8000; // Docker Compose のポートマッピング 8000:8000 に合わせる

const pg = require("pg");

// 環境変数からデータベース接続情報を取得
// Docker Compose で設定した環境変数がここで読み込まれます
const pgPool = new pg.Pool({
  database: process.env.PG_DATABASE || "dvdrental",
  user: process.env.PG_USER || "postgres",
  password: process.env.PG_PASSWORD || "postgres",
  host: process.env.PG_HOST || "localhost", // ホスト名は 'db' になることを想定
  port: process.env.PG_PORT ? parseInt(process.env.PG_PORT) : 5432,
});

// JSONボディとURLエンコードされたボディをパースするためのミドルウェア
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/**
 * データベースから指定されたテーブルのデータを取得します。
 * エラーが発生した場合は例外をスローします。
 * @param {string} tableName - データを取得するテーブル名。
 * @returns {Promise<Array<Object>>} - 取得したデータのJSON配列。
 */
async function fetchDataFromTable(tableName) {
  const query = {
    text: `SELECT * FROM ${tableName};`, // テーブル名を動的に挿入
  };

  let client;
  try {
    client = await pgPool.connect(); // プールからクライアントを取得
    const result = await client.query(query); // クエリ実行
    console.log(`Fetched ${result.rows.length} rows from ${tableName}.`);
    return result.rows; // 取得したデータを返す
  } catch (err) {
    // クライアント取得またはクエリ実行エラー時の処理
    console.error(`Error fetching data from ${tableName}:`, err.stack);
    throw new Error(`Failed to fetch data from ${tableName}.`); // エラーを再スロー
  } finally {
    if (client) {
      client.release(); // クライアントをプールに戻す
    }
  }
}

/**
 * JSONデータ配列をHTMLテーブル形式の文字列に変換します。
 * @param {Array<Object>} data - 変換するJSONデータ配列。
 * @param {string} tableName - テーブルのタイトルに使用するテーブル名。
 * @returns {string} - 生成されたHTML文字列。
 */
function jsonToHtmlTable(data, tableName) {
  let html = `
    <!DOCTYPE html>
    <html lang="ja">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${tableName} Data</title>
      <script src="https://cdn.tailwindcss.com"></script>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
      <style>
        body { font-family: 'Inter', sans-serif; background-color: #f0f4f8; color: #334155; }
        .container { max-width: 90%; margin: 2rem auto; padding: 1.5rem; background-color: #ffffff; border-radius: 0.75rem; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); }
        table { width: 100%; border-collapse: separate; border-spacing: 0; margin-top: 1.5rem; border-radius: 0.5rem; overflow: hidden; }
        th, td { padding: 1rem 1.25rem; text-align: left; border-bottom: 1px solid #e2e8f0; }
        th { background-color: #e2e8f0; font-weight: 600; color: #1e293b; text-transform: uppercase; font-size: 0.875rem; }
        tr:nth-child(even) { background-color: #f8fafc; }
        tr:hover { background-color: #eff6ff; }
        td:first-child, th:first-child { border-top-left-radius: 0.5rem; }
        td:last-child, th:last-child { border-top-right-radius: 0.5rem; }
      </style>
    </head>
    <body class="p-4">
      <div class="container">
        <h1 class="text-3xl font-bold text-center mb-6 text-gray-800">${tableName} Data</h1>
        <div class="overflow-x-auto rounded-lg shadow-md">
          <table class="min-w-full">
            <thead>
              <tr>
  `;

  // ヘッダー行の生成
  if (data.length > 0) {
    Object.keys(data[0]).forEach(key => {
      html += `<th class="px-6 py-3">${key.toUpperCase()}</th>`;
    });
  }
  html += `
              </tr>
            </thead>
            <tbody>
  `;

  // データ行の生成
  data.forEach(row => {
    html += `<tr class="bg-white">`;
    Object.values(row).forEach(value => {
      // undefined, null, object (e.g., date objects) の表示を考慮
      let displayValue = value === null || value === undefined ? '' : value.toString();
      // 日付/時刻オブジェクトの場合、ISO文字列に変換
      if (value instanceof Date) {
        displayValue = value.toISOString();
      }
      html += `<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">${displayValue}</td>`;
    });
    html += `</tr>`;
  });

  html += `
            </tbody>
          </table>
        </div>
      </div>
    </body>
    </html>
  `;
  return html;
}


// ルート: / にアクセスしたときのレスポンス
app.get("/", function (req, res) {
  res.send("Hello from Express Web Server!");
});

/**
 * 汎用的なデータ取得ルートハンドラ。
 * フォーマット指定によりJSONまたはHTMLテーブルでデータを返します。
 * @param {string} tableName - 取得するテーブル名。
 */
function createTableDataRoute(tableName) {
  return async (req, res) => {
    try {
      const data = await fetchDataFromTable(tableName); // データをJSON形式で取得

      // クエリパラメータ'format'に応じて出力を切り替え
      if (req.query.format === 'html') {
        const htmlTable = jsonToHtmlTable(data, tableName); // JSONをHTMLテーブルに変換
        res.status(200).set('Content-Type', 'text/html').send(htmlTable);
      } else {
        // デフォルトはJSON形式で返す
        res.status(200).json(data);
      }
    } catch (error) {
      // エラーハンドリング
      console.error(`Error in /${tableName} route:`, error.stack);
      res.status(500).send(`Error retrieving ${tableName} data: ${error.message}`);
    }
  };
}

// 各テーブルのデータ取得ルートを生成
app.get("/actor", createTableDataRoute('ACTOR'));
app.get("/film", createTableDataRoute('FILM'));
app.get("/staff", createTableDataRoute('STAFF'));
app.get("/customer", createTableDataRoute('CUSTOMER'));


// POST ルートの例 (データベース連携なし)
app.post("/", function (req, res) {
  res.status(200).send("POST request received. No database interaction configured for this root currently.");
});

// Webサーバーの起動
app.listen(port, () => {
  console.log(`Web server listening at http://localhost:${port}`);
});

// データベース接続の初期テスト (サーバー起動時に一度だけ実行)
pgPool.query('SELECT NOW()')
  .then(() => console.log('Database connection successful!'))
  .catch(err => console.error('Database connection failed!', err.stack));

