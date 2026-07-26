/**
 * Full-text search, shared by the API route that builds the query and the card
 * that renders the snippet.
 *
 * The vector below is duplicated verbatim in `src/db/sql/search.sql`, which
 * builds the GIN index over it. Postgres only uses an expression index when the
 * query repeats the expression exactly, so the two must stay identical — hence
 * a single constant here rather than the expression written out twice in code.
 *
 * Missing the index is not a correctness problem: the same query returns the
 * same rows without it, just by scanning. `npm run db:extras` is what makes it
 * fast, and it can be run at any time.
 */
export const SEARCH_VECTOR =
  "setweight(to_tsvector('english', coalesce(title, '')), 'A') || " +
  "setweight(to_tsvector('english', coalesce(content, '')), 'B') || " +
  // Tags go in as-is rather than through `array_to_string`, which Postgres
  // marks stable and therefore refuses to index. They are stored lowercase, so
  // they match the same lexemes the query produces.
  "setweight(array_to_tsvector(tags), 'C')";

/** Longest query we will build; past this the extra terms add nothing. */
const MAX_TOKENS = 12;

/**
 * A search box into a `to_tsquery` argument.
 *
 * Only letters and digits survive tokenising, so the result can never contain
 * an operator, a quote or an unbalanced paren — `to_tsquery` throws on
 * malformed input, and this is what guarantees it never sees any. The last
 * token gets a `:*` so the query matches while the word is still being typed.
 *
 * Returns null when there is nothing to search for ("!!!", "#", ""), and the
 * caller falls back to a substring match.
 */
export function buildTsQuery(term: string): string | null {
  const tokens = term.toLowerCase().match(/[\p{L}\p{N}]+/gu)?.slice(0, MAX_TOKENS);
  if (!tokens?.length) return null;

  return tokens
    .map((token, index) => (index === tokens.length - 1 ? `${token}:*` : token))
    .join(" & ");
}

/*
 * `ts_headline` wraps the matched words in markers of our choosing. Control
 * characters are used rather than HTML so nothing is ever parsed as markup, and
 * no note can contain them by accident.
 */
export const HIGHLIGHT_START = "\u0001";
export const HIGHLIGHT_END = "\u0002";

export const HEADLINE_OPTIONS = `StartSel=${HIGHLIGHT_START},StopSel=${HIGHLIGHT_END},MaxWords=20,MinWords=8,MaxFragments=1`;

/** The headline as plain text, for somewhere that cannot render a highlight. */
export function stripHighlights(snippet: string) {
  return snippet.split(HIGHLIGHT_START).join("").split(HIGHLIGHT_END).join("");
}

export type Segment = { text: string; match: boolean };

/** A headline split into plain and highlighted runs, for rendering. */
export function highlightSegments(snippet: string): Segment[] {
  const segments: Segment[] = [];

  for (const part of snippet.split(HIGHLIGHT_START)) {
    const [matched, ...rest] = part.split(HIGHLIGHT_END);

    if (rest.length) {
      if (matched) segments.push({ text: matched, match: true });
      const tail = rest.join(HIGHLIGHT_END);
      if (tail) segments.push({ text: tail, match: false });
    } else if (matched) {
      segments.push({ text: matched, match: false });
    }
  }

  return segments;
}
