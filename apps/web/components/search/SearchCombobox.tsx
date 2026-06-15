'use client'

import Image from 'next/image'
import { useEffect, useRef, useState, type RefObject } from 'react'
import { Loader2, Search, X } from 'lucide-react'
import type { SearchSuggestion } from '@/app/api/search/suggest/route'

type SearchComboboxVariant = 'header' | 'page' | 'mobile'

type SearchComboboxProps = {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  onSelect: (suggestion: SearchSuggestion) => void
  onClose?: () => void
  suggestions: SearchSuggestion[]
  loading: boolean
  suggestOpen: boolean
  activeIndex: number
  onActiveIndexChange: (index: number) => void
  onKeyDown: (e: React.KeyboardEvent) => void
  inputRef?: RefObject<HTMLInputElement | null>
  variant?: SearchComboboxVariant
  placeholder?: string
  pending?: boolean
  showSubmit?: boolean
}

const VARIANT = {
  header: {
    shell: 'max-w-xl mx-auto',
    box: 'rounded-2xl border border-divider bg-bg shadow-sm',
    row: 'flex items-center gap-2 px-3 h-11',
    input: 'flex-1 min-w-0 bg-transparent text-sm text-ink placeholder:text-ink-faint outline-none',
    icon: 'text-ink-faint',
    divider: 'border-divider',
    surface: 'bg-surface',
    text: 'text-ink',
    muted: 'text-ink-muted',
    faint: 'text-ink-faint',
    accent: 'text-deep-teal hover:text-teal',
  },
  page: {
    shell: 'w-full',
    box: 'rounded-2xl border border-divider bg-bg shadow-sm',
    row: 'flex items-center gap-2 px-3 h-12',
    input: 'flex-1 min-w-0 bg-transparent text-sm text-ink placeholder:text-ink-faint outline-none',
    icon: 'text-ink-faint',
    divider: 'border-divider',
    surface: 'bg-surface',
    text: 'text-ink',
    muted: 'text-ink-muted',
    faint: 'text-ink-faint',
    accent: 'text-deep-teal hover:text-teal',
  },
  mobile: {
    shell: 'w-full',
    box: 'rounded-xl border border-white/15 bg-[#1e3d47]',
    row: 'flex items-center gap-2 px-3 h-10',
    input: 'flex-1 min-w-0 bg-transparent text-sm text-[#E0D7CF] placeholder:text-[#E0D7CF]/50 outline-none',
    icon: 'text-[#E0D7CF]/60',
    divider: 'border-white/10',
    surface: 'bg-white/8',
    text: 'text-[#FAF8F5]',
    muted: 'text-[#E0D7CF]/80',
    faint: 'text-[#E0D7CF]/50',
    accent: 'text-[#C9A84C] hover:text-[#E0D7CF]',
  },
} as const

export function SearchCombobox({
  value,
  onChange,
  onSubmit,
  onSelect,
  onClose,
  suggestions,
  loading,
  suggestOpen,
  activeIndex,
  onActiveIndexChange,
  onKeyDown,
  inputRef,
  variant = 'header',
  placeholder = 'Search jewellery…',
  pending = false,
  showSubmit = false,
}: SearchComboboxProps) {
  const listRef = useRef<HTMLUListElement>(null)
  const v = VARIANT[variant]
  const trimmed = value.trim()
  const hasResults = suggestions.length > 0
  const panelOpen = suggestOpen && (loading || hasResults || trimmed.length >= 2)

  useEffect(() => {
    if (activeIndex < 0 || !listRef.current) return
    const item = listRef.current.children[activeIndex] as HTMLElement | undefined
    item?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  return (
    <div className={v.shell}>
      <div
        className={`${v.box} overflow-hidden flex flex-col transition-shadow duration-200 ${
          variant === 'mobile' ? 'flex-col-reverse' : ''
        } ${panelOpen ? 'shadow-md' : ''}`}
      >
        <div className={v.row}>
          <span className={`shrink-0 ${v.icon}`}>
            {pending || loading
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <Search className="h-4 w-4" />}
          </span>

          <input
            ref={inputRef}
            type="search"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            autoComplete="off"
            role="combobox"
            aria-expanded={suggestOpen}
            aria-autocomplete="list"
            className={v.input}
          />

          {value ? (
            <button
              type="button"
              onClick={() => onChange('')}
              aria-label="Clear search"
              className={`shrink-0 p-1 rounded-md ${v.faint} hover:opacity-80 transition-opacity`}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : onClose ? (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close search"
              className={`shrink-0 p-1 rounded-md ${v.faint} hover:opacity-80 transition-opacity`}
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}

          {showSubmit && (
            <button
              type="button"
              onClick={onSubmit}
              disabled={pending || !trimmed}
              className="shrink-0 h-7 px-3 rounded-full bg-deep-teal text-cream text-xs font-medium hover:bg-teal transition-colors disabled:opacity-50"
            >
              Search
            </button>
          )}
        </div>

        {panelOpen && (
          <div
            className={`${variant === 'mobile' ? 'border-b' : 'border-t'} ${v.divider}`}
            role="listbox"
            aria-label="Search suggestions"
          >
            {loading && !hasResults ? (
              <div className={`flex items-center gap-2 px-3 py-2.5 text-xs ${v.muted}`}>
                Searching…
              </div>
            ) : hasResults ? (
              <ul ref={listRef} className="max-h-64 overflow-y-auto py-0.5">
                {suggestions.map((item, index) => (
                  <li key={item.id} role="option" aria-selected={index === activeIndex}>
                    <button
                      type="button"
                      onMouseEnter={() => onActiveIndexChange(index)}
                      onClick={() => onSelect(item)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${
                        index === activeIndex ? v.surface : 'hover:opacity-90'
                      }`}
                    >
                      <span className={`relative h-8 w-8 shrink-0 overflow-hidden rounded-md ${v.surface}`}>
                        {item.imageUrl ? (
                          <Image src={item.imageUrl} alt="" fill sizes="32px" className="object-cover" />
                        ) : (
                          <span className={`flex h-full w-full items-center justify-center ${v.faint}`}>
                            <Search className="h-3 w-3" />
                          </span>
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={`block truncate text-sm ${v.text}`}>{item.name}</span>
                        {item.subtitle && (
                          <span className={`block truncate text-[11px] ${v.faint}`}>{item.subtitle}</span>
                        )}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className={`px-3 py-2.5 text-xs ${v.muted}`}>
                No products found
              </div>
            )}

            {hasResults && (
              <div className={`border-t ${v.divider}`}>
                <button
                  type="button"
                  onClick={onSubmit}
                  className={`w-full py-2 text-center text-[11px] font-medium tracking-wide ${v.accent} transition-colors`}
                >
                  View all results →
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/** Keyboard helper for search inputs with suggestion lists. */
export function useSearchKeyboardNav(
  suggestions: SearchSuggestion[],
  open: boolean,
  onSubmit: () => void,
  onSelect: (suggestion: SearchSuggestion) => void,
) {
  const [activeIndex, setActiveIndex] = useState(-1)

  useEffect(() => {
    setActiveIndex(-1)
  }, [suggestions, open])

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open || suggestions.length === 0) {
      if (e.key === 'Enter') onSubmit()
      return
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => (i < suggestions.length - 1 ? i + 1 : 0))
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => (i > 0 ? i - 1 : suggestions.length - 1))
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      if (activeIndex >= 0 && suggestions[activeIndex]) {
        onSelect(suggestions[activeIndex])
      } else {
        onSubmit()
      }
      return
    }
    if (e.key === 'Escape') {
      setActiveIndex(-1)
    }
  }

  return { activeIndex, setActiveIndex, handleKeyDown }
}
