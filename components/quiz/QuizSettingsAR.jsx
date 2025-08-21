
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function QuizSettingsAR({ settings, category, onUpdate, onClose }) {
  const [localSettings, setLocalSettings] = useState(() => ({
    ...settings,
  }));
  const [localCategory, setLocalCategory] = useState(category);

  const handleSave = () => {
    onUpdate(localSettings, localCategory);
    onClose();
  };

  const updateSetting = (key, value) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>إعدادات الاختبار</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          <div>
            <Label htmlFor="category" className="text-sm font-medium">
              الفئة
            </Label>
            <Select value={localCategory} onValueChange={setLocalCategory}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="اختر الفئة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="education">تعليم</SelectItem>
                <SelectItem value="corporate">تدريب الشركات</SelectItem>
                <SelectItem value="research">أبحاث السوق</SelectItem>
                <SelectItem value="evaluation">تقييم</SelectItem>
                <SelectItem value="other">أخرى</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="show-results">عرض النتائج</Label>
                <p className="text-xs text-slate-500">
                  عرض النتائج للمشاركين بعد الانتهاء
                </p>
              </div>
              <Switch
                id="show-results"
                checked={localSettings.show_results}
                onCheckedChange={(checked) => updateSetting('show_results', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="shuffle-questions">خلط الأسئلة</Label>
                <p className="text-xs text-slate-500">
                  ترتيب عشوائي للأسئلة لكل مشارك
                </p>
              </div>
              <Switch
                id="shuffle-questions"
                checked={localSettings.shuffle_questions}
                onCheckedChange={(checked) => updateSetting('shuffle_questions', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="allow-retakes">السماح بإعادة المحاولة</Label>
                <p className="text-xs text-slate-500">
                  السماح للمشاركين بإعادة أخذ الاختبار
                </p>
              </div>
              <Switch
                id="allow-retakes"
                checked={localSettings.allow_retakes}
                onCheckedChange={(checked) => updateSetting('allow_retakes', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="require-password">حماية بكلمة مرور</Label>
                <p className="text-xs text-slate-500">
                  تتطلب كلمة مرور للوصول للاختبار
                </p>
              </div>
              <Switch
                id="require-password"
                checked={localSettings.require_password}
                onCheckedChange={(checked) => updateSetting('require_password', checked)}
              />
            </div>

            {localSettings.require_password && (
              <div>
                <Label htmlFor="password" className="text-sm font-medium">
                  كلمة مرور الاختبار
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="أدخل كلمة مرور الاختبار"
                  value={localSettings.password || ''}
                  onChange={(e) => updateSetting('password', e.target.value)}
                  className="mt-2"
                />
              </div>
            )}
            
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="restrict-by-id">منع التكرار برقم الهوية</Label>
                <p className="text-xs text-slate-500">
                  منع المستخدمين بنفس الهوية من إعادة الاختبار.
                </p>
              </div>
              <Switch
                id="restrict-by-id"
                checked={localSettings.restrict_by_id}
                onCheckedChange={(checked) => updateSetting('restrict_by_id', checked)}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="restrict-by-ip">منع التكرار بعنوان IP</Label>
                <p className="text-xs text-slate-500">
                  منع الإدخالات المتعددة من نفس عنوان IP.
                </p>
              </div>
              <Switch
                id="restrict-by-ip"
                checked={localSettings.restrict_by_ip}
                onCheckedChange={(checked) => updateSetting('restrict_by_ip', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="use-question-bank">استخدام بنك الأسئلة</Label>
                <p className="text-xs text-slate-500">
                  توزيع أسئلة مختلفة لكل مستخدم
                </p>
              </div>
              <Switch
                id="use-question-bank"
                checked={localSettings.use_question_bank}
                onCheckedChange={(checked) => updateSetting('use_question_bank', checked)}
              />
            </div>

            {localSettings.use_question_bank && (
              <div>
                <Label htmlFor="questions-per-user" className="text-sm font-medium">
                  الأسئلة لكل مستخدم
                </Label>
                <Input
                  id="questions-per-user"
                  type="number"
                  min="1"
                  max="50"
                  placeholder="مثال: 10"
                  value={localSettings.questions_per_user || ''}
                  onChange={(e) => updateSetting('questions_per_user', parseInt(e.target.value) || null)}
                  className="mt-2"
                />
                <p className="text-xs text-slate-500 mt-1">
                  سيحصل كل مستخدم على هذا العدد من الأسئلة العشوائية من بنك الأسئلة
                </p>
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="time-limit" className="text-sm font-medium">
              الحد الزمني (دقائق)
            </Label>
            <Input
              id="time-limit"
              type="number"
              min="0"
              placeholder="بدون حد زمني"
              value={localSettings.time_limit || ''}
              onChange={(e) => updateSetting('time_limit', e.target.value ? parseInt(e.target.value) : null)}
              className="mt-2"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            إلغاء
          </Button>
          <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700">
            حفظ الإعدادات
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
