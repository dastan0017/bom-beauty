import type { SettingKey, SettingValue } from '@bom/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';
import { keys } from './keys';

/** Settings this user may edit, keyed by setting name (managers get shop, appearance, currencies). */
export type AdminSettings = Partial<{ [K in SettingKey]: SettingValue<K> }>;

export function useSettings() {
  return useQuery({
    queryKey: keys.settings,
    queryFn: async () => (await unwrap(api.GET('/v1/admin/settings'))) as AdminSettings,
  });
}

/** Sends a check message through the saved channels. */
export function useNotificationTest() {
  return useMutation({ mutationFn: () => unwrap(api.POST('/v1/admin/settings/notifications/test')) });
}

export function useSaveSetting<K extends SettingKey>(key: K) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (value: SettingValue<K>) =>
      (await unwrap(
        api.PUT('/v1/admin/settings/{key}', { params: { path: { key } }, body: { value: value } }),
      )) as SettingValue<K>,
    onSuccess: (value) =>
      queryClient.setQueryData<AdminSettings>(keys.settings, (current) => ({ ...current, [key]: value })),
  });
}
