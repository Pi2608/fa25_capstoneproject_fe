"use client";

export default function ProfileInfoPage() {
  return (
    <>
      <h1 className="text-3xl font-semibold mb-4">Thông tin cá nhân</h1>
      <p className="text-zinc-400">Chi tiết cá nhân của bạn sẽ hiển thị ở đây.</p>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
        <div className="bg-zinc-800/40 p-4 rounded border border-white/10">
          <div className="text-zinc-400 mb-1">Họ và tên</div>
          <div className="text-white font-medium">(đang tải...)</div>
        </div>
        <div className="bg-zinc-800/40 p-4 rounded border border-white/10">
          <div className="text-zinc-400 mb-1">Email</div>
          <div className="text-white font-medium">(đang tải...)</div>
        </div>
      </div>
    </>
  );
}
