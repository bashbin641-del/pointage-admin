import type { DashboardSummary } from "@/lib/dashboard-types";

const frenchDate = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "Africa/Abidjan",
});

const shortDate = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "2-digit",
  timeZone: "Africa/Abidjan",
});

function dateValue(value: string) {
  return new Date(`${value}T12:00:00.000Z`);
}

export async function downloadDashboardReport(summary: DashboardSummary) {
  const { jsPDF } = await import("jspdf");
  const document = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const days = summary.attendanceTraffic.days;
  const entries = days.reduce((total, day) => total + day.entries, 0);
  const exits = days.reduce((total, day) => total + day.exits, 0);
  const total = entries + exits;
  const peak = days.reduce((current, day) => day.total > current.total ? day : current, days[0] ?? { date: summary.period, entries: 0, exits: 0, total: 0 });

  document.setProperties({
    title: "Rapport d'activité de pointage INOX",
    subject: "Trafic réel des pointages sur 7 jours",
    author: "INOX Technologies",
    creator: "INOX Présence",
  });
  document.setFillColor(21, 27, 41);
  document.rect(0, 0, 297, 28, "F");
  document.setTextColor(255, 255, 255);
  document.setFont("helvetica", "bold");
  document.setFontSize(17);
  document.text("INOX PRÉSENCE", 16, 12);
  document.setFontSize(10);
  document.setFont("helvetica", "normal");
  document.text("Rapport d'activité de pointage", 16, 20);
  document.setTextColor(255, 188, 120);
  document.text(`Données réelles du ${frenchDate.format(dateValue(summary.attendanceTraffic.startDate))} au ${frenchDate.format(dateValue(summary.attendanceTraffic.endDate))}`, 281, 16, { align: "right" });

  const cards = [
    ["Pointages", String(total)],
    ["Entrées", String(entries)],
    ["Sorties", String(exits)],
    ["Moyenne / jour", (total / Math.max(days.length, 1)).toLocaleString("fr-FR", { maximumFractionDigits: 1 })],
    ["Pic d'activité", `${peak.total} - ${shortDate.format(dateValue(peak.date))}`],
  ];
  cards.forEach(([label, value], index) => {
    const x = 16 + index * 53.4;
    document.setFillColor(247, 249, 252);
    document.setDrawColor(220, 226, 234);
    document.roundedRect(x, 35, 49, 21, 2, 2, "FD");
    document.setTextColor(71, 85, 105);
    document.setFont("helvetica", "normal");
    document.setFontSize(8);
    document.text(label, x + 4, 42);
    document.setTextColor(21, 27, 41);
    document.setFont("helvetica", "bold");
    document.setFontSize(13);
    document.text(value, x + 4, 51);
  });

  document.setTextColor(21, 27, 41);
  document.setFont("helvetica", "bold");
  document.setFontSize(12);
  document.text("Trafic quotidien", 16, 68);
  document.setFont("helvetica", "normal");
  document.setFontSize(8);
  document.setTextColor(71, 85, 105);
  document.text("Chaque valeur provient des pointages confirmés enregistrés en production.", 16, 73);

  const chart = { x: 22, y: 80, width: 259, height: 62 };
  const maxValue = Math.max(1, ...days.flatMap((day) => [day.entries, day.exits]));
  const step = Math.max(1, Math.ceil(maxValue / 4));
  const chartMax = step * 4;
  for (let grid = 0; grid <= 4; grid += 1) {
    const y = chart.y + chart.height - (grid / 4) * chart.height;
    document.setDrawColor(226, 232, 240);
    document.line(chart.x, y, chart.x + chart.width, y);
    document.setTextColor(100, 116, 139);
    document.setFontSize(7);
    document.text(String(step * grid), chart.x - 3, y + 1.5, { align: "right" });
  }
  const slot = chart.width / Math.max(days.length, 1);
  days.forEach((day, index) => {
    const center = chart.x + slot * index + slot / 2;
    const entryHeight = (day.entries / chartMax) * chart.height;
    const exitHeight = (day.exits / chartMax) * chart.height;
    if (day.entries > 0) {
      document.setFillColor(8, 105, 158);
      document.roundedRect(center - 6.5, chart.y + chart.height - entryHeight, 5, entryHeight, 0.8, 0.8, "F");
    }
    if (day.exits > 0) {
      document.setFillColor(255, 188, 120);
      document.roundedRect(center + 1.5, chart.y + chart.height - exitHeight, 5, exitHeight, 0.8, 0.8, "F");
    }
    document.setTextColor(21, 27, 41);
    document.setFontSize(7);
    if (day.entries > 0) document.text(String(day.entries), center - 4, chart.y + chart.height - entryHeight - 2, { align: "center" });
    if (day.exits > 0) document.text(String(day.exits), center + 4, chart.y + chart.height - exitHeight - 2, { align: "center" });
    document.setTextColor(71, 85, 105);
    document.text(shortDate.format(dateValue(day.date)), center, chart.y + chart.height + 6, { align: "center" });
  });

  document.setFillColor(8, 105, 158);
  document.rect(229, 64, 4, 4, "F");
  document.setTextColor(71, 85, 105);
  document.text("Entrées", 235, 67.2);
  document.setFillColor(255, 188, 120);
  document.rect(253, 64, 4, 4, "F");
  document.text("Sorties", 259, 67.2);

  const tableY = 155;
  const columnWidth = 259 / Math.max(days.length, 1);
  days.forEach((day, index) => {
    const x = 22 + index * columnWidth;
    const shade = index % 2 === 0 ? 247 : 255;
    document.setFillColor(shade, index % 2 === 0 ? 249 : 255, index % 2 === 0 ? 252 : 255);
    document.rect(x, tableY, columnWidth, 27, "F");
    document.setTextColor(71, 85, 105);
    document.setFontSize(7);
    document.text(shortDate.format(dateValue(day.date)), x + columnWidth / 2, tableY + 6, { align: "center" });
    document.setTextColor(21, 27, 41);
    document.setFont("helvetica", "bold");
    document.setFontSize(10);
    document.text(`${day.total}`, x + columnWidth / 2, tableY + 14, { align: "center" });
    document.setFont("helvetica", "normal");
    document.setFontSize(7);
    document.setTextColor(71, 85, 105);
    document.text(`${day.entries} entrée${day.entries > 1 ? "s" : ""} / ${day.exits} sortie${day.exits > 1 ? "s" : ""}`, x + columnWidth / 2, tableY + 21, { align: "center" });
  });

  document.setDrawColor(220, 226, 234);
  document.line(16, 194, 281, 194);
  document.setTextColor(100, 116, 139);
  document.setFontSize(7);
  document.text(`Généré le ${new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeStyle: "short", timeZone: "Africa/Abidjan" }).format(new Date(summary.generatedAt))} - Fuseau Africa/Abidjan`, 16, 201);
  document.text("INOX Présence - Rapport réservé à l'administration", 281, 201, { align: "right" });
  document.save(`inox-presence-trafic-${summary.attendanceTraffic.startDate}-${summary.attendanceTraffic.endDate}.pdf`);
}
