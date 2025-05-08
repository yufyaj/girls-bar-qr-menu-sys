/**
 * Supabaseマイグレーションを実行するスクリプト
 *
 * 使用方法:
 * 1. .env.localファイルにSUPABASE_URLとSUPABASE_ANON_KEYを設定
 * 2. npm run migrate を実行
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// .env.localファイルを読み込む
dotenv.config({ path: '.env.local' });

// 必要な環境変数が設定されているか確認
const { SUPABASE_URL, SUPABASE_ANON_KEY } = process.env;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('エラー: SUPABASE_URLとSUPABASE_ANON_KEYを.env.localファイルに設定してください。');
  process.exit(1);
}

// マイグレーションディレクトリのパス
const migrationsDir = path.join(__dirname, '..', 'supabase', 'migrations');

// マイグレーションファイルが存在するか確認
if (!fs.existsSync(migrationsDir)) {
  console.error(`エラー: マイグレーションディレクトリが見つかりません: ${migrationsDir}`);
  process.exit(1);
}

try {
  console.log('Supabaseマイグレーションを実行中...');

  // supabase CLIがインストールされているか確認
  try {
    execSync('supabase --version', { stdio: 'ignore' });
  } catch (error) {
    console.error('エラー: supabase CLIがインストールされていません。');
    console.error('インストール方法: https://supabase.com/docs/guides/cli');
    process.exit(1);
  }

  // コマンドライン引数を取得
  const args = process.argv.slice(2);
  const isReset = args.includes('--reset');
  const isDebug = args.includes('--debug');
  const specificMigration = args.find(arg => arg.startsWith('--file='));

  let command = '';

  if (isReset) {
    // データベースをリセットして全てのマイグレーションを適用
    command = 'supabase db reset';
    if (isDebug) {
      command += ' --debug';
    }
  } else if (specificMigration) {
    // 特定のマイグレーションファイルのみを適用
    const migrationFile = specificMigration.replace('--file=', '');
    const migrationPath = path.join(migrationsDir, migrationFile);

    if (!fs.existsSync(migrationPath)) {
      console.error(`エラー: マイグレーションファイルが見つかりません: ${migrationPath}`);
      process.exit(1);
    }

    command = `supabase db push --db-only ${isDebug ? '--debug' : ''}`;
  } else {
    // 新しいマイグレーションのみを適用
    command = `supabase db push --db-only ${isDebug ? '--debug' : ''}`;
  }

  console.log(`実行コマンド: ${command}`);

  // マイグレーションを実行
  execSync(command, {
    stdio: 'inherit',
    env: {
      ...process.env,
      SUPABASE_URL,
      SUPABASE_ANON_KEY
    }
  });

  console.log('マイグレーションが正常に完了しました！');
} catch (error) {
  console.error('マイグレーション中にエラーが発生しました:', error.message);
  process.exit(1);
}
