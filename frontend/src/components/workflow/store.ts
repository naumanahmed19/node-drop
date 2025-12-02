/**
 * App store hook for workflow components
 * This provides a unified interface for components that need access to connection line state
 */
import { useReactFlowUIStore } from '@/stores';

export function useAppStore() {
  const connectionLinePath = useReactFlowUIStore(state => state.connectionLinePath);
  const setConnectionLinePath = useReactFlowUIStore(state => state.setConnectionLinePath);
  
  return {
    connectionLinePath,
    setConnectionLinePath,
  };
}
