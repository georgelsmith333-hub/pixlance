import { useGetAnnouncements } from "@workspace/api-client-react";
import { X } from "lucide-react";
import { useState } from "react";

const typeColors: Record<string, string> = {
  info: "bg-primary/20 text-primary border-primary/30",
  success: "bg-green-500/20 text-green-400 border-green-500/30",
  warning: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  error: "bg-red-500/20 text-red-400 border-red-500/30",
};

export default function AnnouncementBar() {
  const { data: announcements } = useGetAnnouncements();
  const [dismissed, setDismissed] = useState<number[]>([]);

  const active = (Array.isArray(announcements) ? announcements : []).filter(
    (a) => a.isActive && !dismissed.includes(a.id)
  );

  if (!active.length) return null;

  return (
    <div className="flex flex-col gap-0">
      {active.map((a) => (
        <div
          key={a.id}
          className={`flex items-center justify-between px-4 py-2 text-sm border-b ${typeColors[a.type] ?? typeColors.info}`}
        >
          <span className="flex-1 text-center font-medium">{a.message}</span>
          <button
            onClick={() => setDismissed((d) => [...d, a.id])}
            className="ml-4 opacity-60 hover:opacity-100 transition-opacity"
            data-testid={`button-dismiss-announcement-${a.id}`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
