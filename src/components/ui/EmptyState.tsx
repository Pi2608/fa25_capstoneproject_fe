import Image from "next/image";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  /** Name of illustration file (without .svg extension) */
  illustration:
    | "questions"
    | "teaching"
    | "team"
    | "map"
    | "add_content"
    | "winners"
    | "timeline"
    | "not_found";

  /** Main heading text */
  title: string;

  /** Descriptive text explaining the empty state */
  description: string;

  /** Optional call-to-action button */
  action?: {
    label: string;
    onClick: () => void;
    variant?: "default" | "outline";
  };

  /** Optional secondary action (e.g., "Learn More") */
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };

  /** Custom className for container */
  className?: string;
}

export function EmptyState({
  illustration,
  title,
  description,
  action,
  secondaryAction,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-16 px-4",
        "text-center max-w-md mx-auto",
        "animate-in fade-in duration-500",
        className
      )}
    >
      {/* Illustration */}
      <div className="mb-8 w-full max-w-[280px] opacity-80 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100">
        <Image
          src={`/illustrations/undraw_${illustration}.svg`}
          alt={title}
          width={280}
          height={200}
          className="w-full h-auto"
          priority={false}
        />
      </div>

      {/* Title */}
      <h3 className="text-xl font-semibold text-zinc-100 mb-3 animate-in fade-in slide-in-from-bottom-2 duration-500 delay-300">
        {title}
      </h3>

      {/* Description */}
      <p className="text-sm text-zinc-400 mb-6 leading-relaxed animate-in fade-in slide-in-from-bottom-2 duration-500 delay-500">
        {description}
      </p>

      {/* Actions */}
      {action && (
        <div className="flex flex-col sm:flex-row gap-3 animate-in fade-in slide-in-from-bottom-2 duration-500 delay-700">
          <Button
            onClick={action.onClick}
            variant={action.variant || "default"}
            className="min-w-[180px]"
          >
            {action.label}
          </Button>

          {secondaryAction && (
            <Button
              onClick={secondaryAction.onClick}
              variant="outline"
              className="min-w-[140px]"
            >
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
