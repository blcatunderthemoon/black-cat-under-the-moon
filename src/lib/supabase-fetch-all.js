/**
 * Fetch ALL rows from a Supabase/PostgREST query, working around the default
 * `max-rows` cap (1000). Without this, a plain `.select()` silently returns only
 * the first 1000 rows — e.g. once `sent_matches` exceeds 1000, the newest rows
 * drop off and recently-sent pairs wrongly appear "unsent" in email automation.
 *
 * Pass a builder that returns a FRESH query each call (already `.select()` /
 * filtered, but WITHOUT `.range()` / `.limit()`), since a PostgREST query
 * builder is single-use.
 *
 * @param {() => PromiseLike<{data: any[]|null, error: any}>} buildQuery
 * @param {{ pageSize?: number }} [opts]
 * @returns {Promise<{ data: any[], error: any }>}
 */
export async function fetchAllRows(buildQuery, { pageSize = 1000 } = {}) {
  const all = [];
  let from = 0;
  // Hard safety cap to avoid an unbounded loop on unexpected responses.
  for (let page = 0; page < 1000; page++) {
    const { data, error } = await buildQuery().range(from, from + pageSize - 1);
    if (error) return { data: all, error };
    const batch = data || [];
    all.push(...batch);
    if (batch.length < pageSize) break;
    from += pageSize;
  }
  return { data: all, error: null };
}
