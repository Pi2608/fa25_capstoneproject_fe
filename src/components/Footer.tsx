// components/Footer.tsx

export default function Footer() {
  return (
    <footer className="bg-black/70 text-gray-400 text-sm py-10 px-6 mt-20">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between gap-6">
        <div>
          <h3 className="text-white font-semibold mb-2">IMOS</h3>
          <p>Map your world with precision and simplicity.</p>
        </div>
        <div>
          <h4 className="text-white font-medium mb-2">Contact</h4>
          <p>Email: support@imos.com</p>
          <p>Phone: +1 (555) 123-4567</p>
        </div>
      </div>
    </footer>
  );
}
