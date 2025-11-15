import { Icon as IconifyIcon } from '@iconify/react';
import { cn } from '@/lib/utils';

interface IconProps {
  icon: string;
  className?: string;
  size?: number;
}

export const Icon = ({ icon, className, size }: IconProps) => {
  return (
    <IconifyIcon
      icon={icon}
      className={cn("inline-block", className)}
      width={size}
      height={size}
    />
  );
};
