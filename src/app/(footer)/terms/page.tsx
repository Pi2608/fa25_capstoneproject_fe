import type { Metadata } from "next";
import RevealOnScroll from "./RevealOnScroll";

export const metadata: Metadata = {
  title: "Điều khoản sử dụng — IMOS",
  description:
    "Các điều khoản điều chỉnh việc truy cập và sử dụng IMOS: tài khoản, giới hạn sử dụng, bản quyền, thanh toán, chấm dứt, miễn trừ, trách nhiệm và giải quyết tranh chấp.",
};

const Section = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <section data-reveal className="rounded-2xl ring-1 ring-white/10 bg-white/5 p-5">
    <h2 className="font-semibold text-white">{title}</h2>
    <div className="prose prose-invert prose-zinc max-w-none mt-2">{children}</div>
  </section>
);

export default function TermsPage() {
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
        {/* HERO */}
        <header data-reveal className="mb-10">
          <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-white/10 bg-white/5 text-emerald-300">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Điều chỉnh việc sử dụng IMOS
          </div>
          <h1 className="mt-4 text-3xl md:text-4xl font-semibold text-white">
            Điều khoản sử dụng
          </h1>
          <p className="mt-2 max-w-3xl text-zinc-400">
            Vui lòng đọc kỹ trước khi dùng IMOS. Khi truy cập hoặc sử dụng dịch vụ, bạn đồng ý với những điều khoản dưới đây.
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
          <Section title="Phạm vi áp dụng">
            <p>
              Áp dụng cho tất cả sản phẩm, trang web và dịch vụ IMOS (tài khoản, tổ chức, workspace, bản đồ, lớp dữ liệu, xuất bản và thanh toán).
            </p>
          </Section>
          <Section title="Chấp nhận điều khoản">
            <p>
              Dùng IMOS nghĩa là bạn đã chấp nhận bản điều khoản hiện hành và mọi cập nhật sau này. Nếu không đồng ý, vui lòng ngừng sử dụng.
            </p>
          </Section>
          <Section title="Cập nhật & thông báo">
            <p>
              IMOS có thể sửa đổi điều khoản. Thay đổi quan trọng sẽ được thông báo trong ứng dụng/email và có hiệu lực kể từ ngày công bố.
            </p>
          </Section>
        </div>

        <Section title="1) Tài khoản & bảo mật">
          <ul className="list-disc pl-5">
            <li>Thông tin đăng ký phải chính xác, đầy đủ và được cập nhật.</li>
            <li>Bạn chịu trách nhiệm giữ bí mật thông tin đăng nhập và mọi hoạt động dưới tài khoản của mình.</li>
            <li>IMOS có thể tạm khoá hoặc chấm dứt tài khoản khi phát hiện vi phạm, gian lận hoặc rủi ro bảo mật.</li>
          </ul>
        </Section>

        <Section title="2) Quy tắc sử dụng hợp lệ">
          <ul className="list-disc pl-5">
            <li>Không gây gián đoạn, thăm dò lỗ hổng, vượt qua hoặc vô hiệu hoá biện pháp bảo mật.</li>
            <li>Không tải lên nội dung vi phạm pháp luật, bản quyền, quyền riêng tư, hoặc chứa mã độc.</li>
            <li>Tuân thủ chính sách giới hạn/“fair use” (xem Mục 5) và mọi hướng dẫn kỹ thuật.</li>
          </ul>
        </Section>

        <Section title="3) Nội dung & quyền sở hữu trí tuệ">
          <ul className="list-disc pl-5">
            <li>
              <strong>Nội dung của bạn</strong>: bạn giữ quyền sở hữu. Bằng cách tải lên, bạn cấp cho IMOS giấy phép không độc quyền để lưu trữ, xử lý, sao lưu và hiển thị nội dung nhằm vận hành dịch vụ.
            </li>
            <li>
              <strong>Nội dung của IMOS</strong> (mã nguồn, thiết kế, tài liệu, nhãn hiệu) thuộc IMOS và/hoặc đối tác cấp phép; bạn không được sao chép, sửa đổi hoặc khai thác ngoài phạm vi được cho phép.
            </li>
          </ul>
        </Section>

        <Section title="4) Gói dịch vụ, thanh toán & hoàn phí">
          <ul className="list-disc pl-5">
            <li>Giá, tính năng và hạn mức của từng gói được công bố trong trang Bảng giá.</li>
            <li>Thanh toán qua cổng được hỗ trợ; IMOS không lưu thông tin thẻ.</li>
            <li>Phí đã thanh toán có thể không được hoàn lại trừ khi luật bắt buộc hoặc IMOS nêu rõ.</li>
            <li>Việc hạ/cấp gói có thể thay đổi hạn mức tài nguyên và chu kỳ tính phí tiếp theo.</li>
          </ul>
        </Section>

        <Section title="5) Giới hạn kỹ thuật & Fair Use">
          <ul className="list-disc pl-5">
            <li>Áp dụng hạn mức hợp lý đối với không gian lưu trữ, số yêu cầu API, băng thông, tốc độ xuất bản.</li>
            <li>IMOS có quyền điều chỉnh tạm thời để bảo vệ hệ thống cho toàn bộ người dùng.</li>
          </ul>
        </Section>

        <Section title="6) Dịch vụ bên thứ ba">
          <p>
            IMOS có thể tích hợp cổng thanh toán, lưu trữ đám mây, dịch vụ email/OTP, nền tảng bản đồ… Việc bạn sử dụng những dịch vụ này cũng chịu ràng buộc bởi điều khoản của nhà cung cấp tương ứng.
          </p>
        </Section>

        <Section title="7) Dữ liệu cá nhân & quyền riêng tư">
          <p>
            Cách IMOS thu thập, sử dụng, lưu trữ và bảo vệ dữ liệu cá nhân được mô tả tại{" "}
            <a href="/privacy" className="text-emerald-300 underline">Chính sách quyền riêng tư</a>.
          </p>
        </Section>

        <Section title="8) Bảo mật & tính sẵn sàng">
          <ul className="list-disc pl-5">
            <li>Áp dụng TLS khi truyền và mã hoá thích hợp khi lưu trữ dữ liệu nhạy cảm.</li>
            <li>Có sao lưu định kỳ và quy trình khôi phục; không bảo đảm không gián đoạn tuyệt đối.</li>
          </ul>
        </Section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-8">
          <Section title="9) Miễn trừ trách nhiệm">
            <p>
              Dịch vụ được cung cấp “như hiện có”. Trong phạm vi luật cho phép, IMOS từ chối mọi bảo đảm ngụ ý về khả năng thương mại, phù hợp mục đích cụ thể và không xâm phạm.
            </p>
          </Section>
          <Section title="10) Giới hạn trách nhiệm">
            <p>
              IMOS không chịu trách nhiệm với bất kỳ thiệt hại gián tiếp, đặc biệt, hệ quả, mất dữ liệu hay lợi nhuận. Tổng trách nhiệm của IMOS cho mọi yêu cầu sẽ không vượt quá tổng phí bạn đã trả trong 12 tháng trước thời điểm phát sinh yêu cầu.
            </p>
          </Section>
        </div>

        <Section title="11) Bồi thường">
          <p>
            Bạn đồng ý bồi thường, bảo vệ IMOS trước mọi khiếu nại phát sinh từ việc bạn sử dụng dịch vụ trái điều khoản, vi phạm pháp luật hoặc quyền của bên thứ ba.
          </p>
        </Section>

        <Section title="12) Chấm dứt">
          <ul className="list-disc pl-5">
            <li>Bạn có thể ngừng sử dụng và xoá tài khoản bất kỳ lúc nào theo hướng dẫn trong ứng dụng.</li>
            <li>IMOS có thể chấm dứt hoặc tạm ngừng cung cấp nếu phát hiện vi phạm, gian lận, rủi ro bảo mật, hoặc theo yêu cầu pháp luật.</li>
            <li>Một số điều khoản vẫn tiếp tục có hiệu lực sau khi chấm dứt (bản quyền, giới hạn trách nhiệm, bồi thường…).</li>
          </ul>
        </Section>

        <Section title="13) Luật điều chỉnh & giải quyết tranh chấp">
          <ul className="list-disc pl-5">
            <li>Điều khoản chịu sự điều chỉnh của pháp luật hiện hành tại nơi IMOS đăng ký hoạt động.</li>
            <li>Tranh chấp trước hết sẽ được thương lượng thiện chí; nếu không đạt kết quả, sẽ giải quyết tại toà án có thẩm quyền hoặc trọng tài theo quy định.</li>
          </ul>
        </Section>

        <div data-reveal className="mt-12">
          <div className="rounded-3xl p-6 md:p-8 ring-1 ring-white/10 bg-gradient-to-br from-emerald-500 to-emerald-600 text-white text-center">
            <h3 className="text-xl md:text-2xl font-extrabold tracking-tight">
              Cần làm rõ điều khoản?
            </h3>
            <p className="mt-1 opacity-90">
              Liên hệ đội ngũ IMOS để được giải thích, hỗ trợ hoặc nhận hướng dẫn tuân thủ.
            </p>
            <div className="mt-4 flex items-center justify-center gap-3">
              <a
                href="/resources/help-center"
                className="rounded-lg bg-white text-emerald-700 px-5 py-2.5 font-semibold hover:bg-gray-100"
              >
                Trung tâm trợ giúp
              </a>
              <a
                href="/contact"
                className="rounded-lg ring-1 ring-white/60 px-5 py-2.5 font-semibold hover:bg-white/10"
              >
                Liên hệ chúng tôi
              </a>
            </div>
          </div>
          <p className="mt-6 text-center text-xs text-zinc-400">
            Hiệu lực: 09/11/2025 • Phiên bản 1.0
          </p>
        </div>
      </div>
    </main>
  );
}
