import React, { useEffect, useMemo, useState } from 'react';
import { Check, Search, X } from 'lucide-react';
import { normalizeSchoolInput } from '../data/schools';

export default function SchoolSearchInput({
  value,
  onChange,
  schools,
  placeholder = 'Search school',
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
    if (!normalizedQuery) return schools.slice(0, 12);
    return schools
      .filter((school) => school.toLowerCase().includes(normalizedQuery))
      .slice(0, 14);
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
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-amber-100/65" />
        <input
          id={id}
          type="text"
          required={required}
          autoComplete="off"
          placeholder={placeholder}
          className="w-full rounded-xl border border-amber-200/20 bg-[#171106] py-3 pl-10 pr-10 text-sm font-medium text-amber-50 outline-none placeholder:text-amber-100/35 focus:border-amber-200/45"
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
            className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-amber-100/75 transition hover:bg-amber-100/10 hover:text-amber-50"
            aria-label="Clear school"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {isOpen && (
        <div className="absolute z-30 mt-2 max-h-56 w-full overflow-y-auto rounded-xl border border-amber-200/30 bg-[#110d06]/96 p-1.5 shadow-[0_20px_50px_-30px_rgba(0,0,0,0.95)] backdrop-blur-md">
          {filteredSchools.length === 0 ? (
            <p className="px-3 py-2 text-xs text-amber-100/65">No exact match. You can still type your school name manually.</p>
          ) : (
            filteredSchools.map((schoolName) => (
              <button
                key={schoolName}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => pickSchool(schoolName)}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm text-amber-100/88 transition hover:bg-amber-100/10 hover:text-amber-50"
              >
                <span className="pr-3">{schoolName}</span>
                {normalizeSchoolInput(value) === schoolName && <Check className="h-4 w-4 text-amber-300" />}
              </button>
            ))
          )}
        </div>
      )}

      {helperText && <p className="mt-2 text-xs text-amber-100/65">{helperText}</p>}
    </div>
  );
}
