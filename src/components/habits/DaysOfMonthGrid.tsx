'use client';

interface DaysOfMonthGridProps {
  selected: number[]; // 1-31
  onChange: (days: number[]) => void;
}

export function DaysOfMonthGrid({ selected, onChange }: DaysOfMonthGridProps) {
  const toggleDay = (day: number) => {
    if (selected.includes(day)) {
      onChange(selected.filter(d => d !== day));
    } else {
      onChange([...selected, day].sort((a, b) => a - b));
    }
  };

  const toggleAll = () => {
    if (selected.length === 31) {
      onChange([]);
    } else {
      onChange(Array.from({ length: 31 }, (_, i) => i + 1));
    }
  };

  const days = Array.from({ length: 31 }, (_, i) => i + 1);

  return (
    <div className="space-y-2">
      {/* Grid of days */}
      <div className="grid grid-cols-7 gap-2">
        {days.map((day) => {
          const isSelected = selected.includes(day);
          return (
            <button
              key={day}
              type="button"
              onClick={() => toggleDay(day)}
              className={`
                h-12 rounded-xl font-albert font-semibold text-[18px] tracking-[-1px]
                transition-all duration-200
                ${isSelected
                  ? 'bg-[#a07855] text-white'
                  : 'bg-[#f3f1ef] text-text-primary hover:bg-[#e8e0d5]'
                }
              `}
            >
              {day}
            </button>
          );
        })}
        
        {/* Select All button (spans remaining space) */}
        <button
          type="button"
          onClick={toggleAll}
          className="col-span-3 h-12 rounded-xl font-albert font-semibold text-[18px] tracking-[-1px] bg-[#f3f1ef] text-text-primary hover:bg-[#e8e0d5] transition-all duration-200"
        >
          {selected.length === 31 ? 'Deselect all' : 'Select all'}
        </button>
      </div>
      
      {/* Helper text */}
      {selected.length > 0 && (
        <p className="font-sans text-[12px] text-text-secondary leading-[1.2] px-4">
          *Task needs to be done on {selected.join(', ')} {selected.length === 1 ? 'day' : 'days'} each month
        </p>
      )}
    </div>
  );
}















