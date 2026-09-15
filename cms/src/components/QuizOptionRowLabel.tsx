'use client'

import React from 'react'
import { useRowLabel } from '@payloadcms/ui'

/** Shows the option's emoji + label on the collapsed array row. */
export default function QuizOptionRowLabel() {
  const { data, rowNumber } = useRowLabel<{ label?: string; emoji?: string }>()
  const label = data?.label?.trim()

  return (
    <span>
      {data?.emoji ? `${data.emoji} ` : ''}
      {label || `Option ${String((rowNumber ?? 0) + 1).padStart(2, '0')}`}
    </span>
  )
}
