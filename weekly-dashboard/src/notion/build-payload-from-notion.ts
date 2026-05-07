import { Client, isFullPage } from "@notionhq/client";
import type {
  PageObjectResponse,
  QueryDatabaseParameters,
} from "@notionhq/client/build/src/api-endpoints.js";
import { endOfWeek, format, startOfWeek } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import type { NotionMappingEnv } from "./config.js";
import {
  getMilestoneStep,
  getPlainTitle,
  getPriorityNumber,
  getRichTextPlain,
  getStatusLikeName,
  getPropertyMetaByName,
  resolvePropertyId,
  findPropertyIdByType,
} from "./property-extract.js";
import type { SignalLevel, WeeklyReportPayload } from "../types.js";

const TZ = "Asia/Tokyo";

function weekRangeLabel(now: Date, override: string | null): string {
  if (override?.trim()) return override.trim();
  const z = toZonedTime(now, TZ);
  const start = startOfWeek(z, { weekStartsOn: 1 });
  const end = endOfWeek(z, { weekStartsOn: 1 });
  return `対象週 ${format(start, "yyyy/MM/dd")}〜${format(end, "yyyy/MM/dd")}`;
}

function isDone(statusName: string | null, done: Set<string>): boolean {
  if (!statusName) return false;
  return done.has(statusName.trim().toLowerCase());
}

/** レポート用: どのタスク集合を数えているか（Notion クエリと一致させる） */
function taskScopeLabel(env: NotionMappingEnv): string {
  if (env.skipTagFilter) return "データベース全件の";
  const prop = env.tagProperty ?? "タグ";
  const val = env.tagValue?.trim() || "";
  if (env.tagFilterMode === "value") {
    return `「${prop}」で「${val}」が選ばれている`;
  }
  if (env.tagFilterMode === "both") {
    return `「${prop}」が空でなく「${val}」を含む`;
  }
  return `「${prop}」にタグが1つ以上付いている`;
}

function signalFromRatio(done: number, total: number): {
  level: SignalLevel;
  statusLabel: string;
} {
  if (total === 0) {
    return { level: "yellow", statusLabel: "見立て：データなし（黄）" };
  }
  const r = done / total;
  if (r >= 0.75) return { level: "green", statusLabel: "見立て：順調（緑）" };
  if (r >= 0.45) return { level: "yellow", statusLabel: "見立て：やや遅れ（黄）" };
  return { level: "red", statusLabel: "見立て：遅れ（赤）" };
}

export async function buildWeeklyPayloadFromNotion(
  env: NotionMappingEnv
): Promise<WeeklyReportPayload> {
  const notion = new Client({ auth: env.token });
  const db = await notion.databases.retrieve({ database_id: env.databaseId });
  const dbProps = db.properties;

  const titlePropId = findPropertyIdByType(dbProps, "title");
  const statusPropId = env.statusProperty
    ? resolvePropertyId(dbProps, env.statusProperty)
    : null;
  const milestonePropId = env.milestoneProperty
    ? resolvePropertyId(dbProps, env.milestoneProperty)
    : null;
  const priorityPropId = env.priorityProperty
    ? resolvePropertyId(dbProps, env.priorityProperty)
    : null;
  const memoPropId = env.progressMemoProperty
    ? resolvePropertyId(dbProps, env.progressMemoProperty)
    : null;

  if (milestonePropId && env.milestoneProperty) {
    const mm = getPropertyMetaByName(dbProps, env.milestoneProperty);
    if (mm?.type === "select" && env.milestoneSelectOrder.length === 0) {
      throw new Error(
        "マイルストーンが select の場合、NOTION_MILESTONE_SELECT_ORDER にカンマ区切りで各段のオプション名を指定してください（左から1〜4）。"
      );
    }
  }

  let filter: QueryDatabaseParameters["filter"] | undefined;
  if (!env.skipTagFilter && env.tagProperty) {
    const tagPropName = env.tagProperty;
    const tagMeta = getPropertyMetaByName(dbProps, tagPropName);
    if (!tagMeta) {
      throw new Error(`タグプロパティ「${tagPropName}」がデータベースに見つかりません。`);
    }

    const nonEmptyFilter = (): Extract<
      QueryDatabaseParameters["filter"],
      { property: string }
    > => {
      if (tagMeta.type === "multi_select") {
        return {
          property: tagPropName,
          multi_select: { is_not_empty: true },
        };
      }
      if (tagMeta.type === "select") {
        return {
          property: tagPropName,
          select: { is_not_empty: true },
        };
      }
      throw new Error(
        `タグ列「${tagPropName}」は multi_select か select である必要があります（実際は ${tagMeta.type}）。`
      );
    };

    const valueFilter = (): Extract<
      QueryDatabaseParameters["filter"],
      { property: string }
    > | null => {
      const v = env.tagValue?.trim();
      if (!v) return null;
      if (tagMeta.type === "multi_select") {
        return {
          property: tagPropName,
          multi_select: { contains: v },
        };
      }
      if (tagMeta.type === "select") {
        return {
          property: tagPropName,
          select: { equals: v },
        };
      }
      return null;
    };

    const mode = env.tagFilterMode;
    if (mode === "non_empty") {
      filter = nonEmptyFilter();
    } else if (mode === "value") {
      const vf = valueFilter();
      if (!vf) {
        throw new Error(
          "NOTION_TAG_FILTER_MODE=value のときは NOTION_TAG_VALUE にタグ名を設定してください。"
        );
      }
      filter = vf;
    } else {
      const vf = valueFilter();
      if (!vf) {
        throw new Error(
          "NOTION_TAG_FILTER_MODE=both のときは NOTION_TAG_VALUE を設定してください。"
        );
      }
      filter = { and: [nonEmptyFilter(), vf] };
    }
  }

  const pages: PageObjectResponse[] = [];
  let cursor: string | undefined;
  do {
    const res = await notion.databases.query({
      database_id: env.databaseId,
      ...(filter ? { filter } : {}),
      page_size: 100,
      start_cursor: cursor,
    });
    for (const row of res.results) {
      if (isFullPage(row)) pages.push(row);
    }
    cursor = res.has_more ? res.next_cursor ?? undefined : undefined;
  } while (cursor);

  const rows = pages.map((p) => {
    const title = getPlainTitle(p, titlePropId);
    const status = getStatusLikeName(p, statusPropId);
    const done = statusPropId ? isDone(status, env.doneStatusValues) : false;
    const step = milestonePropId
      ? getMilestoneStep(p, milestonePropId, env.milestoneSelectOrder)
      : null;
    const prio = getPriorityNumber(p, priorityPropId);
    const memo = getRichTextPlain(p, memoPropId);
    return { page: p, title, status, done, step, prio, memo };
  });

  const total = rows.length;
  const doneCount = rows.filter((r) => r.done).length;
  const sig = !statusPropId
    ? {
        level: "yellow" as const,
        statusLabel: "見立て：ステータス未設定（黄）",
      }
    : signalFromRatio(doneCount, total);

  const steps = rows
    .map((r) => r.step)
    .filter((s): s is number => s != null && s >= 1 && s <= 4);
  const currentStep = (steps.length ? Math.max(...steps) : 2) as 1 | 2 | 3 | 4;

  const incomplete = rows
    .filter((r) => !r.done && r.title)
    .sort((a, b) => {
      const pa = a.prio ?? 9999;
      const pb = b.prio ?? 9999;
      if (pa !== pb) return pa - pb;
      return (
        new Date(b.page.last_edited_time).getTime() -
        new Date(a.page.last_edited_time).getTime()
      );
    });

  let goals: string[];
  if (env.weekGoalsText) {
    goals = env.weekGoalsText
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
  } else {
    goals = incomplete.slice(0, 3).map((r) => r.title);
    if (goals.length === 0) goals = ["（今週の目標を NOTION_WEEK_GOALS で指定するか、未完了タスクをDBに追加してください）"];
  }

  const nextActions = incomplete.slice(0, 3).map((r) => ({
    id: r.page.id.replace(/-/g, "").slice(0, 12),
    text: r.title,
  }));

  const titles = rows.map((r) => r.title).filter(Boolean);
  const scope = taskScopeLabel(env);
  const bodyParts = [
    statusPropId
      ? `${scope}タスク ${total} 件のうち、完了 ${doneCount} 件・未完了 ${total - doneCount} 件。`
      : `${scope}タスク ${total} 件を取得（ステータス列なしのため完了数は未判定）。`,
    titles.length ? `主なタスク: ${titles.slice(0, 5).join("、")}。` : "",
  ];
  const memos = rows.map((r) => r.memo).filter(Boolean).slice(0, 2);
  if (memos.length) bodyParts.push(`メモ抜粋: ${memos.join(" / ")}`);

  const captionParts = !statusPropId
    ? [
        "NOTION_STATUS_PROPERTY を設定すると、完了率から赤黄緑を推定します。",
        `${scope}の取得 ${total} 件。`,
      ]
    : [
        `${scope}タスクの完了率 ${total ? Math.round((doneCount / total) * 100) : 0}%（完了 ${doneCount} / 全 ${total}）。`,
        incomplete.length
          ? `未完了が ${incomplete.length} 件（次週アクション参照）。`
          : "未完了タスクはありません。",
      ];

  const progressHint =
    incomplete[0]?.title != null
      ? `進行中：${incomplete[0].title.slice(0, 40)}${incomplete[0].title.length > 40 ? "…" : ""}`
      : undefined;

  const weekLabel = weekRangeLabel(
    new Date(),
    process.env.NOTION_WEEK_LABEL?.trim() || null
  );

  return {
    meta: {
      projectId: env.projectId,
      templateVersion: env.templateVersion,
    },
    header: {
      reportLabel: env.reportLabel,
      reportTitle: env.reportTitle,
      weekRange: weekLabel,
      goals,
    },
    signal: {
      level: sig.level,
      statusLabel: sig.statusLabel,
      caption: captionParts.join(""),
    },
    milestones: {
      currentStep,
      labels: env.milestoneLabels,
      progressHint,
    },
    weeklySummary: {
      lead: statusPropId
        ? `${scope}タスクで 完了 ${doneCount}/${total}。${sig.statusLabel.replace(/^見立て：/, "")}`
        : `${scope}の取得 ${total} 件。${sig.statusLabel.replace(/^見立て：/, "")}`,
      body: bodyParts.join("").trim(),
    },
    nextActions:
      nextActions.length > 0
        ? nextActions
        : [
            {
              id: "placeholder",
              text: "（次に着手するタスクを Notion に未完了で登録してください）",
            },
          ],
  };
}
