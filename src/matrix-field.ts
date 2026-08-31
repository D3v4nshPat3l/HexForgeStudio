/**
 * Katakana matrix field.
 *
 * A grid of kana that pulse through blue, pink and white on staggered cycles. The
 * effect is the Uiverse "wet-lionfish-63" pattern by solowzrd, and the animation and
 * timing are kept as published; what changes is how the grid gets there.
 *
 * The original hard-codes several hundred spans in markup and pins the container to
 * 1920x1080. That is fixed to one screen size and pays for cells nobody sees. Here the
 * grid is generated to fit the viewport and rebuilt on resize, so a laptop draws a few
 * hundred cells and a 4K panel fills edge to edge -- with a cap, because the count is
 * area-driven and would otherwise run away on a very large display.
 *
 * The pulse selectors are nth-child rules with coprime strides, so which cells fire
 * together depends on the count. Regenerating on resize therefore reshuffles the
 * pattern, which is the intended character of the effect rather than a defect.
 */

/** Matches the source component's 40px cell. */
const CELL = 40;
/** Ceiling on generated cells; beyond this the field is visually saturated anyway. */
const MAX_CELLS = 6000;

const KANA = [
  "ア", "イ", "ウ", "エ", "オ", "カ", "キ", "ク", "ケ", "コ",
  "サ", "シ", "ス", "セ", "ソ", "タ", "チ", "ツ", "テ", "ト",
  "ナ", "ニ", "ヌ", "ネ", "ノ", "ハ", "ヒ", "フ", "ヘ", "ホ",
  "マ", "ミ", "ム", "メ", "モ", "ヤ", "ユ", "ヨ", "ラ", "リ",
  "ル", "レ", "ロ", "ワ", "ヲ", "ン", "ガ", "ギ", "グ", "ゲ",
  "ゴ", "ザ", "ジ", "ズ", "ゼ", "ゾ", "ダ", "ヂ", "ヅ", "デ",
  "ド", "バ", "ビ", "ブ", "ベ", "ボ", "パ", "ピ", "プ", "ペ", "ポ"
];

/**
 * Mounts the field inside `host` and keeps it filled as the viewport changes.
 * Returns a teardown that stops the resize listener and empties the host.
 */
export function startMatrixField(host: HTMLElement): () => void {
  let lastCount = -1;

  function fill(): void {
    const rect = host.getBoundingClientRect();
    const cols = Math.max(1, Math.ceil(rect.width / CELL));
    const rows = Math.max(1, Math.ceil(rect.height / CELL));
    const count = Math.min(cols * rows, MAX_CELLS);
    // Rebuilding on every resize tick would thrash; the count is what matters.
    if (count === lastCount) return;
    lastCount = count;

    // One string then one parse beats `count` separate appendChild calls.
    const cells = new Array<string>(count);
    for (let i = 0; i < count; i++) {
      cells[i] = `<span>${KANA[i % KANA.length]}</span>`;
    }
    host.innerHTML = cells.join("");
  }

  fill();
  const onResize = (): void => fill();
  window.addEventListener("resize", onResize);

  return () => {
    window.removeEventListener("resize", onResize);
    host.innerHTML = "";
    lastCount = -1;
  };
}
