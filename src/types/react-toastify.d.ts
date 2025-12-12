import * as React from "react";

declare module "react-toastify" {
  export const toast: {
    (message: string, opts?: Record<string, unknown>): string;
    success: (message: string, opts?: Record<string, unknown>) => string;
    error: (message: string, opts?: Record<string, unknown>) => string;
    warn: (message: string, opts?: Record<string, unknown>) => string;
    info: (message: string, opts?: Record<string, unknown>) => string;
  };

  export const ToastContainer: React.FC<{
    position?: string;
    newestOnTop?: boolean;
    pauseOnHover?: boolean;
    closeOnClick?: boolean;
  }>;
}

