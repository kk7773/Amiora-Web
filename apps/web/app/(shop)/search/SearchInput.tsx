'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useSearchSuggest } from '@/hooks/useSearchSuggest'
import { SearchCombobox, useSearchKeyboardNav } from '@/components/search/SearchCombobox'
import type { SearchSuggestion } from '@/app/api/search/suggest/route'

export function SearchInput({ defaultValue }: { defaultValue: string }) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState(defaultValue)
  const [pending, start] = useTransition()
  const { suggestions, loading, show: suggestOpen } = useSearchSuggest(query)

  function navigateToSearch(q: string) {
    const trimmed = q.trim()
    if (!trimmed) return
    start(() => {
      router.push(`/search?q=${encodeURIComponent(trimmed)}`)
    })
  }

  function navigateToProduct(suggestion: SearchSuggestion) {
    start(() => {
      router.push(suggestion.href)
    })
  }

  const { activeIndex, setActiveIndex, handleKeyDown } = useSearchKeyboardNav(
    suggestions,
    suggestOpen,
    () => navigateToSearch(query),
    navigateToProduct,
  )

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    navigateToSearch(query)
  }

  return (
    <form onSubmit={handleSubmit}>
      <SearchCombobox
        value={query}
        onChange={setQuery}
        onSubmit={() => navigateToSearch(query)}
        onSelect={navigateToProduct}
        suggestions={suggestions}
        loading={loading}
        suggestOpen={suggestOpen}
        activeIndex={activeIndex}
        onActiveIndexChange={setActiveIndex}
        onKeyDown={handleKeyDown}
        inputRef={inputRef}
        variant="page"
        placeholder="Search jewellery…"
        pending={pending}
        showSubmit
      />
    </form>
  )
}
