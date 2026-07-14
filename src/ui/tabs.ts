export interface FileTab<T = unknown> {
  id: string;
  name: string;
  file: File;
  dirty: boolean;
  state?: T;
}

export class FileTabManager<T = unknown> extends EventTarget {
  private readonly tabs = new Map<string, FileTab<T>>();
  private activeId: string | null = null;

  list(): FileTab<T>[] { return [...this.tabs.values()]; }
  active(): FileTab<T> | undefined { return this.activeId ? this.tabs.get(this.activeId) : undefined; }

  open(file: File, state?: T): FileTab<T> {
    const id = crypto.randomUUID();
    const tab: FileTab<T> = { id, name: file.name, file, dirty: false, ...(state === undefined ? {} : { state }) };
    this.tabs.set(id, tab);
    this.activeId = id;
    this.emit("open", tab);
    return tab;
  }

  activate(id: string): void {
    if (!this.tabs.has(id)) throw new Error(`Unknown tab: ${id}`);
    this.activeId = id;
    this.emit("activate", this.tabs.get(id));
  }

  update(id: string, patch: Partial<Omit<FileTab<T>, "id" | "file">>): void {
    const tab = this.tabs.get(id);
    if (!tab) throw new Error(`Unknown tab: ${id}`);
    Object.assign(tab, patch);
    this.emit("update", tab);
  }

  close(id: string): void {
    const tab = this.tabs.get(id);
    if (!tab) return;
    this.tabs.delete(id);
    if (this.activeId === id) this.activeId = this.tabs.keys().next().value ?? null;
    this.emit("close", tab);
  }

  private emit(type: string, detail: unknown): void {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }
}
