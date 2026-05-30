/**
 * Abstract base class for TUI screens.
 *
 * ⚠️ DEAD CODE — see `src/ui/app.ts` header for status (not wired into
 *    admin mode; admin mode uses `src/ui/tui.ts` instead). Retained for
 *    possible future reactivation of the tab-based UI.
 *
 * Each screen owns a root container that is mounted into the content
 * area when the tab is selected, and unmounted when a different tab
 * is activated. Screens populate their container in `build()` and
 * fetch fresh data in `refresh()`.
 */

import type { CliRenderer, BoxRenderable } from "@opentui/core";
import type { ApiClient } from "../api/client.js";

export abstract class Screen {
  /** Whether this screen captures input (prevents `q` to quit). */
  capturesInput = false;

  protected renderer: CliRenderer;
  protected api: ApiClient;
  protected container!: BoxRenderable;

  constructor(renderer: CliRenderer, api: ApiClient) {
    this.renderer = renderer;
    this.api = api;
  }

  /** Build the renderable tree. Called once at startup. */
  abstract build(): Promise<void>;

  /** Reload data for the screen. Called when the tab is selected. */
  abstract refresh(): void;

  /** Attach the screen's root container to the content area. */
  mount(parent: BoxRenderable): void {
    parent.add(this.container);
  }

  /** Detach the screen's root container from the content area. */
  unmount(parent: BoxRenderable): void {
    try {
      parent.remove(this.container.id);
    } catch {
      // Container may not be a child -- safe to ignore.
    }
  }

  /** Helper to check if this screen is visible (has nonzero height). */
  protected isVisible(): boolean {
    try {
      return (this.container?.getLayoutNode().getComputedHeight() ?? 0) > 0;
    } catch {
      return false;
    }
  }
}
