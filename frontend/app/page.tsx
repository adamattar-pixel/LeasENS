export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-16 text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">ENS Lease Pay</h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto mb-8">
            Fake QR code? ENS name does not exist. Payment blocked.
          </p>

          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 max-w-xl mx-auto mb-8">
            <p className="font-semibold text-blue-900 text-lg mb-1">Anti-Scam Guarantee</p>
            <p className="text-blue-700 text-sm">
              Payment links are verified on-chain against active ENS lease records before any USDC moves.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href="/onboarding"
              className="inline-block bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors"
            >
              I&apos;m a Tenant
            </a>
            <a
              href="/owner/dashboard"
              className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors"
            >
              I&apos;m an Owner
            </a>
          </div>

          <p className="text-xs text-gray-500 mt-4">
            Property Manager setup: <a href="/onboard/add-owner" className="underline">Add Owner</a>
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-12">
        <h2 className="text-xl font-bold text-gray-900 text-center mb-8">How it works</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
          <div>
            <div className="bg-blue-100 text-blue-700 font-bold text-lg w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-3">
              1
            </div>
            <p className="font-semibold text-gray-900 mb-1">Owner creates lease subname</p>
            <p className="text-sm text-gray-500">A tenant subname is minted under owner.parent.eth.</p>
          </div>
          <div>
            <div className="bg-blue-100 text-blue-700 font-bold text-lg w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-3">
              2
            </div>
            <p className="font-semibold text-gray-900 mb-1">Tenant receives payment link</p>
            <p className="text-sm text-gray-500">Same URL powers both clickable link and QR code.</p>
          </div>
          <div>
            <div className="bg-blue-100 text-blue-700 font-bold text-lg w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-3">
              3
            </div>
            <p className="font-semibold text-gray-900 mb-1">App verifies then pays</p>
            <p className="text-sm text-gray-500">Invalid or fake names are blocked before payment.</p>
          </div>
        </div>
      </div>

      <div className="bg-white border-t border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-8 text-center">
          <p className="text-sm text-gray-500 mb-3">
            Any ENS-aware app can verify lease identity.
          </p>
          <a
            href="/verify"
            className="inline-block border-2 border-blue-600 text-blue-600 hover:bg-blue-50 font-semibold py-2 px-6 rounded-xl transition-colors text-sm"
          >
            Verify an ENS Lease
          </a>
        </div>
      </div>
    </div>
  );
}

