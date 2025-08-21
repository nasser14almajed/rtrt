
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Quiz, Question, QuestionBank, User } from "@/api/entities";
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
  ArrowLeft,
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
import QuestionEditor from "../components/quiz/QuestionEditor";
import QuestionTypeSelector from "../components/quiz/QuestionTypeSelector";
import QuizSettings from "../components/quiz/QuizSettings";
import AIQuestionGenerator from "../components/quiz/AIQuestionGenerator";
import PDFImporter from "../components/quiz/PDFImporter";
import QuestionBankSelector from "../components/quiz/QuestionBankSelector";
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

export default function QuizBuilder() {
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

  // Optimized debounced save with faster response (reduced from 1500ms to 800ms)
  const debouncedSaveQuizMeta = useCallback(
    debounce(async (quizData) => {
      if (!quizId || !quizData) return;
      setIsSaving(true);
      try {
        await Quiz.update(quizId, {
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
        navigate(createPageUrl("Dashboard"));
        return;
      }

      const newQuiz = await Quiz.create({
        title: "Untitled Quiz",
        description: "",
        course_number: "",
        status: "draft",
        owner_id: currentUser.user_id, // SECURE: Assign ownership on creation
        settings: {
          show_results: true,
          shuffle_questions: false,
          time_limit: null,
          allow_retakes: true,
          require_password: false,
          password: "",
          use_question_bank: false,
          questions_per_user: null,
          question_section_ids: [], // Corrected property name
          difficulty_filter: null,     // Corrected type
          restrict_by_id: false,
          restrict_by_ip: false
        },
        category: "other"
      });
      setQuiz(newQuiz);
      setQuizId(newQuiz.id);
      navigate(createPageUrl(`QuizBuilder?id=${newQuiz.id}`), { replace: true });
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
        navigate(createPageUrl("Dashboard"));
        return;
      }

      const loadedQuiz = await Quiz.get(id);
      
      // SECURE: Final, strict ownership check
      if (loadedQuiz.owner_id !== currentUser.user_id) {
        console.error("Access denied: Quiz does not belong to current user");
        console.error(`Attempted access by user "${currentUser.user_id}" on quiz owned by "${loadedQuiz.owner_id}"`);
        
        alert(
          `Access Denied\n\n` +
          `This quiz belongs to a different account.\n` +
          `For security, each account's data is kept separate. To edit this quiz, please log in as the correct user.`
        );

        navigate(createPageUrl("Dashboard"));
        return;
      }
      
      setQuiz(loadedQuiz);
      
      if (!loadedQuiz.settings?.use_question_bank) {
        const loadedQuestions = await Question.filter({ quiz_id: id, owner_id: currentUser.user_id }, 'order', 500);
        setQuestions(loadedQuestions);
      } else {
        setQuestions([]);
      }
    } catch (error) {
      console.error("Error loading quiz:", error);
      alert(`Error loading quiz: ${error.message}`);
      navigate(createPageUrl("Dashboard"));
    }
  };

  const updateQuiz = useCallback((field, value) => {
    setQuiz(prev => (prev ? { ...prev, [field]: value } : null));
  }, []);

  const handleSettingsUpdate = async (newSettings, newCategory) => {
    if (!quizId) return;
    setIsSaving(true);
    try {
        await Quiz.update(quizId, { settings: newSettings, category: newCategory });
        setQuiz(prev => ({
            ...prev,
            settings: newSettings,
            category: newCategory
        }));
        setLastSaved(new Date());
        setShowSettings(false); // Close modal on success
    } catch (error) {
        console.error("Failed to save settings:", error);
        alert("Failed to save settings. Please try again.");
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
      const newQuestion = await Question.create(newQuestionData);
      setQuestions(prev => [...prev, newQuestion]);
      setEditingQuestionId(newQuestion.id);
    } catch (error) {
      console.error("Failed to add question:", error);
    }
  };

  const updateQuestion = useCallback(async (questionId, updatedData) => {
    setIsSaving(true);
    try {
      await Question.update(questionId, updatedData);
      setQuestions(prev =>
        prev.map(q => q.id === questionId ? { ...q, ...updatedData } : q)
      );
      setLastSaved(new Date());
    } catch (error) {
      console.error("Failed to auto-update question:", error);
    }
    setIsSaving(false);
  }, []);

  const closeQuestionEditor = (questionId, finalData) => {
    updateQuestion(questionId, finalData);
    setEditingQuestionId(null);
  };

  const deleteQuestion = async (questionId) => {
    try {
      await Question.delete(questionId);
      const remainingQuestions = questions.filter(q => q.id !== questionId);
      
      // Batch update orders for better performance
      const updatePromises = remainingQuestions
        .map((q, index) => Question.update(q.id, { order: index }));
      await Promise.all(updatePromises);
      
      setQuestions(remainingQuestions.map((q, index) => ({ ...q, order: index })));
    } catch (error) {
      console.error("Failed to delete question:", error);
    }
    if (editingQuestionId === questionId) {
      setEditingQuestionId(null);
    }
  };

  const duplicateQuestion = async (question) => {
    const { id, ...questionData } = question;
    const duplicatedQuestionData = {
      ...questionData,
      order: questions.length,
      question: question.question + " (Copy)"
    };
    try {
      const newQuestion = await Question.create(duplicatedQuestionData);
      setQuestions(prev => [...prev, newQuestion]);
    } catch (error) {
      console.error("Failed to duplicate question", error);
    }
  };

  // Add helper function for delays
  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

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
            await Question.update(item.id, { order: item.order });
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
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selectedQuestionIds.length === questions.length) {
      setSelectedQuestionIds([]);
    } else {
      setSelectedQuestionIds(questions.map(q => q.id));
    }
  }, [selectedQuestionIds.length, questions]);

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
          category: quiz.category || 'Imported from Quiz',
          difficulty: 'medium',
          points: q.points,
          tags: quiz.category ? [quiz.category] : []
        }));

      // Batch create for better performance
      await QuestionBank.bulkCreate(questionsToTransfer);

      alert(`✅ Successfully transferred ${questionsToTransfer.length} questions to the Question Bank.`);

      setSelectedQuestionIds([]);
      setIsSelectionMode(false);

    } catch (error) {
      console.error("Error transferring questions:", error);
      alert("❌ An error occurred while transferring questions. Please try again.");
    }
    setIsTransferring(false);
  };

  const publishQuiz = async () => {
    if (!quizId) return;

    if (!quiz.title.trim() || quiz.title === "Untitled Quiz") {
      alert("Please add a title to your quiz before publishing.");
      return;
    }

    if (!quiz.settings?.use_question_bank && questions.length === 0) {
      alert("Please add at least one question to your quiz or enable Question Bank before publishing.");
      return;
    }
    
    if (quiz.settings?.use_question_bank && !quiz.settings?.questions_per_user) {
      alert("Please configure how many questions to serve from the Question Bank before publishing.");
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

      await Quiz.update(quizId, publishedQuizData);
      setQuiz(prev => ({ ...prev, ...publishedQuizData }));

      const shareUrl = `${window.location.origin}${createPageUrl(`TakeQuiz?token=${shareToken}`)}`;

      const userResponse = confirm(
        `✅ Quiz published successfully!\n\n` +
        `The link has been copied to your clipboard.\n\n` +
        `Click OK to open the quiz in a new tab.`
      );

      navigator.clipboard.writeText(shareUrl);

      if (userResponse) {
        window.open(shareUrl, '_blank');
      }

    } catch (error) {
      console.error("Error publishing quiz:", error);
      alert("❌ Error publishing quiz. Please try again.");
    }
    setIsSaving(false);
  };

  // Optimized bulk save with better batching
  const bulkSaveQuestions = async (questionsToSave) => {
    setIsSaving(true);
    const batchSize = 15; // Increased batch size
    const batches = [];

    for (let i = 0; i < questionsToSave.length; i += batchSize) {
      batches.push(questionsToSave.slice(i, i + batchSize));
    }

    try {
      for (const batch of batches) {
        await Question.bulkCreate(batch);
        await new Promise(resolve => setTimeout(resolve, 50)); // Reduced delay
      }
    } catch (error) {
      console.error("Error in bulk save:", error);
      throw error;
    } finally {
      setIsSaving(false);
    }
  };

  const handleQuestionBankSetup = async (config) => {
    if (!quizId) return;

    try {
      const updatedSettings = {
        ...quiz.settings,
        use_question_bank: true,
        questions_per_user: config.questions_per_user,
        question_section_ids: config.question_section_ids, // Changed from question_categories
        difficulty_filter: config.difficulty_filter
      };

      await Quiz.update(quizId, { settings: updatedSettings });
      setQuiz(prev => ({ ...prev, settings: updatedSettings }));
      setQuestions([]);
      setShowQuestionBankSelector(false);

      alert(`✅ Quiz configured to use Question Bank!\n\nEach user will get ${config.questions_per_user} random questions from ${config.total_available} available questions.`);
    } catch (error) {
      console.error("Error setting up question bank:", error);
      alert("❌ Failed to setup question bank. Please try again.");
    }
  };

  // Memoized components for better performance
  const MemoizedQuestionEditor = useMemo(() => QuestionEditor, []);
  const MemoizedQuestionTypeSelector = useMemo(() => QuestionTypeSelector, []);

  if (!quiz) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-slate-600">Loading quiz builder...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
      <div className="p-4 md:p-8">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="flex items-center gap-4">
              <Link to={createPageUrl("Dashboard")}>
                <Button variant="outline" size="icon" className="hover:bg-slate-100">
                  <ArrowLeft className="w-4 h-4" />
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-slate-900">
                  Quiz Builder
                </h1>
                <div className="flex items-center gap-2 mt-1 h-5">
                  <Badge variant={quiz.status === 'published' ? 'default' : 'secondary'} className={quiz.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-slate-100'}>
                    {quiz.status}
                  </Badge>
                  {isSaving && (
                    <Badge variant="outline" className="text-blue-600 border-blue-200 flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin"/>
                      Saving...
                    </Badge>
                  )}
                  {lastSaved && !isSaving && <span className="text-xs text-slate-500">Saved {format(lastSaved, 'HH:mm:ss')}</span>}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={() => setShowSettings(true)} className="gap-2">
                <Settings className="w-4 h-4" />
                Settings
              </Button>
              <Button variant="outline" asChild className="gap-2">
                <Link to={createPageUrl(`Preview?id=${quizId}`)} target="_blank">
                  <Eye className="w-4 h-4" />
                  Preview
                </Link>
              </Button>
              <Button onClick={publishQuiz} disabled={!quiz.title.trim() || quiz.title === "Untitled Quiz" || (!quiz.settings?.use_question_bank && questions.length === 0) || (quiz.settings?.use_question_bank && !quiz.settings?.questions_per_user) || isSaving} className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 gap-2">
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin"/> : <Share className="w-4 h-4" />}
                Publish
              </Button>
            </div>
          </div>

          {/* Quiz Basic Info */}
          <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
            <CardHeader><CardTitle className="text-xl">Quiz Details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="quiz-title" className="text-sm font-medium text-slate-700 ml-1">Quiz Title</Label>
                    <Input
                      id="quiz-title"
                      placeholder="Enter quiz title..."
                      value={quiz.title}
                      onChange={(e) => updateQuiz('title', e.target.value)}
                      className="text-lg font-medium border-slate-200 focus:border-blue-400 mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="course-number" className="text-sm font-medium text-slate-700 ml-1">Course Number</Label>
                    <Input
                      id="course-number"
                      placeholder="Enter course number..."
                      value={quiz.course_number || ""}
                      onChange={(e) => updateQuiz('course_number', e.target.value)}
                      className="text-lg font-medium border-slate-200 focus:border-blue-400 mt-1"
                    />
                  </div>
              </div>

              <div>
                <Label htmlFor="quiz-description" className="text-sm font-medium text-slate-700 ml-1">Description</Label>
                <Textarea
                  id="quiz-description"
                  placeholder="Add a description for your quiz..."
                  value={quiz.description}
                  onChange={(e) => updateQuiz('description', e.target.value)}
                  className="border-slate-200 focus:border-blue-400 mt-1"
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
                Content Tools
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
                    <div className="font-medium">Generate with AI</div>
                    <div className="text-xs opacity-75">Create questions automatically</div>
                  </div>
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowPDFImporter(true)}
                  className="bg-white hover:bg-red-50 border-red-200 text-red-700 gap-2 h-auto py-3 flex-col"
                >
                  <Upload className="w-5 h-5" />
                  <div className="text-center">
                    <div className="font-medium">Import from PDF</div>
                    <div className="text-xs opacity-75">Extract questions from PDF</div>
                  </div>
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowQuestionBankSelector(true)}
                  className="bg-white hover:bg-green-50 border-green-200 text-green-700 gap-2 h-auto py-3 flex-col"
                >
                  <Database className="w-5 h-5" />
                  <div className="text-center">
                    <div className="font-medium">Use Question Bank</div>
                    <div className="text-xs opacity-75">Random questions per user</div>
                  </div>
                </Button>
              </div>

              {quiz.settings?.use_question_bank && (
                <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <Database className="w-4 h-4 text-green-600" />
                    <span className="font-medium text-green-800">Question Bank Active</span>
                  </div>
                  <p className="text-sm text-green-700">
                    Each user gets {quiz.settings.questions_per_user} random questions from your Question Bank.
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowQuestionBankSelector(true)}
                    className="text-green-700 hover:text-green-800 mt-2 h-auto p-0"
                  >
                    Modify Settings
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
                    ? `Dynamic Questions (${quiz.settings.questions_per_user || 'N/A'} per user)`
                    : `Questions (${questions.length})`
                  }
                </CardTitle>
                {!quiz.settings?.use_question_bank && (
                  <div className="flex items-center gap-2">
                    {isSelectionMode ? (
                      <>
                        <Button variant="ghost" onClick={() => {setIsSelectionMode(false); setSelectedQuestionIds([]);}} className="gap-1">
                          <X className="w-4 h-4" />
                          Cancel
                        </Button>
                        <Button
                          variant="outline"
                          onClick={handleSelectAll}
                          disabled={questions.length === 0}
                          className="gap-2"
                        >
                          <CheckSquare className="w-4 h-4" />
                          {selectedQuestionIds.length === questions.length && questions.length > 0 ? 'Deselect All' : 'Select All'}
                        </Button>
                        <Button
                          onClick={handleTransferToBank}
                          disabled={selectedQuestionIds.length === 0 || isTransferring}
                          className="bg-purple-600 hover:bg-purple-700 gap-2"
                        >
                          {isTransferring ? <Loader2 className="w-4 h-4 animate-spin"/> : <Database className="w-4 h-4" />}
                          Transfer {selectedQuestionIds.length > 0 ? `(${selectedQuestionIds.length})` : ''} to Bank
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button variant="outline" onClick={() => setIsSelectionMode(true)} className="gap-2" disabled={questions.length === 0}>
                          <Database className="w-4 h-4" />
                          Transfer to Bank
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
                  <h3 className="text-lg font-semibold text-slate-700 mb-2">Question Bank Mode Active</h3>
                  <p className="text-slate-500 mb-4">
                    This quiz will automatically serve {quiz.settings.questions_per_user || 'a configurable number of'} random questions 
                    from your Question Bank to each user. No manual questions are stored or displayed here.
                  </p>
                  <div className="flex justify-center gap-3">
                    <Button 
                      onClick={() => setShowQuestionBankSelector(true)}
                      variant="outline"
                      className="gap-2"
                    >
                      <Database className="w-4 h-4" />
                      Modify Bank Settings
                    </Button>
                    <Button 
                      onClick={async () => {
                        const confirmSwitch = window.confirm("Are you sure you want to switch back to manual questions? Your existing manual questions will reappear, but if you previously had the Question Bank active, it will be disabled for this quiz.");
                        if (!confirmSwitch) return;

                        const updatedSettings = {
                          ...quiz.settings,
                          use_question_bank: false,
                          questions_per_user: null,
                          question_categories: [], // This will be reset if it was set
                          difficulty_filter: null // This will be reset if it was set
                        };

                        try {
                          await Quiz.update(quizId, { settings: updatedSettings });
                          setQuiz(prev => ({
                            ...prev,
                            settings: updatedSettings
                          }));
                          const loadedQuestions = await Question.filter({ quiz_id: quizId }, 'order');
                          setQuestions(loadedQuestions);
                          alert("Switched to Manual Questions mode.");
                        } catch (error) {
                          console.error("Failed to switch to manual questions:", error);
                          alert("Failed to switch modes. Please try again.");
                        }
                      }}
                      variant="ghost"
                      className="gap-2 text-slate-600"
                    >
                      Switch to Manual Questions
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  {isSelectionMode && (
                    <div className="p-3 mb-4 bg-blue-50 border border-blue-200 text-blue-800 rounded-lg text-sm">
                      <div className="flex items-center justify-between">
                        <span>Select the questions you want to move to your central Question Bank for reuse in other quizzes.</span>
                        <Badge variant="outline" className="bg-white text-blue-700">
                          {selectedQuestionIds.length} of {questions.length} selected
                        </Badge>
                      </div>
                    </div>
                  )}
                  {questions.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <FileText className="w-8 h-8 text-slate-400" />
                      </div>
                      <h3 className="text-lg font-semibold text-slate-700 mb-2">Your quiz is empty</h3>
                      <p className="text-slate-500 mb-6">Add questions manually or use the content tools above.</p>
                      <Button onClick={() => addQuestion()} className="bg-blue-600 hover:bg-blue-700 gap-2">
                        <Plus className="w-4 h-4" />
                        Add Question
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
        <QuizSettings
          settings={quiz.settings}
          category={quiz.category}
          onUpdate={handleSettingsUpdate}
          onClose={() => setShowSettings(false)}
        />
      )}

      {showAIGenerator && (
        <AIQuestionGenerator
          onGenerate={async (generatedQuestions) => {
            if (generatedQuestions.length > 40) {
              alert(`⚠️ Large batch detected (${generatedQuestions.length} questions).\nThis may take some time to process...`);
            }

            const session = localStorage.getItem('gts_user_session');
            const currentUser = session ? JSON.parse(session) : null;
            if (!currentUser) {
              alert("Session expired. Please log in again to add questions.");
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
                  const created = await Question.create(questionData);
                  createdQuestions.push(created);
                } catch (error) {
                  console.error("Failed to create question:", questionData, error);
                }
              }

              if (createdQuestions.length > 0) {
                // Reload the quiz to get fresh data
                await loadQuiz(quizId);
                alert(`✅ Successfully added ${createdQuestions.length} questions!`);
                
                if (createdQuestions.length < generatedQuestions.length) {
                  alert(`⚠️ Created ${createdQuestions.length} out of ${generatedQuestions.length} questions. Some questions were not saved.`);
                }
              } else {
                alert("❌ Failed to save questions. Please try again.");
              }
            } catch (error) {
              console.error("Failed to bulk create AI questions", error);
              alert("❌ Failed to save some questions. Please try with fewer questions.");
            }
          }}
          onClose={() => setShowAIGenerator(false)}
        />
      )}

      {showPDFImporter && (
        <PDFImporter
          onImport={async (importedQuestions) => {
            if (importedQuestions.length > 40) {
              alert(`⚠️ Large import detected (${importedQuestions.length} questions).\nThis may take a moment to process...`);
            }
            
            const session = localStorage.getItem('gts_user_session');
            const currentUser = session ? JSON.parse(session) : null;
            if (!currentUser) {
              alert("Session expired. Please log in again to add questions.");
              return;
            }

            const newQuestions = importedQuestions.map((q, index) => ({
              ...q,
              quiz_id: quizId,
              owner_id: currentUser.user_id, 
              order: questions.length + index
            }));

            try {
              await bulkSaveQuestions(newQuestions);
              loadQuiz(quizId);
              alert(`✅ Successfully imported ${importedQuestions.length} questions!`);
            } catch (error) {
              console.error("Failed to bulk create imported questions", error);
              alert("❌ Some questions failed to import. Please check your file and try again.");
            }
          }}
          onClose={() => setShowPDFImporter(false)}
        />
      )}

      {showQuestionBankSelector && (
        <QuestionBankSelector
          quizId={quizId}
          currentSettings={quiz.settings}
          onSetup={handleQuestionBankSetup}
          onClose={() => setShowQuestionBankSelector(false)}
        />
      )}
    </div>
  );
}
