import { query } from '../api/lib/database.js';

async function updateThemeToMono() {
  try {
    console.log('Updating theme to mono...');
    
    const result = await query(
      `UPDATE platform_settings 
       SET value = jsonb_build_object('presetId', 'mono'), updated_at = NOW()
       WHERE key = 'theme'`,
      []
    );
    
    console.log('Theme updated successfully to mono');
    console.log('Rows affected:', result.rowCount);
    
    // Verify the update
    const verification = await query('SELECT value FROM platform_settings WHERE key = $1', ['theme']);
    if (verification.rows?.length) {
      console.log('Current theme setting:', verification.rows[0].value);
    }
    
  } catch (error) {
    console.error('Error updating theme:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

updateThemeToMono();