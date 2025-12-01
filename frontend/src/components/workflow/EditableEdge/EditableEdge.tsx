import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BaseEdge,
  BuiltInNode,
  useReactFlow,
  useStore,
  type Edge,
  type EdgeProps,
  type XYPosition,
} from '@xyflow/react';

import { useWorkflowStore, useReactFlowUIStore } from '@/stores';
import { useReactFlowStyles } from '@/hooks/useReactFlowStyles';
import { EdgeButton } from '../edges/EdgeButton';
import { ControlPoint, type ControlPointData } from './ControlPoint';
import { getPath, getControlPoints } from './path';
import { Algorithm } from './constants';
import { ControlAnchor } from './ControlAnchor';
import {
  getPointsBasedOnNodePositions,
  getStepInitialPoints,
  OFFSET,
} from './path/step';

// Debounce delay for syncing to store (only sync after user stops dragging)
const STORE_SYNC_DELAY = 500;

const useIdsForInactiveControlPoints = (points: ControlPointData[]) => {
  const ids = useRef<string[]>([]);

  if (ids.current.length === points.length) {
    return points.map((point, i) =>
      point.id ? point : { ...point, id: ids.current[i] }
    );
  } else {
    ids.current = [];

    return points.map((point, i) => {
      if (!point.id) {
        const id = window.crypto.randomUUID();
        ids.current[i] = id;
        return { ...point, id: id };
      } else {
        ids.current[i] = point.id;
        return point;
      }
    });
  }
};

export type EditableEdge = Edge<{
  algorithm?: Algorithm;
  points: ControlPointData[];
  label?: string;
}>;

export function EditableEdgeComponent({
  id,
  selected,
  source,
  sourceX,
  sourceY,
  sourcePosition,
  sourceHandleId,
  target,
  targetX,
  targetY,
  targetPosition,
  targetHandleId,
  markerEnd,
  markerStart,
  style,
  data = { points: [] },
  ...delegated
}: EdgeProps<EditableEdge>) {
  const sourceOrigin: XYPosition = { x: sourceX, y: sourceY };
  const targetOrigin: XYPosition = { x: targetX, y: targetY };
  
  // Use shadcn design system colors as default
  const { edgeStyle } = useReactFlowStyles();
  
  // Use execution-aware color from style prop if available, otherwise use default
  // The style prop is set by useExecutionAwareEdges hook which handles execution states
  const color = (style?.stroke as string) || edgeStyle.stroke;
  const strokeWidth = (style?.strokeWidth as number) || 2;

  const [isHovered, setIsHovered] = useState(false);
  
  const { setEdges } = useReactFlow<BuiltInNode, EditableEdge>();
  const updateConnection = useWorkflowStore((state) => state.updateConnection);
  const editableConnectionsEnabled = useReactFlowUIStore((state) => state.editableConnections);
  
  // Get execution result for the source node to show output count
  const sourceNodeResult = useWorkflowStore((state) => 
    state.realTimeResults.get(source) || state.persistentNodeResults.get(source)
  );
  
  // Calculate item count from output data - prioritize actual array count
  const itemCount = useMemo(() => {
    if (!sourceNodeResult?.data) {
      return null;
    }
    
    const outputData = sourceNodeResult.data;
    const handleId = sourceHandleId || 'main';
    
    // First priority: Check if the specific handle has an array (most accurate)
    if (outputData[handleId] && Array.isArray(outputData[handleId])) {
      return outputData[handleId].length;
    }
    
    // Second priority: Check if output data itself is an array
    if (Array.isArray(outputData)) {
      return outputData.length;
    }
    
    // Third priority: Check for common data property patterns
    if (outputData && typeof outputData === 'object') {
      if (Array.isArray(outputData.items)) {
        return outputData.items.length;
      }
      if (Array.isArray(outputData.data)) {
        return outputData.data.length;
      }
      if (Array.isArray(outputData.results)) {
        return outputData.results.length;
      }
    }
    
    return null;
  }, [sourceNodeResult, sourceHandleId]);

  const shouldShowPoints = useStore((store) => {
    const sourceNode = store.nodeLookup.get(source)!;
    const targetNode = store.nodeLookup.get(target)!;

    return editableConnectionsEnabled && (selected || sourceNode.selected || targetNode.selected);
  });
  
  const handleMouseEnter = useCallback(() => setIsHovered(true), []);
  const handleMouseLeave = useCallback(() => setIsHovered(false), []);

  const initialStepPoints = useMemo(
    () =>
      getStepInitialPoints({
        source: { x: sourceX, y: sourceY },
        target: { x: targetX, y: targetY },
        offset: OFFSET,
        sourcePosition,
        targetPosition,
      }).map((point, index) => ({ ...point, id: `${index}` })),
    [sourcePosition, sourceX, sourceY, targetPosition, targetX, targetY]
  );

  const isStepAlgorithm = data.algorithm === Algorithm.Step;

  /**
   * We calculate the modified points based on the node's movement using getPointsBasedOnNodePositions in case
   * of a step edge.
   */
  const updatedPointsBasedOnNodeMovement = useMemo(() => {
    if (!isStepAlgorithm) return data.points;
    return getPointsBasedOnNodePositions({
      points: data.points,
      source: { x: sourceX, y: sourceY },
      target: { x: targetX, y: targetY },
      sides: { fromSide: sourcePosition, toSide: targetPosition },
    });
  }, [
    isStepAlgorithm,
    data.points,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  ]);

  /**
   * We assign these modified points to a ref and then use that ref inside setControlPoints instead of directly using updatedPointsBasedOnNodeMovement
   * to avoid unnecessary reinitializations of setControlPoints + other places where it is being used.
   * */
  const updatedPointsRef = useRef<ControlPointData[]>([]);
  updatedPointsRef.current = updatedPointsBasedOnNodeMovement;

  // Ref to store the latest points for debounced sync
  const pendingPointsRef = useRef<ControlPointData[] | null>(null);
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, []);

  const setControlPoints = useCallback(
    (update: (points: ControlPointData[]) => ControlPointData[]) => {
      setEdges((edges) => {
        const updatedEdges = edges.map((e) => {
          if (e.id !== id) return e;
          if (!isEditableEdge(e)) return e;

          let points: ControlPointData[] = [];
          if (isStepAlgorithm) points = updatedPointsRef.current;
          else points = e.data?.points ?? [];

          const newPoints = update(points);
          const updatedData = { ...e?.data, points: newPoints };

          // Store the new points for debounced sync to workflow store
          pendingPointsRef.current = newPoints;

          return { ...e, data: updatedData };
        });
        
        return updatedEdges;
      });
      
      // Debounce the sync to workflow store
      // This prevents performance issues from updating store on every mouse move
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
      
      syncTimeoutRef.current = setTimeout(() => {
        if (pendingPointsRef.current) {
          console.log('🔗 [EditableEdge] Syncing control points to store:', {
            edgeId: id,
            pointsCount: pendingPointsRef.current.length,
            points: pendingPointsRef.current,
          });
          updateConnection(id, { controlPoints: pendingPointsRef.current });
          pendingPointsRef.current = null;
        }
      }, STORE_SYNC_DELAY);
    },
    [setEdges, id, isStepAlgorithm, updateConnection]
  );

  const pathPoints = [
    sourceOrigin,
    ...updatedPointsBasedOnNodeMovement,
    targetOrigin,
  ];
  const controlPoints = getControlPoints({
    points: pathPoints,
    algorithm: data.algorithm,
    sides: {
      fromSide: sourcePosition,
      toSide: targetPosition,
    },
    initialStepPoints,
  });
  const path = getPath({
    points: pathPoints,
    algorithm: data.algorithm,
    sides: {
      fromSide: sourcePosition,
      toSide: targetPosition,
    },
    initialStepPoints,
  });

  const controlPointsWithIds = useIdsForInactiveControlPoints(controlPoints);

  // Calculate label position near source node output
  const labelPosition = useMemo(() => {
    // Position label 25% along the edge from source to target
    const t = 0.25;
    const x = sourceX + (targetX - sourceX) * t;
    const y = sourceY + (targetY - sourceY) * t;
    
    return { x, y };
  }, [sourceX, sourceY, targetX, targetY]);
  
  // Calculate button position (center of edge)
  const buttonPosition = useMemo(() => {
    const centerX = (sourceX + targetX) / 2;
    const centerY = (sourceY + targetY) / 2;
    
    return { x: centerX, y: centerY };
  }, [sourceX, sourceY, targetX, targetY]);

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        {...delegated}
        markerStart={markerStart}
        markerEnd={markerEnd}
        style={{
          ...style,
          strokeWidth,
          stroke: color,
        }}
      />

      {/* Invisible wider path for hover detection */}
      <path
        d={path}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{ cursor: 'pointer', pointerEvents: 'all' }}
      />

      {/* Item count label with background - very small and compact */}
      {itemCount !== null && (() => {
        const labelText = itemCount === 1 ? '1 item' : `${itemCount} items`;
        // Estimate width based on text length (roughly 3.5px per character for 6px font)
        const textWidth = labelText.length * 3.5;
        const padding = 4;
        const rectWidth = textWidth + padding * 2;
        const rectHeight = 10;
        
        return (
          <g transform={`translate(${labelPosition.x}, ${labelPosition.y})`}>
            <rect
              x={-rectWidth / 2}
              y={-rectHeight / 2}
              width={rectWidth}
              height={rectHeight}
              rx={5}
              fill="hsl(var(--background))"
              stroke="hsl(var(--border))"
              strokeWidth={0.5}
              opacity={0.95}
            />
            <text
              x={0}
              y={0}
              textAnchor="middle"
              dominantBaseline="middle"
              style={{
                fontSize: '6px',
                fontWeight: 500,
                fill: 'hsl(var(--foreground))',
                pointerEvents: 'none',
                userSelect: 'none',
              }}
            >
              {labelText}
            </text>
          </g>
        );
      })()}

      {/* Add/Delete node button on hover */}
      {isHovered && (
        <EdgeButton
          x={buttonPosition.x}
          y={buttonPosition.y}
          id={id}
          source={source}
          target={target}
          sourceHandleId={sourceHandleId}
          targetHandleId={targetHandleId}
          algorithm={data.algorithm}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        />
      )}

      {shouldShowPoints &&
        !isStepAlgorithm &&
        controlPointsWithIds.map((point, index) => (
          <ControlPoint
            key={point.id}
            index={index}
            setControlPoints={setControlPoints}
            color={color}
            {...point}
          />
        ))}

      {/* Step Edge requires different logic for control point addition/movement/deletion so have made a seperate component for this */}
      {shouldShowPoints &&
        isStepAlgorithm &&
        controlPointsWithIds.map((point, index) => (
          <ControlAnchor
            key={point.id}
            index={index}
            setControlPoints={setControlPoints}
            color={color}
            direction={point.direction}
            initialStepPoints={
              initialStepPoints as unknown as ControlPointData[]
            }
            {...point}
          />
        ))}
    </>
  );
}

const isEditableEdge = (edge: Edge): edge is EditableEdge =>
  edge.type === 'editable-edge';
