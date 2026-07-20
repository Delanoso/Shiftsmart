import { useCallback, useEffect, useRef, useState } from 'react';
import {
  GAME_DURATION_MS,
  MAX_TARGET_SIZE,
  MIN_TARGET_SIZE,
  SPAWN_DELAY_MAX_MS,
  SPAWN_DELAY_MIN_MS,
  TARGET_TIMEOUT_MS,
  type ClickRecord,
  randomBetween,
  randomInt,
} from '../types';

export interface ActiveTarget {
  id: string;
  x: number;
  y: number;
  size: number;
  spawnedAt: number;
}

interface UseFatigueGameOptions {
  active: boolean;
  onComplete: (clicks: ClickRecord[], misses: number) => void;
}

export function useFatigueGame({ active, onComplete }: UseFatigueGameOptions) {
  const [target, setTarget] = useState<ActiveTarget | null>(null);
  const [timeLeftMs, setTimeLeftMs] = useState(GAME_DURATION_MS);
  const [clicks, setClicks] = useState<ClickRecord[]>([]);
  const [misses, setMisses] = useState(0);

  const areaRef = useRef<HTMLDivElement>(null);
  const clicksRef = useRef<ClickRecord[]>([]);
  const missesRef = useRef(0);
  const spawnTimerRef = useRef<number | null>(null);
  const timeoutTimerRef = useRef<number | null>(null);
  const endTimerRef = useRef<number | null>(null);
  const tickTimerRef = useRef<number | null>(null);
  const gameStartRef = useRef<number>(0);
  const completedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const clearTimers = useCallback(() => {
    if (spawnTimerRef.current != null) window.clearTimeout(spawnTimerRef.current);
    if (timeoutTimerRef.current != null) window.clearTimeout(timeoutTimerRef.current);
    if (endTimerRef.current != null) window.clearTimeout(endTimerRef.current);
    if (tickTimerRef.current != null) window.clearInterval(tickTimerRef.current);
    spawnTimerRef.current = null;
    timeoutTimerRef.current = null;
    endTimerRef.current = null;
    tickTimerRef.current = null;
  }, []);

  const scheduleNextSpawnRef = useRef<() => void>(() => {});

  const finishGame = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    clearTimers();
    setTarget(null);
    setTimeLeftMs(0);
    onCompleteRef.current([...clicksRef.current], missesRef.current);
  }, [clearTimers]);

  const spawnTarget = useCallback(() => {
    const area = areaRef.current;
    if (!area || completedRef.current) return;

    const rect = area.getBoundingClientRect();
    const size = randomInt(MIN_TARGET_SIZE, MAX_TARGET_SIZE);
    const padding = size / 2 + 8;
    const maxX = Math.max(padding, rect.width - padding);
    const maxY = Math.max(padding, rect.height - padding);
    const x = randomBetween(padding, maxX);
    const y = randomBetween(padding, maxY);
    const spawnedAt = performance.now();

    setTarget({
      id: crypto.randomUUID(),
      x,
      y,
      size,
      spawnedAt,
    });

    if (timeoutTimerRef.current != null) window.clearTimeout(timeoutTimerRef.current);
    timeoutTimerRef.current = window.setTimeout(() => {
      if (completedRef.current) return;
      missesRef.current += 1;
      setMisses(missesRef.current);
      setTarget(null);
      scheduleNextSpawnRef.current();
    }, TARGET_TIMEOUT_MS);
  }, []);

  const scheduleNextSpawn = useCallback(() => {
    if (completedRef.current) return;
    const delay = randomInt(SPAWN_DELAY_MIN_MS, SPAWN_DELAY_MAX_MS);
    spawnTimerRef.current = window.setTimeout(() => {
      spawnTarget();
    }, delay);
  }, [spawnTarget]);

  scheduleNextSpawnRef.current = scheduleNextSpawn;

  const handleTargetClick = useCallback(
    (e: React.MouseEvent, t: ActiveTarget) => {
      e.stopPropagation();
      if (completedRef.current) return;

      const reactionTimeMs = performance.now() - t.spawnedAt;
      const record: ClickRecord = {
        reactionTimeMs,
        targetSizePx: t.size,
      };
      clicksRef.current = [...clicksRef.current, record];
      setClicks(clicksRef.current);

      if (timeoutTimerRef.current != null) window.clearTimeout(timeoutTimerRef.current);
      setTarget(null);
      scheduleNextSpawn();
    },
    [scheduleNextSpawn],
  );

  useEffect(() => {
    if (!active) {
      clearTimers();
      completedRef.current = false;
      clicksRef.current = [];
      missesRef.current = 0;
      setClicks([]);
      setMisses(0);
      setTarget(null);
      setTimeLeftMs(GAME_DURATION_MS);
      return;
    }

    completedRef.current = false;
    clicksRef.current = [];
    missesRef.current = 0;
    setClicks([]);
    setMisses(0);
    setTarget(null);
    gameStartRef.current = performance.now();
    setTimeLeftMs(GAME_DURATION_MS);

    endTimerRef.current = window.setTimeout(finishGame, GAME_DURATION_MS);
    tickTimerRef.current = window.setInterval(() => {
      const elapsed = performance.now() - gameStartRef.current;
      setTimeLeftMs(Math.max(0, GAME_DURATION_MS - elapsed));
    }, 100);

    scheduleNextSpawn();

    return () => {
      clearTimers();
    };
  }, [active, clearTimers, finishGame, scheduleNextSpawn]);

  return {
    areaRef,
    target,
    timeLeftMs,
    clicks,
    misses,
    handleTargetClick,
  };
}
