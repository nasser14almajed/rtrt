
import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { QuizAR, QuestionAR, QuestionBankAR, AppUser } from "@/api/entities";
import { InvokeLLM, ExtractDataFromUploadedFile, UploadFile } from "@/api/integrations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format } from "date-fns";
import { Label } from "@/components/ui/label";
import {
  ArrowRight,
  Save,
  Eye,
  Plus,
  Sparkles,
  Upload,
  FileText,
  Trash2,
  GripVertical,
  Settings,
  Share,
  Loader2,
  Database,
  X,
  CheckSquare
} from "lucide-react";
import { motion } from "framer-motion";
import QuestionEditorAR from "../components/quiz/QuestionEditorAR";
import QuestionTypeSelectorAR from "../components/quiz/QuestionTypeSelectorAR";
import QuizSettingsAR from "../components/quiz/QuizSettingsAR";
import AIQuestionGeneratorAR from "../components/quiz/AIQuestionGeneratorAR";
import PDFImporterAR from "../components/quiz/PDFImporterAR";
import QuestionBankSelectorAR from "../components/quiz/QuestionBankSelectorAR";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";

// Optimized debounce function with faster execution
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

export default function QuizBuilderAR() {
  const navigate = useNavigate();
  const [quiz, setQuiz] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [editingQuestionId, setEditingQuestionId] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showAIGenerator, setShowAIGenerator] = useState(false);
  const [showPDFImporter, setShowPDFImporter] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [quizId, setQuizId] = useState(null);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState([]);
  const [isTransferring, setIsTransferring] = useState(false);
  const [showQuestionBankSelector, setShowQuestionBankSelector] = useState(false);

  // Local state for responsive input fields (title and description)
  const [localTitle, setLocalTitle] = useState("");
  const [localDescription, setLocalDescription] = useState("");

  // Ref to hold the current quiz object for debounced updates
  const quizRef = useRef(quiz);

  // Add helper function for delays
  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  useEffect(() => {
    quizRef.current = quiz;
    // Sync local state with quiz state when quiz object changes (e.g., on initial load)
    if (quiz) {
      setLocalTitle(quiz.title);
      setLocalDescription(quiz.description);
    }
  }, [quiz]);

  // Optimized debounced save with faster response
  const debouncedSaveQuizMeta = useCallback(
    debounce(async (quizData) => {
      if (!quizId || !quizData) return;
      setIsSaving(true);
      try {
        await QuizAR.update(quizId, {
          title: quizData.title,
          description: quizData.description,
          course_number: quizData.course_number,
          settings: quizData.settings,
          category: quizData.category
        });
        setLastSaved(new Date());
      } catch (error) {
        console.error("Auto-save failed:", error);
      }
      setIsSaving(false);
    }, 800),
    [quizId]
  );

  // Debounced function to update the main quiz state from local input states
  const debouncedUpdateQuizMetaFromLocal = useCallback(
    debounce((title, description) => {
      const currentQuiz = quizRef.current;
      if (currentQuiz && (currentQuiz.title !== title || currentQuiz.description !== description)) {
        setQuiz(prev => ({
          ...prev,
          title: title,
          description: description
        }));
      }
    }, 500), // Debounce time for updating main quiz object state
    [] // No dependencies, making this function stable
  );

  // Effect to trigger debounced update when localTitle or localDescription changes
  useEffect(() => {
    // Only trigger if local states are initialized and different from current quiz state
    if (quizRef.current && (localTitle !== quizRef.current.title || localDescription !== quizRef.current.description)) {
      debouncedUpdateQuizMetaFromLocal(localTitle, localDescription);
    }
  }, [localTitle, localDescription, debouncedUpdateQuizMetaFromLocal]);


  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('id');
    if (id) {
      setQuizId(id);
      loadQuiz(id);
    } else {
      createDraftQuiz();
    }
  }, []);

  const createDraftQuiz = async () => {
    try {
      const session = localStorage.getItem('gts_user_session');
      const currentUser = session ? JSON.parse(session) : null;
      
      if (!currentUser) {
        navigate(createPageUrl("DashboardAR"));
        return;
      }

      const newQuiz = await QuizAR.create({
        title: "اختبار بدون عنوان",
        description: "",
        course_number: "",
        status: "draft",
        owner_id: currentUser.user_id,
        settings: {
          show_results: true,
          shuffle_questions: false,
          time_limit: null,
          allow_retakes: true,
          require_password: false,
          password: "",
          use_question_bank: false,
          questions_per_user: null,
          question_section_ids: [],
          difficulty_filter: null,
          restrict_by_id: false,
          restrict_by_ip: false
        },
        category: "other"
      });
      setQuiz(newQuiz);
      setQuizId(newQuiz.id);
      navigate(createPageUrl(`QuizBuilderAR?id=${newQuiz.id}`), { replace: true });
    } catch (error) {
      console.error("Error creating draft quiz:", error);
    }
  };

  useEffect(() => {
    if (quiz) {
      debouncedSaveQuizMeta(quiz);
    }
  }, [quiz, debouncedSaveQuizMeta]);

  const loadQuiz = async (id) => {
    try {
      const session = localStorage.getItem('gts_user_session');
      const currentUser = session ? JSON.parse(session) : null;
      
      if (!currentUser) {
        navigate(createPageUrl("DashboardAR"));
        return;
      }

      const loadedQuiz = await QuizAR.get(id);
      
      // SECURE: Final, strict ownership check
      if (loadedQuiz.owner_id !== currentUser.user_id) {
        alert(
          `تم رفض الوصول\n\n` +
          `هذا الاختبار يخص حسابًا مختلفًا.\n` +
          `لأسباب أمنية، بيانات كل حساب منفصلة. لتعديل هذا الاختبار، يرجى تسجيل الدخول بالحساب الصحيح.`
        );
        navigate(createPageUrl("DashboardAR"));
        return;
      }
      
      setQuiz(loadedQuiz);
      
      if (!loadedQuiz.settings?.use_question_bank) {
        const loadedQuestions = await QuestionAR.filter({ quiz_id: id, owner_id: currentUser.user_id }, 'order', 500);
        setQuestions(loadedQuestions);
      } else {
        setQuestions([]);
      }
    } catch (error) {
      console.error("Error loading quiz:", error);
      alert(`خطأ في تحميل الاختبار: ${error.message}`);
      navigate(createPageUrl("DashboardAR"));
    }
  };

  // This updateQuiz is now only for fields other than title/description, or internal quiz updates
  const updateQuiz = useCallback((field, value) => {
    setQuiz(prev => (prev ? { ...prev, [field]: value } : null));
  }, []);

  const handleSettingsUpdate = async (newSettings, newCategory) => {
    if (!quizId) return;
    setIsSaving(true);
    try {
        await QuizAR.update(quizId, { settings: newSettings, category: newCategory });
        setQuiz(prev => ({
            ...prev,
            settings: newSettings,
            category: newCategory
        }));
        setLastSaved(new Date());
        setShowSettings(false);
    } catch (error) {
        console.error("Failed to save settings:", error);
        alert("فشل حفظ الإعدادات. يرجى المحاولة مرة أخرى.");
    }
    setIsSaving(false);
  };

  const addQuestion = async (type = "text") => {
    if (!quizId) return;
    const session = localStorage.getItem('gts_user_session');
    const currentUser = session ? JSON.parse(session) : null;
    if(!currentUser) return;

    const newQuestionData = {
      quiz_id: quizId,
      owner_id: currentUser.user_id,
      order: questions.length,
      type,
      question: "",
      options: type === "multiple_choice" || type === "checkbox" ? ["", ""] : [],
      correct_answers: [],
      points: 1,
      explanation: "",
      required: true
    };
    try {
      const newQuestion = await QuestionAR.create(newQuestionData);
      setQuestions(prev => [...prev, newQuestion]);
      setEditingQuestionId(newQuestion.id);
    } catch (error) {
      console.error("Failed to add question:", error);
    }
  };

  const updateQuestion = useCallback(async (questionId, updatedData) => {
    setIsSaving(true);
    try {
      await QuestionAR.update(questionId, updatedData);
      setQuestions(prev =>
        prev.map(q => q.id === questionId ? { ...q, ...updatedData } : q)
      );
      setLastSaved(new Date());
    } catch (error) {
      console.error("Failed to auto-update question:", error);
    }
    setIsSaving(false);
  }, []); // Dependencies are stable (setters)

  const closeQuestionEditor = useCallback((questionId, finalData) => {
    updateQuestion(questionId, finalData);
    setEditingQuestionId(null);
  }, [updateQuestion]); // Dependency on updateQuestion (which is useCallback)

  const deleteQuestion = useCallback(async (questionId) => {
    try {
      await QuestionAR.delete(questionId);
      const remainingQuestions = questions.filter(q => q.id !== questionId);
      
      // Batch update orders for better performance
      const updatePromises = remainingQuestions
        .map((q, index) => QuestionAR.update(q.id, { order: index }));
      await Promise.all(updatePromises);
      
      setQuestions(remainingQuestions.map((q, index) => ({ ...q, order: index })));
    } catch (error) {
      console.error("Failed to delete question:", error);
    }
    if (editingQuestionId === questionId) {
      setEditingQuestionId(null);
    }
  }, [questions, editingQuestionId]); // Dependencies: questions (for filter), editingQuestionId

  const duplicateQuestion = useCallback(async (question) => {
    const { id, ...questionData } = question;
    const duplicatedQuestionData = {
      ...questionData,
      order: questions.length, // New order is at the end
      question: question.question + " (نسخة)"
    };
    try {
      const newQuestion = await QuestionAR.create(duplicatedQuestionData);
      setQuestions(prev => [...prev, newQuestion]);
    } catch (error) {
      console.error("Failed to duplicate question", error);
    }
  }, [questions]); // Dependency: questions (for length)

  // Optimized drag end handler with rate limiting
  const handleDragEnd = useCallback(async (result) => {
    if (!result.destination || isSelectionMode) return;

    const items = Array.from(questions);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    const updatedItems = items.map((q, index) => ({ ...q, order: index }));
    setQuestions(updatedItems);

    try {
      setIsSaving(true);
      
      // Process updates in small batches with delays to respect rate limits
      const batchSize = 3;
      const delayBetweenBatches = 1000; // 1 second delay
      
      for (let i = 0; i < updatedItems.length; i += batchSize) {
        const batch = updatedItems.slice(i, i + batchSize);
        
        // Process each item in the batch sequentially with small delays
        for (const item of batch) {
          try {
            await QuestionAR.update(item.id, { order: item.order });
            // Small delay between individual updates within batch
            await delay(200);
          } catch (error) {
            console.error(`Failed to update question ${item.id} order:`, error);
          }
        }
        
        // Longer delay between batches
        if (i + batchSize < updatedItems.length) {
          await delay(delayBetweenBatches);
        }
      }
      
      setLastSaved(new Date());
    } catch (error) {
      console.error("Failed to save new order:", error);
      // Reload quiz to restore correct order if there was an error
      loadQuiz(quizId);
    }
    setIsSaving(false);
  }, [questions, isSelectionMode, quizId]);

  const handleQuestionSelect = useCallback((questionId) => {
    setSelectedQuestionIds(prev =>
      prev.includes(questionId)
        ? prev.filter(id => id !== questionId)
        : [...prev, questionId]
    );
  }, []); // Dependencies are stable (setSelectedQuestionIds)

  const handleSelectAll = useCallback(() => {
    if (selectedQuestionIds.length === questions.length) {
      setSelectedQuestionIds([]);
    } else {
      setSelectedQuestionIds(questions.map(q => q.id));
    }
  }, [selectedQuestionIds.length, questions]); // Dependencies: selectedQuestionIds.length, questions

  const handleTransferToBank = async () => {
    if (selectedQuestionIds.length === 0) return;

    setIsTransferring(true);
    try {
      const questionsToTransfer = questions
        .filter(q => selectedQuestionIds.includes(q.id))
        .map(q => ({
          question: q.question,
          type: q.type,
          options: q.options,
          correct_answers: q.correct_answers,
          explanation: q.explanation,
          category: quiz.category || 'مستورد من الاختبار',
          difficulty: 'medium',
          points: q.points,
          tags: quiz.category ? [quiz.category] : [],
          owner_id: JSON.parse(localStorage.getItem('gts_user_session')).user_id
        }));

      // Batch create for better performance
      await QuestionBankAR.bulkCreate(questionsToTransfer);

      alert(`✅ تم نقل ${questionsToTransfer.length} سؤال إلى بنك الأسئلة بنجاح.`);

      setSelectedQuestionIds([]);
      setIsSelectionMode(false);

    } catch (error) {
      console.error("Error transferring questions:", error);
      alert("❌ حدث خطأ أثناء نقل الأسئلة. يرجى المحاولة مرة أخرى.");
    }
    setIsTransferring(false);
  };

  const publishQuiz = async () => {
    if (!quizId) return;

    if (!quiz.title.trim() || quiz.title === "اختبار بدون عنوان") {
      alert("يرجى إضافة عنوان للاختبار قبل النشر.");
      return;
    }

    if (!quiz.settings?.use_question_bank && questions.length === 0) {
      alert("يرجى إضافة سؤال واحد على الأقل أو تفعيل بنك الأسئلة قبل النشر.");
      return;
    }
    
    if (quiz.settings?.use_question_bank && !quiz.settings?.questions_per_user) {
      alert("يرجى تكوين عدد الأسئلة المقدمة من بنك الأسئلة قبل النشر.");
      return;
    }

    setIsSaving(true);
    try {
      const shareToken = quiz.share_token || (Date.now().toString(36) + Math.random().toString(36).substr(2));
      const publishedQuizData = {
        status: "published",
        share_token: shareToken,
        title: quiz.title,
        description: quiz.description,
        course_number: quiz.course_number,
        settings: quiz.settings,
        category: quiz.category
      };

      await QuizAR.update(quizId, publishedQuizData);
      setQuiz(prev => ({ ...prev, ...publishedQuizData }));

      const shareUrl = `${window.location.origin}${createPageUrl(`TakeQuizAR?token=${shareToken}`)}`;

      const userResponse = confirm(
        `✅ تم نشر الاختبار بنجاح!\n\n` +
        `تم نسخ الرابط إلى الحافظة.\n\n` +
        `اضغط موافق لفتح الاختبار في علامة تبويب جديدة.`
      );

      navigator.clipboard.writeText(shareUrl);

      if (userResponse) {
        window.open(shareUrl, '_blank');
      }

    } catch (error) {
      console.error("Error publishing quiz:", error);
      alert("❌ خطأ في نشر الاختبار. يرجى المحاولة مرة أخرى.");
    }
    setIsSaving(false);
  };

  const handleQuestionBankSetup = async (config) => {
    if (!quizId) return;

    try {
      const updatedSettings = {
        ...quiz.settings,
        use_question_bank: true,
        questions_per_user: config.questions_per_user,
        question_section_ids: config.question_section_ids,
        difficulty_filter: config.difficulty_filter,
        section_distribution: config.section_distribution // Add section distribution
      };

      await QuizAR.update(quizId, { settings: updatedSettings });
      setQuiz(prev => ({ ...prev, settings: updatedSettings }));
      setQuestions([]);
      setShowQuestionBankSelector(false);

      if (config.section_distribution && config.section_distribution.length > 0) {
        const distributionSummary = config.section_distribution
          .map(d => `${d.questions_count} من ${d.section_name}`)
          .join('، ');
        
        alert(`✅ تم تكوين الاختبار لاستخدام بنك الأسئلة بتوزيع متقدم!\n\nسيحصل كل مستخدم على ${config.questions_per_user} سؤالاً موزعة كالتالي:\n${distributionSummary}\n\nلن تتكرر الأسئلة بين المستخدمين.`);
      } else {
        alert(`✅ تم تكوين الاختبار لاستخدام بنك الأسئلة!\n\nسيحصل كل مستخدم على ${config.questions_per_user} سؤالاً عشوائيًا من ${config.total_available} سؤال متاح.`);
      }
    } catch (error) {
      console.error("Error setting up question bank:", error);
      alert("❌ فشل إعداد بنك الأسئلة. يرجى المحاولة مرة أخرى.");
    }
  };

  // Memoized components for better performance
  const MemoizedQuestionEditor = React.memo(QuestionEditorAR);
  const MemoizedQuestionTypeSelector = useMemo(() => QuestionTypeSelectorAR, []);

  if (!quiz) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-slate-600">جارٍ تحميل منشئ الاختبارات...</p>
        </div>
      </div>
    );
  }

  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
      <div className="p-4 md:p-8">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="flex items-center gap-4">
              <Link to={createPageUrl("DashboardAR")}>
                <Button variant="outline" size="icon" className="hover:bg-slate-100">
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-slate-900">
                  منشئ الاختبارات
                </h1>
                <div className="flex items-center gap-2 mt-1 h-5">
                  <Badge variant={quiz.status === 'published' ? 'default' : 'secondary'} className={quiz.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-slate-100'}>
                    {quiz.status === 'published' ? 'منشور' : 'مسودة'}
                  </Badge>
                  {isSaving && (
                    <Badge variant="outline" className="text-blue-600 border-blue-200 flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin"/>
                      جارٍ الحفظ...
                    </Badge>
                  )}
                  {lastSaved && !isSaving && <span className="text-xs text-slate-500">تم الحفظ {format(lastSaved, 'HH:mm:ss')}</span>}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={() => setShowSettings(true)} className="gap-2">
                <Settings className="w-4 h-4" />
                الإعدادات
              </Button>
              <Button variant="outline" asChild className="gap-2">
                <Link to={createPageUrl(`PreviewAR?id=${quizId}`)} target="_blank">
                  <Eye className="w-4 h-4" />
                  معاينة
                </Link>
              </Button>
              <Button onClick={publishQuiz} disabled={!quiz.title.trim() || quiz.title === "اختبار بدون عنوان" || (!quiz.settings?.use_question_bank && questions.length === 0) || (quiz.settings?.use_question_bank && !quiz.settings?.questions_per_user) || isSaving} className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 gap-2">
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin"/> : <Share className="w-4 h-4" />}
                نشر
              </Button>
            </div>
          </div>

          {/* Quiz Basic Info */}
          <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
            <CardHeader><CardTitle className="text-xl">تفاصيل الاختبار</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="quiz-title" className="text-sm font-medium text-slate-700 mr-1">عنوان الاختبار</Label>
                    <Input
                      id="quiz-title"
                      placeholder="أدخل عنوان الاختبار..."
                      value={localTitle}
                      onChange={(e) => setLocalTitle(e.target.value)}
                      className="text-lg font-medium border-slate-200 focus:border-blue-400 mt-1 text-right"
                    />
                  </div>
                  <div>
                    <Label htmlFor="course-number" className="text-sm font-medium text-slate-700 mr-1">رقم المقرر</Label>
                    <Input
                      id="course-number"
                      placeholder="أدخل رقم المقرر..."
                      value={quiz.course_number || ""}
                      onChange={(e) => updateQuiz('course_number', e.target.value)}
                      className="text-lg font-medium border-slate-200 focus:border-blue-400 mt-1 text-right"
                    />
                  </div>
              </div>

              <div>
                <Label htmlFor="quiz-description" className="text-sm font-medium text-slate-700 mr-1">الوصف</Label>
                <Textarea
                  id="quiz-description"
                  placeholder="أضف وصفًا للاختبار..."
                  value={localDescription}
                  onChange={(e) => setLocalDescription(e.target.value)}
                  className="border-slate-200 focus:border-blue-400 mt-1 text-right"
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* AI Tools & Import */}
          <Card className="bg-gradient-to-r from-purple-50 to-indigo-50 border-purple-200/60">
            <CardHeader>
              <CardTitle className="text-xl flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-600" />
                أدوات المحتوى
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Button
                  variant="outline"
                  onClick={() => setShowAIGenerator(true)}
                  className="bg-white hover:bg-purple-50 border-purple-200 text-purple-700 gap-2 h-auto py-3 flex-col"
                >
                  <Sparkles className="w-5 h-5" />
                  <div className="text-center">
                    <div className="font-medium">إنتاج بالذكاء الاصطناعي</div>
                    <div className="text-xs opacity-75">إنشاء أسئلة تلقائيًا</div>
                  </div>
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowPDFImporter(true)}
                  className="bg-white hover:bg-red-50 border-red-200 text-red-700 gap-2 h-auto py-3 flex-col"
                >
                  <Upload className="w-5 h-5" />
                  <div className="text-center">
                    <div className="font-medium">استيراد من PDF</div>
                    <div className="text-xs opacity-75">استخراج أسئلة من PDF</div>
                  </div>
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowQuestionBankSelector(true)}
                  className="bg-white hover:bg-green-50 border-green-200 text-green-700 gap-2 h-auto py-3 flex-col"
                >
                  <Database className="w-5 h-5" />
                  <div className="text-center">
                    <div className="font-medium">استخدام بنك الأسئلة</div>
                    <div className="text-xs opacity-75">أسئلة عشوائية لكل مستخدم</div>
                  </div>
                </Button>
              </div>

              {quiz.settings?.use_question_bank && (
                <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <Database className="w-4 h-4 text-green-600" />
                    <span className="font-medium text-green-800">بنك الأسئلة نشط</span>
                  </div>
                  <p className="text-sm text-green-700">
                    يحصل كل مستخدم على {quiz.settings.questions_per_user} أسئلة عشوائية من بنك الأسئلة.
                    {quiz.settings?.section_distribution && quiz.settings.section_distribution.length > 0 && (
                      <span className="block mt-1">
                        (موزعة حسب الأقسام: {quiz.settings.section_distribution.map(d => `${d.questions_count} من ${d.section_name}`).join('، ')})
                      </span>
                    )}
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowQuestionBankSelector(true)}
                    className="text-green-700 hover:text-green-800 mt-2 p-0 h-auto"
                  >
                    تعديل الإعدادات
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Questions Section */}
          <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle className="text-xl">
                  {quiz.settings?.use_question_bank 
                    ? `أسئلة ديناميكية (${quiz.settings.questions_per_user || 'غير محدد'} لكل مستخدم)`
                    : `الأسئلة (${questions.length})`
                  }
                </CardTitle>
                {!quiz.settings?.use_question_bank && (
                  <div className="flex items-center gap-2">
                    {isSelectionMode ? (
                      <>
                        <Button variant="ghost" onClick={() => {setIsSelectionMode(false); setSelectedQuestionIds([]);}} className="gap-1">
                          <X className="w-4 h-4" />
                          إلغاء
                        </Button>
                        <Button
                          variant="outline"
                          onClick={handleSelectAll}
                          disabled={questions.length === 0}
                          className="gap-2"
                        >
                          <CheckSquare className="w-4 h-4" />
                          {selectedQuestionIds.length === questions.length && questions.length > 0 ? 'إلغاء تحديد الكل' : 'تحديد الكل'}
                        </Button>
                        <Button
                          onClick={handleTransferToBank}
                          disabled={selectedQuestionIds.length === 0 || isTransferring}
                          className="bg-purple-600 hover:bg-purple-700 gap-2"
                        >
                          {isTransferring ? <Loader2 className="w-4 h-4 animate-spin"/> : <Database className="w-4 h-4" />}
                          نقل {selectedQuestionIds.length > 0 ? `(${selectedQuestionIds.length})` : ''} إلى البنك
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button variant="outline" onClick={() => setIsSelectionMode(true)} className="gap-2" disabled={questions.length === 0}>
                          <Database className="w-4 h-4" />
                          نقل إلى البنك
                        </Button>
                        <MemoizedQuestionTypeSelector onSelect={addQuestion} />
                      </>
                    )}
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {quiz.settings?.use_question_bank ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Database className="w-8 h-8 text-green-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-700 mb-2">وضع بنك الأسئلة نشط</h3>
                  <p className="text-slate-500 mb-4">
                    سيقدم هذا الاختبار تلقائيًا {quiz.settings.questions_per_user || 'عدد قابل للتكوين من'} أسئلة عشوائية 
                    من بنك الأسئلة لكل مستخدم. لا يتم تخزين أو عرض أسئلة يدوية هنا.
                    {quiz.settings?.section_distribution && quiz.settings.section_distribution.length > 0 && (
                      <span className="block mt-1">
                        (موزعة حسب الأقسام: {quiz.settings.section_distribution.map(d => `${d.questions_count} من ${d.section_name}`).join('، ')})
                      </span>
                    )}
                  </p>
                  <div className="flex justify-center gap-3">
                    <Button 
                      onClick={() => setShowQuestionBankSelector(true)}
                      variant="outline"
                      className="gap-2"
                    >
                      <Database className="w-4 h-4" />
                      تعديل إعدادات البنك
                    </Button>
                    <Button 
                      onClick={async () => {
                        const confirmSwitch = window.confirm("هل أنت متأكد من العودة إلى الأسئلة اليدوية؟ ستظهر أسئلتك اليدوية الموجودة مرة أخرى، ولكن إذا كان بنك الأسئلة نشطًا سابقًا، فسيتم تعطيله لهذا الاختبار.");
                        if (!confirmSwitch) return;

                        const updatedSettings = {
                          ...quiz.settings,
                          use_question_bank: false,
                          questions_per_user: null,
                          question_section_ids: [],
                          difficulty_filter: null,
                          section_distribution: [] // Clear section distribution
                        };

                        try {
                          await QuizAR.update(quizId, { settings: updatedSettings });
                          setQuiz(prev => ({
                            ...prev,
                            settings: updatedSettings
                          }));
                          const loadedQuestions = await QuestionAR.filter({ quiz_id: quizId }, 'order');
                          setQuestions(loadedQuestions);
                          alert("تم التبديل إلى وضع الأسئلة اليدوية.");
                        } catch (error) {
                          console.error("Failed to switch to manual questions:", error);
                          alert("فشل في تبديل الأوضاع. يرجى المحاولة مرة أخرى.");
                        }
                      }}
                      variant="ghost"
                      className="gap-2 text-slate-600"
                    >
                      التبديل إلى الأسئلة اليدوية
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  {isSelectionMode && (
                    <div className="p-3 mb-4 bg-blue-50 border border-blue-200 text-blue-800 rounded-lg text-sm">
                      <div className="flex items-center justify-between">
                        <span>حدد الأسئلة التي تريد نقلها إلى بنك الأسئلة المركزي لإعادة الاستخدام في اختبارات أخرى.</span>
                        <Badge variant="outline" className="bg-white text-blue-700">
                          {selectedQuestionIds.length} من {questions.length} محدد
                        </Badge>
                      </div>
                    </div>
                  )}
                  {questions.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <FileText className="w-8 h-8 text-slate-400" />
                      </div>
                      <h3 className="text-lg font-semibold text-slate-700 mb-2">اختبارك فارغ</h3>
                      <p className="text-slate-500 mb-6">أضف أسئلة يدويًا أو استخدم أدوات المحتوى أعلاه.</p>
                      <Button onClick={() => addQuestion()} className="bg-blue-600 hover:bg-blue-700 gap-2">
                        <Plus className="w-4 h-4" />
                        أضف سؤال
                      </Button>
                    </div>
                  ) : (
                    <DragDropContext onDragEnd={handleDragEnd}>
                      <Droppable droppableId="questions">
                        {(provided) => (
                          <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-4">
                            {questions.map((question, index) => (
                              <Draggable key={question.id} draggableId={question.id} index={index} isDragDisabled={isSelectionMode}>
                                {(provided, snapshot) => (
                                  <div ref={provided.innerRef} {...provided.draggableProps} className={`transition-all duration-200 ${snapshot.isDragging ? 'rotate-1 shadow-2xl' : ''}`}>
                                    <MemoizedQuestionEditor
                                      question={question}
                                      index={index}
                                      isEditing={editingQuestionId === question.id}
                                      onEdit={() => setEditingQuestionId(question.id)}
                                      onUpdate={updateQuestion}
                                      onSaveAndClose={closeQuestionEditor}
                                      onDelete={() => deleteQuestion(question.id)}
                                      onDuplicate={() => duplicateQuestion(question)}
                                      dragHandleProps={provided.dragHandleProps}
                                      isSelectable={isSelectionMode}
                                      isSelected={selectedQuestionIds.includes(question.id)}
                                      onSelect={handleQuestionSelect}
                                    />
                                  </div>
                                )}
                              </Draggable>
                            ))}
                            {provided.placeholder}
                          </div>
                        )}
                      </Droppable>
                    </DragDropContext>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Modals */}
      {showSettings && (
        <QuizSettingsAR
          settings={quiz.settings}
          category={quiz.category}
          onUpdate={handleSettingsUpdate}
          onClose={() => setShowSettings(false)}
        />
      )}

      {showAIGenerator && (
        <AIQuestionGeneratorAR
          onGenerate={async (generatedQuestions) => {
            if (generatedQuestions.length > 40) {
              alert(`⚠️ تم اكتشاف دفعة كبيرة (${generatedQuestions.length} سؤال).\nقد يستغرق هذا بعض الوقت للمعالجة...`);
            }

            const session = localStorage.getItem('gts_user_session');
            const currentUser = session ? JSON.parse(session) : null;
            if (!currentUser) {
              alert("انتهت الجلسة. يرجى تسجيل الدخول مرة أخرى لإضافة أسئلة.");
              return;
            }

            // Ensure each question has the correct structure and IDs
            const newQuestions = generatedQuestions.map((q, index) => ({
              quiz_id: quizId,
              owner_id: currentUser.user_id,
              order: questions.length + index,
              type: q.type || 'multiple_choice',
              question: q.question || '',
              options: Array.isArray(q.options) ? q.options : [],
              correct_answers: Array.isArray(q.correct_answers) ? q.correct_answers : [],
              points: q.points || 1,
              explanation: q.explanation || '',
              required: true
            }));

            try {
              // Create questions one by one to ensure proper error handling
              const createdQuestions = [];
              for (const questionData of newQuestions) {
                try {
                  const created = await QuestionAR.create(questionData);
                  createdQuestions.push(created);
                } catch (error) {
                  console.error("Failed to create question:", questionData, error);
                }
              }

              if (createdQuestions.length > 0) {
                // Reload the quiz to get fresh data
                await loadQuiz(quizId);
                alert(`✅ تم إضافة ${createdQuestions.length} سؤال بنجاح!`);
                
                if (createdQuestions.length < generatedQuestions.length) {
                  alert(`⚠️ تم إنشاء ${createdQuestions.length} من أصل ${generatedQuestions.length} أسئلة. بعض الأسئلة لم يتم حفظها.`);
                }
              } else {
                alert("❌ فشل في حفظ الأسئلة. يرجى المحاولة مرة أخرى.");
              }
            } catch (error) {
              console.error("Failed to bulk create AI questions", error);
              alert("❌ فشل في حفظ بعض الأسئلة. يرجى المحاولة بعدد أقل من الأسئلة.");
            }
          }}
          onClose={() => setShowAIGenerator(false)}
        />
      )}

      {showPDFImporter && (
        <PDFImporterAR
          onImport={async (importedQuestions) => {
            if (importedQuestions.length > 40) {
              alert(`⚠️ تم اكتشاف استيراد كبير (${importedQuestions.length} سؤال).\nقد يستغرق هذا بعض الوقت للمعالجة...`);
            }
            
            const session = localStorage.getItem('gts_user_session');
            const currentUser = session ? JSON.parse(session) : null;
            if (!currentUser) {
              alert("انتهت الجلسة. يرجى تسجيل الدخول مرة أخرى لإضافة أسئلة.");
              return;
            }

            // Ensure each question has the correct structure and IDs
            const newQuestions = importedQuestions.map((q, index) => ({
              quiz_id: quizId,
              owner_id: currentUser.user_id,
              order: questions.length + index,
              type: q.type || 'multiple_choice',
              question: q.question || '',
              options: Array.isArray(q.options) ? q.options : [],
              correct_answers: Array.isArray(q.correct_answers) ? q.correct_answers : [],
              points: q.points || 1,
              explanation: q.explanation || '',
              required: true
            }));

            try {
              // Create questions one by one to ensure proper error handling
              const createdQuestions = [];
              for (const questionData of newQuestions) {
                try {
                  const created = await QuestionAR.create(questionData);
                  createdQuestions.push(created);
                } catch (error) {
                  console.error("Failed to create question:", questionData, error);
                }
              }

              if (createdQuestions.length > 0) {
                // Reload the quiz to get fresh data
                await loadQuiz(quizId);
                alert(`✅ تم استيراد ${createdQuestions.length} سؤال بنجاح!`);
                
                if (createdQuestions.length < importedQuestions.length) {
                  alert(`⚠️ تم إنشاء ${createdQuestions.length} من أصل ${importedQuestions.length} أسئلة. بعض الأسئلة لم يتم حفظها.`);
                }
              } else {
                alert("❌ فشل في استيراد الأسئلة. يرجى التحقق من ملفك والمحاولة مرة أخرى.");
              }
            } catch (error) {
              console.error("Failed to bulk create imported questions", error);
              alert("❌ فشل في استيراد بعض الأسئلة. يرجى التحقق من ملفك والمحاولة مرة أخرى.");
            }
          }}
          onClose={() => setShowPDFImporter(false)}
        />
      )}

      {showQuestionBankSelector && (
        <QuestionBankSelectorAR
          quizId={quizId}
          currentSettings={quiz.settings}
          onSetup={handleQuestionBankSetup}
          onClose={() => setShowQuestionBankSelector(false)}
        />
      )}
    </div>
  );
}
