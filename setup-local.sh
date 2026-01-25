#!/bin/bash
#
# Setup script for mdash.local with HTTPS
# Run with: sudo ./setup-local.sh
#

set -e

echo "☀️  Setting up mdash.local..."
echo

# Add hosts entry
if grep -q "mdash.local" /etc/hosts 2>/dev/null; then
  echo "✓ mdash.local already in /etc/hosts"
else
  echo "127.0.0.1  mdash.local" >> /etc/hosts
  echo "✓ Added mdash.local to /etc/hosts"
fi

# Install mkcert CA (makes certs trusted)
if command -v mkcert &> /dev/null; then
  echo "Installing mkcert CA for trusted HTTPS..."
  mkcert -install
  echo "✓ mkcert CA installed"
else
  echo "⚠ mkcert not found - HTTPS will show certificate warning"
  echo "  Install with: brew install mkcert"
fi

echo
echo "✨ Setup complete!"
echo
echo "Access your dashboard at: https://mdash.local"
echo
