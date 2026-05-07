/**
 * Notion → ペイロード変換用の環境変数（名前は README / .env.example を参照）
 */
export interface NotionMappingEnv {
  token: string;
  databaseId: string;
  /** multi_select / select のプロパティ表示名。未設定で NOTION_SKIP_TAG_FILTER=true ならタグ絞り込みなし */
  tagProperty: string | null;
  tagValue: string;
  skipTagFilter: boolean;
  /** status / select の「完了」判定用。カンマ区切り（例: 完了,Done） */
  doneStatusValues: Set<string>;
  /** null のとき完了率ベースの信号は常に「データなし」扱いに近い挙動 */
  statusProperty: string | null;
  /** 1〜4 の number 型、または select のいずれか */
  milestoneProperty: string | null;
  /** select の場合、左から1〜4に対応するオプション名（カンマ区切り） */
  milestoneSelectOrder: string[];
  /** 数値の優先度（小さいほど上）。無ければ last_edited_time */
  priorityProperty: string | null;
  /** 今週の目標: 改行区切りテキスト。空なら未完了タスク名から最大3件 */
  weekGoalsText: string | null;
  reportLabel: string;
  reportTitle: string;
  projectId: string;
  templateVersion: number;
  milestoneLabels: [string, string, string, string];
  /** 信号の追加根拠に使うプロパティ（rich_text / title の表示名） */
  progressMemoProperty: string | null;
}

function parseCsvSet(s: string | undefined, fallback: string): Set<string> {
  const raw = (s ?? fallback).split(",").map((x) => x.trim()).filter(Boolean);
  return new Set(raw.map((x) => x.toLowerCase()));
}

function parseCsvArray(s: string | undefined, fallback: string[]): string[] {
  if (!s?.trim()) return [...fallback];
  return s.split(",").map((x) => x.trim()).filter(Boolean);
}

export function readNotionMappingEnv(): NotionMappingEnv {
  const token = process.env.NOTION_TOKEN?.trim();
  const databaseId = process.env.NOTION_DATABASE_ID?.trim();
  if (!token) throw new Error("NOTION_TOKEN が未設定です。");
  if (!databaseId) throw new Error("NOTION_DATABASE_ID が未設定です。");

  const skipTagFilter =
    process.env.NOTION_SKIP_TAG_FILTER === "1" ||
    process.env.NOTION_SKIP_TAG_FILTER === "true";

  const tagProperty = process.env.NOTION_TAG_PROPERTY?.trim() || null;
  if (!skipTagFilter && !tagProperty) {
    throw new Error(
      "NOTION_TAG_PROPERTY を設定するか、NOTION_SKIP_TAG_FILTER=true でタグ無しクエリにしてください。"
    );
  }

  const defaultMilestoneLabels: [string, string, string, string] = [
    "要件・方針FIX",
    "コア実装",
    "検証・公開準備",
    "運用・改善",
  ];
  const labelsRaw = process.env.NOTION_MILESTONE_LABELS_JSON?.trim();
  let milestoneLabels = defaultMilestoneLabels;
  if (labelsRaw) {
    try {
      const parsed = JSON.parse(labelsRaw) as unknown;
      if (
        Array.isArray(parsed) &&
        parsed.length === 4 &&
        parsed.every((x) => typeof x === "string")
      ) {
        milestoneLabels = parsed as [string, string, string, string];
      }
    } catch {
      throw new Error("NOTION_MILESTONE_LABELS_JSON が不正な JSON です。");
    }
  }

  return {
    token,
    databaseId,
    tagProperty,
    tagValue: process.env.NOTION_TAG_VALUE?.trim() || "制作",
    skipTagFilter,
    doneStatusValues: parseCsvSet(
      process.env.NOTION_DONE_STATUS_VALUES,
      "完了,Done,done"
    ),
    statusProperty:
      process.env.NOTION_STATUS_DISABLE === "1" ||
      process.env.NOTION_STATUS_DISABLE === "true"
        ? null
        : process.env.NOTION_STATUS_PROPERTY?.trim() || "ステータス",
    milestoneProperty:
      process.env.NOTION_MILESTONE_DISABLE === "1" ||
      process.env.NOTION_MILESTONE_DISABLE === "true"
        ? null
        : process.env.NOTION_MILESTONE_PROPERTY?.trim() || "マイルストーン",
    milestoneSelectOrder: parseCsvArray(
      process.env.NOTION_MILESTONE_SELECT_ORDER,
      []
    ),
    priorityProperty: process.env.NOTION_PRIORITY_PROPERTY?.trim() || null,
    weekGoalsText: process.env.NOTION_WEEK_GOALS?.trim() || null,
    reportLabel:
      process.env.NOTION_REPORT_LABEL?.trim() ||
      "週次レポート・自分用 / アプリ制作",
    reportTitle:
      process.env.NOTION_REPORT_TITLE?.trim() ||
      "アプリ制作 — 進捗状況（Notion連携）",
    projectId: process.env.NOTION_PROJECT_ID?.trim() || "app-production",
    templateVersion: Number(process.env.NOTION_TEMPLATE_VERSION ?? "11") || 11,
    milestoneLabels,
    progressMemoProperty:
      process.env.NOTION_PROGRESS_MEMO_PROPERTY?.trim() || null,
  };
}
