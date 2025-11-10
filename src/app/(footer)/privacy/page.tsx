import type { Metadata } from "next";
import RevealOnScroll from "./RevealOnScroll"; 

export const metadata: Metadata = {
  title: "Chính sách quyền riêng tư — IMOS",
  description:
    "Cách IMOS thu thập, sử dụng và bảo vệ dữ liệu của bạn. Minh bạch, bảo mật và quyền kiểm soát thuộc về người dùng.",
};

const Section = ({
  title,
  children,
  badge,
}: {
  title: string;
  badge?: string;
  children: React.ReactNode;
}) => (
  <section data-reveal className="rounded-2xl ring-1 ring-white/10 bg-white/5 p-5">
    <div className="mb-3 flex items-center gap-3">
      {badge && (
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/15 ring-1 ring-emerald-400/30">
          <svg className="h-4 w-4 text-emerald-400" viewBox="0 0 24 24" aria-hidden>
            <path
              fill="currentColor"
              d="M12 2a10 10 0 100 20 10 10 0 000-20Zm-1 14l-4-4 1.4-1.4L11 12.2l5.6-5.6L18 8l-7 8z"
            />
          </svg>
        </span>
      )}
      <h3 className="font-semibold text-white">{title}</h3>
    </div>
    <div className="prose prose-invert prose-zinc max-w-none">{children}</div>
  </section>
);

export default function PrivacyPage() {
  return (
    <main className="relative min-h-screen">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10
        bg-[radial-gradient(1200px_600px_at_50%_-180px,rgba(16,185,129,0.16),transparent_60%)]
        dark:bg-[radial-gradient(1200px_600px_at_50%_-180px,rgba(16,185,129,0.12),transparent_60%)]"
      />
      <div
        aria-hidden
        className="absolute inset-0 -z-10
        bg-[linear-gradient(to_bottom,rgba(16,185,129,0.08),transparent_35%)]
        dark:bg-[linear-gradient(to_bottom,rgba(16,185,129,0.06),transparent_35%)]"
      />

      <RevealOnScroll />

      <div className="mx-auto max-w-5xl px-6 py-10">
        {/* Hero */}
        <header data-reveal className="mb-10">
          <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-white/10 bg-white/5 text-emerald-300">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Minh bạch & bảo mật dữ liệu
          </div>
          <h1 className="mt-4 text-3xl md:text-4xl font-semibold text-white">
            Chính sách quyền riêng tư
          </h1>
          <p className="mt-2 max-w-3xl text-zinc-400">
            Chúng tôi tôn trọng dữ liệu của bạn. Tài liệu này giải thích IMOS thu thập gì, tại sao,
            cách chúng tôi bảo vệ, lưu trữ và bạn có quyền gì đối với dữ liệu cá nhân.
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
          <Section title="Mục đích" badge="1">
            <p>
              Cung cấp dịch vụ bản đồ, nâng cao hiệu năng, đảm bảo an toàn, hỗ trợ người dùng và tuân thủ pháp lý.
            </p>
          </Section>
          <Section title="Nguyên tắc" badge="2">
            <ul className="list-disc pl-5">
              <li>Thu thập tối thiểu, minh bạch, bảo mật nghiêm ngặt.</li>
              <li>RBAC theo vai trò; chỉ dùng cho mục đích đã nêu.</li>
            </ul>
          </Section>
          <Section title="Quyền của bạn" badge="3">
            <ul className="list-disc pl-5">
              <li>Truy cập, sửa, tải xuống, xoá; giới hạn/ phản đối xử lý.</li>
              <li>Rút lại đồng ý với tiếp thị bất kỳ lúc nào.</li>
            </ul>
          </Section>
        </div>

        <Section title="1) Phạm vi áp dụng">
          <p>
            Áp dụng cho toàn bộ sản phẩm/dịch vụ IMOS: tài khoản, tổ chức, bản đồ, lớp dữ liệu, chia sẻ, xuất bản, thanh toán.
          </p>
        </Section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-8">
          <Section title="2) Dữ liệu chúng tôi thu thập" badge="dot">
            <ul className="list-disc pl-5">
              <li>Họ tên, email, điện thoại, mật khẩu (băm).</li>
              <li>Tổ chức/Workspace: tên, biểu trưng, vai trò, quyền.</li>
              <li>Nhật ký sử dụng (ẩn danh khi tổng hợp), ticket hỗ trợ.</li>
              <li>Giao dịch qua cổng thanh toán; IMOS không lưu thẻ.</li>
              <li>Dữ liệu bản đồ tải lên, metadata, phiên bản.</li>
              <li>Email/OTP xác minh & thông báo hệ thống.</li>
            </ul>
          </Section>

          <Section title="3) Mục đích sử dụng">
            <ul className="list-disc pl-5">
              <li>Cung cấp & duy trì tính năng bản đồ, xuất bản.</li>
              <li>Tối ưu hiệu năng (tiling, caching) & an toàn hệ thống.</li>
              <li>Phân tích ẩn danh để cải thiện sản phẩm, chống gian lận.</li>
              <li>Xử lý thanh toán, gói thành viên, hạn mức tài nguyên.</li>
              <li>Hỗ trợ kỹ thuật và thông báo vận hành cần thiết.</li>
            </ul>
          </Section>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-8">
          <Section title="4) Cookie & tuỳ chọn theo dõi">
            <p>Cookie phiên/bảo mật là bắt buộc; cookie tuỳ chọn cho ngôn ngữ, theme, phân tích ẩn danh.</p>
          </Section>
          <Section title="5) Cơ sở pháp lý xử lý">
            <ul className="list-disc pl-5">
              <li>Thực hiện hợp đồng/dịch vụ.</li>
              <li>Lợi ích hợp pháp: bảo mật, chống gian lận, cải tiến.</li>
              <li>Tuân thủ luật thuế/kế toán/bảo mật.</li>
              <li>Đồng ý của bạn cho tiếp thị.</li>
            </ul>
          </Section>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-8">
          <Section title="6) Lưu trữ & thời hạn">
            <ul className="list-disc pl-5">
              <li>Tài khoản: trong thời gian dùng + 24 tháng sau khi đóng.</li>
              <li>Bản đồ/xuất bản: theo chính sách dự án/tổ chức.</li>
              <li>Giao dịch/hoá đơn: theo luật (thường 10 năm).</li>
              <li>Nhật ký hệ thống: 6–24 tháng.</li>
            </ul>
          </Section>
          <Section title="7) Bảo mật">
            <ul className="list-disc pl-5">
              <li>TLS 1.3, AES-256 cho dữ liệu nhạy cảm khi lưu.</li>
              <li>RBAC (Guest/Educator/Org Admin/System Admin).</li>
              <li>Kiểm thử bảo mật, nhật ký kiểm toán, sao lưu.</li>
            </ul>
          </Section>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-8">
          <Section title="8) Chia sẻ với bên thứ ba">
            <ul className="list-disc pl-5">
              <li>Cổng thanh toán (PayOS/Stripe/VNPay).</li>
              <li>Lưu trữ đám mây (VD: Azure Blob) cho tệp/xuất bản.</li>
              <li>Dịch vụ email/OTP. Không bán dữ liệu cá nhân.</li>
            </ul>
          </Section>
          <Section title="9) Quyền & cách thực hiện">
            <ol className="list-decimal pl-5">
              <li>Truy cập/sửa/xoá/giới hạn/di chuyển dữ liệu.</li>
              <li>Phản đối xử lý; rút đồng ý tiếp thị.</li>
              <li>Gửi yêu cầu qua <a className="text-emerald-300 underline" href="/resources/help-center">Trung tâm trợ giúp</a>.</li>
            </ol>
          </Section>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mt-8">
          <Section title="10) Trẻ em">
            <p>Không hướng đến trẻ em dưới 13 tuổi. Nếu phát hiện, chúng tôi sẽ xoá theo yêu cầu hợp lệ.</p>
          </Section>
          <Section title="11) Truyền dữ liệu quốc tế">
            <p>Áp dụng biện pháp bảo vệ tương đương khi truyền dữ liệu qua biên giới.</p>
          </Section>
          <Section title="12) Thay đổi chính sách">
            <p>Thông báo trước trong ứng dụng/email khi có cập nhật quan trọng.</p>
          </Section>
        </div>

        {/* CTA */}
        <div data-reveal className="mt-12">
          <div className="rounded-3xl p-6 md:p-8 ring-1 ring-white/10 bg-gradient-to-br from-emerald-500 to-emerald-600 text-white text-center">
            <h3 className="text-xl md:text-2xl font-extrabold tracking-tight">
              Cần trợ giúp về dữ liệu cá nhân?
            </h3>
            <p className="mt-1 opacity-90">Gửi yêu cầu quyền riêng tư, báo cáo sự cố hoặc đặt câu hỏi cho đội ngũ IMOS.</p>
            <div className="mt-4 flex items-center justify-center gap-3">
              <a href="/resources/help-center" className="rounded-lg bg-white text-emerald-700 px-5 py-2.5 font-semibold hover:bg-gray-100">
                Trung tâm trợ giúp
              </a>
              <a href="/contact" className="rounded-lg ring-1 ring-white/60 px-5 py-2.5 font-semibold hover:bg-white/10">
                Liên hệ chúng tôi
              </a>
            </div>
          </div>
          <p className="mt-6 text-center text-xs text-zinc-400">Hiệu lực: 09/11/2025 • Phiên bản 1.0</p>
        </div>
      </div>
    </main>
  );
}
