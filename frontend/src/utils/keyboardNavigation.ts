/**
 * Keyboard navigation utilities for OpenNeural frontend.
 *
 * Provides hooks and utilities for keyboard navigation accessibility:
 * - Escape key handling for closing modals/drawers
 * - Enter/Space activation for focused controls
 * - Focus trap management for dialogs
 * - Tab navigation within containers
 *
 * Per Task 202: Implement keyboard navigation support.
 *
 * @module utils/keyboardNavigation
 */
import { useEffect, useCallback, useRef, type RefObject } from "react";

/**
 * Callback function type for keyboard events.
 */
type KeyboardHandler = (event: KeyboardEvent) => void;

/**
 * Options for useEscapeKey hook.
 */
interface UseEscapeKeyOptions {
  /** Whether the escape key handling is enabled */
  enabled?: boolean;
  /** Callback to run when escape is pressed */
  onEscape: () => void;
}

/**
 * Hook to handle Escape key press.
 *
 * Registers a global keydown listener that calls the callback when Escape is pressed.
 * Automatically cleans up on unmount.
 *
 * @example
 * ```tsx
 * useEscapeKey({
 *   enabled: isModalOpen,
 *   onEscape: () => setIsModalOpen(false)
 * });
 * ```
 */
export function useEscapeKey({
  enabled = true,
  onEscape,
}: UseEscapeKeyOptions): void {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onEscape();
      }
    },
    [onEscape],
  );

  useEffect(() => {
    if (!enabled) return;

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [enabled, handleKeyDown]);
}

/**
 * Options for useFocusTrap hook.
 */
interface UseFocusTrapOptions {
  /** Whether focus trapping is enabled */
  enabled?: boolean;
  /** Ref to the container element */
  containerRef: RefObject<HTMLElement | null>;
}

/**
 * Hook to trap focus within a container (for modals/dialogs).
 *
 * Keeps focus within the container when Tab/Shift+Tab is pressed.
 * Cycles focus from last element to first (and vice versa).
 *
 * @example
 * ```tsx
 * const dialogRef = useRef<HTMLDivElement>(null);
 * useFocusTrap({ enabled: isOpen, containerRef: dialogRef });
 * return <div ref={dialogRef}>...</div>;
 * ```
 */
export function useFocusTrap({
  enabled = true,
  containerRef,
}: UseFocusTrapOptions): void {
  const handleTabKey = useCallback(
    (event: KeyboardEvent) => {
      if (event.key !== "Tab" || !containerRef.current) return;

      const container = containerRef.current;
      const focusableElements = container.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );

      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      // Shift + Tab
      if (event.shiftKey) {
        if (document.activeElement === firstElement) {
          event.preventDefault();
          lastElement?.focus();
        }
      } else {
        // Tab
        if (document.activeElement === lastElement) {
          event.preventDefault();
          firstElement?.focus();
        }
      }
    },
    [containerRef],
  );

  useEffect(() => {
    if (!enabled) return;

    const container = containerRef.current;
    if (!container) return;

    container.addEventListener("keydown", handleTabKey);
    return () => {
      container.removeEventListener("keydown", handleTabKey);
    };
  }, [enabled, containerRef, handleTabKey]);
}

/**
 * Options for useKeyboardActivation hook.
 */
interface UseKeyboardActivationOptions {
  /** Callback when Enter or Space is pressed */
  onActivate: () => void;
  /** Whether activation is enabled */
  enabled?: boolean;
}

/**
 * Hook to handle Enter and Space key activation.
 *
 * Returns a keydown handler that triggers the callback when Enter or Space is pressed.
 *
 * @example
 * ```tsx
 * const handleKeyDown = useKeyboardActivation({ onActivate: handleClick });
 * return <div tabIndex={0} onKeyDown={handleKeyDown} onClick={handleClick}>...</div>;
 * ```
 */
export function useKeyboardActivation({
  onActivate,
  enabled = true,
}: UseKeyboardActivationOptions): KeyboardHandler {
  return useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onActivate();
      }
    },
    [enabled, onActivate],
  );
}

/**
 * Options for useArrowKeyNavigation hook.
 */
interface UseArrowKeyNavigationOptions {
  /** Total number of items */
  itemCount: number;
  /** Current focused index */
  focusedIndex: number;
  /** Callback when focus changes */
  onFocusChange: (index: number) => void;
  /** Callback when item is selected (Enter pressed) */
  onSelect?: (index: number) => void;
  /** Whether navigation is enabled */
  enabled?: boolean;
}

/**
 * Hook to handle arrow key navigation.
 *
 * Supports Up/Down arrow keys for navigation and Enter for selection.
 *
 * @example
 * ```tsx
 * const { handleKeyDown } = useArrowKeyNavigation({
 *   itemCount: items.length,
 *   focusedIndex,
 *   onFocusChange: setFocusedIndex,
 *   onSelect: handleSelect
 * });
 * return <ul onKeyDown={handleKeyDown}>...</ul>;
 * ```
 */
export function useArrowKeyNavigation({
  itemCount,
  focusedIndex,
  onFocusChange,
  onSelect,
  enabled = true,
}: UseArrowKeyNavigationOptions): { handleKeyDown: KeyboardHandler } {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      switch (event.key) {
        case "ArrowDown":
          event.preventDefault();
          if (focusedIndex < itemCount - 1) {
            onFocusChange(focusedIndex + 1);
          }
          break;
        case "ArrowUp":
          event.preventDefault();
          if (focusedIndex > 0) {
            onFocusChange(focusedIndex - 1);
          }
          break;
        case "Enter":
          if (onSelect && focusedIndex >= 0 && focusedIndex < itemCount) {
            event.preventDefault();
            onSelect(focusedIndex);
          }
          break;
        case "Home":
          event.preventDefault();
          onFocusChange(0);
          break;
        case "End":
          event.preventDefault();
          onFocusChange(itemCount - 1);
          break;
      }
    },
    [enabled, itemCount, focusedIndex, onFocusChange, onSelect],
  );

  return { handleKeyDown };
}

/**
 * Focus the first focusable element in a container.
 *
 * @param container - The container element to search within
 * @returns The focused element or null if none found
 */
export function focusFirstElement(container: HTMLElement): HTMLElement | null {
  const focusableElements = container.querySelectorAll<HTMLElement>(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
  );

  if (focusableElements.length > 0) {
    const firstElement = focusableElements[0];
    firstElement.focus();
    return firstElement;
  }

  return null;
}

/**
 * Get all focusable elements within a container.
 *
 * @param container - The container element to search within
 * @returns Array of focusable elements
 */
export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    ),
  );
}

/**
 * Store the currently focused element to restore later.
 *
 * @returns The currently focused element or null
 */
export function storeFocus(): HTMLElement | null {
  return document.activeElement as HTMLElement | null;
}

/**
 * Restore focus to a previously stored element.
 *
 * @param element - The element to restore focus to
 */
export function restoreFocus(element: HTMLElement | null): void {
  if (element && typeof element.focus === "function") {
    element.focus();
  }
}
