import { DependencyResolver, CircularDependency, ValidationResult } from '../DependencyResolver';
import { Connection } from '../../types/database';
import { 
  CircularDependencyError, 
  MissingDependencyError, 
  InvalidFlowStateError,
  FlowExecutionErrorType 
} from '../../utils/errors/FlowExecutionError';

describe('DependencyResolver', () => {
  let resolver: DependencyResolver;

  beforeEach(() => {
    resolver = new DependencyResolver();
  });

  describe('getDependencies', () => {
    it('should return direct dependencies for a node', () => {
      const connections: Connection[] = [
        { id: '1', sourceNodeId: 'A', sourceOutput: 'main', targetNodeId: 'B', targetInput: 'main' },
        { id: '2', sourceNodeId: 'B', sourceOutput: 'main', targetNodeId: 'C', targetInput: 'main' },
        { id: '3', sourceNodeId: 'D', sourceOutput: 'main', targetNodeId: 'C', targetInput: 'main' }
      ];

      expect(resolver.getDependencies('A', connections)).toEqual([]);
      expect(resolver.getDependencies('B', connections)).toEqual(['A']);
      expect(resolver.getDependencies('C', connections)).toEqual(['B', 'D']);
    });

    it('should handle duplicate dependencies', () => {
      const connections: Connection[] = [
        { id: '1', sourceNodeId: 'A', sourceOutput: 'main', targetNodeId: 'B', targetInput: 'main' },
        { id: '2', sourceNodeId: 'A', sourceOutput: 'secondary', targetNodeId: 'B', targetInput: 'secondary' }
      ];

      expect(resolver.getDependencies('B', connections)).toEqual(['A']);
    });

    it('should return empty array for node with no dependencies', () => {
      const connections: Connection[] = [
        { id: '1', sourceNodeId: 'A', sourceOutput: 'main', targetNodeId: 'B', targetInput: 'main' }
      ];

      expect(resolver.getDependencies('A', connections)).toEqual([]);
    });
  });

  describe('getDownstreamNodes', () => {
    it('should return direct downstream nodes', () => {
      const connections: Connection[] = [
        { id: '1', sourceNodeId: 'A', sourceOutput: 'main', targetNodeId: 'B', targetInput: 'main' },
        { id: '2', sourceNodeId: 'A', sourceOutput: 'main', targetNodeId: 'C', targetInput: 'main' },
        { id: '3', sourceNodeId: 'B', sourceOutput: 'main', targetNodeId: 'D', targetInput: 'main' }
      ];

      expect(resolver.getDownstreamNodes('A', connections)).toEqual(['B', 'C']);
      expect(resolver.getDownstreamNodes('B', connections)).toEqual(['D']);
      expect(resolver.getDownstreamNodes('C', connections)).toEqual([]);
      expect(resolver.getDownstreamNodes('D', connections)).toEqual([]);
    });

    it('should handle duplicate downstream nodes', () => {
      const connections: Connection[] = [
        { id: '1', sourceNodeId: 'A', sourceOutput: 'main', targetNodeId: 'B', targetInput: 'main' },
        { id: '2', sourceNodeId: 'A', sourceOutput: 'secondary', targetNodeId: 'B', targetInput: 'secondary' }
      ];

      expect(resolver.getDownstreamNodes('A', connections)).toEqual(['B']);
    });
  });

  describe('getAllDownstreamNodes', () => {
    it('should return all transitive downstream nodes', () => {
      const connections: Connection[] = [
        { id: '1', sourceNodeId: 'A', sourceOutput: 'main', targetNodeId: 'B', targetInput: 'main' },
        { id: '2', sourceNodeId: 'B', sourceOutput: 'main', targetNodeId: 'C', targetInput: 'main' },
        { id: '3', sourceNodeId: 'A', sourceOutput: 'main', targetNodeId: 'D', targetInput: 'main' },
        { id: '4', sourceNodeId: 'D', sourceOutput: 'main', targetNodeId: 'E', targetInput: 'main' }
      ];

      const result = resolver.getAllDownstreamNodes('A', connections);
      expect(result.sort()).toEqual(['B', 'C', 'D', 'E']);
    });

    it('should handle complex branching', () => {
      const connections: Connection[] = [
        { id: '1', sourceNodeId: 'A', sourceOutput: 'main', targetNodeId: 'B', targetInput: 'main' },
        { id: '2', sourceNodeId: 'A', sourceOutput: 'main', targetNodeId: 'C', targetInput: 'main' },
        { id: '3', sourceNodeId: 'B', sourceOutput: 'main', targetNodeId: 'D', targetInput: 'main' },
        { id: '4', sourceNodeId: 'C', sourceOutput: 'main', targetNodeId: 'D', targetInput: 'main' },
        { id: '5', sourceNodeId: 'D', sourceOutput: 'main', targetNodeId: 'E', targetInput: 'main' }
      ];

      const result = resolver.getAllDownstreamNodes('A', connections);
      expect(result.sort()).toEqual(['B', 'C', 'D', 'E']);
    });

    it('should handle circular references without infinite loop', () => {
      const connections: Connection[] = [
        { id: '1', sourceNodeId: 'A', sourceOutput: 'main', targetNodeId: 'B', targetInput: 'main' },
        { id: '2', sourceNodeId: 'B', sourceOutput: 'main', targetNodeId: 'A', targetInput: 'main' }
      ];

      const result = resolver.getAllDownstreamNodes('A', connections);
      expect(result.sort()).toEqual(['B']);
    });
  });

  describe('getAllDependencies', () => {
    it('should return all transitive dependencies', () => {
      const connections: Connection[] = [
        { id: '1', sourceNodeId: 'A', sourceOutput: 'main', targetNodeId: 'B', targetInput: 'main' },
        { id: '2', sourceNodeId: 'B', sourceOutput: 'main', targetNodeId: 'C', targetInput: 'main' },
        { id: '3', sourceNodeId: 'D', sourceOutput: 'main', targetNodeId: 'C', targetInput: 'main' },
        { id: '4', sourceNodeId: 'E', sourceOutput: 'main', targetNodeId: 'D', targetInput: 'main' }
      ];

      const result = resolver.getAllDependencies('C', connections);
      expect(result.sort()).toEqual(['A', 'B', 'D', 'E']);
    });

    it('should handle circular references without infinite loop', () => {
      const connections: Connection[] = [
        { id: '1', sourceNodeId: 'A', sourceOutput: 'main', targetNodeId: 'B', targetInput: 'main' },
        { id: '2', sourceNodeId: 'B', sourceOutput: 'main', targetNodeId: 'A', targetInput: 'main' }
      ];

      const result = resolver.getAllDependencies('B', connections);
      expect(result.sort()).toEqual(['A']);
    });
  });

  describe('getExecutableNodes', () => {
    it('should return nodes with all dependencies completed', () => {
      const nodeIds = ['A', 'B', 'C', 'D'];
      const connections: Connection[] = [
        { id: '1', sourceNodeId: 'A', sourceOutput: 'main', targetNodeId: 'B', targetInput: 'main' },
        { id: '2', sourceNodeId: 'B', sourceOutput: 'main', targetNodeId: 'C', targetInput: 'main' },
        { id: '3', sourceNodeId: 'A', sourceOutput: 'main', targetNodeId: 'D', targetInput: 'main' }
      ];
      const completedNodes = new Set(['A']);

      const result = resolver.getExecutableNodes(nodeIds, connections, completedNodes);
      expect(result.sort()).toEqual(['B', 'D']);
    });

    it('should return start nodes when no nodes are completed', () => {
      const nodeIds = ['A', 'B', 'C'];
      const connections: Connection[] = [
        { id: '1', sourceNodeId: 'A', sourceOutput: 'main', targetNodeId: 'B', targetInput: 'main' },
        { id: '2', sourceNodeId: 'B', sourceOutput: 'main', targetNodeId: 'C', targetInput: 'main' }
      ];
      const completedNodes = new Set<string>();

      const result = resolver.getExecutableNodes(nodeIds, connections, completedNodes);
      expect(result).toEqual(['A']);
    });

    it('should exclude already completed nodes', () => {
      const nodeIds = ['A', 'B', 'C'];
      const connections: Connection[] = [
        { id: '1', sourceNodeId: 'A', sourceOutput: 'main', targetNodeId: 'B', targetInput: 'main' },
        { id: '2', sourceNodeId: 'B', sourceOutput: 'main', targetNodeId: 'C', targetInput: 'main' }
      ];
      const completedNodes = new Set(['A', 'B']);

      const result = resolver.getExecutableNodes(nodeIds, connections, completedNodes);
      expect(result).toEqual(['C']);
    });

    it('should handle nodes with multiple dependencies', () => {
      const nodeIds = ['A', 'B', 'C', 'D'];
      const connections: Connection[] = [
        { id: '1', sourceNodeId: 'A', sourceOutput: 'main', targetNodeId: 'C', targetInput: 'main' },
        { id: '2', sourceNodeId: 'B', sourceOutput: 'main', targetNodeId: 'C', targetInput: 'main' },
        { id: '3', sourceNodeId: 'C', sourceOutput: 'main', targetNodeId: 'D', targetInput: 'main' }
      ];
      const completedNodes = new Set(['A']);

      let result = resolver.getExecutableNodes(nodeIds, connections, completedNodes);
      expect(result).toEqual(['B']); // B has no dependencies and is not completed yet

      completedNodes.add('B');
      result = resolver.getExecutableNodes(nodeIds, connections, completedNodes);
      expect(result).toEqual(['C']); // Now C can execute since both A and B are completed
    });
  });

  describe('detectCircularDependencies', () => {
    it('should detect simple circular dependency', () => {
      const connections: Connection[] = [
        { id: '1', sourceNodeId: 'A', sourceOutput: 'main', targetNodeId: 'B', targetInput: 'main' },
        { id: '2', sourceNodeId: 'B', sourceOutput: 'main', targetNodeId: 'A', targetInput: 'main' }
      ];

      const result = resolver.detectCircularDependencies(connections);
      expect(result).toHaveLength(1);
      expect(result[0].severity).toBe('error');
      expect(result[0].nodes.sort()).toEqual(['A', 'B']);
    });

    it('should detect complex circular dependency', () => {
      const connections: Connection[] = [
        { id: '1', sourceNodeId: 'A', sourceOutput: 'main', targetNodeId: 'B', targetInput: 'main' },
        { id: '2', sourceNodeId: 'B', sourceOutput: 'main', targetNodeId: 'C', targetInput: 'main' },
        { id: '3', sourceNodeId: 'C', sourceOutput: 'main', targetNodeId: 'A', targetInput: 'main' }
      ];

      const result = resolver.detectCircularDependencies(connections);
      expect(result).toHaveLength(1);
      expect(result[0].severity).toBe('error');
      expect(result[0].nodes.sort()).toEqual(['A', 'B', 'C']);
    });

    it('should not detect false positives in valid flows', () => {
      const connections: Connection[] = [
        { id: '1', sourceNodeId: 'A', sourceOutput: 'main', targetNodeId: 'B', targetInput: 'main' },
        { id: '2', sourceNodeId: 'A', sourceOutput: 'main', targetNodeId: 'C', targetInput: 'main' },
        { id: '3', sourceNodeId: 'B', sourceOutput: 'main', targetNodeId: 'D', targetInput: 'main' },
        { id: '4', sourceNodeId: 'C', sourceOutput: 'main', targetNodeId: 'D', targetInput: 'main' }
      ];

      const result = resolver.detectCircularDependencies(connections);
      expect(result).toHaveLength(0);
    });

    it('should handle self-referencing nodes', () => {
      const connections: Connection[] = [
        { id: '1', sourceNodeId: 'A', sourceOutput: 'main', targetNodeId: 'A', targetInput: 'main' }
      ];

      const result = resolver.detectCircularDependencies(connections);
      expect(result).toHaveLength(1);
      expect(result[0].nodes).toEqual(['A']);
    });
  });

  describe('validateExecutionPath', () => {
    it('should validate a correct workflow', () => {
      const nodeIds = ['A', 'B', 'C', 'D'];
      const connections: Connection[] = [
        { id: '1', sourceNodeId: 'A', sourceOutput: 'main', targetNodeId: 'B', targetInput: 'main' },
        { id: '2', sourceNodeId: 'B', sourceOutput: 'main', targetNodeId: 'C', targetInput: 'main' },
        { id: '3', sourceNodeId: 'A', sourceOutput: 'main', targetNodeId: 'D', targetInput: 'main' }
      ];

      const result = resolver.validateExecutionPath(nodeIds, connections);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.circularDependencies).toHaveLength(0);
    });

    it('should detect circular dependencies as errors', () => {
      const nodeIds = ['A', 'B'];
      const connections: Connection[] = [
        { id: '1', sourceNodeId: 'A', sourceOutput: 'main', targetNodeId: 'B', targetInput: 'main' },
        { id: '2', sourceNodeId: 'B', sourceOutput: 'main', targetNodeId: 'A', targetInput: 'main' }
      ];

      const result = resolver.validateExecutionPath(nodeIds, connections);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.circularDependencies).toHaveLength(1);
    });

    it('should detect orphaned nodes as warnings', () => {
      const nodeIds = ['A', 'B', 'C'];
      const connections: Connection[] = [
        { id: '1', sourceNodeId: 'A', sourceOutput: 'main', targetNodeId: 'B', targetInput: 'main' }
      ];

      const result = resolver.validateExecutionPath(nodeIds, connections);
      expect(result.valid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.orphanedNodes).toContain('C');
    });

    it('should detect invalid connections', () => {
      const nodeIds = ['A', 'B'];
      const connections: Connection[] = [
        { id: '1', sourceNodeId: 'A', sourceOutput: 'main', targetNodeId: 'C', targetInput: 'main' }
      ];

      const result = resolver.validateExecutionPath(nodeIds, connections);
      expect(result.valid).toBe(false);
      expect(result.errors.some(error => error.includes('non-existent'))).toBe(true);
    });
  });

  describe('getTopologicalOrder', () => {
    it('should return nodes in dependency order', () => {
      const nodeIds = ['A', 'B', 'C', 'D'];
      const connections: Connection[] = [
        { id: '1', sourceNodeId: 'A', sourceOutput: 'main', targetNodeId: 'B', targetInput: 'main' },
        { id: '2', sourceNodeId: 'B', sourceOutput: 'main', targetNodeId: 'C', targetInput: 'main' },
        { id: '3', sourceNodeId: 'A', sourceOutput: 'main', targetNodeId: 'D', targetInput: 'main' }
      ];

      const result = resolver.getTopologicalOrder(nodeIds, connections);
      
      // A should come before B and D
      expect(result.indexOf('A')).toBeLessThan(result.indexOf('B'));
      expect(result.indexOf('A')).toBeLessThan(result.indexOf('D'));
      // B should come before C
      expect(result.indexOf('B')).toBeLessThan(result.indexOf('C'));
    });

    it('should throw error for circular dependencies', () => {
      const nodeIds = ['A', 'B'];
      const connections: Connection[] = [
        { id: '1', sourceNodeId: 'A', sourceOutput: 'main', targetNodeId: 'B', targetInput: 'main' },
        { id: '2', sourceNodeId: 'B', sourceOutput: 'main', targetNodeId: 'A', targetInput: 'main' }
      ];

      expect(() => {
        resolver.getTopologicalOrder(nodeIds, connections);
      }).toThrow('Circular dependency detected');
    });
  });

  describe('getParallelExecutionGroups', () => {
    it('should group nodes that can execute in parallel', () => {
      const nodeIds = ['A', 'B', 'C', 'D', 'E'];
      const connections: Connection[] = [
        { id: '1', sourceNodeId: 'A', sourceOutput: 'main', targetNodeId: 'B', targetInput: 'main' },
        { id: '2', sourceNodeId: 'A', sourceOutput: 'main', targetNodeId: 'C', targetInput: 'main' },
        { id: '3', sourceNodeId: 'B', sourceOutput: 'main', targetNodeId: 'D', targetInput: 'main' },
        { id: '4', sourceNodeId: 'C', sourceOutput: 'main', targetNodeId: 'E', targetInput: 'main' }
      ];

      const result = resolver.getParallelExecutionGroups(nodeIds, connections);
      
      expect(result).toHaveLength(3);
      expect(result[0]).toEqual(['A']); // First group: start node
      expect(result[1].sort()).toEqual(['B', 'C']); // Second group: parallel after A
      expect(result[2].sort()).toEqual(['D', 'E']); // Third group: parallel after B and C
    });

    it('should handle sequential execution', () => {
      const nodeIds = ['A', 'B', 'C'];
      const connections: Connection[] = [
        { id: '1', sourceNodeId: 'A', sourceOutput: 'main', targetNodeId: 'B', targetInput: 'main' },
        { id: '2', sourceNodeId: 'B', sourceOutput: 'main', targetNodeId: 'C', targetInput: 'main' }
      ];

      const result = resolver.getParallelExecutionGroups(nodeIds, connections);
      
      expect(result).toHaveLength(3);
      expect(result[0]).toEqual(['A']);
      expect(result[1]).toEqual(['B']);
      expect(result[2]).toEqual(['C']);
    });

    it('should handle merge patterns', () => {
      const nodeIds = ['A', 'B', 'C', 'D'];
      const connections: Connection[] = [
        { id: '1', sourceNodeId: 'A', sourceOutput: 'main', targetNodeId: 'C', targetInput: 'main' },
        { id: '2', sourceNodeId: 'B', sourceOutput: 'main', targetNodeId: 'C', targetInput: 'main' },
        { id: '3', sourceNodeId: 'C', sourceOutput: 'main', targetNodeId: 'D', targetInput: 'main' }
      ];

      const result = resolver.getParallelExecutionGroups(nodeIds, connections);
      
      expect(result).toHaveLength(3);
      expect(result[0].sort()).toEqual(['A', 'B']); // Parallel start nodes
      expect(result[1]).toEqual(['C']); // Merge node
      expect(result[2]).toEqual(['D']); // Final node
    });
  });

  describe('Enhanced Circular Dependency Detection and Error Handling', () => {
    describe('validateAndPreventCircularDependencies', () => {
      it('should throw CircularDependencyError for simple circular dependency', () => {
        const connections: Connection[] = [
          { id: '1', sourceNodeId: 'A', sourceOutput: 'main', targetNodeId: 'B', targetInput: 'main' },
          { id: '2', sourceNodeId: 'B', sourceOutput: 'main', targetNodeId: 'A', targetInput: 'main' }
        ];

        expect(() => {
          resolver.validateAndPreventCircularDependencies(connections);
        }).toThrow(CircularDependencyError);

        try {
          resolver.validateAndPreventCircularDependencies(connections, ['start']);
        } catch (error: any) {
          expect(error).toBeInstanceOf(CircularDependencyError);
          expect(error.flowErrorType).toBe(FlowExecutionErrorType.CIRCULAR_DEPENDENCY);
          expect(error.affectedNodes.sort()).toEqual(['A', 'B']);
          expect(error.dependencyChain).toContain('A');
          expect(error.dependencyChain).toContain('B');
          expect(error.executionPath).toEqual(['start']);
          expect(error.suggestedResolution).toContain('Remove one or more connections');
        }
      });

      it('should throw CircularDependencyError for complex circular dependency', () => {
        const connections: Connection[] = [
          { id: '1', sourceNodeId: 'A', sourceOutput: 'main', targetNodeId: 'B', targetInput: 'main' },
          { id: '2', sourceNodeId: 'B', sourceOutput: 'main', targetNodeId: 'C', targetInput: 'main' },
          { id: '3', sourceNodeId: 'C', sourceOutput: 'main', targetNodeId: 'A', targetInput: 'main' }
        ];

        expect(() => {
          resolver.validateAndPreventCircularDependencies(connections);
        }).toThrow(CircularDependencyError);

        try {
          resolver.validateAndPreventCircularDependencies(connections);
        } catch (error: any) {
          expect(error).toBeInstanceOf(CircularDependencyError);
          expect(error.affectedNodes.sort()).toEqual(['A', 'B', 'C']);
          expect(error.dependencyChain.length).toBeGreaterThan(2);
        }
      });

      it('should not throw error for valid workflow without circular dependencies', () => {
        const connections: Connection[] = [
          { id: '1', sourceNodeId: 'A', sourceOutput: 'main', targetNodeId: 'B', targetInput: 'main' },
          { id: '2', sourceNodeId: 'B', sourceOutput: 'main', targetNodeId: 'C', targetInput: 'main' },
          { id: '3', sourceNodeId: 'A', sourceOutput: 'main', targetNodeId: 'D', targetInput: 'main' }
        ];

        expect(() => {
          resolver.validateAndPreventCircularDependencies(connections);
        }).not.toThrow();
      });
    });

    describe('validateNodeDependencies', () => {
      it('should throw MissingDependencyError for missing dependencies', () => {
        const nodeIds = ['A', 'B'];
        const connections: Connection[] = [
          { id: '1', sourceNodeId: 'C', sourceOutput: 'main', targetNodeId: 'A', targetInput: 'main' },
          { id: '2', sourceNodeId: 'D', sourceOutput: 'main', targetNodeId: 'B', targetInput: 'main' }
        ];

        expect(() => {
          resolver.validateNodeDependencies(nodeIds, connections);
        }).toThrow(MissingDependencyError);

        try {
          resolver.validateNodeDependencies(nodeIds, connections);
        } catch (error: any) {
          expect(error).toBeInstanceOf(MissingDependencyError);
          expect(error.flowErrorType).toBe(FlowExecutionErrorType.MISSING_DEPENDENCY);
          expect(error.affectedNodes).toContain('A');
          expect(error.dependencyChain).toContain('C');
          expect(error.suggestedResolution).toContain('Ensure all required upstream nodes');
        }
      });

      it('should not throw error when all dependencies exist', () => {
        const nodeIds = ['A', 'B', 'C'];
        const connections: Connection[] = [
          { id: '1', sourceNodeId: 'A', sourceOutput: 'main', targetNodeId: 'B', targetInput: 'main' },
          { id: '2', sourceNodeId: 'B', sourceOutput: 'main', targetNodeId: 'C', targetInput: 'main' }
        ];

        expect(() => {
          resolver.validateNodeDependencies(nodeIds, connections);
        }).not.toThrow();
      });
    });

    describe('validateExecutionSafety', () => {
      it('should throw InvalidFlowStateError for empty workflow', () => {
        const nodeIds: string[] = [];
        const connections: Connection[] = [];

        expect(() => {
          resolver.validateExecutionSafety(nodeIds, connections);
        }).toThrow(InvalidFlowStateError);

        try {
          resolver.validateExecutionSafety(nodeIds, connections, ['test']);
        } catch (error: any) {
          expect(error).toBeInstanceOf(InvalidFlowStateError);
          expect(error.flowErrorType).toBe(FlowExecutionErrorType.INVALID_FLOW_STATE);
          expect(error.message).toContain('Cannot execute workflow with no nodes');
          expect(error.executionPath).toEqual(['test']);
        }
      });

      it('should throw CircularDependencyError for self-referencing nodes', () => {
        const nodeIds = ['A', 'B'];
        const connections: Connection[] = [
          { id: '1', sourceNodeId: 'A', sourceOutput: 'main', targetNodeId: 'A', targetInput: 'main' },
          { id: '2', sourceNodeId: 'A', sourceOutput: 'main', targetNodeId: 'B', targetInput: 'main' }
        ];

        expect(() => {
          resolver.validateExecutionSafety(nodeIds, connections);
        }).toThrow(CircularDependencyError);

        try {
          resolver.validateExecutionSafety(nodeIds, connections);
        } catch (error: any) {
          expect(error).toBeInstanceOf(CircularDependencyError);
          expect(error.affectedNodes).toContain('A');
        }
      });

      it('should pass validation for valid workflow', () => {
        const nodeIds = ['A', 'B', 'C'];
        const connections: Connection[] = [
          { id: '1', sourceNodeId: 'A', sourceOutput: 'main', targetNodeId: 'B', targetInput: 'main' },
          { id: '2', sourceNodeId: 'B', sourceOutput: 'main', targetNodeId: 'C', targetInput: 'main' }
        ];

        expect(() => {
          resolver.validateExecutionSafety(nodeIds, connections, ['start', 'A']);
        }).not.toThrow();
      });

      it('should detect and prevent multiple types of issues', () => {
        const nodeIds = ['A', 'B'];
        const connections: Connection[] = [
          { id: '1', sourceNodeId: 'A', sourceOutput: 'main', targetNodeId: 'B', targetInput: 'main' },
          { id: '2', sourceNodeId: 'B', sourceOutput: 'main', targetNodeId: 'A', targetInput: 'main' },
          { id: '3', sourceNodeId: 'C', sourceOutput: 'main', targetNodeId: 'A', targetInput: 'main' }
        ];

        // Should catch circular dependency first (before missing dependency)
        expect(() => {
          resolver.validateExecutionSafety(nodeIds, connections);
        }).toThrow(CircularDependencyError);
      });
    });
  });
});
