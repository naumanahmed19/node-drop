import { RefObject, useCallback, useEffect, useRef } from "react";
import { ReactFlowInstance } from "@xyflow/react";

interface UseReactFlowAutoLayoutOptions {
  reactFlowInstance: ReactFlowInstance | null;
  nodesCount: number;
  enabled?: boolean;
  delay?: number;
  additionalRef?: RefObject<HTMLDivElement | null> | null;
}

/**
 * Hook to automatically adjust ReactFlow viewport when container size changes
 * Uses ResizeObserver to detect container dimension changes and triggers fitView
 *
 * @param options - Configuration options
 * @param options.reactFlowInstance - The ReactFlow instance to control
 * @param options.nodesCount - Number of nodes (to avoid unnecessary fitView calls)
 * @param options.enabled - Whether the auto-layout is enabled (default: true)
 * @param options.delay - Delay in ms before triggering fitView (default: 50)
 * @param options.additionalRef - Additional ref to also assign the element to
 *
 * @returns combinedRef - Ref callback to attach to the container element
 */
export function useReactFlowAutoLayout({
  reactFlowInstance,
  nodesCount,
  enabled = true,
  delay = 50,
  additionalRef,
}: UseReactFlowAutoLayoutOptions) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!enabled || !containerRef.current || !reactFlowInstance) return;

    const resizeObserver = new ResizeObserver(() => {
      // Delay slightly to ensure DOM has updated
      setTimeout(() => {
        if (reactFlowInstance && nodesCount > 0) {
          reactFlowInstance.fitView({ padding: 0.1, duration: 0 });
        }
      }, delay);
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [reactFlowInstance, nodesCount, enabled, delay]);

  // Create a combined ref callback that updates both refs
  const combinedRef = useCallback(
    (element: HTMLDivElement | null) => {
      // Update the container ref (use type assertion for mutable ref)
      (containerRef as React.MutableRefObject<HTMLDivElement | null>).current =
        element;

      // Update the additional ref if provided
      if (additionalRef && "current" in additionalRef) {
        (additionalRef as any).current = element;
      }
    },
    [additionalRef]
  );

  return combinedRef;
}

/**
 * Utility function to trigger ReactFlow fitView with a delay
 * Useful for manual layout recalculation after data changes
 *
 * @param reactFlowInstance - The ReactFlow instance
 * @param delay - Delay in ms before triggering fitView (default: 100)
 */
export function triggerReactFlowFitView(
  reactFlowInstance: ReactFlowInstance | null | undefined,
  delay = 100
) {
  if (!reactFlowInstance) return;

  setTimeout(() => {
    reactFlowInstance.fitView({ padding: 0.1, duration: 200 });
  }, delay);
}
