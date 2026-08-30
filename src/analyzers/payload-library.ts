/**
 * Loader for the bundled payload library.
 *
 * The library is a ~4.6 MB JSON file holding roughly 41,000 payloads. It is served as
 * a static asset rather than compiled into the bundle, and fetched the first time the
 * injector is opened, so nothing pays for it unless it is used. The fetch is same-origin
 * against the local server, so this holds offline once the page is served.
 *
 * Payload text is data. It is displayed, encoded, and written into the open buffer --
 * never evaluated.
 */

export interface LibraryPayload {
  /** Heading the payload appeared under upstream. */
  n: string;
  /** The payload itself. */
  v: string;
}

export interface LibraryGroup {
  name: string;
  items: LibraryPayload[];
}

export interface LibraryCategory {
  name: string;
  groups: LibraryGroup[];
}

export interface PayloadLibrary {
  categories: LibraryCategory[];
}

export type LibraryStatus = "idle" | "loading" | "ready" | "error";

let library: PayloadLibrary | null = null;
let status: LibraryStatus = "idle";
let error = "";
let pending: Promise<PayloadLibrary | null> | null = null;

export function libraryStatus(): LibraryStatus {
  return status;
}

export function libraryError(): string {
  return error;
}

export function loadedLibrary(): PayloadLibrary | null {
  return library;
}

/**
 * Fetches the library once and caches it. Concurrent callers share the same request.
 *
 * `import.meta.env.BASE_URL` is used rather than a root-relative path because the
 * application is also served from a subdirectory on static hosts.
 */
export function loadPayloadLibrary(): Promise<PayloadLibrary | null> {
  if (library) return Promise.resolve(library);
  if (pending) return pending;

  status = "loading";
  error = "";
  const url = `${import.meta.env.BASE_URL}payloads.json`;

  pending = fetch(url)
    .then(async (response) => {
      if (!response.ok) throw new Error(`Library request failed with HTTP ${response.status}.`);
      const parsed = (await response.json()) as PayloadLibrary;
      if (!parsed || !Array.isArray(parsed.categories)) throw new Error("Library file is not in the expected shape.");
      library = parsed;
      status = "ready";
      return library;
    })
    .catch((reason: unknown) => {
      status = "error";
      error = reason instanceof Error ? reason.message : String(reason);
      return null;
    })
    .finally(() => { pending = null; });

  return pending;
}

export function libraryTotals(): { categories: number; groups: number; payloads: number } {
  if (!library) return { categories: 0, groups: 0, payloads: 0 };
  let groups = 0;
  let payloads = 0;
  for (const category of library.categories) {
    groups += category.groups.length;
    for (const group of category.groups) payloads += group.items.length;
  }
  return { categories: library.categories.length, groups, payloads };
}

export function categoryTotal(category: LibraryCategory): number {
  return category.groups.reduce((total, group) => total + group.items.length, 0);
}

/**
 * Case-insensitive substring filter over a group's payloads.
 *
 * Returns the matches plus the total, so the interface can cap what it renders and
 * still report how many were found -- some groups hold tens of thousands of entries
 * and putting them all in the DOM would stall the tab.
 */
export function filterPayloads(
  group: LibraryGroup,
  query: string,
  limit: number
): { shown: LibraryPayload[]; total: number } {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return { shown: group.items.slice(0, limit), total: group.items.length };
  }
  const shown: LibraryPayload[] = [];
  let total = 0;
  for (const item of group.items) {
    if (!item.v.toLowerCase().includes(needle) && !item.n.toLowerCase().includes(needle)) continue;
    total += 1;
    if (shown.length < limit) shown.push(item);
  }
  return { shown, total };
}
