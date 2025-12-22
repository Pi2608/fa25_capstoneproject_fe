"use client";

import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { createPortal } from "react-dom";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

interface ConfirmDialogOptions {
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "warning" | "info";
  actionType?: "delete" | "move" | "custom";
  itemName?: string;
  itemType?: string;
  relatedItems?: {
    label: string;
    count: number;
  }[];
}

interface ConfirmDialogContextType {
  confirm: (onConfirm: () => void | Promise<void>, options?: ConfirmDialogOptions) => void;
  confirmDelete: (onConfirm: () => void | Promise<void>, options?: ConfirmDialogOptions) => void;
  confirmMove: (onConfirm: () => void | Promise<void>, options?: ConfirmDialogOptions) => void;
}

const ConfirmDialogContext = createContext<ConfirmDialogContextType | undefined>(undefined);

interface DialogState extends ConfirmDialogOptions {
  isOpen: boolean;
  onConfirm: () => void | Promise<void>;
}

export function ConfirmDialogProvider({ children }: { children: ReactNode }) {
  const [dialogState, setDialogState] = useState<DialogState>({
    isOpen: false,
    onConfirm: () => {},
  });

  const confirm = useCallback((onConfirm: () => void | Promise<void>, options?: ConfirmDialogOptions) => {
    setDialogState({
      ...options,
      isOpen: true,
      onConfirm,
    });
  }, []);

  const confirmDelete = useCallback((onConfirm: () => void | Promise<void>, options?: ConfirmDialogOptions) => {
    setDialogState({
      ...options,
      actionType: "delete",
      variant: "danger",
      isOpen: true,
      onConfirm,
    });
  }, []);

  const confirmMove = useCallback((onConfirm: () => void | Promise<void>, options?: ConfirmDialogOptions) => {
    setDialogState({
      ...options,
      actionType: "move",
      variant: "info",
      isOpen: true,
      onConfirm,
    });
  }, []);

  const handleClose = useCallback(() => {
    setDialogState((prev) => ({ ...prev, isOpen: false }));
  }, []);

  return (
    <ConfirmDialogContext.Provider value={{ confirm, confirmDelete, confirmMove }}>
      {children}
      {typeof window !== "undefined" &&
        createPortal(
          <ConfirmDialog
            isOpen={dialogState.isOpen}
            onClose={handleClose}
            onConfirm={dialogState.onConfirm}
            title={dialogState.title}
            message={dialogState.message}
            confirmText={dialogState.confirmText}
            cancelText={dialogState.cancelText}
            variant={dialogState.variant}
            actionType={dialogState.actionType}
            itemName={dialogState.itemName}
            itemType={dialogState.itemType}
            relatedItems={dialogState.relatedItems}
          />,
          document.body
        )}
    </ConfirmDialogContext.Provider>
  );
}

export function useConfirmDialogContext() {
  const context = useContext(ConfirmDialogContext);
  if (context === undefined) {
    throw new Error("useConfirmDialogContext must be used within a ConfirmDialogProvider");
  }
  return context;
}
