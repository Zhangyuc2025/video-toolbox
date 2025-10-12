// 检查 Supabase 配置
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 加载 .env 文件
config({ path: resolve(__dirname, '.env') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';

console.log('='.repeat(60));
console.log('Supabase 配置检查');
console.log('='.repeat(60));

console.log('\n1. 环境变量值:');
console.log('   VITE_SUPABASE_URL:', SUPABASE_URL ? '✅ 已配置' : '❌ 未配置');
console.log('   实际值:', SUPABASE_URL);
console.log('\n   VITE_SUPABASE_ANON_KEY:', SUPABASE_ANON_KEY ? '✅ 已配置' : '❌ 未配置');
console.log('   实际值:', SUPABASE_ANON_KEY.substring(0, 50) + '...');

console.log('\n2. 配置有效性检查:');
const isValid = SUPABASE_URL &&
                SUPABASE_ANON_KEY &&
                !SUPABASE_URL.includes('your-project') &&
                !SUPABASE_ANON_KEY.includes('your-anon-key');

console.log('   配置是否有效:', isValid ? '✅ 是' : '❌ 否');

if (!isValid) {
  console.log('\n⚠️ 配置无效的原因:');
  if (!SUPABASE_URL) console.log('   - SUPABASE_URL 为空');
  if (!SUPABASE_ANON_KEY) console.log('   - SUPABASE_ANON_KEY 为空');
  if (SUPABASE_URL.includes('your-project')) console.log('   - SUPABASE_URL 包含占位符');
  if (SUPABASE_ANON_KEY.includes('your-anon-key')) console.log('   - SUPABASE_ANON_KEY 包含占位符');
}

console.log('\n3. 建议:');
if (isValid) {
  console.log('   ✅ 配置正确');
  console.log('   请重启开发服务器: npm run dev');
} else {
  console.log('   ❌ 请检查 .env 文件中的配置');
  console.log('   确保 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY 已正确设置');
}

console.log('\n' + '='.repeat(60));
