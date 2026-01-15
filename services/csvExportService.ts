import { ScheduleItem, Trainer, DayOfWeek, SessionType } from '../types';

// The client's rigid time structure
const LEGACY_TIME_ROWS = [
  { label: 'All clients have middles together', time: '8:00-9:00',  startHour: 8,  startMin: 0 },
  { label: '',                                  time: '9:00-10:00', startHour: 9,  startMin: 0 },
  { label: '',                                  time: '10:00-11:00',startHour: 10, startMin: 0 },
  { label: 'SOCIAL',                            time: '11:00-11:30',startHour: 11, startMin: 0 },
  { label: 'LUNCH',                             time: '11:30-12:00',startHour: 11, startMin: 30 },
  { label: 'CENTERS',                           time: '12:00-12:30',startHour: 12, startMin: 0 },
  { label: 'CIRCLE',                            time: '12:30-1:00', startHour: 12, startMin: 30 },
  { label: '',                                  time: '1:00-1:30',  startHour: 13, startMin: 0 },
  { label: '',                                  time: '1:30-2:00',  startHour: 13, startMin: 30 },
  { label: '',                                  time: '2:00-3:00',  startHour: 14, startMin: 0 },
  { label: '',                                  time: '3:00-4:00',  startHour: 15, startMin: 0 },
];

const parseTime = (timeStr: string) => {
  const [time, period] = timeStr.split(' ');
  let [hours, mins] = time.split(':').map(Number);
  if (period === 'PM' && hours !== 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;
  return { hours, mins };
};

export const generateLegacyCSV = (schedule: ScheduleItem[], trainers: Trainer[]): string => {
  let csvContent = ''; // Removed STATIC_HEADER

  // Sort trainers to maintain column order (Directors/BCBAs first, then RBTs if needed)
  const sortedTrainers = [...trainers].sort((a, b) => a.name.localeCompare(b.name));
  
  // We need to generate a block for each Day of the Week
  Object.values(DayOfWeek).forEach((day, index) => {
    // 1. FILTER: Get items for this day
    const daysItems = schedule.filter(s => s.day === day);
    
    // 2. HEADER ROWS
    // Row 1: "NOTES, DATE, [Staff Names...]"
    const staffNames = sortedTrainers.map(t => `"${t.name} (${t.clinicalRole})"`);
    csvContent += `NOTES,DATE,${staffNames.join(',')}\n`;

    // Row 2: Date Placeholder (Mocking a date for now based on index)
    const mockDate = new Date();
    mockDate.setDate(mockDate.getDate() + index);
    const dateStr = mockDate.toLocaleDateString();
    const dayStr = day.substring(0, 3); // "Mon", "Tue"
    const dateRow = sortedTrainers.map(() => `${dayStr} ${mockDate.getMonth() + 1}/${mockDate.getDate()}`);
    csvContent += `,${dateStr} ${dateStr},${dateRow.join(',')}\n`;

    // Row 3: Shifts " , , 8:15-4:15, ..."
    const shifts = sortedTrainers.map(t => {
        if (t.status !== 'Active') return 'PTO - OFF';
        return t.shifts ? (t.shifts[day] || 'OFF') : 'OFF'; 
    });
    csvContent += `,,${shifts.join(',')}\n`;

    // 3. DATA ROWS (The Grid)
    LEGACY_TIME_ROWS.forEach(rowDef => {
      const cells = sortedTrainers.map(trainer => {
        // Find a schedule item that overlaps this row's start time for this trainer
        const item = daysItems.find(i => {
          if (i.trainerId !== trainer.id) return false;
          
          // Time matching logic
          const { hours, mins } = parseTime(i.timeSlot);
          
          // Exact match or within range? 
          // For this legacy format, we look for items starting at or covering this slot.
          // Simple exact match on start time for V1:
          return hours === rowDef.startHour && mins === rowDef.startMin;
        });

        if (!item) return '';

        // Format content based on Type
        if (item.sessionType === SessionType.OFFICE) return 'OFFICE WORK';
        if (item.sessionType === SessionType.BREAK) return 'BREAK';
        
        // Return Kid Full Name
        return item.kidName;
      });

      csvContent += `${rowDef.label},${rowDef.time},${cells.join(',')}\n`;
    });

    // Add spacing between days
    csvContent += ',,,,,,,,,,,,,,,,,,\n';
  });

  return csvContent;
};

export const downloadCSV = (content: string, filename: string) => {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};