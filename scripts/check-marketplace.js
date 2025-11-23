import { query } from '../api/lib/database.js';
import dotenv from 'dotenv';

dotenv.config();

async function checkMarketplace() {
  try {
    const result = await query('SELECT id, name, category, is_active FROM paas_marketplace_templates ORDER BY created_at DESC');
    
    console.log(`\n📱 Marketplace templates: ${result.rows.length}\n`);
    
    if (result.rows.length > 0) {
      result.rows.forEach(tpl => {
        console.log(`Template: ${tpl.name}`);
        console.log(`  ID: ${tpl.id}`);
        console.log(`  Category: ${tpl.category || 'None'}`);
        console.log(`  Active: ${tpl.is_active}`);
        console.log('');
      });
    } else {
      console.log('❌ No marketplace templates found!\n');
      console.log('💡 Add templates via the admin dashboard: /admin/paas/marketplace\n');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkMarketplace();
