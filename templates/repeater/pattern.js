// ── Repeater pattern ────────────────────────────────────────────────────────
// A Repeater lets CODE render an arbitrary list, but the per-item TEMPLATE (the
// child elements inside one repeater item) must exist in the editor. Address item
// children with the scoped `$item`, NOT `$w`.
//
// Replace #__REPEATER__ and the child IDs (#itemTitle, #itemImage, #itemButton)
// with the real IDs from wix-elements.md for your repeater's item template.

$w.onReady(() => {
  const items = [
    { _id: '1', title: 'First',  img: 'wix:image://…', href: '/a' },
    { _id: '2', title: 'Second', img: 'wix:image://…', href: '/b' },
    // …generate this array from anything: a backend call, wix-data query, etc.
  ];

  // 1) Bind child elements as each item is created (set handlers BEFORE .data):
  $w('#__REPEATER__').onItemReady(($item, itemData) => {
    $item('#itemTitle').text = itemData.title;          // Text child
    $item('#itemImage').src = itemData.img;             // Image child
    $item('#itemButton').onClick(() => {                // Button child
      // itemData is captured in this closure — per-item behavior:
      wixLocation.to(itemData.href); // import wixLocation from 'wix-location'
    });
  });

  // 2) Feed the data (triggers onItemReady for each row):
  $w('#__REPEATER__').data = items;
});
