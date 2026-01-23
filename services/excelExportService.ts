import { utils, write } from "xlsx-js-style";
import { supabase } from "../lib/supabaseClient";
import { Trainer, Kid, DayOfWeek } from "../types";

// --- CONFIGURATION: YOUR NEW COLORS ---
const COLORS: Record<string, string> = {
  NK: "00FFFF",
  MA: "9000FF",
  TH: "44BBC4",
  HH: "FF0000",
  YH: "FFFF00",
  JoDa: "4385EC",
  JaDa: "45821C",
  JuG: "00FF00",
  AF: "EEA2A2",
  AC: "FFA500",
  EM: "99C67C",

  DD: "E0E0E0",
  BREAK: "D9D9D9",
  OFFICE: "FFFFFF",
  HEADER_GREY: "D9D9D9",
  DATE_YELLOW: "FFFF00",
  TEXT_RED: "FF0000",
};

const DEFAULT_COLOR = "FFFFFF";

const TIME_SLOTS = [
  { label: "", start: "8:00", end: "9:00" },
  { label: "", start: "9:00", end: "10:00" },
  { label: "SOCIAL", start: "10:00", end: "11:00" },
  { label: "LUNCH", start: "11:00", end: "11:30" },
  { label: "CENTERS", start: "11:30", end: "12:00" },
  { label: "CIRCLE", start: "12:00", end: "12:30" },
  { label: "", start: "12:30", end: "1:00" },
  { label: "", start: "1:00", end: "1:30" },
  { label: "", start: "1:30", end: "2:00" },
  { label: "", start: "2:00", end: "3:00" },
  { label: "", start: "3:00", end: "4:00" },
  { label: "CLEAN UP", start: "4:00", end: "4:15" },
];

// --- HELPERS ---

// Returns minutes from midnight (e.g. 8:30 AM -> 510)
// ✅ FIXED: if AM/PM missing, treat 1-7 as PM (post-lunch)
const getMins = (timeStr: string): number => {
  if (!timeStr) return 0;

  const match = timeStr.toLowerCase().match(/(\d+):(\d+)\s*(am|pm)?/);
  if (!match) return 0;

  let h = parseInt(match[1]);
  let m = parseInt(match[2]);
  const meridian = match[3]; // "am" | "pm" | undefined

  // Normal AM/PM conversion
  if (meridian === "pm" && h !== 12) h += 12;
  if (meridian === "am" && h === 12) h = 0;

  // ✅ If AM/PM missing, assume afternoon for 1-7
  if (!meridian) {
    if (h >= 1 && h <= 7) h += 12;
  }

  return h * 60 + m;
};

const formatTimeFromMins = (mins: number) => {
  let h = Math.floor(mins / 60);
  const m = mins % 60;
  const period = h >= 12 ? "PM" : "AM";
  if (h > 12) h -= 12;
  if (h === 0) h = 12;
  return `${h}:${m.toString().padStart(2, "0")} ${period}`;
};

// ALWAYS extract start time from range safely
const getStartOnly = (timeSlot: string) => {
  if (!timeSlot) return "";
  if (timeSlot.includes(" - ")) return timeSlot.split(" - ")[0].trim();
  return timeSlot.trim();
};

// Odd timing = not exactly on hour
const isOddStartTime = (startTimeStr: string) => {
  const mins = getMins(startTimeStr);
  return mins % 60 !== 0;
};

const formatSessionText = (name: string, startOnly: string, duration: number, showTime: boolean) => {
  if (!name) return "";
  if (!showTime) return name;

  const startMins = getMins(startOnly);
  const endMins = startMins + duration;

  const startDisplay = formatTimeFromMins(startMins);
  const endDisplay = formatTimeFromMins(endMins);

  return `${name} ${startDisplay} - ${endDisplay}`;
};

const getCellColor = (text: string) => {
  if (!text) return DEFAULT_COLOR;
  const upper = text.toUpperCase();

  for (const [key, color] of Object.entries(COLORS)) {
    if (upper.includes(key.toUpperCase())) return color;
  }
  if (upper.includes("OFFICE")) return COLORS.OFFICE;

  return DEFAULT_COLOR;
};

const cell = (v: string, opts: any = {}) => ({
  v,
  t: "s",
  s: {
    font: { name: "Calibri", sz: 11, ...(opts.font || {}) },
    alignment: { vertical: "center", horizontal: "center", wrapText: true, ...(opts.align || {}) },
    border: {
      top: { style: "thin" },
      bottom: { style: "thin" },
      left: { style: "thin" },
      right: { style: "thin" },
    },
    fill: { fgColor: { rgb: opts.bg || "FFFFFF" } },
  },
});

const empty = () => ({ v: "", t: "s", s: {} });

// ✅ NEW: show OFF / PTO / SICK before shift timings
const getTrainerShiftDisplay = (trainer: Trainer, day: DayOfWeek) => {
  const status = String(trainer.status || "").toUpperCase();

  // Priority 1: Sick
  if (status === "SICK") return "SICK";

  // Priority 2: PTO
  if (status === "PTO") return "PTO";

  // Priority 3: Off (day shift says OFF/X)
  const rawShift = (trainer.shifts as any)?.[day] ?? "";
  const shiftUpper = String(rawShift).trim().toUpperCase();

  if (!rawShift || shiftUpper === "OFF" || shiftUpper === "X") return "OFF";

  // Priority 4: Normal shift
  return String(rawShift);
};

// --- MAIN EXPORT FUNCTION ---
export const generateClinicalExcel = async (
  _schedule: any[],
  trainers: Trainer[],
  kids: Kid[],
  weekDates: Record<string, string>
) => {
  console.log("📊 Exporting with New Colors...", weekDates);

  const dates = Object.values(weekDates).sort();
  if (dates.length === 0) {
    alert("No dates found to export.");
    return;
  }

  const { data: rawSchedule, error } = await supabase
    .from("schedule_items")
    .select("*")
    .gte("date_str", dates[0])
    .lte("date_str", dates[dates.length - 1]);

  if (error) {
    console.error("Supabase Export Error:", error);
    alert("Error fetching schedule data.");
    return;
  }

  const wb = utils.book_new();

  // NOTE: do NOT filter out sick anymore because we want to show "SICK"
  const staffForSheet = trainers;

  const DAYS = [DayOfWeek.MON, DayOfWeek.TUE, DayOfWeek.WED, DayOfWeek.THU, DayOfWeek.FRI];

  DAYS.forEach((day) => {
    const dateStr = weekDates[day];
    const wsData: any[][] = [];

    const clientHeader = [empty(), empty(), cell("Client", { font: { bold: true }, bg: COLORS.HEADER_GREY })];
    kids.forEach((k) => clientHeader.push(cell(k.name, { font: { bold: true } })));
    wsData.push(clientHeader);

    const scheduleRow = [empty(), empty(), cell("Schedule", { font: { bold: true } })];
    kids.forEach(() => scheduleRow.push(cell("In-home")));
    wsData.push(scheduleRow);

    const insuranceRow = [empty(), empty(), cell("Insurance", { font: { bold: true } })];
    kids.forEach(() => insuranceRow.push(cell("BCBS")));
    wsData.push(insuranceRow);

    const superRow = [empty(), empty(), cell("Supervision Hours", { font: { bold: true } })];
    kids.forEach(() => superRow.push(cell("8 (32 units)")));
    wsData.push(superRow);
    wsData.push([]);

    // --- STAFF HEADER ---
    const staffRow = [
      empty(),
      cell("NOTES", { font: { bold: true } }),
      cell("DATE", { font: { bold: true }, bg: COLORS.DATE_YELLOW }),
      ...staffForSheet.map((t) => cell(t.name, { font: { bold: true }, bg: COLORS.HEADER_GREY })),
    ];
    wsData.push(staffRow);

    const dateRow = [
      empty(),
      cell("All clients have middles together"),
      cell(dateStr, { bg: COLORS.DATE_YELLOW }),
      ...staffForSheet.map((t) => cell(getTrainerShiftDisplay(t, day))),
    ];
    wsData.push(dateRow);

    // --- GRID ---
    TIME_SLOTS.forEach((slot) => {
      const row: any[] = [empty()];
      row.push(cell(slot.label, { font: { bold: true } }));
      row.push(cell(`${slot.start}-${slot.end}`, { font: { bold: true } }));

      const slotStartMins = getMins(slot.start);
      const slotEndMins = getMins(slot.end);

      staffForSheet.forEach((staff) => {
        const item = rawSchedule?.find((s: any) => {
          if (s.date_str !== dateStr || s.trainer_id !== staff.id) return false;

          const startOnly = getStartOnly(s.time_slot || "");
          const sessionStart = getMins(startOnly);
          const sessionEnd = sessionStart + (s.duration_mins || 60);

          return sessionStart < slotEndMins && sessionEnd > slotStartMins;
        });

        if (item) {
          const type = String(item.session_type || "").toLowerCase();
          let text = "";

          if (type === "break") text = "BREAK";
          else if (type === "office") text = "OFFICE WORK";
          else if (type === "social") text = "SOCIAL";
          else {
            const startOnly = getStartOnly(item.time_slot || "");
            const showTime = isOddStartTime(startOnly);

            text = formatSessionText(item.kid_name || "", startOnly, item.duration_mins || 60, showTime);
          }

          row.push(cell(text, { bg: getCellColor(text) }));
        } else {
          row.push(cell(""));
        }
      });

      wsData.push(row);
    });

    const ws = utils.aoa_to_sheet([]);
    wsData.forEach((row, r) => {
      row.forEach((c, colIndex) => {
        const ref = utils.encode_cell({ r, c: colIndex });
        ws[ref] = c;
      });
    });

    ws["!ref"] = utils.encode_range({ s: { r: 0, c: 0 }, e: { r: wsData.length, c: 20 } });
    ws["!cols"] = [{ wch: 2 }, { wch: 20 }, { wch: 18 }, ...staffForSheet.map(() => ({ wch: 24 }))];
    utils.book_append_sheet(wb, ws, String(day));
  });

  const fileName = `Clinical_Scheduler_${dates[0]}.xlsx`;
  const wbout = write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([wbout], { type: "application/octet-stream" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  document.body.appendChild(a);
  a.href = url;
  a.download = fileName;
  a.click();
  window.URL.revokeObjectURL(url);
};
