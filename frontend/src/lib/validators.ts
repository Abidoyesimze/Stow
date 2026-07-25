/**
 * Shared validation utilities for forms
 */

export const validators = {
    /**
     * Required field validator
     */
    required: (fieldName: string = "This field") => (value: any): string | undefined => {
        if (!value || (typeof value === "string" && !value.trim())) {
            return `${fieldName} is required.`;
        }
        return undefined;
    },

    /**
     * Minimum length validator
     */
    minLength: (min: number, fieldName: string = "This field") => (value: any): string | undefined => {
        if (!value) return undefined;
        if (String(value).length < min) {
            return `${fieldName} must be at least ${min} characters.`;
        }
        return undefined;
    },

    /**
     * Maximum length validator
     */
    maxLength: (max: number, fieldName: string = "This field") => (value: any): string | undefined => {
        if (!value) return undefined;
        if (String(value).length > max) {
            return `${fieldName} must be at most ${max} characters.`;
        }
        return undefined;
    },

    /**
     * Email validator
     */
    email: (value: any): string | undefined => {
        if (!value) return undefined;
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(String(value))) {
            return "Please enter a valid email address.";
        }
        return undefined;
    },

    /**
     * Number validator
     */
    number: (fieldName: string = "This field") => (value: any): string | undefined => {
        if (value === "" || value === null || value === undefined) return undefined;
        if (isNaN(Number(value))) {
            return `${fieldName} must be a valid number.`;
        }
        return undefined;
    },

    /**
     * Minimum number validator
     */
    minValue: (min: number, fieldName: string = "This field") => (value: any): string | undefined => {
        if (value === "" || value === null || value === undefined) return undefined;
        const num = Number(value);
        if (isNaN(num) || num < min) {
            return `${fieldName} must be at least ${min}.`;
        }
        return undefined;
    },

    /**
     * Maximum number validator
     */
    maxValue: (max: number, fieldName: string = "This field") => (value: any): string | undefined => {
        if (value === "" || value === null || value === undefined) return undefined;
        const num = Number(value);
        if (isNaN(num) || num > max) {
            return `${fieldName} must be at most ${max}.`;
        }
        return undefined;
    },

    /**
     * Pattern/Regex validator
     */
    pattern: (regex: RegExp, fieldName: string = "This field") => (value: any): string | undefined => {
        if (!value) return undefined;
        if (!regex.test(String(value))) {
            return `${fieldName} format is invalid.`;
        }
        return undefined;
    },

    /**
     * Custom validator function
     */
    custom: (fn: (value: any) => string | undefined) => fn,

    /**
     * Compose multiple validators (first error is returned)
     */
    compose: (...validatorFns: Array<(value: any) => string | undefined>) => (value: any): string | undefined => {
        for (const validator of validatorFns) {
            const error = validator(value);
            if (error) return error;
        }
        return undefined;
    },
};
