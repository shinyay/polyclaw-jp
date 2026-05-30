/**
 * CJK-aware display width utilities for terminal rendering.
 *
 * Treats East Asian Wide / Fullwidth code points as occupying 2 columns
 * and ASCII / half-width characters as 1 column. ANSI escape sequences
 * are ignored (zero-width) when measuring `stringWidth`.
 *
 * Phase 4 (TUI 日本語化) で全角 / 半角混在のテーブル整形 + truncate に
 * 利用する。`unicode.org` の East Asian Width property の主要レンジを
 * 包括カバーする pragmatic 実装。
 */

const ANSI_RE = /\x1b\[[0-9;?]*[a-zA-Z]/g;

/**
 * Returns the terminal display width of a single code point.
 * Wide (2 cols): CJK ideographs, Hiragana/Katakana, Hangul, Fullwidth forms,
 * most emoji (SMP+ ranges). Narrow (1 col): ASCII printable + general Latin.
 * Zero-width: control characters.
 */
export function charWidth(codePoint: number): number {
  if (codePoint < 0x20) return 0; // C0 control
  if (codePoint < 0x7f) return 1; // ASCII printable
  if (codePoint < 0xa0) return 0; // C1 control
  if (
    (codePoint >= 0x1100 && codePoint <= 0x115f) || // Hangul Jamo
    (codePoint >= 0x2e80 && codePoint <= 0x303e) || // CJK Radicals + Kangxi
    (codePoint >= 0x3041 && codePoint <= 0x33ff) || // Hiragana / Katakana / CJK Symbols
    (codePoint >= 0x3400 && codePoint <= 0x4dbf) || // CJK Extension A
    (codePoint >= 0x4e00 && codePoint <= 0x9fff) || // CJK Unified Ideographs
    (codePoint >= 0xa000 && codePoint <= 0xa4cf) || // Yi Syllables
    (codePoint >= 0xac00 && codePoint <= 0xd7a3) || // Hangul Syllables
    (codePoint >= 0xf900 && codePoint <= 0xfaff) || // CJK Compat Ideographs
    (codePoint >= 0xfe30 && codePoint <= 0xfe4f) || // CJK Compat Forms
    (codePoint >= 0xff00 && codePoint <= 0xff60) || // Fullwidth Forms
    (codePoint >= 0xffe0 && codePoint <= 0xffe6) || // Fullwidth Signs
    codePoint >= 0x10000 // SMP+: emoji / CJK Ext B+ / Symbols & Pictographs / etc.
  ) {
    return 2;
  }
  return 1;
}

/**
 * Display width of `s`. ANSI escape sequences are stripped before counting.
 */
export function stringWidth(s: string): number {
  if (!s) return 0;
  const stripped = s.replace(ANSI_RE, "");
  let width = 0;
  for (const ch of stripped) {
    const cp = ch.codePointAt(0);
    if (cp === undefined) continue;
    width += charWidth(cp);
  }
  return width;
}

/**
 * Pad `s` to exactly `width` display columns, accounting for CJK full-width
 * characters. If `s` is already wider than `width`, returns `s` unchanged.
 *
 * `align`: 'left' appends fill on the right (default); 'right' prepends fill
 * on the left; 'center' splits fill on both sides.
 */
export function padToWidth(
  s: string,
  width: number,
  align: "left" | "right" | "center" = "left",
  fill: string = " ",
): string {
  const w = stringWidth(s);
  if (w >= width) return s;
  const pad = width - w;
  if (align === "left") return s + fill.repeat(pad);
  if (align === "right") return fill.repeat(pad) + s;
  const left = Math.floor(pad / 2);
  return fill.repeat(left) + s + fill.repeat(pad - left);
}

/**
 * Truncate `s` to at most `max` display columns, appending `ellipsis` when
 * truncation occurs. Respects full-width character boundaries: never splits
 * a 2-column character into a partial 1-column rendering.
 *
 * Note: input is expected to be free of ANSI escapes. If ANSI styling needs
 * to survive truncation, strip + restore at the call site.
 */
export function truncateByWidth(
  s: string,
  max: number,
  ellipsis: string = "…",
): string {
  if (max <= 0) return "";
  if (stringWidth(s) <= max) return s;
  const ellW = stringWidth(ellipsis);
  if (max <= ellW) {
    let acc = "";
    let w = 0;
    for (const ch of ellipsis) {
      const cw = charWidth(ch.codePointAt(0) ?? 0);
      if (w + cw > max) break;
      w += cw;
      acc += ch;
    }
    return acc;
  }
  const budget = max - ellW;
  let width = 0;
  let result = "";
  for (const ch of s) {
    const cp = ch.codePointAt(0);
    if (cp === undefined) continue;
    const cw = charWidth(cp);
    if (width + cw > budget) break;
    width += cw;
    result += ch;
  }
  return result + ellipsis;
}
