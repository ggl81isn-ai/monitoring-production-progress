import type {
  GetDatabaseResponse,
  PageObjectResponse,
} from "@notionhq/client/build/src/api-endpoints.js";

type DbProps = GetDatabaseResponse["properties"];

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

export function getPlainTitle(
  page: PageObjectResponse,
  titlePropertyId: string | null
): string {
  if (!titlePropertyId) return "";
  const p = page.properties[titlePropertyId];
  if (!p || p.type !== "title") return "";
  return p.title.map((t) => t.plain_text).join("").trim();
}

export function getStatusLikeName(
  page: PageObjectResponse,
  statusPropertyId: string | null
): string | null {
  if (!statusPropertyId) return null;
  const p = page.properties[statusPropertyId];
  if (!p) return null;
  if (p.type === "status" && p.status?.name) return p.status.name;
  if (p.type === "select" && p.select?.name) return p.select.name;
  return null;
}

export function getRichTextPlain(
  page: PageObjectResponse,
  propId: string | null
): string | null {
  if (!propId) return null;
  const p = page.properties[propId];
  if (!p || p.type !== "rich_text") return null;
  return p.rich_text.map((t) => t.plain_text).join("").trim() || null;
}

/** 1〜4。取れなければ null */
export function getMilestoneStep(
  page: PageObjectResponse,
  milestonePropertyId: string | null,
  selectOrder: string[]
): number | null {
  if (!milestonePropertyId) return null;
  const p = page.properties[milestonePropertyId];
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
  priorityPropertyId: string | null
): number | null {
  if (!priorityPropertyId) return null;
  const p = page.properties[priorityPropertyId];
  if (!p || p.type !== "number" || p.number == null) return null;
  return p.number;
}
