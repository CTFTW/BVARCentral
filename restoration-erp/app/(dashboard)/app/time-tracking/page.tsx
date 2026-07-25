"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Play, Square, Clock } from "lucide-react"

interface TimeEntry {
  id: string
  workDate: string
  startTime: string | null
  endTime: string | null
  manualHours: number | null
  description: string | null
  isChargeable: boolean
  project: { id: string; title: string }
  jobPhase: { id: string; name: string } | null
  user: { id: string; name: string }
}

interface Project {
  id: string
  title: string
  phases: { id: string; name: string }[]
}

export default function TimeTrackingPage() {
  const { data: session } = useSession()
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [activeTimer, setActiveTimer] = useState<TimeEntry | null>(null)
  const [selectedProject, setSelectedProject] = useState("")
  const [selectedPhase, setSelectedPhase] = useState("")
  const [description, setDescription] = useState("")
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    fetchTimeEntries()
    fetchProjects()
  }, [])

  useEffect(() => {
    if (activeTimer?.startTime) {
      const interval = setInterval(() => {
        const start = new Date(activeTimer.startTime!).getTime()
        setElapsed(Math.floor((Date.now() - start) / 1000))
      }, 1000)
      return () => clearInterval(interval)
    }
  }, [activeTimer])

  const fetchTimeEntries = async () => {
    const res = await fetch(`/api/time-entries?userId=${session?.user?.id}`)
    const data = await res.json()
    setEntries(data)
    const active = data.find((e: TimeEntry) => !e.endTime)
    setActiveTimer(active || null)
  }

  const fetchProjects = async () => {
    const res = await fetch("/api/projects")
    const data = await res.json()
    setProjects(data)
  }

  const startTimer = async () => {
    if (!selectedProject) return

    const res = await fetch("/api/time-entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: selectedProject,
        jobId: selectedPhase || undefined,
        workDate: new Date().toISOString().split("T")[0],
        startTime: new Date().toISOString(),
        description: description || undefined,
      }),
    })

    if (res.ok) {
      await fetchTimeEntries()
      setDescription("")
    }
  }

  const stopTimer = async () => {
    if (!activeTimer) return

    const res = await fetch(`/api/time-entries/${activeTimer.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        endTime: new Date().toISOString(),
      }),
    })

    if (res.ok) {
      setActiveTimer(null)
      setElapsed(0)
      await fetchTimeEntries()
    }
  }

  const formatElapsed = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  const selectedProjectData = projects.find((p) => p.id === selectedProject)

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Time Tracking</h1>
        <p className="text-gray-600">Track your work hours</p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Timer</CardTitle>
          <CardDescription>Start and stop your work timer</CardDescription>
        </CardHeader>
        <CardContent>
          {activeTimer ? (
            <div className="space-y-4">
              <div className="text-center">
                <div className="text-4xl font-mono font-bold mb-2">
                  {formatElapsed(elapsed)}
                </div>
                <p className="text-sm text-gray-600">
                  {activeTimer.project.title}
                  {activeTimer.jobPhase && ` - ${activeTimer.jobPhase.name}`}
                </p>
              </div>
              <Button onClick={stopTimer} variant="destructive" className="w-full">
                <Square className="mr-2 h-4 w-4" />
                Stop Timer
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Project</Label>
                  <Select value={selectedProject} onValueChange={(value) => value && setSelectedProject(value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select project" />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Phase (optional)</Label>
                  <Select value={selectedPhase} onValueChange={(value) => value && setSelectedPhase(value)} disabled={!selectedProject}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select phase" />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedProjectData?.phases.map((phase) => (
                        <SelectItem key={phase.id} value={phase.id}>
                          {phase.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Description (optional)</Label>
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What are you working on?"
                />
              </div>
              <Button onClick={startTimer} disabled={!selectedProject} className="w-full">
                <Play className="mr-2 h-4 w-4" />
                Start Timer
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Time Entries</CardTitle>
          <CardDescription>Your time tracking history</CardDescription>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <p className="text-center py-8 text-gray-600">No time entries yet</p>
          ) : (
            <div className="space-y-3">
              {entries.slice(0, 10).map((entry) => {
                const hours = entry.manualHours || 
                  (entry.startTime && entry.endTime
                    ? (new Date(entry.endTime).getTime() - new Date(entry.startTime).getTime()) / 3600000
                    : 0)
                
                return (
                  <div key={entry.id} className="flex items-center justify-between border-b pb-3 last:border-0">
                    <div>
                      <p className="font-medium">{entry.project.title}</p>
                      <p className="text-sm text-gray-600">
                        {new Date(entry.workDate).toLocaleDateString()}
                        {entry.jobPhase && ` - ${entry.jobPhase.name}`}
                      </p>
                      {entry.description && (
                        <p className="text-sm text-gray-500 mt-1">{entry.description}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{hours.toFixed(2)} hrs</p>
                      {entry.isChargeable ? (
                        <Badge variant="default">Chargeable</Badge>
                      ) : (
                        <Badge variant="secondary">Non-chargeable</Badge>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
