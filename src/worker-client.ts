import type { AnalysisOptions, FileAnalysis, ProgressEvent, SearchQuery, SearchResult, DifferenceRange } from "./types";

interface Pending<T> {
  resolve: (value: T) => void;
  reject: (reason: Error) => void;
  onProgress?: (progress: ProgressEvent) => void;
}

export class HexWorkerClient {
  private readonly worker: Worker;
  private readonly pending = new Map<string, Pending<unknown>>();

  constructor(workerUrl = new URL("./worker.ts", import.meta.url)) {
    this.worker = new Worker(workerUrl, { type: "module" });
    this.worker.addEventListener("message", (event) => this.handle(event.data));
    this.worker.addEventListener("error", (event) => {
      for (const pending of this.pending.values()) pending.reject(new Error(event.message));
      this.pending.clear();
    });
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
    this.worker.terminate();
    for (const pending of this.pending.values()) pending.reject(new Error("Worker terminated."));
    this.pending.clear();
  }

  private request<T>(payload: object, onProgress?: (progress: ProgressEvent) => void): Promise<T> {
    const id = crypto.randomUUID();
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (value: unknown) => void, reject, ...(onProgress ? { onProgress } : {}) });
      this.worker.postMessage({ id, ...payload });
    });
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
