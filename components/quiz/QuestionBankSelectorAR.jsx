import React, { useState, useEffect } from "react";
import { QuestionBankAR, SectionAR } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { Switch } from "@/components/ui/switch";
import { Database, Shuffle, Users, Loader2, CheckCircle, FolderOpen, Plus, Trash2, Settings } from "lucide-react";

export default function QuestionBankSelectorAR({ onSetup, onClose, currentSettings }) {
  const [questionsPerUser, setQuestionsPerUser] = useState(currentSettings?.questions_per_user || 10);
  const [selectedSections, setSelectedSections] = useState(currentSettings?.question_section_ids || []);
  const [selectedDifficulty, setSelectedDifficulty] = useState(currentSettings?.difficulty_filter || "all");
  
  // New state for section-based distribution
  const [useAdvancedDistribution, setUseAdvancedDistribution] = useState(!!currentSettings?.section_distribution?.length);
  const [sectionDistribution, setSectionDistribution] = useState(currentSettings?.section_distribution || []);

  const [availableQuestions, setAvailableQuestions] = useState([]);
  const [sections, setSections] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSettingUp, setIsSettingUp] = useState(false);

  useEffect(() => {
    loadBankData();
  }, []);

  const loadBankData = async () => {
    setIsLoading(true);
    try {
      const session = localStorage.getItem('gts_user_session');
      const currentUser = session ? JSON.parse(session) : null;
      if (!currentUser) { setIsLoading(false); return; }

      const [questions, sectionsData] = await Promise.all([
        QuestionBankAR.filter({ owner_id: currentUser.user_id }),
        SectionAR.filter({ owner_id: currentUser.user_id })
      ]);
      setAvailableQuestions(questions);
      setSections(sectionsData);

      // Initialize section distribution if sections exist and not already configured
      if (sectionsData.length > 0 && sectionDistribution.length === 0 && !currentSettings?.section_distribution) {
        const defaultDistribution = sectionsData.slice(0, 3).map(section => ({
          section_id: section.id,
          section_name: section.name,
          questions_count: 0
        }));
        setSectionDistribution(defaultDistribution);
      }
    } catch (error) {
      console.error("Error loading Question Bank data:", error);
    }
    setIsLoading(false);
  };

  const getFilteredQuestions = () => {
    return availableQuestions.filter(question => {
      const sectionMatch = selectedSections.length === 0 || selectedSections.includes(question.section_id);
      const difficultyMatch = selectedDifficulty === "all" || question.difficulty === selectedDifficulty;
      return sectionMatch && difficultyMatch;
    });
  };

  const getQuestionsCountBySection = (sectionId) => {
    return availableQuestions.filter(q => {
      const sectionMatch = q.section_id === sectionId;
      const difficultyMatch = selectedDifficulty === "all" || q.difficulty === selectedDifficulty;
      return sectionMatch && difficultyMatch;
    }).length;
  };

  const updateSectionDistribution = (sectionId, count) => {
    setSectionDistribution(prev => 
      prev.map(item => 
        item.section_id === sectionId 
          ? { ...item, questions_count: Math.max(0, parseInt(count) || 0) }
          : item
      )
    );
  };

  const addSectionToDistribution = () => {
    const availableSections = sections.filter(section => 
      !sectionDistribution.some(dist => dist.section_id === section.id)
    );
    
    if (availableSections.length > 0) {
      const newSection = availableSections[0];
      setSectionDistribution(prev => [...prev, {
        section_id: newSection.id,
        section_name: newSection.name,
        questions_count: 0
      }]);
    }
  };

  const removeSectionFromDistribution = (sectionId) => {
    setSectionDistribution(prev => prev.filter(item => item.section_id !== sectionId));
  };

  const getTotalDistributionQuestions = () => {
    return sectionDistribution.reduce((total, item) => total + item.questions_count, 0);
  };

  const validateDistribution = () => {
    if (!useAdvancedDistribution) {
      const filteredQuestions = getFilteredQuestions();
      return filteredQuestions.length >= questionsPerUser;
    }

    // Check if each section has enough questions
    for (const dist of sectionDistribution) {
      if (dist.questions_count > 0) {
        const availableInSection = getQuestionsCountBySection(dist.section_id);
        if (availableInSection < dist.questions_count) {
          return false;
        }
      }
    }
    return true;
  };

  const handleSectionToggle = (sectionId) => {
    setSelectedSections(prev =>
      prev.includes(sectionId)
        ? prev.filter(id => id !== sectionId)
        : [...prev, sectionId]
    );
  };

  const handleAdvancedDistributionToggle = (enabled) => {
    setUseAdvancedDistribution(enabled);
    if (enabled && sectionDistribution.length === 0 && sections.length > 0) {
      // Initialize with first few sections
      const defaultDistribution = sections.slice(0, 3).map(section => ({
        section_id: section.id,
        section_name: section.name,
        questions_count: 0
      }));
      setSectionDistribution(defaultDistribution);
    }
  };

  const handleSetup = async () => {
    if (!validateDistribution()) {
      if (useAdvancedDistribution) {
        const invalidSections = sectionDistribution.filter(dist => {
          if (dist.questions_count > 0) {
            const available = getQuestionsCountBySection(dist.section_id);
            return available < dist.questions_count;
          }
          return false;
        });
        
        if (invalidSections.length > 0) {
          const sectionNames = invalidSections.map(s => `${s.section_name} (طلب ${s.questions_count}، متاح ${getQuestionsCountBySection(s.section_id)})`).join('، ');
          alert(`لا توجد أسئلة كافية في الأقسام التالية:\n${sectionNames}`);
        } else {
          alert('يرجى تكوين عدد الأسئلة لكل قسم');
        }
      } else {
        const filteredQuestions = getFilteredQuestions();
        alert(`لا توجد أسئلة كافية. لديك ${filteredQuestions.length} سؤالاً يطابق معاييرك، لكنك تحتاج إلى ${questionsPerUser} لكل مستخدم.`);
      }
      return;
    }

    if (useAdvancedDistribution && getTotalDistributionQuestions() === 0) {
      alert('يرجى تحديد عدد الأسئلة لكل قسم');
      return;
    }

    setIsSettingUp(true);

    const config = {
      questions_per_user: useAdvancedDistribution ? getTotalDistributionQuestions() : questionsPerUser,
      question_section_ids: useAdvancedDistribution ? sectionDistribution.map(d => d.section_id) : selectedSections,
      difficulty_filter: selectedDifficulty !== "all" ? selectedDifficulty : null,
      section_distribution: useAdvancedDistribution ? sectionDistribution.filter(d => d.questions_count > 0) : [],
      total_available: useAdvancedDistribution ? getTotalDistributionQuestions() : getFilteredQuestions().length
    };

    onSetup(config);
    setIsSettingUp(false);
  };

  const filteredQuestions = getFilteredQuestions();

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent dir="rtl" className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0 text-right">
          <DialogTitle className="flex items-center justify-end gap-2">
            إعداد الاختبار الديناميكي
            <Database className="w-5 h-5 text-purple-600" />
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4 space-y-6">
          <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2 justify-end">
              <span className="font-medium text-purple-800">وضع الاختبار الديناميكي</span>
              <Shuffle className="w-4 h-4 text-purple-600" />
            </div>
            <p className="text-sm text-purple-700 text-right">
              سيحصل كل مستخدم على مجموعة عشوائية مختلفة من الأسئلة من بنك الأسئلة مع ضمان عدم التكرار.
            </p>
          </div>

          {isLoading ? (
            <div className="text-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-purple-600 mx-auto mb-2" />
              <p className="text-sm text-slate-600">جارٍ تحميل بنك الأسئلة...</p>
            </div>
          ) : (
            <>
              {/* Advanced Distribution Toggle */}
              {sections.length > 0 && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="text-right">
                      <Label className="text-base font-medium">التوزيع المتقدم حسب الأقسام</Label>
                      <p className="text-sm text-slate-600 mt-1">
                        حدد عدد الأسئلة من كل قسم بدقة
                      </p>
                    </div>
                    <Switch
                      checked={useAdvancedDistribution}
                      onCheckedChange={handleAdvancedDistributionToggle}
                    />
                  </div>
                </div>
              )}

              {useAdvancedDistribution ? (
                /* Advanced Section Distribution */
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={addSectionToDistribution}
                      disabled={sectionDistribution.length >= sections.length}
                      className="gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      إضافة قسم
                    </Button>
                    <Label className="text-base font-medium">توزيع الأسئلة حسب الأقسام</Label>
                  </div>

                  <div className="space-y-3">
                    {sectionDistribution.map((dist) => {
                      const availableInSection = getQuestionsCountBySection(dist.section_id);
                      const section = sections.find(s => s.id === dist.section_id);
                      
                      return (
                        <div key={dist.section_id} className="flex items-center gap-3 p-3 border rounded-lg">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeSectionFromDistribution(dist.section_id)}
                            className="text-red-600 hover:text-red-700 flex-shrink-0"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge 
                                className={`bg-${section?.color || 'blue'}-100 text-${section?.color || 'blue'}-800 border-${section?.color || 'blue'}-300`}
                              >
                                {dist.section_name}
                              </Badge>
                              <span className="text-sm text-slate-500">
                                ({availableInSection} متاح)
                              </span>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              <Label className="text-sm">عدد الأسئلة:</Label>
                              <Input
                                type="number"
                                min="0"
                                max={availableInSection}
                                value={dist.questions_count}
                                onChange={(e) => updateSectionDistribution(dist.section_id, e.target.value)}
                                className="w-20 text-center"
                              />
                            </div>
                            
                            {dist.questions_count > availableInSection && (
                              <p className="text-xs text-red-600 mt-1">
                                ⚠️ العدد المطلوب أكبر من المتاح
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                    <div className="flex items-center justify-between text-right">
                      <Badge variant="outline" className="bg-white text-green-700">
                        {getTotalDistributionQuestions()} سؤال
                      </Badge>
                      <span className="text-sm font-medium text-green-800">إجمالي الأسئلة لكل مستخدم</span>
                    </div>
                  </div>
                </div>
              ) : (
                /* Standard Distribution */
                <>
                  <div className="text-right">
                    <Label htmlFor="questions-per-user">عدد الأسئلة لكل مستخدم</Label>
                    <Input
                      id="questions-per-user"
                      type="number"
                      min="1"
                      max="50"
                      value={questionsPerUser}
                      onChange={(e) => setQuestionsPerUser(parseInt(e.target.value) || 1)}
                      className="mt-2 text-right"
                    />
                  </div>

                  <div className="text-right">
                    <Label>فلترة حسب الصعوبة (اختياري)</Label>
                    <Select value={selectedDifficulty} onValueChange={setSelectedDifficulty}>
                      <SelectTrigger className="mt-2 text-right">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">كل الصعوبات</SelectItem>
                        <SelectItem value="easy">سهل فقط</SelectItem>
                        <SelectItem value="medium">متوسط فقط</SelectItem>
                        <SelectItem value="hard">صعب فقط</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {sections.length > 0 && (
                    <div className="text-right">
                      <Label>فلترة حسب الأقسام (اختياري)</Label>
                      <div className="flex flex-wrap gap-2 mt-2 max-h-32 overflow-y-auto p-2 border rounded-lg justify-end">
                        {sections.map((section) => (
                          <Badge
                            key={section.id}
                            variant={selectedSections.includes(section.id) ? "default" : "outline"}
                            className={`cursor-pointer transition-colors text-base py-1 px-3 ${
                              selectedSections.includes(section.id)
                                ? `bg-${section.color}-100 text-${section.color}-800 border-${section.color}-300`
                                : `hover:bg-${section.color}-50`
                            }`}
                            onClick={() => handleSectionToggle(section.id)}
                          >
                            {section.name}
                            <FolderOpen className="w-3 h-3 ml-1" />
                          </Badge>
                        ))}
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        اختر الأقسام لتضمينها في الاختبار. اتركها فارغة لتضمين جميع الأسئلة.
                      </p>
                    </div>
                  )}

                  <div className="p-3 bg-slate-50 rounded-lg border text-right">
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="outline" className="bg-white">
                        {filteredQuestions.length} سؤال
                      </Badge>
                      <span className="text-sm font-medium text-slate-700">الأسئلة المتاحة</span>
                    </div>
                    {filteredQuestions.length > 0 && questionsPerUser > 0 && (
                      <div className="flex items-center gap-2 text-sm text-slate-600 mb-2 justify-end">
                        <span>
                          يمكن أن تدعم {Math.floor(filteredQuestions.length / questionsPerUser)} نسخة اختبار فريدة
                        </span>
                        <Users className="w-4 h-4" />
                      </div>
                    )}
                    {filteredQuestions.length < questionsPerUser && (
                      <p className="text-sm text-red-600 mt-2">
                        ⚠️ لا توجد أسئلة كافية لمتطلباتك. أضف المزيد من الأسئلة أو قم بتغيير الفلاتر.
                      </p>
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </div>

        <DialogFooter className="flex-shrink-0 border-t pt-4 flex-row-reverse">
          <Button
            onClick={handleSetup}
            disabled={isLoading || !validateDistribution() || isSettingUp}
            className="bg-purple-600 hover:bg-purple-700 gap-2"
          >
            {isSettingUp ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle className="w-4 h-4" />
            )}
            إعداد الاختبار الديناميكي
          </Button>
          <Button variant="outline" onClick={onClose}>
            إلغاء
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}