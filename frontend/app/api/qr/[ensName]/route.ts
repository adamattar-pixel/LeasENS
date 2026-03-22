import { NextRequest, NextResponse } from 'next/server';
import QRCode from 'qrcode';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ ensName: string }> }
) {
  const { ensName: rawEnsName } = await params;
  const ensName = decodeURIComponent(rawEnsName);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const paymentUrl = `${appUrl}/pay/${ensName}`;

  try {
    const buffer = await QRCode.toBuffer(paymentUrl, {
      type: 'png',
      width: 300,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    });

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Failed to generate QR code' }, { status: 500 });
  }
}
