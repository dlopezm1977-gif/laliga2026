// One-time script: download team crests from football-data.org → public/crests/
// Run: node scripts/download-crests.js

const fs   = require('fs');
const path = require('path');

const FD_TOKEN = process.env.FOOTBALL_DATA_TOKEN;
if (!FD_TOKEN) { console.error('Missing FOOTBALL_DATA_TOKEN'); process.exit(1); }

const SHORT_NAMES = {
  'Real Madrid CF':                'Real Madrid',
  'FC Barcelona':                  'Barcelona',
  'Club Atlético de Madrid':       'Atlético',
  'Sevilla FC':                    'Sevilla',
  'Real Betis Balompié':           'Betis',
  'Real Sociedad de Fútbol':       'Real Sociedad',
  'Villarreal CF':                 'Villarreal',
  'Athletic Club':                 'Athletic',
  'Valencia CF':                   'Valencia',
  'CA Osasuna':                    'Osasuna',
  'RC Celta de Vigo':              'Celta',
  'Getafe CF':                     'Getafe',
  'Rayo Vallecano de Madrid':      'Rayo',
  'Deportivo Alavés':              'Alavés',
  'RCD Espanyol de Barcelona':     'Espanyol',
  'Real Racing Club de Santander': 'Racing',
  'Levante UD':                    'Levante',
  'RC Deportivo La Coruña':        'Deportivo',
  'Elche CF':                      'Elche',
  'Málaga CF':                     'Málaga',
};

const slugify = name =>
  name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, '-');

async function main() {
  const outDir = path.join(__dirname, '..', 'public', 'crests');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  console.log('Fetching La Liga teams from football-data.org…');
  const res = await fetch(
    'https://api.football-data.org/v4/competitions/PD/teams?season=2026',
    { headers: { 'X-Auth-Token': FD_TOKEN } }
  );
  if (!res.ok) {
    console.error(`API error ${res.status}: ${await res.text()}`);
    process.exit(1);
  }
  const { teams } = await res.json();
  console.log(`Got ${teams.length} teams\n`);

  for (const team of teams) {
    const shortName = SHORT_NAMES[team.name];
    if (!shortName) { console.warn(`  ⚠ No mapping for: "${team.name}"`); continue; }
    if (!team.crest) { console.warn(`  ⚠ No crest URL for: ${shortName}`); continue; }

    const ext      = path.extname(new URL(team.crest).pathname) || '.svg';
    const fileName = `${slugify(shortName)}${ext}`;
    const filePath = path.join(outDir, fileName);

    const crestRes = await fetch(team.crest);
    if (!crestRes.ok) { console.warn(`  ⚠ Failed to download crest for ${shortName}: ${crestRes.status}`); continue; }

    fs.writeFileSync(filePath, Buffer.from(await crestRes.arrayBuffer()));
    console.log(`  ✓ ${shortName.padEnd(14)} → public/crests/${fileName}`);
  }

  console.log('\nDone!');
}

main().catch(err => { console.error(err); process.exit(1); });
