import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '@/constants/routes';
import { useAuthStore } from '@/store/authStore';
import { toast } from '@/store/toastStore';

/**
 * Sign out from anywhere in the app.
 *
 * Shared rather than inlined per call site so the three places that offer
 * logout (profile menu, sidebar, admin header) cannot drift apart — and so
 * "clear the session, then leave the authenticated area" stays one decision.
 */
export function useLogout() {
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  return useCallback(async () => {
    // `logout` clears the local session and query cache even if the network
    // call fails, so navigating away is always the right follow-up.
    await logout();
    toast.info('Logged out.');
    navigate(ROUTES.home, { replace: true });
  }, [logout, navigate]);
}
