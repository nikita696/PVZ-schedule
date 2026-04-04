import { useApp, ShiftStatus } from '../context/AppContext';
import { MonthYearSelector } from '../components/MonthYearSelector';
import { ShiftStatusSelector } from '../components/ShiftStatusSelector';
import { AlertTriangle } from 'lucide-react';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function Calendar() {
  const { employees, shifts, selectedMonth, selectedYear, updateShift } = useApp();

  // Get number of days in selected month
  const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
  
  // Get first day of month (0 = Sunday, 1 = Monday, etc.)
  const firstDayOfMonth = new Date(selectedYear, selectedMonth - 1, 1).getDay();
  
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const getShiftStatus = (employeeId: string, day: number): ShiftStatus => {
    const date = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const shift = shifts.find((s) => s.employeeId === employeeId && s.date === date);
    return shift?.status || 'none';
  };

  const handleStatusChange = (employeeId: string, day: number, status: ShiftStatus) => {
    const date = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    updateShift(employeeId, date, status);
  };

  const getWeekday = (day: number) => {
    const date = new Date(selectedYear, selectedMonth - 1, day);
    const dayIndex = date.getDay();
    // Convert Sunday (0) to index 6, and shift others back by 1
    const adjustedIndex = dayIndex === 0 ? 6 : dayIndex - 1;
    return WEEKDAYS[adjustedIndex];
  };

  const getWorkingCount = (day: number) => {
    let count = 0;
    employees.forEach((emp) => {
      const status = getShiftStatus(emp.id, day);
      if (status === 'working') count++;
    });
    return count;
  };

  return (
    <div className="min-h-screen bg-neutral-50 pb-20">
      <div className="bg-white border-b border-neutral-200">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <h1 className="text-xl font-semibold text-neutral-900 mb-3">
            Shift Calendar
          </h1>
          <MonthYearSelector />
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-4">
        <div className="bg-white rounded-lg border border-neutral-200 overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-[60px_50px_1fr_1fr_50px] gap-2 p-3 bg-neutral-100 border-b border-neutral-200 text-xs font-semibold text-neutral-700">
            <div>Day</div>
            <div>Week</div>
            {employees.map((emp) => (
              <div key={emp.id}>{emp.name}</div>
            ))}
            <div>Total</div>
          </div>

          {/* Rows */}
          <div className="divide-y divide-neutral-200">
            {days.map((day) => {
              const weekday = getWeekday(day);
              const workingCount = getWorkingCount(day);
              const isWeekend = weekday === 'Sat' || weekday === 'Sun';
              const hasIssue = workingCount === 0 || workingCount > 1;

              return (
                <div
                  key={day}
                  className={`grid grid-cols-[60px_50px_1fr_1fr_50px] gap-2 p-3 ${
                    isWeekend ? 'bg-neutral-50' : ''
                  }`}
                >
                  <div className="flex items-center">
                    <span className="font-semibold text-neutral-900">{day}</span>
                  </div>
                  <div className="flex items-center">
                    <span className={`text-xs ${isWeekend ? 'text-neutral-500' : 'text-neutral-600'}`}>
                      {weekday}
                    </span>
                  </div>
                  {employees.map((emp) => {
                    const status = getShiftStatus(emp.id, day);
                    return (
                      <div key={emp.id} className="flex items-center">
                        <ShiftStatusSelector
                          value={status}
                          onChange={(newStatus) => handleStatusChange(emp.id, day, newStatus)}
                        />
                      </div>
                    );
                  })}
                  <div className="flex items-center justify-center">
                    {hasIssue ? (
                      <div className="flex items-center gap-1">
                        <AlertTriangle className="w-4 h-4 text-orange-600" />
                        <span className="text-xs font-medium text-orange-600">{workingCount}</span>
                      </div>
                    ) : (
                      <span className="text-xs font-medium text-green-600">{workingCount}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-xs text-blue-900">
            <strong>Tip:</strong> Each day should have exactly 1 person working. 
            Orange warning shows days with 0 or 2+ workers assigned.
          </p>
        </div>
      </div>
    </div>
  );
}
