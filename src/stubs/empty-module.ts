/**
 * Stub for jsPDF's optional HTML-rendering dependencies (html2canvas, dompurify).
 *
 * Those are only reachable through `jsPDF.prototype.html()`, which this project never
 * calls -- the dossier is drawn entirely with path and text operators. jsPDF imports
 * them dynamically, so Rollup cannot prove they are unused and bundles ~230 kB of dead
 * code. Aliasing them here removes that. If `.html()` is ever needed, delete the alias
 * in vite.config.ts rather than working around this file.
 */
const unavailable = (): never => {
  throw new Error("jsPDF HTML rendering is not bundled in this application. Remove the html2canvas/dompurify alias in vite.config.ts to enable it.");
};

export default unavailable;
export const sanitize = unavailable;
