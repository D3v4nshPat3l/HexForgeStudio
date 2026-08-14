import type { AnalysisOptions, FileAnalysis, ProgressEvent, SearchQuery, SearchResult, DifferenceRange } from "./types";

interface Pending<T> {
  resolve: (value: T) => void;
  reject: (reason: Error) => void;
  onProgress?: (progress: ProgressEvent) => void;
}

type WorkerPayload =
  | { type: "analyze"; file: File; options?: AnalysisOptions }
  | { type: "search"; file: File; query: SearchQuery }
  | { type: "compare"; left: File; right: File };

/**
 * Client for the analysis worker, with a main-thread fallback.
 *
 * The worker is constructed lazily and, if it fails to start, every operation
 * transparently runs on the main thread instead. A failed worker used to leave
 * requests pending forever: the `error` event fires while the pending map is still
 * empty, so nothing was rejected, and the next `postMessage` went to a dead port.
 */
export class HexWorkerClient {
  private worker: Worker | null = null;
  private workerUnavailable = false;
  private workerReason = "";
  private started = false;
  private readonly pending = new Map<string, Pending<unknown>>();
  private readonly explicitUrl: URL | string | undefined;

  constructor(workerUrl?: URL | string) {
    this.explicitUrl = workerUrl;
  }

  /** True once the worker has failed and operations are running on the main thread. */
  get usingFallback(): boolean {
    return this.workerUnavailable;
  }

  get fallbackReason(): string {
    return this.workerReason;
  }

  analyze(file: File, options?: AnalysisOptions, onProgress?: (progress: ProgressEvent) => void): Promise<FileAnalysis> {
    return this.request<FileAnalysis>({ type: "analyze", file, ...(options ? { options } : {}) }, onProgress);
  }

  search(file: File, query: SearchQuery): Promise<SearchResult[]> {
    return this.request<SearchResult[]>({ type: "search", file, query });
  }

  compare(left: File, right: File): Promise<DifferenceRange[]> {
    return this.request<DifferenceRange[]>({ type: "compare", left, right });
  }

  terminate(): void {
    this.worker?.terminate();
    this.worker = null;
    for (const pending of this.pending.values()) pending.reject(new Error("Worker terminated."));
    this.pending.clear();
  }

  private ensureWorker(): Worker | null {
    if (this.workerUnavailable) return null;
    if (this.worker) return this.worker;
    if (this.started && !this.worker) return null;
    this.started = true;

    try {
      // The `new Worker(new URL(...), ...)` form must appear inline and literally for
      // Vite's build-time worker transform to detect it. Passing the URL through a
      // variable or default parameter ships the raw .ts path, which production hosts
      // serve as video/mp2t and module workers then refuse to execute.
      const worker = this.explicitUrl
        ? new Worker(this.explicitUrl, { type: "module" })
        : new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });

      worker.addEventListener("message", (event) => this.handle(event.data));
      worker.addEventListener("error", (event) => {
        event.preventDefault();
        this.disableWorker(event.message || "The analysis worker failed to start.");
      });
      worker.addEventListener("messageerror", () => {
        this.disableWorker("The analysis worker sent a message that could not be deserialized.");
      });

      this.worker = worker;
      return worker;
    } catch (error) {
      this.disableWorker(error instanceof Error ? error.message : String(error));
      return null;
    }
  }

  /**
   * Marks the worker dead and re-runs anything still in flight on the main thread,
   * so a startup failure degrades to slower analysis rather than a stuck interface.
   */
  private disableWorker(reason: string): void {
    if (this.workerUnavailable) return;
    this.workerUnavailable = true;
    this.workerReason = reason;
    this.worker?.terminate();
    this.worker = null;

    const stranded = [...this.pending.entries()];
    this.pending.clear();
    for (const [, pending] of stranded) {
      pending.reject(new Error(`RETRY_ON_MAIN_THREAD: ${reason}`));
    }
  }

  private request<T>(payload: WorkerPayload, onProgress?: (progress: ProgressEvent) => void): Promise<T> {
    const worker = this.ensureWorker();
    if (!worker) return this.runOnMainThread<T>(payload, onProgress);

    const id = crypto.randomUUID();
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (value: unknown) => void, reject, ...(onProgress ? { onProgress } : {}) });
      worker.postMessage({ id, ...payload });
    }).catch((error: Error) => {
      if (error.message.startsWith("RETRY_ON_MAIN_THREAD")) return this.runOnMainThread<T>(payload, onProgress);
      throw error;
    });
  }

  /** Same work, same results, just without the worker isolation. */
  private async runOnMainThread<T>(payload: WorkerPayload, onProgress?: (progress: ProgressEvent) => void): Promise<T> {
    if (payload.type === "analyze") {
      const { analyzeFile } = await import("./auto-analyzer");
      return await analyzeFile(payload.file, payload.options, onProgress) as T;
    }
    if (payload.type === "search") {
      const [{ searchBytes }, { FileByteSource }] = await Promise.all([import("./analyzers/search"), import("./byte-source")]);
      return await searchBytes(new FileByteSource(payload.file), payload.query) as T;
    }
    const [{ compareFiles }, { FileByteSource }] = await Promise.all([import("./compare"), import("./byte-source")]);
    return await compareFiles(new FileByteSource(payload.left), new FileByteSource(payload.right)) as T;
  }

  private handle(message: { id: string; type: string; progress?: ProgressEvent; result?: unknown; error?: string }): void {
    const pending = this.pending.get(message.id);
    if (!pending) return;
    if (message.type === "progress" && message.progress) {
      pending.onProgress?.(message.progress);
      return;
    }
    this.pending.delete(message.id);
    if (message.type === "error") pending.reject(new Error(message.error ?? "Worker operation failed."));
    else pending.resolve(message.result);
  }
}
