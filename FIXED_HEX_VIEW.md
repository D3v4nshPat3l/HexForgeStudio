# Hex View Repair — Version 2.1.0

This build replaces the page-only hex renderer with a continuous virtualized renderer.

## Corrections

- Every byte in the file is reachable with the main vertical scrollbar.
- A prominent horizontal scrollbar is displayed directly above the byte data.
- A second native horizontal scrollbar remains at the bottom of the byte data.
- Offset and character columns stay visible while horizontally scrolling.
- The character column no longer gets pushed outside the center workspace.
- Windows-1252, ASCII, and Latin-1 character views are selectable.
- Windows-1252 extended characters are rendered rather than incorrectly appearing as missing ASCII.
- Non-printable bytes are represented with a middle dot.
- Row rendering is virtualized, so large files do not create millions of DOM elements.
- Page navigation remains available as a jump control, but the editor is no longer restricted to one 1,024-byte page.
- Hex scroll position is retained when selecting or editing bytes.
- The central editor receives more width at common Windows display scaling levels.
- Scrollbars are thicker and have higher contrast.

## Recommended display

Use browser zoom 100%. At smaller windows, use the visible horizontal scrollbar above the hex grid. The OFFSET and TEXT columns remain pinned while the hexadecimal byte area moves.
