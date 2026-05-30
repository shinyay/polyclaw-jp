/**
 * Text rendering helpers.
 *
 * ⚠️ DEAD CODE (2026-05-30) — currently only consumed by the dead
 *    `src/screens/*` tree behind `src/ui/app.ts`. The active admin TUI
 *    (`src/ui/tui.ts`) already follows the `fg`-property pattern by hand
 *    and does not import this helper. The helper is kept in tree so a
 *    future reactivation of the tab-based UI inherits the correct
 *    pattern without re-discovering PR-5.1's findings.
 *    See `src/ui/app.ts` header and `docs/i18n/phase4-smoke.md §4.4.7.1`
 *    for the decision rationale.
 *
 * Centralises the pattern of updating a {@link TextRenderable}'s content
 * and foreground color in one call so callers do not need to drop down to
 * the `(text as unknown as { fg: string }).fg` cast every time.
 *
 * Background (PR-5.1):
 *   The upstream design used inline ANSI escape sequences embedded in
 *   `text.content` (e.g. `text.content = "\x1b[31m...\x1b[0m"`) to colour
 *   text. That breaks `Bun.stringWidth`, which counts the escape bytes as
 *   ordinary characters and miscalculates the rendered width of CJK
 *   glyphs, producing visible "residue" and truncated text in
 *   fixed-width containers (first observed on the target picker with
 *   "(試験的)" -- see docs/i18n/phase4-smoke.md §4.4.1).
 *
 *   PR-5.1 migrates the "whole-string single colour" sites to use this
 *   helper so the content stays plain text and colour is applied via the
 *   `fg` property. Sites that mix multiple colours inside a single
 *   TextRenderable (partial colouring) are deferred to PR-5.2.
 */

import type { TextRenderable } from "@opentui/core";
import { Colors } from "./theme.js";

/**
 * Set both `content` and `fg` on a TextRenderable in one call.
 *
 * @param text     Target TextRenderable to update.
 * @param content  Plain text content. **Must not** contain ANSI escapes.
 * @param color    Foreground color. Defaults to {@link Colors.text}.
 */
export function setText(
  text: TextRenderable,
  content: string,
  color: string = Colors.text,
): void {
  text.content = content;
  // @opentui/core 0.1.107 exposes `fg` at runtime but not in the public
  // type definitions, so a cast is required. See PR-5.0.2 commentary for
  // the same pattern applied elsewhere.
  (text as unknown as { fg: string }).fg = color;
}
