
import React, { useState, useEffect } from "react";
import { SubmissionAR, QuizAR, AppUser, QuestionAR, QuestionBankAR, QuestionBank } from "@/api/entities"; // Added QuestionBank
import { InvokeLLM } from "@/api/integrations"; // Add AI integration
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  ArrowRight,
  Search,
  Download,
  Users,
  TrendingUp,
  Clock,
  Trophy,
  Eye,
  Calendar as CalendarIcon,
  X,
  Trash2,
  Loader2,
  CheckSquare,
  XCircle,
  FileText,
  RefreshCw // Add RefreshCw icon for recorrect
} from "lucide-react";
import { format, startOfDay, endOfDay, setHours, setMinutes } from "date-fns";
import { motion } from "framer-motion";

export default function SubmissionsAR() {
  const [submissions, setSubmissions] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  const [selectedQuiz, setSelectedQuiz] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [dateRange, setDateRange] = useState({
    from: undefined,
    to: undefined,
    fromTime: { hour: "00", minute: "00" },
    toTime: { hour: "23", minute: "59" }
  });
  const [isLoading, setIsLoading] = useState(true);

  // New state for selection and bulk delete
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedSubmissionIds, setSelectedSubmissionIds] = useState([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRecorrecting, setIsRecorrecting] = useState(false); // State for manual recorrection (single and bulk)
  const [isAICorrecting, setIsAICorrecting] = useState(false); // State for AI recorrection (single and bulk)

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const session = localStorage.getItem('gts_user_session');
      const currentUser = session ? JSON.parse(session) : null;
      
      if (!currentUser) {
        setQuizzes([]);
        setSubmissions([]);
        setIsLoading(false);
        return;
      }
      
      // Load only quizzes owned by current user
      const quizzesData = await QuizAR.filter({ owner_id: currentUser.user_id }, "-updated_date");
      setQuizzes(Array.isArray(quizzesData) ? quizzesData : []);

      // Load submissions only for the current user's quizzes
      const userQuizIds = quizzesData.map(q => q.id);
      if (userQuizIds.length === 0) {
          setSubmissions([]);
          setIsLoading(false);
          return;
      }
      const userSubmissions = await SubmissionAR.filter({ owner_id: currentUser.user_id, quiz_id: { $in: userQuizIds } });
      
      setSubmissions(Array.isArray(userSubmissions) ? userSubmissions : []);
    } catch (error) {
      console.error("Error loading submissions:", error);
      setQuizzes([]);
      setSubmissions([]);
    }
    setIsLoading(false);
  };

  // New robust normalization function
  const normalizeAnswerForComparison = (answer) => {
    if (typeof answer !== 'string') return answer;

    let normalized = answer.trim();

    // 1. Remove list prefixes (e.g., "أ. ", "ب-")
    normalized = normalized.replace(/^[أاببججددهـ]\s*[.\-)]\s*/, '');

    // 2. Remove all Arabic diacritics (tashkeel, tanwin)
    normalized = normalized.replace(/[\u064B-\u0652]/g, "");

    // 3. Normalize true/false variations after other cleaning
    const lowerCaseNormalized = normalized.toLowerCase();
    if (['صح', 'صحيح', 'نعم', 'true', 'صواب'].includes(lowerCaseNormalized)) {
      return 'صح';
    }
    if (['خطأ', 'خاطئ', 'غير صحيح', 'لا', 'false'].includes(lowerCaseNormalized)) {
      return 'خطأ';
    }

    // 4. Return the cleaned, normalized string
    return normalized.trim();
  };

  // Helper function to extract the real question ID from a temporary bank ID
  const getRealQuestionId = (id) => {
    if (typeof id === 'string' && id.startsWith('bank_')) {
      const parts = id.split('_');
      if (parts.length > 1) {
        return parts[1]; // The real ID is the second part
      }
    }
    return id; // Return original ID if not a bank ID
  };

  // New recorrect function (manual)
  const recorrectSubmission = async (submission) => {
    if (!submission || !submission.answers) {
      alert("لا يمكن إعادة تصحيح هذه الإجابة - بيانات الإجابة غير متوفرة.");
      return;
    }

    setIsRecorrecting(true); // Set loading state for single manual recorrect
    try {
      const session = localStorage.getItem('gts_user_session');
      const currentUser = JSON.parse(session);

      if (!currentUser) {
        alert("خطأ: المستخدم غير مصادق.");
        return;
      }

      // Get quiz
      const quiz = quizzes.find(q => q.id === submission.quiz_id);
      if (!quiz) {
        alert("لم يتم العثور على الاختبار لهذا التقديم.");
        return;
      }

      // Collect all unique real question IDs from the submission's answers
      const requiredRealQuestionIds = [...new Set(submission.answers.map(a => getRealQuestionId(a.question_id)))];

      let fetchedQuestions = [];

      // Fetch questions from QuestionAR (direct quiz questions) that are needed
      const directQuizQuestions = await QuestionAR.filter({ 
        quiz_id: submission.quiz_id, 
        owner_id: currentUser.user_id,
        id: { $in: requiredRealQuestionIds } 
      }, "order");
      fetchedQuestions.push(...directQuizQuestions);

      // Fetch questions from QuestionBankAR that are needed
      const bankQuestionIdsToFetch = requiredRealQuestionIds.filter(id => !fetchedQuestions.some(q => q.id === id));
      if (bankQuestionIdsToFetch.length > 0) {
        const bankQuestions = await QuestionBankAR.filter({ 
          owner_id: currentUser.user_id,
          id: { $in: bankQuestionIdsToFetch } 
        });
        fetchedQuestions.push(...bankQuestions);
      }
      
      if (fetchedQuestions.length === 0) {
        alert("لم يتم العثور على أسئلة للتصحيح.");
        return;
      }

      // Create question map for quick lookup
      const questionMap = {};
      fetchedQuestions.forEach(q => {
        questionMap[q.id] = q;
      });

      // Re-evaluate all answers
      let newScore = 0;
      let newMaxScore = 0;
      const correctedAnswers = [];

      for (const answer of submission.answers) {
        const realQuestionId = getRealQuestionId(answer.question_id);
        const question = questionMap[realQuestionId];
        
        if (!question) {
          // Keep original answer state if question not found
          correctedAnswers.push(answer);
          continue;
        }

        newMaxScore += question.points || 1;
        let isCorrect = false;
        
        // Determine if answer is correct based on question type
        if (question.type === 'multiple_choice' || question.type === 'text' || question.type === 'fill_blank') {
          const normalizedUserAnswer = normalizeAnswerForComparison(answer.answer);
          if (question.correct_answers && question.correct_answers.length > 0) {
            isCorrect = question.correct_answers.some(correct => 
              normalizeAnswerForComparison(correct) === normalizedUserAnswer
            );
          }
        } else if (question.type === 'checkbox') {
          try {
            const userAnswers = JSON.parse(answer.answer);
            if (Array.isArray(userAnswers) && question.correct_answers) {
              // Both user's answers and correct answers must match exactly
              isCorrect = userAnswers.length === question.correct_answers.length && 
                          userAnswers.every(opt => question.correct_answers.includes(opt)) &&
                          question.correct_answers.every(opt => userAnswers.includes(opt));
            }
          } catch (e) {
            // Fallback for non-JSON checkbox answers, treat as single choice
            isCorrect = question.correct_answers && question.correct_answers.includes(answer.answer);
          }
        } else if (question.type === 'true_false') {
          const normalizedUserAnswer = normalizeAnswerForComparison(answer.answer);
          const normalizedCorrectAnswers = (question.correct_answers || []).map(normalizeAnswerForComparison);
          isCorrect = normalizedCorrectAnswers.includes(normalizedUserAnswer);
        }

        if (isCorrect) {
          newScore += question.points || 1;
        }

        correctedAnswers.push({
          ...answer,
          is_correct: isCorrect
        });
      }

      // Update submission with corrected data
      const updatedSubmissionData = {
        answers: correctedAnswers,
        score: newScore,
        max_score: newMaxScore
      };

      await SubmissionAR.update(submission.id, updatedSubmissionData);

      // Refresh data
      await loadData();
      
      // Update selected submission if it's the one being corrected and modal is open
      if (selectedSubmission && selectedSubmission.id === submission.id) {
        setSelectedSubmission(prev => ({ ...prev, ...updatedSubmissionData }));
      }

      // Provide feedback
      const oldPercentage = Math.round(((submission.score || 0) / (submission.max_score || 1)) * 100);
      const newPercentage = Math.round(((newScore || 0) / (newMaxScore || 1)) * 100);

      alert(`✅ تم إعادة التصحيح بنجاح!
النتيجة القديمة: ${submission.score}/${submission.max_score} (${oldPercentage}%)
النتيجة الجديدة: ${newScore}/${newMaxScore} (${newPercentage}%)`);

    } catch (error) {
      console.error("Error recorrecting submission:", error);
      alert("❌ حدث خطأ أثناء إعادة التصحيح. يرجى المحاولة مرة أخرى.");
      throw error; // Re-throw to be caught by bulk recorrect
    } finally {
      setIsRecorrecting(false); // Reset loading state
    }
  };

  // New AI-powered correction function
  const aiCorrectSubmission = async (submission) => {
    if (!submission || !submission.answers) {
      alert("لا يمكن إعادة تصحيح هذه الإجابة بالذكاء الاصطناعي - بيانات الإجابة غير متوفرة.");
      return;
    }

    setIsAICorrecting(true); // Set loading state for AI recorrect (single or bulk)
    try {
      const session = localStorage.getItem('gts_user_session');
      const currentUser = JSON.parse(session);

      if (!currentUser) {
        alert("خطأ: المستخدم غير مصادق.");
        return;
      }

      // Get quiz
      const quiz = quizzes.find(q => q.id === submission.quiz_id);
      if (!quiz) {
        alert("لم يتم العثور على الاختبار لهذا التقديم.");
        return;
      }

      // Collect all unique real question IDs from the submission's answers
      const requiredRealQuestionIds = [...new Set(submission.answers.map(a => getRealQuestionId(a.question_id)))];

      let fetchedQuestions = [];

      // Fetch questions from QuestionAR (direct quiz questions) that are needed
      const directQuizQuestions = await QuestionAR.filter({ 
        quiz_id: submission.quiz_id, 
        owner_id: currentUser.user_id,
        id: { $in: requiredRealQuestionIds } 
      }, "order");
      fetchedQuestions.push(...directQuizQuestions);

      // Fetch questions from QuestionBankAR that are needed
      const bankQuestionIdsToFetch = requiredRealQuestionIds.filter(id => !fetchedQuestions.some(q => q.id === id));
      if (bankQuestionIdsToFetch.length > 0) {
        const bankQuestions = await QuestionBankAR.filter({ 
          owner_id: currentUser.user_id,
          id: { $in: bankQuestionIdsToFetch } 
        });
        fetchedQuestions.push(...bankQuestions);
      }
      
      if (fetchedQuestions.length === 0) {
        alert("لم يتم العثور على أسئلة للتصحيح بالذكاء الاصطناعي.");
        return;
      }

      // Create question map for quick lookup
      const questionMap = {};
      fetchedQuestions.forEach(q => {
        questionMap[q.id] = q;
      });

      // Prepare data for AI evaluation
      const questionsForAI = [];
      submission.answers.forEach(answer => {
        const realQuestionId = getRealQuestionId(answer.question_id);
        const question = questionMap[realQuestionId];
        
        if (question) {
          questionsForAI.push({
            question_id: realQuestionId,
            question_text: question.question,
            question_type: question.type,
            options: question.options || [],
            correct_answers: question.correct_answers || [],
            explanation: question.explanation || "",
            student_answer: answer.answer || "",
            points: question.points || 1
          });
        }
      });

      if (questionsForAI.length === 0) {
        alert("لا توجد أسئلة صالحة للتصحيح بالذكاء الاصطناعي.");
        return;
      }

      // Call AI for intelligent correction
      const aiPrompt = `
أنت نظام تصحيح ذكي ومتقدم للاختبارات باللغة العربية. مهمتك هي تقييم إجابات الطلاب بدقة شديدة، مع التركيز على المعنى والسياق بدلاً من المطابقة الحرفية الصارمة.

قواعد التصحيح الصارمة التي يجب اتباعها:
1.  **تجاهل البادئات والعلامات**: تجاهل تمامًا أي بادئات ترقيم مثل "أ." أو "ب-" والعلامات النحوية (التشكيل والتنوين) عند مقارنة الإجابات. على سبيل المثال، عامل "آمنا" و "آمنًا" كإجابات متطابقة.

2.  **أسئلة "صح/خطأ"**:
    *   المرادفات الصحيحة: 'صح', 'صحيح', 'نعم', 'صواب', 'True'.
    *   المرادفات الخاطئة: 'خطأ', 'خاطئ', 'غير صحيح', 'لا', 'False'.
    *   أي إجابة تطابق أحد هذه المرادفات تعتبر صحيحة إذا كانت تتوافق مع الإجابة الصحيحة المحددة.

3.  **الأسئلة النصية و"أكمل الفراغ"**:
    *   **الأولوية للمعنى**: الهدف هو تقييم ما إذا كان الطالب يفهم المفهوم. إذا كانت إجابة الطالب تعادل إحدى الإجابات الصحيحة من حيث المعنى، حتى لو كانت الصياغة مختلفة، فاعتبرها صحيحة.
    *   **المرونة في الصياغة**: تجاهل الأخطاء الإملائية البسيطة، والاختلافات في ترتيب الكلمات، أو استخدام المرادفات طالما أن المعنى الأساسي لم يتغير.
    *   **عدم وجود إجابة محددة**: إذا كان حقل 'correct_answers' فارغًا للسؤال النصي، فافترض أن أي إجابة معقولة ومتعلقة بالسؤال هي إجابة صحيحة.

4.  **أسئلة الاختيار من متعدد (Multiple Choice)**:
    *   يجب أن تتطابق إجابة الطالب مع أحد الخيارات المتاحة، مع تجاهل البادئات والعلامات النحوية كما ذكرنا في القاعدة الأولى.

5.  **أسئلة الاختيار المتعدد (Checkbox)**:
    *   يجب أن يختار الطالب *جميع* الإجابات الصحيحة المحددة و*لا* يختار أي إجابة خاطئة. أي اختلاف يؤدي إلى إجابة غير صحيحة للسؤال بأكمله.

الأسئلة للتقييم:
${JSON.stringify(questionsForAI, null, 2)}

يرجى إرجاع نتيجة التقييم بالشكل التالي:
`;

      const aiResponse = await InvokeLLM({
        prompt: aiPrompt,
        response_json_schema: {
          type: "object",
          properties: {
            evaluations: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  question_id: { type: "string" },
                  is_correct: { type: "boolean" },
                  score: { type: "number" }, // The points obtained for this specific question
                  explanation: { type: "string" },
                  confidence: { type: "number" }
                },
                required: ["question_id", "is_correct", "score", "explanation", "confidence"]
              }
            },
            total_score: { type: "number" }, // Total score calculated by AI
            max_score: { type: "number" },   // Max possible score for the quiz calculated by AI
            summary: { type: "string" }
          },
          required: ["evaluations", "total_score", "max_score", "summary"]
        }
      });

      if (!aiResponse || !aiResponse.evaluations) {
        alert("فشل في الحصول على تقييم من الذكاء الاصطناعي. يرجى المحاولة مرة أخرى.");
        return;
      }

      // Create evaluation map
      const aiEvaluationMap = {};
      aiResponse.evaluations.forEach(evaluation => {
        aiEvaluationMap[evaluation.question_id] = evaluation;
      });

      // Update answers with AI evaluation
      let newScore = 0;
      let newMaxScore = 0;
      const correctedAnswers = [];

      for (const answer of submission.answers) {
        const realQuestionId = getRealQuestionId(answer.question_id);
        const question = questionMap[realQuestionId];
        
        if (!question) {
          correctedAnswers.push(answer);
          continue;
        }

        newMaxScore += question.points || 1;
        
        if (aiEvaluationMap[realQuestionId] && aiEvaluationMap[realQuestionId].is_correct) {
          newScore += aiEvaluationMap[realQuestionId].score || question.points || 1;
        }

        correctedAnswers.push({
          ...answer,
          is_correct: aiEvaluationMap[realQuestionId] ? aiEvaluationMap[realQuestionId].is_correct : answer.is_correct,
          ai_explanation: aiEvaluationMap[realQuestionId] ? aiEvaluationMap[realQuestionId].explanation : null,
          ai_confidence: aiEvaluationMap[realQuestionId] ? aiEvaluationMap[realQuestionId].confidence : null
        });
      }

      // Use AI's calculated total score and max score if available and seem reasonable
      const finalScore = aiResponse.total_score !== undefined ? aiResponse.total_score : newScore;
      const finalMaxScore = aiResponse.max_score !== undefined ? aiResponse.max_score : newMaxScore;

      // Update submission with AI-corrected data
      const updatedSubmissionData = {
        answers: correctedAnswers,
        score: finalScore,
        max_score: finalMaxScore,
        ai_corrected: true,
        ai_correction_date: new Date().toISOString(),
        ai_summary: aiResponse.summary
      };

      await SubmissionAR.update(submission.id, updatedSubmissionData);

      // Refresh data
      await loadData();
      
      // Update selected submission if it's the one being corrected and modal is open
      if (selectedSubmission && selectedSubmission.id === submission.id) {
        setSelectedSubmission(prev => ({ ...prev, ...updatedSubmissionData }));
      }

      // Provide feedback
      const oldPercentage = Math.round(((submission.score || 0) / (submission.max_score || 1)) * 100);
      const newPercentage = Math.round(((finalScore || 0) / (finalMaxScore || 1)) * 100);

      alert(`✅ تم التصحيح بالذكاء الاصطناعي بنجاح!

النتيجة القديمة: ${submission.score}/${submission.max_score} (${oldPercentage}%)
النتيجة الجديدة: ${finalScore}/${finalMaxScore} (${newPercentage}%)

ملخص الذكاء الاصطناعي: ${aiResponse.summary || 'غير متوفر'}`);

    } catch (error) {
      console.error("Error AI correcting submission:", error);
      alert("❌ حدث خطأ أثناء التصحيح بالذكاء الاصطناعي. يرجى المحاولة مرة أخرى.");
      throw error;
    } finally {
      setIsAICorrecting(false); // Reset loading state
    }
  };


  const filteredSubmissions = submissions.filter(submission => {
    const quiz = quizzes.find(q => q.id === submission.quiz_id);
    const matchesQuiz = selectedQuiz === "all" || submission.quiz_id === selectedQuiz;
    const matchesSearch = !searchQuery ||
      submission.respondent_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      submission.respondent_email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      quiz?.title?.toLowerCase().includes(searchQuery.toLowerCase());

    // Enhanced date and time filter logic
    const { from, to, fromTime, toTime } = dateRange;
    let matchesDate = true;
    if (from || to) {
      if (submission.completed_at) {
        const submissionDate = new Date(submission.completed_at);

        if (from) {
          const startDateTime = setMinutes(
            setHours(startOfDay(from), parseInt(fromTime.hour)),
            parseInt(fromTime.minute)
          );
          if (submissionDate < startDateTime) {
            matchesDate = false;
          }
        }

        if (to) {
          const endDateTime = setMinutes(
            setHours(startOfDay(to), parseInt(toTime.hour)),
            parseInt(toTime.minute)
          );
          if (submissionDate > endDateTime) {
            matchesDate = false;
          }
        }
      } else {
        matchesDate = false;
      }
    }

    return matchesQuiz && matchesSearch && matchesDate;
  });

  const stats = {
    totalSubmissions: submissions.length,
    avgScore: submissions.length > 0
      ? Math.round(submissions.reduce((acc, sub) => acc + (sub.score || 0), 0) / submissions.length)
      : 0,
    avgCompletion: submissions.length > 0
      ? Math.round(submissions.reduce((acc, sub) => acc + (sub.completion_time || 0), 0) / submissions.length)
      : 0,
    topScore: submissions.length > 0
      ? Math.max(...submissions.map(s => Math.round(((s.score || 0) / (s.max_score || 1)) * 100)))
      : 0
  };

  const handleSubmissionSelect = (submissionId) => {
    setSelectedSubmissionIds(prev =>
      prev.includes(submissionId)
        ? prev.filter(id => id !== submissionId)
        : [...prev, submissionId]
    );
  };

  const handleSelectAll = () => {
    if (selectedSubmissionIds.length === filteredSubmissions.length && filteredSubmissions.length > 0) {
      setSelectedSubmissionIds([]);
    } else {
      setSelectedSubmissionIds(filteredSubmissions.map(s => s.id));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedSubmissionIds.length === 0) return;

    const confirmMessage = `هل أنت متأكد من حذف ${selectedSubmissionIds.length} إجابة؟ لا يمكن التراجع عن هذا الإجراء.`;

    if (!confirm(confirmMessage)) return;

    setIsDeleting(true);
    try {
      const deletePromises = selectedSubmissionIds.map(id =>
        SubmissionAR.delete(id).catch(error => {
          console.error(`Error deleting submission ${id}:`, error);
          return { error: true, id };
        })
      );

      const results = await Promise.all(deletePromises);
      const errors = results.filter(r => r && r.error);

      if (errors.length > 0) {
        alert(`⚠️ تم حذف ${selectedSubmissionIds.length - errors.length} إجابة بنجاح. فشل حذف ${errors.length}.`);
      } else {
        alert(`✅ تم حذف ${selectedSubmissionIds.length} إجابة بنجاح!`);
      }

      setSelectedSubmissionIds([]);
      setIsSelectionMode(false);
      loadData();

    } catch (error) {
      console.error("Error in bulk delete:", error);
      alert("❌ حدث خطأ أثناء حذف الإجابات. يرجى المحاولة مرة أخرى.");
    }
    finally {
      setIsDeleting(false);
    }
  };

  // Add bulk recorrect function (manual)
  const handleBulkRecorrect = async () => {
    if (selectedSubmissionIds.length === 0) return;

    const confirmMessage = `هل تريد إعادة تصحيح ${selectedSubmissionIds.length} إجابة محددة؟ سيتم إعادة تقييم جميع الإجابات باستخدام منطق التصحيح المحدث.`;

    if (!confirm(confirmMessage)) return;

    setIsRecorrecting(true); // Set loading state for bulk manual recorrect
    try {
      const submissionsToRecorrect = filteredSubmissions.filter(s => selectedSubmissionIds.includes(s.id));
      let successCount = 0;
      let errorCount = 0;

      for (const submission of submissionsToRecorrect) {
        try {
          await recorrectSubmission(submission); // Use the single recorrect function
          successCount++;
        } catch (error) {
          console.error(`Error recorrecting submission ${submission.id}:`, error);
          errorCount++;
        }
      }

      if (errorCount > 0) {
        alert(`⚠️ تم إعادة تصحيح ${successCount} إجابة بنجاح. فشل في إعادة تصحيح ${errorCount}.`);
      } else {
        alert(`✅ تم إعادة تصحيح ${successCount} إجابة بنجاح!`);
      }

      setSelectedSubmissionIds([]);
      setIsSelectionMode(false);
      await loadData(); // Ensure fresh data after bulk operation

    } catch (error) {
      console.error("Error in bulk recorrect:", error);
      alert("❌ حدث خطأ أثناء إعادة التصحيح المجمع.");
    } finally {
      setIsRecorrecting(false); // Reset loading state
    }
  };

  // Add bulk AI correction function
  const handleBulkAICorrect = async () => {
    if (selectedSubmissionIds.length === 0) return;

    const confirmMessage = `هل تريد استخدام الذكاء الاصطناعي لتصحيح ${selectedSubmissionIds.length} إجابة محددة؟

⚠️ تنبيه: هذه العملية قد تستغرق وقتاً أطول حيث سيتم تحليل كل إجابة باستخدام الذكاء الاصطناعي لفهم السياق والمعنى.

هل تريد المتابعة؟`;

    if (!confirm(confirmMessage)) return;

    setIsAICorrecting(true); // Set loading state for bulk AI recorrect
    try {
      const submissionsToCorrect = filteredSubmissions.filter(s => selectedSubmissionIds.includes(s.id));
      let successCount = 0;
      let errorCount = 0;

      for (const submission of submissionsToCorrect) {
        try {
          await aiCorrectSubmission(submission); // Use the single AI correct function
          successCount++;
          
          // Add delay between submissions to avoid rate limits
          if (successCount < submissionsToCorrect.length) {
            await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
          }
        } catch (error) {
          console.error(`Error AI correcting submission ${submission.id}:`, error);
          errorCount++;
        }
      }

      if (errorCount > 0) {
        alert(`⚠️ تم تصحيح ${successCount} إجابة بنجاح بالذكاء الاصطناعي. فشل في تصحيح ${errorCount}.`);
      } else {
        alert(`✅ تم تصحيح ${successCount} إجابة بنجاح بالذكاء الاصطناعي!`);
      }

      setSelectedSubmissionIds([]);
      setIsSelectionMode(false);
      await loadData();

    } catch (error) {
      console.error("Error in bulk AI correct:", error);
      alert("❌ حدث خطأ أثناء التصحيح المجمع بالذكاء الاصطناعي.");
    } finally {
      setIsAICorrecting(false); // Reset loading state
    }
  };

  const exportToCSV = () => {
    if (filteredSubmissions.length === 0) {
      alert("لا توجد بيانات للتصدير.");
      return;
    }
    
    const csvData = filteredSubmissions.map(submission => {
      const quiz = quizzes.find(q => q.id === submission.quiz_id);
      return {
        'اسم الاختبار': quiz?.title || 'غير معروف',
        'اسم المستجيب': submission.respondent_name || '',
        'رقم الهوية': submission.respondent_id_number || '',
        'رقم المقرر': quiz?.course_number || '',
        'البريد الإلكتروني': submission.respondent_email || '',
        'النتيجة': submission.score || 0,
        'أقصى نتيجة': submission.max_score || 0,
        'النسبة المئوية': Math.round(((submission.score || 0) / (submission.max_score || 1)) * 100) + '%',
        'وقت الإكمال': formatTime(submission.completion_time || 0),
        'تاريخ الإكمال': submission.completed_at ? format(new Date(submission.completed_at), 'yyyy-MM-dd HH:mm:ss') : ''
      };
    });

    const headers = Object.keys(csvData[0]);
    const csvContent = [
      headers.join(','),
      ...csvData.map(row => headers.map(header => JSON.stringify(row[header])).join(','))
    ].join('\n');

    // Add BOM for proper Arabic encoding
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'quiz-submissions-ar.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const clearDateFilter = () => {
    setDateRange({
      from: undefined,
      to: undefined,
      fromTime: { hour: "00", minute: "00" },
      toTime: { hour: "23", minute: "59" }
    });
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
                إجابات الاختبارات
              </h1>
              <p className="text-slate-600">
                عرض وتحليل ردود الاختبارات والأداء
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isSelectionMode ? (
              <>
                <Button variant="ghost" onClick={() => { setIsSelectionMode(false); setSelectedSubmissionIds([]); }} className="gap-1">
                  <X className="w-4 h-4" />
                  إلغاء
                </Button>
                <Button
                  onClick={handleSelectAll}
                  disabled={filteredSubmissions.length === 0 || isRecorrecting || isDeleting || isAICorrecting}
                  className="gap-2"
                >
                  <CheckSquare className="w-4 h-4" />
                  {selectedSubmissionIds.length === filteredSubmissions.length && filteredSubmissions.length > 0 ? 'إلغاء تحديد الكل' : 'تحديد الكل'}
                </Button>
                <Button
                  onClick={handleBulkRecorrect}
                  disabled={selectedSubmissionIds.length === 0 || isRecorrecting || isDeleting || isAICorrecting}
                  className="gap-2 bg-orange-600 hover:bg-orange-700"
                >
                  {isRecorrecting ? <Loader2 className="w-4 h-4 animate-spin"/> : <RefreshCw className="w-4 h-4" />}
                  إعادة تصحيح {selectedSubmissionIds.length > 0 ? `(${selectedSubmissionIds.length})` : ''}
                </Button>
                <Button
                  onClick={handleBulkAICorrect}
                  disabled={selectedSubmissionIds.length === 0 || isRecorrecting || isDeleting || isAICorrecting}
                  className="gap-2 bg-purple-600 hover:bg-purple-700"
                >
                  {isAICorrecting ? <Loader2 className="w-4 h-4 animate-spin"/> : "🤖"}
                  تصحيح ذكي {selectedSubmissionIds.length > 0 ? `(${selectedSubmissionIds.length})` : ''}
                </Button>
                <Button
                  onClick={handleBulkDelete}
                  disabled={selectedSubmissionIds.length === 0 || isDeleting || isRecorrecting || isAICorrecting}
                  variant="destructive"
                  className="gap-2"
                >
                  {isDeleting ? <Loader2 className="w-4 h-4 animate-spin"/> : <Trash2 className="w-4 h-4" />}
                  حذف {selectedSubmissionIds.length > 0 ? `(${selectedSubmissionIds.length})` : ''}
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setIsSelectionMode(true)} className="gap-2" disabled={filteredSubmissions.length === 0}>
                  <Trash2 className="w-4 h-4" />
                  إجراءات مجمعة
                </Button>
                <Button
                  onClick={exportToCSV}
                  disabled={filteredSubmissions.length === 0}
                  variant="outline"
                  className="gap-2"
                >
                  <Download className="w-4 h-4" />
                  تصدير CSV
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {[
            {
              title: "إجمالي الردود",
              value: stats.totalSubmissions,
              icon: Users,
              color: "from-blue-500 to-blue-600"
            },
            {
              title: "متوسط النتيجة",
              value: `${stats.avgScore}%`,
              icon: Trophy,
              color: "from-green-500 to-green-600"
            },
            {
              title: "متوسط الإكمال",
              value: formatTime(stats.avgCompletion),
              icon: Clock,
              color: "from-purple-500 to-purple-600"
            },
            {
              title: "أعلى نتيجة",
              value: `${stats.topScore}%`,
              icon: TrendingUp,
              color: "from-orange-500 to-orange-600"
            }
          ].map((stat, index) => (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="relative overflow-hidden bg-white/80 backdrop-blur-sm border-slate-200/60">
                <div className={`absolute top-0 left-0 w-32 h-32 bg-gradient-to-br ${stat.color} opacity-10 rounded-full transform -translate-x-8 -translate-y-8`} />
                <CardHeader className="p-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-medium text-slate-600 mb-1">{stat.title}</p>
                      <CardTitle className="text-3xl font-bold text-slate-900">
                        {stat.value}
                      </CardTitle>
                    </div>
                    <div className={`p-3 rounded-xl bg-gradient-to-br ${stat.color} shadow-lg`}>
                      <stat.icon className="w-5 h-5 text-white" />
                    </div>
                  </div>
                </CardHeader>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Filters */}
        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 mb-8">
          <CardHeader>
            <CardTitle>فلترة الإجابات</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4 items-end">
              <div className="relative flex-grow min-w-[250px]">
                <Label htmlFor="search-submissions" className="text-sm font-medium text-slate-700 mr-1">البحث</Label>
                <div className="relative mt-1">
                  <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <Input
                    id="search-submissions"
                    placeholder="بالاسم أو البريد الإلكتروني أو عنوان الاختبار..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pr-10"
                  />
                </div>
              </div>
              <div className="flex-grow min-w-[200px]">
                <Label htmlFor="quiz-filter" className="text-sm font-medium text-slate-700 mr-1">الاختبار</Label>
                <Select value={selectedQuiz} onValueChange={setSelectedQuiz}>
                  <SelectTrigger id="quiz-filter" className="w-full mt-1">
                    <SelectValue placeholder="فلترة حسب الاختبار" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">جميع الاختبارات</SelectItem>
                    {quizzes.map((quiz) => (
                      <SelectItem key={quiz.id} value={quiz.id}>
                        {quiz.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Start Date & Time */}
              <div className="flex-grow">
                <Label htmlFor="start-date-btn" className="text-sm font-medium text-slate-700 mr-1">تاريخ البداية والوقت</Label>
                <div className="flex items-center mt-1 border border-slate-200 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-400 transition-all bg-white">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        id="start-date-btn"
                        variant={"ghost"}
                        className="w-auto justify-start text-left font-normal rounded-none border-l border-slate-200"
                      >
                        <CalendarIcon className="ml-2 h-4 w-4" />
                        {dateRange.from ? format(dateRange.from, "MMM dd") : <span>التاريخ</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dateRange.from}
                        onSelect={(date) => setDateRange(prev => ({...prev, from: date}))}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <Input
                    type="time"
                    value={`${dateRange.fromTime.hour}:${dateRange.fromTime.minute}`}
                    onChange={(e) => {
                      const [hour = "00", minute = "00"] = e.target.value.split(':');
                      setDateRange(prev => ({ ...prev, fromTime: { hour: (hour || "00").padStart(2, '0'), minute: (minute || "00").padStart(2, '0') }}));
                    }}
                    className="border-0 shadow-none focus-visible:ring-0 w-full"
                  />
                </div>
              </div>

              {/* End Date & Time */}
              <div className="flex-grow">
                <Label htmlFor="end-date-btn" className="text-sm font-medium text-slate-700 mr-1">تاريخ النهاية والوقت</Label>
                <div className="flex items-center mt-1 border border-slate-200 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-400 transition-all bg-white">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        id="end-date-btn"
                        variant={"ghost"}
                        className="w-auto justify-start text-left font-normal rounded-none border-l border-slate-200"
                      >
                        <CalendarIcon className="ml-2 h-4 w-4" />
                        {dateRange.to ? format(dateRange.to, "MMM dd") : <span>التاريخ</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dateRange.to}
                        onSelect={(date) => setDateRange(prev => ({...prev, to: date}))}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <Input
                    type="time"
                    value={`${dateRange.toTime.hour}:${dateRange.toTime.minute}`}
                    onChange={(e) => {
                      const [hour = "23", minute = "59"] = e.target.value.split(':');
                      setDateRange(prev => ({ ...prev, toTime: { hour: (hour || "23").padStart(2, '0'), minute: (minute || "59").padStart(2, '0') }}));
                    }}
                    className="border-0 shadow-none focus-visible:ring-0 w-full"
                  />
                </div>
              </div>

              {(dateRange.from || dateRange.to) && (
                <Button variant="ghost" onClick={clearDateFilter} className="gap-1 text-slate-600 self-end">
                  <XCircle className="w-4 h-4" />
                  مسح التاريخ
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Submissions Table */}
        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>الإجابات الحديثة ({filteredSubmissions.length})</CardTitle>
              {isSelectionMode && selectedSubmissionIds.length > 0 && (
                <Badge variant="outline" className="bg-blue-50 text-blue-700">
                  {selectedSubmissionIds.length} من {filteredSubmissions.length} محدد
                </Badge>
              )}
            </div>
            {isSelectionMode && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-lg text-sm">
                <div className="flex items-center justify-between">
                  <span>حدد الإجابات التي تريد حذفها نهائياً.</span>
                  <Badge variant="outline" className="bg-white text-red-700">
                    وضع الحذف المجمع
                  </Badge>
                </div>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {Array(5).fill(0).map((_, i) => (
                  <div key={i} className="animate-pulse flex items-center space-x-4 p-4">
                    <div className="h-4 bg-slate-200 rounded w-1/4"></div>
                    <div className="h-4 bg-slate-200 rounded w-1/4"></div>
                    <div className="h-4 bg-slate-200 rounded w-1/6"></div>
                    <div className="h-4 bg-slate-200 rounded w-1/6"></div>
                    <div className="h-4 bg-slate-200 rounded w-1/6"></div>
                  </div>
                ))}
              </div>
            ) : filteredSubmissions.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Users className="w-8 h-8 text-slate-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-700 mb-2">
                  لم يتم العثور على إجابات
                </h3>
                <p className="text-slate-500">
                  {searchQuery || selectedQuiz !== "all" || dateRange.from || dateRange.to
                    ? "حاول تعديل الفلاتر الخاصة بك"
                    : "ستظهر الإجابات هنا بمجرد أن يأخذ الأشخاص اختباراتك"
                  }
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {isSelectionMode && (
                        <TableHead className="w-12">
                          <Checkbox
                            checked={selectedSubmissionIds.length === filteredSubmissions.length && filteredSubmissions.length > 0}
                            onCheckedChange={handleSelectAll}
                            aria-label="تحديد جميع الإجابات"
                          />
                        </TableHead>
                      )}
                      <TableHead>الاختبار</TableHead>
                      <TableHead>المجيب</TableHead>
                      <TableHead>النتيجة</TableHead>
                      <TableHead>الوقت</TableHead>
                      <TableHead>مكتمل</TableHead>
                      <TableHead>الإجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSubmissions.map((submission) => {
                      const quiz = quizzes.find(q => q.id === submission.quiz_id);
                      const percentage = Math.round(((submission.score || 0) / (submission.max_score || 1)) * 100);

                      return (
                        <TableRow key={submission.id} className={`hover:bg-slate-50 ${isSelectionMode && selectedSubmissionIds.includes(submission.id) ? 'bg-blue-50' : ''}`}>
                          {isSelectionMode && (
                            <TableCell>
                              <Checkbox
                                checked={selectedSubmissionIds.includes(submission.id)}
                                onCheckedChange={() => handleSubmissionSelect(submission.id)}
                                aria-label={`تحديد إجابة من ${submission.respondent_name || 'مجهول'}`}
                              />
                            </TableCell>
                          )}
                          <TableCell>
                            <div>
                              <p className="font-medium">{quiz?.title || 'اختبار غير معروف'}</p>
                              <Badge variant="outline" className="text-xs">
                                {quiz?.category || 'أخرى'}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{submission.respondent_name || 'مجهول'}</p>
                              <p className="text-sm text-slate-500">{submission.respondent_email}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">
                                {submission.score}/{submission.max_score}
                              </span>
                              <Badge
                                variant={percentage >= 70 ? "default" : "secondary"}
                                className={
                                  percentage >= 70
                                    ? "bg-green-100 text-green-800"
                                    : percentage >= 50
                                      ? "bg-yellow-100 text-yellow-800"
                                      : "bg-red-100 text-red-800"
                                }
                              >
                                {percentage}%
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-sm text-slate-600">
                              <Clock className="w-3 h-3" />
                              {formatTime(submission.completion_time || 0)}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-sm text-slate-600">
                              <CalendarIcon className="w-3 h-3" />
                              {submission.completed_at
                                ? format(new Date(submission.completed_at), 'MMM d, HH:mm')
                                : 'غير معروف'
                              }
                            </div>
                          </TableCell>
                          <TableCell>
                            {!isSelectionMode && (
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setSelectedSubmission(submission)}
                                  title="عرض التفاصيل"
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => recorrectSubmission(submission)}
                                  disabled={isRecorrecting || isAICorrecting} // Disable if any recorrection is in progress
                                  className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                                  title="إعادة تصحيح"
                                >
                                  {isRecorrecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => aiCorrectSubmission(submission)}
                                  disabled={isRecorrecting || isAICorrecting}
                                  className="text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                                  title="تصحيح ذكي بالذكاء الاصطناعي"
                                >
                                  {isAICorrecting ? <Loader2 className="w-4 h-4 animate-spin" /> : "🤖"}
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Submission Detail Modal */}
        {selectedSubmission && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <Card className="max-w-4xl w-full max-h-[80vh] overflow-y-auto">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle>تفاصيل الإجابة</CardTitle>
                    <p className="text-slate-600">
                      {selectedSubmission.respondent_name} - {
                        quizzes.find(q => q.id === selectedSubmission.quiz_id)?.title
                      }
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSelectedSubmission(null)}
                  >
                    ×
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-4 bg-slate-50 rounded-lg">
                      <div className="text-2xl font-bold">
                        {selectedSubmission.score}/{selectedSubmission.max_score}
                      </div>
                      <div className="text-sm text-slate-600">النتيجة النهائية</div>
                    </div>
                    <div className="text-center p-4 bg-blue-50 rounded-lg">
                      <div className="text-2xl font-bold text-blue-700">
                        {Math.round(((selectedSubmission.score || 0) / (selectedSubmission.max_score || 1)) * 100)}%
                      </div>
                      <div className="text-sm text-slate-600">النسبة المئوية</div>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-4">الأسئلة والإجابات</h3>
                    <SubmissionQuestionsViewAR 
                      submission={selectedSubmission} 
                      quizId={selectedSubmission.quiz_id}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

// Helper function to extract the real question ID from a temporary bank ID
const getRealQuestionId = (id) => {
  if (typeof id === 'string' && id.startsWith('bank_')) {
    const parts = id.split('_');
    if (parts.length > 1) {
      return parts[1]; // The real ID is the second part
    }
  }
  return id; // Return original ID if not a bank ID
};

// New component to show questions and answers in Arabic
function SubmissionQuestionsViewAR({ submission, quizId }) {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadQuestions = async () => {
      setLoading(true);
      try {
        const session = localStorage.getItem('gts_user_session');
        const currentUser = JSON.parse(session);

        if (!submission.answers || submission.answers.length === 0) {
          setQuestions([]);
          setLoading(false);
          return;
        }
        
        // Get all unique, real question IDs from the submission answers
        const requiredRealQuestionIds = [...new Set(submission.answers.map(a => getRealQuestionId(a.question_id)))];
        
        let fetchedQuestions = [];

        // Fetch questions from QuestionAR (direct quiz questions)
        const directQuizQuestions = await QuestionAR.filter({ 
          quiz_id: quizId, 
          owner_id: currentUser.user_id,
          id: { $in: requiredRealQuestionIds } 
        }, "order");
        fetchedQuestions.push(...directQuizQuestions);

        // Fetch questions from QuestionBankAR
        const bankQuestions = await QuestionBankAR.filter({ 
          owner_id: currentUser.user_id,
          id: { $in: requiredRealQuestionIds } 
        });
        // Add bank questions, avoiding duplicates if any ID overlapped (unlikely but safe)
        const existingIds = new Set(fetchedQuestions.map(q => q.id));
        bankQuestions.forEach(q => {
          if (!existingIds.has(q.id)) {
            fetchedQuestions.push(q);
          }
        });
        
        setQuestions(fetchedQuestions);
      } catch (error) {
        console.error("Error loading questions:", error);
        setQuestions([]);
      }
      setLoading(false);
    };

    if (quizId && submission.answers) {
      loadQuestions();
    } else {
      setQuestions([]); // Clear questions if no quizId or no answers
    }
  }, [quizId, submission]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="mr-2 text-slate-600">جاري تحميل الأسئلة...</span>
      </div>
    );
  }

  if (!submission.answers || submission.answers.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <FileText className="w-8 h-8 text-slate-400" />
        </div>
        <h3 className="text-lg font-semibold text-slate-700 mb-2">لم يتم تسجيل إجابات</h3>
        <p className="text-slate-500">هذا التقديم لا يحتوي على أي بيانات إجابة.</p>
      </div>
    );
  }

  // Create a map for quick question lookup using their real IDs
  const questionMap = {};
  questions.forEach(q => {
    questionMap[q.id] = q;
  });

  return (
    <div className="space-y-4">
      {submission.answers.map((answer, index) => {
        // Use the helper to find the question in the map
        const realId = getRealQuestionId(answer.question_id);
        const question = questionMap[realId];
        
        if (!question) {
          return (
            <div key={index} className="p-4 border rounded-lg bg-red-50 border-red-200">
              <div className="flex items-start gap-2">
                <div className="w-2 h-2 bg-red-500 rounded-full mt-2"></div>
                <div className="flex-1">
                  <p className="text-sm font-medium mb-1 text-red-800">
                    السؤال {index + 1} - معرف السؤال: {answer.question_id}
                  </p>
                  <p className="text-sm text-red-700 mb-2">
                    <strong>خطأ:</strong> لم يتم العثور على تفاصيل هذا السؤال في قاعدة البيانات. قد يكون السؤال محذوفاً.
                  </p>
                  <p className="text-sm text-slate-600 mt-2">
                    <strong>إجابة الطالب:</strong> {answer.answer || 'لم يتم تقديم إجابة'}
                  </p>
                  <p className="text-sm text-slate-600">
                    <strong>النتيجة:</strong> {answer.is_correct ? '✓ صحيح' : '✗ خطأ'}
                  </p>
                  <Badge variant="outline" className="bg-red-100 text-red-800 mt-2">
                    سؤال غير موجود
                  </Badge>
                </div>
              </div>
            </div>
          );
        }

        // Handle different answer formats
        let studentAnswerText = answer.answer;
        if (question.type === 'checkbox' && studentAnswerText) {
          try {
            const parsed = JSON.parse(studentAnswerText);
            if (Array.isArray(parsed)) {
              studentAnswerText = parsed.join('، ');
            }
          } catch (e) {
            // Not JSON, keep as is
          }
        }

        return (
          <div key={index} className={`p-4 border rounded-lg ${answer.is_correct ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
            <div className="flex items-start gap-3">
              <div className={`w-2 h-2 rounded-full mt-2 ${answer.is_correct ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <div className="flex-1">
                <p className="text-sm font-medium mb-2">
                  السؤال {index + 1}: {question.question}
                </p>

                {/* Show options for multiple choice/checkbox questions */}
                {(question.type === 'multiple_choice' || question.type === 'checkbox') && question.options && question.options.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs font-medium text-slate-600 mb-1">الخيارات المتاحة:</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
                      {question.options.map((option, optIndex) => (
                        <div key={optIndex} className={`text-xs p-2 rounded ${
                          question.correct_answers?.includes(option) 
                            ? 'bg-green-100 text-green-800 border border-green-300' 
                            : 'bg-slate-100 text-slate-700'
                        }`}>
                          {option || `الخيار ${optIndex + 1}`}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <p className="text-sm">
                    <strong className="text-slate-800">إجابة الطالب:</strong>{' '}
                    <span className={answer.is_correct ? 'text-green-700' : 'text-red-700'}>
                      {studentAnswerText || 'لم يتم تقديم إجابة'}
                    </span>
                  </p>

                  {!answer.is_correct && question.correct_answers && question.correct_answers.length > 0 && (
                    <p className="text-sm">
                      <strong className="text-slate-800">الإجابة الصحيحة:</strong>{' '}
                      <span className="text-green-700">
                        {Array.isArray(question.correct_answers) ? question.correct_answers.join('، ') : question.correct_answers}
                      </span>
                    </p>
                  )}

                  {question.explanation && (
                    <p className="text-sm">
                      <strong className="text-slate-800">التفسير:</strong>{' '}
                      <span className="text-slate-600">{question.explanation}</span>
                    </p>
                  )}

                  {answer.ai_explanation && (
                    <p className="text-sm">
                        <strong className="text-slate-800">تفسير الذكاء الاصطناعي:</strong>{' '}
                        <span className="text-slate-600">{answer.ai_explanation}</span>
                    </p>
                  )}
                  {answer.ai_confidence !== null && answer.ai_confidence !== undefined && (
                      <p className="text-sm">
                          <strong className="text-slate-800">ثقة الذكاء الاصطناعي:</strong>{' '}
                          <span className="text-slate-600">{Math.round(answer.ai_confidence * 100)}%</span>
                      </p>
                  )}
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <Badge
                    variant={answer.is_correct ? "default" : "secondary"}
                    className={answer.is_correct ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}
                  >
                    {answer.is_correct ? '✓ صحيح' : '✗ خطأ'}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {question.points || 1} نقطة
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {question.type === 'multiple_choice' ? 'اختيار من متعدد' :
                     question.type === 'checkbox' ? 'صناديق اختيار' :
                     question.type === 'true_false' ? 'صح/خطأ' :
                     question.type === 'text' ? 'نص' :
                     question.type === 'fill_blank' ? 'ملء الفراغ' : question.type}
                  </Badge>
                  {/* Show if this is from question bank */}
                  {question.category && (
                    <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700">
                      بنك الأسئلة
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
