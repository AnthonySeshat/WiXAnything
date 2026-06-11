// Velo glue for <quote-configurator> (id #quoteConfig on the page).
// Shows the compliant two-way bridge: data IN via attributes, results OUT via events.
// Optionally feeds options from your CMS so the section is data-driven.

import wixData from 'wix-data';

$w.onReady(async () => {
  // OPTIONAL: drive the configurator from a CMS collection instead of its defaults.
  // const res = await wixData.query('QuoteOptions').ascending('order').find();
  // const options = res.items.map(it => ({ id: it.key, label: it.label, choices: it.choices }));
  // $w('#quoteConfig').setAttribute('data-options', JSON.stringify(options));

  $w('#quoteConfig').setAttribute('data-currency', '$');
  $w('#quoteConfig').setAttribute('data-title', 'Build your expandable home');

  // Live total as the visitor configures:
  $w('#quoteConfig').on('quotechange', (e) => {
    console.log('running total:', e.detail.total);
    // e.g. mirror it into a Text element: $w('#totalText').text = '$' + e.detail.total;
  });

  // Final submit — persist the lead / quote to CMS, send an email, etc.:
  $w('#quoteConfig').on('submit', async (e) => {
    const { total, selections } = e.detail;
    // await wixData.insert('QuoteLeads', { total, selections, _createdDate: new Date() });
    console.log('quote submitted:', total, selections);
  });
});
