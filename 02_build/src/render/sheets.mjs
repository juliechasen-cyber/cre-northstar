import fs from "node:fs";
import * as XLSX from "xlsx";

// DD checklist JSON (dd-checklist.schema.json) → editable .xlsx.
// One sheet, grouped by category, elevated items first within each group.
export function renderChecklistXlsx(checklist, outPath) {
  const order = ["financial", "physical", "legal", "environmental", "tenancy", "market"];
  const rows = [["Category", "Task", "Why it matters", "Priority", "Source", "Status", "Owner", "Notes"]];
  for (const cat of order) {
    const items = (checklist.items ?? [])
      .filter((i) => i.category === cat)
      .sort((a, b) => (a.priority === b.priority ? 0 : a.priority === "elevated" ? -1 : 1));
    for (const i of items) {
      rows.push([
        cat.charAt(0).toUpperCase() + cat.slice(1),
        i.task,
        i.why ?? "",
        i.priority,
        i.sourceRef ?? "",
        "Open",
        "",
        "",
      ]);
    }
  }
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{ wch: 14 }, { wch: 58 }, { wch: 52 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 16 }, { wch: 30 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Due Diligence");
  fs.writeFileSync(outPath, XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
  return rows.length - 1;
}
