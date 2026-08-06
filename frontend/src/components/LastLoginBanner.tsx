import { format } from "date-fns";
import { Clock3 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const LastLoginBanner = () => {
  const { lastLoginAt } = useAuth();

  if (!lastLoginAt) {
    return null;
  }

  let formatted = lastLoginAt;
  try {
    formatted = format(new Date(lastLoginAt), "dd MMM yyyy, hh:mm a");
  } catch {
    // Keep raw ISO string if parsing fails.
  }

  return (
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-950">
      <div className="container mx-auto flex items-center justify-center gap-2 font-medium">
        <Clock3 className="h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
        <span>Last successful login: {formatted}</span>
      </div>
    </div>
  );
};

export default LastLoginBanner;
