// One-time script: download Segunda División team crests → public/crests-segunda/
// Run: node scripts/download-crests-segunda.js

const fs   = require('fs');
const path = require('path');

const slugify = name =>
  name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, '-');

// Nombre API bzzoiro → término de búsqueda en TheSportsDB
const TEAMS = [
  { name: 'Granada',                 search: 'Granada CF'         },
  { name: 'CD Castellón',            search: 'CD Castellon'       },
  { name: 'Leganés',                 search: 'CD Leganes'         },
  { name: 'Sporting Gijón',          search: 'Sporting Gijon'     },
  { name: 'Mallorca',                search: 'RCD Mallorca'       },
  { name: 'CD Tenerife',             search: 'CD Tenerife'        },
  { name: 'UD Las Palmas',           search: 'UD Las Palmas'      },
  { name: 'Eibar',                   search: 'SD Eibar'           },
  { name: 'CE Sabadell',             search: 'CE Sabadell'        },
  { name: 'Girona FC',               search: 'Girona FC'          },
  { name: 'Celta Fortuna',           search: 'RC Celta de Vigo'   }, // filial, usa escudo del Celta
  { name: 'Burgos Club de Fútbol',   search: 'Burgos CF'          },
  { name: 'Real Sociedad B',         search: 'Real Sociedad'      }, // filial, usa escudo del equipo
  { name: 'Real Oviedo',             search: 'Real Oviedo'        },
  { name: 'FC Andorra',              search: 'FC Andorra'         },
  { name: 'Almería',                 search: 'UD Almeria'         },
  { name: 'Cádiz',                   search: 'Cadiz CF'           },
  { name: 'Córdoba',                 search: 'Cordoba CF'         },
  { name: 'Real Valladolid',         search: 'Real Valladolid'    },
  { name: 'CD Eldense',              search: 'CD Eldense'         },
  { name: 'Albacete Balompié',       search: 'Albacete Balompie'  },
  { name: 'AD Ceuta',                search: 'AD Ceuta'           },
];

const SPORTSDB_API = 'https://www.thesportsdb.com/api/v1/json/3/searchteams.php?t=';

async function downloadImage(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
}

async function fetchBadge(searchTerm) {
  const url = `${SPORTSDB_API}${encodeURIComponent(searchTerm)}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  if (!data.teams?.length) return null;

  // Preferir equipo español
  const spanish = data.teams.find(t =>
    t.strCountry === 'Spain' || t.strLeague?.includes('Spain') || t.strLeague?.includes('Spanish')
  );
  const team = spanish || data.teams[0];
  return team.strBadge || null;
}

async function main() {
  const outDir = path.join(__dirname, '..', 'public', 'crests-segunda');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  console.log(`Downloading crests to public/crests-segunda/\n`);

  for (const { name, search } of TEAMS) {
    const slug     = slugify(name);
    const filePath = path.join(outDir, `${slug}.png`);

    if (fs.existsSync(filePath)) {
      console.log(`  ✓ ${name.padEnd(28)} (ya existe)`);
      continue;
    }

    try {
      const badgeUrl = await fetchBadge(search);
      if (!badgeUrl) {
        console.warn(`  ✗ ${name.padEnd(28)} — no encontrado en TheSportsDB`);
        continue;
      }
      await downloadImage(badgeUrl, filePath);
      console.log(`  ✓ ${name.padEnd(28)} → crests-segunda/${slug}.png`);
    } catch (err) {
      console.warn(`  ✗ ${name.padEnd(28)} — error: ${err.message}`);
    }

    // Pausa breve para no saturar la API
    await new Promise(r => setTimeout(r, 200));
  }

  console.log('\nDone!');
}

main().catch(err => { console.error(err); process.exit(1); });
