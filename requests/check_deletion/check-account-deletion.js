/**
 * Tilin poiston datatesti (mongosh-skripti).
 *
 * Käyttö:
 *   1) Ennen poistoa (tallentaa tilannekuvan tiedostoon):
 *      MODE=before EMAIL=testi@osoite.fi mongosh "$MONGO_URI" --quiet --file check-account-deletion.js
 *   2) Poista tili sovelluksessa (Asetukset → Käyttäjätili → Poista tili).
 *   3) Poiston jälkeen (vertaa tilannekuvaan ja tulostaa OK / VIRHE):
 *      MODE=after mongosh "$MONGO_URI" --quiet --file check-account-deletion.js
 *
 * Valinnaiset ympäristömuuttujat:
 *   DB_NAME   – tietokannan nimi, jos se ei ole URI:ssa
 *   SNAPSHOT  – tilannekuvan tiedosto (oletus deletion-snapshot.json)
 *
 * Tarkista CONFIG ennen ensimmäistä ajoa: kokoelmien nimet ja se,
 * millä kentällä kuvat ja säädata on liitetty peltoon.
 */
const fs = require('fs');

const CONFIG = {
  collections: {
    users: 'users',
    dates: 'dates',
    images: 'images',
    weather: 'weathers',
    jobs: 'jobs',
  },
  // field      = kenttä images/weathers-dokumentissa, joka viittaa peltoon
  // datesField = dates-dokumentin kenttä, jonka arvoa siihen verrataan
  //              (dates.id = geometryHash)
  // match      = 'eq'     → kenttä on sama arvo
  //              'suffix' → kenttä päättyy "_<arvo>" (images.id = "<päivämäärä>_<hash>")
  links: {
    images: { field: 'id', datesField: 'id', match: 'suffix' },
    weather: { field: 'geometryHash', datesField: 'id', match: 'eq' },
  },
};

const MODE = process.env.MODE;
const EMAIL = process.env.EMAIL;
const SNAPSHOT = process.env.SNAPSHOT || 'deletion-snapshot.json';
const database = process.env.DB_NAME ? db.getSiblingDB(process.env.DB_NAME) : db;
const C = (key) => database.getCollection(CONFIG.collections[key]);

const LINKED = ['images', 'weather'];

/** Id voi olla tallennettu ObjectId:nä tai stringinä – haetaan molemmilla. */
const idVariants = (hex) =>
  /^[0-9a-f]{24}$/i.test(hex) ? [ObjectId(hex), hex] : [hex];

const idToString = (v) => (typeof v === 'string' ? v : v.toString());

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const countLinked = (kind, value) => {
  if (value === null || value === undefined) return null;
  const { field, match } = CONFIG.links[kind];
  const cond = match === 'suffix'
    ? { $regex: `_${escapeRegex(value)}$` }
    : value;
  return C(kind).countDocuments({ [field]: cond });
};

/* =======================================================
   BEFORE: tilannekuva ennen poistoa
   ------------------------------------------------------- */
function before() {
  if (!EMAIL) {
    print('Anna EMAIL=... (testitilin sähköposti)');
    quit(1);
  }

  const user = C('users').findOne({ email: EMAIL });
  if (!user) {
    print(`Käyttäjää ${EMAIL} ei löydy kokoelmasta ${CONFIG.collections.users}`);
    quit(1);
  }

  const uid = idToString(user._id);
  const uidIds = idVariants(uid);

  const fields = C('dates')
    .find({ userIds: { $in: uidIds } })
    .toArray()
    .map((d) => {
      const others = (d.userIds || []).map(idToString).filter((x) => x !== uid);
      const links = {};
      const counts = {};
      for (const kind of LINKED) {
        const value = d[CONFIG.links[kind].datesField];
        links[kind] = value === undefined ? null : value;
        counts[kind] = countLinked(kind, links[kind]);
      }
      return {
        id: idToString(d._id),
        name: d.name || '',
        shared: others.length > 0,
        others,
        links,
        counts,
      };
    });

  const jobs = C('jobs').countDocuments({ userId: { $in: uidIds } });

  const snap = { email: EMAIL, uid, takenAt: new Date().toISOString(), fields, jobs };
  fs.writeFileSync(SNAPSHOT, JSON.stringify(snap, null, 2));

  print(`\nTilannekuva tallennettu: ${SNAPSHOT}`);
  print(`Käyttäjä: ${EMAIL} (${uid})`);
  print(`Jobit: ${jobs}`);
  print(`Pellot (${fields.length}):`);
  for (const f of fields) {
    print(
      `  - ${f.name || f.id} [${f.shared ? 'JAETTU' : 'vain testitili'}]` +
      `  kuvat: ${f.counts.images ?? '?'}  sää: ${f.counts.weather ?? '?'}`
    );
    for (const kind of LINKED) {
      if (f.links[kind] === null) {
        print(`      ! dates-kenttää "${CONFIG.links[kind].datesField}" ei löydy – tarkista CONFIG.links.${kind}`);
      }
    }
  }

  if (!fields.some((f) => !f.shared)) print('\n! Ei yhtään vain testitilin peltoa – poistologiikka jää testaamatta.');
  if (!fields.some((f) => f.shared)) print('! Ei yhtään jaettua peltoa – jaetun pellon logiikka jää testaamatta.');
  print('\nSeuraavaksi: poista tili sovelluksessa ja aja MODE=after.\n');
}

/* =======================================================
   AFTER: tarkistus poiston jälkeen
   ------------------------------------------------------- */
function after() {
  if (!fs.existsSync(SNAPSHOT)) {
    print(`Tilannekuvaa ${SNAPSHOT} ei löydy – aja ensin MODE=before.`);
    quit(1);
  }
  const snap = JSON.parse(fs.readFileSync(SNAPSHOT, 'utf8'));
  const uidIds = idVariants(snap.uid);

  let failures = 0;
  const check = (label, ok, detail = '') => {
    if (!ok) failures++;
    print(`${ok ? '  OK   ' : '  VIRHE'}  ${label}${detail ? `  (${detail})` : ''}`);
  };

  print(`\nTarkistus: ${snap.email} (${snap.uid}), tilannekuva ${snap.takenAt}\n`);

  const userCount = C('users').countDocuments({ _id: { $in: uidIds } });
  check('Käyttäjä poistettu', userCount === 0, `löytyi ${userCount}`);

  const datesWithUser = C('dates').countDocuments({ userIds: { $in: uidIds } });
  check('Käyttäjän id ei ole minkään pellon userIds-listassa', datesWithUser === 0, `löytyi ${datesWithUser}`);

  for (const f of snap.fields) {
    const label = f.name || f.id;
    const doc = C('dates').findOne({ _id: { $in: idVariants(f.id) } });

    if (!f.shared) {
      print(`\n  Pelto "${label}" (vain testitili):`);
      check('  dates-dokumentti poistettu', doc === null);
      for (const kind of LINKED) {
        const now = countLinked(kind, f.links[kind]);
        if (now === null) {
          print(`  ?      ${kind}: liitoskenttä puuttuu, ei tarkistettu`);
          continue;
        }
        check(`  ${kind} poistettu`, now === 0, `ennen ${f.counts[kind]}, nyt ${now}`);
      }
    } else {
      print(`\n  Pelto "${label}" (jaettu):`);
      check('  dates-dokumentti säilyi', doc !== null);
      if (doc) {
        const ids = (doc.userIds || []).map(idToString);
        check('  testitili poistettu userIds-listalta', !ids.includes(snap.uid));
        check('  muut käyttäjät säilyivät userIds-listalla', f.others.every((o) => ids.includes(o)));
      }
      for (const kind of LINKED) {
        const now = countLinked(kind, f.links[kind]);
        if (now === null) {
          print(`  ?      ${kind}: liitoskenttä puuttuu, ei tarkistettu`);
          continue;
        }
        check(`  ${kind} säilyi`, now === f.counts[kind], `ennen ${f.counts[kind]}, nyt ${now}`);
      }
    }
  }

  print('');
  const jobs = C('jobs').countDocuments({ userId: { $in: uidIds } });
  check('Käyttäjän jobit poistettu', jobs === 0, `ennen ${snap.jobs}, nyt ${jobs}`);

  print(`\n${failures === 0 ? 'KAIKKI OK' : `${failures} VIRHETTÄ`}`);
  print('Muista vielä: kirjautuminen testitilin tunnuksilla epäonnistuu.\n');
  if (failures > 0) quit(1);
}

if (MODE === 'before') before();
else if (MODE === 'after') after();
else {
  print('Anna MODE=before tai MODE=after');
  quit(1);
}