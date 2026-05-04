import { useGetAds, useGetAdminSettings } from "@workspace/api-client-react";
import { useEffect, useRef } from "react";

interface Props {
  placement: string;
}

function SingleAd({ adCode, id }: { adCode: string; id: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    ref.current.innerHTML = adCode;
    // Re-execute any script tags
    ref.current.querySelectorAll("script").forEach((old) => {
      const fresh = document.createElement("script");
      Array.from(old.attributes).forEach((a) => fresh.setAttribute(a.name, a.value));
      fresh.textContent = old.textContent;
      old.parentNode?.replaceChild(fresh, old);
    });
  }, [adCode]);

  return (
    <div
      ref={ref}
      data-testid={`ad-slot-${id}`}
      className="overflow-hidden"
    />
  );
}

export default function AdSlot({ placement }: Props) {
  const { data: settings } = useGetAdminSettings();
  const { data: ads } = useGetAds();

  if (!settings?.adsEnabled) return null;

  const matching = (ads ?? []).filter(
    (a) => a.placement === placement && a.isActive
  );
  if (!matching.length) return null;

  return (
    <div className="w-full flex flex-col items-center gap-2 py-1 bg-card/40">
      {matching.map((a) => (
        <SingleAd key={a.id} adCode={a.adCode} id={a.id} />
      ))}
    </div>
  );
}
