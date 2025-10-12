/**
 * 生成 Tauri 更新签名密钥对
 * 使用方法：node scripts/generate-update-key.js
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔐 正在生成 Tauri 更新签名密钥对...\n');

try {
  // 创建密钥存储目录
  const keyDir = path.join(process.env.HOME || process.env.USERPROFILE, '.tauri');
  if (!fs.existsSync(keyDir)) {
    fs.mkdirSync(keyDir, { recursive: true });
  }

  const keyPath = path.join(keyDir, 'videotoolbox.key');

  // 使用 Tauri CLI 生成密钥
  console.log('执行命令：tauri signer generate -w ' + keyPath);

  const output = execSync(`tauri signer generate -w "${keyPath}"`, {
    encoding: 'utf-8',
    stdio: 'pipe'
  });

  console.log(output);

  // 读取公钥
  const pubkeyPath = keyPath + '.pub';
  if (fs.existsSync(pubkeyPath)) {
    const pubkey = fs.readFileSync(pubkeyPath, 'utf-8').trim();

    console.log('\n✅ 密钥对生成成功！\n');
    console.log('📂 密钥文件位置：');
    console.log('   私钥：' + keyPath);
    console.log('   公钥：' + pubkeyPath + '\n');
    console.log('🔑 公钥内容（需要配置到 tauri.conf.json）：');
    console.log('─'.repeat(60));
    console.log(pubkey);
    console.log('─'.repeat(60));
    console.log('\n⚠️  请妥善保管私钥文件，不要泄露给他人！');
    console.log('⚠️  请将公钥复制到 src-tauri/tauri.conf.json 的 updater.pubkey 字段\n');

    // 自动更新 tauri.conf.json
    const confPath = path.join(__dirname, '../src-tauri/tauri.conf.json');
    if (fs.existsSync(confPath)) {
      const config = JSON.parse(fs.readFileSync(confPath, 'utf-8'));
      if (config.tauri && config.tauri.updater) {
        config.tauri.updater.pubkey = pubkey;
        fs.writeFileSync(confPath, JSON.stringify(config, null, 2));
        console.log('✅ 已自动更新 tauri.conf.json 中的公钥配置\n');
      }
    }

  } else {
    console.error('❌ 未找到生成的公钥文件');
  }

} catch (error) {
  console.error('❌ 密钥生成失败：', error.message);
  console.log('\n💡 请确保已安装 Tauri CLI：');
  console.log('   cargo install tauri-cli');
  console.log('\n   或使用 npm：');
  console.log('   npm install -g @tauri-apps/cli');
  process.exit(1);
}
