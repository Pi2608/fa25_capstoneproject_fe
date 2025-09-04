"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  confirmPaymentWithContext,
  type ConfirmPaymentWithContextReq,
  getTransactionById,
} from "@/lib/api";

function pretty(e: unknown) {
  if (e && typeof e === "object" && "message" in e && typeof (e as any).message === "string")
    return (e as any).message as string;
  if (e instanceof Error) return e.message;
  return "Xác nhận thanh toán thất bại.";
}

export default function PaymentReturnPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const [msg, setMsg] = useState("Đang xác nhận thanh toán…");
  const [txId, setTxId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        // Tùy cổng sẽ trả tham số khác nhau trên query:
        // PayPal: ?paymentId=...&PayerID=...&token=...&transactionId=...
        // PayOS : ?orderCode=...&signature=...&status=PAID&transactionId=...
        // (Nếu BE của bạn thêm/đổi key, sửa cho khớp tại đây)

        const paymentId = sp.get("paymentId") ?? undefined;
        const payerId   = sp.get("PayerID") ?? sp.get("payerId") ?? undefined; // nếu cần dùng
        const token     = sp.get("token") ?? undefined;

        const orderCode = sp.get("orderCode") ?? undefined;
        const signature = sp.get("signature") ?? undefined;
        const status    = sp.get("status") ?? undefined;

        const transactionId = sp.get("transactionId") ?? undefined; // BE có thể đính kèm
        if (transactionId && alive) setTxId(transactionId);

        // Suy ra gateway theo dấu hiệu tham số
        const paymentGateway = orderCode ? "PayOS" : "PayPal";

        const payload: ConfirmPaymentWithContextReq = {
          paymentGateway,
          paymentId,     // PayPal
          orderCode,     // PayOS
          signature,     // PayOS (BE verify)
          purpose: "membership",
          transactionId, // nếu BE cần để match
        };

        // Gọi confirm
        await confirmPaymentWithContext(payload);

        if (!alive) return;
        setMsg("Thanh toán thành công! Đang cập nhật trạng thái gói…");

        // (Optional) Poll nhanh transaction để hiện kết quả
        if (transactionId) {
          try {
            const tx = await getTransactionById(transactionId);
            if (!alive) return;
            setMsg(`Giao dịch #${tx.transactionId} đã ${tx.status}.`);
          } catch {
            /* bỏ qua */
          }
        }

        // Điều hướng sang trang Profile/Plans sau 1–2s
        setTimeout(() => {
          if (!alive) return;
          router.replace("/profile"); // đổi sang trang bạn muốn
        }, 1500);
      } catch (e) {
        if (!alive) return;
        setMsg(pretty(e));
      }
    })();

    return () => {
      alive = false;
    };
  }, [router, sp]);

  return (
    <main className="max-w-xl mx-auto px-4 py-10 text-zinc-100">
      <h1 className="text-xl font-semibold">Kết quả thanh toán</h1>
      <p className="mt-3 text-zinc-300">{msg}</p>
      {txId && <p className="mt-2 text-xs text-zinc-500">TransactionId: {txId}</p>}
    </main>
  );
}
