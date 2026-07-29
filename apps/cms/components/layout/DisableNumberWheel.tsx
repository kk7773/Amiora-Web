'use client'

import { useEffect } from 'react'

export function DisableNumberWheel() {
  useEffect(() => {
    const handleWheel = (event: WheelEvent) => {
      const target = event.target
      if (!(target instanceof HTMLInputElement)) return
      if (target.type !== 'number') return
      event.preventDefault()
    }

    document.addEventListener('wheel', handleWheel, { passive: false, capture: true })

    return () => {
      document.removeEventListener('wheel', handleWheel, { capture: true })
    }
  }, [])

  return null
}
