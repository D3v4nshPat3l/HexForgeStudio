/// <reference lib="webworker" />
import { analyzeFile } from "./auto-analyzer";
import { FileByteSource } from "./byte-source";
import { compareFiles } from "./compare";
import { searchBytes } from "./analyzers/search";
import type { AnalysisOptions, SearchQuery } from "./types";

type Request =
  | { id: string; type: "analyze"; file: File; options?: AnalysisOptions }
  | { id: string; type: "search"; file: File; query: SearchQuery }
  | { id: string; type: "compare"; left: File; right: File };

self.addEventListener("message", async (event: MessageEvent<Request>) => {
  const request = event.data;
  try {
    if (request.type === "analyze") {
      const result = await analyzeFile(request.file, request.options, (progress) => self.postMessage({ id: request.id, type: "progress", progress }));
      self.postMessage({ id: request.id, type: "result", result });
    } else if (request.type === "search") {
      const result = await searchBytes(new FileByteSource(request.file), request.query);
      self.postMessage({ id: request.id, type: "result", result });
    } else {
      const result = await compareFiles(new FileByteSource(request.left), new FileByteSource(request.right));
      self.postMessage({ id: request.id, type: "result", result });
    }
  } catch (error) {
    self.postMessage({ id: request.id, type: "error", error: error instanceof Error ? error.message : String(error) });
  }
});
