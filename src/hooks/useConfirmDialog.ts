"use client";

import { useState, useCallback } from "react";

interface ConfirmDialogState {
  isOpen: boolean;
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  itemName?: string;
  itemType?: string;
  relatedItems?: {
    label: string;
    count: number;
  }[];
  onConfirm: () => void | Promise<void>;
}

export function useConfirmDialog() {
  const [state, setState] = useState<ConfirmDialogState>({
    isOpen: false,
    onConfirm: () => {},
  });

  const openDialog = useCallback((config: Omit<ConfirmDialogState, "isOpen">) => {
    setState({
      ...config,
      isOpen: true,
    });
  }, []);

  const closeDialog = useCallback(() => {
    setState((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const confirmDelete = useCallback(
    (
      onConfirm: () => void | Promise<void>,
      options?: {
        itemName?: string;
        itemType?: string;
        relatedItems?: { label: string; count: number }[];
        title?: string;
        message?: string;
      }
    ) => {
      openDialog({
        onConfirm,
        ...options,
      });
    },
    [openDialog]
  );

  return {
    dialogState: state,
    closeDialog,
    confirmDelete,
  };
}
