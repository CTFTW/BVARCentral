"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"

interface ReportData {
  totalProjects: number
  completedProjects: number
  totalRevenue: number
  outstandingBalance: number
  totalHoursLogged: number
  inventoryValue: number
  lowStockCount: number
  technicianUtilization: Array<{
    name: string
    hours: number
    chargeableHours: number
  }>
}

export default function ReportsPage() {
  const [reportData, setReportData] = useState<ReportData | null>(null)
  const [period, setPeriod] = useState("30")

  useEffect(() => {
    fetchReportData()
  }, [period])

  const fetchReportData = async () => {
    const res = await fetch(`/api/reports?period=${period}`)
    if (res.ok) {
      const data = await res.json()
      setReportData(data)
    }
  }

  if (!reportData) {
    return <div className="p-8">Loading...</div>
  }

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Reports</h1>
          <p className="text-gray-600">Business analytics and insights</p>
        </div>
        <div className="flex items-center gap-2">
          <Label>Period:</Label>
          <Select value={period} onValueChange={(value) => value && setPeriod(value)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="365">Last year</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Projects</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{reportData.totalProjects}</div>
            <p className="text-xs text-gray-600">{reportData.completedProjects} completed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${reportData.totalRevenue.toFixed(2)}</div>
            <p className="text-xs text-gray-600">${reportData.outstandingBalance.toFixed(2)} outstanding</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Hours Logged</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{reportData.totalHoursLogged.toFixed(1)}</div>
            <p className="text-xs text-gray-600">Total hours</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inventory Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${reportData.inventoryValue.toFixed(2)}</div>
            <p className="text-xs text-gray-600">{reportData.lowStockCount} low stock items</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Technician Utilization</CardTitle>
          <CardDescription>Hours logged by technician</CardDescription>
        </CardHeader>
        <CardContent>
          {reportData.technicianUtilization.length === 0 ? (
            <p className="text-center py-8 text-gray-600">No data available</p>
          ) : (
            <div className="space-y-4">
              {reportData.technicianUtilization.map((tech: any) => {
                const utilization = tech.hours > 0 ? (tech.chargeableHours / tech.hours) * 100 : 0
                return (
                  <div key={tech.name} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{tech.name}</span>
                      <span className="text-sm text-gray-600">
                        {tech.chargeableHours.toFixed(1)} / {tech.hours.toFixed(1)} hrs ({utilization.toFixed(0)}%)
                      </span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-600 transition-all"
                        style={{ width: `${utilization}%` }}
                      />
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
