'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, MessageSquarePlus } from 'lucide-react'
import { toast } from 'sonner'
import { createBrowserClient } from '@amiora/database'
import { cn } from '@amiora/ui'
import { StarRatingInput } from '@/components/ui/StarRatingInput'

const schema = z.object({
  rating: z.number().min(1, 'Please select a rating'),
  title: z.string().max(120).optional(),
  body: z.string().min(10, 'Review must be at least 10 characters').max(2000),
  reviewerName: z.string().min(2, 'Name required').max(80).optional(),
})

type FormData = z.infer<typeof schema>

interface WriteReviewFormProps {
  productId: string
  productName: string
  /** When true, skips outer card — parent provides the container */
  embedded?: boolean
  /** Wider 2-column field layout on desktop */
  wide?: boolean
}

export function WriteReviewForm({
  productId,
  productName,
  embedded = false,
  wide = false,
}: WriteReviewFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null)
  const [userName, setUserName] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { rating: 0, title: '', body: '', reviewerName: '' },
  })

  const rating = watch('rating')

  useEffect(() => {
    const supabase = createBrowserClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      setIsLoggedIn(!!user)
      if (user) {
        const name =
          (user.user_metadata?.full_name as string | undefined) ??
          user.email?.split('@')[0] ??
          null
        setUserName(name)
        if (name) setValue('reviewerName', name)
      }
    })
  }, [setValue])

  const onSubmit = async (data: FormData) => {
    setLoading(true)
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          rating: data.rating,
          title: data.title || null,
          body: data.body,
          reviewerName: isLoggedIn ? null : data.reviewerName,
        }),
      })

      const json = (await res.json()) as { error?: string; success?: boolean }

      if (!res.ok) {
        toast.error('Could not submit review', { description: json.error })
        return
      }

      setSubmitted(true)
      reset({ rating: 0, title: '', body: '', reviewerName: userName ?? '' })
      toast.success('Thank you!', {
        description: 'Your review will appear after our team approves it.',
      })
      router.refresh()
    } catch {
      toast.error('Something went wrong', { description: 'Please try again.' })
    } finally {
      setLoading(false)
    }
  }

  const shellCls = embedded
    ? 'space-y-5'
    : 'rounded-2xl border border-divider bg-surface p-6 lg:p-8 space-y-5'

  const inputCls =
    'w-full px-3 py-2.5 text-sm bg-bg border border-divider rounded-lg text-ink placeholder:text-ink-faint focus:outline-none focus:ring-1 focus:ring-teal focus:border-teal transition-colors'

  if (submitted) {
    return (
      <div
        className={cn(
          embedded ? 'py-8' : 'rounded-2xl border border-divider bg-surface p-8 lg:p-12',
          'text-center space-y-4',
        )}
      >
        <div className="mx-auto w-14 h-14 rounded-full bg-teal/10 flex items-center justify-center">
          <MessageSquarePlus className="h-6 w-6 text-teal" />
        </div>
        <p className="font-display text-2xl text-ink">Review submitted</p>
        <p className="text-sm text-ink-muted leading-relaxed max-w-md mx-auto">
          Thanks for sharing your experience with {productName}. We&apos;ll publish it after a quick
          check.
        </p>
        <button
          type="button"
          onClick={() => setSubmitted(false)}
          className="text-sm text-teal hover:text-deep-teal transition-colors underline underline-offset-4"
        >
          Write another review
        </button>
      </div>
    )
  }

  return (
    <div className={shellCls}>
      <div>
        <h3 className="font-display text-xl lg:text-2xl text-ink">Write a Review</h3>
        <p className="text-sm text-ink-muted mt-1">Share your experience with this piece</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div className={cn(wide && 'pb-1 border-b border-divider/60')}>
          <p className="text-xs uppercase tracking-widest2 text-ink-muted mb-3">Your rating</p>
          <StarRatingInput
            value={rating}
            onChange={(v) => setValue('rating', v, { shouldValidate: true })}
            disabled={loading}
            size={wide ? 'md' : 'sm'}
          />
          {errors.rating && (
            <p className="text-xs text-red-500 mt-1.5">{errors.rating.message}</p>
          )}
        </div>

        <div
          className={cn(
            'space-y-5',
            wide && 'grid lg:grid-cols-2 lg:gap-x-8 lg:gap-y-5 lg:space-y-0',
          )}
        >
          {isLoggedIn === false && (
            <div className={cn(wide && 'lg:col-span-1')}>
              <label className="text-xs uppercase tracking-widest2 text-ink-muted mb-2 block">
                Your name
              </label>
              <input
                {...register('reviewerName')}
                placeholder="How should we display your name?"
                className={inputCls}
                disabled={loading}
              />
              {errors.reviewerName && (
                <p className="text-xs text-red-500 mt-1">{errors.reviewerName.message}</p>
              )}
              <p className="text-xs text-ink-faint mt-2">
                <Link href="/login" className="text-teal hover:underline">
                  Sign in
                </Link>{' '}
                to link your review to your account
              </p>
            </div>
          )}

          <div className={cn(wide && (isLoggedIn === false ? 'lg:col-span-1' : 'lg:col-span-2'))}>
            <label className="text-xs uppercase tracking-widest2 text-ink-muted mb-2 block">
              Review title{' '}
              <span className="normal-case tracking-normal text-ink-faint">(optional)</span>
            </label>
            <input
              {...register('title')}
              placeholder="Sum up your experience"
              className={inputCls}
              disabled={loading}
            />
          </div>

          <div className={cn(wide && 'lg:col-span-2')}>
            <label className="text-xs uppercase tracking-widest2 text-ink-muted mb-2 block">
              Your review
            </label>
            <textarea
              {...register('body')}
              rows={wide ? 5 : 4}
              placeholder="What did you love? How was the quality, fit, and finish?"
              className={`${inputCls} resize-none`}
              disabled={loading}
            />
            {errors.body && <p className="text-xs text-red-500 mt-1">{errors.body.message}</p>}
          </div>
        </div>

        <div className={cn(wide && 'flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-1')}>
          {/* <p className={cn('text-2xs text-ink-faint leading-relaxed', wide && 'sm:max-w-xs order-2 sm:order-1')}>
            Reviews are moderated before publishing.
          </p> */}
          <button
            type="submit"
            disabled={loading || isLoggedIn === null}
            className={cn(
              'flex items-center justify-center gap-2 py-3 bg-deep-teal text-cream text-sm font-medium uppercase tracking-widest rounded-lg hover:bg-teal transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
              wide ? 'sm:min-w-[220px] order-1 sm:order-2' : 'w-full',
            )}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Submitting…
              </>
            ) : (
              'Submit Review'
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
