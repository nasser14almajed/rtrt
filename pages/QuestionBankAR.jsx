
import React, { useState, useEffect, useCallback } from "react";
import { QuestionBankAR, SectionAR } from "@/api/entities"; // Changed QuestionBankAREntity to QuestionBankAR
import { InvokeLLM } from "@/api/integrations"; // Add AI integration
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox"; // Added Checkbox import
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  ArrowRight,
  Plus,
  Search,
  Edit,
  Trash2,
  Copy,
  Filter,
  Database,
  Tag,
  Upload,
  FolderOpen,
  Layers,
  X, // Added X icon
  Loader2 // Added Loader2 icon
} from "lucide-react";
import { motion } from "framer-motion";
import PDFImporterAR from "../components/bank/PDFImporterAR";
import SectionManagerAR from "../components/bank/SectionManagerAR";
import QuestionBankCardAR from "../components/bank/QuestionBankCardAR";

const colorOptions = {
  blue: "bg-blue-100 text-blue-800 border-blue-200",
  green: "bg-green-100 text-green-800 border-green-200",
  purple: "bg-purple-100 text-purple-800 border-purple-200",
  orange: "bg-orange-100 text-orange-800 border-orange-200",
  red: "bg-red-100 text-red-800 border-red-200",
  pink: "bg-pink-100 text-pink-800 border-pink-200",
  indigo: "bg-indigo-100 text-indigo-800 border-indigo-200",
  teal: "bg-teal-100 text-teal-800 border-teal-200"
};

export default function QuestionBankARPage() { // Renamed component to avoid conflict with entity name
  const [activeTab, setActiveTab] = useState("questions");
  const [questions, setQuestions] = useState([]);
  const [sections, setSections] = useState([]);
  const [sectionQuestionCounts, setSectionQuestionCounts] = useState({});
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [selectedDifficulty, setSelectedDifficulty] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [selectedSection, setSelectedSection] = useState("all");
  const [isCreating, setIsCreating] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showPDFImporter, setShowPDFImporter] = useState(false);
  const [showSectionPDFImporter, setShowSectionPDFImporter] = useState(false);
  const [importTargetSectionId, setImportTargetSectionId] = useState(null);
  const [categories, setCategories] = useState([]);

  // Add bulk selection states
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isAIImproving, setIsAIImproving] = useState(false);

  const [newQuestion, setNewQuestion] = useState({
    question: "",
    type: "multiple_choice",
    options: ["", ""],
    correct_answers: [],
    explanation: "",
    category: "",
    section_id: "",
    difficulty: "medium",
    points: 1,
    tags: []
  });

  // Add helper function for delays
  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const session = localStorage.getItem('gts_user_session');
      const currentUser = session ? JSON.parse(session) : null;
      
      if (!currentUser) {
        setQuestions([]);
        setSections([]);
        setSectionQuestionCounts({});
        setCategories([]);
        setIsLoading(false);
        return;
      }
      
      const [questionsData, sectionsData] = await Promise.all([
        QuestionBankAR.filter({ owner_id: currentUser.user_id }, "-updated_date"), // Used QuestionBankAR directly
        SectionAR.filter({ owner_id: currentUser.user_id }, "order")
      ]);

      const allQuestions = Array.isArray(questionsData) ? questionsData : [];
      setQuestions(allQuestions);
      setSections(Array.isArray(sectionsData) ? sectionsData : []);

      const counts = allQuestions.reduce((acc, question) => {
        const sectionId = question.section_id || 'unassigned'; // Questions without a section_id
        acc[sectionId] = (acc[sectionId] || 0) + 1;
        return acc;
      }, {});
      setSectionQuestionCounts(counts);

      const uniqueCategories = [...new Set(allQuestions.map(q => q.category).filter(Boolean))];
      setCategories(uniqueCategories);

    } catch (error) {
      console.error("Error loading question bank:", error);
      setQuestions([]);
      setSections([]);
      setSectionQuestionCounts({});
      setCategories([]);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredQuestions = questions.filter(question => {
    const section = sections.find(s => s.id === question.section_id);
    const matchesSearch = !searchQuery ||
      question.question?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      question.category?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      section?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      question.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCategory = filterCategory === "all" || question.category === filterCategory;
    const matchesDifficulty = selectedDifficulty === "all" || question.difficulty === selectedDifficulty;
    const matchesType = filterType === "all" || question.type === filterType;
    const matchesSection = selectedSection === "all" || (selectedSection === "uncategorized" && !question.section_id) || (question.section_id === selectedSection);

    return matchesSearch && matchesCategory && matchesDifficulty && matchesType && matchesSection;
  });

  const resetForm = () => {
    setNewQuestion({
      question: "",
      type: "multiple_choice",
      options: ["", ""],
      correct_answers: [],
      explanation: "",
      category: "",
      section_id: "",
      difficulty: "medium",
      points: 1,
      tags: []
    });
  };

  const handleSave = useCallback(async () => {
    try {
      const session = localStorage.getItem('gts_user_session');
      const currentUser = session ? JSON.parse(session) : null;
      if (!currentUser) {
        alert("انتهت الجلسة. يرجى تسجيل الدخول مرة أخرى.");
        return;
      }

      const questionData = { ...newQuestion, owner_id: currentUser.user_id };

      if (editingQuestion) {
        await QuestionBankAR.update(editingQuestion.id, questionData); // Used QuestionBankAR directly
      } else {
        await QuestionBankAR.create(questionData); // Used QuestionBankAR directly
      }
      loadData();
      setIsCreating(false);
      setEditingQuestion(null);
      resetForm();
    } catch (error) {
      console.error("Error saving question:", error);
      alert("فشل حفظ السؤال. يرجى المحاولة مرة أخرى.");
    }
  }, [newQuestion, editingQuestion, loadData]);

  const handleEdit = useCallback((question) => {
    const questionToEdit = {
      ...question,
      section_id: question.section_id === null || question.section_id === undefined ? "" : question.section_id
    };
    setNewQuestion(questionToEdit);
    setEditingQuestion(question);
    setIsCreating(true);
  }, []);

  const handleDelete = useCallback(async (questionId) => {
    if (!confirm("هل أنت متأكد أنك تريد حذف هذا السؤال؟ لا يمكن التراجع عن هذا الإجراء.")) {
      return;
    }
    try {
      await QuestionBankAR.delete(questionId); // Used QuestionBankAR directly
      // Remove from local state immediately for better UX
      setQuestions(prev => prev.filter(q => q.id !== questionId));
      // Reload all data to ensure section counts and other dependencies are consistent
      loadData(); 
    } catch (error) {
      console.error("Error deleting question:", error);
      if (error.message.includes('404') || error.message.includes('Entity not found')) {
        alert("تم حذف هذا السؤال بالفعل. يتم تحديث القائمة...");
        loadData();
      } else {
        alert("فشل حذف السؤال. يرجى المحاولة مرة أخرى.");
      }
    }
  }, [loadData]);

  const handleDuplicate = useCallback(async (question) => {
    try {
      const session = localStorage.getItem('gts_user_session');
      const currentUser = session ? JSON.parse(session) : null;
      if (!currentUser) {
        alert("انتهت الجلسة. يرجى تسجيل الدخول مرة أخرى.");
        return;
      }
      const duplicated = {
        question: question.question + " (نسخة)",
        type: question.type,
        options: question.options || [],
        correct_answers: question.correct_answers || [],
        explanation: question.explanation || "",
        category: question.category || "",
        section_id: question.section_id || "",
        difficulty: question.difficulty || "medium",
        points: question.points || 1,
        tags: question.tags || [],
        owner_id: currentUser.user_id
      };
      await QuestionBankAR.create(duplicated); // Used QuestionBankAR directly
      loadData();
    } catch (error) {
      console.error("Error duplicating question:", error);
      alert("فشل تكرار السؤال. يرجى المحاولة مرة أخرى.");
    }
  }, [loadData]);

  const handleBulkImport = useCallback(async (importedQuestions) => {
    if (!importedQuestions || importedQuestions.length === 0) return;
    setIsLoading(true);
    try {
      const session = localStorage.getItem('gts_user_session');
      const currentUser = session ? JSON.parse(session) : null;
      if (!currentUser) {
        alert("انتهت الجلسة. يرجى تسجيل الدخول مرة أخرى لاستيراد الأسئلة.");
        setIsLoading(false);
        return;
      }
      
      const validQuestions = importedQuestions
        .filter(q => q.question && q.question.trim().length > 0 && q.type)
        .map(q => ({
          ...q,
          owner_id: currentUser.user_id
        }));

      if (validQuestions.length === 0) {
        alert("لم يتم العثور على أسئلة صالحة للاستيراد.");
        setIsLoading(false);
        return;
      }

      await QuestionBankAR.bulkCreate(validQuestions); // Used QuestionBankAR directly
      alert(`تم استيراد ${validQuestions.length} سؤالاً بنجاح!`);
      loadData();
      setShowPDFImporter(false);
    } catch (error) {
      console.error("Error bulk importing questions:", error);
      alert("حدث خطأ أثناء الاستيراد. يرجى التحقق من ملفك والمحاولة مرة أخرى.");
    }
    setIsLoading(false);
  }, [loadData]);

  const handleImportToSection = useCallback(async (importedQuestions) => {
    if (!importedQuestions || importedQuestions.length === 0 || !importTargetSectionId) return;
    setIsLoading(true);
    try {
      const session = localStorage.getItem('gts_user_session');
      const currentUser = session ? JSON.parse(session) : null;
      if (!currentUser) {
        alert("انتهت الجلسة. يرجى تسجيل الدخول مرة أخرى لاستيراد الأسئلة.");
        setIsLoading(false);
        return;
      }
      
      const questionsWithSection = importedQuestions
        .filter(q => q.question && q.question.trim().length > 0 && q.type)
        .map(q => ({
          ...q,
          owner_id: currentUser.user_id,
          section_id: importTargetSectionId
        }));

      if (questionsWithSection.length === 0) {
        alert("لم يتم العثور على أسئلة صالحة للاستيراد.");
        setIsLoading(false);
        return;
      }

      await QuestionBankAR.bulkCreate(questionsWithSection); // Used QuestionBankAR directly
      alert(`تم استيراد ${questionsWithSection.length} سؤالاً بنجاح إلى القسم!`);
      loadData();
      setShowSectionPDFImporter(false);
      setImportTargetSectionId(null);
    } catch (error) {
      console.error("Error importing questions to section:", error);
      alert("حدث خطأ أثناء الاستيراد. يرجى التحقق من ملفك والمحاولة مرة أخرى.");
    }
    setIsLoading(false);
  }, [loadData, importTargetSectionId]);
  
  const handleOpenSectionImport = (sectionId) => {
    setImportTargetSectionId(sectionId);
    setShowSectionPDFImporter(true);
  };

  // Section management functions
  const handleCreateSection = useCallback(async (sectionData) => {
    try {
      const session = localStorage.getItem('gts_user_session');
      const currentUser = session ? JSON.parse(session) : null;
      if (!currentUser) { alert("انتهت الجلسة."); return; }
      
      await SectionAR.create({ ...sectionData, owner_id: currentUser.user_id });
      loadData();
    } catch (error) {
      console.error("Error creating section:", error);
      alert("فشل إنشاء القسم. الرجاء المحاولة مرة أخرى.");
    }
  }, [loadData]);

  const handleUpdateSection = useCallback(async (sectionId, sectionData) => {
    try {
      await SectionAR.update(sectionId, sectionData);
      loadData();
    } catch (error) {
      console.error("Error updating section:", error);
      alert("فشل تحديث القسم. الرجاء المحاولة مرة أخرى.");
    }
  }, [loadData]);

  const handleDeleteSection = useCallback(async (sectionId) => {
    try {
      const questionsInSection = questions.filter(q => q.section_id === sectionId);
      const updatePromises = questionsInSection.map(q =>
        QuestionBankAR.update(q.id, { ...q, section_id: "" }) // Used QuestionBankAR directly
      );
      
      await Promise.all(updatePromises);
      await SectionAR.delete(sectionId);
      loadData();
    } catch (error) {
      console.error("Error deleting section:", error);
      alert("فشل حذف القسم. الرجاء المحاولة مرة أخرى.");
    }
  }, [loadData, questions]);

  const addOption = () => {
    setNewQuestion(prev => ({ ...prev, options: [...prev.options, ""] }));
  };

  const updateOption = (index, value) => {
    const newOptions = [...newQuestion.options];
    newOptions[index] = value;
    setNewQuestion(prev => ({ ...prev, options: newOptions }));
  };

  const removeOption = (index) => {
    const newOptions = newQuestion.options.filter((_, i) => i !== index);
    const newCorrectAnswers = newQuestion.correct_answers.filter(
      answer => answer !== newQuestion.options[index]
    );
    setNewQuestion(prev => ({ ...prev, options: newOptions, correct_answers: newCorrectAnswers }));
  };

  const toggleCorrectAnswer = (option) => {
    const isCurrentlyCorrect = newQuestion.correct_answers.includes(option);
    let newCorrectAnswers;

    if (newQuestion.type === 'multiple_choice' || newQuestion.type === 'true_false') {
      newCorrectAnswers = isCurrentlyCorrect ? [] : [option];
    } else {
      newCorrectAnswers = isCurrentlyCorrect
        ? newQuestion.correct_answers.filter(a => a !== option)
        : [...newQuestion.correct_answers, option];
    }

    setNewQuestion(prev => ({ ...prev, correct_answers: newCorrectAnswers }));
  };

  const handleBulkDelete = async () => {
    if (selectedQuestionIds.length === 0) return;

    const confirmMessage = `هل أنت متأكد من حذف ${selectedQuestionIds.length} سؤال؟ لا يمكن التراجع عن هذا الإجراء.\n\nملاحظة: قد تستغرق هذه العملية بعض الوقت لتجنب حدود معدل الطلبات.`;
    if (!confirm(confirmMessage)) return;

    setIsDeleting(true);
    
    let successCount = 0;
    let failCount = 0;
    const batchSize = 3; // Small batch size to avoid rate limits
    const delayBetweenBatches = 1000; // 1 second delay

    // Process deletions in batches
    for (let i = 0; i < selectedQuestionIds.length; i += batchSize) {
      const batch = selectedQuestionIds.slice(i, i + batchSize);
      
      for (const questionId of batch) {
        try {
          await QuestionBankAR.delete(questionId);
          successCount++;
        } catch (error) {
          console.error(`Failed to delete question ${questionId}:`, error);
          failCount++;
        }
      }
      
      // Add delay between batches
      if (i + batchSize < selectedQuestionIds.length) {
        await delay(delayBetweenBatches);
      }
    }

    // Show results to user
    if (failCount === 0) {
      alert(`تم حذف جميع الأسئلة (${successCount}) بنجاح!`);
    } else if (successCount === 0) {
      alert(`فشل في حذف جميع الأسئلة. يرجى المحاولة مرة أخرى لاحقاً.`);
    } else {
      alert(`تم حذف ${successCount} سؤال بنجاح. فشل في حذف ${failCount} سؤال. يرجى المحاولة مرة أخرى للعناصر المتبقية.`);
    }

    setIsDeleting(false);
    setSelectedQuestionIds([]);
    setIsSelectionMode(false);
    loadData();
  };

  const handleQuestionSelect = (questionId) => {
    setSelectedQuestionIds(prev =>
      prev.includes(questionId)
        ? prev.filter(id => id !== questionId)
        : [...prev, questionId]
    );
  };

  const handleSelectAll = () => {
    if (selectedQuestionIds.length === filteredQuestions.length) {
      setSelectedQuestionIds([]);
    } else {
      setSelectedQuestionIds(filteredQuestions.map(q => q.id));
    }
  };

  // New AI question improvement function
  const improveQuestionWithAI = async (question) => {
    setIsAIImproving(true);
    try {
      const aiPrompt = `
أنت خبير في تطوير الاختبارات التعليمية باللغة العربية. مهمتك هو تحسين صياغة الأسئلة وإجاباتها لتجنب مشاكل المطابقة النصية الدقيقة وتحسين وضوح السؤال.

السؤال المطلوب تحسينه:
${JSON.stringify(question, null, 2)}

يرجى تحسين السؤال وفقاً للمعايير التالية:

1. **تحسين صياغة السؤال**:
   - اجعل السؤال واضحاً ومباشراً
   - تجنب الغموض أو التفسيرات المتعددة
   - استخدم لغة بسيطة ومفهومة

2. **تحسين الإجابات الصحيحة**:
   - أضف جميع الاختلافات المقبولة للإجابة الصحيحة
   - للأسئلة النصية: أضف المرادفات والصيغ المختلفة
   - لأسئلة صح/خطأ: تأكد من تضمين ("صح", "صحيح", "نعم") للصحيح و ("خطأ", "خاطئ", "لا") للخطأ

3. **تحسين الخيارات** (للأسئلة متعددة الخيارات):
   - اجعل الخيارات واضحة ومتميزة
   - تجنب الخيارات المضللة بشكل مفرط

4. **تحسين التفسير**:
   - أضف تفسيراً واضحاً يشرح لماذا الإجابة صحيحة

يرجى إرجاع السؤال المحسن بالشكل التالي:
`;

      const aiResponse = await InvokeLLM({
        prompt: aiPrompt,
        response_json_schema: {
          type: "object",
          properties: {
            improved_question: {
              type: "object",
              properties: {
                question: { type: "string" },
                type: { type: "string" },
                options: { type: "array", items: { type: "string" } },
                correct_answers: { type: "array", items: { type: "string" } },
                explanation: { type: "string" },
                category: { type: "string" },
                difficulty: { type: "string" },
                points: { type: "number" },
                tags: { type: "array", items: { type: "string" } }
              }
            },
            improvements_made: {
              type: "array",
              items: { type: "string" }
            },
            confidence_score: { type: "number" }
          },
          required: ["improved_question", "improvements_made", "confidence_score"]
        }
      });

      if (!aiResponse || !aiResponse.improved_question) {
        alert("فشل في تحسين السؤال بالذكاء الاصطناعي. يرجى المحاولة مرة أخرى.");
        return;
      }

      // Show improvement preview to user
      const improvementPreview = `
التحسينات المقترحة:
${aiResponse.improvements_made.map(imp => `• ${imp}`).join('\n')}

مستوى الثقة: ${Math.round(aiResponse.confidence_score * 100)}%

السؤال الأصلي: ${question.question}
السؤال المحسن: ${aiResponse.improved_question.question}

الإجابات الصحيحة الأصلية: ${(question.correct_answers || []).join(', ')}
الإجابات الصحيحة المحسنة: ${(aiResponse.improved_question.correct_answers || []).join(', ')}
`;

      const userConfirmed = confirm(`${improvementPreview}\n\nهل تريد تطبيق هذه التحسينات؟`);

      if (userConfirmed) {
        // Update question with improvements
        const improvedQuestionData = {
          ...question,
          ...aiResponse.improved_question,
          section_id: question.section_id, // Preserve section
          owner_id: question.owner_id // Preserve owner
        };

        await QuestionBankAR.update(question.id, improvedQuestionData);
        loadData(); // Refresh the question list
        alert("✅ تم تحسين السؤال بنجاح!");
      }

    } catch (error) {
      console.error("Error improving question with AI:", error);
      alert("❌ حدث خطأ أثناء تحسين السؤال. يرجى المحاولة مرة أخرى.");
    } finally {
      // Don't set isAIImproving to false here if it's a bulk operation.
      // The bulk operation function will handle it.
      // This function can be called individually or from bulk.
      // For individual calls, it's fine. For bulk, the outer function controls it.
      // A common pattern is to set it false *only* in the bulk function.
      if (!isSelectionMode) { // Only set to false if not part of a bulk selection
        setIsAIImproving(false);
      }
    }
  };

  // Bulk AI improvement function
  const bulkImproveQuestionsWithAI = async () => {
    if (selectedQuestionIds.length === 0) {
      alert("يرجى تحديد أسئلة للتحسين.");
      return;
    }

    const confirmMessage = `هل تريد تحسين ${selectedQuestionIds.length} سؤال محدد باستخدام الذكاء الاصطناعي؟\n\n⚠️ تنبيه: هذه العملية قد تستغرق وقتاً أطول حسب عدد الأسئلة المحددة.`;

    if (!confirm(confirmMessage)) return;

    setIsAIImproving(true);
    let successCount = 0;
    let errorCount = 0;

    try {
      const questionsToImprove = filteredQuestions.filter(q => selectedQuestionIds.includes(q.id));
      
      for (const question of questionsToImprove) {
        try {
          // Call the individual improvement function but skip the final setIsAIImproving(false)
          // Also, we don't want a confirm dialog for each question in bulk.
          // Refactor improveQuestionWithAI to accept a 'silent' flag or create a new internal function.
          // For now, I'll inline the core logic to avoid repeated confirms.
          const aiPrompt = `
أنت خبير في تطوير الاختبارات التعليمية باللغة العربية. مهمتك هو تحسين صياغة الأسئلة وإجاباتها لتجنب مشاكل المطابقة النصية الدقيقة وتحسين وضوح السؤال.

السؤال المطلوب تحسينه:
${JSON.stringify(question, null, 2)}

يرجى تحسين السؤال وفقاً للمعايير التالية:

1. **تحسين صياغة السؤال**:
   - اجعل السؤال واضحاً ومباشراً
   - تجنب الغموض أو التفسيرات المتعددة
   - استخدم لغة بسيطة ومفهومة

2. **تحسين الإجابات الصحيحة**:
   - أضف جميع الاختلافات المقبولة للإجابة الصحيحة
   - للأسئلة النصية: أضف المرادفات والصيغ المختلفة
   - لأسئلة صح/خطأ: تأكد من تضمين ("صح", "صحيح", "نعم") للصحيح و ("خطأ", "خاطئ", "لا") للخطأ

3. **تحسين الخيارات** (للأسئلة متعددة الخيارات):
   - اجعل الخيارات واضحة ومتميزة
   - تجنب الخيارات المضللة بشكل مفرط

4. **تحسين التفسير**:
   - أضف تفسيراً واضحاً يشرح لماذا الإجابة صحيحة

يرجى إرجاع السؤال المحسن بالشكل التالي:
`;

          const aiResponse = await InvokeLLM({
            prompt: aiPrompt,
            response_json_schema: {
              type: "object",
              properties: {
                improved_question: {
                  type: "object",
                  properties: {
                    question: { type: "string" },
                    type: { type: "string" },
                    options: { type: "array", items: { type: "string" } },
                    correct_answers: { type: "array", items: { type: "string" } },
                    explanation: { type: "string" },
                    category: { type: "string" },
                    difficulty: { type: "string" },
                    points: { type: "number" },
                    tags: { type: "array", items: { type: "string" } }
                  }
                },
                improvements_made: {
                  type: "array",
                  items: { type: "string" }
                },
                confidence_score: { type: "number" }
              },
              required: ["improved_question", "improvements_made", "confidence_score"]
            }
          });

          if (aiResponse && aiResponse.improved_question) {
            const improvedQuestionData = {
              ...question,
              ...aiResponse.improved_question,
              section_id: question.section_id, // Preserve section
              owner_id: question.owner_id // Preserve owner
            };
            await QuestionBankAR.update(question.id, improvedQuestionData);
            successCount++;
          } else {
            console.warn(`AI response for question ${question.id} was invalid.`);
            errorCount++;
          }
          
          // Add delay between questions to avoid rate limits
          await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay

        } catch (innerError) {
          console.error(`Error improving question ${question.id}:`, innerError);
          errorCount++;
        }
      }

      if (errorCount > 0) {
        alert(`⚠️ تم تحسين ${successCount} سؤال بنجاح. فشل في تحسين ${errorCount} أسئلة.`);
      } else {
        alert(`✅ تم تحسين ${successCount} سؤال بنجاح!`);
      }

    } catch (error) {
      console.error("Error in bulk improve:", error);
      alert("❌ حدث خطأ أثناء التحسين المجمع.");
    } finally {
      setIsAIImproving(false);
      setSelectedQuestionIds([]);
      setIsSelectionMode(false);
      loadData(); // Reload all data after bulk operations
    }
  };


  return (
    <div dir="rtl" className="p-4 md:p-8 space-y-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
          <div className="flex items-center gap-4">
            <Link to={createPageUrl("DashboardAR")}>
              <Button variant="outline" size="icon">
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-slate-900">
                بنك الأسئلة
              </h1>
              <p className="text-slate-600">
                إدارة الأسئلة القابلة لإعادة الاستخدام منظمة حسب الأقسام
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isSelectionMode ? (
              <>
                <Button variant="ghost" onClick={() => { 
                  setIsSelectionMode(false); 
                  setSelectedQuestionIds([]); 
                }} className="gap-2">
                  <X className="w-4 h-4" />
                  إلغاء
                </Button>
                <Button 
                  onClick={bulkImproveQuestionsWithAI}
                  disabled={selectedQuestionIds.length === 0 || isAIImproving || isDeleting}
                  className="gap-2 bg-purple-600 hover:bg-purple-700"
                >
                  {isAIImproving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      جاري التحسين...
                    </>
                  ) : (
                    <>
                      🤖
                      تحسين بالذكاء الاصطناعي ({selectedQuestionIds.length})
                    </>
                  )}
                </Button>
                <Button 
                  variant="destructive" 
                  onClick={handleBulkDelete} 
                  disabled={selectedQuestionIds.length === 0 || isDeleting || isAIImproving}
                  className="gap-2"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      جاري الحذف...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      حذف ({selectedQuestionIds.length})
                    </>
                  )}
                </Button>
              </>
            ) : (
              <>
                <Button 
                  variant="outline" 
                  onClick={() => setIsSelectionMode(true)} 
                  disabled={questions.length === 0}
                  className="gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  إجراءات مجمعة
                </Button>
                <Button onClick={() => setShowPDFImporter(true)} variant="outline" className="gap-2">
                  <Upload className="w-4 h-4" />
                  استيراد من PDF
                </Button>
                <Button
                  onClick={() => {
                    resetForm();
                    setIsCreating(true);
                  }}
                  className="bg-blue-600 hover:bg-blue-700 gap-2"
                >
                  <Plus className="w-4 h-4" />
                  أضف سؤال
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <CardHeader className="p-4">
              <div className="flex items-center gap-3">
                <Database className="w-8 h-8 text-blue-600" />
                <div>
                  <p className="text-sm text-blue-700">مجموع الأسئلة</p>
                  <p className="text-2xl font-bold text-blue-900">{questions.length}</p>
                </div>
              </div>
            </CardHeader>
          </Card>
          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
            <CardHeader className="p-4">
              <div className="flex items-center gap-3">
                <Layers className="w-8 h-8 text-green-600" />
                <div>
                  <p className="text-sm text-green-700">الأقسام</p>
                  <p className="text-2xl font-bold text-green-900">{sections.length}</p>
                </div>
              </div>
            </CardHeader>
          </Card>
          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
            <CardHeader className="p-4">
              <div className="flex items-center gap-3">
                <Filter className="w-8 h-8 text-purple-600" />
                <div>
                  <p className="text-sm text-purple-700">نتائج الفلترة</p>
                  <p className="text-2xl font-bold text-purple-900">{filteredQuestions.length}</p>
                </div>
              </div>
            </CardHeader>
          </Card>
          <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
            <CardHeader className="p-4">
              <div className="flex items-center gap-3">
                <Tag className="w-8 h-8 text-orange-600" />
                <div>
                  <p className="text-sm text-orange-700">الفئات</p>
                  <p className="text-2xl font-bold text-orange-900">{categories.length}</p>
                </div>
              </div>
            </CardHeader>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="questions" className="gap-2">
              <Database className="w-4 h-4" />
              الأسئلة
            </TabsTrigger>
            <TabsTrigger value="sections" className="gap-2">
              <Layers className="w-4 h-4" />
              الأقسام
            </TabsTrigger>
          </TabsList>

          <TabsContent value="sections" className="space-y-6">
            <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Layers className="w-5 h-5" />
                  إدارة الأقسام
                </CardTitle>
                <p className="text-slate-600">
                  نظم أسئلتك في أقسام. لديك ما مجموعه {questions.length} سؤال في بنكك.
                </p>
              </CardHeader>
              <CardContent>
                <SectionManagerAR
                  sections={sections}
                  questionCounts={sectionQuestionCounts}
                  onCreateSection={handleCreateSection}
                  onUpdateSection={handleUpdateSection}
                  onDeleteSection={handleDeleteSection}
                  onOpenImport={handleOpenSectionImport}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="questions" className="space-y-6">
            {/* Filters */}
            <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
              <CardHeader>
                <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
                  <CardTitle>فلترة الأسئلة</CardTitle>
                  {isSelectionMode && (
                    <div className="flex items-center gap-4">
                      <Badge variant="outline">{selectedQuestionIds.length} من أصل {filteredQuestions.length} محدد</Badge>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="select-all"
                          onCheckedChange={handleSelectAll}
                          checked={selectedQuestionIds.length === filteredQuestions.length && filteredQuestions.length > 0}
                        />
                        <label htmlFor="select-all" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                          تحديد الكل
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  <div className="relative">
                    <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <Input
                      placeholder="ابحث عن الأسئلة..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pr-10"
                    />
                  </div>
                  <Select value={selectedSection} onValueChange={setSelectedSection}>
                    <SelectTrigger>
                      <SelectValue placeholder="كل الأقسام" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">كل الأقسام</SelectItem>
                      {sections.map((section) => (
                        <SelectItem key={section.id} value={section.id}>
                          {section.name}
                        </SelectItem>
                      ))}
                      <SelectItem value="uncategorized">غير مصنف</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={filterCategory} onValueChange={setFilterCategory}>
                    <SelectTrigger>
                      <SelectValue placeholder="كل الفئات" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">كل الفئات</SelectItem>
                      {categories.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={selectedDifficulty} onValueChange={setSelectedDifficulty}>
                    <SelectTrigger>
                      <SelectValue placeholder="كل الصعوبات" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">كل الصعوبات</SelectItem>
                      <SelectItem value="easy">سهل</SelectItem>
                      <SelectItem value="medium">متوسط</SelectItem>
                      <SelectItem value="hard">صعب</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger>
                      <SelectValue placeholder="كل الأنواع" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">كل الأنواع</SelectItem>
                      <SelectItem value="multiple_choice">اختيار من متعدد</SelectItem>
                      <SelectItem value="checkbox">مربعات اختيار</SelectItem>
                      <SelectItem value="true_false">صح/خطأ</SelectItem>
                      <SelectItem value="text">إجابة نصية</SelectItem>
                      <SelectItem value="fill_blank">ملء الفراغ</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Questions Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {isLoading ? (
                Array(6).fill(0).map((_, i) => (
                  <Card key={i} className="animate-pulse">
                    <CardHeader>
                      <div className="h-4 bg-slate-200 rounded w-3/4 mb-2"></div>
                      <div className="h-3 bg-slate-200 rounded w-1/2"></div>
                    </CardHeader>
                    <CardContent>
                      <div className="h-12 bg-slate-200 rounded mb-4"></div>
                      <div className="flex justify-between">
                        <div className="h-6 bg-slate-200 rounded w-16"></div>
                        <div className="h-6 bg-slate-200 rounded w-20"></div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : filteredQuestions.length === 0 ? (
                <div className="col-span-2 text-center py-12">
                  <Database className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-slate-600 mb-2">
                    {searchQuery || filterCategory !== "all" || selectedDifficulty !== "all" || filterType !== "all" || selectedSection !== "all"
                      ? "لا توجد أسئلة تطابق الفلاتر الخاصة بك"
                      : "لا توجد أسئلة في البنك الخاص بك بعد"
                    }
                  </h3>
                  <p className="text-slate-500 mb-6">
                    {searchQuery || filterCategory !== "all" || selectedDifficulty !== "all" || filterType !== "all" || selectedSection !== "all"
                      ? "حاول تعديل بحثك أو الفلاتر"
                      : "قم بإنشاء أول سؤال قابل لإعادة الاستخدام"
                    }
                  </p>
                  <Button
                    onClick={() => {
                      resetForm();
                      setIsCreating(true);
                    }}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <Plus className="w-4 h-4 ml-2" />
                    أضف سؤال
                  </Button>
                </div>
              ) : (
                filteredQuestions.map((question, index) => {
                  const section = sections.find(s => s.id === question.section_id);
                  return (
                    <div key={question.id} className="relative">
                      {isSelectionMode && (
                        <div className="absolute top-3 left-3 z-10">
                          <Checkbox
                            checked={selectedQuestionIds.includes(question.id)}
                            onCheckedChange={() => handleQuestionSelect(question.id)}
                            className="bg-white border-slate-300"
                          />
                        </div>
                      )}
                      <div 
                        className={isSelectionMode && selectedQuestionIds.includes(question.id) ? 'ring-2 ring-blue-500 rounded-lg' : ''}
                        onClick={() => isSelectionMode && handleQuestionSelect(question.id)}
                        style={{ cursor: isSelectionMode ? 'pointer' : 'default' }}
                      >
                        <QuestionBankCardAR
                          question={question}
                          section={section}
                          colorOptions={colorOptions}
                          onEdit={isSelectionMode ? () => {} : handleEdit}
                          onDuplicate={isSelectionMode ? () => {} : handleDuplicate}
                          onDelete={isSelectionMode ? () => {} : handleDelete}
                          onAIImprove={isSelectionMode ? () => {} : improveQuestionWithAI} // Add AI improve callback
                          index={index}
                          isSelectionMode={isSelectionMode}
                          isAIImproving={isAIImproving}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* Create/Edit Dialog */}
        <Dialog open={isCreating} onOpenChange={setIsCreating}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-right">
                {editingQuestion ? 'تعديل سؤال' : 'إنشاء سؤال جديد'}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 text-right">
              <div>
                <label className="text-sm font-medium">السؤال</label>
                <Textarea
                  value={newQuestion.question}
                  onChange={(e) => setNewQuestion(prev => ({ ...prev, question: e.target.value }))}
                  placeholder="أدخل سؤالك..."
                  className="mt-2 text-right"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">النوع</label>
                  <Select
                    value={newQuestion.type}
                    onValueChange={(value) => setNewQuestion(prev => ({ ...prev, type: value }))}
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="multiple_choice">اختيار من متعدد</SelectItem>
                      <SelectItem value="checkbox">مربعات اختيار</SelectItem>
                      <SelectItem value="true_false">صح/خطأ</SelectItem>
                      <SelectItem value="text">إجابة نصية</SelectItem>
                      <SelectItem value="fill_blank">ملء الفراغ</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium">الصعوبة</label>
                  <Select
                    value={newQuestion.difficulty}
                    onValueChange={(value) => setNewQuestion(prev => ({ ...prev, difficulty: value }))}
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="easy">سهل</SelectItem>
                      <SelectItem value="medium">متوسط</SelectItem>
                      <SelectItem value="hard">صعب</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {(newQuestion.type === 'multiple_choice' || newQuestion.type === 'checkbox') && (
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <label className="text-sm font-medium">خيارات الإجابة</label>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={addOption}
                      className="gap-1"
                    >
                      <Plus className="w-4 h-4" />
                      أضف خيار
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {newQuestion.options.map((option, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <input
                          type={newQuestion.type === 'multiple_choice' ? 'radio' : 'checkbox'}
                          checked={newQuestion.correct_answers?.includes(option)}
                          onChange={() => toggleCorrectAnswer(option)}
                          className="text-green-600 ml-2"
                        />
                        <Input
                          value={option}
                          onChange={(e) => updateOption(index, e.target.value)}
                          placeholder={`خيار ${index + 1}`}
                          className="flex-1 text-right"
                        />
                        {newQuestion.options.length > 2 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeOption(index)}
                            className="text-red-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium">القسم</label>
                  <Select
                    value={newQuestion.section_id || ""}
                    onValueChange={(value) => setNewQuestion(prev => ({ ...prev, section_id: value === "no_section" ? "" : value }))}
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder="اختر قسم" />
                    </SelectTrigger>
                    <SelectContent>
                      {sections.map((section) => (
                        <SelectItem key={section.id} value={section.id}>
                          {section.name}
                        </SelectItem>
                      ))}
                      <SelectItem value="no_section">بدون قسم</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">الفئة</label>
                  <Input
                    value={newQuestion.category}
                    onChange={(e) => setNewQuestion(prev => ({ ...prev, category: e.target.value }))}
                    placeholder="مثال: رياضيات, علوم..."
                    className="mt-2 text-right"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">النقاط</label>
                  <Input
                    type="number"
                    min="1"
                    value={newQuestion.points}
                    onChange={(e) => setNewQuestion(prev => ({ ...prev, points: parseInt(e.target.value) || 1 }))}
                    className="mt-2 text-right"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">شرح (اختياري)</label>
                <Textarea
                  value={newQuestion.explanation}
                  onChange={(e) => setNewQuestion(prev => ({ ...prev, explanation: e.target.value }))}
                  placeholder="اشرح الإجابة الصحيحة..."
                  className="mt-2 text-right"
                  rows={2}
                />
              </div>
            </div>

            <DialogFooter className="flex-row-reverse">
              <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700">
                {editingQuestion ? 'تحديث' : 'إنشاء'} سؤال
              </Button>
              <Button variant="outline" onClick={() => {
                setIsCreating(false);
                setEditingQuestion(null);
                resetForm();
              }}>
                إلغاء
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* PDF Importer Dialog */}
        {showPDFImporter && (
          <PDFImporterAR
            onImport={handleBulkImport}
            onClose={() => setShowPDFImporter(false)}
          />
        )}
        
        {showSectionPDFImporter && (
          <PDFImporterAR
            onImport={handleImportToSection}
            onClose={() => {
              setShowSectionPDFImporter(false);
              setImportTargetSectionId(null);
            }}
          />
        )}
      </div>
    </div>
  );
}
