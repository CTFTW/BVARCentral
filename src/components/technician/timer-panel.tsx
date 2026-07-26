"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type ActiveEntry = {
  id: string;
  jobPhaseId: string;
  startTime: string;
  jobPhaseName: string;
  projectName: string;
} | null;

type AssignedPhase = {
  id: string;
  name: string;
  projectName: string;
  vehicleLabel: string;
  status: string;
};

export function TechnicianTimerPanel({
  activeEntry,
  assignedPhases,
}: {
  activeEntry: ActiveEntry;
  assignedPhases: AssignedPhase[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [elapsed, setElapsed] = useState("");

  useEffect(() => {
    if (!activeEntry) return;
    const start = new Date(activeEntry.startTime).getTime();
    const tick = () => {
      const diffMs = Date.now() - start;
      const h = Math.floor(diffMs / 3_600_000);
      const m = Math.floor((diffMs % 3_600_000) / 60_000);
      const s = Math.floor((diffMs % 60_000) / 1000);
      setElapsed(`${h}h ${m}m ${s}s`);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [activeEntry]);

  async function startTimer(jobPhaseId: string) {
    setPending(true);
    try {
      const res = await fetch("/api/time-entries/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobPhaseId }),
      });
      if (!res.ok) throw new Error("Failed to start timer");
      toast.success("Timer started");
      router.refresh();
    } catch {
      toast.error("Could not start timer. It will need to be re-tried once back online.");
    } finally {
      setPending(false);
    }
  }

  async function stopTimer(id: string) {
    setPending(true);
    try {
      const res = await fetch("/api/time-entries/stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error("Failed to stop timer");
      toast.success("Timer stopped");
      router.refresh();
    } catch {
      toast.error("Could not stop timer. Your entry is preserved for manual completion.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Timer</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {activeEntry ? (
          <div className="flex items-center justify-between rounded-md border p-4">
            <div>
              <p className="font-medium">{activeEntry.jobPhaseName}</p>
              <p className="text-sm text-muted-foreground">{activeEntry.projectName}</p>
              <p className="mt-1 text-lg font-mono">{elapsed}</p>
            </div>
            <Button variant="destructive" disabled={pending} onClick={() => stopTimer(activeEntry.id)}>
              Stop
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No timer running.</p>
        )}

        <div>
          <h3 className="mb-2 text-sm font-medium">My Assigned Phases</h3>
          <ul className="space-y-2">
            {assignedPhases.map((p) => (
              <li key={p.id} className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <p className="font-medium">{p.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {p.projectName} — {p.vehicleLabel}
                  </p>
                  <Badge variant="outline" className="mt-1">
                    {p.status}
                  </Badge>
                </div>
                <Button
                  size="sm"
                  disabled={pending || activeEntry?.jobPhaseId === p.id}
                  onClick={() => startTimer(p.id)}
                >
                  Start
                </Button>
              </li>
            ))}
            {assignedPhases.length === 0 && (
              <p className="text-sm text-muted-foreground">No active phases assigned.</p>
            )}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
