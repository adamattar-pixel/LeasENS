'use client';

export function QRCode({ ensName }: { ensName: string }) {
  const src = `/api/qr/${encodeURIComponent(ensName)}`;

  return (
    <div className="border-t border-gray-200 pt-3">
      <p className="text-xs text-gray-500 mb-3">Payment QR Code</p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={`QR code for ${ensName}`} className="mx-auto w-48 h-48" />
    </div>
  );
}

