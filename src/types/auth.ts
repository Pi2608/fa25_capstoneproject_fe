// Auth component types
export interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle: string;
}

export interface InputFieldProps {
  type?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  required?: boolean;
  className?: string;
  inputClassName?: string;
}

export interface PasswordInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  required?: boolean;
  showToggle?: boolean;
  className?: string;
}

export interface SubmitButtonProps {
  loading: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  className?: string;
}

export interface AuthLinksProps {
  links: Array<{
    href: string;
    text: string;
  }>;
  className?: string;
}

export interface ToastProps {
  message: string | null;
  onClose?: () => void;
}

export interface FormFieldProps {
  children: React.ReactNode;
  error?: string;
  className?: string;
}

export interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

// Auth page types
export type BannerType = "error" | "success" | "info";

export interface Banner {
  type: BannerType;
  text: string;
}

export interface AuthFormErrors {
  email?: string;
  password?: string;
  name?: string;
  phone?: string;
  confirm?: string;
  agree?: string;
}

// Social login types
export type Provider = "google" | "facebook";

export interface SocialLoginResponse {
  token: string;
  user: { id: string; email: string };
}

export interface ErrorPayload {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  message?: string;
  errors?: string[];
}
