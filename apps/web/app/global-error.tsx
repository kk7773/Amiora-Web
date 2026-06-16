'use client'

import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <html lang="en">
      <body className="min-h-screen bg-[#FAF8F5] text-[#1A1410] flex flex-col items-center justify-center gap-4 px-6">
        <h1 className="text-2xl font-semibold">Something went wrong</h1>
        <p className="text-sm text-[#6B6560] text-center max-w-md">
          Please refresh the page. If the problem continues, restart the dev server.
        </p>
        <button
          type="button"
          onClick={reset}
          className="rounded-lg bg-[#285260] px-5 py-2.5 text-sm font-medium text-[#E0D7CF]"
        >
          Try again
        </button>
      </body>
    </html>
  )
}
