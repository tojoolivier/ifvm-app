import * as React from "react"

import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

interface FormFieldProps {
  label: string
  error?: string
  required?: boolean
  className?: string
  children: React.ReactNode
  /** Override pour les composants composés (ex: Select) où l'id est sur un sous-élément. */
  fieldId?: string
}

function FormField({ label, error, required, className, children, fieldId: fieldIdOverride }: FormFieldProps) {
  const child = React.Children.only(children) as React.ReactElement<{ id?: string }>
  const fieldId = fieldIdOverride ?? child.props.id

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={fieldId}>
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </Label>
      {children}
      {error && (
        <p
          id={fieldId ? `${fieldId}-error` : undefined}
          role="alert"
          aria-live="polite"
          className="text-sm text-destructive"
        >
          {error}
        </p>
      )}
    </div>
  )
}

export { FormField }
