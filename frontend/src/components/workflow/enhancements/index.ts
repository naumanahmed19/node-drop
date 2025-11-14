import { delayNodeEnhancement } from './DelayNodeEnhancement'
import { nodeEnhancementRegistry } from './NodeEnhancementRegistry'

// Register all node enhancements
nodeEnhancementRegistry.register(delayNodeEnhancement)

// Export registry for use in components
export { nodeEnhancementRegistry }
export type { NodeEnhancement, NodeEnhancementContext } from './NodeEnhancementRegistry'
