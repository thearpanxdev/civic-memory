import React, { useState, useRef, useEffect, useId } from 'react';
import { ChevronDown, Search, X, Check, Loader2 } from 'lucide-react';

/**
 * CivicMemory Accessible Searchable Select / Combobox Component
 * Supports filtered search, keyboard navigation, clear button, custom value entry,
 * and standard ARIA compliance.
 */
export default function SearchableSelect({
  id,
  label,
  ariaLabel,
  required = false,
  options = [],
  value = '',
  onChange,
  placeholder = 'Select an option...',
  disabled = false,
  error = '',
  helperText = '',
  allowCustom = false,
  customPlaceholder = 'Enter custom value...',
  loading = false,
  emptyMessage = 'No options found',
  className = '',
}) {
  const generatedId = useId();
  const selectId = id || generatedId;
  const listboxId = `${selectId}-listbox`;

  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [customValue, setCustomValue] = useState('');

  const containerRef = useRef(null);
  const searchInputRef = useRef(null);
  const customInputRef = useRef(null);
  const listRef = useRef(null);

  // Filter options based on search query
  const filteredOptions = options.filter((opt) =>
    opt.toLowerCase().includes(searchQuery.trim().toLowerCase())
  );

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchQuery('');
        setHighlightedIndex(-1);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Focus search input when opened
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (isOpen && listRef.current && highlightedIndex >= 0) {
      const items = listRef.current.querySelectorAll('[role="option"]');
      if (items[highlightedIndex] && typeof items[highlightedIndex].scrollIntoView === 'function') {
        items[highlightedIndex].scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex, isOpen]);

  const handleSelect = (selectedOption) => {
    onChange(selectedOption);
    setIsOpen(false);
    setSearchQuery('');
    setHighlightedIndex(-1);
    setIsCustomMode(false);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange('');
    setSearchQuery('');
    setCustomValue('');
    setIsCustomMode(false);
  };

  const handleKeyDown = (e) => {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    const totalItems = filteredOptions.length + (allowCustom ? 1 : 0);

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev < totalItems - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : totalItems - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
        handleSelect(filteredOptions[highlightedIndex]);
      } else if (allowCustom && highlightedIndex === filteredOptions.length) {
        setIsCustomMode(true);
        setIsOpen(false);
      } else if (searchQuery.trim() && allowCustom) {
        handleSelect(searchQuery.trim());
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      setSearchQuery('');
      setHighlightedIndex(-1);
    }
  };

  const handleCustomSubmit = (e) => {
    e.preventDefault();
    if (customValue.trim()) {
      onChange(customValue.trim());
      setIsCustomMode(false);
    }
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && (
        <label
          htmlFor={selectId}
          className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1"
        >
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
      )}

      {isCustomMode ? (
        <div className="flex items-center space-x-2">
          <input
            ref={customInputRef}
            type="text"
            id={selectId}
            value={customValue}
            onChange={(e) => setCustomValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleCustomSubmit(e);
              } else if (e.key === 'Escape') {
                setIsCustomMode(false);
              }
            }}
            placeholder={customPlaceholder}
            className="block w-full px-3 py-2 text-sm border border-civic-500 rounded-lg focus:ring-2 focus:ring-civic-500 focus:border-civic-500 text-slate-900 bg-white"
            autoFocus
          />
          <button
            type="button"
            onClick={handleCustomSubmit}
            disabled={!customValue.trim()}
            className="px-3 py-2 text-xs font-semibold bg-civic-600 hover:bg-civic-700 disabled:bg-slate-300 text-white rounded-lg transition"
          >
            Apply
          </button>
          <button
            type="button"
            onClick={() => {
              setIsCustomMode(false);
              setCustomValue('');
            }}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
            title="Cancel custom input"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <button
            type="button"
            role="combobox"
            id={selectId}
            disabled={disabled}
            aria-haspopup="listbox"
            aria-expanded={isOpen}
            aria-controls={listboxId}
            aria-label={ariaLabel || label || placeholder || 'Select option'}
            onClick={() => {
              if (!disabled) {
                setIsOpen(!isOpen);
                setSearchQuery('');
                setHighlightedIndex(-1);
              }
            }}
            onKeyDown={handleKeyDown}
            className={`w-full flex items-center justify-between px-3 py-2 text-sm text-left border rounded-lg transition bg-white ${
              disabled
                ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                : error
                ? 'border-rose-400 focus:ring-2 focus:ring-rose-500 focus:border-rose-500'
                : 'border-slate-300 hover:border-slate-400 focus:ring-2 focus:ring-civic-500 focus:border-civic-500'
            }`}
          >
            <span className={`block truncate ${!value ? 'text-slate-400' : 'text-slate-900 font-medium'}`}>
              {value || placeholder}
            </span>

            <div className="flex items-center space-x-1 pl-2 pointer-events-none">
              {loading && <Loader2 className="w-4 h-4 text-civic-600 animate-spin" />}
              <ChevronDown
                className={`w-4 h-4 text-slate-400 transition-transform ${
                  isOpen ? 'transform rotate-180' : ''
                }`}
              />
            </div>
          </button>

          {value && !disabled && (
            <button
              type="button"
              aria-label={`Clear ${ariaLabel || label || placeholder || 'selection'}`}
              onClick={handleClear}
              className="absolute right-8 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 rounded hover:bg-slate-100 z-10"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Dropdown Menu */}
          {isOpen && !disabled && (
            <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden animate-in fade-in-50 duration-150">
              {/* Search box within dropdown */}
              <div className="p-2 border-b border-slate-100 bg-slate-50 flex items-center space-x-2">
                <Search className="w-4 h-4 text-slate-400 shrink-0" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setHighlightedIndex(0);
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder={`Search ${label || 'options'}...`}
                  className="w-full bg-transparent text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Options list */}
              <ul
                id={listboxId}
                ref={listRef}
                role="listbox"
                tabIndex={-1}
                className="max-h-60 overflow-y-auto py-1 text-sm text-slate-700 divide-y divide-slate-50"
              >
                {filteredOptions.length > 0 ? (
                  filteredOptions.map((opt, idx) => {
                    const isSelected = opt === value;
                    const isHighlighted = idx === highlightedIndex;
                    return (
                      <li
                        key={opt}
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => handleSelect(opt)}
                        onMouseEnter={() => setHighlightedIndex(idx)}
                        className={`flex items-center justify-between px-3 py-2 cursor-pointer transition select-none ${
                          isSelected
                            ? 'bg-civic-50 text-civic-900 font-semibold'
                            : isHighlighted
                            ? 'bg-slate-100 text-slate-900'
                            : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <span className="truncate">{opt}</span>
                        {isSelected && <Check className="w-4 h-4 text-civic-600 shrink-0 ml-2" />}
                      </li>
                    );
                  })
                ) : (
                  <li className="px-3 py-4 text-center text-xs text-slate-400">
                    {emptyMessage}
                  </li>
                )}

                {/* Optional Custom Option entry */}
                {allowCustom && (
                  <li
                    role="option"
                    aria-selected={false}
                    onClick={() => {
                      if (searchQuery.trim()) {
                        handleSelect(searchQuery.trim());
                      } else {
                        setIsCustomMode(true);
                        setIsOpen(false);
                      }
                    }}
                    onMouseEnter={() => setHighlightedIndex(filteredOptions.length)}
                    className={`flex items-center px-3 py-2.5 text-xs font-semibold text-civic-700 cursor-pointer border-t border-slate-100 transition ${
                      highlightedIndex === filteredOptions.length
                        ? 'bg-civic-50'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    <span>
                      {searchQuery.trim()
                        ? `+ Use custom "${searchQuery.trim()}"`
                        : '+ Enter custom / other...'}
                    </span>
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>
      )}

      {error && <p className="mt-1 text-xs text-rose-600 font-medium">{error}</p>}
      {helperText && !error && <p className="mt-1 text-xs text-slate-500">{helperText}</p>}
    </div>
  );
}
