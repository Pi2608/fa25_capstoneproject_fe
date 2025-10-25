export type Banner = { type: "info" | "error" | "success"; text: string };

export interface NameParts {
  firstName: string;
  lastName: string;
}

export interface UnknownApiError {
  message?: string;
  detail?: string;
  title?: string;
  type?: string;
  status?: number;
}


export interface RegisterErrors {
  name?: string;
  email?: string;
  phone?: string;
  password?: string;
  confirm?: string;
  agree?: string;
  otp?: string;
}

export interface RegisterFormData {
  name: string;
  email: string;
  phone: string;
  password: string;
  confirm: string;
  agree: boolean;
  showPass: boolean;
  otp: string;
}

export interface RegisterStepProps {
  formData: RegisterFormData;
  errors: RegisterErrors;
  loading: boolean;
  onUpdate: (updates: Partial<RegisterFormData>) => void;
  onSetErrors: (updates: Partial<RegisterErrors>) => void;
  onBack: () => void;
  onSubmit: (e: React.FormEvent) => void;
}
