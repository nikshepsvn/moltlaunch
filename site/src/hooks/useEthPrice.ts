import { useEffect } from 'react';
import { useTokenStore } from '../stores/tokenStore';

export function useEthPrice(): number {
  const ethUsdPrice = useTokenStore((s) => s.ethUsdPrice);
  const setEthUsdPrice = useTokenStore((s) => s.setEthUsdPrice);

  useEffect(() => {
    let cancelled = false;

    async function fetchPrice() {
      try {
        const res = await fetch(
          'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd',
        );
        const data = await res.json();
        const price = data.ethereum?.usd ?? 0;
        if (!cancelled && price > 0) {
          setEthUsdPrice(price);
        }
      } catch {
        // silently fail
      }
    }

    fetchPrice();
    return () => { cancelled = true; };
  }, [setEthUsdPrice]);

  return ethUsdPrice;
}
