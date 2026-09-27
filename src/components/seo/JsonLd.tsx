import { useMemo } from 'react';

/**
 * Renders one schema.org block as JSON-LD.
 *
 * `application/ld+json` is the format Google, Bing and every other consumer
 * actually parse. `type="application/json"` is inert to them.
 *
 * The serialisation guard is not decoration. A JSON-LD block is injected as raw
 * markup, so any `</script>` inside the data would close the tag early and dump
 * the rest of the object into the document as text. Escaping `<` to `<` makes
 * that impossible while leaving the parsed JSON byte-identical, because `<` is
 * not a character JSON string escapes need.
 *
 * Rendering nothing for `null` matters: the FAQ builder returns `null` when an
 * admin has cleared every entry, and an empty `FAQPage` would be a claim about
 * content that does not exist.
 */
export function JsonLd({ data }: { data: unknown }) {
  const json = useMemo(() => {
    if (data === null || data === undefined) return null;
    try {
      return JSON.stringify(data).replace(/</g, '\\u003c');
    } catch {
      // A circular or non-serialisable schema object must not take the page
      // down with it. Structured data is an enhancement, never a dependency.
      return null;
    }
  }, [data]);

  if (!json) return null;

  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger -- JSON.stringify output, with `<` escaped above.
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}
