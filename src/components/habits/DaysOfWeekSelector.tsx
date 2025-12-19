'use client';

interface DaysOfWeekSelectorProps {
  selected: number[]; // 0-6 (Mon-Sun)
  onChange: (days: number[]) => void;
}

const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const DAY_LABELS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export function DaysOfWeekSelector({ selected, onChange }: DaysOfWeekSelectorProps) {
  const toggleDay = (dayIndex: number) => {
    if (selected.includes(dayIndex)) {
      onChange(selected.filter(d => d !== dayIndex));
    } else {
      onChange([...selected, dayIndex].sort());
    }
  };

  return (
    <div className="flex gap-2 w-full">
      {DAYS.map((day, index) => {
        const isSelected = selected.includes(index);
        return (
          <button
            key={index}
            type="button"
            onClick={() => toggleDay(index)}
            className={`
              flex-1 h-12 rounded-xl font-albert font-semibold text-[18px] tracking-[-1px]
              transition-all duration-200
              ${isSelected
                ? 'bg-[#a07855] text-white'
                : 'bg-[#f3f1ef] text-text-primary hover:bg-[#e8e0d5]'
              }
            `}
            aria-label={DAY_LABELS[index]}
          >
            {day}
          </button>
        );
      })}
    </div>
  );
}















