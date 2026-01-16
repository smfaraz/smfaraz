import { utils, write } from 'xlsx-js-style';
import { supabase } from '../lib/supabaseClient';
import { Trainer, Kid, DayOfWeek } from '../types';

// --- COLORS ---
const CLIENT_COLORS: Record<string, string> = {
  "NK": "FF99CC", "MA": "99CCFF", "TH": "FFFF99", "HH": "CC99FF",
  "YH": "FFCC99", "JoDa": "CCFFCC", "JaDa": "FFFFCC", "JuG": "FFCCCC",
  "DD": "E0E0E0", "BREAK": "D9D9D9", "OFFICE WORK": "FFFFFF",
};
const DEFAULT_COLOR = "FFFFFF";

// --- ROWS DEFINITION ---
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
  { label: "CLEAN UP", start: "4:00", end: "4:15" }
];

// --- LOGIC: HOUR MATCHING ---

// Convert "08:45 AM" -> 8 (integer hour 0-23)
const getHour = (timeStr: string): number => {
  if (!timeStr) return -1;
  // Regex to capture Hour, Minute, AM/PM
  const match = timeStr.toLowerCase().match(/(\d+):(\d+)\s*(am|pm)?/);
  if (!match) return -1;

  let h = parseInt(match[1]);
  const amp = match[3];

  // 12PM is 12, 1PM is 13, 8AM is 8
  if (amp === 'pm' && h !== 12) h += 12;
  if (amp === 'am' && h === 12) h = 0;

  return h;
};

// Convert "08:45 AM" -> Minutes (for calculating end time text)
const getMins = (timeStr: string): number => {
  if (!timeStr) return 0;
  const match = timeStr.toLowerCase().match(/(\d+):(\d+)\s*(am|pm)?/);
  if (!match) return 0;
  let h = parseInt(match[1]);
  let m = parseInt(match[2]);
  const amp = match[3];
  if (amp === 'pm' && h !== 12) h += 12;
  if (amp === 'am' && h === 12) h = 0;
  return h * 60 + m;
};

// Create Text: "NK 8:45 - 10:45"
const formatSessionText = (name: string, startStr: string, duration: number) => {
  const startMins = getMins(startStr);
  const endMins = startMins + duration;
  
  // Format End Time
  let endH = Math.floor(endMins / 60);
  const endM = endMins % 60;
  const endP = endH >= 12 ? 'PM' : 'AM';
  if (endH > 12) endH -= 12;
  if (endH === 0) endH = 12;
  
  const endStr = `${endH}:${endM.toString().padStart(2,'0')} ${endP}`;
  const cleanStart = startStr.replace(/^0/, ''); // Remove leading zero
  
  return `${name} ${cleanStart} - ${endStr}`;
};

// --- STYLING HELPERS ---
const getCellColor = (text: string) => {
  if (!text) return DEFAULT_COLOR;
  const upper = text.toUpperCase();
  for (const [key, color] of Object.entries(CLIENT_COLORS)) {
    if (upper.includes(key)) return color;
  }
  if (upper.includes("BREAK")) return CLIENT_COLORS["BREAK"];
  if (upper.includes("OFFICE")) return CLIENT_COLORS["OFFICE WORK"];
  return DEFAULT_COLOR;
};

const createCell = (value: string, styles: any = {}) => ({
  v: value, t: 's', 
  s: { 
    font: { name: "Calibri", sz: 11, ...styles.font }, 
    alignment: { vertical: "center", horizontal: "center", wrapText: true, ...styles.alignment }, 
    border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } }, 
    fill: styles.fill || { fgColor: { rgb: "FFFFFF" } }, 
    ...styles 
  }
});
const empty = () => ({ v: "", t: "s", s: {} });

// --- MAIN EXPORT ---
export const generateClinicalExcel = async (
  trainers: Trainer[], 
  kids: Kid[], 
  weekDates: Record<string, string>
) => {
  // 1. Fetch Data Directly (Safe & Sure)
  const dates = Object.values(weekDates).sort();
  const { data: rawSchedule, error } = await supabase
    .from('schedule_items')
    .select('*')
    .gte('date_str', dates[0])
    .lte('date_str', dates[dates.length-1]);

  if (error || !rawSchedule) {
    alert("Database Error: Could not export.");
    return;
  }

  const wb = utils.book_new();
  const activeTrainers = trainers.filter(t => t.status !== 'Sick');
  const DAYS = [DayOfWeek.MON, DayOfWeek.TUE, DayOfWeek.WED, DayOfWeek.THU, DayOfWeek.FRI];

  DAYS.forEach(day => {
    const dateStr = weekDates[day];
    const wsData: any[][] = [];

    // --- HEADERS (Matching Legacy File) ---
    wsData.push([empty(), createCell("Sessions max 120 mins...", { font: { italic: true, color: { rgb: "FF0000" } }, alignment: { horizontal: "left" } })]);
    wsData.push([empty(), createCell("Min 3 sessions per day...", { font: { italic: true }, alignment: { horizontal: "left" } })]);
    wsData.push([]); 

    // Client Summary
    wsData.push([empty(), empty(), createCell("Client", { font: { bold: true }, fill: { fgColor: { rgb: "D9D9D9" } } }), ...kids.map(k => createCell(k.name, { font: { bold: true } }))]);
    wsData.push([]); 

    // Staff Header
    wsData.push([empty(), createCell("NOTES", { font: { bold: true } }), createCell("DATE", { font: { bold: true }, fill: { fgColor: { rgb: "FFFF00" } } }), ...activeTrainers.map(t => createCell(t.name, { font: { bold: true }, fill: { fgColor: { rgb: "D9D9D9" } } }))]);

    // Date Header
    wsData.push([empty(), createCell("All clients have middles together"), createCell(dateStr, { fill: { fgColor: { rgb: "FFFF00" } } }), ...activeTrainers.map(t => createCell(t.shifts?.[day] || "8:00 - 4:00"))]);

    // --- GRID ---
    TIME_SLOTS.forEach(slot => {
      const rowCells = [empty()];
      rowCells.push(createCell(slot.label, { font: { bold: true } }));
      rowCells.push(createCell(`${slot.start}-${slot.end}`, { font: { bold: true } }));

      // LOGIC: MATCH THE HOUR
      // "8:00" -> Hour 8
      // "11:30" -> Hour 11 (Wait, for 11:30 slot, we want 11:xx times to match here too?)
      // Actually, for split hours (11:00 and 11:30), simple hour matching puts EVERYTHING in 11:00.
      // So we use a smart check: 
      // If the slot starts at :30, we check if the session minute is >= 30.
      
      const slotH = getHour(slot.start);
      const slotM = parseInt(slot.start.split(':')[1]); // 0 or 30

      activeTrainers.forEach(staff => {
        // Find Item
        const item = rawSchedule.find((s: any) => {
          if (s.date_str !== dateStr) return false;
          if (s.trainer_id !== staff.id) return false;

          const sessionH = getHour(s.time_slot);
          const sessionM = parseInt(s.time_slot.split(':')[1]);

          // PRIMARY LOGIC: Match the Hour
          if (sessionH !== slotH) return false;

          // SECONDARY LOGIC: Handle 11:00 vs 11:30 rows
          // If slot starts at 00, take sessions 00-29
          // If slot starts at 30, take sessions 30-59
          if (slotM === 30) return sessionM >= 30;
          if (slotM === 0) {
             // Does this hour have a :30 slot later? (11, 12, 1 do)
             const hasHalf = ["11", "12", "1", "01"].includes(slotH.toString()) || slotH === 11 || slotH === 12 || slotH === 13 || slotH === 1;
             if (hasHalf) return sessionM < 30; // Only take first half
             return true; // Take whole hour (8, 9, 10...)
          }
          return true;
        });

        let val = "";
        let color = DEFAULT_COLOR;

        if (item) {
          const type = item.session_type;
          const name = item.kid_name || "";
          
          if (type === 'Break') val = "BREAK";
          else if (type === 'Office') val = "OFFICE WORK";
          else if (type === 'Social') val = "SOCIAL";
          else {
             // "NK 8:45 - 10:45"
             val = formatSessionText(name, item.time_slot, item.duration_mins);
          }
          color = getCellColor(val);
        }
        rowCells.push(createCell(val, { fill: { fgColor: { rgb: color } } }));
      });
      wsData.push(rowCells);
    });

    const ws = utils.aoa_to_sheet([]);
    wsData.forEach((row, r) => row.forEach((cell, c) => ws[utils.encode_cell({ r, c })] = cell));
    ws['!ref'] = utils.encode_range({ s: {r:0, c:0}, e: {r:wsData.length, c:wsData[5]?.length || 20} });
    ws['!cols'] = [{ wch: 2 }, { wch: 15 }, { wch: 15 }, ...activeTrainers.map(() => ({ wch: 24 }))];
    utils.book_append_sheet(wb, ws, day);
  });

  const fileName = `Clinical_Scheduler_${dates[0]}.xlsx`;
  const wbout = write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], { type: "application/octet-stream" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  document.body.appendChild(a);
  a.href = url;
  a.download = fileName;
  a.click();
  window.URL.revokeObjectURL(url);
};