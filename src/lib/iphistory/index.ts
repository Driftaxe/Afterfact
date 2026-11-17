/**
 * Representation of a historical verification check entry
 * bound to an anonymous client IP / owner hash.
 */
export interface HistoryCheckItem {
  id: string;
  timestamp: number;
  mode: 'paste' | 'ask';
  title: string;
  queryOrSnippet: string;
  claimsCount: number;
  status: 'completed' | 'running' | 'failed' | 'sample';
  reportUrl: string;
  truthScore?: number | null;
  asOfDate?: string;
  ipHash?: string;
}

export const IP_HISTORY_STORAGE_KEY = 'afterfact_ip_history';
export const HISTORY_UPDATED_EVENT = 'afterfact:history-updated';

/**
 * Initial canonical seed checks displayed for first-time visitors
 * demonstrating real temporal drift detections.
 */
export const SEED_HISTORY_CHECKS: HistoryCheckItem[] = [
  {
    id: 'run_golden_fixture_mixed_001',
    timestamp: Date.now() - 1000 * 60 * 18, // 18 mins ago
    mode: 'paste',
    title: 'Claude Pro, Stripe API & Twitter Leadership',
    queryOrSnippet: 'Anthropic Claude Pro costs $20 per month in the United States. Stripe payment intent requires specifying payment_method_types...',
    claimsCount: 5,
    status: 'sample',
    reportUrl: '/report/demo?mode=fixture',
    truthScore: 60,
    asOfDate: '2024-09-01',
  },
  {
    id: 'run_demo_pluto_classification',
    timestamp: Date.now() - 1000 * 60 * 64, // 1 hour ago
    mode: 'ask',
    title: 'Solar System Planetary Status',
    queryOrSnippet: 'Is Pluto officially classified as the ninth planet of the solar system?',
    claimsCount: 1,
    status: 'completed',
    reportUrl: '/report/demo?mode=fixture',
    truthScore: 100,
    asOfDate: '2024-08-15',
  },
  {
    id: 'run_demo_twitter_rebrand',
    timestamp: Date.now() - 1000 * 60 * 60 * 24, // 1 day ago
    mode: 'paste',
    title: 'Twitter Executive & Platform Changes',
    queryOrSnippet: 'Parag Agrawal is the current CEO of Twitter following Jack Dorsey stepping down.',
    claimsCount: 2,
    status: 'completed',
    reportUrl: '/report/demo?mode=fixture',
    truthScore: 0,
    asOfDate: '2024-09-01',
  },
];

/* =========================================================================
   CLIENT-SIDE STORAGE & HISTORY UTILITIES
   ========================================================================= */

/**
 * Retrieves the list of recent checks from client storage.
 * If storage is empty, initializes with the seed demo checks.
 */
export function getRecentChecks(limit: number = 20): HistoryCheckItem[] {
  if (typeof window === 'undefined') {
    return SEED_HISTORY_CHECKS.slice(0, limit);
  }

  try {
    const raw = window.localStorage.getItem(IP_HISTORY_STORAGE_KEY);
    if (!raw) {
      // First-time visit: populate with seed checks
      window.localStorage.setItem(
        IP_HISTORY_STORAGE_KEY,
        JSON.stringify(SEED_HISTORY_CHECKS)
      );
      return SEED_HISTORY_CHECKS.slice(0, limit);
    }

    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.slice(0, limit);
    }
    return [];
  } catch (err) {
    console.error('Failed to read IP history from localStorage:', err);
    return SEED_HISTORY_CHECKS.slice(0, limit);
  }
}

/**
 * Saves a new verification check to the client IP history.
 * Prepends to the list, deduplicates by ID, and prunes to the last 25 items.
 */
export function saveCheck(item: HistoryCheckItem): void {
  if (typeof window === 'undefined') return;

  try {
    const current = getRecentChecks(50);
    // Remove if duplicate ID already exists
    const filtered = current.filter((c) => c.id !== item.id);
    const updated = [item, ...filtered].slice(0, 25);

    window.localStorage.setItem(IP_HISTORY_STORAGE_KEY, JSON.stringify(updated));

    // Dispatch event so any open drawer or indicator reacts immediately
    window.dispatchEvent(
      new CustomEvent(HISTORY_UPDATED_EVENT, { detail: { check: item } })
    );
  } catch (err) {
    console.error('Failed to save IP history item:', err);
  }
}

/**
 * Clears all recorded checks from client storage.
 */
export function clearHistory(): void {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(IP_HISTORY_STORAGE_KEY, JSON.stringify([]));
    window.dispatchEvent(new CustomEvent(HISTORY_UPDATED_EVENT, { detail: null }));
  } catch (err) {
    console.error('Failed to clear IP history:', err);
  }
}

/**
 * Removes a single check by its run ID.
 */
export function removeCheck(id: string): void {
  if (typeof window === 'undefined') return;

  try {
    const current = getRecentChecks(50);
    const updated = current.filter((c) => c.id !== id);
    window.localStorage.setItem(IP_HISTORY_STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent(HISTORY_UPDATED_EVENT, { detail: { id } }));
  } catch (err) {
    console.error('Failed to remove check from IP history:', err);
  }
}
