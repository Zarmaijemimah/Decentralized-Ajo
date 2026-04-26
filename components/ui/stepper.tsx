import * as React from 'react';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

interface StepperProps {
  steps: {
    title: string;
    description?: string;
  }[];
  currentStep: number;
  className?: string;
}

export function Stepper({ steps, currentStep, className }: StepperProps) {
  return (
    <div className={cn('w-full', className)}>
      <div className="relative flex justify-between">
        {/* Progress Line */}
        <div 
          className="absolute top-4 left-0 h-0.5 bg-muted w-full -z-10" 
          aria-hidden="true"
        />
        <div 
          className="absolute top-4 left-0 h-0.5 bg-primary transition-all duration-300 ease-in-out -z-10" 
          style={{ width: `${(currentStep / (steps.length - 1)) * 100}%` }}
          aria-hidden="true"
        />

        {steps.map((step, index) => {
          const isCompleted = index < currentStep;
          const isActive = index === currentStep;

          return (
            <div key={step.title} className="flex flex-col items-center">
              <div
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-full border-2 bg-background transition-colors duration-200',
                  isCompleted
                    ? 'border-primary bg-primary text-primary-foreground'
                    : isActive
                    ? 'border-primary text-primary ring-4 ring-primary/20'
                    : 'border-muted text-muted-foreground'
                )}
              >
                {isCompleted ? (
                  <Check className="h-5 w-5" />
                ) : (
                  <span className="text-sm font-medium">{index + 1}</span>
                )}
              </div>
              <div className="mt-3 text-center">
                <p
                  className={cn(
                    'text-sm font-medium',
                    isActive ? 'text-primary' : 'text-muted-foreground'
                  )}
                >
                  {step.title}
                </p>
                {step.description && (
                  <p className="hidden md:block text-xs text-muted-foreground mt-0.5 max-w-[120px]">
                    {step.description}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
