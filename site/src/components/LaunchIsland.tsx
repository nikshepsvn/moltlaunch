import TokenGrid from './TokenGrid';
import { useTokens } from '../hooks/useTokens';
import { useEthPrice } from '../hooks/useEthPrice';

export default function LaunchIsland() {
  useTokens();
  useEthPrice();

  return <TokenGrid />;
}
