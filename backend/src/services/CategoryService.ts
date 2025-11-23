import { PrismaClient } from "@prisma/client";
import { AppError } from "../middleware/errorHandler";

export class CategoryService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async getAvailableCategories(userId: string) {
    try {
      // Get categories from the database
      const categories = await this.prisma.category.findMany({
        where: {
          active: true,
        },
        select: {
          name: true,
          displayName: true,
          description: true,
          color: true,
          icon: true,
        },
        orderBy: {
          name: "asc",
        },
      });

      // If no categories found in database, return some defaults
      if (categories.length === 0) {
        return [
          "automation",
          "integration",
          "communication",
          "data-processing",
          "other",
        ];
      }

      // Return just the category names for the API response
      return categories.map((category) => category.name);
    } catch (error) {
      console.error("Error getting available categories:", error);
      throw new AppError(
        "Failed to get available categories",
        500,
        "CATEGORIES_FETCH_ERROR"
      );
    }
  }

  async createCategory(
    userId: string,
    categoryData: {
      name: string;
      displayName: string;
      description?: string;
      color?: string;
      icon?: string;
    }
  ) {
    try {
      // Check if category already exists
      const existingCategory = await this.prisma.category.findUnique({
        where: { name: categoryData.name },
      });

      if (existingCategory) {
        throw new AppError(
          "Category with this name already exists",
          400,
          "CATEGORY_EXISTS"
        );
      }

      // Create the category
      const category = await this.prisma.category.create({
        data: {
          name: categoryData.name.toLowerCase().replace(/\s+/g, "-"),
          displayName: categoryData.displayName,
          description: categoryData.description,
          color: categoryData.color || "#6B7280",
          icon: categoryData.icon || "📁",
          active: true,
        },
      });

      return category;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error("Error creating category:", error);
      throw new AppError(
        "Failed to create category",
        500,
        "CATEGORY_CREATE_ERROR"
      );
    }
  }

  async deleteCategory(userId: string, categoryName: string) {
    try {
      // Check if category exists
      const category = await this.prisma.category.findUnique({
        where: { name: categoryName },
      });

      if (!category) {
        throw new AppError("Category not found", 404, "CATEGORY_NOT_FOUND");
      }

      // Check if any workflows are using this category
      const workflowsWithCategory = await this.prisma.workflow.findFirst({
        where: {
          category: categoryName,
          userId: userId,
        },
      });

      if (workflowsWithCategory) {
        throw new AppError(
          "Cannot delete category that is being used by workflows",
          400,
          "CATEGORY_IN_USE"
        );
      }

      // Delete the category
      await this.prisma.category.delete({
        where: { name: categoryName },
      });

      return { message: "Category deleted successfully" };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error("Error deleting category:", error);
      throw new AppError(
        "Failed to delete category",
        500,
        "CATEGORY_DELETE_ERROR"
      );
    }
  }
}
