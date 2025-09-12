"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Check, Loader, X } from "lucide-react"

import { cn } from "@/lib/utils"

const stepperVariants = cva(
  "flex w-full items-center justify-between gap-2",
  {
    variants: {
      orientation: {
        vertical: "flex-col",
        horizontal: "flex-row",
      },
      variant: {
        default: "",
        ghost: "",
      },
    },
    defaultVariants: {
      orientation: "horizontal",
      variant: "default",
    },
  }
)

type StepperContextValue = {
  activeStep: number
  steps: { label: React.ReactNode; icon?: React.ReactNode }[]
} & VariantProps<typeof stepperVariants>

const StepperContext = React.createContext<StepperContextValue>({
  activeStep: 0,
  steps: [],
})

function useStepper() {
  const context = React.useContext(StepperContext)
  if (!context) {
    throw new Error("useStepper must be used within a <Stepper />")
  }
  return context
}

interface StepperProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof stepperVariants> {
  activeStep: number
  children: React.ReactNode
}

function Stepper({
  activeStep,
  orientation,
  variant,
  className,
  children,
  ...props
}: StepperProps) {
  const steps = React.Children.toArray(children) as React.ReactElement[]
  const stepsValues = steps.map((step) => {
    const { label, icon } = step.props as {
      label: React.ReactNode
      icon?: React.ReactNode
    }
    return { label, icon }
  })
  return (
    <StepperContext.Provider
      value={{
        activeStep,
        steps: stepsValues,
        orientation,
        variant,
      }}
    >
      <div
        className={cn(stepperVariants({ orientation, variant, className }))}
        {...props}
      >
        {React.Children.map(children, (child, index) => {
          if (React.isValidElement(child)) {
            return React.cloneElement(child, { key: `step-${index}`, index: index } as React.Attributes & { index: number });
          }
          return child;
        })}
      </div>
    </StepperContext.Provider>
  )
}

function Step({
  index,
  children,
}: {
  index: number
  children?: React.ReactNode
}) {
  const { activeStep, steps } = useStepper()
  const isActive = activeStep === index
  const isCompleted = activeStep > index
  const context = {
    isActive,
    isCompleted,
    index,
  }
  return (
    <StepContext.Provider value={context}>
      {children || <StepButton />}
      {index < steps.length - 1 && <StepSeparator />}
    </StepContext.Provider>
  )
}

const stepVariants = cva("flex items-center gap-4", {
  variants: {
    orientation: {
      vertical: "flex-col",
      horizontal: "flex-row",
    },
  },
  defaultVariants: {
    orientation: "horizontal",
  },
})

type StepContextValue = {
  isActive: boolean
  isCompleted: boolean
  index: number
}

const StepContext = React.createContext<StepContextValue>({
  isActive: false,
  isCompleted: false,
  index: 0,
})

function useStep() {
  const context = React.useContext(StepContext)
  if (!context) {
    throw new Error("useStep must be used within a <Step />")
  }
  return context
}

const StepButton = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>((props, ref) => {
  const { index } = useStep()
  const { steps, activeStep } = useStepper()
  const { label, icon } = steps[index]
  const isActive = activeStep === index
  return (
    <button
      ref={ref}
      aria-current={isActive ? "step" : undefined}
      className="flex items-center gap-2"
      {...props}
    >
      <StepIndicator>{icon || <StepNumber />}</StepIndicator>
      <div className="flex flex-col">
        <StepTitle>{label}</StepTitle>
      </div>
    </button>
  )
})
StepButton.displayName = "StepButton"

const stepSeparatorVariants = cva("flex-1", {
  variants: {
    orientation: {
      vertical: "min-h-8 my-2 ml-6 border-l-2",
      horizontal: "min-w-8 mx-2 mt-6 border-t-2",
    },
    variant: {
      default: "",
      ghost: "opacity-0",
    },
  },
  defaultVariants: {
    orientation: "horizontal",
    variant: "default",
  },
})

function StepSeparator(props: React.HTMLAttributes<HTMLHRElement>) {
  const { orientation, variant } = useStepper()
  return (
    <hr
      role="separator"
      {...props}
      className={cn(stepSeparatorVariants({ orientation, variant }))}
    />
  )
}

const StepIndicator = React.forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement>
>((props, ref) => {
  return (
    <span
      ref={ref}
      {...props}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-full border-2",
        props.className
      )}
    />
  )
})
StepIndicator.displayName = "StepIndicator"

function StepNumber() {
  const { index, isCompleted, isActive } = useStep()
  const { activeStep } = useStepper()
  const hasVisited = isCompleted || isActive || activeStep > index
  if (isCompleted) {
    return <Check className="h-4 w-4" />
  }
  return (
    <span
      className={cn("text-lg", hasVisited && "text-white", !hasVisited)}
    >
      {index + 1}
    </span>
  )
}

function StepTitle({ children }: { children?: React.ReactNode }) {
  const { isActive, isCompleted } = useStep()
  if (!children) return null
  return (
    <div
      className={cn(
        "text-sm font-medium",
        isActive && "text-primary",
        isCompleted && "text-muted-foreground"
      )}
    >
      {children}
    </div>
  )
}

function StepDescription({ children }: { children?: React.ReactNode }) {
  const { isActive, isCompleted } = useStep()
  if (!children) return null
  return (
    <p
      className={cn(
        "text-sm text-muted-foreground",
        (isActive || isCompleted) && "text-foreground"
      )}
    >
      {children}
    </p>
  )
}

function StepIcon({ children, as: AsComp }: { as?: React.ElementType, children?: React.ReactNode }) {
  const { isCompleted } = useStep()
  const { steps, activeStep } = useStepper()
  const { icon, label } = steps[activeStep]
  if (!isCompleted) return null
  if (AsComp) {
    return <AsComp />
  }
  return children || icon
}


const StepStatus = ({
    complete,
    active,
    incomplete,
  }: {
    complete: React.ReactNode;
    active: React.ReactNode;
    incomplete: React.ReactNode;
  }) => {
    const { isCompleted, isActive } = useStep();
    if (isCompleted) {
      return <>{complete}</>;
    }
    if (isActive) {
      return <>{active}</>;
    }
    return <>{incomplete}</>;
};

function useSteps({
  initialStep = 0,
  steps,
}: {
  initialStep?: number
  steps: any[]
}) {
  const [activeStep, setActiveStep] = React.useState(initialStep)
  const isLastStep = activeStep === steps.length - 1
  const isFirstStep = activeStep === 0

  const goToNext = React.useCallback(() => {
    if (isLastStep) return
    setActiveStep((prev) => prev + 1)
  }, [isLastStep])

  const goToPrevious = React.useCallback(() => {
    if (isFirstStep) return
    setActiveStep((prev) => prev - 1)
  }, [isFirstStep])

  const reset = React.useCallback(() => {
    setActiveStep(initialStep)
  }, [initialStep])

  const setStep = React.useCallback((step: number) => {
    if (step < 0 || step >= steps.length) {
      throw new Error(`Step ${step} is not valid`)
    }
    setActiveStep(step)
  }, [steps])

  const isDisabledStep = React.useCallback(
    (step: number) => {
      return step > activeStep
    },
    [activeStep]
  )

  const isOptionalStep = React.useCallback(
    (step: number) => {
      return steps[step].optional
    },
    [steps]
  )

  return {
    activeStep,
    setActiveStep,
    goToNext,
    goToPrevious,
    reset,
    setStep,
    isLastStep,
    isFirstStep,
    isDisabledStep,
    isOptionalStep,
  }
}

export {
  Stepper,
  Step,
  useStepper,
  StepButton,
  StepSeparator,
  StepIndicator,
  StepNumber,
  StepTitle,
  StepDescription,
  StepIcon,
  useStep,
  StepStatus,
  useSteps
}
