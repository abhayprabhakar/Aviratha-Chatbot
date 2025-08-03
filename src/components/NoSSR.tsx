'use client'

import { ReactNode, useEffect, useState } from 'react'

interface NoSSRProps {
  children: ReactNode
  fallback?: ReactNode
}

export default function NoSSR({ children, fallback = null }: NoSSRProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return <>{fallback}</>
  }

  return <>{children}</>
}