import { Client, isFullPage } from "@notionhq/client";
import type {
  GetDatabaseResponse,
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
  collectStatusLabels,
  getPropertyMetaByName,
  resolvePropertyId,
  findPropertyIdByType,
  resolveStatusPropertyId,
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

function anyStatusLabelInSet(
  labels: string[],
  set: Set<string>
): boolean {
  const normalize = (s: string): string =>
    s
      .normalize("NFKC")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  const normalizedTargets = [...set].map(normalize).filter(Boolean);
  return labels.some((label) => {
    const n = normalize(label);
    if (!n) return false;
    if (normalizedTargets.includes(n)) return true;
    // 絵文字や接頭辞付き（例: "✅ 完了"）を拾えるよう部分一致も許容
    return normalizedTargets.some((t) => t.length >= 2 && n.includes(t));
  });
}

type NotionDbProps = GetDatabaseResponse["properties"];

function propertyDisplayNameById(
  dbProps: NotionDbProps,
  propId: string | null
): string | null {
  if (!propId) return null;
  for (const m of Object.values(dbProps)) {
    if (m.id === propId) return m.name;
  }
  return null;
}

function notionDiagnosticEnabled(): boolean {
  const v = process.env.NOTION_DIAGNOSTIC?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

/** `NOTION_DIAGNOSTIC=true` のときに CLI がファイルへ書き出す用（トークン等は含めない） */
export interface NotionDiagnosticSnapshot {
  databaseId: string;
  skipTagFilter: boolean;
  tagPropertyName: string | null;
  tagFilterPropertyId: string | null;
  tagFilterPropertyType: string | null;
  tagValue: string;
  tagFilterMode: string;
  statusPropertyEnv: string | null;
  statusResolvedId: string | null;
  statusResolvedName: string | null;
  statusResolvedSchemaType: string | null;
  pageCount: number;
  rowCount: number;
  doneCount: number;
  inProgressCount: number;
  otherStatusCount: number;
  sampleRows: Array<{ title: string; statusLabels: string[]; done: boolean }>;
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
): Promise<{
  payload: WeeklyReportPayload;
  diagnostic: NotionDiagnosticSnapshot | null;
}> {
  const notion = new Client({ auth: env.token });
  const db = await notion.databases.retrieve({ database_id: env.databaseId });
  const dbProps = db.properties;

  const titlePropId = findPropertyIdByType(dbProps, "title");
  const statusPropId = env.statusProperty
    ? resolveStatusPropertyId(dbProps, env.statusProperty)
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
  /** タグ列の DB 上のプロパティ ID（クエリ filter の property には ID 推奨・表示名の不可視差異を避ける） */
  let tagFilterPropertyId: string | null = null;
  let tagFilterPropertyType: string | null = null;
  if (!env.skipTagFilter && env.tagProperty) {
    const tagPropName = env.tagProperty;
    const tagMeta = getPropertyMetaByName(dbProps, tagPropName);
    if (!tagMeta) {
      throw new Error(`タグプロパティ「${tagPropName}」がデータベースに見つかりません。`);
    }
    if (!tagMeta.id?.trim()) {
      throw new Error(`タグプロパティ「${tagPropName}」に id がありません（Notion API の不整合）。`);
    }
    const tagPropertyIdForFilter: string = tagMeta.id;
    tagFilterPropertyId = tagPropertyIdForFilter;
    tagFilterPropertyType = tagMeta.type;

    const nonEmptyFilter = (): Extract<
      QueryDatabaseParameters["filter"],
      { property: string }
    > => {
      if (tagMeta.type === "multi_select") {
        return {
          property: tagPropertyIdForFilter,
          multi_select: { is_not_empty: true },
        };
      }
      if (tagMeta.type === "select") {
        return {
          property: tagPropertyIdForFilter,
          select: { is_not_empty: true },
        };
      }
      throw new Error(
        `タグ列「${tagPropName}」は multi_select か select である必要があります（実際は ${tagMeta.type}）。relation の場合は別 DB 参照のため、このツールのタグ絞り込みには使えません。`
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
          property: tagPropertyIdForFilter,
          multi_select: { contains: v },
        };
      }
      if (tagMeta.type === "select") {
        return {
          property: tagPropertyIdForFilter,
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
      if (isFullPage(row) && !row.archived && !row.in_trash) pages.push(row);
    }
    cursor = res.has_more ? res.next_cursor ?? undefined : undefined;
  } while (cursor);

  const rows = pages.map((p) => {
    const title = getPlainTitle(p, dbProps, titlePropId);
    const statusLabels = statusPropId
      ? collectStatusLabels(
          p,
          dbProps,
          statusPropId,
          env.statusProperty
        )
      : [];
    const status =
      statusLabels.length > 0 ? statusLabels.join("・") : null;
    const done = statusPropId
      ? anyStatusLabelInSet(statusLabels, env.doneStatusValues)
      : false;
    const step = milestonePropId
      ? getMilestoneStep(
          p,
          dbProps,
          milestonePropId,
          env.milestoneProperty,
          env.milestoneSelectOrder
        )
      : null;
    const prio = getPriorityNumber(
      p,
      dbProps,
      priorityPropId,
      env.priorityProperty
    );
    const memo = getRichTextPlain(
      p,
      dbProps,
      memoPropId,
      env.progressMemoProperty
    );
    return {
      page: p,
      title,
      status,
      statusLabels,
      done,
      step,
      prio,
      memo,
    };
  });

  const total = rows.length;
  const doneCount = rows.filter((r) => r.done).length;
  const inProgressCount = statusPropId
    ? rows.filter((r) =>
        anyStatusLabelInSet(r.statusLabels, env.inProgressStatusValues)
      ).length
    : 0;
  /** 完了でも進行中でもない（未着手・保留・空ラベルなど） */
  const otherStatusCount =
    statusPropId && total > 0
      ? rows.filter(
          (r) =>
            Boolean(r.title) &&
            !r.done &&
            !anyStatusLabelInSet(r.statusLabels, env.inProgressStatusValues)
        ).length
      : 0;
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

  const parseMultiline = (v: string): string[] =>
    v
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);

  let goals: string[];
  if (env.weekGoalsText) {
    goals = parseMultiline(env.weekGoalsText);
  } else if (env.deriveGoalsFromTasks) {
    goals = incomplete.slice(0, 3).map((r) => r.title);
  } else {
    goals = ["（今週の目標は NOTION_WEEK_GOALS を設定して入力してください）"];
  }
  if (goals.length === 0) {
    goals = ["（今週の目標を NOTION_WEEK_GOALS で指定するか、未完了タスクをDBに追加してください）"];
  }

  const nextActions =
    env.nextActionsText != null
      ? parseMultiline(env.nextActionsText).map((text, i) => ({
          id: `manual-${i + 1}`,
          text,
        }))
      : env.deriveNextActionsFromTasks
        ? incomplete.slice(0, 3).map((r) => ({
            id: r.page.id.replace(/-/g, "").slice(0, 12),
            text: r.title,
          }))
        : [];

  const titles = rows.map((r) => r.title).filter(Boolean);
  const scope = taskScopeLabel(env);
  const bodyParts = [
    statusPropId
      ? `${scope}タスク ${total} 件。完了 ${doneCount}、未完了 ${total - doneCount}。` +
          (total > 0
            ? `内訳（タイトルあり・完了以外）: 進行中 ${inProgressCount}・その他（未着手など）${otherStatusCount}。`
            : "")
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
        `${scope}タスクの完了率 ${total ? Math.round((doneCount / total) * 100) : 0}%（完了 ${doneCount} / 全 ${total}）。` +
          (inProgressCount > 0 ? ` 進行中 ${inProgressCount} 件。` : ""),
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

  let diagnostic: NotionDiagnosticSnapshot | null = null;
  if (notionDiagnosticEnabled()) {
    const statusMeta = statusPropId
      ? Object.values(dbProps).find((m) => m.id === statusPropId)
      : undefined;
    const sampleRows = rows.slice(0, 8).map((r) => ({
      title: r.title.slice(0, 60),
      statusLabels: r.statusLabels,
      done: r.done,
    }));
    diagnostic = {
      databaseId: env.databaseId,
      skipTagFilter: env.skipTagFilter,
      tagPropertyName: env.tagProperty,
      tagFilterPropertyId,
      tagFilterPropertyType,
      tagValue: env.tagValue,
      tagFilterMode: env.tagFilterMode,
      statusPropertyEnv: env.statusProperty,
      statusResolvedId: statusPropId,
      statusResolvedName: propertyDisplayNameById(dbProps, statusPropId),
      statusResolvedSchemaType: statusMeta?.type ?? null,
      pageCount: pages.length,
      rowCount: rows.length,
      doneCount,
      inProgressCount,
      otherStatusCount,
      sampleRows,
    };
    console.warn(
      "[NOTION_DIAGNOSTIC]",
      JSON.stringify(diagnostic, null, 2)
    );
  }

  const payload: WeeklyReportPayload = {
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
        ? `${scope}タスクで 完了 ${doneCount}/${total}。${
            inProgressCount > 0 ? `進行中 ${inProgressCount} 件。` : ""
          }${sig.statusLabel.replace(/^見立て：/, "")}`
        : `${scope}の取得 ${total} 件。${sig.statusLabel.replace(/^見立て：/, "")}`,
      body: bodyParts.join("").trim(),
    },
    nextActions:
      nextActions.length > 0
        ? nextActions
        : [
            {
              id: "placeholder",
              text:
                env.deriveNextActionsFromTasks
                  ? "（次に着手するタスクを Notion に未完了で登録してください）"
                  : "（次週アクションは NOTION_NEXT_ACTIONS に改行区切りで設定してください）",
            },
          ],
  };

  return { payload, diagnostic };
}
