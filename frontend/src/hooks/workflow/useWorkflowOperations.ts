import { workflowService } from "@/services";
import { useAuthStore, useWorkflowStore, useNodeTypes } from "@/stores";
import { Workflow } from "@/types";
import { extractTriggersFromNodes } from "@/utils/triggerUtils";
import { useCallback, useMemo } from "react";
import { toast } from "sonner";

/**
 * Custom hook for workflow operations (save, import/export, validation)
 * Encapsulates workflow CRUD operations and file handling
 */
export function useWorkflowOperations() {
  // Optimize store subscriptions - only get what we need
  const workflow = useWorkflowStore((state) => state.workflow);
  const workflowTitle = useWorkflowStore((state) => state.workflowTitle);
  const isTitleDirty = useWorkflowStore((state) => state.isTitleDirty);
  const isDirty = useWorkflowStore((state) => state.isDirty);
  const saveTitle = useWorkflowStore((state) => state.saveTitle);
  const setWorkflow = useWorkflowStore((state) => state.setWorkflow);
  const setDirty = useWorkflowStore((state) => state.setDirty);
  const validateWorkflow = useWorkflowStore((state) => state.validateWorkflow);
  const exportWorkflow = useWorkflowStore((state) => state.exportWorkflow);
  const importWorkflow = useWorkflowStore((state) => state.importWorkflow);
  const isExporting = useWorkflowStore((state) => state.isExporting);
  const isImporting = useWorkflowStore((state) => state.isImporting);

  const { user } = useAuthStore();
  const { activeNodeTypes } = useNodeTypes();

  // Memoize derived values
  const canSave = useMemo(() => Boolean(workflow && user), [workflow, user]);
  const hasUnsavedChanges = useMemo(
    () => isDirty || isTitleDirty,
    [isDirty, isTitleDirty]
  );

  // Helper to build workflow data (DRY principle)
  const buildWorkflowData = useCallback(
    (currentWorkflow: Workflow) => {
      const triggers = extractTriggersFromNodes(currentWorkflow.nodes, activeNodeTypes);
      
      return {
        name: workflowTitle || currentWorkflow.name,
        description: currentWorkflow.description,
        nodes: currentWorkflow.nodes,
        connections: currentWorkflow.connections,
        triggers: triggers,
        settings: currentWorkflow.settings,
        active: currentWorkflow.active,
        category: currentWorkflow.category || undefined,
        tags: currentWorkflow.tags,
        teamId: currentWorkflow.teamId !== undefined && currentWorkflow.teamId !== null ? currentWorkflow.teamId : undefined,
      };
    },
    [workflowTitle, activeNodeTypes]
  );

  // Save workflow function
  const saveWorkflow = useCallback(async () => {
    if (!workflow || !user) return false;

    try {
      // Save title changes first if needed
      if (isTitleDirty) {
        saveTitle();
      }

      // Build workflow data once
      const workflowData = buildWorkflowData(workflow);
      const isNewWorkflow = workflow.id === "new";
      
      // Debug: Log connections with control points
      console.log('💾 [SaveWorkflow] Saving workflow with connections:', {
        connectionsCount: workflowData.connections.length,
        connectionsWithControlPoints: workflowData.connections.filter((c: any) => c.controlPoints?.length > 0).length,
        connections: workflowData.connections.map((c: any) => ({
          id: c.id,
          hasControlPoints: !!c.controlPoints,
          controlPointsCount: c.controlPoints?.length || 0,
        })),
      });

      // Save workflow (create or update)
      const savedWorkflow = isNewWorkflow
        ? await workflowService.createWorkflow(workflowData)
        : await workflowService.updateWorkflow(workflow.id, workflowData);

      setWorkflow(savedWorkflow);
      setDirty(false);

      // Update URL for new workflows
      if (isNewWorkflow) {
        window.history.replaceState(
          null,
          "",
          `/workflows/${savedWorkflow.id}/edit`
        );
      }

      toast.success(
        isNewWorkflow
          ? "Workflow created successfully"
          : "Workflow saved successfully"
      );
      return true;
    } catch (error: any) {
      console.error("Failed to save workflow:", error);

      // Extract error message from API response and format it
      let errorMessage = "Failed to save workflow. Please try again.";

      if (error?.message) {
        // Check if the message already starts with "Failed to save"
        if (error.message.toLowerCase().includes("failed to save")) {
          errorMessage = error.message;
        } else {
          // Prefix with "Failed to save: " and add the specific reason
          errorMessage = `Failed to save: ${error.message}`;
        }
      } else if (error instanceof Error) {
        errorMessage = `Failed to save: ${error.message}`;
      }

      // Show the error message to the user
      toast.error(errorMessage);
      return false;
    }
  }, [
    workflow,
    user,
    isTitleDirty,
    saveTitle,
    buildWorkflowData,
    setWorkflow,
    setDirty,
  ]);

  // Validate workflow function
  const validateAndShowResult = useCallback(() => {
    const result = validateWorkflow();
    if (result.isValid) {
      toast.success("Workflow is valid!");
    } else {
      toast.error(`Workflow has errors: ${result.errors.join(", ")}`);
    }
    return result;
  }, [validateWorkflow]);

  // Export workflow function
  const handleExport = useCallback(async () => {
    try {
      await exportWorkflow();
      toast.success("Workflow exported successfully");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Export failed";
      toast.error(errorMessage);
    }
  }, [exportWorkflow]);

  // Import workflow function
  const handleImport = useCallback(
    async (file: File) => {
      try {
        await importWorkflow(file);
        toast.success("Workflow imported successfully");
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Import failed";
        toast.error(errorMessage);
      }
    },
    [importWorkflow]
  );

  return {
    // Core operations
    saveWorkflow,
    validateAndShowResult,
    handleExport,
    handleImport,

    // State
    isExporting,
    isImporting,

    // Derived state (memoized)
    canSave,
    hasUnsavedChanges,
  };
}
