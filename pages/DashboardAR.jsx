
import React, { useState, useEffect, useMemo } from "react";
import { QuizAR, SubmissionAR, QuestionAR } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle }
  from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  Plus,
  Search,
  MoreVertical,
  Eye,
  Edit,
  BarChart3,
  Zap,
  FileText,
  Users,
  TrendingUp,
  Clock,
  Share,
  Trash2,
  ExternalLink,
  Loader2,
  X,
  QrCode, // Added QR Code icon
  Download // Added Download icon
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { motion } from "framer-motion";
import { format } from "date-fns";

export default function DashboardAR() {
  const [quizzes, setQuizzes] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  // State for bulk actions
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedQuizIds, setSelectedQuizIds] = useState([]);
  const [isDeleting, setIsDeleting] = useState(false);

  // New state for QR codes
  const [quizQRCodes, setQuizQRCodes] = useState({});
  const [isGeneratingQR, setIsGeneratingQR] = useState({});

  // Effect to load QR codes from localStorage on component mount
  useEffect(() => {
    const savedQRCodes = localStorage.getItem('gts_quiz_qr_codes_ar');
    if (savedQRCodes) {
      try {
        setQuizQRCodes(JSON.parse(savedQRCodes));
      } catch (error) {
        console.error("Failed to load saved QR codes:", error);
      }
    }
  }, []);

  // Effect to save QR codes to localStorage whenever quizQRCodes changes
  useEffect(() => {
    localStorage.setItem('gts_quiz_qr_codes_ar', JSON.stringify(quizQRCodes));
  }, [quizQRCodes]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Changed to gts_user_session for data isolation
      const session = localStorage.getItem('gts_user_session');
      if (!session) {
        setIsLoading(false);
        return;
      }

      const currentUser = JSON.parse(session);

      // Strict query to get ONLY the current user's quizzes based on owner_id
      const userQuizzes = await QuizAR.filter({ owner_id: currentUser.user_id }, "-updated_date", 1000);

      if (userQuizzes.length === 0) {
        setQuizzes([]);
        setSubmissions([]);
        setIsLoading(false);
        return;
      }

      const userQuizIds = userQuizzes.map(q => q.id);

      // Securely filter submissions and questions by owner_id and quiz_id
      const [userQuestions, userSubmissions] = await Promise.all([
        QuestionAR.filter({ owner_id: currentUser.user_id, quiz_id: { $in: userQuizIds } }, "-created_date", 1000),
        SubmissionAR.filter({ owner_id: currentUser.user_id, quiz_id: { $in: userQuizIds } }, "-created_date", 1000)
      ]);

      const questionCounts = {};
      userQuestions.forEach(q => {
        questionCounts[q.quiz_id] = (questionCounts[q.quiz_id] || 0) + 1;
      });

      const quizzesWithCounts = userQuizzes.map(quiz => ({
        ...quiz,
        questionCount: questionCounts[quiz.id] || 0
      }));

      setQuizzes(quizzesWithCounts);
      setSubmissions(userSubmissions);

    } catch (error) {
      console.error("Error loading Arabic data:", error);
      setQuizzes([]);
      setSubmissions([]);
    }
    setIsLoading(false);
  };

  // Add helper function for rate-limited operations
  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  const deleteQuizAndDependencies = async (quizId) => {
    try {
      const session = localStorage.getItem('gts_user_session');
      const currentUser = JSON.parse(session);

      // Get questions and submissions to delete with smaller batches
      const [questionsToDelete, submissionsToDelete] = await Promise.all([
        QuestionAR.filter({ quiz_id: quizId, owner_id: currentUser.user_id }),
        SubmissionAR.filter({ quiz_id: quizId, owner_id: currentUser.user_id })
      ]);

      // Delete in small batches to avoid rate limiting
      const batchSize = 5; // Reduce batch size significantly
      const delayBetweenBatches = 1000; // 1 second delay between batches

      // Delete questions in batches
      if (questionsToDelete.length > 0) {
        for (let i = 0; i < questionsToDelete.length; i += batchSize) {
          const batch = questionsToDelete.slice(i, i + batchSize);
          const deletePromises = batch.map(q => QuestionAR.delete(q.id));
          
          try {
            await Promise.all(deletePromises);
            // Add delay between batches to respect rate limits
            if (i + batchSize < questionsToDelete.length) {
              await delay(delayBetweenBatches);
            }
          } catch (error) {
            console.error(`Failed to delete question batch starting at index ${i}:`, error);
            // Continue with next batch even if some fail
          }
        }
      }

      // Delete submissions in batches
      if (submissionsToDelete.length > 0) {
        for (let i = 0; i < submissionsToDelete.length; i += batchSize) {
          const batch = submissionsToDelete.slice(i, i + batchSize);
          const deletePromises = batch.map(s => SubmissionAR.delete(s.id));
          
          try {
            await Promise.all(deletePromises);
            if (i + batchSize < submissionsToDelete.length) {
              await delay(delayBetweenBatches);
            }
          } catch (error) {
            console.error(`Failed to delete submission batch starting at index ${i}:`, error);
          }
        }
      }

      // Finally, delete the quiz itself
      await QuizAR.delete(quizId);

      // Remove QR code data for the deleted quiz
      setQuizQRCodes(prev => {
        const updated = { ...prev };
        delete updated[quizId];
        return updated;
      });

    } catch (error) {
      console.error(`Failed to delete quiz ${quizId} and its dependencies`, error);
      throw error;
    }
  };

  const handleBulkDelete = async () => {
    if (selectedQuizIds.length === 0) return;

    const confirmMessage = `هل أنت متأكد من حذف ${selectedQuizIds.length} اختبار؟ سيتم حذف جميع الأسئلة والإجابات المرتبطة نهائياً. لا يمكن التراجع عن هذا الإجراء.\n\nملاحظة: قد تستغرق هذه العملية بعض الوقت لتجنب حدود معدل الطلبات.`;
    if (!confirm(confirmMessage)) return;

    setIsDeleting(true);
    
    // Process quiz deletions one by one to avoid rate limits
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < selectedQuizIds.length; i++) {
      const quizId = selectedQuizIds[i];
      try {
        await deleteQuizAndDependencies(quizId);
        successCount++;
        
        // Add delay between quiz deletions
        if (i < selectedQuizIds.length - 1) {
          await delay(2000); // 2 second delay between quiz deletions
        }
      } catch (error) {
        console.error(`Failed to delete quiz ${quizId}:`, error);
        failCount++;
      }
    }

    // Show results to user
    if (failCount === 0) {
      alert(`تم حذف جميع الاختبارات (${successCount}) بنجاح!`);
    } else if (successCount === 0) {
      alert(`فشل في حذف جميع الاختبارات. يرجى المحاولة مرة أخرى لاحقاً.`);
    } else {
      alert(`تم حذف ${successCount} اختبار بنجاح. فشل في حذف ${failCount} اختبار. يرجى المحاولة مرة أخرى للعناصر المتبقية.`);
    }

    setIsDeleting(false);
    setSelectedQuizIds([]);
    setIsSelectionMode(false);
    loadData();
  };

  const handleQuizSelect = (quizId) => {
    setSelectedQuizIds(prev =>
      prev.includes(quizId)
        ? prev.filter(id => id !== quizId)
        : [...prev, quizId]
    );
  };

  const filteredQuizzes = quizzes.filter(quiz =>
    quiz.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    quiz.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectAll = () => {
    if (selectedQuizIds.length === filteredQuizzes.length) {
      setSelectedQuizIds([]);
    } else {
      setSelectedQuizIds(filteredQuizzes.map(q => q.id));
    }
  };

  const copyShareLink = (quiz) => {
    const shareUrl = `${window.location.origin}${createPageUrl(`TakeQuizAR?token=${quiz.share_token}`)}`;
    navigator.clipboard.writeText(shareUrl);
    alert(`تم نسخ رابط الاختبار!\n\n${shareUrl}\n\nشارك هذا الرابط مع أي شخص ليأخذ الاختبار - لا حاجة لتسجيل الدخول!`);
  };

  const testQuiz = (quiz) => {
    const shareUrl = `${window.location.origin}${createPageUrl(`TakeQuizAR?token=${quiz.share_token}`)}`;
    window.open(shareUrl, '_blank');
  };

  const generateQRCode = async (quiz) => {
    if (!quiz.share_token) {
      alert("يجب نشر الاختبار أولاً لإنتاج رمز QR.");
      return;
    }

    setIsGeneratingQR(prev => ({ ...prev, [quiz.id]: true }));

    try {
      const shareUrl = `${window.location.origin}${createPageUrl(`TakeQuizAR?token=${quiz.share_token}`)}`;

      // Generate QR code using a public API
      const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(shareUrl)}`;

      // Store the QR code URL
      setQuizQRCodes(prev => ({
        ...prev,
        [quiz.id]: {
          url: qrApiUrl,
          shareUrl: shareUrl,
          generatedAt: new Date().toISOString()
        }
      }));

    } catch (error) {
      console.error("Error generating QR code:", error);
      alert("فشل في إنتاج رمز QR. يرجى المحاولة مرة أخرى.");
    } finally {
      setIsGeneratingQR(prev => ({ ...prev, [quiz.id]: false }));
    }
  };

  const showQRCode = (quiz) => {
    const qrData = quizQRCodes[quiz.id];
    if (!qrData) {
      alert("لم يتم إنتاج رمز QR لهذا الاختبار بعد. يرجى إنتاج واحد أولاً.");
      return;
    }

    // Clean up previous modal if it exists
    const existingModal = document.querySelector('.quiz-qr-modal');
    if (existingModal) {
      document.body.removeChild(existingModal);
    }

    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 quiz-qr-modal';
    modal.onclick = (e) => {
      if (e.target === modal) {
        document.body.removeChild(modal);
      }
    };

    modal.innerHTML = `
      <div class="bg-white rounded-xl p-6 max-w-md w-full shadow-2xl text-center" dir="rtl">
        <h3 class="text-xl font-bold mb-4 text-gray-800">رمز QR لـ "${quiz.title}"</h3>
        <div class="bg-white p-4 border-2 border-gray-200 rounded-lg mb-4 inline-block">
          <img src="${qrData.url}" alt="QR Code" class="w-64 h-64 mx-auto" />
        </div>
        <p class="text-sm text-gray-600 mb-6">امسح الرمز بأي قارئ للوصول إلى الاختبار فوراً</p>
        <div class="flex flex-col gap-3">
          <button onclick="
            const link = document.createElement('a');
            link.href = '${qrData.url}';
            link.download = 'quiz-qr-${quiz.id}-${Date.now()}.png';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
          " class="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors flex items-center justify-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M21 15v4a2 0 0 1-2 2H5a2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
            تحميل رمز QR عالي الجودة
          </button>
          <button onclick="
            navigator.clipboard.writeText('${qrData.shareUrl}');
            const btn = this;
            btn.innerHTML = '<svg class=\\"w-4 h-4 mr-2\\" fill=\\"none\\" stroke=\\"currentColor\\" viewBox=\\"0 0 24 24\\" xmlns=\\"http://www.w3.org/2000/svg\\"><path strokeLinecap=\\"round\\" strokeLinejoin=\\"round\\" strokeWidth=\\"2\\" d=\\"M5 13l4 4L19 7\\"></path></svg> تم نسخ الرابط!';
            setTimeout(() => btn.innerHTML = 'نسخ رابط الاختبار', 2000);
          " class="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-medium transition-colors flex items-center justify-center gap-2">
            نسخ رابط الاختبار
          </button>
          <button onclick="document.body.removeChild(this.closest('.fixed'))" 
                   class="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium transition-colors">
            إغلاق
          </button>
        </div>
        <div class="mt-4 pt-4 border-t border-gray-200">
          <p class="text-xs text-gray-500">
            تم الإنشاء: ${new Date(qrData.generatedAt).toLocaleString('ar-EG')}<br>
            <span class="text-green-600 font-medium">✅ محفوظ بشكل دائم</span>
          </p>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
  };


  const stats = {
    totalQuizzes: quizzes.length,
    publishedQuizzes: quizzes.filter(q => q.status === 'published').length,
    totalSubmissions: submissions.length,
    avgScore: submissions.length > 0
      ? Math.round(submissions.reduce((acc, sub) => acc + (sub.score || 0), 0) / submissions.length)
      : 0
  };

  const categoryColors = {
    education: "bg-blue-100 text-blue-800 border-blue-200",
    corporate: "bg-purple-100 text-purple-800 border-purple-200",
    research: "bg-green-100 text-green-800 border-green-200",
    evaluation: "bg-orange-100 text-orange-800 border-orange-200",
    other: "bg-slate-100 text-slate-800 border-slate-200"
  };

  return (
    <div className="p-4 md:p-8 space-y-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">
              لوحة تحكم الاختبارات
            </h1>
            <p className="text-slate-600 text-lg">
              إدارة ومراقبة جميع اختباراتك في مكان واحد
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isSelectionMode ? (
              <>
                <Button variant="ghost" onClick={() => { setIsSelectionMode(false); setSelectedQuizIds([]); }}>
                  <X className="w-4 h-4 mr-2" /> إلغاء
                </Button>
                <Button 
                  variant="destructive" 
                  onClick={handleBulkDelete} 
                  disabled={selectedQuizIds.length === 0 || isDeleting}
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
                      حذف ({selectedQuizIds.length})
                    </>
                  )}
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setIsSelectionMode(true)} disabled={quizzes.length === 0}>
                  <Trash2 className="w-4 h-4 mr-2" /> عمليات مجمعة
                </Button>
                <Link to={createPageUrl("QuizBuilderAR")}>
                  <Button className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl transition-all duration-200">
                    <Plus className="w-5 h-5 mr-2" />
                    إنشاء اختبار
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {[
            {
              title: "إجمالي الاختبارات",
              value: stats.totalQuizzes,
              icon: FileText,
              color: "from-blue-500 to-blue-600",
              change: "+12%"
            },
            {
              title: "منشورة",
              value: stats.publishedQuizzes,
              icon: Zap,
              color: "from-green-500 to-green-600",
              change: "+8%"
            },
            {
              title: "إجمالي الردود",
              value: stats.totalSubmissions,
              icon: Users,
              color: "from-purple-500 to-purple-600",
              change: "+24%"
            },
            {
              title: "متوسط النتيجة",
              value: `${stats.avgScore}%`,
              icon: TrendingUp,
              color: "from-orange-500 to-orange-600",
              change: "+5%"
            }
          ].map((stat, index) => (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="relative overflow-hidden bg-white/80 backdrop-blur-sm border-slate-200/60 hover:shadow-lg transition-all duration-200">
                <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${stat.color} opacity-10 rounded-full transform translate-x-8 -translate-y-8`} />
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
                  <div className="flex items-center mt-4">
                    <TrendingUp className="w-4 h-4 text-green-500 mr-1" />
                    <span className="text-green-600 font-medium text-sm">{stat.change}</span>
                    <span className="text-slate-500 text-sm ml-1">مقارنة بالشهر الماضي</span>
                  </div>
                </CardHeader>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Search and Filters */}
        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 mb-8">
          <CardHeader className="pb-4">
            <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
              <div className="relative flex-1 w-full md:w-auto">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                <Input
                  placeholder="البحث في الاختبارات..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 border-slate-200 focus:border-blue-400"
                />
              </div>
              {isSelectionMode && (
                <div className="flex items-center gap-4">
                  <Badge variant="outline">{selectedQuizIds.length} من {filteredQuizzes.length} مُحدد</Badge>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="select-all"
                      onCheckedChange={handleSelectAll}
                      checked={selectedQuizIds.length === filteredQuizzes.length && filteredQuizzes.length > 0}
                    />
                    <label htmlFor="select-all" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      تحديد الكل
                    </label>
                  </div>
                </div>
              )}
            </div>
          </CardHeader>
        </Card>

        {/* Quizzes Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
          ) : (
            filteredQuizzes.map((quiz, index) => (
              <motion.div
                key={quiz.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="relative"
              >
                {isSelectionMode && (
                  <div className="absolute top-3 right-3 z-10">
                    <Checkbox
                      checked={selectedQuizIds.includes(quiz.id)}
                      onCheckedChange={() => handleQuizSelect(quiz.id)}
                      className="bg-white border-slate-300"
                    />
                  </div>
                )}
                <Card className={`group hover:shadow-xl transition-all duration-300 bg-white/90 backdrop-blur-sm border-slate-200/60 overflow-hidden ${isSelectionMode && selectedQuizIds.includes(quiz.id) ? 'ring-2 ring-blue-500' : ''} ${isSelectionMode ? 'cursor-pointer' : ''}`}
                  onClick={() => isSelectionMode && handleQuizSelect(quiz.id)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <div className="flex-1 min-w-0 pr-4">
                        <CardTitle className="text-lg font-semibold text-slate-900 truncate group-hover:text-blue-700 transition-colors">
                          {quiz.title || "اختبار بدون عنوان"}
                        </CardTitle>
                        <p className="text-sm text-slate-500 mt-1 line-clamp-2">
                          {quiz.description || "لا يوجد وصف"}
                        </p>
                      </div>
                      {!isSelectionMode && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link to={createPageUrl(`QuizBuilderAR?id=${quiz.id}`)}>
                                <Edit className="w-4 h-4 mr-2" />
                                تعديل الاختبار
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link to={createPageUrl(`PreviewAR?id=${quiz.id}`)}>
                                <Eye className="w-4 h-4 mr-2" />
                                معاينة
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link to={createPageUrl(`SubmissionsAR?quiz=${quiz.id}`)}>
                                <BarChart3 className="w-4 h-4 mr-2" />
                                عرض النتائج
                              </Link>
                            </DropdownMenuItem>
                            {quiz.status === 'published' && quiz.share_token && (
                              <>
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); testQuiz(quiz); }}>
                                  <ExternalLink className="w-4 h-4 mr-2" />
                                  فتح الاختبار (تجربة)
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); copyShareLink(quiz); }}>
                                  <Share className="w-4 h-4 mr-2" />
                                  نسخ رابط المشاركة
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={(e) => { e.stopPropagation(); generateQRCode(quiz); }}
                                  disabled={isGeneratingQR[quiz.id]}
                                >
                                  {isGeneratingQR[quiz.id] ? (
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  ) : (
                                    <QrCode className="w-4 h-4 mr-2" />
                                  )}
                                  {quizQRCodes[quiz.id] ? 'إعادة إنتاج رمز QR' : 'إنتاج رمز QR'}
                                </DropdownMenuItem>
                                {quizQRCodes[quiz.id] && (
                                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); showQRCode(quiz); }}>
                                    <Download className="w-4 h-4 mr-2" />
                                    عرض وحفظ رمز QR
                                  </DropdownMenuItem>
                                )}
                              </>
                            )}
                            <DropdownMenuItem
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (!confirm("هل أنت متأكد من حذف هذا الاختبار؟ سيتم حذف جميع الأسئلة والإجابات المرتبطة نهائياً. لا يمكن التراجع عن هذا الإجراء.")) return;
                                await deleteQuizAndDependencies(quiz.id);
                                loadData();
                              }}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              حذف الاختبار
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex items-center gap-2 mb-4">
                      <Badge
                        variant="outline"
                        className={`${categoryColors[quiz.category || 'other']} border`}
                      >
                        {(quiz.category || 'other').replace('_', ' ')}
                      </Badge>
                      <Badge
                        variant={quiz.status === 'published' ? 'default' : 'secondary'}
                        className={quiz.status === 'published'
                          ? 'bg-green-100 text-green-800 border-green-200'
                          : 'bg-slate-100 text-slate-600'
                        }
                      >
                        {quiz.status === 'published' ? 'منشور' : 'مسودة'}
                      </Badge>
                      {quiz.settings?.require_password && (
                        <Badge variant="outline" className="bg-yellow-50 text-yellow-700">
                          🔒 محمي
                        </Badge>
                      )}
                      {quiz.settings?.use_question_bank && (
                        <Badge variant="outline" className="bg-purple-50 text-purple-700">
                          📚 بنك
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-sm text-slate-600">
                      <div className="flex items-center gap-4">
                        <span className="flex items-center gap-1">
                          <FileText className="w-4 h-4" />
                          {quiz.settings?.use_question_bank
                            ? `${quiz.settings.questions_per_user || 0} لكل مستخدم`
                            : `${quiz.questionCount || 0} أسئلة`
                          }
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          {submissions.filter(s => s.quiz_id === quiz.id).length}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-xs">
                        <Clock className="w-3 h-3" />
                        {format(new Date(quiz.updated_date), 'MMM d')}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))
          )}
        </div>

        {filteredQuizzes.length === 0 && !isLoading && (
          <div className="text-center py-12">
            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-xl font-semibold text-slate-700 mb-2">
              {searchQuery ? "لم يتم العثور على اختبارات" : "لا توجد اختبارات بعد"}
            </h3>
            <p className="text-slate-500 mb-6">
              {searchQuery
                ? "جرب تعديل معايير البحث"
                : "أنشئ اختبارك الأول للبدء"
              }
            </p>
            <Link to={createPageUrl("QuizBuilderAR")}>
              <Button className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700">
                <Plus className="w-4 h-4 mr-2" />
                إنشاء اختبار
              </Button>
            </Link>
          </div>
        )}

        {/* Footer */}
        <div className="text-center py-8 mt-12 border-t border-slate-200">
          <p className="text-sm text-slate-500">
            تم الإنشاء بواسطة N
          </p>
        </div>
      </div>
    </div>
  );
}
