"use client";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { FullScreenLoading } from "@/components/common/FullScreenLoading";

type LoadingState = {
  visible: boolean;
  message?: string;
};

type LoadingContextValue = {
  showLoading: (message?: string) => void;
  hideLoading: () => void;
  setLoadingMessage: (message: string) => void;
};

const LoadingContext = createContext<LoadingContextValue | undefined>(
  undefined
);

export function LoadingProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<LoadingState>({
    visible: false,
    message: "Đang tải...",
  });

  const showLoading = useCallback((message?: string) => {
    setState({
      visible: true,
      message: message ?? "Đang tải...",
    });
  }, []);

  const hideLoading = useCallback(() => {
    setState((prev) => (prev.visible ? { ...prev, visible: false } : prev));
  }, []);

  const setLoadingMessage = useCallback((message: string) => {
    setState((prev) => ({
      visible: prev.visible,
      message,
    }));
  }, []);

  const value = useMemo(
    () => ({
      showLoading,
      hideLoading,
      setLoadingMessage,
    }),
    [showLoading, hideLoading, setLoadingMessage]
  );

  const portal =
    typeof document !== "undefined" && state.visible && document.getElementById("modal-root")
      ? createPortal(
        <FullScreenLoading message={state.message} />,
        document.getElementById("modal-root")!
      )
      : null;

  return (
    <LoadingContext.Provider value={value}>
      {children}
      {portal}
    </LoadingContext.Provider>
  );
}

export function useLoading() {
  const ctx = useContext(LoadingContext);
  if (!ctx) {
    throw new Error("useLoading must be used within a LoadingProvider");
  }
  return ctx;
}


