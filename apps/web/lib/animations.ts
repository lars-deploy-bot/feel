/**
 * Shared animation variants for framer-motion
 * Centralizes animation definitions to ensure consistency across components
 */

import type { Variants } from "framer-motion"

/**
 * Standard field animation variants
 * Used for form inputs, textareas, and interactive fields
 */
export const fieldVariants: Variants = {
  hidden: { opacity: 0, x: -10 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.4 },
  },
  focus: {
    scale: 1.01,
    transition: { duration: 0.2 },
  },
}

/**
 * Container animation variants
 * Used for wrapping multiple animated elements
 */
export const containerVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: "easeOut",
      staggerChildren: 0.1,
      delayChildren: 0.1,
    },
  },
}

/**
 * Item animation variants
 * Used for individual items within an animated container
 */
export const itemVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: "easeOut" },
  },
}
