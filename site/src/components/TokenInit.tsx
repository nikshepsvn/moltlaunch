import { useTokens } from '../hooks/useTokens';
import { useEthPrice } from '../hooks/useEthPrice';

/** Invisible component that kicks off token discovery and ETH price fetching */
export default function TokenInit() {
  useTokens();
  useEthPrice();
  return null;
}
