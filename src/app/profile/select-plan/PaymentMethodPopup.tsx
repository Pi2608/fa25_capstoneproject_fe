import React, { useState } from 'react';

type PaymentMethod = 'payOS' | 'vnPay';

interface PaymentMethodPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectMethod: (method: PaymentMethod) => void;
  planName?: string;
  planPrice?: number;
}

const PaymentMethodPopup: React.FC<PaymentMethodPopupProps> = ({
  isOpen,
  onClose,
  onSelectMethod,
  planName = "Premium Plan",
  planPrice = 0.1
}) => {
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);

  if (!isOpen) return null;

  const handleMethodSelect = (method: PaymentMethod) => {
    if (method === 'vnPay') return;
    setSelectedMethod(method);
  };

  const handleConfirm = () => {
    if (selectedMethod && selectedMethod !== 'vnPay') {
      onSelectMethod(selectedMethod);
      onClose();
    }
  };

  const formatUSD = (price: number) => `$${price.toFixed(2)}`;

  const paymentMethods = [
    {
      id: 'payOS' as PaymentMethod,
      name: 'PayOS',
      description: 'PayOS – Fast & Secure',
      icon: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 48 48"><path fill="currentColor" d="M16.25 4A4.25 4.25 0 0 0 12 8.25v31.5A4.25 4.25 0 0 0 16.25 44h15.5A4.25 4.25 0 0 0 36 39.75V8.25A4.25 4.25 0 0 0 31.75 4zM14.5 8.25c0-.966.784-1.75 1.75-1.75h15.5c.967 0 1.75.784 1.75 1.75v31.5a1.75 1.75 0 0 1-1.75 1.75h-15.5a1.75 1.75 0 0 1-1.75-1.75zm6.75 27.25a1.25 1.25 0 1 0 0 2.5h5.5a1.25 1.25 0 1 0 0-2.5z"/></svg>,
      available: true,
      popular: true
    }
  ];

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-50">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-zinc-100">
                Select a payment method
            </h2>
            <p className="text-sm text-zinc-400 mt-1">
              {planName} - {formatUSD(planPrice)}/month
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Payment Methods */}
        <div className="space-y-3 mb-6">
          {paymentMethods.map((method) => (
            <div
              key={method.id}
              className={`
                relative rounded-xl border p-4 cursor-pointer transition-all
                ${!method.available 
                  ? 'border-zinc-700 bg-zinc-800/30 opacity-60 cursor-not-allowed' 
                  : selectedMethod === method.id
                    ? 'border-emerald-400/60 bg-emerald-500/10 ring-1 ring-emerald-400/40'
                    : 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-600 hover:bg-zinc-800/70'
                }
              `}
              onClick={() => method.available && handleMethodSelect(method.id)}
            >
              {/* Popular badge */}
              {method.popular && method.available && (
                <div className="absolute -top-2 -right-2 bg-emerald-500 text-zinc-900 text-xs font-semibold px-2 py-1 rounded-full">
                  Popular
                </div>
              )}
              
              <div className="flex items-center gap-3">
                <div className={`
                  p-2 rounded-lg 
                  ${!method.available 
                    ? 'bg-zinc-700 text-zinc-500' 
                    : selectedMethod === method.id
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-zinc-700 text-zinc-300'
                  }
                `}>
                  {method.icon}
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className={`font-medium ${
                      !method.available ? 'text-zinc-500' : 'text-zinc-100'
                    }`}>
                      {method.name}
                    </h3>
                    {!method.available && (
                      <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full">
                        Under maintenance
                      </span>
                    )}
                  </div>
                  <p className={`text-sm ${
                    !method.available ? 'text-zinc-600' : 'text-zinc-400'
                  }`}>
                    {method.description}
                  </p>
                </div>
                
                {method.available && (
                  <div className={`
                    w-4 h-4 rounded-full border-2 transition-colors
                    ${selectedMethod === method.id
                      ? 'border-emerald-400 bg-emerald-400'
                      : 'border-zinc-600'
                    }
                  `}>
                    {selectedMethod === method.id && (
                      <div className="w-full h-full rounded-full bg-emerald-400 scale-50"></div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-zinc-600 text-zinc-300 rounded-xl hover:bg-zinc-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedMethod || selectedMethod === 'vnPay'}
            className="flex-1 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:bg-zinc-700 disabled:text-zinc-500 disabled:cursor-not-allowed text-zinc-900 font-semibold rounded-xl transition-colors"
          >
            Continue
          </button>
        </div>

        {/* Security note */}
        <p className="text-xs text-zinc-500 text-center mt-4">
          All transactions are encrypted and secured.
        </p>
      </div>
    </div>
  );
};

export default PaymentMethodPopup;