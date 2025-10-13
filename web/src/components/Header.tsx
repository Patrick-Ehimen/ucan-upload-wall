export function Header() {
  return (
    <header className="w-full bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            🔐 UCAN Upload Wall <span className="text-lg text-blue-600">(Browser-Only)</span>
          </h1>
          <p className="text-sm text-gray-600">
            WebAuthn DID + Storacha Network • No Servers • Full P2P • Hardware-Secured
          </p>
        </div>
      </div>
    </header>
  );
}
