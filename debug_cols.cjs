const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkColumns() {
  const { data: columns, error } = await supabase
    .from('kanban_columns')
    .select('id, title, client_id, is_done_column, position, company_id')
    .order('position');

  if (error) {
    console.error('Error fetching columns:', error);
    return;
  }

  console.log('--- ALL COLUMNS ---');
  columns.forEach(col => {
    console.log(`ID: ${col.id} | Title: ${col.title} | ClientID: ${col.client_id} | Done: ${col.is_done_column} | CoID: ${col.company_id}`);
  });
}

checkColumns();
