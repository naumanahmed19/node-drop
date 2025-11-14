import { NodeEnhancement } from './NodeEnhancementRegistry'

/**
 * Dynamic Enhancement Loader
 * 
 * Loads frontend enhancements for custom nodes from the backend.
 * Custom nodes can include an optional enhancement file that defines
 * how the node should be rendered in the frontend.
 * 
 * File structure for custom nodes:
 * custom-nodes/
 *   my-node/
 *     nodes/
 *       MyNode.node.js          # Backend node definition
 *       MyNode.enhancement.js   # Frontend enhancement (optional)
 *     package.json
 */

interface EnhancementModule {
  default: NodeEnhancement
}

class DynamicEnhancementLoader {
  private loadedEnhancements = new Set<string>()
  private enhancementCache = new Map<string, NodeEnhancement>()

  /**
   * Load enhancements for all custom nodes from the backend
   */
  async loadCustomNodeEnhancements(): Promise<NodeEnhancement[]> {
    try {
      // Fetch list of custom nodes with enhancements
      const response = await fetch('/api/nodes/enhancements')
      
      if (!response.ok) {
        console.warn('Failed to fetch custom node enhancements')
        return []
      }

      const { enhancements } = await response.json()
      const loadedEnhancements: NodeEnhancement[] = []

      // Load each enhancement
      for (const enhancementInfo of enhancements) {
        const { nodeType, enhancementUrl } = enhancementInfo

        // Skip if already loaded
        if (this.loadedEnhancements.has(nodeType)) {
          const cached = this.enhancementCache.get(nodeType)
          if (cached) loadedEnhancements.push(cached)
          continue
        }

        try {
          // Dynamically import the enhancement module
          const module = await this.loadEnhancementModule(enhancementUrl)
          
          if (module && module.default) {
            this.enhancementCache.set(nodeType, module.default)
            this.loadedEnhancements.add(nodeType)
            loadedEnhancements.push(module.default)
            
            console.log(`✅ Loaded enhancement for ${nodeType}`)
          }
        } catch (error) {
          console.warn(`Failed to load enhancement for ${nodeType}:`, error)
        }
      }

      return loadedEnhancements
    } catch (error) {
      console.error('Failed to load custom node enhancements:', error)
      return []
    }
  }

  /**
   * Load a single enhancement module from URL
   */
  private async loadEnhancementModule(url: string): Promise<EnhancementModule | null> {
    try {
      // Fetch the enhancement code
      const response = await fetch(url)
      const code = await response.text()

      // Create a module scope with React and required dependencies
      const moduleScope = {
        React: await import('react'),
        exports: {} as any,
        module: { exports: {} as any },
      }

      // Execute the enhancement code in the module scope
      const moduleFunction = new Function(
        'React',
        'exports',
        'module',
        code
      )

      moduleFunction(
        moduleScope.React,
        moduleScope.exports,
        moduleScope.module
      )

      // Return the exported enhancement
      return {
        default: moduleScope.module.exports.default || moduleScope.exports.default
      }
    } catch (error) {
      console.error('Failed to load enhancement module:', error)
      return null
    }
  }

  /**
   * Clear all loaded enhancements (useful for hot reload)
   */
  clear() {
    this.loadedEnhancements.clear()
    this.enhancementCache.clear()
  }
}

export const dynamicEnhancementLoader = new DynamicEnhancementLoader()
