'use client'

import { useState } from 'react'
import { Star } from 'lucide-react'
import { cn } from '@amiora/ui'

interface StarRatingInputProps {
  value: number
  onChange: (rating: number) => void
  size?: 'sm' | 'md'
  className?: string
  disabled?: boolean
}

export function StarRatingInput({
  value,
  onChange,
  size = 'md',
  className,
  disabled = false,
}: StarRatingInputProps) {
  const [hover, setHover] = useState(0)
  const starSize = size === 'sm' ? 'h-5 w-5' : 'h-7 w-7'
  const active = hover || value

  return (
    <div
      className={cn('flex items-center gap-1', className)}
      role="radiogroup"
      aria-label="Rating"
      onMouseLeave={() => setHover(0)}
    >
      {Array.from({ length: 5 }, (_, i) => {
        const star = i + 1
        const filled = star <= active
        return (
          <button
            key={star}
            type="button"
            disabled={disabled}
            role="radio"
            aria-checked={value === star}
            aria-label={`${star} star${star > 1 ? 's' : ''}`}
            className="p-0.5 transition-transform hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed"
            onMouseEnter={() => !disabled && setHover(star)}
            onClick={() => !disabled && onChange(star)}
          >
            <Star
              className={cn(
                starSize,
                filled ? 'fill-gold text-gold' : 'fill-none text-ink-faint',
              )}
            />
          </button>
        )
      })}
    </div>
  )
}
