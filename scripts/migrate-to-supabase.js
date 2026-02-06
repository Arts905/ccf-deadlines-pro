/**
 * Migrate conference data from JSON to Supabase
 * Run with: node scripts/migrate-to-supabase.js
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Load conference data
const conferencesPath = path.join(__dirname, '../public/conferences.json');
const conferencesData = JSON.parse(fs.readFileSync(conferencesPath, 'utf-8'));

async function migrateConferences() {
  console.log(`Starting migration of ${conferencesData.length} conferences...`);

  let successCount = 0;
  let errorCount = 0;
  const errors = [];

  for (const conf of conferencesData) {
    try {
      // Insert conference
      const { data: confData, error: confError } = await supabase
        .from('conferences')
        .insert({
          title: conf.title,
          description: conf.description,
          sub: conf.sub
        })
        .select('id')
        .single();

      if (confError) throw confError;

      const conferenceId = confData.id;

      // Insert rank
      if (conf.rank) {
        const { error: rankError } = await supabase
          .from('ranks')
          .insert({
            conference_id: conferenceId,
            ccf: conf.rank.ccf || null,
            core: conf.rank.core || null,
            thcpl: conf.rank.thcpl || null
          });

        if (rankError) throw rankError;
      }

      // Insert conference instances
      if (conf.confs && Array.isArray(conf.confs)) {
        for (const instance of conf.confs) {
          const { data: instanceData, error: instanceError } = await supabase
            .from('conference_instances')
            .insert({
              conference_id: conferenceId,
              year: instance.year,
              date: instance.date || null,
              place: instance.place || null,
              timezone: instance.timezone || 'UTC',
              link: instance.link || null
            })
            .select('id')
            .single();

          if (instanceError) throw instanceError;

          // Insert timeline items
          if (instance.timeline && Array.isArray(instance.timeline)) {
            const timelineItems = instance.timeline.map(item => ({
              instance_id: instanceData.id,
              deadline: item.deadline || null,
              abstract_deadline: item.abstract_deadline || null,
              comment: item.comment || null
            }));

            const { error: timelineError } = await supabase
              .from('timeline_items')
              .insert(timelineItems);

            if (timelineError) throw timelineError;
          }
        }
      }

      successCount++;
      console.log(`✓ Migrated: ${conf.title}`);

    } catch (error) {
      errorCount++;
      errors.push({ title: conf.title, error: error.message });
      console.error(`✗ Failed: ${conf.title} - ${error.message}`);
    }
  }

  console.log('\n=== Migration Summary ===');
  console.log(`Total: ${conferencesData.length}`);
  console.log(`Success: ${successCount}`);
  console.log(`Failed: ${errorCount}`);

  if (errors.length > 0) {
    console.log('\n=== Errors ===');
    errors.forEach(({ title, error }) => {
      console.log(`${title}: ${error}`);
    });
  }
}

migrateConferences()
  .then(() => {
    console.log('\nMigration completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
