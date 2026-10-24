export type Role = "student" | "staff" | "admin";
type D = Date | string;

export type LoanRow = {
  id: number;
  status: "waitlisted" | "requested" | "approved" | "declined" | "borrowed" | "returned" | "cancelled" | "expired";
  note: string | null;
  decision_note: string | null;
  requested_at: D;
  due_at: D | null;
  borrowed_at: D | null;
  returned_at: D | null;
  pickup_by: D | null;
  loan_hours: number | null;
  return_condition: string | null;
  item_id: number;
  item_name: string;
  item_code: string;
  category: string;
  loan_days: number;
  user_id: number;
  full_name: string;
  school_id: string;
  grade_section: string | null;
};
