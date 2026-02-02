import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNetworkStore, type SwapAnimation } from '../stores/networkStore';
import type { NetworkAgent as Agent, CrossHoldingEdge, SwapEvent } from '@moltlaunch/shared';

interface GraphNode {
  id: string;
  label: string;
  symbol: string;
  image: string;
  mcap: number;
  powerScore: number;
  flaunchUrl: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  connected: boolean; // has edges
}

interface GraphEdge {
  source: string;
  target: string;
  weight: number;
}

// Simulation constants
const NODE_MIN_R = 10;
const NODE_MAX_R = 36;
const SPRING_LENGTH = 120;
const SPRING_K = 0.004;
const REPULSION = 5000;
const DAMPING = 0.82;
const CENTER_GRAVITY = 0.002;
const ITERATIONS_PER_FRAME = 3;
const ENERGY_THRESHOLD = 0.5;
const OUTER_RING_PADDING = 60;
const MAX_SIM_TIME = 10_000; // 10s max simulation
const TAP_PULSE_MS = 300;
const MOBILE_BREAKPOINT = 768;
const MOBILE_MIN_R = 16;

function scoreColor(score: number): string {
  if (score >= 75) return '#34d399';
  if (score >= 50) return '#a3e635';
  if (score >= 25) return '#fb923c';
  return '#ef4444';
}

function getMinRadius(): number {
  if (typeof window === 'undefined') return NODE_MIN_R;
  return window.innerWidth <= MOBILE_BREAKPOINT ? MOBILE_MIN_R : NODE_MIN_R;
}

export default function HoldingsGraph() {
  const agents = useNetworkStore((s) => s.agents);
  const crossEdges = useNetworkStore((s) => s.crossEdges);
  const swaps = useNetworkStore((s) => s.swaps);
  const animationQueue = useNetworkStore((s) => s.animationQueue);
  const recentlyActiveNodes = useNetworkStore((s) => s.recentlyActiveNodes);
  const expireAnimations = useNetworkStore((s) => s.expireAnimations);
  const setSelectedAgent = useNetworkStore((s) => s.setSelectedAgent);

  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [tappedNode, setTappedNode] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const nodesRef = useRef<GraphNode[]>([]);
  const edgesRef = useRef<GraphEdge[]>([]);
  const animRef = useRef<number | null>(null);
  const [renderTick, setRenderTick] = useState(0);
  const simulatingRef = useRef(false);
  const simStartTimeRef = useRef(0);
  const tapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Drag state
  const dragNodeRef = useRef<string | null>(null);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const didDragRef = useRef(false);

  // ResizeObserver for responsive sizing
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) {
        setDimensions({ width, height });
      }
    });

    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Cleanup tap timeout on unmount
  useEffect(() => {
    return () => {
      if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current);
    };
  }, []);

  const { width: W, height: H } = dimensions;
  const minR = getMinRadius();

  // Unified click handler: select + show tooltip + pulse
  const handleNodeClick = useCallback((nodeId: string) => {
    setHoveredNode(nodeId);
    setSelectedAgent(nodeId);
    setTappedNode(nodeId);

    if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current);
    tapTimeoutRef.current = setTimeout(() => {
      setTappedNode(null);
      tapTimeoutRef.current = null;
    }, TAP_PULSE_MS);
  }, [setSelectedAgent]);

  // Background click: deselect (only if not dragging)
  const handleBackgroundClick = useCallback(() => {
    if (didDragRef.current) return;
    setSelectedAgent(null);
    setHoveredNode(null);
  }, [setSelectedAgent]);

  // Convert screen mouse coords to SVG viewBox coords
  const toSvgCoords = useCallback((clientX: number, clientY: number): { x: number; y: number } => {
    const svg = svgRef.current;
    if (!svg) return { x: clientX, y: clientY };
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: clientX, y: clientY };
    const svgPt = pt.matrixTransform(ctm.inverse());
    return { x: svgPt.x, y: svgPt.y };
  }, []);

  // Drag handlers
  const handleDragStart = useCallback((nodeId: string, clientX: number, clientY: number) => {
    dragNodeRef.current = nodeId;
    dragStartRef.current = toSvgCoords(clientX, clientY);
    didDragRef.current = false;
  }, [toSvgCoords]);

  const handleDragMove = useCallback((clientX: number, clientY: number) => {
    const nodeId = dragNodeRef.current;
    if (!nodeId) return;

    const svgPt = toSvgCoords(clientX, clientY);
    const node = nodesRef.current.find((n) => n.id === nodeId);
    if (!node) return;

    didDragRef.current = true;
    node.x = Math.max(NODE_MAX_R + 10, Math.min(W - NODE_MAX_R - 10, svgPt.x));
    node.y = Math.max(NODE_MAX_R + 10, Math.min(H - NODE_MAX_R - 10, svgPt.y));
    // Zero velocity so simulation doesn't fight the drag
    node.vx = 0;
    node.vy = 0;
    setRenderTick((t) => t + 1);
  }, [toSvgCoords, W, H]);

  const handleDragEnd = useCallback(() => {
    dragNodeRef.current = null;
    dragStartRef.current = null;
  }, []);

  // Attach document-level mousemove/mouseup for drag (avoids losing events outside SVG)
  useEffect(() => {
    const onMove = (e: MouseEvent) => handleDragMove(e.clientX, e.clientY);
    const onUp = () => handleDragEnd();
    const onTouchMove = (e: TouchEvent) => {
      if (!dragNodeRef.current) return;
      e.preventDefault();
      const touch = e.touches[0];
      if (touch) handleDragMove(touch.clientX, touch.clientY);
    };
    const onTouchEnd = () => handleDragEnd();

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', onTouchEnd);

    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
    };
  }, [handleDragMove, handleDragEnd]);

  // Build graph from agents + cross-holding edges + cross-trade swaps
  const buildGraph = useCallback(
    (agents: Agent[], verifiedEdges: CrossHoldingEdge[], swapEvents: SwapEvent[], w: number, h: number) => {
      const nodes: GraphNode[] = [];
      const edges: GraphEdge[] = [];

      if (agents.length === 0) return { nodes, edges };

      const cx = w / 2;
      const cy = h / 2;
      const nodeIds = new Set<string>();

      // Build creator->token lookup for swap-based edges
      const creatorToToken = new Map<string, string>();
      for (const a of agents) {
        nodeIds.add(a.tokenAddress);
        if (a.creator) creatorToToken.set(a.creator.toLowerCase(), a.tokenAddress);
        nodes.push({
          id: a.tokenAddress,
          label: a.name,
          symbol: a.symbol,
          image: a.image,
          mcap: a.marketCapETH,
          powerScore: a.powerScore.total,
          flaunchUrl: a.flaunchUrl,
          x: cx + (Math.random() - 0.5) * w * 0.5,
          y: cy + (Math.random() - 0.5) * h * 0.5,
          vx: 0,
          vy: 0,
          connected: false,
        });
      }

      // Build edges from verified cross-holding pairs
      const edgeWeights = new Map<string, number>();

      for (const edge of verifiedEdges) {
        if (!nodeIds.has(edge.tokenA) || !nodeIds.has(edge.tokenB)) continue;
        const edgeKey = [edge.tokenA, edge.tokenB].sort().join('-');
        edgeWeights.set(edgeKey, (edgeWeights.get(edgeKey) ?? 0) + 1);
      }

      // Build edges from cross-trade swaps (agent creator traded another agent's token)
      for (const swap of swapEvents) {
        if (!swap.isCrossTrade) continue;
        const makerToken = creatorToToken.get(swap.maker.toLowerCase());
        if (!makerToken || !nodeIds.has(makerToken) || !nodeIds.has(swap.tokenAddress)) continue;
        if (makerToken === swap.tokenAddress) continue;
        const edgeKey = [makerToken, swap.tokenAddress].sort().join('-');
        edgeWeights.set(edgeKey, (edgeWeights.get(edgeKey) ?? 0) + 1);
      }

      // Only show edges from verified cross-holdings and cross-trades
      // (removed: shared-trader edges were too noisy — random wallets trading 2+ tokens aren't meaningful)

      const seenEdgeKeys = new Set<string>();
      for (const [edgeKey, weight] of edgeWeights) {
        if (seenEdgeKeys.has(edgeKey)) continue;
        seenEdgeKeys.add(edgeKey);
        const [source, target] = edgeKey.split('-');
        edges.push({ source, target, weight });
      }

      // Mark connected nodes
      const connectedIds = new Set<string>();
      for (const e of edges) {
        connectedIds.add(e.source);
        connectedIds.add(e.target);
      }
      for (const n of nodes) {
        n.connected = connectedIds.has(n.id);
      }

      // Position isolated nodes in outer ring
      const isolated = nodes.filter((n) => !n.connected);
      if (isolated.length > 0) {
        const ringRadius = Math.min(w, h) / 2 - OUTER_RING_PADDING;
        isolated.forEach((node, i) => {
          const angle = (i / isolated.length) * Math.PI * 2 - Math.PI / 2;
          node.x = cx + Math.cos(angle) * ringRadius;
          node.y = cy + Math.sin(angle) * ringRadius;
        });
      }

      return { nodes, edges };
    },
    [],
  );

  // Force simulation — energy-aware with time cutoff
  const startSimulation = useCallback(() => {
    if (simulatingRef.current) return;
    simulatingRef.current = true;
    simStartTimeRef.current = Date.now();

    function simulate() {
      if (!simulatingRef.current) return;

      // Time cutoff to prevent infinite simulation
      if (Date.now() - simStartTimeRef.current > MAX_SIM_TIME) {
        simulatingRef.current = false;
        setRenderTick((t) => t + 1);
        return;
      }

      const nodes = nodesRef.current;
      const edges = edgesRef.current;
      if (nodes.length < 2) {
        simulatingRef.current = false;
        return;
      }

      let totalEnergy = 0;

      for (let iter = 0; iter < ITERATIONS_PER_FRAME; iter++) {
        const simNodes = nodes.filter((n) => n.connected);

        // Repulsion between connected nodes
        for (let i = 0; i < simNodes.length; i++) {
          for (let j = i + 1; j < simNodes.length; j++) {
            const dx = simNodes[j].x - simNodes[i].x;
            const dy = simNodes[j].y - simNodes[i].y;
            const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
            const force = REPULSION / (dist * dist);
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;
            simNodes[i].vx -= fx;
            simNodes[i].vy -= fy;
            simNodes[j].vx += fx;
            simNodes[j].vy += fy;
          }
        }

        // Spring forces along edges
        for (const edge of edges) {
          const a = nodes.find((n) => n.id === edge.source);
          const b = nodes.find((n) => n.id === edge.target);
          if (!a || !b) continue;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
          const force = (dist - SPRING_LENGTH) * SPRING_K;
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          a.vx += fx;
          a.vy += fy;
          b.vx -= fx;
          b.vy -= fy;
        }

        // Center gravity for connected nodes
        const cx = W / 2;
        const cy = H / 2;
        for (const node of simNodes) {
          node.vx += (cx - node.x) * CENTER_GRAVITY;
          node.vy += (cy - node.y) * CENTER_GRAVITY;
        }

        // Apply velocities with damping
        for (const node of simNodes) {
          node.vx *= DAMPING;
          node.vy *= DAMPING;
          node.x += node.vx;
          node.y += node.vy;
          node.x = Math.max(NODE_MAX_R + 10, Math.min(W - NODE_MAX_R - 10, node.x));
          node.y = Math.max(NODE_MAX_R + 10, Math.min(H - NODE_MAX_R - 10, node.y));
          totalEnergy += node.vx * node.vx + node.vy * node.vy;
        }
      }

      setRenderTick((t) => t + 1);

      if (totalEnergy > ENERGY_THRESHOLD) {
        animRef.current = requestAnimationFrame(simulate);
      } else {
        simulatingRef.current = false;
      }
    }

    animRef.current = requestAnimationFrame(simulate);
  }, [W, H]);

  // Rebuild graph when agents or dimensions change — also triggers simulation
  useEffect(() => {
    if (agents.length === 0) return;

    // Stop any running simulation
    simulatingRef.current = false;
    if (animRef.current) cancelAnimationFrame(animRef.current);

    const { nodes, edges } = buildGraph(agents, crossEdges, swaps, W, H);
    nodesRef.current = nodes;
    edgesRef.current = edges;
    setRenderTick((t) => t + 1);

    // Start fresh simulation after graph rebuild
    queueMicrotask(() => startSimulation());

    return () => {
      simulatingRef.current = false;
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [agents, crossEdges, swaps, W, H, buildGraph, startSimulation]);

  // Animation tick for swap animations — only runs when animations exist
  useEffect(() => {
    if (animationQueue.length === 0) return;

    let frameId: number;
    let lastExpire = Date.now();

    function tick() {
      const now = Date.now();
      if (now - lastExpire > 500) {
        expireAnimations();
        lastExpire = now;
      }
      setRenderTick((t) => t + 1);
      frameId = requestAnimationFrame(tick);
    }

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [animationQueue.length > 0]); // eslint-disable-line -- only toggle on empty/non-empty

  const nodes = nodesRef.current;
  const edges = edgesRef.current;

  const maxMcap = useMemo(
    () => Math.max(...nodes.map((n) => n.mcap), 0.01),
    [renderTick], // eslint-disable-line
  );

  // Build animation lookup
  const { activeAnims, activeEdgeAnims } = useMemo(() => {
    const anims = new Map<string, SwapAnimation>();
    const edgeAnims = new Set<string>();
    for (const anim of animationQueue) {
      anims.set(anim.sourceNode, anim);
      if (anim.isCross && anim.targetNode) {
        const edgeKey = [anim.sourceNode, anim.targetNode].sort().join('-');
        edgeAnims.add(edgeKey);
      }
    }
    return { activeAnims: anims, activeEdgeAnims: edgeAnims };
  }, [animationQueue]);

  // Recently active nodes from persistent store map (survives animation expiry)
  const recentlyActive = useMemo(() => {
    const now = Date.now();
    const active = new Set<string>();
    for (const [nodeId, ts] of recentlyActiveNodes) {
      if (now - ts < 60_000) active.add(nodeId);
    }
    return active;
  }, [recentlyActiveNodes, renderTick]); // renderTick ensures re-eval on animation frames

  if (nodes.length === 0) {
    return (
      <div ref={containerRef} className="w-full h-full flex items-center justify-center">
        <span className="font-mono text-[11px] text-crt-dim opacity-40">
          waiting for agents...
        </span>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full h-full">
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        viewBox={`0 0 ${W} ${H}`}
        className="bg-[#040101]"
        preserveAspectRatio="xMidYMid meet"
        style={{ touchAction: 'manipulation' }}
      >
        <defs>
          {/* Clip paths for agent images */}
          {nodes.map((node) => {
            const r = Math.max(minR, NODE_MIN_R + Math.sqrt(node.mcap / maxMcap) * (NODE_MAX_R - NODE_MIN_R));
            return (
              <clipPath key={`clip-${node.id}`} id={`clip-${node.id.slice(-8)}`}>
                <circle cx={node.x} cy={node.y} r={r - 1} />
              </clipPath>
            );
          })}

          {/* Glow filter for animated nodes */}
          <filter id="nodeGlow">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Arrowhead marker for cross-trade edge direction */}
          <marker id="arrowhead" viewBox="0 0 10 7" refX="10" refY="3.5"
                  markerWidth="6" markerHeight="5" orient="auto-start-reverse">
            <polygon points="0 0, 10 3.5, 0 7" fill="#a78bfa" opacity="0.5" />
          </marker>

          {/* Glow filter for cross-trade edges */}
          <filter id="edgeGlow">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Dot grid pattern */}
          <pattern id="dotGrid" width="30" height="30" patternUnits="userSpaceOnUse">
            <circle cx="15" cy="15" r="0.5" fill="#ff4444" opacity="0.08" />
          </pattern>

          {/* Center radial gradient */}
          <radialGradient id="centerGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ff4444" stopOpacity="0.04" />
            <stop offset="100%" stopColor="#ff4444" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Background click target for deselection */}
        <rect
          x="0"
          y="0"
          width={W}
          height={H}
          fill="transparent"
          onClick={handleBackgroundClick}
        />

        {/* Dot grid background */}
        <rect width={W} height={H} fill="url(#dotGrid)" pointerEvents="none" />

        {/* Center glow */}
        <rect width={W} height={H} fill="url(#centerGlow)" pointerEvents="none" />

        {/* Radar range rings */}
        {[0.2, 0.4, 0.6].map((pct, i) => (
          <circle
            key={`ring-${i}`}
            cx={W / 2}
            cy={H / 2}
            r={Math.min(W, H) * pct}
            fill="none"
            stroke="#1e0606"
            strokeWidth="0.5"
            opacity="0.3"
            pointerEvents="none"
          />
        ))}

        {/* Edges */}
        {edges.map((edge, i) => {
          const a = nodes.find((n) => n.id === edge.source);
          const b = nodes.find((n) => n.id === edge.target);
          if (!a || !b) return null;

          const isHovered = hoveredNode === edge.source || hoveredNode === edge.target;
          const edgeKey = [edge.source, edge.target].sort().join('-');
          const isAnimated = activeEdgeAnims.has(edgeKey);

          const baseWidth = Math.max(1, Math.log2(edge.weight + 1) * 1.5);

          return (
            <line
              key={i}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={isAnimated || isHovered ? '#a78bfa' : '#1e0606'}
              strokeWidth={isAnimated ? baseWidth + 0.5 : baseWidth}
              opacity={isAnimated ? 0.9 : isHovered ? 0.7 : 0.35}
              strokeDasharray={isAnimated ? '6 4' : 'none'}
              className={isAnimated ? 'dash-flow' : undefined}
              filter={isAnimated ? 'url(#edgeGlow)' : undefined}
              markerEnd={isAnimated ? 'url(#arrowhead)' : undefined}
            />
          );
        })}

        {/* Nodes */}
        {nodes.map((node) => {
          const r = Math.max(minR, NODE_MIN_R + Math.sqrt(node.mcap / maxMcap) * (NODE_MAX_R - NODE_MIN_R));
          const color = scoreColor(node.powerScore);
          const isHovered = hoveredNode === node.id;
          const isConnected =
            hoveredNode !== null &&
            edges.some(
              (e) =>
                (e.source === hoveredNode && e.target === node.id) ||
                (e.target === hoveredNode && e.source === node.id),
            );
          const dimmed = hoveredNode !== null && !isHovered && !isConnected;
          const opacity = dimmed ? 0.15 : isHovered ? 1 : 0.85;
          const anim = activeAnims.get(node.id);
          const isAnimating = !!anim;
          const animProgress = isAnimating
            ? Math.max(0, 1 - (Date.now() - anim.startTime) / 3000)
            : 0;
          const isTapped = tappedNode === node.id;

          return (
            <g
              key={node.id}
              onMouseEnter={() => { if (!dragNodeRef.current) setHoveredNode(node.id); }}
              onMouseLeave={() => { if (!dragNodeRef.current) setHoveredNode(null); }}
              onMouseDown={(e) => {
                e.stopPropagation();
                handleDragStart(node.id, e.clientX, e.clientY);
              }}
              onTouchStart={(e) => {
                const touch = e.touches[0];
                if (touch) handleDragStart(node.id, touch.clientX, touch.clientY);
              }}
              onClick={(e) => {
                e.stopPropagation();
                // Only fire click if we didn't drag
                if (!didDragRef.current) handleNodeClick(node.id);
              }}
              style={{ cursor: dragNodeRef.current === node.id ? 'grabbing' : 'grab' }}
            >
              {/* Idle breathing ring for connected nodes (gentle ambient pulse) */}
              {node.connected && !recentlyActive.has(node.id) && !isAnimating && (
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={r + 5}
                  fill="none"
                  stroke={color}
                  strokeWidth={1.5}
                  className="idle-breathe"
                />
              )}

              {/* Activity breathing ring for recently active nodes */}
              {recentlyActive.has(node.id) && !isAnimating && (
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={r + 5}
                  fill="none"
                  stroke={color}
                  strokeWidth={2}
                  className="activity-breathe"
                />
              )}

              {/* Tap pulse ring */}
              {isTapped && (
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={r + 4}
                  fill="none"
                  stroke="#34d399"
                  strokeWidth={2}
                  className="tap-pulse"
                />
              )}

              {/* Glow ring for animated nodes */}
              {isAnimating && (
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={r + 6 + (1 - animProgress) * 8}
                  fill="none"
                  stroke={anim.type === 'buy' ? '#34d399' : '#ef4444'}
                  strokeWidth={2}
                  opacity={animProgress * 0.6}
                  className="node-pulse"
                />
              )}

              {/* Score arc — partial circle showing power score percentage */}
              {(() => {
                const arcR = r + 4;
                const circumference = 2 * Math.PI * arcR;
                const scoreOffset = circumference * (1 - node.powerScore / 100);
                return (
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={arcR}
                    fill="none"
                    stroke={color}
                    strokeWidth={isHovered ? 2 : 1.5}
                    strokeDasharray={circumference}
                    strokeDashoffset={scoreOffset}
                    strokeLinecap="round"
                    opacity={isHovered ? 0.9 : dimmed ? 0.1 : 0.6}
                    transform={`rotate(-90 ${node.x} ${node.y})`}
                  />
                );
              })()}

              {/* Main circle — dark core with colored stroke ring */}
              <circle
                cx={node.x}
                cy={node.y}
                r={r}
                fill={isHovered ? color : '#0a0505'}
                fillOpacity={isHovered ? 0.15 : 1}
                stroke={color}
                strokeWidth={isHovered ? 2.5 : 1.5}
                opacity={opacity}
                filter={isAnimating ? 'url(#nodeGlow)' : undefined}
              />

              {/* Agent image */}
              {node.image && r > 12 && (
                <image
                  href={node.image}
                  x={node.x - r + 1}
                  y={node.y - r + 1}
                  width={(r - 1) * 2}
                  height={(r - 1) * 2}
                  clipPath={`url(#clip-${node.id.slice(-8)})`}
                  opacity={opacity}
                  style={{ imageRendering: 'auto' }}
                />
              )}

              {/* Symbol label below node */}
              <text
                x={node.x}
                y={node.y + r + 12}
                textAnchor="middle"
                fill="#888"
                fontSize="9"
                fontFamily="monospace"
                opacity={dimmed ? 0.15 : 0.6}
              >
                {node.symbol}
              </text>

              {/* Hover highlight ring */}
              {isHovered && (
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={r + 3}
                  fill="none"
                  stroke="#fff"
                  strokeWidth={0.5}
                  opacity={0.2}
                />
              )}

              {/* Hover tooltip: name + score */}
              {isHovered && (
                <text
                  x={node.x}
                  y={node.y - r - 8}
                  textAnchor="middle"
                  fill="#ccc"
                  fontSize="10"
                  fontFamily="monospace"
                >
                  {node.label} ({node.powerScore})
                </text>
              )}

              {/* Floating swap label */}
              {isAnimating && (
                <text
                  x={node.x}
                  y={node.y - r - 16 - (1 - animProgress) * 20}
                  textAnchor="middle"
                  fill={anim.type === 'buy' ? '#34d399' : '#ef4444'}
                  fontSize="9"
                  fontFamily="monospace"
                  opacity={animProgress}
                >
                  {anim.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
