/**
 * Loader for the bundled connect-back command set.
 *
 * Served as a static asset and fetched the first time the builder is opened, like the
 * payload library. Commands carry `{ip}`, `{port}` and `{shell}` placeholders which are
 * substituted at render time.
 *
 * Command text is data. It is displayed, encoded, and can be written into the open
 * buffer -- never executed, and this application opens no network connections.
 */

export interface ShellCommand {
  name: string;
  command: string;
  /** Platform and category tags, e.g. linux, windows, mac. */
  meta: string[];
}

export interface ShellGroup {
  id: string;
  label: string;
  summary: string;
  items: ShellCommand[];
}

export interface ShellLibrary {
  groups: ShellGroup[];
}

export type ShellLibraryStatus = "idle" | "loading" | "ready" | "error";

let library: ShellLibrary | null = null;
let status: ShellLibraryStatus = "idle";
let error = "";
let pending: Promise<ShellLibrary | null> | null = null;

export function shellLibraryStatus(): ShellLibraryStatus { return status; }
export function shellLibraryError(): string { return error; }
export function loadedShellLibrary(): ShellLibrary | null { return library; }

export function loadShellLibrary(): Promise<ShellLibrary | null> {
  if (library) return Promise.resolve(library);
  if (pending) return pending;

  status = "loading";
  error = "";
  pending = fetch(`${import.meta.env.BASE_URL}revshells.json`)
    .then(async (response) => {
      if (!response.ok) throw new Error(`Command set request failed with HTTP ${response.status}.`);
      const parsed = (await response.json()) as ShellLibrary;
      if (!parsed || !Array.isArray(parsed.groups)) throw new Error("Command set is not in the expected shape.");
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

/** Platform tags present across the set, for the OS filter. */
export function shellPlatforms(): string[] {
  if (!library) return [];
  const seen = new Set<string>();
  for (const group of library.groups) {
    for (const item of group.items) {
      for (const tag of item.meta) {
        // Command-type tags live alongside platform tags; only the latter are useful here.
        if (["linux", "windows", "mac"].includes(tag)) seen.add(tag);
      }
    }
  }
  return [...seen].sort();
}

export function shellTotals(): { groups: number; commands: number } {
  if (!library) return { groups: 0, commands: 0 };
  return {
    groups: library.groups.length,
    commands: library.groups.reduce((total, group) => total + group.items.length, 0)
  };
}

/** Filters a group by platform tag and a name/body search. */
export function filterShellCommands(
  group: ShellGroup,
  platform: string,
  query: string
): ShellCommand[] {
  const needle = query.trim().toLowerCase();
  return group.items.filter((item) => {
    if (platform !== "all" && !item.meta.includes(platform)) return false;
    if (!needle) return true;
    return item.name.toLowerCase().includes(needle) || item.command.toLowerCase().includes(needle);
  });
}

export interface ShellSubstitutions {
  host: string;
  port: string;
  shell: string;
}

/**
 * Substitutes connection details into a command.
 *
 * Accepts both the upstream `{ip}` style and the uppercase `{HOST}` style used by the
 * hand-written entries in the payload library, so either can be pasted into the source
 * box and still resolve.
 */
export function applyShellSubstitutions(command: string, values: ShellSubstitutions): string {
  const host = values.host || "127.0.0.1";
  const port = values.port || "4444";
  const shell = values.shell || "/bin/sh";
  return command
    .replace(/\{ip\}/g, host)
    .replace(/\{port\}/g, port)
    .replace(/\{shell\}/g, shell)
    .replace(/\{HOST\}/g, host)
    .replace(/\{PORT\}/g, port)
    .replace(/\{SHELL\}/g, shell)
    .replace(/LISTENER_HOST/g, host)
    .replace(/LISTENER_PORT/g, port);
}
