import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Product Manager',
};

export default function DashboardPage() {
  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold">Product Manager</h1>
    </main>
  );
}
