export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-16 text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">ENS Lease Pay</h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto mb-8">
            On-chain rental payments secured by ENS subnames. Every lease is a verifiable identity on Ethereum &mdash; no fake invoices, no scam QR codes.
          </p>

          {/* Anti-scam guarantee */}
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 max-w-lg mx-auto">
            <div className="text-3xl mb-2">&#x1F6E1;</div>
            <p className="font-semibold text-blue-900 text-lg mb-1">Anti-Scam Guarantee</p>
            <p className="text-blue-700 text-sm">
              Fake QR code? The ENS name doesn&apos;t exist on-chain. <span className="font-semibold">Payment blocked.</span> Only verified lease subnames resolve to a valid address &mdash; everything else is rejected automatically.
            </p>
          </div>
        </div>
      </div>

      {/* Three Personas */}
      <div className="max-w-4xl mx-auto px-4 py-12">
        <h2 className="text-xl font-bold text-gray-900 text-center mb-8">Choose your role</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Property Manager */}
          <div className="bg-white rounded-2xl shadow-lg p-6 flex flex-col">
            <div className="text-3xl mb-3">&#x1F3E2;</div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">Property Manager</h3>
            <p className="text-sm text-gray-500 mb-4 flex-1">
              Register owners as ENS subnames under your property. Each owner gets a verifiable on-chain identity like <span className="font-mono text-blue-600">dupont.residence.eth</span>.
            </p>
            <a
              href="/onboard/add-owner"
              className="block w-full bg-gray-900 hover:bg-gray-800 text-white font-semibold py-3 px-4 rounded-xl transition-colors text-center text-sm"
            >
              Register an Owner
            </a>
          </div>

          {/* Owner */}
          <div className="bg-white rounded-2xl shadow-lg p-6 flex flex-col">
            <div className="text-3xl mb-3">&#x1F3E0;</div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">Owner</h3>
            <p className="text-sm text-gray-500 mb-4 flex-1">
              Create leases for your tenants. Each lease mints an ENS subname with on-chain text records &mdash; rent amount, due dates, and tenant identity are all public and verifiable.
            </p>
            <a
              href="/owner/dashboard"
              className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-xl transition-colors text-center text-sm"
            >
              Owner Dashboard
            </a>
          </div>

          {/* Tenant */}
          <div className="bg-white rounded-2xl shadow-lg p-6 flex flex-col">
            <div className="text-3xl mb-3">&#x1F464;</div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">Tenant</h3>
            <p className="text-sm text-gray-500 mb-4 flex-1">
              Onboard with email, get a verified identity, and pay rent with USDC. Your payment link is tied to your ENS subname &mdash; impossible to fake.
            </p>
            <a
              href="/onboarding"
              className="block w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-4 rounded-xl transition-colors text-center text-sm"
            >
              Tenant Onboarding
            </a>
          </div>
        </div>
      </div>

      {/* How it works */}
      <div className="bg-white border-t border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-12">
          <h2 className="text-xl font-bold text-gray-900 text-center mb-8">How it works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            <div>
              <div className="bg-blue-100 text-blue-700 font-bold text-lg w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-3">1</div>
              <p className="font-semibold text-gray-900 mb-1">Property Manager registers owners</p>
              <p className="text-sm text-gray-500">Each owner gets an ENS subname under the property domain.</p>
            </div>
            <div>
              <div className="bg-blue-100 text-blue-700 font-bold text-lg w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-3">2</div>
              <p className="font-semibold text-gray-900 mb-1">Owner creates a lease</p>
              <p className="text-sm text-gray-500">Mints a tenant subname with rent amount, due dates, and penalty terms written on-chain.</p>
            </div>
            <div>
              <div className="bg-blue-100 text-blue-700 font-bold text-lg w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-3">3</div>
              <p className="font-semibold text-gray-900 mb-1">Tenant pays via QR code</p>
              <p className="text-sm text-gray-500">Scan the QR, ENS name is verified on-chain, and USDC is transferred directly. No middlemen.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center py-6 text-xs text-gray-400">
        Built for the StableCoins &amp; Payments Hackathon &mdash; BSA &times; EPFL &mdash; ENS Track
      </div>
    </div>
  );
}
