import { devtools } from "zustand/middleware";
import { createWithEqualityFn } from "zustand/traditional";
import { customNodeService } from "../services/customNode";
import {
  CustomNodeActions,
  CustomNodeState,
  InstallOptions,
  InstallResult,
  NodeCompilationResult,
  NodeLoadResult,
  NodePackageMetadata,
  NodePackageValidationResult,
  NodeSearchFilters,
  NodeSearchResult,
  NodeTemplateOptions,
  PublishOptions,
  PublishResult,
  TemplateGenerationResult,
  UpdateResult,
} from "../types/customNode";

interface CustomNodeStore extends CustomNodeState, CustomNodeActions { }

export const useCustomNodeStore = createWithEqualityFn<CustomNodeStore>()(
  devtools(
    (set, get) => ({
      // State
      packages: [],
      loading: false,
      error: null,
      searchResults: null,
      searchLoading: false,
      selectedPackage: null,

      // Actions
      loadPackages: async () => {
        set({ loading: true, error: null });
        try {
          const packages = await customNodeService.getLoadedPackages();
          set({ packages, loading: false });
        } catch (error) {
          set({
            error:
              error instanceof Error
                ? error.message
                : "Failed to load packages",
            loading: false,
          });
        }
      },

      validatePackage: async (
        packagePath: string
      ): Promise<NodePackageValidationResult> => {
        set({ error: null });
        try {
          return await customNodeService.validatePackage(packagePath);
        } catch (error) {
          const errorMessage =
            error instanceof Error
              ? error.message
              : "Failed to validate package";
          set({ error: errorMessage });
          throw error;
        }
      },

      loadPackage: async (packagePath: string): Promise<NodeLoadResult> => {
        set({ error: null });
        try {
          const result = await customNodeService.loadPackage(packagePath);
          if (result.success) {
            // Refresh packages list
            await get().loadPackages();
          }
          return result;
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Failed to load package";
          set({ error: errorMessage });
          throw error;
        }
      },

      unloadPackage: async (packageName: string): Promise<void> => {
        set({ error: null });
        try {
          await customNodeService.unloadPackage(packageName);
          // Refresh packages list
          await get().loadPackages();
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Failed to unload package";
          set({ error: errorMessage });
          throw error;
        }
      },

      reloadPackage: async (packageName: string): Promise<NodeLoadResult> => {
        set({ error: null });
        try {
          const result = await customNodeService.reloadPackage(packageName);
          if (result.success) {
            // Refresh packages list
            await get().loadPackages();
          }
          return result;
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Failed to reload package";
          set({ error: errorMessage });
          throw error;
        }
      },

      generatePackage: async (
        options: NodeTemplateOptions,
        outputPath?: string
      ): Promise<TemplateGenerationResult> => {
        set({ error: null });
        try {
          return await customNodeService.generatePackage(options, outputPath);
        } catch (error) {
          const errorMessage =
            error instanceof Error
              ? error.message
              : "Failed to generate package";
          set({ error: errorMessage });
          throw error;
        }
      },

      generatePackageZip: async (
        options: NodeTemplateOptions
      ): Promise<void> => {
        set({ error: null });
        try {
          await customNodeService.generatePackageZip(options);
        } catch (error) {
          const errorMessage =
            error instanceof Error
              ? error.message
              : "Failed to generate package zip";
          set({ error: errorMessage });
          throw error;
        }
      },

      compilePackage: async (
        packagePath: string
      ): Promise<NodeCompilationResult> => {
        set({ error: null });
        try {
          return await customNodeService.compilePackage(packagePath);
        } catch (error) {
          const errorMessage =
            error instanceof Error
              ? error.message
              : "Failed to compile package";
          set({ error: errorMessage });
          throw error;
        }
      },

      searchMarketplace: async (
        filters: NodeSearchFilters
      ): Promise<NodeSearchResult> => {
        set({ searchLoading: true, error: null });
        try {
          const results = await customNodeService.searchMarketplace(filters);
          set({ searchResults: results, searchLoading: false });
          return results;
        } catch (error) {
          const errorMessage =
            error instanceof Error
              ? error.message
              : "Failed to search marketplace";
          set({ error: errorMessage, searchLoading: false });
          throw error;
        }
      },

      getPackageInfo: async (
        packageId: string
      ): Promise<NodePackageMetadata> => {
        set({ error: null });
        try {
          return await customNodeService.getPackageInfo(packageId);
        } catch (error) {
          const errorMessage =
            error instanceof Error
              ? error.message
              : "Failed to get package info";
          set({ error: errorMessage });
          throw error;
        }
      },

      installPackage: async (
        packageId: string,
        options?: InstallOptions
      ): Promise<InstallResult> => {
        set({ error: null });
        try {
          const result = await customNodeService.installPackage(
            packageId,
            options
          );
          if (result.success) {
            // Refresh packages list
            await get().loadPackages();
          }
          return result;
        } catch (error) {
          const errorMessage =
            error instanceof Error
              ? error.message
              : "Failed to install package";
          set({ error: errorMessage });
          throw error;
        }
      },

      updatePackage: async (packageId: string): Promise<UpdateResult> => {
        set({ error: null });
        try {
          const result = await customNodeService.updatePackage(packageId);
          if (result.success) {
            // Refresh packages list
            await get().loadPackages();
          }
          return result;
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Failed to update package";
          set({ error: errorMessage });
          throw error;
        }
      },

      publishPackage: async (
        options: PublishOptions
      ): Promise<PublishResult> => {
        set({ error: null });
        try {
          return await customNodeService.publishPackage(options);
        } catch (error) {
          const errorMessage =
            error instanceof Error
              ? error.message
              : "Failed to publish package";
          set({ error: errorMessage });
          throw error;
        }
      },

      clearError: () => {
        set({ error: null });
      },

      setSelectedPackage: (pkg: NodePackageMetadata | null) => {
        set({ selectedPackage: pkg });
      },
    }),
    {
      name: "custom-node-store",
    }
  )
);
