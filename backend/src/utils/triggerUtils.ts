/**
 * Trigger-related utility functions
 */

import { convertScheduleSettings } from "./scheduleUtils";

/**
 * Extract triggers from trigger nodes in the workflow
 */
export function extractTriggersFromNodes(nodes: any[], nodeService: any): any[] {
  if (!Array.isArray(nodes)) {
    return [];
  }

  if (!nodeService) {
    console.warn("NodeService not available, cannot extract triggers");
    return [];
  }

  return nodes
    .filter((node) => {
      const nodeDef = nodeService.getNodeDefinitionSync(node.type);
      return nodeDef?.triggerType !== undefined;
    })
    .map((node) => {
      const nodeDef = nodeService.getNodeDefinitionSync(node.type);
      const triggerType = nodeDef?.triggerType;
      
      const baseSettings = {
        description: node.parameters?.description || `${triggerType} trigger`,
        ...node.parameters,
      };

      // Convert schedule settings if this is a schedule trigger
      const settings = triggerType === 'schedule'
        ? convertScheduleSettings(baseSettings)
        : baseSettings;
      
      return {
        id: `trigger-${node.id}`,
        type: triggerType,
        nodeId: node.id,
        active: !node.disabled,
        settings,
      };
    });
}

/**
 * Normalize triggers to ensure they have the active property set
 */
export function normalizeTriggers(triggers: any[]): any[] {
  if (!Array.isArray(triggers)) {
    return [];
  }

  return triggers.map((trigger) => ({
    ...trigger,
    // Set active to true if not explicitly set
    active: trigger.active !== undefined ? trigger.active : true,
  }));
}

/**
 * Prepare triggers for saving - extract from nodes if needed, convert schedules, and normalize
 */
export function prepareTriggersForSave(
  data: { nodes?: any[]; triggers?: any[] },
  nodeService: any
): any[] | undefined {
  let triggersToSave = data.triggers;

  // Extract triggers from nodes if not provided
  if (data.nodes && (!data.triggers || data.triggers.length === 0)) {
    triggersToSave = extractTriggersFromNodes(data.nodes, nodeService);
  } else if (triggersToSave) {
    // Convert schedule settings for triggers sent from frontend
    triggersToSave = triggersToSave.map((trigger: any) => {
      if (trigger.type === 'schedule' && trigger.settings) {
        return {
          ...trigger,
          settings: convertScheduleSettings(trigger.settings),
        };
      }
      return trigger;
    });
  }

  // Normalize triggers if they exist
  if (triggersToSave) {
    return normalizeTriggers(triggersToSave);
  }

  return undefined;
}
