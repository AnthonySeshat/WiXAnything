// One-off: verify the Wix client connects and discover readable CMS collections.
// Run: node --env-file=.env discover.mjs
import { createClient, OAuthStrategy } from '@wix/sdk';
import * as data from '@wix/data';

const clientId = process.env.WIX_CLIENT_ID;
console.log('client id present:', Boolean(clientId));

const modules = { items: data.items };
if (data.collections) modules.collections = data.collections;

const client = createClient({ modules, auth: OAuthStrategy({ clientId }) });

// 1) prove connectivity by minting a visitor token
try {
  const t = await client.auth.generateVisitorTokens?.();
  console.log('✓ visitor token obtained:', t ? 'yes' : '(auto)');
} catch (e) {
  console.log('token note:', e?.message || e);
}

// 2) try to list collections (may be permission-limited for a visitor)
if (client.collections?.listDataCollections) {
  try {
    const res = await client.collections.listDataCollections();
    const cols = res.collections ?? res.dataCollections ?? [];
    console.log(`\n✓ collections visible: ${cols.length}`);
    for (const c of cols.slice(0, 40)) console.log('   -', c._id ?? c.id, '·', c.displayName ?? c.name ?? '');
  } catch (e) {
    console.log('\nlistDataCollections failed (often visitor-permission):', e?.message || e);
  }
} else {
  console.log('\n(no collections module export available)');
}

// 3) try querying a few likely collection ids/names from the OTTOP build
const guesses = process.argv.slice(2).length ? process.argv.slice(2)
  : ['Expandables', 'ExpandableHomes', 'Models', 'configuratorOptions', 'Options', 'Products'];
console.log('\nprobing candidate collections:', guesses.join(', '));
for (const g of guesses) {
  try {
    const r = await client.items.query(g).limit(1).find();
    console.log(`   ✓ "${g}": ${r.totalCount ?? r.items?.length ?? 0} items`,
      r.items?.[0] ? '· fields: ' + Object.keys(r.items[0]).slice(0, 8).join(', ') : '');
  } catch (e) {
    console.log(`   · "${g}": ${(e?.message || e).toString().slice(0, 80)}`);
  }
}
