import { useState, useCallback, useMemo } from "react";

export interface FieldValidation {
    value: string | number | boolean;
    touched: boolean;
    error?: string;
}

export interface FormValidationState {
    [fieldName: string]: FieldValidation;
}

export interface ValidatorFn {
    (value: any): string | undefined;
}

export interface FieldValidator {
    [fieldName: string]: ValidatorFn[];
}

interface UseFormValidationOptions {
    initialValues?: Record<string, any>;
    validators?: FieldValidator;
    validateOnBlur?: boolean;
}

interface UseFormValidationReturn {
    values: Record<string, any>;
    touched: Record<string, boolean>;
    errors: Record<string, string | undefined>;
    setState: (field: string, value: any) => void;
    setTouched: (field: string, touched: boolean) => void;
    setFieldError: (field: string, error?: string) => void;
    clearFieldError: (field: string) => void;
    clearErrors: () => void;
    validateField: (field: string) => boolean;
    validateAll: () => boolean;
    reset: () => void;
    isValid: boolean;
}

export function useFormValidation({
    initialValues = {},
    validators = {},
    validateOnBlur = true,
}: UseFormValidationOptions): UseFormValidationReturn {
    const [formState, setFormState] = useState<FormValidationState>(() => {
        const initial: FormValidationState = {};
        for (const [key, value] of Object.entries(initialValues)) {
            initial[key] = {
                value,
                touched: false,
                error: undefined,
            };
        }
        return initial;
    });

    const setState = useCallback((field: string, value: any) => {
        setFormState((prev) => ({
            ...prev,
            [field]: {
                ...prev[field],
                value,
            },
        }));
    }, []);

    const validateField = useCallback(
        (field: string): boolean => {
            const fieldValidators = validators[field] || [];
            const value = formState[field]?.value;

            for (const validator of fieldValidators) {
                const error = validator(value);
                if (error) {
                    setFormState((prev) => ({
                        ...prev,
                        [field]: {
                            ...prev[field],
                            error,
                        },
                    }));
                    return false;
                }
            }

            setFormState((prev) => ({
                ...prev,
                [field]: {
                    ...prev[field],
                    error: undefined,
                },
            }));
            return true;
        },
        [formState, validators]
    );

    const setTouched = useCallback(
        (field: string, touched: boolean) => {
            setFormState((prev) => ({
                ...prev,
                [field]: {
                    ...prev[field],
                    touched,
                },
            }));

            if (validateOnBlur && touched) {
                validateField(field);
            }
        },
        [validateOnBlur, validateField]
    );

    const setFieldError = useCallback((field: string, error?: string) => {
        setFormState((prev) => ({
            ...prev,
            [field]: {
                ...prev[field],
                error,
            },
        }));
    }, []);

    const clearFieldError = useCallback((field: string) => {
        setFormState((prev) => ({
            ...prev,
            [field]: {
                ...prev[field],
                error: undefined,
            },
        }));
    }, []);

    const clearErrors = useCallback(() => {
        setFormState((prev) => {
            const next = { ...prev };
            for (const key of Object.keys(next)) {
                next[key] = { ...next[key], error: undefined };
            }
            return next;
        });
    }, []);

    const validateAll = useCallback((): boolean => {
        let isValid = true;
        const fieldsToValidate = Object.keys(validators);

        for (const field of fieldsToValidate) {
            if (!validateField(field)) {
                isValid = false;
            }
        }

        return isValid;
    }, [validators, validateField]);

    const reset = useCallback(() => {
        setFormState((prev) => {
            const next: FormValidationState = {};
            for (const [key, state] of Object.entries(prev)) {
                next[key] = {
                    value: initialValues[key] ?? "",
                    touched: false,
                    error: undefined,
                };
            }
            return next;
        });
    }, [initialValues]);

    const values = useMemo(() => {
        const vals: Record<string, any> = {};
        for (const [key, state] of Object.entries(formState)) {
            vals[key] = state.value;
        }
        return vals;
    }, [formState]);

    const touched = useMemo(() => {
        const t: Record<string, boolean> = {};
        for (const [key, state] of Object.entries(formState)) {
            t[key] = state.touched;
        }
        return t;
    }, [formState]);

    const errors = useMemo(() => {
        const e: Record<string, string | undefined> = {};
        for (const [key, state] of Object.entries(formState)) {
            e[key] = state.error;
        }
        return e;
    }, [formState]);

    const isValid = useMemo(() => {
        return Object.values(formState).every((state) => !state.error);
    }, [formState]);

    return {
        values,
        touched,
        errors,
        setState,
        setTouched,
        setFieldError,
        clearFieldError,
        clearErrors,
        validateField,
        validateAll,
        reset,
        isValid,
    };
}
