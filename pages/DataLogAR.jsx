import React, { useState, useEffect } from "react";
import { AuditLogAR } from "@/api/entities";
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
import { ar } from "date-fns/locale";

export default function DataLogAR() {
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
        setError("لم يتم العثور على جلسة المستخدم. يرجى تسجيل الدخول مرة أخرى.");
        setIsLoading(false);
        return;
      }
      const currentUser = JSON.parse(session);
      const userLogs = await AuditLogAR.filter({ owner_id: currentUser.user_id }, "-created_date");
      setLogs(userLogs);
    } catch (e) {
      console.error("Failed to load audit logs:", e);
      setError("فشل تحميل سجلات التدقيق. يرجى المحاولة مرة أخرى لاحقًا.");
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
      setDecodedData("خطأ: تعذر فك تشفير البيانات أو تحليلها. قد تكون البيانات تالفة أو ليست بالتنسيق المتوقع.");
    }
  };

  const totalLogs = logs.length;
  const estimatedStorage = logs.reduce((acc, log) => acc + (log.encoded_data?.length || 0), 0);

  return (
    <div dir="rtl" className="p-4 md:p-8 space-y-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2 flex items-center gap-3">
            <History className="w-8 h-8" />
            سجل بيانات GTS
          </h1>
          <p className="text-slate-600">سجل آمن وغير قابل للتغيير لجميع أحداث النظام الهامة.</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">إجمالي إدخالات السجل</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalLogs.toLocaleString('ar-EG')}</div>
              <p className="text-xs text-muted-foreground">سجلات غير قابلة للتغيير مخزنة</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">مساحة التخزين المشفرة المقدرة</CardTitle>
              <HardDrive className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{(estimatedStorage / 1024).toFixed(2)} كيلوبايت</div>
              <p className="text-xs text-muted-foreground">الاستخدام غير محدود</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>سجل الأحداث</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center items-center py-10">
                <Loader2 className="w-8 h-8 animate-spin text-slate-500" />
                <p className="mr-4 text-slate-600">جاري تحميل السجلات الآمنة...</p>
              </div>
            ) : error ? (
              <div className="text-center py-10 text-red-600">
                <ServerCrash className="w-12 h-12 mx-auto mb-4" />
                <p className="font-semibold">خطأ في تحميل السجلات</p>
                <p>{error}</p>
              </div>
            ) : logs.length === 0 ? (
              <div className="text-center py-10">
                <p className="text-slate-500">لم يتم العثور على إدخالات في السجل. قم بإجراء لإظهاره هنا.</p>
                 <p className="text-sm text-slate-400 mt-2">(ملاحظة: يتم عرض بيانات نموذجية لإظهار الوظيفة)</p>
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
                        <p className="text-xs text-slate-400 mt-1">{format(new Date(log.created_date), "d MMMM yyyy 'في' hh:mm a", { locale: ar })}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <Badge variant="outline">{log.entity_type}</Badge>
                      <Button variant="outline" size="sm" onClick={() => handleInspectLog(log)}>
                        <Eye className="w-4 h-4 ml-2" />
                        فحص
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
        <DialogContent dir="rtl" className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Code />مفتش البيانات المشفرة</DialogTitle>
          </DialogHeader>
          <div>
            <h3 className="font-semibold mb-2">البيانات بعد فك التشفير:</h3>
            <div dir="ltr" className="text-left bg-slate-900 text-white p-4 rounded-md max-h-96 overflow-auto">
              <pre><code>{decodedData}</code></pre>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedLog(null)}>إغلاق</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}