export type FieldType = "text" | "number" | "email" | "date" | "dropdown" | "checkbox" | "radio" | "file" | "rating";
export type Operator = "equals" | "not_equals" | "contains" | "gt" | "lt" | "not_empty" | "empty";

export interface Option { id?: number; label: string; value: string }
export interface Condition { field_key: string; operator: Operator; value: any }
export interface FieldDef {
  id?: number;
  field_key: string;
  label: string;
  field_type: FieldType;
  is_required: boolean;
  placeholder?: string | null;
  validation?: Record<string, any> | null;
  condition?: Condition | null;
  options: Option[];
}
export interface User { id: number; name: string; email: string; role: "Admin" | "User"; is_active: boolean; created_at: string }
export interface FormSummary {
  id: number; title: string; description?: string | null; is_active: boolean; is_public: boolean;
  allow_response_edit: boolean; owner_id: number; owner_name: string; field_count: number;
  response_count: number; created_at: string; updated_at: string;
}
export interface FormDetail extends FormSummary { fields: FieldDef[] }
export interface ResponseItem {
  id: number; form_id: number; form_title: string; user_id: number | null; submitted_by: string;
  submitted_by_email?: string | null; submitted_at: string; updated_at: string | null;
  answers: Record<string, any>; can_edit: boolean;
}
export interface ResponseDetail extends ResponseItem { fields: FieldDef[] }
export interface Page<T> { items: T[]; total: number; page: number; page_size: number }
export interface LogItem {
  id: number; user_id: number | null; user_name: string; form_id: number | null; action: string;
  entity_type: string | null; entity_id: number | null; details: Record<string, any> | null;
  ip_address?: string | null; created_at: string;
}
