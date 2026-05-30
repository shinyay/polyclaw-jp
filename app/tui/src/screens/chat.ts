/**
 * Chat screen -- WebSocket chat with tool-call and HITL approval support.
 *
 * Handles streaming deltas, tool_start / tool_done events, and
 * approval_request / approval_resolved events for the HITL flow.
 * When an approval is pending the input placeholder changes and
 * typing "y" or "n" resolves the approval instead of sending a
 * regular chat message.
 */

import {
  BoxRenderable,
  TextRenderable,
  InputRenderable,
  InputRenderableEvents,
  ScrollBoxRenderable,
} from "@opentui/core";
import { Screen } from "./screen.js";
import { Colors } from "../utils/theme.js";

/** Pending approval waiting for user input. */
interface PendingApproval {
  callId: string;
  tool: string;
}

export class ChatScreen extends Screen {
  capturesInput = true;

  private chatScroll!: ScrollBoxRenderable;
  private chatInput!: InputRenderable;
  private ws: WebSocket | null = null;
  private msgCounter = 0;

  /** Accumulates streaming delta chunks for the current assistant turn. */
  private deltaBuffer = "";
  private deltaRenderable: TextRenderable | null = null;

  /** Queue of approvals waiting for user input (FIFO). */
  private approvalQueue: PendingApproval[] = [];

  async build(): Promise<void> {
    this.container = new BoxRenderable(this.renderer, {
      backgroundColor: Colors.bg,
      flexDirection: "column",
      width: "100%",
      flexGrow: 1,
    });

    this.chatScroll = new ScrollBoxRenderable(this.renderer, {
      backgroundColor: Colors.surface,
      flexGrow: 1,
      width: "100%",
      stickyScroll: true,
      stickyStart: "bottom",
      border: true,
      borderColor: Colors.border,
      title: " チャット ",
      contentOptions: { paddingLeft: 1, paddingRight: 1 },
    });
    this.container.add(this.chatScroll);

    const inputBox = new BoxRenderable(this.renderer, {
      height: 3,
      border: true,
      borderColor: Colors.accent,
      paddingLeft: 1,
      paddingRight: 1,
    });

    this.chatInput = new InputRenderable(this.renderer, {
      width: "100%",
      placeholder: "メッセージを入力...",
      focusedBackgroundColor: Colors.surface,
      textColor: Colors.text,
      cursorColor: Colors.accent,
    });
    inputBox.add(this.chatInput);
    this.container.add(inputBox);

    // Instant approval on single y/n keypress (no Enter needed)
    this.renderer.keyInput.on("keypress", (key: { sequence?: string }) => {
      if (this.approvalQueue.length === 0) return;
      const seq = key.sequence?.toLowerCase();
      if (seq === "y" || seq === "n") {
        this.handleApprovalInput(seq);
        try { this.chatInput.value = ""; } catch { /* ignore */ }
      }
    });

    this.chatInput.on(InputRenderableEvents.CHANGE, (value: unknown) => {
      const text = String(value ?? "").trim();
      if (!text) return;

      // If an approval is pending, intercept y/n input (fallback for Enter-based input)
      if (this.approvalQueue.length > 0) {
        this.handleApprovalInput(text);
      } else {
        this.sendMessage(text);
      }
      try { this.chatInput.value = ""; } catch { /* ignore */ }
    });
  }

  refresh(): void {
    this.ensureWebSocket();
  }

  // -------------------------------------------------------------------
  // Rendering helpers
  // -------------------------------------------------------------------

  private addLine(text: string, color: string): void {
    const id = `chat-msg-${++this.msgCounter}`;
    const msg = new TextRenderable(this.renderer, { id, content: text, fg: color });
    this.chatScroll.add(msg);
    this.trimMessages();
  }

  private trimMessages(): void {
    const children = this.chatScroll.getChildren();
    while (children.length > 500) {
      const oldest = children.shift();
      if (oldest) {
        this.chatScroll.remove(oldest.id);
        oldest.destroyRecursively();
      }
    }
  }

  /** Append a delta chunk to the current streaming renderable. */
  private appendDelta(content: string): void {
    this.deltaBuffer += content;
    if (!this.deltaRenderable) {
      const id = `chat-msg-${++this.msgCounter}`;
      this.deltaRenderable = new TextRenderable(this.renderer, {
        id,
        content: `Bot: ${this.deltaBuffer}`,
        fg: Colors.accent,
      });
      this.chatScroll.add(this.deltaRenderable);
    } else {
      this.deltaRenderable.content = `Bot: ${this.deltaBuffer}`;
    }
  }

  /** Flush the current delta buffer (called on "done"). */
  private flushDelta(): void {
    this.deltaBuffer = "";
    this.deltaRenderable = null;
  }

  // -------------------------------------------------------------------
  // Approval handling
  // -------------------------------------------------------------------

  private handleApprovalInput(text: string): void {
    const pending = this.approvalQueue[0];
    if (!pending) return;

    const lower = text.toLowerCase();
    const approved = lower === "y" || lower === "yes";

    if (lower !== "y" && lower !== "yes" && lower !== "n" && lower !== "no") {
      this.addLine("  許可は y / 拒否は n を入力してください。", Colors.muted);
      return;
    }

    // Send approval response
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        action: "approve_tool",
        call_id: pending.callId,
        response: approved ? "yes" : "no",
      }));
    }

    const label = approved ? "許可" : "拒否";
    const color = approved ? Colors.green : Colors.red;
    this.addLine(`  ${label}: ${pending.tool}`, color);

    this.approvalQueue.shift();
    this.updateInputPlaceholder();
  }

  private showApprovalPrompt(callId: string, tool: string, args: string): void {
    this.approvalQueue.push({ callId, tool });

    const truncated = args.length > 120 ? args.slice(0, 117) + "..." : args;
    this.addLine("", Colors.muted); // spacer
    this.addLine(`  承認が必要です`, Colors.yellow);
    this.addLine(`  ツール: ${tool}`, Colors.text);
    if (truncated) {
      this.addLine(`  引数: ${truncated}`, Colors.muted);
    }
    this.addLine(`  許可は y、拒否は n を押してください。`, Colors.yellow);

    this.updateInputPlaceholder();
  }

  private updateInputPlaceholder(): void {
    if (this.approvalQueue.length > 0) {
      const next = this.approvalQueue[0];
      try {
        (this.chatInput as unknown as { placeholder: string }).placeholder =
          `${next.tool} を許可しますか? (y/n)`;
      } catch { /* ignore */ }
    } else {
      try {
        (this.chatInput as unknown as { placeholder: string }).placeholder =
          "メッセージを入力...";
      } catch { /* ignore */ }
    }
  }

  // -------------------------------------------------------------------
  // WebSocket
  // -------------------------------------------------------------------

  private sendMessage(text: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.addLine("[システム]: 未接続", Colors.yellow);
      return;
    }
    this.ws.send(JSON.stringify({ action: "send", message: text }));
    this.addLine(`あなた: ${text}`, Colors.green);
  }

  private ensureWebSocket(): void {
    if (this.ws && this.ws.readyState <= WebSocket.OPEN) return;
    try {
      const baseUrl = (this.api as unknown as { baseUrl: string }).baseUrl || "";
      const wsBase = baseUrl.replace(/^https:/, "wss:").replace(/^http:/, "ws:");
      const secret = (this.api as unknown as { secret: string }).secret || "";
      const wsUrl = secret ? `${wsBase}/api/chat/ws?token=${secret}` : `${wsBase}/api/chat/ws`;

      this.ws = new WebSocket(wsUrl);
      this.ws.onopen = () => this.addLine("[システム]: 接続済み", Colors.muted);
      this.ws.onmessage = (ev) => this.handleWsMessage(ev);
      this.ws.onclose = () => {
        this.addLine("[システム]: 切断", Colors.muted);
        setTimeout(() => this.ensureWebSocket(), 3000);
      };
    } catch { /* ignore */ }
  }

  private handleWsMessage(ev: MessageEvent): void {
    try {
      const data = JSON.parse(String(ev.data));
      switch (data.type) {
        case "delta":
          if (data.content) this.appendDelta(data.content);
          break;

        case "message":
          this.addLine(`Bot: ${data.content || "(応答なし)"}`, Colors.accent);
          break;

        case "done":
          this.flushDelta();
          break;

        case "error":
          this.addLine(`[エラー]: ${data.content}`, Colors.red);
          break;

        case "event":
          this.handleEvent(data);
          break;

        default:
          break;
      }
    } catch { /* ignore malformed JSON */ }
  }

  private handleEvent(data: Record<string, unknown>): void {
    const event = data.event as string;
    switch (event) {
      case "tool_start": {
        const tool = (data.tool as string) || "unknown";
        const args = (data.arguments as string) || "";
        const short = args.length > 60 ? args.slice(0, 57) + "..." : args;
        this.addLine(`  [ツール] ${tool}(${short})`, Colors.muted);
        break;
      }
      case "tool_done": {
        const tool = (data.tool as string) || "unknown";
        this.addLine(`  [完了] ${tool}`, Colors.dim);
        break;
      }
      case "approval_request": {
        const callId = (data.call_id as string) || "";
        const tool = (data.tool as string) || "unknown";
        const args = (data.arguments as string) || "";
        this.showApprovalPrompt(callId, tool, args);
        break;
      }
      case "approval_resolved": {
        // Server-side resolution (e.g. timeout) -- remove from queue
        const callId = data.call_id as string;
        this.approvalQueue = this.approvalQueue.filter(a => a.callId !== callId);
        this.updateInputPlaceholder();
        break;
      }
      case "tool_denied": {
        const tool = (data.tool as string) || "unknown";
        this.addLine(`  [拒否] ${tool}`, Colors.red);
        break;
      }
      default:
        break;
    }
  }
}
