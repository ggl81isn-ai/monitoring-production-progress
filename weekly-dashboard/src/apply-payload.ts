import { load } from "cheerio";
import type { WeeklyReportPayload } from "./types.js";
import { normalizeGoals } from "./types.js";

/**
 * `report-preview/index.html` をテンプレートとして、ペイロードを反映した HTML を返す。
 */
export function applyWeeklyReportPayload(
  templateHtml: string,
  payload: WeeklyReportPayload
): string {
  const $ = load(templateHtml);
  const root = $("main[data-report-root]");
  if (root.length === 0) {
    throw new Error("テンプレートに main[data-report-root] がありません。");
  }

  root.attr("data-project", payload.meta.projectId);
  root.attr("data-template-version", String(payload.meta.templateVersion));

  $("#report-label").text(payload.header.reportLabel);
  $("#report-title").text(payload.header.reportTitle);
  $("#report-week-range").text(payload.header.weekRange);

  const goals = normalizeGoals(payload.header.goals);
  const goalUl = $("#report-goal-summary ul");
  goalUl.empty();
  goals.forEach((text, i) => {
    goalUl.append(
      `<li data-field="goal-item-${i + 1}">${escapeHtml(text)}</li>`
    );
  });

  const traffic = $("#traffic-state");
  traffic.attr("data-signal", payload.signal.level);
  $("#signal-status-label").text(payload.signal.statusLabel);
  $("#signal-caption").text(payload.signal.caption);

  const step = String(payload.milestones.currentStep);
  $("#roadmap-visual").attr("data-current-step", step);
  payload.milestones.labels.forEach((label, i) => {
    $(`#milestone-label-${i + 1}`).text(label);
  });

  const currentLabel = payload.milestones.labels[payload.milestones.currentStep - 1];
  const hint = payload.milestones.progressHint?.trim();
  const tail = hint ? ` — ${escapeHtml(hint)}` : "";
  $("#milestone-caption").html(
    `現在地：<strong class="font-bold text-teal-800">${payload.milestones.currentStep}. ${escapeHtml(
      currentLabel
    )}</strong><span class="text-muted">${tail}</span>`
  );

  $("#weekly-summary-lead").text(payload.weeklySummary.lead);
  $("#weekly-summary").text(payload.weeklySummary.body);

  const list = $("#next-actions-list");
  list.empty();
  payload.nextActions.forEach((a, index) => {
    const n = index + 1;
    list.append(
      `<li class="flex gap-3 border-l-2 border-teal-200 pl-3" data-action-id="${escapeAttr(
        a.id
      )}">` +
        `<span class="w-6 shrink-0 font-bold text-teal-700">${n}</span>` +
        `<span class="min-w-0">${escapeHtml(a.text)}</span>` +
        `</li>`
    );
  });

  return $.root().html() ?? "";
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/'/g, "&#39;");
}
