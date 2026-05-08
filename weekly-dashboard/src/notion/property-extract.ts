import type {
  GetDatabaseResponse,
  PageObjectResponse,
} from "@notionhq/client/build/src/api-endpoints.js";

type DbProps = GetDatabaseResponse["properties"];

type PagePropBlock = PageObjectResponse["properties"][string];

function notionPropertyIdsEqual(a: string, b: string): boolean {
  if (a === b) return true;
  try {
    if (decodeURIComponent(a) === decodeURIComponent(b)) return true;
  } catch {
    /* ignore */
  }
  return false;
}

/** DB スキーマ上の property id からメタを返す */
export function getPropertyMetaById(
  dbProps: DbProps,
  propertyId: string | null
): DbProps[string] | null {
  if (!propertyId) return null;
  for (const meta of Object.values(dbProps)) {
    if (notionPropertyIdsEqual(meta.id, propertyId)) return meta;
  }
  return null;
}

/**
 * ページの `properties` の参照。
 * Notion API ではキーは **プロパティの表示名**（例: `ステータス`）であり、DB スキーマの `id` だけではヒットしないため、
 * 表示名・スキーマ名・id・内側の `id` 照合の順で解決する。
 */
export function getPagePropertyBlock(
  page: PageObjectResponse,
  dbProps: DbProps,
  resolvedPropertyId: string | null,
  /** 環境変数などで指定した表示名（DB の列名と一致） */
  explicitDisplayName?: string | null
): PagePropBlock | undefined {
  if (!resolvedPropertyId && !explicitDisplayName?.trim()) return undefined;

  const tryKey = (key: string | undefined | null): PagePropBlock | undefined => {
    if (!key?.trim()) return undefined;
    const b = page.properties[key];
    return b ?? undefined;
  };

  const fromExplicit = tryKey(explicitDisplayName);
  if (fromExplicit) return fromExplicit;

  const schemaName = resolvedPropertyId
    ? getPropertyMetaById(dbProps, resolvedPropertyId)?.name
    : undefined;
  const fromSchema = tryKey(schemaName ?? null);
  if (fromSchema) return fromSchema;

  const fromIdKey = tryKey(resolvedPropertyId);
  if (fromIdKey) return fromIdKey;

  if (resolvedPropertyId) {
    for (const block of Object.values(page.properties)) {
      if (
        block &&
        typeof block === "object" &&
        "id" in block &&
        typeof (block as { id?: unknown }).id === "string" &&
        notionPropertyIdsEqual(
          resolvedPropertyId,
          (block as { id: string }).id
        )
      ) {
        return block as PagePropBlock;
      }
    }
  }
  return undefined;
}

/** ページの `properties` のキーに使う property id */
export function resolvePropertyId(
  dbProps: DbProps,
  displayName: string
): string | null {
  for (const meta of Object.values(dbProps)) {
    if (meta.name === displayName) return meta.id;
  }
  return null;
}

export function getPropertyMetaByName(
  dbProps: DbProps,
  displayName: string
): DbProps[string] | null {
  for (const meta of Object.values(dbProps)) {
    if (meta.name === displayName) return meta;
  }
  return null;
}

export function findPropertyIdByType(
  dbProps: DbProps,
  type: "title" | "status" | "select" | "multi_select" | "number" | "rich_text"
): string | null {
  for (const meta of Object.values(dbProps)) {
    if (meta.type === type) return meta.id;
  }
  return null;
}

/**
 * 表示名で見つからないとき、DB 内の唯一の `status` 型列を使う（列名が「ステータス」以外の場合の救済）。
 */
export function resolveStatusPropertyId(
  dbProps: DbProps,
  configuredDisplayName: string
): string | null {
  const byName = resolvePropertyId(dbProps, configuredDisplayName);
  if (byName) return byName;
  return findPropertyIdByType(dbProps, "status");
}

export function getPlainTitle(
  page: PageObjectResponse,
  dbProps: DbProps,
  titlePropertyId: string | null
): string {
  if (!titlePropertyId) return "";
  const p = getPagePropertyBlock(page, dbProps, titlePropertyId, null);
  if (!p || p.type !== "title") return "";
  return p.title.map((t) => t.plain_text).join("").trim();
}

/** status / select / multi_select から現在のラベル一覧（完了判定はいずれかが一致すればよい） */
export function collectStatusLabels(
  page: PageObjectResponse,
  dbProps: DbProps,
  propertyId: string | null,
  /** NOTION_STATUS_PROPERTY と同じ表示名（ページ properties のキーと一致させる） */
  propertyDisplayName: string | null
): string[] {
  if (!propertyId) return [];
  const p = getPagePropertyBlock(
    page,
    dbProps,
    propertyId,
    propertyDisplayName
  );
  if (!p) return [];
  if (p.type === "status") {
    if (p.status?.name) return [p.status.name];
    return [];
  }
  if (p.type === "select") {
    if (p.select?.name) return [p.select.name];
    return [];
  }
  if (p.type === "multi_select") {
    return p.multi_select.map((o) => o.name).filter(Boolean);
  }
  return [];
}

export function getStatusLikeName(
  page: PageObjectResponse,
  dbProps: DbProps,
  statusPropertyId: string | null,
  statusPropertyDisplayName: string | null
): string | null {
  const labels = collectStatusLabels(
    page,
    dbProps,
    statusPropertyId,
    statusPropertyDisplayName
  );
  return labels.length ? labels.join("・") : null;
}

export function getRichTextPlain(
  page: PageObjectResponse,
  dbProps: DbProps,
  propId: string | null,
  propertyDisplayName: string | null
): string | null {
  if (!propId) return null;
  const p = getPagePropertyBlock(page, dbProps, propId, propertyDisplayName);
  if (!p || p.type !== "rich_text") return null;
  return p.rich_text.map((t) => t.plain_text).join("").trim() || null;
}

/** 1〜4。取れなければ null */
export function getMilestoneStep(
  page: PageObjectResponse,
  dbProps: DbProps,
  milestonePropertyId: string | null,
  milestonePropertyDisplayName: string | null,
  selectOrder: string[]
): number | null {
  if (!milestonePropertyId) return null;
  const p = getPagePropertyBlock(
    page,
    dbProps,
    milestonePropertyId,
    milestonePropertyDisplayName
  );
  if (!p) return null;
  if (p.type === "number" && typeof p.number === "number") {
    const n = Math.round(p.number);
    if (n >= 1 && n <= 4) return n;
    return null;
  }
  if (p.type === "select" && p.select?.name) {
    const idx = selectOrder.findIndex(
      (x) => x.toLowerCase() === p.select!.name!.toLowerCase()
    );
    if (idx >= 0) return idx + 1;
    return null;
  }
  return null;
}

export function getPriorityNumber(
  page: PageObjectResponse,
  dbProps: DbProps,
  priorityPropertyId: string | null,
  priorityPropertyDisplayName: string | null
): number | null {
  if (!priorityPropertyId) return null;
  const p = getPagePropertyBlock(
    page,
    dbProps,
    priorityPropertyId,
    priorityPropertyDisplayName
  );
  if (!p || p.type !== "number" || p.number == null) return null;
  return p.number;
}
