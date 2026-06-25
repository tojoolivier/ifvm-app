import { cn } from '@/lib/utils'

interface StepperProps {
  steps: { label: string }[]
  current: number
  completed: Set<number>
  onStepClick: (step: number) => void
}

export function Stepper({ steps, current, completed, onStepClick }: StepperProps) {
  return (
    <nav aria-label="Progression du formulaire" className="mb-6">
      <ol className="flex items-start">
        {steps.map((step, idx) => {
          const stepNum = idx + 1
          const isActive = stepNum === current
          const isCompleted = completed.has(stepNum)
          const isFuture = stepNum > current && !isCompleted

          return (
            <li key={stepNum} className={cn('flex items-center', idx < steps.length - 1 && 'flex-1')}>
              <button
                type="button"
                aria-current={isActive ? 'step' : undefined}
                aria-label={`Étape ${stepNum} sur ${steps.length} : ${step.label}${isActive ? ' (actuelle)' : isCompleted ? ' (complétée)' : ''}`}
                disabled={isFuture}
                onClick={() => { if (!isFuture) onStepClick(stepNum) }}
                className={cn(
                  'flex flex-col items-center gap-1 rounded px-1 py-1',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                  isFuture ? 'cursor-not-allowed' : 'cursor-pointer hover:opacity-80',
                )}
              >
                <span
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold border-2 transition-colors',
                    isActive && 'border-primary bg-primary text-primary-foreground',
                    isCompleted && !isActive && 'border-primary bg-primary/10 text-primary',
                    isFuture && 'border-muted bg-background text-muted-foreground',
                  )}
                >
                  {isCompleted && !isActive ? '✓' : stepNum}
                </span>
                <span
                  className={cn(
                    'text-xs whitespace-nowrap',
                    isActive ? 'font-semibold text-primary' : 'text-muted-foreground',
                    isFuture && 'opacity-50',
                  )}
                >
                  {step.label}
                </span>
              </button>

              {idx < steps.length - 1 && (
                <div
                  aria-hidden="true"
                  className={cn('h-0.5 flex-1 mx-2 mb-5', isCompleted ? 'bg-primary' : 'bg-border')}
                />
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
