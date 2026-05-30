/**
 * First-run disclaimer -- shown once in plain terminal mode before the
 * TUI launches. Persists acceptance to disk so it only shows once.
 */

import { DISCLAIMER_FLAG } from "../config/constants.js";

const RED = "\x1b[31m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const YELLOW = "\x1b[33m";
const RESET = "\x1b[0m";
const WHITE = "\x1b[97m";

const DISCLAIMER_LINES = [
  "",
  `${RED}${BOLD}  ============================================================${RESET}`,
  `${RED}${BOLD}   技術デモンストレーター — リスクに関する免責事項${RESET}`,
  `${RED}${BOLD}  ============================================================${RESET}`,
  "",
  `${WHITE}  本ソフトウェアは技術デモンストレーターであり、${RESET}`,
  `${WHITE}  ${BOLD}継続利用や本番運用を想定していません。${RESET}`,
  "",
  `${YELLOW}  続行することで、以下を認識いただいたものとみなします:${RESET}`,
  "",
  `${RED}  *${RESET} ${BOLD}高自律エージェント。${RESET}${DIM} 本システムは高い自律性と昇格された${RESET}`,
  `${DIM}    権限レベルで AI エージェントを展開します。エージェントは事前確認なしに、${RESET}`,
  `${DIM}    コード実行、クラウドリソースの作成と削除、メッセージ送信、API アクセス、${RESET}`,
  `${DIM}    コードのリポジトリへのプッシュ、重大な意思決定をユーザーに代わって${RESET}`,
  `${DIM}    行う可能性があります。${RESET}`,
  "",
  `${RED}  *${RESET} ${BOLD}サンドボックス環境専用。${RESET}${DIM} 本システムはサンドボックス用 Azure${RESET}`,
  `${DIM}    サブスクリプションと使い捨て GitHub アカウントに対してのみ実行してください。${RESET}`,
  `${DIM}    本番アカウント、課金影響のあるサブスクリプション、重要なリポジトリには${RESET}`,
  `${DIM}    接続しないでください。${RESET}`,
  "",
  `${RED}  *${RESET} ${BOLD}損害発生の可能性。${RESET}${DIM} エージェントはリソースの削除、意図しない${RESET}`,
  `${DIM}    メッセージ送信、コードプッシュ、クラウド費用の発生、API クォータの枯渇、${RESET}`,
  `${DIM}    認証情報の漏洩など、破壊的または取り消し不可能な操作を行う可能性が${RESET}`,
  `${DIM}    あります。発生するあらゆる結果について、すべて利用者が責任を負います。${RESET}`,
  "",
  `${RED}  *${RESET} ${BOLD}無保証。${RESET}${DIM} 本ソフトウェアは MIT ライセンスの下で「現状有姿」で${RESET}`,
  `${DIM}    提供され、いかなる保証もありません。作者および貢献者は、本システムの${RESET}`,
  `${DIM}    使用によって発生する損害、費用、データ損失、その他あらゆる損害について${RESET}`,
  `${DIM}    一切の責任を負いません。${RESET}`,
  "",
  `${RED}  *${RESET} ${BOLD}サポート対象外。${RESET}${DIM} 本ソフトウェアは実験的な技術デモンストレー${RESET}`,
  `${DIM}    ションです。SLA、正確性、安全性、可用性に関する保証はありません。${RESET}`,
  "",
  `${RED}${BOLD}  ============================================================${RESET}`,
  "",
];

/**
 * Show the disclaimer and block until the user types "accept".
 * No-ops if the disclaimer was already accepted previously.
 */
export async function showDisclaimer(): Promise<void> {
  try {
    if (await Bun.file(DISCLAIMER_FLAG).exists()) return;
  } catch {
    // File doesn't exist -- continue to show disclaimer
  }

  process.stdout.write("\x1b[2J\x1b[H"); // clear screen

  for (const line of DISCLAIMER_LINES) {
    process.stdout.write(line + "\n");
  }

  process.stdout.write(
    `${YELLOW}  リスクに同意して続行するには ${WHITE}${BOLD}accept${RESET}${YELLOW} と入力してください: ${RESET}`,
  );

  const response = await new Promise<string>((resolve) => {
    const onData = (data: Buffer) => {
      const input = data.toString().trim().toLowerCase();
      if (input) {
        process.stdin.removeListener("data", onData);
        process.stdin.setRawMode?.(false);
        process.stdin.pause();
        resolve(input);
      }
    };
    process.stdin.resume();
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", onData);
  });

  if (response !== "accept") {
    process.stdout.write(`\n${RED}  免責事項に同意しなかったため終了します。${RESET}\n\n`);
    process.exit(1);
  }

  await Bun.write(DISCLAIMER_FLAG, new Date().toISOString());
  process.stdout.write(`\n${DIM}  免責事項に同意しました。${RESET}\n\n`);
}
