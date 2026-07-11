'use client'

import { motion, MotionConfig, type Variants } from 'motion/react'
import React from 'react'

const EASE: [number, number, number, number] = [0.22, 0.61, 0.36, 1]

interface WordPullUpProps {
  words: Array<{ word: string; highlight?: boolean; breakAfter?: boolean }>
  className?: string
  delayChildren?: number
  staggerChildren?: number
}

const HIGHLIGHT_CLASS = 'text-primary'

export function WordPullUp({
  words,
  className,
  delayChildren = 0.35,
  staggerChildren = 0.12,
}: WordPullUpProps) {
  const wrapperVariants: Variants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren, delayChildren } },
  }
  const wordVariants: Variants = {
    hidden: { y: 24, opacity: 0 },
    show: { y: 0, opacity: 1, transition: { duration: 0.6, ease: EASE } },
  }

  return (
    // Motion animates inline styles, which the global reduced-motion CSS cannot
    // reach; "user" drops the transforms for those users while keeping the fade.
    <MotionConfig reducedMotion="user">
      <motion.h1
        variants={wrapperVariants}
        initial="hidden"
        animate="show"
        className={className}
      >
        {words.map(({ word, highlight, breakAfter }, index) => (
          <React.Fragment key={index}>
            <motion.span
              variants={wordVariants}
              style={{ display: 'inline-block', paddingRight: '0.28em' }}
              className={highlight ? HIGHLIGHT_CLASS : undefined}
            >
              {word}
            </motion.span>
            {breakAfter && <br />}
          </React.Fragment>
        ))}
      </motion.h1>
    </MotionConfig>
  )
}
