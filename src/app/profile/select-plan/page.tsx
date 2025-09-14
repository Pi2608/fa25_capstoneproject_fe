import { Suspense } from "react";
import SelectPlan from "./SelectPlan";

export default function SelectPlanClient() {
  return (
    <Suspense fallback={<div>Đang tải...</div>}>
      <SelectPlan />
    </Suspense>
  );
}