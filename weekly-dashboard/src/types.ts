/** 週次レポートの入力（Notion 連携時はこの形にマッピングする） */
export type SignalLevel = "red" | "yellow" | "green";

export interface WeeklyReportPayload {
  meta: {
    /** `[data-report-root]` の data-project */
    projectId: string;
    /** `[data-report-root]` の data-template-version */
    templateVersion: number;
  };
  header: {
    reportLabel: string;
    reportTitle: string;
    /** 例: 対象週 2026/05/04〜05/10 */
    weekRange: string;
    /** 今週の目標（箇条書き各行。先頭に「・」が無ければ付与） */
    goals: string[];
  };
  signal: {
    level: SignalLevel;
    statusLabel: string;
    caption: string;
  };
  milestones: {
    currentStep: 1 | 2 | 3 | 4;
    labels: [string, string, string, string];
    /** 「進行中：…」の右側に付く短文（省略可） */
    progressHint?: string;
  };
  weeklySummary: {
    lead: string;
    body: string;
  };
  nextActions: Array<{ id: string; text: string }>;
}

export function normalizeGoals(goals: string[]): string[] {
  return goals.map((g) => {
    const t = g.trim();
    if (t.startsWith("・") || t.startsWith("•")) return t;
    return `・${t}`;
  });
}
