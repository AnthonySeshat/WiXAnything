// Wix Headless client — reuses an EXISTING Wix site's data (CMS, Stores, …) via
// the official @wix/sdk. The OAuth client id is public (visitor-scoped); it only
// grants read access to data the site already exposes publicly.
import { createClient, OAuthStrategy } from '@wix/sdk';
import { items } from '@wix/data';

const clientId = import.meta.env.WIX_CLIENT_ID || process.env.WIX_CLIENT_ID || '';

export const wixConfigured = Boolean(clientId);

// `null` until a client id is provided, so pages can render a friendly setup state.
export const wix = clientId
  ? createClient({ modules: { items }, auth: OAuthStrategy({ clientId }) })
  : null;

/**
 * Query a CMS (Wix Data) collection, returning [] on any failure so the page
 * still renders. The exact query API can vary across @wix/data versions — adjust
 * to your installed version if needed (see SETUP.md → "Reading your data").
 *
 * @param {string} collectionId  your CMS collection id (e.g. "ExpandableHomes")
 * @param {number} limit
 */
export async function queryCollection(collectionId, limit = 24) {
  if (!wix) return [];
  try {
    const res = await wix.items.query(collectionId).limit(limit).find();
    return res.items ?? [];
  } catch (err) {
    console.warn(`[wix] query "${collectionId}" failed:`, err?.message || err);
    return [];
  }
}
