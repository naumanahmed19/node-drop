import { FormFieldConfig, FormFieldOption } from "./types";

export class FieldValidator {
  /**
   * Validates a single field value
   */
  static validateField(field: FormFieldConfig, value: any): string | null {
    // Check required validation
    if (field.required && this.isEmpty(value)) {
      return `${field.displayName} is required`;
    }

    // Skip other validations if field is empty and not required
    if (this.isEmpty(value) && !field.required) {
      return null;
    }

    // Type-specific validations
    switch (field.type) {
      case "string":
      case "textarea":
      case "password":
        return this.validateString(field, value);

      case "number":
        return this.validateNumber(field, value);

      case "email":
        return this.validateEmail(field, value);

      case "url":
        return this.validateUrl(field, value);

      case "json":
        return this.validateJson(field, value);

      case "dateTime":
        return this.validateDateTime(field, value);

      case "options":
        return this.validateOptions(field, value);

      case "multiOptions":
        return this.validateMultiOptions(field, value);
    }

    // Custom validation
    if (field.validation?.custom) {
      return field.validation.custom(value);
    }

    return null;
  }

  /**
   * Validates all fields in a form
   */
  static validateForm(
    fields: FormFieldConfig[],
    values: Record<string, any>
  ): Record<string, string> {
    const errors: Record<string, string> = {};

    fields.forEach((field) => {
      const value = values[field.name];
      const error = this.validateField(field, value);
      if (error) {
        errors[field.name] = error;
      }
    });

    return errors;
  }

  private static isEmpty(value: any): boolean {
    if (value === null || value === undefined) return true;
    if (typeof value === "string" && value.trim() === "") return true;
    if (Array.isArray(value) && value.length === 0) return true;
    return false;
  }

  private static validateString(
    field: FormFieldConfig,
    value: string
  ): string | null {
    if (typeof value !== "string") return null;

    const { validation } = field;
    if (!validation) return null;

    // Length validations
    if (
      validation.minLength !== undefined &&
      value.length < validation.minLength
    ) {
      return `${field.displayName} must be at least ${validation.minLength} characters long`;
    }

    if (
      validation.maxLength !== undefined &&
      value.length > validation.maxLength
    ) {
      return `${field.displayName} must be no more than ${validation.maxLength} characters long`;
    }

    // Pattern validation
    if (validation.pattern) {
      const regex = new RegExp(validation.pattern);
      if (!regex.test(value)) {
        return `${field.displayName} format is invalid`;
      }
    }

    return null;
  }

  private static validateNumber(
    field: FormFieldConfig,
    value: any
  ): string | null {
    const numValue = typeof value === "string" ? parseFloat(value) : value;

    if (isNaN(numValue)) {
      return `${field.displayName} must be a valid number`;
    }

    const { validation } = field;
    if (!validation) return null;

    if (validation.min !== undefined && numValue < validation.min) {
      return `${field.displayName} must be at least ${validation.min}`;
    }

    if (validation.max !== undefined && numValue > validation.max) {
      return `${field.displayName} must be no more than ${validation.max}`;
    }

    return null;
  }

  private static validateEmail(
    field: FormFieldConfig,
    value: string
  ): string | null {
    if (typeof value !== "string") return null;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      return `${field.displayName} must be a valid email address`;
    }

    return this.validateString(field, value);
  }

  private static validateUrl(
    field: FormFieldConfig,
    value: string
  ): string | null {
    if (typeof value !== "string") return null;

    try {
      new URL(value);
    } catch {
      return `${field.displayName} must be a valid URL`;
    }

    return this.validateString(field, value);
  }

  private static validateJson(
    field: FormFieldConfig,
    value: any
  ): string | null {
    if (typeof value === "string") {
      try {
        JSON.parse(value);
      } catch {
        return `${field.displayName} must be valid JSON`;
      }
    }

    return null;
  }

  private static validateDateTime(
    field: FormFieldConfig,
    value: string
  ): string | null {
    if (typeof value !== "string") return null;

    const date = new Date(value);
    if (isNaN(date.getTime())) {
      return `${field.displayName} must be a valid date and time`;
    }

    return null;
  }

  private static validateOptions(
    field: FormFieldConfig,
    value: any
  ): string | null {
    if (!field.options || field.options.length === 0) return null;

    const validValues = field.options
      .filter((opt): opt is FormFieldOption => 'value' in opt)
      .map((opt) => opt.value);
    if (!validValues.includes(value)) {
      return `${field.displayName} must be one of the available options`;
    }

    return null;
  }

  private static validateMultiOptions(
    field: FormFieldConfig,
    value: any
  ): string | null {
    if (!Array.isArray(value)) {
      return `${field.displayName} must be an array of values`;
    }

    if (!field.options || field.options.length === 0) return null;

    const validValues = field.options
      .filter((opt): opt is FormFieldOption => 'value' in opt)
      .map((opt) => opt.value);
    const invalidValues = value.filter((v) => !validValues.includes(v));

    if (invalidValues.length > 0) {
      return `${
        field.displayName
      } contains invalid options: ${invalidValues.join(", ")}`;
    }

    return null;
  }
}
