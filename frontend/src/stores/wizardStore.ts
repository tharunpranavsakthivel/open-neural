/**
 * Wizard navigation state store using Zustand.
 *
 * Tracks the current step in the 8-step workflow, which steps have been
 * completed, and unsaved configuration data for each step.
 *
 * @module stores/wizardStore
 */
import { create } from "zustand";
import type { WizardStep } from "./appStore";

/**
 * Ordered list of wizard steps for navigation validation.
 * Steps must be completed in sequence, but can be revisited once completed.
 */
export const WIZARD_STEPS: readonly WizardStep[] = [
  "projects",
  "dataset",
  "preprocessing",
  "model",
  "training",
  "evaluation",
  "leaderboard",
  "export",
] as const;

/**
 * Check if a step is navigable based on current state.
 * A step is navigable if it's the current step, a completed step,
 * or the immediate next step after the last completed one.
 *
 * @param targetStep - The step to navigate to
 * @param activeStep - The currently active step
 * @param completedSteps - Set of completed steps
 * @returns Whether navigation to the target step is allowed
 */
function isStepNavigable(
  targetStep: WizardStep,
  activeStep: WizardStep,
  completedSteps: Set<WizardStep>,
): boolean {
  // Always allow staying on the current step
  if (targetStep === activeStep) {
    return true;
  }

  // Always allow navigating to completed steps
  if (completedSteps.has(targetStep)) {
    return true;
  }

  // Allow navigating to the next step after the last completed one
  const currentIndex = WIZARD_STEPS.indexOf(activeStep);
  const targetIndex = WIZARD_STEPS.indexOf(targetStep);

  // If current step is not in the ordered list, only allow completed steps
  if (currentIndex === -1) {
    return false;
  }

  // Allow navigating to the immediate next step
  if (targetIndex === currentIndex + 1) {
    return true;
  }

  return false;
}

/**
 * Wizard store state interface.
 */
interface WizardState {
  /** Currently active wizard step */
  activeStep: WizardStep;
  /** Set of completed steps */
  completedSteps: Set<WizardStep>;
  /** Unsaved configuration data for each step */
  unsavedConfig: Partial<Record<WizardStep, unknown>>;
}

/**
 * Wizard store actions interface.
 */
interface WizardActions {
  /**
   * Navigate to a specific step.
   * Only allowed for completed steps or the next sequential step.
   *
   * @param step - The target step to navigate to
   * @returns Whether navigation was successful
   */
  navigateToStep: (step: WizardStep) => boolean;

  /**
   * Mark a step as completed.
   *
   * @param step - The step to mark as complete
   */
  markStepComplete: (step: WizardStep) => void;

  /**
   * Save configuration data for a specific step.
   *
   * @param step - The step to save config for
   * @param config - The configuration data to save
   */
  saveStepConfig: (step: WizardStep, config: unknown) => void;

  /**
   * Get the configuration for a specific step.
   *
   * @param step - The step to get config for
   * @returns The saved configuration or undefined
   */
  getStepConfig: (step: WizardStep) => unknown | undefined;

  /**
   * Check if a step is completed.
   *
   * @param step - The step to check
   * @returns Whether the step is completed
   */
  isStepCompleted: (step: WizardStep) => boolean;

  /**
   * Check if navigation to a step is allowed.
   *
   * @param step - The step to check
   * @returns Whether navigation is allowed
   */
  canNavigateToStep: (step: WizardStep) => boolean;

  /**
   * Reset the wizard to initial state.
   * Useful when starting a new project.
   */
  resetWizard: () => void;
}

/**
 * Combined wizard store type.
 */
type WizardStore = WizardState & WizardActions;

/**
 * Initial wizard state.
 */
const initialState: WizardState = {
  activeStep: "projects",
  completedSteps: new Set<WizardStep>(),
  unsavedConfig: {},
};

/**
 * Wizard navigation store using Zustand.
 *
 * Manages the linear wizard workflow state, tracking which steps
 * have been completed and allowing navigation only to completed
 * steps or the immediate next step.
 *
 * @example
 * const { activeStep, navigateToStep, markStepComplete } = useWizardStore();
 *
 * // Navigate to dataset step (only works if projects is completed)
 * const success = navigateToStep("dataset");
 *
 * // Mark current step complete
 * markStepComplete("dataset");
 *
 * // Save config for a step
 * saveStepConfig("dataset", { filePath: "/path/to/data.csv" });
 */
export const useWizardStore = create<WizardStore>((set, get) => ({
  ...initialState,

  navigateToStep: (step: WizardStep): boolean => {
    const { activeStep, completedSteps } = get();

    if (!isStepNavigable(step, activeStep, completedSteps)) {
      return false;
    }

    set(() => ({
      activeStep: step,
    }));

    return true;
  },

  markStepComplete: (step: WizardStep): void => {
    set((state) => {
      const newCompletedSteps = new Set(state.completedSteps);
      newCompletedSteps.add(step);
      return { completedSteps: newCompletedSteps };
    });
  },

  saveStepConfig: (step: WizardStep, config: unknown): void => {
    set((state) => ({
      unsavedConfig: {
        ...state.unsavedConfig,
        [step]: config,
      },
    }));
  },

  getStepConfig: (step: WizardStep): unknown | undefined => {
    return get().unsavedConfig[step];
  },

  isStepCompleted: (step: WizardStep): boolean => {
    return get().completedSteps.has(step);
  },

  canNavigateToStep: (step: WizardStep): boolean => {
    const { activeStep, completedSteps } = get();
    return isStepNavigable(step, activeStep, completedSteps);
  },

  resetWizard: (): void => {
    set(() => initialState);
  },
}));

/**
 * Hook selector for accessing individual wizard state values.
 * Use this when you only need a specific value to minimize re-renders.
 *
 * @example
 * const activeStep = useWizardSelector((state) => state.activeStep);
 * const completedSteps = useWizardSelector((state) => state.completedSteps);
 */
export const useWizardSelector = useWizardStore;

/**
 * Get the current active step from the store.
 * Useful for non-component contexts.
 *
 * @returns The current active step
 */
export function getActiveStep(): WizardStep {
  return useWizardStore.getState().activeStep;
}

/**
 * Get the set of completed steps from the store.
 *
 * @returns Set of completed steps
 */
export function getCompletedSteps(): Set<WizardStep> {
  return useWizardStore.getState().completedSteps;
}

/**
 * Check if a specific step is completed.
 *
 * @param step - The step to check
 * @returns Whether the step is completed
 */
export function isStepCompleted(step: WizardStep): boolean {
  return useWizardStore.getState().completedSteps.has(step);
}

/**
 * Get the next step in the wizard sequence.
 *
 * @param currentStep - The current step
 * @returns The next step, or null if at the end
 */
export function getNextStep(currentStep: WizardStep): WizardStep | null {
  const currentIndex = WIZARD_STEPS.indexOf(currentStep);
  if (currentIndex === -1 || currentIndex >= WIZARD_STEPS.length - 1) {
    return null;
  }
  return WIZARD_STEPS[currentIndex + 1];
}

/**
 * Get the previous step in the wizard sequence.
 *
 * @param currentStep - The current step
 * @returns The previous step, or null if at the beginning
 */
export function getPreviousStep(currentStep: WizardStep): WizardStep | null {
  const currentIndex = WIZARD_STEPS.indexOf(currentStep);
  if (currentIndex <= 0) {
    return null;
  }
  return WIZARD_STEPS[currentIndex - 1];
}
