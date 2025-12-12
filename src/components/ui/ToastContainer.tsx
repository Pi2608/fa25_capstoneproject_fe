"use client";

import { useToast } from "@/contexts/ToastContext";
import { useEffect } from "react";
import { ToastContainer as RTContainer, toast as rtToast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

export default function ToastContainer() {
  const { toasts, hideToast } = useToast();

  useEffect(() => {
    toasts.forEach((t) => {
      const opts = { toastId: t.id, onClose: () => hideToast(t.id) };
      switch (t.type) {
        case "success":
          rtToast.success(t.message, opts);
          break;
        case "error":
          rtToast.error(t.message, opts);
          break;
        case "warning":
          rtToast.warn(t.message, opts);
          break;
        case "info":
          rtToast.info(t.message, opts);
          break;
        default:
          rtToast(t.message, opts);
          break;
      }
    });
  }, [toasts]);

  return (
    <RTContainer position="top-right" newestOnTop pauseOnHover closeOnClick />
  );
}
