import React, { useState, useEffect } from "react";
import { AuditLog } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { History, HardDrive, Code, Eye, FileText, Loader2, ServerCrash } from "lucide-react";
import { format } from "date-fns";

export default function DataLog() {
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedLog, setSelectedLog] = useState(null);
  const [decodedData, setDecodedData] = useState("");

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const session = localStorage.getItem('gts_user_session');
      if (!session) {
        setError("User session not found. Please log in again.");
        setIsLoading(false);
        return;
      }
      const currentUser = JSON.parse(session);
      const userLogs = await AuditLog.filter({ owner_id: currentUser.user_id }, "-created_date");
      setLogs(userLogs);
    } catch (e) {
      console.error("Failed to load audit logs:", e);
      setError("Failed to load audit logs. Please try again later.");
    }
    setIsLoading(false);
  };

  const handleInspectLog = (log) => {
    setSelectedLog(log);
    try {
      const decoded = atob(log.encoded_data || "");
      const parsed = JSON.parse(decoded);
      setDecodedData(JSON.stringify(parsed, null, 2));
    } catch (e) {
      setDecodedData("Error: Could not decode or parse data. The data might be corrupted or not in the expected format.");
    }
  };

  const totalLogs = logs.length;
  const estimatedStorage = logs.reduce((acc, log) => acc + (log.encoded_data?.length || 0), 0);

  return (
    <div className="p-4 md:p-8 space-y-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2 flex items-center gap-3">
            <History className="w-8 h-8" />
            GTS Data Log
          </h1>
          <p className="text-slate-600">Secure, immutable log of all critical system events.</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Log Entries</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalLogs.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Immutable records stored</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Estimated Encoded Storage</CardTitle>
              <HardDrive className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{(estimatedStorage / 1024).toFixed(2)} KB</div>
              <p className="text-xs text-muted-foreground">Usage is unlimited</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Event Stream</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center items-center py-10">
                <Loader2 className="w-8 h-8 animate-spin text-slate-500" />
                <p className="ml-4 text-slate-600">Loading secure logs...</p>
              </div>
            ) : error ? (
              <div className="text-center py-10 text-red-600">
                <ServerCrash className="w-12 h-12 mx-auto mb-4" />
                <p className="font-semibold">Error Loading Logs</p>
                <p>{error}</p>
              </div>
            ) : logs.length === 0 ? (
              <div className="text-center py-10">
                <p className="text-slate-500">No log entries found. Perform an action to see it recorded here.</p>
                <p className="text-sm text-slate-400 mt-2">(Note: Sample data is shown to demonstrate functionality)</p>
              </div>
            ) : (
              <div className="space-y-4">
                {logs.map(log => (
                  <div key={log.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-blue-100 rounded-full">
                        <History className="w-5 h-5 text-blue-700" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800">{log.action.replace(/_/g, ' ')}</p>
                        <p className="text-sm text-slate-600">{log.details}</p>
                        <p className="text-xs text-slate-400 mt-1">{format(new Date(log.created_date), "MMM d, yyyy 'at' hh:mm a")}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <Badge variant="outline">{log.entity_type}</Badge>
                      <Button variant="outline" size="sm" onClick={() => handleInspectLog(log)}>
                        <Eye className="w-4 h-4 mr-2" />
                        Inspect
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Code />Encoded Data Inspector</DialogTitle>
          </DialogHeader>
          <div>
            <h3 className="font-semibold mb-2">Decoded Data:</h3>
            <div className="bg-slate-900 text-white p-4 rounded-md max-h-96 overflow-auto">
              <pre><code>{decodedData}</code></pre>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedLog(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}