import { useState, useCallback, useEffect, useRef } from "react";
import type {
  MultiSelectState,
  MultiSelectStyleUpdate,
  FeatureStyle,
  MultiSelectEventPayload,
} from "@/types";

export interface Feature {
  id: string;
  style: FeatureStyle;
  type?: string;
  [key: string]: any;
}

export interface UseMultiSelectOptions {
  enableShiftClick?: boolean;
  showSelectionIndicators?: boolean;
  selectionColor?: string;
  onSelectionChange?: (selectedIds: string[]) => void;
  onStyleUpdate?: (update: MultiSelectStyleUpdate) => void;
}

export interface UseMultiSelectReturn {
  state: MultiSelectState;
  select: (featureId: string) => void;
  addToSelection: (featureId: string) => void;
  removeFromSelection: (featureId: string) => void;
  toggleSelection: (featureId: string) => void;
  clearSelection: () => void;
  selectMultiple: (featureIds: string[]) => void;
  isSelected: (featureId: string) => boolean;
  applyStyleToSelected: (
    style: Partial<FeatureStyle>,
    features: Map<string, Feature>
  ) => MultiSelectStyleUpdate | null;

  getCommonStyle: (features: Map<string, Feature>) => Partial<FeatureStyle> | null;
  handleFeatureClick: (featureId: string, shiftKey: boolean) => void;
}

export function useMultiSelect(
  options: UseMultiSelectOptions = {}
): UseMultiSelectReturn {
  const {
    enableShiftClick = true,
    showSelectionIndicators = true,
    selectionColor = "#3b82f6",
    onSelectionChange,
    onStyleUpdate,
  } = options;

  // Multi-select state
  const [state, setState] = useState<MultiSelectState>({
    selectedIds: new Set<string>(),
    isActive: false,
    commonStyle: null,
    hasConflictingStyles: false,
  });

  // Refs for callbacks
  const onSelectionChangeRef = useRef(onSelectionChange);
  const onStyleUpdateRef = useRef(onStyleUpdate);

  useEffect(() => {
    onSelectionChangeRef.current = onSelectionChange;
    onStyleUpdateRef.current = onStyleUpdate;
  }, [onSelectionChange, onStyleUpdate]);

  const notifySelectionChange = useCallback((selectedIds: Set<string>) => {
    if (onSelectionChangeRef.current) {
      onSelectionChangeRef.current(Array.from(selectedIds));
    }

    window.dispatchEvent(
      new CustomEvent<MultiSelectEventPayload>("map:multiselect", {
        detail: {
          selectedIds: Array.from(selectedIds),
          action: "toggle",
        },
      })
    );
  }, []);

  const select = useCallback(
    (featureId: string) => {
      setState({
        selectedIds: new Set([featureId]),
        isActive: false,
        commonStyle: null,
        hasConflictingStyles: false,
      });

      notifySelectionChange(new Set([featureId]));
    },
    [notifySelectionChange]
  );

  const addToSelection = useCallback(
    (featureId: string) => {
      setState((prev) => {
        const newSelectedIds = new Set(prev.selectedIds);
        newSelectedIds.add(featureId);

        const newState: MultiSelectState = {
          selectedIds: newSelectedIds,
          isActive: newSelectedIds.size > 1,
          commonStyle: null, // Will be calculated when needed
          hasConflictingStyles: false,
        };

        notifySelectionChange(newSelectedIds);
        return newState;
      });
    },
    [notifySelectionChange]
  );

  const removeFromSelection = useCallback(
    (featureId: string) => {
      setState((prev) => {
        const newSelectedIds = new Set(prev.selectedIds);
        newSelectedIds.delete(featureId);

        const newState: MultiSelectState = {
          selectedIds: newSelectedIds,
          isActive: newSelectedIds.size > 1,
          commonStyle: null,
          hasConflictingStyles: false,
        };

        notifySelectionChange(newSelectedIds);
        return newState;
      });
    },
    [notifySelectionChange]
  );

  const toggleSelection = useCallback(
    (featureId: string) => {
      setState((prev) => {
        const newSelectedIds = new Set(prev.selectedIds);

        if (newSelectedIds.has(featureId)) {
          newSelectedIds.delete(featureId);
        } else {
          newSelectedIds.add(featureId);
        }

        const newState: MultiSelectState = {
          selectedIds: newSelectedIds,
          isActive: newSelectedIds.size > 1,
          commonStyle: null,
          hasConflictingStyles: false,
        };

        notifySelectionChange(newSelectedIds);
        return newState;
      });
    },
    [notifySelectionChange]
  );

  const clearSelection = useCallback(() => {
    setState({
      selectedIds: new Set(),
      isActive: false,
      commonStyle: null,
      hasConflictingStyles: false,
    });

    notifySelectionChange(new Set());
  }, [notifySelectionChange]);

  const selectMultiple = useCallback(
    (featureIds: string[]) => {
      const newSelectedIds = new Set(featureIds);

      setState({
        selectedIds: newSelectedIds,
        isActive: newSelectedIds.size > 1,
        commonStyle: null,
        hasConflictingStyles: false,
      });

      notifySelectionChange(newSelectedIds);
    },
    [notifySelectionChange]
  );

  const isSelected = useCallback(
    (featureId: string): boolean => {
      return state.selectedIds.has(featureId);
    },
    [state.selectedIds]
  );

  const getCommonStyle = useCallback(
    (features: Map<string, Feature>): Partial<FeatureStyle> | null => {
      if (state.selectedIds.size === 0) return null;

      const selectedFeatures = Array.from(state.selectedIds)
        .map((id) => features.get(id))
        .filter((f): f is Feature => f !== undefined);

      if (selectedFeatures.length === 0) return null;

      const allStyleKeys = new Set<string>();
      selectedFeatures.forEach((feature) => {
        if (feature.style) {
          Object.keys(feature.style).forEach((key) => allStyleKeys.add(key));
        }
      });

      const commonStyle: Partial<FeatureStyle> = {};
      let hasConflicts = false;

      allStyleKeys.forEach((key) => {
        const values = selectedFeatures
          .map((f) => f.style?.[key])
          .filter((v) => v !== undefined);

        if (values.length > 0) {
          const firstValue = values[0];
          const allSame = values.every((v) => v === firstValue);

          if (allSame) {
            commonStyle[key] = firstValue;
          } else {
            hasConflicts = true;
          }
        }
      });

      setState((prev) => ({
        ...prev,
        commonStyle,
        hasConflictingStyles: hasConflicts,
      }));

      return commonStyle;
    },
    [state.selectedIds]
  );

  const applyStyleToSelected = useCallback(
    (
      style: Partial<FeatureStyle>,
      features: Map<string, Feature>
    ): MultiSelectStyleUpdate | null => {
      if (state.selectedIds.size === 0) {
        console.warn("[useMultiSelect] No features selected");
        return null;
      }

      const featureIds = Array.from(state.selectedIds);
      const previousStyles: Record<string, FeatureStyle> = {};

      featureIds.forEach((id) => {
        const feature = features.get(id);
        if (feature && feature.style) {
          previousStyles[id] = { ...feature.style };
        }
      });

      const update: MultiSelectStyleUpdate = {
        featureIds,
        style,
        previousStyles,
      };

      // Notify callback
      if (onStyleUpdateRef.current) {
        onStyleUpdateRef.current(update);
      }

      console.log(`[useMultiSelect] Applied styles to ${featureIds.length} features`);

      return update;
    },
    [state.selectedIds]
  );

  const handleFeatureClick = useCallback(
    (featureId: string, shiftKey: boolean) => {
      if (enableShiftClick && shiftKey) {
        toggleSelection(featureId);
      } else {
        select(featureId);
      }
    },
    [enableShiftClick, toggleSelection, select]
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && state.selectedIds.size > 0) {
        clearSelection();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [state.selectedIds, clearSelection]);

  useEffect(() => {
    if (!showSelectionIndicators) return;

    window.dispatchEvent(
      new CustomEvent("map:updateSelectionIndicators", {
        detail: {
          selectedIds: Array.from(state.selectedIds),
          color: selectionColor,
        },
      })
    );
  }, [state.selectedIds, showSelectionIndicators, selectionColor]);

  return {
    state,
    select,
    addToSelection,
    removeFromSelection,
    toggleSelection,
    clearSelection,
    selectMultiple,
    isSelected,
    applyStyleToSelected,
    getCommonStyle,
    handleFeatureClick,
  };
}
