# Trenchling
Solana memecoin finder and wallet tracker. Static site, no build step, no API keys.

Deploy: push this folder to a GitHub repo, then Settings > Pages > Deploy from branch > main / root.

Data: DexScreener and GeckoTerminal public APIs, Solana public RPC. The "Follow wallets" list is demo data until you plug in an indexer (see `recWallet()` in js/app.js).
Not financial advice. Risk scores are heuristics and cannot read a token's contract.
