/**
 * Screen registry for the tab-based TUI.
 *
 * ⚠️ DEAD CODE — these screens are only consumed by `src/ui/app.ts`
 *    (PolyclawApp), which is not currently wired into any entry point.
 *    See `src/ui/app.ts` header for the full status note and
 *    `docs/i18n/phase4-smoke.md §4.4.7.1` for the decision rationale.
 */

export { Screen } from "./screen.js";
export { DashboardScreen } from "./dashboard.js";
export { SetupScreen } from "./setup.js";
export { ChatScreen } from "./chat.js";
export { SessionsScreen } from "./sessions.js";
export { SkillsScreen } from "./skills.js";
export { PluginsScreen } from "./plugins.js";
export { McpScreen } from "./mcp.js";
export { SchedulerScreen } from "./scheduler.js";
export { ProactiveScreen } from "./proactive.js";
export { ProfileScreen } from "./profile.js";
export { WorkspaceScreen } from "./workspace.js";
