import React from "react";

interface ToolButtonProps {
  title: string;
  onClick?: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}

/**
 * Shared toolbar button component for map editor
 */
export const ToolButton: React.FC<ToolButtonProps> = ({
  title,
  onClick,
  disabled,
  children,
}) => {
  return (
    <button
      className="px-2 py-1.5 rounded-md bg-transparent text-white text-xs hover:bg-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
      title={title}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
};
