import { Connection } from '../types/database';
import { logger } from '../utils/logger';
import { 
  CircularDependencyError, 
  MissingDependencyError, 
  InvalidFlowStateError,
  FlowExecutionErrorType 
} from '../utils/errors/FlowExecutionError';

export interface CircularDependency {
  nodes: string[];
  path: string[];
  severity: 'warning' | 'error';
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  circularDependencies: CircularDependency[];
  unreachableNodes: string[];
  orphanedNodes: string[];
}

/**
 * DependencyResolver analyzes workflow connections to determine node execution order
 * and validate flow structure for proper cascade execution.
 */
export class DependencyResolver {
  /**
   * Get nodes that are ready for execution based on completed dependencies
   */
  getExecutableNodes(
    allNodeIds: string[],
    connections: Connection[],
    completedNodes: Set<string>
  ): string[] {
    const executableNodes: string[] = [];

    for (const nodeId of allNodeIds) {
      if (completedNodes.has(nodeId)) {
        continue; // Already completed
      }

      const dependencies = this.getDependencies(nodeId, connections);
      
      // Node is executable if all its dependencies are completed
      const allDependenciesSatisfied = dependencies.every(depNodeId => 
        completedNodes.has(depNodeId)
      );

      if (allDependenciesSatisfied) {
        executableNodes.push(nodeId);
      }
    }

    logger.debug('Found executable nodes', { 
      executableNodes, 
      completedNodes: Array.from(completedNodes) 
    });

    return executableNodes;
  }

  /**
   * Get all direct dependencies (upstream nodes) for a given node
   */
  getDependencies(nodeId: string, connections: Connection[]): string[] {
    const dependencies = connections
      .filter(conn => conn.targetNodeId === nodeId)
      .map(conn => conn.sourceNodeId);

    // Remove duplicates in case there are multiple connections from the same source
    return Array.from(new Set(dependencies));
  }

  /**
   * Get all direct dependents (downstream nodes) for a given node
   */
  getDownstreamNodes(nodeId: string, connections: Connection[]): string[] {
    const downstreamNodes = connections
      .filter(conn => conn.sourceNodeId === nodeId)
      .map(conn => conn.targetNodeId);

    // Remove duplicates in case there are multiple connections to the same target
    return Array.from(new Set(downstreamNodes));
  }

  /**
   * Get all nodes that are transitively dependent on a given node
   */
  getAllDownstreamNodes(nodeId: string, connections: Connection[]): string[] {
    const visited = new Set<string>();
    const downstreamNodes = new Set<string>();

    const traverse = (currentNodeId: string) => {
      if (visited.has(currentNodeId)) {
        return;
      }
      visited.add(currentNodeId);

      const directDownstream = this.getDownstreamNodes(currentNodeId, connections);
      for (const downstreamNodeId of directDownstream) {
        if (downstreamNodeId !== nodeId) { // Don't include the starting node
          downstreamNodes.add(downstreamNodeId);
          traverse(downstreamNodeId);
        }
      }
    };

    traverse(nodeId);
    return Array.from(downstreamNodes);
  }

  /**
   * Get all nodes that a given node transitively depends on
   */
  getAllDependencies(nodeId: string, connections: Connection[]): string[] {
    const visited = new Set<string>();
    const dependencies = new Set<string>();

    const traverse = (currentNodeId: string) => {
      if (visited.has(currentNodeId)) {
        return;
      }
      visited.add(currentNodeId);

      const directDependencies = this.getDependencies(currentNodeId, connections);
      for (const depNodeId of directDependencies) {
        if (depNodeId !== nodeId) { // Don't include the starting node
          dependencies.add(depNodeId);
          traverse(depNodeId);
        }
      }
    };

    traverse(nodeId);
    return Array.from(dependencies);
  }

  /**
   * Detect circular dependencies in the workflow
   */
  detectCircularDependencies(connections: Connection[]): CircularDependency[] {
    const circularDependencies: CircularDependency[] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const allNodes = this.getAllNodesFromConnections(connections);

    const detectCycle = (nodeId: string, path: string[]): boolean => {
      if (recursionStack.has(nodeId)) {
        // Found a cycle
        const cycleStartIndex = path.indexOf(nodeId);
        const cyclePath = path.slice(cycleStartIndex);
        cyclePath.push(nodeId); // Complete the cycle

        circularDependencies.push({
          nodes: Array.from(new Set(cyclePath)),
          path: cyclePath,
          severity: 'error'
        });

        logger.warn('Circular dependency detected', { 
          nodes: cyclePath,
          path: cyclePath 
        });

        return true;
      }

      if (visited.has(nodeId)) {
        return false;
      }

      visited.add(nodeId);
      recursionStack.add(nodeId);
      path.push(nodeId);

      const dependencies = this.getDependencies(nodeId, connections);
      for (const depNodeId of dependencies) {
        if (detectCycle(depNodeId, [...path])) {
          return true;
        }
      }

      recursionStack.delete(nodeId);
      return false;
    };

    // Check each node for cycles
    for (const nodeId of allNodes) {
      if (!visited.has(nodeId)) {
        detectCycle(nodeId, []);
      }
    }

    return circularDependencies;
  }

  /**
   * Validate workflow for circular dependencies and throw appropriate errors
   * This method prevents infinite execution loops by detecting and rejecting circular dependencies
   */
  validateAndPreventCircularDependencies(connections: Connection[], executionPath: string[] = []): void {
    const circularDependencies = this.detectCircularDependencies(connections);
    
    if (circularDependencies.length > 0) {
      const firstCircular = circularDependencies[0];
      
      logger.error('Circular dependency validation failed', {
        circularDependencies: circularDependencies.length,
        firstCircular,
        executionPath
      });

      throw new CircularDependencyError(
        firstCircular.nodes,
        firstCircular.path,
        executionPath
      );
    }
  }

  /**
   * Validate that all node dependencies exist and are properly connected
   */
  validateNodeDependencies(nodeIds: string[], connections: Connection[]): void {
    const nodeIdSet = new Set(nodeIds);
    const missingDependencies: { nodeId: string; missing: string[] }[] = [];

    for (const nodeId of nodeIds) {
      const dependencies = this.getDependencies(nodeId, connections);
      const missing = dependencies.filter(depId => !nodeIdSet.has(depId));
      
      if (missing.length > 0) {
        missingDependencies.push({ nodeId, missing });
      }
    }

    if (missingDependencies.length > 0) {
      const firstMissing = missingDependencies[0];
      
      logger.error('Missing dependencies validation failed', {
        missingDependencies,
        firstMissing
      });

      throw new MissingDependencyError(
        firstMissing.nodeId,
        firstMissing.missing
      );
    }
  }

  /**
   * Comprehensive validation to prevent infinite execution loops
   */
  validateExecutionSafety(nodeIds: string[], connections: Connection[], executionPath: string[] = []): void {
    // Check for circular dependencies first
    this.validateAndPreventCircularDependencies(connections, executionPath);
    
    // Validate all dependencies exist
    this.validateNodeDependencies(nodeIds, connections);
    
    // Additional safety checks
    if (nodeIds.length === 0) {
      throw new InvalidFlowStateError('Cannot execute workflow with no nodes', [], executionPath);
    }

    // Check for self-referencing connections
    const selfReferencingConnections = connections.filter(conn => conn.sourceNodeId === conn.targetNodeId);
    if (selfReferencingConnections.length > 0) {
      const selfRefNodes = selfReferencingConnections.map(conn => conn.sourceNodeId);
      throw new CircularDependencyError(
        selfRefNodes,
        selfRefNodes,
        executionPath
      );
    }

    logger.debug('Execution safety validation passed', {
      nodeCount: nodeIds.length,
      connectionCount: connections.length,
      executionPath
    });
  }

  /**
   * Validate the execution path and workflow structure
   */
  validateExecutionPath(nodeIds: string[], connections: Connection[]): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Detect circular dependencies
    const circularDependencies = this.detectCircularDependencies(connections);
    if (circularDependencies.length > 0) {
      errors.push(`Found ${circularDependencies.length} circular dependencies`);
    }

    // Find unreachable nodes (nodes with no path from any trigger/start node)
    const unreachableNodes = this.findUnreachableNodes(nodeIds, connections);
    if (unreachableNodes.length > 0) {
      warnings.push(`Found ${unreachableNodes.length} unreachable nodes: ${unreachableNodes.join(', ')}`);
    }

    // Find orphaned nodes (nodes with no connections)
    const orphanedNodes = this.findOrphanedNodes(nodeIds, connections);
    if (orphanedNodes.length > 0) {
      warnings.push(`Found ${orphanedNodes.length} orphaned nodes: ${orphanedNodes.join(', ')}`);
    }

    // Validate connection integrity
    const connectionErrors = this.validateConnections(nodeIds, connections);
    errors.push(...connectionErrors);

    const valid = errors.length === 0 && circularDependencies.length === 0;

    return {
      valid,
      errors,
      warnings,
      circularDependencies,
      unreachableNodes,
      orphanedNodes
    };
  }

  /**
   * Get topological sort order for nodes (dependency-first ordering)
   */
  getTopologicalOrder(nodeIds: string[], connections: Connection[]): string[] {
    const visited = new Set<string>();
    const tempMark = new Set<string>();
    const result: string[] = [];

    const visit = (nodeId: string) => {
      if (tempMark.has(nodeId)) {
        throw new Error(`Circular dependency detected involving node: ${nodeId}`);
      }
      
      if (visited.has(nodeId)) {
        return;
      }

      tempMark.add(nodeId);
      
      const dependencies = this.getDependencies(nodeId, connections);
      for (const depNodeId of dependencies) {
        visit(depNodeId);
      }

      tempMark.delete(nodeId);
      visited.add(nodeId);
      result.push(nodeId);
    };

    // Visit all nodes
    for (const nodeId of nodeIds) {
      if (!visited.has(nodeId)) {
        visit(nodeId);
      }
    }

    return result;
  }

  /**
   * Find nodes that can be executed in parallel (no dependencies between them)
   */
  getParallelExecutionGroups(nodeIds: string[], connections: Connection[]): string[][] {
    const groups: string[][] = [];
    const processed = new Set<string>();
    const completedNodes = new Set<string>();

    while (processed.size < nodeIds.length) {
      const executableNodes = this.getExecutableNodes(nodeIds, connections, completedNodes);
      const currentGroup = executableNodes.filter(nodeId => !processed.has(nodeId));

      if (currentGroup.length === 0) {
        // No more executable nodes - might be due to circular dependencies
        const remaining = nodeIds.filter(nodeId => !processed.has(nodeId));
        if (remaining.length > 0) {
          logger.warn('Unable to process remaining nodes, possible circular dependency', { 
            remaining 
          });
          break;
        }
      }

      if (currentGroup.length > 0) {
        groups.push(currentGroup);
        currentGroup.forEach(nodeId => {
          processed.add(nodeId);
          completedNodes.add(nodeId);
        });
      }
    }

    return groups;
  }

  private getAllNodesFromConnections(connections: Connection[]): string[] {
    const nodes = new Set<string>();
    
    for (const connection of connections) {
      nodes.add(connection.sourceNodeId);
      nodes.add(connection.targetNodeId);
    }

    return Array.from(nodes);
  }

  private findUnreachableNodes(nodeIds: string[], connections: Connection[]): string[] {
    // Find nodes that have no incoming connections (potential start nodes)
    const nodesWithIncoming = new Set(connections.map(conn => conn.targetNodeId));
    const startNodes = nodeIds.filter(nodeId => !nodesWithIncoming.has(nodeId));

    if (startNodes.length === 0) {
      // If no clear start nodes, all nodes might be unreachable or in cycles
      return [];
    }

    // Find all reachable nodes from start nodes
    const reachable = new Set<string>();
    const visited = new Set<string>();

    const traverse = (nodeId: string) => {
      if (visited.has(nodeId)) {
        return;
      }
      visited.add(nodeId);
      reachable.add(nodeId);

      const downstream = this.getDownstreamNodes(nodeId, connections);
      for (const downstreamNodeId of downstream) {
        traverse(downstreamNodeId);
      }
    };

    // Traverse from all start nodes
    for (const startNode of startNodes) {
      traverse(startNode);
    }

    // Return nodes that are not reachable
    return nodeIds.filter(nodeId => !reachable.has(nodeId));
  }

  private findOrphanedNodes(nodeIds: string[], connections: Connection[]): string[] {
    const connectedNodes = new Set<string>();
    
    for (const connection of connections) {
      connectedNodes.add(connection.sourceNodeId);
      connectedNodes.add(connection.targetNodeId);
    }

    return nodeIds.filter(nodeId => !connectedNodes.has(nodeId));
  }

  private validateConnections(nodeIds: string[], connections: Connection[]): string[] {
    const errors: string[] = [];
    const nodeIdSet = new Set(nodeIds);

    for (const connection of connections) {
      if (!nodeIdSet.has(connection.sourceNodeId)) {
        errors.push(`Connection references non-existent source node: ${connection.sourceNodeId}`);
      }
      
      if (!nodeIdSet.has(connection.targetNodeId)) {
        errors.push(`Connection references non-existent target node: ${connection.targetNodeId}`);
      }

      if (connection.sourceNodeId === connection.targetNodeId) {
        errors.push(`Self-referencing connection detected on node: ${connection.sourceNodeId}`);
      }
    }

    return errors;
  }
}
