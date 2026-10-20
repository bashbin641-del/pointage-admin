"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { CoreRealtimeEvent, subscribeToCoreEvents } from "@/lib/realtime";

export function useAdminRealtime(onEvent: (event: CoreRealtimeEvent) => void) {
  const eventHandler = useRef(onEvent);

  useEffect(() => {
    eventHandler.current = onEvent;
  }, [onEvent]);

  useEffect(() => subscribeToCoreEvents("events/admin", {
    getAccessToken: async () => {
      const { data } = await (await createClient()).auth.getSession();
      return data.session?.access_token ?? null;
    },
    onEvent: (event) => eventHandler.current(event),
  }), []);
}
