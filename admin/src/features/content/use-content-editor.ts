import type { AdminContent, ContentValue } from '@bom/shared';
import { useState } from 'react';
import { toast } from 'sonner';
import { useSaveContent, type ContentKey } from '@/api/content';
import { copy } from '@/content/copy';
import { useUnsavedGuard } from '@/components/ui/editor';
import { errorText, fieldErrors } from '@/lib/format';

/** Local form state for one content block: dirty tracking, save, field errors (keys without the "data." prefix). */
export function useContentEditor<K extends ContentKey>(key: K, content: AdminContent) {
  const save = useSaveContent(key);
  const initial = content.data as ContentValue<K>;
  const [baseline, setBaseline] = useState(initial);
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const dirty = JSON.stringify(form) !== JSON.stringify(baseline);
  useUnsavedGuard(dirty && !save.isPending);

  const update = (patch: Partial<ContentValue<K>>) => {
    setForm((current) => ({ ...current, ...patch }));
    setSaved(false);
  };

  const submit = () =>
    save.mutate(form, {
      onSuccess: (result) => {
        const next = result.data as ContentValue<K>;
        setBaseline(next);
        setForm(next);
        setErrors({});
        setSaved(true);
        toast.success(copy.saved);
      },
      onError: (error) => {
        setErrors(
          Object.fromEntries(
            Object.entries(fieldErrors(error)).map(([field, text]) => [field.replace(/^data\./, ''), text]),
          ),
        );
        toast.error(errorText(error));
      },
    });

  return { form, update, submit, errors, saved, dirty, saving: save.isPending };
}
