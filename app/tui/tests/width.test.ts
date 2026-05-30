import { describe, test, expect } from "bun:test";
import {
  charWidth,
  stringWidth,
  padToWidth,
  truncateByWidth,
} from "../src/utils/width.js";

describe("charWidth", () => {
  test("ASCII printable = 1", () => {
    expect(charWidth(0x41)).toBe(1); // 'A'
    expect(charWidth(0x20)).toBe(1); // ' '
    expect(charWidth(0x7e)).toBe(1); // '~'
  });

  test("C0/C1 control = 0", () => {
    expect(charWidth(0x00)).toBe(0);
    expect(charWidth(0x1b)).toBe(0); // ESC
    expect(charWidth(0x9f)).toBe(0);
  });

  test("CJK ideographs = 2", () => {
    expect(charWidth(0x4e00)).toBe(2); // 一
    expect(charWidth(0x9fff)).toBe(2);
    expect(charWidth(0x3042)).toBe(2); // あ
    expect(charWidth(0x30a2)).toBe(2); // ア
  });

  test("Fullwidth forms = 2", () => {
    expect(charWidth(0xff21)).toBe(2); // Ａ
    expect(charWidth(0xff5e)).toBe(2); // ～
  });

  test("Hangul = 2", () => {
    expect(charWidth(0xac00)).toBe(2); // 가
  });

  test("SMP (emoji range) = 2", () => {
    expect(charWidth(0x1f389)).toBe(2); // 🎉
    expect(charWidth(0x1f600)).toBe(2); // 😀
  });

  test("Latin supplement narrow", () => {
    expect(charWidth(0xa1)).toBe(1); // ¡
    expect(charWidth(0x00e9)).toBe(1); // é
  });
});

describe("stringWidth", () => {
  test("pure ASCII", () => {
    expect(stringWidth("hello")).toBe(5);
    expect(stringWidth("")).toBe(0);
  });

  test("pure Japanese", () => {
    expect(stringWidth("こんにちは")).toBe(10);
    expect(stringWidth("ダッシュボード")).toBe(14);
  });

  test("mixed ASCII + Japanese", () => {
    // 'Polyclaw' = 8 cols, ' ' = 1 col, 'へようこそ' = 5 chars × 2 = 10 cols → total 19
    expect(stringWidth("Polyclaw へようこそ")).toBe(19);
  });

  test("ignores ANSI escape sequences", () => {
    expect(stringWidth("\x1b[36mhello\x1b[0m")).toBe(5);
    expect(stringWidth("\x1b[1;31mエラー\x1b[0m")).toBe(6); // 'エラー' = 6
  });

  test("emoji", () => {
    expect(stringWidth("🎉")).toBe(2);
    expect(stringWidth("ok 🎉")).toBe(3 + 2); // 'ok ' (3) + '🎉' (2) = 5
  });

  test("null / undefined-ish inputs", () => {
    expect(stringWidth("")).toBe(0);
  });
});

describe("padToWidth", () => {
  test("pad ASCII left (default)", () => {
    expect(padToWidth("ab", 5)).toBe("ab   ");
  });

  test("pad ASCII right", () => {
    expect(padToWidth("ab", 5, "right")).toBe("   ab");
  });

  test("pad ASCII center", () => {
    expect(padToWidth("ab", 6, "center")).toBe("  ab  ");
    expect(padToWidth("ab", 5, "center")).toBe(" ab  "); // left=2, right=1 wait, floor(3/2)=1
    // pad = 3, left = floor(3/2) = 1, right = 2
    // expected: ' ab  '
    expect(padToWidth("ab", 5, "center")).toBe(" ab  ");
  });

  test("pad Japanese (each char = 2 cols)", () => {
    expect(padToWidth("あ", 4)).toBe("あ  "); // width 2 + 2 spaces = 4
    expect(padToWidth("こんにちは", 12)).toBe("こんにちは  "); // width 10 + 2 = 12
  });

  test("mixed ASCII + Japanese", () => {
    expect(padToWidth("ok あ", 8)).toBe("ok あ   "); // 'ok ' (3) + 'あ' (2) = 5, pad 3 → 'ok あ   '
  });

  test("no-op when already at width", () => {
    expect(padToWidth("hello", 5)).toBe("hello");
    expect(padToWidth("こんにちは", 10)).toBe("こんにちは");
  });

  test("no-op when wider than target", () => {
    expect(padToWidth("hello world", 5)).toBe("hello world");
  });

  test("custom fill char", () => {
    expect(padToWidth("ab", 5, "left", ".")).toBe("ab...");
  });
});

describe("truncateByWidth", () => {
  test("no-op when shorter than max", () => {
    expect(truncateByWidth("hello", 10)).toBe("hello");
    expect(truncateByWidth("あい", 10)).toBe("あい");
  });

  test("truncate ASCII", () => {
    expect(truncateByWidth("hello world", 8)).toBe("hello w…"); // budget = 7, 'hello w' (7) + '…' (1)
  });

  test("truncate Japanese — respects full-width boundary", () => {
    // 'ダッシュボード' = 14 cols, max 10 → budget = 9, can fit 'ダッシュ' (8) + '…' (1) = 9
    expect(truncateByWidth("ダッシュボード", 10)).toBe("ダッシュ…");
  });

  test("truncate Japanese — odd budget skips partial CJK", () => {
    // 'ダッシュ' (8), max 9 → budget 8, can fit 'ダッシ' (6) but next 'ュ' would make 8 > budget? no 8==budget OK
    // Actually 'ダッシュ' = 4 chars × 2 = 8, budget = 8 → fits exactly → 'ダッシュ…'
    expect(truncateByWidth("ダッシュボード", 9)).toBe("ダッシュ…");
  });

  test("mixed ASCII + Japanese", () => {
    // 'ok ダッシュ' = 'ok ' (3) + 'ダッシュ' (8) = 11
    // max 8 → budget 7
    // 'ok ' (3) + 'ダ' (2) + 'ッ' (2) = 7 → fits → 'ok ダッ…'
    expect(truncateByWidth("ok ダッシュ", 8)).toBe("ok ダッ…");
  });

  test("max=0 returns empty", () => {
    expect(truncateByWidth("anything", 0)).toBe("");
  });

  test("custom ellipsis", () => {
    expect(truncateByWidth("hello world", 8, "..")).toBe("hello ..");
  });

  test("max smaller than ellipsis", () => {
    // ellipsis = '…' (width 1), max = 1 → returns '…'
    expect(truncateByWidth("hello", 1)).toBe("…");
  });

  test("emoji truncate boundary", () => {
    // 'ok 🎉' = 5, max 4 → budget 3, 'ok ' fits → 'ok …'
    expect(truncateByWidth("ok 🎉", 4)).toBe("ok …");
  });
});
