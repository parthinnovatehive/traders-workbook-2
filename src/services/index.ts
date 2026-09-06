import type { Api } from './interfaces';
import { localApi } from './local';

/**
 * Dependency-injection seam. Today only the local mock implementation exists;
 * when a real backend lands, branch on VITE_DATA_SOURCE to return an ApiRepository
 * that satisfies the same `Api` interface — no UI or hook changes required.
 */
const dataSource = import.meta.env.VITE_DATA_SOURCE ?? 'local';

export const api: Api = dataSource === 'api' ? localApi /* TODO: httpApi */ : localApi;

export * from './interfaces';
export { resetLocalData } from './local';
export {
  DEMO_EMAIL,
  DEMO_PASSWORD,
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
} from './seed';
