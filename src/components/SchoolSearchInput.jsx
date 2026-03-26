import React, { useEffect, useMemo, useState } from 'react';
import { Check, Search, X } from 'lucide-react';
import { normalizeSchoolInput } from '../data/schools';

export default function SchoolSearchInput({
  value,
  onChange,
  schools,
  placeholder = 'Search school or college',
  required = false,
  id = 'school-search',
  helperText = '',
  wrapperClassName = '',
}) {
  const [inputValue, setInputValue] = useState(value || '');
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setInputValue(value || '');
  }, [value]);

  const filteredSchools = useMemo(() => {
    const normalizedQuery = normalizeSchoolInput(inputValue).toLowerCase();
    if (!normalizedQuery) return schools.slice(0, 10);

    const queryParts = normalizedQuery.split(' ').filter(Boolean);

    const scoreSchool = (schoolName) => {
      const normalizedSchool = schoolName.toLowerCase();
      if (normalizedSchool === normalizedQuery) return 1000;
      if (normalizedSchool.startsWith(normalizedQuery)) return 800;
      if (normalizedSchool.includes(` ${normalizedQuery}`)) return 700;

      let score = 0;
      queryParts.forEach((part) => {
        if (normalizedSchool.startsWith(part)) {
          score += 160;
        } else if (normalizedSchool.includes(` ${part}`)) {
          score += 120;
        } else if (normalizedSchool.includes(part)) {
          score += 70;
        }
      });

      return score;
    };

    return schools
      .map((school) => ({ school, score: scoreSchool(school) }))
      .filter((entry) => entry.score > 0)
      .sort((left, right) => right.score - left.score || left.school.localeCompare(right.school))
      .slice(0, 14)
      .map((entry) => entry.school);
  }, [inputValue, schools]);

  const pickSchool = (schoolName) => {
    setInputValue(schoolName);
    onChange(schoolName);
    setIsOpen(false);
  };

  const clearSelection = () => {
    setInputValue('');
    onChange('');
    setIsOpen(false);
  };

  return (
    <div className={`relative ${wrapperClassName}`}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-cyan-100/62" />
        <input
          id={id}
          name={id}
          type="text"
          required={required}
          autoComplete="off"
          placeholder={placeholder}
          className="lux-input py-3 pl-12 pr-10 text-sm font-medium"
          value={inputValue}
          onFocus={() => setIsOpen(true)}
          onChange={(event) => {
            const nextValue = event.target.value;
            setInputValue(nextValue);
            onChange(nextValue);
            setIsOpen(true);
          }}
          onBlur={() => {
            window.setTimeout(() => {
              setIsOpen(false);
              onChange(normalizeSchoolInput(inputValue));
            }, 120);
          }}
        />
        {inputValue && (
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={clearSelection}
            className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-cyan-50/72 transition hover:bg-cyan-300/10 hover:text-white"
            aria-label="Clear institution"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {isOpen && (
        <div className="lux-panel lux-scroll absolute z-30 mt-2 max-h-56 w-full overflow-y-auto rounded-xl p-1.5">
          {filteredSchools.length === 0 ? (
            <p className="px-3 py-2 text-xs text-cyan-50/65">No exact match. You can still type your school or college name manually.</p>
          ) : (
            filteredSchools.map((schoolName) => (
              <button
                key={schoolName}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => pickSchool(schoolName)}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm text-cyan-50/86 transition hover:bg-cyan-300/12 hover:text-white"
              >
                <span className="pr-3">{schoolName}</span>
                {normalizeSchoolInput(value) === schoolName && <Check className="h-4 w-4 text-cyan-200" />}
              </button>
            ))
          )}
        </div>
      )}

      {helperText && <p className="mt-2 text-xs text-cyan-50/65">{helperText}</p>}
    </div>
  );
}
